---
id: habit-hidratacao
type: habit
direction: build
status: active
origin: declared
created: 2026-07-17
trigger: "alarmes 10h/13h/16h/19h + gatilhos naturais (acordar, refeições)"
frequency_target: "≥2,5L/dia, todos os dias (≈3L em dia de treino)"
frequency_observed: null
streak: 0
last_evidence: null
relations:
  - target: rotina-nutricional
    kind: parte_de
    weight: 1.0
    reason: "Item da rotina nutricional."
    evidence: []
  - target: habit-suplementacao
    kind: sinergia_com
    weight: 0.8
    reason: "Creatina aumenta retenção intracelular de água — hidratar bem é parte do protocolo, não opcional."
    evidence: []
---

# Habit — Hidratação

## Cota proposta (base declarada: 64kg, 1,75m)

Referência geral usada: **30–35 ml/kg/dia** → 64kg ≈ **1,9–2,2L de base**.
Ajustes: **+~500ml** em fase de creatina (retenção intracelular) e **+500–750ml** em dia de treino/calor.

**Meta redonda e prática: 2,5L/dia agora; ~3L em dia de treino.**
Recalcular quando o peso mudar (aos 72kg a base sobe para ~2,2–2,5L).

## Operacionalização sem atrito
- Garrafa de referência: medir o volume da garrafa que o usuário usa e converter a meta em "garrafas/dia" (ex.: garrafa de 830ml → 3 garrafas = cota). Definir na primeira semana.
- Evidência = confirmação de 1 toque no lembrete ou registro rápido à Aurora; futuro: sensor na garrafa/base é candidato natural de projeto maker da bancada.
- Sinal simples de calibração que o corpo dá: urina amarelo-claro ≈ hidratação ok (guia prático, não métrica do grafo).

## Escalonamento
Segue a escada definida em `rotina-nutricional.md` (§ escada de insistência), incluindo o silêncio automático pós-cota.
