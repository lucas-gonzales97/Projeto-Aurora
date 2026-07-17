---
id: model-router
type: foundation
version: 0.1.0
status: draft
created: 2026-07-17
confidence: 0.7
mutable_by_system: review_required
constitution_refs: [art-iv, art-viii]
---

# MODEL ROUTER — Economia Cognitiva

> **Princípio:** nunca matar mosca com bazuca. Toda tarefa é classificada e roteada para o motor mais barato plausível, escalando por falha ou incerteza — nunca por padrão. O roteador em si é sempre barato: heurísticas + modelo local pequeno. O modelo caro jamais é usado para decidir se o modelo caro é necessário.

---

## 1. Camadas de motores

| tier | motor | onde | usar para |
|---|---|---|---|
| T0 | heurísticas/regex/regras | local (CPU) | comandos de automação, parsing, rotas óbvias |
| T1 | modelo local pequeno (3–8B, ex. Qwen3 8B) | local (GPU) | classificação, embeddings, resumos curtos, voz→texto→intenção, sensores, small talk |
| T2 | modelo local médio (13–14B) | local (GPU) | resumo de sessão, destilação, rascunhos, perguntas do motor epistêmico |
| T3 | Claude Haiku | nuvem | tarefas simples que exigem qualidade acima do local |
| T4 | Claude Sonnet | nuvem | código do dia a dia, análise, pesquisa web moderada |
| T5 | Claude Opus/Fable | nuvem | coautoria pesada, arquitetura, loops agênticos longos, raciocínio profundo |

## 2. Classificação da tarefa (features)

O roteador (T0+T1) extrai: `complexidade_estimada`, `tamanho_de_contexto`, `precisa_de_ferramentas` (web, RPA, código), `risco` (toca produção? toca Constituição? irreversível?), `privacidade` (dado bruto pessoal/sensor?), `latência_tolerada`.

## 3. Regras de roteamento

1. **Privacidade primeiro (Art. VIII-5):** dado bruto de sensor/câmera/microfone processa em T0–T2. Só sobe para nuvem *derivado* (transcrição filtrada, resumo), nunca bruto, e só se necessário.
2. **Piso plausível:** começa no menor tier capaz. Em dúvida entre dois, começa no menor.
3. **Escalada por evidência:** falhou validação, confiança baixa auto-reportada, ou 2 tentativas sem sucesso → sobe um tier. Registra o motivo.
4. **Risco alto força tier alto + humano:** tarefas com `risco` alto vão direto a T4/T5 **e** exigem aprovação humana, independente de parecerem simples.
5. **Downgrade contínuo:** o daemon analisa telemetria semanal e propõe rebaixar classes de tarefa que T1/T2 vêm resolvendo bem (aprendizado do próprio roteador — review_required).

## 4. Orçamento (Art. IV)

- Orçamento diário de tokens/custo por tier; T5 com cota explícita.
- Loop agêntico declara *antes*: teto de iterações, orçamento e critério de parada. Estourou → pausa e pergunta, nunca estoura silenciosamente.
- Ledger de custo como entidades no vault: a Aurora sabe quanto custou cada classe de tarefa e usa isso no roteamento.

## 5. Telemetria por chamada

`{task_class, tier, modelo, tokens_in/out, custo, sucesso, escalou_de, latência}` — em JSONL. É o dataset que treina o próprio roteador.

## 6. Degradação graciosa

Sem internet/API: T0–T2 seguram automação do quarto, memória e interação básica. Tarefas T3+ entram em fila com aviso honesto ("isso merece o motor grande; guardei para quando a conexão voltar"). Coerente com o requisito de operação 24/7 com redundância elétrica.

## 7. Hardware de referência (v0 — detalhar em doc futuro de infra)

- **Servidor LCA (sem GPU):** notebook antigo, Linux, 16GB+ RAM — vault, Git, Neo4j, daemon, roteador T0.
- **Nó de inferência (T1–T2):** desktop usado + RTX 3060 12GB usada (~R$1.8k), 32GB RAM, SSD NVMe, Linux + Ollama/llama.cpp. Roda 8B rápido e 14B confortável em Q4.
- **Upgrade futuro (classe 30B):** RTX 5060 Ti 16GB nova ou RTX 3090 24GB usada.
- **Energia:** nobreak no nó de inferência; bateria Moura 12V para servidor LCA + ESP32s; medir consumo ocioso (o watt 24/7 é o custo dominante).
