---
id: habit-suplementacao
type: habit
direction: build
status: active
origin: declared
created: 2026-07-17
trigger: "alarmes diários por item (creatina 12h, hipercalórico 15h30 — ajustáveis)"
frequency_target: "todos os itens ativos confirmados diariamente"
frequency_observed: null
streak: 0
last_evidence: null
relations:
  - target: rotina-nutricional
    kind: parte_de
    weight: 1.0
    reason: "Item da rotina nutricional."
    evidence: []
  - target: goal-saude-fisica-recomposicao
    kind: serve_a
    weight: 0.9
    reason: "Creatina e hipercalórico foram declarados como meios para voltar a puxar peso e subir de 64kg."
    evidence: []
---

# Habit — Suplementação diária

## Itens ativos

```yaml
items:
  - id: creatina
    horario: "12:00"
    fase: saturacao            # declarado pelo usuário
    status: active
  - id: hipercalorico
    horario: "15:30"
    status: active
# futuros itens entram aqui como novas linhas — sem criar arquivos novos
```

## Notas sobre a creatina (informação geral, não prescrição)

- Protocolo clássico de saturação: ~20g/dia divididos em 4 doses por 5–7 dias, depois manutenção de 3–5g/dia.
- **Alternativa igualmente eficaz:** 3–5g/dia direto satura os estoques em ~3–4 semanas, sem a fase de choque — mais barato e mais gentil com o estômago. A diferença é só velocidade, não teto.
- Horário não importa muito (consistência > timing); tomar com água abundante — daí a sinergia com `habit-hidratacao`.
- Conferir dosagem no rótulo do produto e, idealmente, validar o protocolo no check-up que já é a `next_action` do goal de saúde (rim saudável convive bem com creatina, mas o check-up confirma o "saudável" e vira evidência dupla no grafo).

## Notas sobre o hipercalórico

- Papel: fechar o superávit calórico do dia — funciona como *complemento* das refeições, não substituto delas.
- Horário default 15h30 (entre almoço e jantar); quando o treino voltar, pós-treino é candidato natural — o daemon propõe o ajuste quando o padrão de treino existir no grafo.

## Evidência
Confirmação de 1 toque por item/dia. Item ignorado 7 dias seguidos → daemon propõe rever horário ou status, nunca insiste cegamente (regra anti-ruído da rotina-nutricional).
