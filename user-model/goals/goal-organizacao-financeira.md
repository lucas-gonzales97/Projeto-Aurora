---
id: goal-organizacao-financeira
type: goal
horizon: mid
status: active
origin: declared
created: 2026-07-17
confidence: 0.8
progress: 0.0
success_criteria: "Marco 1: orçamento mensal mapeado e sustentado por 3 meses (entradas, saídas fixas, variáveis). Marco 2: reserva de emergência = 3 meses de custo de vida. Marco 3: reserva = 6 meses."
review_cycle: monthly
relations:
  - target: goal-emprego-clt-remoto
    kind: coordena
    weight: 0.9
    reason: "O CLT é a fonte de renda ativa fixa deste goal — a estabilidade que destrava a reserva."
    evidence: []
  - target: goal-renda-extra-freelance
    kind: coordena
    weight: 0.8
    reason: "Freelance é a renda extra; enquanto o CLT não sai, é renda-ponte; depois, acelerador de reserva."
    evidence: []
---

# Goal — Organização financeira

## Decisão de arquitetura (registrada aqui, revisável pelo LCA)

Este goal é o **coordenador** da dimensão financeira. Os goals de *renda* (CLT, freelance) continuam autônomos — eles geram entrada. Este goal cuida do que nenhum deles cobre: **para onde o dinheiro vai e quanto sobra**. Uma eventual segunda renda extra **não nasce como goal novo**: nasce como `strategy` deste goal (ex.: `strat-segunda-renda-<slug>`), competindo por evidência com as demais. Motivo: proliferação de goals dilui foco; estratégias competem, goals coordenam. Se uma estratégia de renda crescer a ponto de merecer autonomia (ex.: virar um produto), o LCA propõe promovê-la a goal — com revisão humana.

## Métricas de processo
- Fechamento mensal: entradas, saídas, saldo (evidência: registro real, não estimativa)
- % da renda destinado à reserva
- Custo de vida mensal médio (baseline a apurar nos 2 primeiros meses)

## Estratégias candidatas
- Mapear baseline: 30 dias registrando todo gasto (a Aurora pode facilitar o registro por mensagem rápida)
- Regra simples de alocação pós-baseline (ex.: percentual fixo para reserva antes de qualquer gasto variável)
- `strat-segunda-renda-*`: só abrir depois do Marco 1 — organizar antes de complicar

## next_action
Levantar baseline: listar saídas fixas atuais + estimar custo de vida mensal. Sem esse número, "reserva de 3 meses" não tem denominador.

## Papel da Aurora
Registrar sem julgamento, fechar o mês com espelho fiel dos números, sinalizar desvios do plano *que eu mesmo declarei*. Decisões de investimento específicas não são atribuição dela — ela organiza informação; decisões financeiras são minhas (e, quando relevante, de profissional habilitado).
