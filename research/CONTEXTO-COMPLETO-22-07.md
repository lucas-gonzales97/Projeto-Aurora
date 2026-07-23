# Projeto NOESIS/Aurora — Contexto Completo (lido direto dos commits, 22/07/2026)

## TL;DR

O projeto saiu de "esqueleto de vault" para **um aplicativo desktop Electron real, multi-provedor de LLM, com voz natural, testado (42+ testes vitest), empacotado para Windows e com três bugs de produção já caçados e corrigidos** — tudo isso rodando em paralelo a esta conversa, coautorado por Claude Sonnet 5 e Claude Fable 5. As duas frentes (aqui = protótipos de voz em HTML soltos; lá = Aurora Desktop de verdade) chegaram nos mesmos problemas de forma independente, o que é o melhor sinal possível de que a arquitetura do vault está certa.

---

## Linha do tempo completa (16 commits, genesis → agora)

| # | commit | quando | autor(es) | o quê |
|---|---|---|---|---|
| 1 | `55653f8` | 17/07 | Lucas | **Genesis**: 34 arquivos, 1975 linhas — vault inteiro (Constituição, persona, USER-MODEL, 8 goals, 3 habits, 3 projects, 3 skills, motor epistêmico, roteador de modelos) |
| 2 | `e4456b5` | 17/07 | Lucas + Claude | **noesis-mcp v0**: servidor MCP TypeScript, 6 tools, valida via `validate_frontmatter.py` como fonte única de verdade |
| 3 | `cf49c8c` | ~19-20/07 | root/Fable 5 | design tokens v0 + ADR-0004 (desacopla identidade visual do contexto pessoal) |
| 4 | `da4bfdb` | ~20/07 | root/Fable 5 | onboarding epistêmico do Aurora Desktop |
| 5-6 | `a84c874`, `446d24f` | ~20/07 | root/Fable 5 | ícone oficial + scripts de build Windows (`dist:win`) |
| 7 | `b15ed2b` | 20/07 | root/Fable 5 | **pesquisa de 9 provedores LLM** (free tiers, auth, compat. OpenAI) → base do ADR-0006 |
| 8 | `e2b66ff` | 20/07 | root/Fable 5 | arquitetura multi-provedor (scaffold + ADR-0006) |
| 9 | `98439c7` | 20/07 | root/Fable 5 | **TDD dos providers** (fase 3/3): `providers/` com 8 provedores, `keyStore.ts` cifrado via `safeStorage` do Electron |
| 10 | `267268c` | 21/07 | Lucas | tela de Configurações (trocar provedor/chave na UI) |
| 11 | `c3e2ee5` | 21/07 | Lucas | telemetria por chamada (ledger de custo) |
| 12 | `9857743` | 21/07 | Lucas + Claude Sonnet 5 | **fix: TTS caía em voz masculina** — bug de `getVoices()` assíncrono |
| 13 | `5298923` | 21/07 | Lucas + Claude Sonnet 5 | **feat: voz natural via Azure AI Speech** (ADR-0007) |
| 14 | `6477c85` | 21/07 | Lucas | fix: status do chat |
| 15 | `da70c0e` | 22/07 | Lucas | fix(empacotamento): vault por instalação |
| 16 | `76b94af` | 22/07 | Lucas | **fix: seed de ontology.yaml** — ADR-0008, onboarding parava de gravar notas |

---

## O que o Aurora Desktop é, hoje, de fato

Um **app Electron real**: `src/main` (processo principal, Node) + `src/renderer` (React, UI baseada literalmente no `aurorav0.jsx` que nasceu nesta conversa — mesma paleta, mesmo componente `Metabolismo`, mesmos chips) + `preload.ts` fazendo a ponte segura via `contextBridge`, sem `nodeIntegration`. Tem instalador Windows, ícone oficial, e passou por testes reais de instalação (não só ambiente de dev).

**Chat multi-provedor (ADR-0006):** 8 provedores registrados — Anthropic, OpenAI, Gemini, Groq, Mistral, OpenRouter, Ollama, DeepSeek (Cohere documentado mas fora do escopo — free tier proíbe uso não-trivial). A pesquisa (commit 7) é rica: tabela comparando free tier real, auth, endpoint, compatibilidade OpenAI de cada um. Decisão de arquitetura: 6 dos 8 falam `chat/completions` nativamente → uma classe `OpenAICompatibleProvider` parametrizada; Anthropic e Gemini têm shape próprio → classes dedicadas. Chave de cada provedor persiste via `electron-store` + `safeStorage` do Electron (criptografia real delegada ao cofre do SO — DPAPI no Windows, Keychain no Mac, libsecret no Linux — não é só ofuscação de arquivo).

**Voz (ADR-0007) — a parte que mais ecoa nossa conversa de hoje:**
1. Primeiro bug: a Aurora saía com voz masculina mesmo com regex certa pra preferir voz feminina. Causa raiz: `speechSynthesis.getVoices()` carrega **assincronamente** no Chromium/Electron — a primeira fala da sessão pegava a lista vazia, `voice` virava `null`, e o navegador escolhia seu próprio default pt-BR (nesta máquina, "Microsoft Daniel"). Corrigido com um `loadVoices()` que cacheia a lista e espera o evento `voiceschanged` com timeout de segurança de 1s.
2. Só que corrigir o gênero não resolveu a "naturalidade" pedida originalmente — a voz certa (feminina) ainda era a SAPI5 legada, robótica. Investigação real: o Windows 11 *tem* uma voz nativa boa em pt-BR (Francisca), mas ela é exclusiva do Narrator, sem API pra outros apps usarem. Busca web confirmou que essa mesma voz existe oficialmente no **Azure AI Speech** (`pt-BR-FranciscaNeural`), tier grátis de 500 mil caracteres/mês.
3. **ElevenLabs foi oferecido ao usuário e perdeu para o Azure** — justamente porque o Azure já tinha literalmente a voz que ele queria, sem fricção de plano pago. Isso é o mesmo obstáculo que nós batemos hoje (Voice Library exige plano pago), só que resolvido numa direção diferente da nossa (nós fomos pra Google Cloud; eles foram pro Azure) — os dois são soluções válidas para o mesmo beco sem saída.
4. Arquitetura final: `speak()` tenta Azure primeiro; qualquer falha (rede, quota, chave inválida) cai pro `speechSynthesis` local automaticamente — a Aurora nunca fica muda. Mesmo princípio de degradação graciosa que já estava no `MODEL-ROUTER.md` original.
5. Testado com 6 testes unitários cobrindo inclusive escape de caracteres especiais em SSML (`&`, `<`, `>`, `"`, `'`) — o tipo de detalhe que só aparece quando alguém já foi mordido por isso.

**Bugs de empacotamento (ADR-0008) — a saga mais recente:** rodar o app em ambiente de dev sempre "funcionava" porque `VAULT_ROOT` apontava pro checkout do repositório, que já tinha `ontology/ontology.yaml`. No instalador de verdade, esse arquivo não ia junto → `create_note` falhava silenciosamente (`ENOENT` engolido em `console.warn`) → onboarding "completava" na tela mas gravava **zero notas**. Corrigido com um seed idempotente que copia `ontology/` pro `VAULT_ROOT` no primeiro boot se estiver faltando. Validado de ponta a ponta: `get_context` já recupera `goal-emprego-clt-remoto` com relevância 25 — o loop de memória fecha de verdade.

---

## Decisão em aberto, sinalizada pelo próprio agente

O último commit (76b94af) deixa registrado: o `AURORA_SYSTEM` do Aurora Desktop ainda tem os goals reais do Lucas **hardcoded** no prompt, o que faz a Aurora "confabular memória" quando o vault está vazio. Isso é **exatamente o mesmo problema** que existe nos meus protótipos daqui (`aurora-v0.jsx`, `aurora-voz-poc.html`) — os goals também estão fixos no `AURORA_SYSTEM` deles, não vêm do `get_context` do vault. Achado de forma independente dos dois lados; bom sinal de consistência, mas é dívida técnica real dos dois lados.

---

## Onde as duas frentes desta conversa se conectam

| tema | aqui (mobile, hoje) | lá (Aurora Desktop, commits) |
|---|---|---|
| Bug de voz caindo pro gênero errado | fallback pegava valor obsoleto de um dropdown escondido | `getVoices()` assíncrono retornando lista vazia na 1ª fala |
| Provedor de voz natural pt-BR | testamos ElevenLabs (bloqueado por plano grátis) → migramos pra Google Cloud | testaram ElevenLabs (mesmo bloqueio) → migraram pra Azure |
| Fallback de voz | não implementado ainda no POC | implementado: Azure → local, nunca fica muda |
| Contexto do usuário no prompt | hardcoded no `AURORA_SYSTEM` (problema não resolvido) | hardcoded no `AURORA_SYSTEM` (mesmo problema, já sinalizado como pendência) |

---

## Estado atual consolidado

**Pronto e validado:** vault Fase 0 completa; noesis-mcp v0 (6 tools); Aurora Desktop instalável com chat multi-provedor (8 provedores), tela de Configurações, telemetria, voz Azure + fallback local, onboarding que agora persiste notas de verdade.

**Pendente:**
1. Importar Artigos I-VI da Constituição (Discovery Pack original) — ainda placeholder.
2. Popular `values/` via entrevista com Lucas.
3. Decidir e remover o contexto hardcoded do `AURORA_SYSTEM` em favor de `get_context` como fonte única — pendência nos dois lados do projeto agora.
4. Testes e2e (Playwright) do fluxo multi-provedor.
5. Validação de ponta a ponta de uma síntese Azure real (só o fallback local foi testado ao vivo até o último commit).
6. Trocar/adicionar provedor de LLM porque o Groq estourou limite diário (100k tok/dia).
7. Consolidar os protótipos de voz desta conversa (HTML soltos) — o Aurora Desktop já está numa versão mais madura do mesmo problema.

## Caveat de acesso

A página `/commits/main` do GitHub e a API pública (`api.github.com`, `codeload.github.com`) ficaram bloqueadas neste ambiente por robots.txt e por uma configuração de rede que não reflete a allowlist documentada. O que resolveu foi acessar **páginas de commit individuais por hash** (`/commit/{sha}`), que não são bloqueadas e trazem diff completo — e as capturas de tela do app mobile do GitHub, que só o usuário conseguiu fornecer. Deste levantamento, 5 dos 16 commits foram lidos por inteiro via fetch direto (genesis, noesis-mcp, pesquisa LLM, os dois de TTS); os demais 11 são conhecidos pela mensagem de commit (via screenshots) mas não tiveram o diff completo lido.
