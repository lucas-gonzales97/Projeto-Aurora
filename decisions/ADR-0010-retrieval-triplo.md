---
id: adr-0010
type: decision
version: 1.0.0
status: accepted
created: 2026-07-23
confidence: 0.6
mutable_by_system: never
supersedes: none
---

# ADR-0010 — Retrieval triplo: recência × importância × relevância no get_context

## Hipótese (como registrada no plano de 23/07)

> Substituir o score atual do `get_context` (relevância textual + 1 hop) por
> `score = w_rel·relevância × w_rec·recência × w_imp·importância` melhora a
> qualidade do contexto recuperado, priorizando o que é recente e importante
> sem perder o relevante. (Base: Generative Agents, Stanford 2023 — ver
> research/PESQUISA-FRONTEIRA-COMPLETA-AURORA.md, Parte 1.2.)

## Decisão

1. **Fórmula: soma ponderada de termos normalizados**, não produto:
   `final = w_rel·relevância_norm + w_rec·recência + w_imp·importância`.
   Divergência deliberada da notação do plano, pelo mesmo motivo do paper
   original (Generative Agents usa soma): produto puro faria recência baixa
   esmagar nota antiga-mas-relevante — violando o próprio critério do plano
   ("sem perder o relevante") — e pesos constantes num produto nem alteram a
   ordenação. A soma satisfaz o critério de regressão: com `w_rec = w_imp = 0`
   a ordenação reproduz exatamente o comportamento antigo.
2. **Componentes** (`noesis-mcp/src/retrieval.ts`, constante única de pesos):
   - Relevância: score textual existente (`scoreNote`), normalizado pelo
     máximo da query → [0,1]. O **gate `score > 0` permanece**: recência e
     importância nunca trazem à superfície nota que não casou nada com a intent.
   - Recência: decaimento exponencial com **meia-vida de 30 dias** sobre
     `updated` > `created` > mtime. Meia-vida longa de propósito: goals/hábitos
     são duráveis; recência dá empurrão, não domina (é exatamente onde o dilema
     estabilidade↔plasticidade se manifesta — research Parte 3.2).
   - Importância: campo **opcional** de frontmatter `importance: 0-10`
     (default 5 quando ausente — nenhuma nota existente quebra), normalizado
     pra [0,1]. Validadores (Python + TS, sincronizados) aceitam ausência e
     rejeitam valor fora de [0,10].
   - Pesos default: `rel 1.0 / rec 0.5 / imp 0.5`.
3. **Transparência:** cada entidade retornada expõe `relevance` (score final),
   `text_relevance` (score textual cru) e `scoring: {relevance_norm, recency,
   importance}` — insumo pra bancada, telemetria e a futura visualização
   ("por que esta nota acendeu").
4. `getContext` aceita `weights`/`now` injetáveis (não expostos no schema MCP)
   — é o que permite bancada A/B e testes determinísticos.

## Validação (2026-07-23)

- **Testes** (`noesis-mcp/tests/retrieval.test.ts`, runner `tsx --test` — 1º
  conjunto de testes do noesis-mcp): 19/19 verdes. Cobrem decaimento correto
  (1 → 0.5 → 0.25 por meia-vida), default de importância, clamp de valores
  inválidos, cadeia updated>created>mtime, **regressão** (pesos zerados ==
  ordenação antiga, verificada contra cálculo independente), o caso-alvo
  (nota recente+importante supera antiga de relevância maior), o gate de
  relevância, e a sincronia do validador. `tsc --noEmit` limpo.
- **Bancada A/B** (`bench/retrieval-queries.json`, 10 intents reais;
  `npm run bench` → `bench/results-2026-07-23.md`): top-1 idêntico em 10/10
  (nenhuma regressão grave); top-5 muda em 6/10.
- **Avaliação humana: PENDENTE** — o Lucas preenche a coluna Veredito em
  `bench/results-2026-07-23.md` (meta do plano: novo ≥ antigo em ≥70%).

## Achados honestos da bancada

- Com o vault inteiro criado há ~6 dias, recência ≈ 0.86 pra quase tudo — o
  termo ainda discrimina pouco; ganha tração conforme o vault envelhece.
- Nenhuma nota tem `importance` definido ainda → componente é offset constante
  0.5 hoje. O valor real aparece quando notas ganharem importância explícita.
- **Efeito colateral observado:** notas meta recém-criadas (ex.:
  `research-agenda-proxima-onda`, criada hoje, recency 0.98) sobem ao top-5 de
  intents pessoais (q05/q06/q10) pelo empurrão de recência. Ruído real.

## Aberto (próximas iterações)

- Ponderação por `type` (ou escopo user-model/) pra conter o ruído de notas
  meta/infra em intents pessoais.
- `importance` atribuída por LLM no momento da gravação (como no paper) — hoje
  é manual/ausente.
- Tokenizador sem stopwords: "e"/"o" na intent casam com qualquer frontmatter
  (descoberto nos testes). Resolve de vez com o roteamento semântico por
  embeddings (Camada 1 do motor adaptativo).
- Ajuste de pesos/meia-vida após a avaliação humana da bancada.
