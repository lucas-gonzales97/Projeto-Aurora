---
id: goal-renda-extra-freelance
type: goal
horizon: mid
status: active
origin: declared
created: 2026-07-17
confidence: 0.55
progress: 0.0
success_criteria: "Renda extra recorrente e mensurável via freelance de código/eletrônica em plataformas (Workana, Fiverr e similares), com perfil reposicionado e ranqueando melhor que a linha de base genérica — critério numérico exato (R$/mês ou nº de propostas fechadas) a confirmar com Lucas"
review_cycle: monthly
relations:
  - target: goal-emprego-clt-remoto
    kind: complementa
    weight: 0.8
    reason: "Freelance é renda-ponte e portfólio vivo enquanto o CLT não sai; entregas freelance viram evidência para o perfil (relação espelhada em goal-emprego-clt-remoto.md)."
    evidence: []
  - target: goal-organizacao-financeira
    kind: coordenado_por
    weight: 0.8
    reason: "Organização financeira coordena as fontes de renda; uma eventual segunda renda extra nasce como strategy aqui dentro, não como goal novo (relação espelhada em goal-organizacao-financeira.md)."
    evidence: []
  - target: skill-desenvolvimento-software
    kind: depende_de
    weight: 0.8
    reason: "A skill de dev sustenta a capacidade de entregar freelances."
    evidence: []
  - target: skill-eletronica-reparo
    kind: depende_de
    weight: 0.5
    reason: "Diferencial de nicho (firmware + hardware) citado como estratégia candidata."
    evidence: []
---

# Goal — Renda extra via freelance

## ⚠️ Nota de proveniência (confiança mais baixa que os demais goals)

Diferente dos outros 7 goals do vault, este nunca passou por uma rodada
dedicada de formulação com Lucas — foi reconstruído a partir de menções
espalhadas na conversa (o áudio sobre criatividade/curiosidade, seção
sobre plataformas Workana/Fiverr) e do fato de que outras notas do vault
(`goal-emprego-clt-remoto.md`, `goal-organizacao-financeira.md`,
`EXTENSAO-USER-MODEL-STRATEGIES.md`) já tratavam `goal-renda-extra-freelance`
como se existisse. `confidence: 0.55` reflete isso — mais baixo que a
faixa 0.7-0.85 dos demais. **Reveja o `success_criteria` com Lucas antes
de tratar este goal como validado no mesmo nível dos outros.**

## Contexto declarado
Lucas vem tentando pegar freelances de código em plataformas online
(citou Workana e "Fiverr" — no áudio original soou como "Fever", provável
erro de transcrição de voz), tentando montar um perfil melhor para se
ranquear e conseguir renda extra. Ligou isso tanto à área profissional
quanto à situação financeira apertada do momento.

## Estratégia candidata já esboçada
`EXTENSAO-USER-MODEL-STRATEGIES.md` já usa este goal como exemplo do
schema `strategy`, com a hipótese `strat-nicho-eletronica-firmware`:
reposicionar o perfil como especialista em firmware + hardware (ESP32,
reparo, automação) em vez de dev generalista, com `falsifiable_by` e
experimento de 30 dias já definidos ali. Materializar isso como arquivo
real em `goals/goal-renda-extra-freelance/strategies/` (seguindo a
estrutura aninhada que a própria extensão propõe) é um bom próximo passo
— hoje os goals existentes são todos arquivos únicos, então essa
reestruturação fica para quando este goal for de fato trabalhado, não
antes.

## next_action
Confirmar com Lucas: (1) o `success_criteria` numérico (quanto/quando), e
(2) se ele quer já testar a estratégia de nicho eletrônica/firmware como
primeira `strategy` real deste goal.
