---
id: adr-0003
type: decision
version: 1.0.0
status: accepted
created: 2026-07-20
confidence: 0.7
mutable_by_system: never
supersedes: none
---

# ADR-0003 — Stack técnica do Aurora Desktop v0

## Contexto

`ADR-0002-interfaces.md` já decidiu a ordem de construção das interfaces e
fixou o escopo do Aurora Desktop v0 (janela de chat com streaming, persona
carregada de `AURORA-PERSONA.md`, MCP do vault plugado), deixando a stack em
aberto entre "Tauri (preferência) ou Electron (alternativa)". Esta ADR fecha
essa decisão de stack e amplia o escopo v0 para incluir voz e visão, que
passaram a ser requisito real do usuário (Lucas quer poder falar com a Aurora
e mostrar imagens, não só digitar).

Restrição herdada: nada é publicado (app local, sem distribuição), e o motor
continua sendo `{Agent SDK / API Anthropic + noesis-mcp + vault}` — o app é
casca, não reimplementação.

## Decisão

### 1. Electron, não Tauri

Optou-se por **Electron + React + TypeScript**, divergindo da preferência
original de `ADR-0002` (Tauri). Motivo: o app precisa fazer `spawn` de um
processo Node (`noesis-mcp/dist/index.js`) sobre stdio e falar com
`@anthropic-ai/sdk` — ambos nativos ao ecossistema Node/TypeScript. Rodar
esse mesmo processo dentro do runtime Rust do Tauri exigiria uma ponte
adicional (sidecar process + IPC Rust↔Node) sem ganho líquido para um app
v0 de uso pessoal e local, onde o custo de binário maior do Electron não é
um problema real. Reavaliar Tauri fica como hipótese aberta para uma v2 se
o consumo de recursos do Electron incomodar no uso diário.

### 2. Entrada de voz (STT) — Web Speech API como fallback gratuito

- API do próprio Chromium/renderer (`SpeechRecognition`, `lang: 'pt-BR'`),
  sem custo e sem dependência externa — adequado para v0.
- **Migração futura planejada:** Whisper rodando localmente (via
  hardware dedicado, ver `ORCAMENTO-FUTURO.md`), quando precisão em
  ambiente ruidoso ou privacidade total do áudio importarem mais do que
  custo zero.

### 3. Saída de voz (TTS) — SpeechSynthesis API como fallback gratuito

- API nativa do navegador/Electron (`speechSynthesis`, `lang: 'pt-BR'`,
  preferindo voz feminina quando disponível no SO), sem custo.
- **Migração futura planejada:** Piper (TTS local, grátis, mais natural que
  o SO) ou ElevenLabs (pago, qualidade de voz mais alta) — ver
  `ORCAMENTO-FUTURO.md` para o trade-off de custo entre as duas.

### 4. Visão — input de imagem convertido para image block da API Anthropic

- Três formas de entrada equivalentes: drag-and-drop na janela do chat,
  colar do clipboard (Ctrl+V) e seleção de arquivo via file picker.
- A imagem é convertida para base64 no renderer e enviada como bloco de
  imagem (`image` content block) junto ao texto na chamada à API Anthropic
  — sem serviço de visão dedicado no v0 (o próprio modelo Claude processa a
  imagem).
- **Migração futura planejada:** modelo de visão dedicado só se surgir um
  caso de uso que a visão nativa do Claude não cubra bem (ver
  `ORCAMENTO-FUTURO.md`).

### 5. Integração com o vault — `noesis-mcp` via spawn stdio

O main process do Electron sobe `noesis-mcp` (`node noesis-mcp/dist/index.js`)
como child process, falando MCP sobre stdio — o mesmo protocolo que o Claude
Code já usa via `.mcp.json`. Nenhum código de acesso ao vault é duplicado no
app; o app é mais um cliente MCP do mesmo servidor.

### 6. Conexão com o modelo — `@anthropic-ai/sdk`

Chamadas diretas à API Anthropic via `@anthropic-ai/sdk` a partir do main
process (chave de API nunca exposta ao renderer). Streaming de resposta
repassado ao renderer via IPC.

## Consequências

**Positivas:**
- Stack 100% TypeScript/Node do main process ao renderer — mesma linguagem
  do `noesis-mcp`, sem ponte de runtime.
- v0 entrega voz e visão sem custo recorrente (ambos os fallbacks são APIs
  nativas do navegador/SO) — o orçamento pago só entra se/quando o fallback
  gratuito se mostrar insuficiente no uso real.
- Caminho de migração de cada componente pago (STT, TTS, visão) é
  independente dos outros — pode trocar um sem tocar nos demais.

**Negativas / riscos:**
- Electron tem footprint de memória/disco maior que Tauri — aceito
  conscientemente para v0, reavaliar se incomodar no uso diário.
- Web Speech API depende do Chromium embutido no Electron e não funciona
  offline nem sem microfone reconhecido pelo SO — limitação conhecida do
  fallback gratuito de STT.
- Chave de API Anthropic fica em disco local (variável de ambiente ou
  config do app) — risco aceitável para app de uso pessoal, não distribuído.

## Alternativas rejeitadas

- **Tauri (preferência original de ADR-0002):** rejeitado para o v0 pelo
  custo de ponte Rust↔Node para o `spawn` do `noesis-mcp`; não descartado
  para versões futuras.
- **Serviço de STT/TTS pago desde o v0 (ElevenLabs, Whisper API, AssemblyAI):**
  rejeitado por ainda não haver evidência de que o fallback gratuito é
  insuficiente — violaria o princípio de só escalar custo por necessidade
  real (mesmo espírito do roteador de modelos, `MODEL-ROUTER.md`).
- **Serviço de visão dedicado desde o v0:** rejeitado pelo mesmo motivo —
  a visão nativa do Claude já cobre o caso de uso conhecido hoje.
