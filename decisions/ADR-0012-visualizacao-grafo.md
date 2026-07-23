---
id: adr-0012
type: decision
version: 1.0.0
status: accepted
created: 2026-07-23
confidence: 0.7
mutable_by_system: never
supersedes: none
---

# ADR-0012 — Visualização v0 do grafo ("sinapses acendendo")

## Hipótese (do plano de 23/07)

> Exibir o grafo do vault em tempo real, com nós "acendendo" quando ativados
> por retrieval, torna o funcionamento interno da Aurora observável (base
> para spreading activation visual e para a métrica de emergência).

## Decisão

1. **Lib: vis-network** (vs Cytoscape.js). Porquê: (a) física nativa
   (forceAtlas2) dá a sensação orgânica de nós se acomodando sem configurar
   layout; (b) a API `DataSet.update()` torna a animação de ativação um
   one-liner reativo — exatamente o que o efeito "sinapse" precisa; (c) o
   grafo atual tem 44 nós — os algoritmos de análise do Cytoscape (a razão de
   escolhê-lo) não têm uso no v0. Migração a Cytoscape (análise) ou Sigma
   (>50k nós) fica documentada como possibilidade; a interface com o resto do
   app é só `{nodes, edges}`, troca de lib não vaza pra fora do componente.
2. **Fonte do snapshot: `list_notes` do noesis-mcp** — o main NÃO varre o
   vault por conta própria. Motivo: a definição de "o que é nota" (dirs
   ignorados, parsing) já vive em DOIS lugares sincronizados à mão
   (validador Python + vault.ts); uma varredura própria do main seria a
   terceira cópia e drift garantido. `list_notes` passou a expor `relations`
   (target/kind/weight) e `buildGraphSnapshot()`
   (`aurora-desktop/src/main/graphSnapshot.ts`, função pura) monta
   `{nodes, edges, warnings}`. IPC: `graph:get-snapshot`.
3. **Eventos de ativação:** o handler IPC `mcp:get-context` — o ÚNICO ponto
   por onde todo retrieval do chat passa — emite `graph:activated
   {ids, scores}` pro renderer após cada retrieval. Na aba Grafo, os nós
   ativados ganham brilho fósforo (#8FDDBE) + sombra com fade-out de ~1,2s
   (timers por nó, ativações sobrepostas não se atropelam). Como o
   get_context roda ANTES da chamada ao LLM, a ativação funciona mesmo sem
   provedor configurado.
4. **Interação:** clique no nó → painel inferior com frontmatter + corpo
   (via `read_note`, IPC novo `mcp:read-note`). Cores por `type` derivadas
   da paleta "bancada" (goals em fósforo, skills/projects em cobre, etc.);
   goals têm nó maior. Arestas com largura ∝ weight e tooltip com o kind.
5. **Robustez:** relação para id inexistente → aresta ignorada com warning
   logado no main, nunca fatal. Nota sem id não vira nó. Id duplicado: o
   primeiro vence.

## Validação (2026-07-23)

- **Testes** (`graphSnapshot.test.ts`, vitest): 5 testes — fidelidade de
  contagem, aresta pendurada ignorada com warning, nota sem id, id duplicado,
  fallback de label. Suíte completa: 64/64 no aurora-desktop + 19/19 no
  noesis-mcp; tsc limpo (main + renderer).
- **Fidelidade contra o vault real (varredura independente):** o pipeline do
  app (list_notes → buildGraphSnapshot) e um script Python separado (parser
  próprio, sem nada do pipeline TS) contaram exatamente o mesmo:
  **44 nós, 33 arestas válidas, 0 penduradas**.
- **Pendente (visual, ~30s do Lucas):** abrir o app (`npm run dev`), aba
  Grafo, mandar qualquer mensagem no chat e ver os nós recuperados acenderem
  em <2s. NÃO depende de provedor LLM (a ativação vem do get_context, que
  roda antes do modelo). Performance com 44 nós não é preocupação.

## Limitações conhecidas / roadmap

- Ativação acende só os nós retornados — o **spreading activation** visual
  (vizinhos acendendo meio segundo depois, intensidade ∝ relevância) é o
  próximo passo natural; os `scores` já chegam no evento.
- Nós `origin: reflection` (quando a reflexão automática existir) devem
  ganhar marca visual distinta — "o que emergiu" vs "o que foi inserido".
- Snapshot é recarregado ao abrir a aba, não é incremental — com o vault
  atual (44 nós) é instantâneo; virar patch incremental
  (nó criado/relação criada como eventos) quando o vault crescer.
- A aba desmonta o grafo ao sair (física não roda em background); ativações
  disparadas com a aba fechada não ficam enfileiradas.
