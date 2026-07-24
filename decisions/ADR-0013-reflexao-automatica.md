---
id: adr-0013
type: decision
version: 1.0.0
status: accepted
created: 2026-07-24
confidence: 0.55
mutable_by_system: never
supersedes: none
---

# ADR-0013 — Reflexão automática: job de fim de sessão + métrica emergido/inserido

## Hipótese (Bloco E, adiado do plano de 23/07)

> Reflection tree (Park et al. 2023, "Generative Agents"): quando memórias
> salientes acumulam, o agente sintetiza conclusões de nível mais alto sobre
> padrões — e a ablação do paper mostrou que sem isso o comportamento
> degrada em horizontes longos. É o mecanismo que faz a Aurora "virar
> alguém" com o tempo, e o ritual de destilação do DIA-1-OPERACAO.md
> formalizado como processo automático (`research/PESQUISA-FRONTEIRA-COMPLETA-AURORA.md`
> Parte 1.2 e Parte 11 item 4).

Fecha uma pendência explícita do ADR-0011: `ended_at`/`summary` da tabela
`sessions` existiam no schema desde 23/07 mas nunca eram escritos — "ficam
pro job de fim de sessão da reflexão automática", que é este ADR.

## Decisão

1. **Gatilho: `app.on("before-quit")`**, não um botão explícito. O Aurora
   Desktop não tem "nova conversa" — só retomar uma sessão antiga via
   histórico — então o único limite de sessão que existe de verdade hoje é o
   app fechar. `event.preventDefault()` segura o quit até o job terminar (ou
   estourar um timeout de 20s de segurança); uma flag `quitting` evita
   reentrância quando o próprio handler chama `app.quit()` no final.
2. **Salience v0 = contagem de mensagens do usuário, threshold 3**
   (`REFLECTION_THRESHOLD` em `reflection.ts`) — **não** é a soma de
   importância de memórias desde a última reflexão que o paper usa de
   verdade. Isso exigiria importância avaliada por LLM em CADA mensagem na
   gravação, que a Aurora ainda não calcula (pendência separada,
   "importância via LLM na gravação", journal 2026-07-23). Divergência
   deliberada e documentada, não descuido: um placeholder honesto — barato,
   determinístico, sempre disponível — mas cego a QUÃO relevante foi a
   conversa, só a quão longa.
3. **Entidades ativadas = reaproveita `get_context`** com a concatenação das
   falas do usuário na sessão como `intent`, em vez de acumular estado por
   turno no renderer. Reusa o retrieval triplo do ADR-0010 de graça; efeito
   colateral aceito: a "ativação" da reflexão é uma foto pós-hoc da sessão
   inteira, não o que de fato acendeu em cada turno individual (essa
   informação já existe nos eventos `aurora-desktop-interaction`, mas por
   turno, não por sessão — juntar as duas fontes fica pra depois se
   precisar).
4. **Síntese via LLM ativo** (mesmo provedor/modelo da Config): prompt fixo
   em `REFLECTION_SYSTEM_PROMPT` pede um de dois formatos exatos —
   `SKIP` (a maioria das sessões — o prompt pede conservadorismo explícito,
   "não parafraseie uma única frase como se fosse insight") ou
   `CONFIANÇA: <n>\nREFLEXÃO: <frase>`. `parseReflectionResponse` nunca cria
   nota a partir de uma resposta fora do formato — fail-closed, não
   fail-open.
5. **Confiança sempre em [0.1, 0.6]**, mesmo que o LLM devolva mais —
   reflexão nasce como hipótese, nunca fato consolidado (Art. VIII-2: nada
   sobre o usuário vira certeza sem confirmação humana). Teto duro no
   parser, não uma instrução que o prompt espera que o modelo obedeça.
6. **Nota nova**: `type: hypothesis`, `dir: user-model/patterns`,
   `origin: reflection` (valor novo no enum de `hypothesis.origin`,
   `ontology.yaml` + os DOIS validadores — Python e TS, ADR-0008 §sincronia),
   `subtype: user-pattern`. Relações `emerge_de` para cada entidade ativada
   (`buildReflectionRelations`) — a reflexão emerge da conversa que a
   originou, semântica já existente no `relation_kinds`. `user-model/patterns/`
   nasce com a primeira reflexão real; já era esperado por `ONBOARDING_DIRS`
   em `index.ts` desde o ADR-0005, só nunca tinha sido populado.
7. **Evento `reflection-created`** via `log_event`, com `session_id`,
   contagem de mensagens e confiança em `data` — é o rastro que a métrica de
   emergência usa pra auditoria (além do próprio frontmatter `origin`).
8. **`sessions.summary`** passa a ser preenchido: a frase da reflexão quando
   houve uma, `null` quando a sessão foi encerrada sem reflexão (threshold
   não atingido, LLM decidiu `SKIP`, ou qualquer chamada externa falhou —
   falha em qualquer etapa externa faz `endSession` sem reflexão, nunca
   trava o quit nem perde a sessão).
9. **Métrica emergido/inserido**: `noesis-mcp/src/emergence.ts`,
   `emergenceRatio(entries)` — `emergido` = notas com `origin: reflection`,
   `inserido` = todo o resto, `ratio = emergido/inserido` (`null` se
   `inserido = 0`, nunca divide por zero). Exposta hoje via
   `npm run emergence` (`noesis-mcp/bench/emergence-ratio.ts`, mesmo padrão
   do `npm run bench` do ADR-0010) — sem UI ainda, é uma leitura pontual do
   vault real.

## Validação (2026-07-24)

- **Testes**: `noesis-mcp` — `emergence.test.ts`, 5 testes (vazio, só
  inseridas, mistura, só-emergidas sem dividir por zero, frontmatter
  ausente). `aurora-desktop` — `reflection.test.ts`, 18 testes (contagem e
  threshold, construção do prompt com placeholders honestos pra sessão/
  entidades vazias, parser em todos os formatos incl. `SKIP`/vazio/fora-de-
  formato/saturação de confiança, geração de id kebab-case a partir de uuid,
  corpo da nota, relações). `chatStore.test.ts` ganhou 2 testes novos
  (`endSession` com `summary`, `getSession`). Suítes completas:
  **95/95 aurora-desktop + 24/24 noesis-mcp**; `tsc` limpo (main +
  renderer); `validate_frontmatter.py` **46/46** notas válidas.
- **Smoke test do boot**: `npm run dev` iniciado e observado (vite + tsc do
  main + electron) — nenhum erro de runtime (um handler IPC duplicado, por
  exemplo, teria lançado exceção síncrona no registro); processo encerrado
  logo em seguida, sem interação de chat real.
- **Pendente — Lucas** (mesmo formato do teste manual do ADR-0011,
  precisa de provedor ativo): conversar 3+ mensagens reais no chat, fechar o
  app COMPLETAMENTE (não só a janela — conferir que o processo Electron
  encerrou), e verificar (a) nota nova em `user-model/patterns/` OU log no
  console do main dizendo que o LLM decidiu `SKIP`; (b) evento
  `reflection-created` (ou ausência, se skip) em `events/2026-07-24.jsonl`;
  (c) `npm run emergence` (de dentro de `noesis-mcp/`) mostrando `emerged: 1`
  se houve reflexão. Sem isso o caminho renderer→quit→LLM→create_note nunca
  rodou contra um provedor de verdade — só os módulos puros foram exercitados.

## Limitações conhecidas (documentadas, não escondidas)

- **Sessão retomada não reflete de novo**: o gate é `sessions.ended_at IS
  NULL` — resumir uma sessão já encerrada (via histórico) e continuar
  conversando não dispara nova reflexão nesta v0, porque `ended_at` já foi
  setado no quit anterior. Sessões novas (a maioria, já que não há botão de
  "nova conversa" nem overwrite de sessão) sempre refletem normalmente.
- **Salience por contagem, não por importância real** (item 2 da Decisão) —
  o próximo passo natural é fazer o roteador avaliar importância por
  mensagem na gravação e trocar o threshold de contagem por soma de
  importância, fechando o gap com o paper de verdade.
- **Sem UI**: `npm run emergence` é CLI. Um painel de capacidade (Frente 6
  da agenda) seria o lugar natural de mostrar a razão ao vivo, não construído
  aqui.
- **Uma reflexão por sessão, no máximo** — o design não empilha reflexões
  sobre reflexões (o "reflection tree" de camadas do paper, onde reflexões
  antigas viram insumo de reflexões novas); é reflexão de profundidade 1.

## Consequências / aberto

- `user-model/patterns/` deixa de ser um diretório vazio-mas-esperado — é o
  primeiro lugar do vault que só a própria Aurora escreve.
- `hypothesis.origin` ganhou um 7º valor (`reflection`) nos três lugares que
  precisam ficar em sincronia: `ontology/ontology.yaml`,
  `scripts/validate_frontmatter.py`, `noesis-mcp/src/validateFrontmatter.ts`.
- A métrica emergido/inserido só fica interessante com uso real acumulado —
  hoje, antes do teste manual do Lucas, o vault real mede `0/46` (nenhuma
  reflexão ainda).
- Fica pra depois: importância por mensagem na gravação (destrava salience
  de verdade); reflexão sobre reflexões (profundidade > 1); expor a métrica
  na UI; usar o `summary` da sessão na listagem do histórico do chat (a UI
  hoje mostra só a preview da 1ª mensagem, ignora `summary`).
