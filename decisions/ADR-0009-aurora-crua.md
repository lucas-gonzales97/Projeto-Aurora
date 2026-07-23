---
id: adr-0009
type: decision
version: 1.0.0
status: accepted
created: 2026-07-23
confidence: 0.85
mutable_by_system: never
supersedes: none
---

# ADR-0009 — Aurora crua: vault como fonte ÚNICA de contexto do usuário

## Contexto

O `AURORA_SYSTEM` em `aurora-desktop/src/renderer/AuroraApp.tsx` carregava um
bloco `CONTEXTO DO USUÁRIO` hardcoded com os goals, hábitos e perfil reais do
Lucas (dono do repo). Dois problemas provados na validação do ADR-0008:

1. **Confabulação:** com o vault vazio (instalação nova), a Aurora "lembrava"
   de metas que o usuário nunca declarou — o prompt fixo fazia ela responder
   como se conhecesse a pessoa. A resposta que pareceu "memória" na validação
   do instalador era só o texto hardcoded ecoando.
2. **Privacidade:** qualquer instalação nova de terceiro herdaria os dados
   pessoais do Lucas embutidos no binário.

A UI tinha o mesmo defeito em outra forma: as abas Painel e Automações
renderizavam arrays fixos (`GOALS`, `HABITS`, `ALARMES`) com os mesmos dados —
"metas de mentira" numa instalação limpa.

## Decisão

1. **O prompt estático carrega APENAS persona, valores e limites.** Nenhum dado
   de usuário. Tudo o que a Aurora sabe do usuário entra em runtime, via
   `get_context` (bloco `CONTEXTO RECUPERADO DO VAULT`), montado em
   `src/renderer/prompt.ts` (`buildChatSystemPrompt`). Vault vazio = nenhum
   bloco anexado = a Aurora não sabe nada — e o prompt a instrui a dizer isso
   com naturalidade em vez de preencher a lacuna.
2. **Painel e Automações viram espelho vivo do vault** via tool novo
   `list_notes` do noesis-mcp (enumeração por type/status/dir, sem pontuação
   de relevância — o que um dashboard precisa e `search_notes` não oferece).
   Vault vazio mostra estado vazio honesto com convite pro onboarding.
3. **Consciência temporal:** `nowContext()` injeta data/hora/fuso
   (America/Sao_Paulo) no início de todo system prompt (chat e onboarding) —
   sem isso o modelo não tem noção nenhuma de "agora" nem da passagem de tempo
   entre interações.
4. **Guarda de regressão:** `src/renderer/prompt.test.ts` falha se qualquer
   marcador dos dados reais que estavam hardcoded (nomes de goals, números,
   termos do perfil) reaparecer no prompt estático, e prova que a única
   diferença entre prompt-com-vault e prompt-sem-vault é o bloco de retrieval.

Este ADR também formaliza o princípio (já implícito no ADR-0008 e no plano de
23/07): **dado de usuário nunca é semeado, hardcoded ou herdado entre
instalações — só arquitetura genérica vem de fábrica.**

## Validação (2026-07-23)

- `npx vitest run`: 51 testes passando (49 pré-existentes + prompt.test.ts),
  zero regressão. `tsc --noEmit` limpo em `tsconfig.json` e `tsconfig.main.json`.
- **Manual A (vault populado):** `get_context` com intent "como está meu
  objetivo de emprego CLT?" retorna `goal-emprego-clt-remoto` no topo
  (relevância 33), conferido contra `user-model/goals/goal-emprego-clt-remoto.md`.
- **Manual B (vault vazio, simulando instalação nova):** `get_context` rodado
  contra vault temporário vazio (`NOESIS_VAULT_ROOT` apontando pra pasta limpa)
  retorna `entities: []` → `buildChatSystemPrompt` não anexa bloco nenhum → o
  prompt final comprovadamente não contém nenhum dado de usuário (teste
  unitário). O vetor ESTRUTURAL de confabulação está eliminado.
- **Pendente da validação B:** a metade comportamental (a Aurora de fato
  responder "ainda não sei" numa conversa real com vault vazio) depende de um
  provedor LLM ativo — bloqueada no momento da sessão (Groq em rate limit,
  troca de provedor requer chave que só o Lucas pode inserir). Re-testar junto
  com o A4 (onboarding em produção).

## Consequências

- Instalação nova é de fato crua — nada a herdar, nada a confabular.
- O Painel deixa de mentir: mostra o que o vault tem, inclusive o vazio.
- O retrieval vira o único canal de memória → a qualidade do `get_context` é
  agora o gargalo de qualidade da Aurora inteira (motivação direta do
  retrieval triplo, ADR-0010).
- `list_notes` entra no contrato do noesis-mcp (7 tools agora).
