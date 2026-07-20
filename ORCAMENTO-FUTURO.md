---
id: orcamento-futuro
type: meta
status: active
created: 2026-07-20
---

# ORCAMENTO-FUTURO.md — Tecnologias pagas planejadas

> Este documento não é uma decisão de compra — é um mapa do que existe para
> escalar cada componente do Aurora Desktop (`decisions/ADR-0003-aurora-desktop.md`)
> além do fallback gratuito do v0, e o motivo concreto de cada upgrade.
> Nenhum item aqui é ativado por padrão: cada um só entra quando o fallback
> gratuito se mostrar insuficiente no uso real (mesmo princípio de "escalar
> só por necessidade" do `MODEL-ROUTER.md`).

## Tabela de custos

| item | função | custo estimado | substitui (fallback atual) |
|---|---|---|---|
| ElevenLabs TTS | Síntese de voz | ~US$5–22/mês (planos Starter/Creator) | `SpeechSynthesis API` do navegador |
| Whisper API (OpenAI) | Transcrição de voz (STT) | ~US$0,006/min de áudio | `SpeechRecognition` (Web Speech API) |
| AssemblyAI STT | Transcrição de voz (STT), alternativa | ~US$0,65/hora de áudio | `SpeechRecognition` (Web Speech API) |
| Modelo de visão dedicado | Análise de imagem especializada | variável (depende do provedor/caso de uso) | image block nativo da API Anthropic |
| Hardware RTX 3060 12GB | Inferência local (Ollama) — STT/TTS/LLM locais | custo único de hardware (~R$1.500–2.500 usado, referência de mercado 07/2026) | qualquer API paga acima, uma vez amortizado |

## O que cada item melhora vs. o fallback gratuito de hoje

### ElevenLabs TTS
**Fallback hoje:** `SpeechSynthesis API` — vozes do sistema operacional,
robóticas, sem controle de emoção/entonação, qualidade varia muito entre
Windows/Mac/Linux.
**Melhoria:** vozes neurais de alta naturalidade, clonagem/seleção de voz
consistente entre máquinas (a "voz da Aurora" deixa de depender de qual SO
está rodando), controle de estilo e velocidade. Justifica o custo quando a
qualidade da voz do SO atrapalhar a sensação de estar conversando com uma
persona coerente — hoje é estética, não funcional.

### Whisper API (OpenAI)
**Fallback hoje:** `SpeechRecognition` (Web Speech API) — depende do
Chromium embutido no Electron, precisão cai em ambiente ruidoso ou com
sotaque/jargão técnico (o vocabulário de Lucas mistura termos de
eletrônica/dev em português), sem funcionar offline.
**Melhoria:** precisão sensivelmente maior em áudio ruidoso e em
vocabulário técnico/PT-BR, sem depender do reconhecedor embutido do
navegador. Justifica o custo se o STT gratuito errar demais em uso real
(ex.: bancada de eletrônica com ruído de fundo).

### AssemblyAI STT
**Fallback hoje:** mesmo do Whisper API acima.
**Melhoria:** alternativa ao Whisper API com features adicionais (detecção
de speaker, timestamps, moderação de conteúdo) que o Whisper puro não
oferece — cotovelo de comparação caso o caso de uso peça mais que
transcrição crua (ex.: separar quem fala em uma reunião gravada). Custo por
hora, não por minuto — mais vantajoso que Whisper em sessões longas e
contínuas, pior em uso picotado/curto.

### Modelo de visão dedicado
**Fallback hoje:** o próprio Claude processa a imagem via image block
nativo da API Anthropic (`ADR-0003` §4) — já cobre leitura de
esquemático/foto de placa, screenshots, fotos de componentes em texto
livre.
**Melhoria:** só faria sentido para um caso de uso muito específico que a
visão geral do Claude não cobre bem (ex.: OCR de datasheet em alta
densidade, detecção precisa de componente SMD específico em foto de
bancada). Sem evidência hoje de que isso seja necessário — item mantido
como hipótese aberta, não como plano ativo.

### Hardware RTX 3060 12GB (inferência local via Ollama)
**Fallback hoje:** qualquer API paga acima cobra por uso recorrente
(minuto/hora de áudio, chamada de modelo).
**Melhoria:** depois do custo único do hardware, STT/TTS/LLMs pequenos
rodam localmente sem custo recorrente e sem enviar áudio/dados para
terceiros — melhora tanto o orçamento de longo prazo quanto a privacidade
(relevante para o Art. VIII da Constituição, dignidade do USER-MODEL).
Já é a recomendação de hardware citada em `MODEL-ROUTER.md` para quando a
Fase 5+ trouxer inferência local de verdade — este item apenas reafirma
essa mesma peça de hardware como base para STT/TTS locais, não só para o
roteador de modelos de texto.

## Critério de ativação

Nenhum item desta tabela é adotado por decisão de calendário. Cada um só
entra em uso quando houver evidência concreta e registrada (journal/evento)
de que o fallback gratuito correspondente está atrapalhando o uso real do
Aurora Desktop — nunca por antecipação especulativa de necessidade.
