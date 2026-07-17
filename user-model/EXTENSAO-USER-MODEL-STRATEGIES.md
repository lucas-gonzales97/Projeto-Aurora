---
id: extensao-user-model-strategies
type: foundation
version: 0.1.0
status: draft
created: 2026-07-17
confidence: 0.7
mutable_by_system: review_required
extends: user-model
---

# Extensão do USER-MODEL — `strategy` (estratégias como hipóteses)

> Cada `goal` ganha um subdiretório `strategies/`. Uma estratégia é uma **hipótese sobre um meio de atingir a meta** — herda todo o rigor do tipo `hypothesis`: confiança explícita, falseabilidade, evidência, ciclo de vida.

## Estrutura

```
user-model/goals/goal-renda-extra-freelance/
├── goal-renda-extra-freelance.md
└── strategies/
    ├── strat-nicho-eletronica-firmware.md
    ├── strat-proposta-com-prototipo.md
    └── strat-perfil-video-apresentacao.md
```

## Schema: `strategy`

```yaml
---
id: strat-<slug>
type: hypothesis
subtype: strategy
goal: goal-<slug>
status: proposed | active | testing | killed | promoted
origin: aurora | declared | co-created
confidence: <0-1>
falsifiable_by: "que resultado observável derruba esta estratégia"
experiment:
  action: "menor teste barato possível"
  cost_estimate: "tempo/R$/tokens"
  duration: "janela do teste"
  metric: "o que será medido (nº propostas, taxa de resposta, R$, ranking)"
evidence: []               # eventos reais; nunca impressões
next_review: <date>
lessons: []                # preenchido ao matar/refinar — fracasso é matéria-prima
---
```

## Regras de ciclo de vida

1. Nasce `proposed`; execução exige aprovação humana (S0/S1).
2. `testing` exige `experiment` completo — estratégia sem métrica não roda.
3. Sem evidência nova por 2 `review_cycle` do goal → julgamento obrigatório (matar, refinar ou justificar espera).
4. `killed` vai para arquivo com `lessons` preenchido (Art. I: nada é deletado).
5. `promoted` = evidência sustentada → vira prática registrada; o motor criativo passa a gerar *variações* dela.
6. Portfólio: 2–5 estratégias ativas por goal. Foco vence fartura.

## Exemplo concreto (caso freelance — preencher com dados reais)

```yaml
---
id: strat-nicho-eletronica-firmware
type: hypothesis
subtype: strategy
goal: goal-renda-extra-freelance
status: proposed
origin: co-created
confidence: 0.5
falsifiable_by: "após 15 propostas nichadas em 30 dias, taxa de resposta ≤ à do perfil generalista"
experiment:
  action: "reposicionar perfil Workana/Fiverr como especialista em firmware + hardware (ESP32, reparo, automação) e enviar 15 propostas no nicho"
  cost_estimate: "4h de setup + 30min/proposta"
  duration: "30 dias"
  metric: "taxa de resposta, convites recebidos, R$ fechado"
evidence: []
next_review: +30d
---
```

A tese por trás: teu diferencial real (bancada, SMD, BGA, automação, maker) é raro na multidão de devs generalistas das plataformas — mas isso é hipótese, e por isso tem `falsifiable_by`. A Aurora pesquisa perfis que rankeiam no nicho, propõe variações, e cada proposta enviada vira evidência no grafo.
