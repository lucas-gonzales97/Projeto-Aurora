---
id: goal-concluir-faculdade
type: goal
horizon: mid
status: active
origin: declared
created: 2026-07-17
confidence: 0.85
progress: 0.0
success_criteria: "TCC aprovado + todas as disciplinas restantes concluídas = diploma emitido"
review_cycle: weekly
relations:
  - target: project-noesis-lca
    kind: pode_usar_como_meio
    weight: 0.9
    reason: "Hipótese: o NOESIS/LCA pode ser o próprio TCC (Fatec valoriza projeto aplicado com fundamentação)."
    evidence: []
---

# Goal — Concluir a faculdade (Fatec)

## Estratégia principal (hipótese a validar)

**strat-tcc-noesis** — usar o LCA/Aurora como TCC:

- `falsifiable_by`: "regulamento de TCC da Fatec ou orientador rejeitarem o escopo/formato"
- **Por que é forte:** o projeto se auto-documenta. Constituição, ADRs e schemas = capítulo de metodologia; Manifesto e base filosófica (Whitehead, Active Inference, sistemas complexos) = fundamentação teórica; experimento da Fase 1 do roadmap (`get_context` vs. despejo de contexto, 10 tarefas reais) = capítulo de validação com dados. O roadmap por fases já é um cronograma defensável em banca.
- **Recorte provável:** o TCC não precisa ser o organismo completo — Fases 0–2 (substrato + contexto construído + grafo) já são um trabalho fechado, com a Aurora como estudo de caso de aplicação.
- **Riscos:** escopo grande demais para o prazo (mitigação: recorte por fase); orientador sem familiaridade com o tema (mitigação: fundamentação forte + demo funcional).

## next_action
1. Levantar: disciplinas restantes + prazos/janelas de TCC no regulamento da Fatec.
2. Rascunhar pré-proposta de 1 página do TCC-NOESIS para sondar um orientador.

## Métricas de processo
- Disciplinas restantes (baseline a registrar)
- Marcos do TCC: proposta → orientador aceito → qualificação → banca
