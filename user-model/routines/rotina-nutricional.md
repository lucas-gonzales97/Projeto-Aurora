---
id: rotina-nutricional
type: foundation
subtype: routine-coordinator
version: 0.1.0
status: active
created: 2026-07-17
confidence: 0.75
mutable_by_system: review_required
relations:
  - target: goal-saude-fisica-recomposicao
    kind: serve_a
    weight: 0.9
    reason: "Hidratação, suplementação e futura dieta são os meios nutricionais da recomposição para 72-73kg."
    evidence: []
  - target: habit-sono-rotina
    kind: irmã_de
    weight: 0.5
    reason: "Mesma camada: substratos fisiológicos da rotina."
    evidence: []
---

# Rotina Nutricional — compartimento coordenador

## Decisão de arquitetura (autonomia exercida, revisável)

O usuário citou água, creatina e hipercalórico "de cabeça" e antecipou que isso vai crescer (dieta completa, ingredientes, refeições). Estruturei assim:

- **Este arquivo** = coordenador da dimensão nutricional (mesmo padrão do goal financeiro: itens competem, coordenador organiza).
- **`habit-hidratacao`** = hábito próprio, porque tem mecânica única (cota calculada + escalonamento de lembrete).
- **`habit-suplementacao`** = um hábito único com *lista de itens* (creatina, hipercalórico, futuros) — em vez de um habit por suplemento. Motivo: suplementos compartilham a mesma mecânica (lembrete diário + confirmação); um arquivo por item viraria burocracia de metadados, risco já mapeado no roadmap.
- **Dieta futura** = quando o usuário descrever ingredientes/refeições, nasce `dieta/` dentro deste compartimento, com refeições como entidades e o coordenador ligando tudo.
- O daemon pode propor reorganização (split/merge) conforme frequência e peso reais de uso — é para ser orgânico, como pedido.

## Canal de lembretes ≠ curiosidade epistêmica

Lembretes de rotina são **automação (tier T0)**: cron/alarme, custo zero, fora do orçamento proativo do motor epistêmico. A cota de 3 interações/dia da Aurora continua intacta para curiosidade; o alarme de água não gasta ela. São canais distintos por design.

## Escada de insistência (pedida: "até que eu beba")

1. Notificação/alarme normal → confirmação de 1 toque ("bebi")
2. Sem confirmação em 15 min → sinal sonoro repetido
3. Sem confirmação em 30 min → persiste no dispositivo ativo (PC/TV, quando integrados)

**Anti-transformar-em-ruído:** se a cota do dia já foi batida, lembretes restantes do dia se calam sozinhos; se o usuário ignorar sistematicamente um horário por 7 dias, o daemon propõe mover o horário em vez de insistir nele.

## Estado atual (ponte pré-Aurora)

Enquanto a Aurora não roda, os lembretes vivem como alarmes no celular do usuário (configurados em 2026-07-17): água 10h/13h/16h/19h, creatina 12h, hipercalórico 15h30 — horários default, ajustáveis. Quando a Aurora assumir, ela importa e passa a gerir a escada completa.
