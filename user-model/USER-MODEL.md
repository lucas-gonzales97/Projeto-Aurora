---
id: user-model
type: foundation
version: 0.1.0
status: draft
created: 2026-07-16
confidence: 0.7
mutable_by_system: review_required
constitution_refs: [art-vii, art-viii]
---

# USER-MODEL — Modelo Vivo do Usuário

> **Tese:** "me ajudar a ser melhor" só é computável se *você* for cidadão de primeira classe no grafo. Este documento define a estrutura do diretório `user-model/`, os tipos de entidade e seus schemas. Tudo aqui segue a mesma plasticidade do 03-MEMORIA-VIVA: pesos, ativação, confiança, recência, evidência.

---

## Estrutura de diretórios

```
user-model/
├── USER-MODEL.md          # este arquivo (índice + schemas)
├── goals/                 # metas (curto, médio, longo prazo)
├── habits/                # hábitos em construção ou extinção
├── routines/              # rotinas e ritmos (sono, estudo, bancada)
├── projects/              # projetos ativos (PS4, caixa de energia, NOESIS...)
├── values/                # valores declarados PELO usuário
├── patterns/              # padrões INFERIDOS pelo sistema (hipóteses!)
├── skills/                # competências e nível atual
├── people/                # relações humanas relevantes (opt-in explícito)
└── journal-links/         # ponteiros para eventos episódicos relevantes
```

## Distinção constitucional: declarado vs. inferido

Esta é a regra mais importante do USER-MODEL (herda "observado vs. inferido" do 03/04):

- **Declarado** (`origin: declared`): o usuário afirmou. Confiança inicial alta (0.9). Só o usuário edita a substância.
- **Inferido** (`origin: inferred`): o sistema deduziu de padrões. **Nasce obrigatoriamente como nota `hypothesis`** em `patterns/`, com confiança explícita ≤ 0.6, e só é promovido a conhecimento consolidado após confirmação humana ou evidência acumulada em ≥ N eventos independentes.
- Nenhuma inferência sobre estado emocional, saúde mental ou relações pessoais é promovida sem confirmação explícita do usuário. Sem exceção (Art. VIII).

## Schema: `goal`

```yaml
---
id: goal-<slug>
type: goal
horizon: short | mid | long        # <3m | 3-12m | >12m
status: active | paused | achieved | killed
origin: declared
created: <date>
confidence: <0-1>                  # confiança de que a meta está bem formulada
progress: <0-1>                    # atualizado por evidência, nunca por otimismo
success_criteria: "critério observável no mundo real"
review_cycle: weekly | monthly
relations:
  - target: <habit|project|skill>
    kind: depende_de | avanca_com
    weight: <0-1>
    reason: ""
    evidence: []
---
```

## Schema: `habit`

```yaml
---
id: habit-<slug>
type: habit
direction: build | extinguish
status: active | consolidated | abandoned
origin: declared
trigger: "gatilho contextual"
frequency_target: "ex.: 5x/semana"
frequency_observed: null           # preenchido só por evento/sensor, nunca estimado
streak: 0
last_evidence: null
---
```

## Schema: `pattern` (sempre hipótese)

```yaml
---
id: pattern-<slug>
type: hypothesis
subtype: user-pattern
origin: inferred
confidence: <0-0.6>                # teto até confirmação
evidence: [evt-..., evt-...]       # mínimo 3 eventos independentes p/ propor
proposed_by: daemon | session
human_review: pending | confirmed | rejected
falsifiable_by: "que observação derrubaria esta hipótese"
---
```

## Schema: `project`

```yaml
---
id: project-<slug>
type: project
status: active | paused | done
domain: eletrônica | software | acadêmico | pessoal
current_focus: ""
next_action: ""                    # sempre UMA próxima ação concreta
blockers: []
log: journal-links/                # medições, decisões, aprendizados
---
```

## Schema: `value` e `skill`

`value`: apenas `origin: declared`, revisão semestral com o usuário, nunca inferido.
`skill`: nível `novice|intermediate|advanced|expert` + `evidence` (projetos concluídos, não autoavaliação isolada).

## Como a Aurora usa este modelo

1. **`get_context(intent)`** expande a partir das entidades do USER-MODEL relevantes à intenção — a meta é que qualquer conselho da Aurora cite quais entidades (e evidências) o fundamentam.
2. **Ciclo semanal:** o daemon gera relatório em `journal/`: metas com progresso estagnado, hábitos sem evidência recente, contradições entre `values/` declarados e `patterns/` observados — *propostas*, nunca julgamentos aplicados (S0/S1).
3. **Espelho, não juiz:** quando há contradição (ex.: valor "saúde" vs. padrão "dormir 4h"), Aurora apresenta a contradição com as evidências e pergunta. A resolução é sempre do usuário.

## População inicial (Fase 0 — fazer junto com as 15–30 entidades do roadmap)

- [ ] 3–5 `goals/` reais com `success_criteria` observável
- [ ] 2–3 `habits/` (pelo menos um `extinguish`)
- [ ] `projects/`: ps4-slim-lab, caixa-energia-kraus, noesis-lca
- [ ] 3–5 `values/` declarados
- [ ] `skills/`: eletrônica-reparo, smd-rework, etc.
- [ ] `patterns/`: vazio — nasce apenas de evidência acumulada
