# Plano de continuação — retomar em casa (a partir de 2026-07-24)

> Documento-ponte: histórico do que foi feito, estado atual do sistema, e os
> próximos passos priorizados. Serve como **prompt de retomada** — pode ser
> lido/colado numa sessão nova pra continuar de onde paramos, sem perder contexto.

---

## 0. Prompt de retomada (cole isto numa sessão nova)

> Estou continuando o Projeto Aurora (NOESIS/LCA). Antes de agir, leia:
> `research/PLANO-CONTINUACAO-24-07.md` (este arquivo), `journal/2026-07-24.md`,
> `decisions/ADR-0013-reflexao-automatica.md` e `IDENTITY.md`. Rode `git log --oneline -8`
> pra ver os últimos commits. Confirme o estado verde (aurora-desktop `npm test`,
> noesis-mcp `npm test`, validador do vault). Depois me diga por onde seguir entre
> os "Próximos passos" deste plano — minha prioridade é a **temporalidade das
> interações** (tarefa aberta). Push exige `gh auth switch --user lucas-gonzales97`
> antes (senão dá 403).

---

## 1. O que é o projeto (contexto mínimo)

Aurora é uma persona de IA pessoal que roda sobre o **NOESIS** — um grafo de
conhecimento vivo (vault de notas Markdown com frontmatter tipado) exposto por um
**servidor MCP em TypeScript** (`noesis-mcp/`). O cliente principal é o
**Aurora Desktop** (`aurora-desktop/`, Electron + React + Vite). A memória do
usuário vem 100% do vault via `get_context` — a Aurora nasce crua, sem dado
pessoal chumbado (ADR-0009).

Estrutura de pastas:
- `aurora-desktop/` — app Electron (main + renderer). Testes: `npm test` (vitest).
- `noesis-mcp/` — servidor MCP (7 tools). Testes: `npm test` (tsx). Build: `npm run build` (tsc, src→dist). **O app usa o `dist`, então mudar o src exige rebuild.**
- `decisions/` — ADRs. `journal/` — diário por dia. `research/` — pesquisas (fora do validador).
- `user-model/`, `ontology/`, `events/` — o vault propriamente.

## 2. Estado atual — o que o sistema JÁ FAZ

- **Chat multi-LLM** (OpenAI, Groq, Mistral, OpenRouter, DeepSeek, Ollama, Anthropic, Gemini) com voz (STT/TTS via Azure + fallback local) e imagem.
- **Aurora crua** (ADR-0009): contexto do usuário só via vault/`get_context`.
- **Retrieval triplo** (ADR-0010): relevância × recência × importância.
- **Memória de chat** em SQLite local (ADR-0011): histórico, retomar sessões.
- **Aba Mente** (ADR-0012): grafo do vault com nós acendendo no retrieval.
- **Reflexão automática** (ADR-0013, feito hoje): job de fim de sessão que sintetiza uma hipótese sobre o usuário e grava em `user-model/patterns/` com `origin: reflection`. Métrica emergido/inserido (`cd noesis-mcp && npm run emergence`).
- Instalador `.exe` (electron-builder) — **mas a versão instalada no desktop é a de 23/07, sem nada de hoje** (ver Pendências).

Testes ao fim de hoje: **aurora-desktop 95/95 · noesis-mcp 24/24 · vault válido · tsc limpo (main+renderer)**.

## 3. O que foi feito hoje (2026-07-24)

### Bloco E — reflexão automática (ADR-0013) ✅
Implementado, testado (23 testes novos entre `reflection.ts` e `emergence.ts` +
`chatStore` com `endSession(summary)`/`getSession`), documentado (ADR-0013),
commitado (`0b062e8`). Detalhes técnicos no ADR e no journal.

### Teste E2E manual — SUCESSO (com 1 bug pego e corrigido) ✅
- 1ª tentativa: a reflexão **disparou**, chamou o LLM, sintetizou — mas a nota
  falhou na validação porque o **`noesis-mcp/dist` estava desatualizado** (editei
  o `src` do validador e não rodei `npm run build`). Os testes passavam porque
  rodam do `src` via tsx; o app usa o `dist`. **Lição: mudou validador/tool do
  noesis-mcp → `npm run build` antes de testar no app.**
- Corrigido o `dist`. Tentativa final: reflexão **gravada com sucesso**.
  Emergência 0→1. A nota (`pattern-reflexao-2026-07-24-b23024c0.md`) sintetizou um
  meta-padrão real do Lucas: *"trata o desenvolvimento pessoal como um sistema de
  múltiplas metas paralelas com um ciclo consistente de validação antes de
  escalar"* — conclusão que nenhuma mensagem isolada continha. O mecanismo
  reflection-tree funcionou de ponta a ponta.
- Nota de processo: em dev, o vault é o próprio repo, então a reflexão nasceu como
  arquivo real no repo (em produção nasceria no vault privado do userData).

### Pesquisa de design de apps de IA ✅
`research/PESQUISA-DESIGN-APPS-IA.md` — Claude, ChatGPT/Codex, Perplexity,
Notion AI, Cursor, Linear (+ Gemini), com tabelas por produto, padrões
recorrentes, diferenciais, ponte pra Aurora e fontes. Base pro design system.

### Pedido de feature registrado — temporalidade
O Lucas apontou que as interações do chat não mostram data/hora e que o modelo
não sabe *quando* cada mensagem foi dita (só o "agora" via `nowContext`). O dado
(`ts` por mensagem) já existe no `chat.db`, mas é descartado no `loadSession` e
não vai pro modelo. Virou a próxima tarefa prioritária.

## 4. Pendências e bugs conhecidos

- **[Prioridade] Temporalidade das interações** — mostrar data/hora em cada
  interação (texto, áudio, imagem, anexo) na UI, agrupado por dia; carregar o `ts`
  no `loadSession` (hoje é jogado fora); e **alimentar o modelo com os timestamps**
  (chat E reflexão) pra noção temporal real. Fuso America/Sao_Paulo, como o
  `nowContext` de `prompt.ts`.
- **App instalado desatualizado** — o `.exe` no desktop é de 23/07. Pra ganhar a
  reflexão (e a temporalidade), rebuildar: `cd aurora-desktop && npm run dist:win`
  e reinstalar. **Rebuildar SÓ depois de `cd noesis-mcp && npm run build`**, senão
  empacota o `dist` velho (o mesmo bug de hoje, mas no instalador).
- **Limitações da reflexão v0** (documentadas no ADR-0013): salience é contagem de
  mensagens (não importância real); sessão já encerrada não reflete de novo;
  profundidade 1 (sem reflexão sobre reflexões).
- **Herdadas de 23/07**: veredito da bancada de retrieval
  (`noesis-mcp/bench/results-2026-07-23.md`, coluna vazia); A4 completo (onboarding
  do zero no instalador novo + verificação em disco).

## 5. Próximos passos (priorizados)

1. **Temporalidade** (feature acima) — maior ganho imediato: melhora a UX diária E
   a própria reflexão (que hoje lê a conversa sem datas). Build limpo e testável.
2. **Rebuildar o instalador** — levar reflexão + temporalidade pra Aurora que o
   Lucas usa de verdade. Sequência: `noesis-mcp` build → `aurora-desktop` dist:win → reinstalar → re-testar A4.
3. **Reflexão mais inteligente** — salience por importância real (destrava quando
   existir importância por mensagem na gravação); reflexão sobre reflexões (camadas).
4. **Frente 1 — onboarding como entrevista** (roadmap): primeira conversa que já
   gera boas hipóteses, que a reflexão depois refina. Passo maior, sessão dedicada.
5. **Aplicar a pesquisa de design** — formalizar: proveniência como componente
   (nós do grafo = chips estilo Perplexity), command palette (⌘K, liga na Frente 8),
   motion tokenizado estilo Linear, seletor de superfície no header.

## 6. Como retomar (comandos)

```bash
# estado verde
cd aurora-desktop && npm test && npx tsc -p tsconfig.main.json --noEmit && npx tsc -p tsconfig.json --noEmit
cd ../noesis-mcp && npm test && npm run build
cd .. && python scripts/validate_frontmatter.py   # (use PYTHONIOENCODING=utf-8 se o console reclamar de encoding)

# rodar o app em dev
cd aurora-desktop && npm run dev

# medir emergência
cd noesis-mcp && npm run emergence

# push (a conta certa é obrigatória — senão 403)
gh auth switch --user lucas-gonzales97 && gh auth setup-git && git push
```
