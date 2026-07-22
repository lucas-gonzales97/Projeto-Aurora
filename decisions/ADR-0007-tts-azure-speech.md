---
id: adr-0007
type: decision
version: 1.0.0
status: accepted
created: 2026-07-22
confidence: 0.7
mutable_by_system: never
supersedes: none
---

# ADR-0007 — TTS em nuvem (Azure AI Speech) para voz natural da Aurora

## Contexto

O Aurora Desktop v0 fala via `window.speechSynthesis` do navegador
(`AuroraApp.tsx`), que delega a síntese pra qualquer voz pt-BR instalada no
Windows. Nesta máquina isso significa só as vozes SAPI5 legadas
(`Microsoft Maria`/`Microsoft Daniel`) — robóticas, não "naturais".

Investigado ao vivo (2026-07-22): o Windows 11 tem, sim, uma voz neural
pt-BR de qualidade — **Francisca** — mas ela é exclusiva do Narrator.
Confirmado por documentação da Microsoft e fontes técnicas cruzadas: vozes
naturais do Narrator **não são expostas a nenhum outro app**, nem via SAPI5
nem via `speechSynthesis` do navegador, nem a outros leitores de tela
(NVDA/JAWS). Existe um adaptador de terceiros que extrai chaves de
criptografia de arquivos de sistema pra rotear essas vozes pra qualquer app
SAPI5 — descartado aqui por ser não-oficial, frágil ("pode parar de
funcionar a qualquer momento", nas palavras do próprio autor) e por
depender de extrair segredos de arquivos da Microsoft. Não há caminho
oficial, dentro do Windows, pra usar Francisca fora do Narrator.

## Decisão

A mesma voz Francisca existe oficialmente fora do Narrator: é uma voz do
**Azure AI Speech** (`pt-BR-FranciscaNeural`), acessível via API REST
documentada e com tier gratuito (500 mil caracteres/mês). Aurora Desktop
passa a chamar essa API diretamente pra síntese de voz, com fallback pra
`speechSynthesis` local quando o Azure não está configurado ou a chamada
falha.

### 1. Endpoint e request

Confirmado contra a documentação oficial (`learn.microsoft.com`), não
assumido:

```
POST https://{region}.tts.speech.microsoft.com/cognitiveservices/v1
Ocp-Apim-Subscription-Key: <chave>
Content-Type: application/ssml+xml
X-Microsoft-OutputFormat: audio-16khz-128kbitrate-mono-mp3

<speak version='1.0' xml:lang='pt-BR'>
  <voice xml:lang='pt-BR' xml:gender='Female' name='pt-BR-FranciscaNeural'>
    {texto, escapado}
  </voice>
</speak>
```

Resposta: bytes crus de MP3. Sem passo de troca de token — o endpoint
`cognitiveservices/v1` aceita a subscription key direto no header, ao
contrário do endpoint de Speech-to-Text (que exige `issueToken` primeiro).

### 2. Módulo novo: `src/main/tts/`

Paralelo a `src/main/providers/` (mesmo espírito, concern diferente — TTS
não é um `LLMProvider`, não faz sentido forçar no mesmo registro):
- `types.ts` — `AzureSpeechConfig`, `SynthesizeParams`/`Result`.
- `azureSpeech.ts` — `synthesizeSpeech()` + `validateAzureSpeechConfig()`
  (faz uma síntese mínima real — mesmo padrão de `validateKey` nos
  providers de LLM).

### 3. Armazenamento de config: extensão do `providers/keyStore.ts`

Não um store novo — `providers/keyStore.ts` já é genericamente "config
local cifrada via safeStorage + electron-store", só nomeado a partir do
caso de uso original. `saveTtsConfig`/`getTtsConfig`/`deleteTtsConfig`/
`hasTtsConfig` reusam o mesmo `getBackend()` e o mesmo padrão
`enc:`/`plain:` das chaves de provider LLM. Duas chaves no store:
`tts.azureSpeech.key` (cifrada) e `tts.azureSpeech.region` (não é segredo,
plaintext).

### 4. IPC novo (mesmo padrão de `providers:*`)

| canal | o que faz |
|---|---|
| `tts:save-config` / `tts:delete-config` | grava/remove key+region |
| `tts:has-config` | bool, nunca devolve a chave |
| `tts:validate` | testa key+region com uma síntese mínima, sem salvar |
| `tts:speak` | sintetiza o texto pedido, devolve áudio base64 |

### 5. Renderer: fallback em cadeia

`speak(text)` em `AuroraApp.tsx`: se `tts:has-config` for `true`, tenta
`tts:speak` (Azure); qualquer falha (rede, quota, config inválida) cai pro
`speechSynthesis` local já existente — nunca deixa a Aurora muda por causa
de um problema de rede.

### 6. UI: novo card em `Settings.tsx`

Mesmo padrão dos providers de LLM: campo de subscription key
(`type="password"`), campo de region (texto livre — Azure Speech existe em
várias regiões, uma lista fixa ficaria desatualizada), botão "testar"
(chama `tts:validate` antes de salvar), "salvar"/"trocar"/"remover", e um
botão extra "ouvir teste" que sintetiza e toca uma frase de exemplo — não
depende de mandar mensagem no chat pra confirmar que a voz ficou boa.

## Consequências

**Positivas:**
- Voz de qualidade real (neural, não SAPI5), sem depender de nada
  não-oficial ou frágil.
- Fallback gracioso: sem Azure configurado, ou se a chamada falhar, o app
  volta pra voz local — nunca fica mudo.
- Tier gratuito (500k caracteres/mês) cobre uso pessoal por bastante tempo.

**Negativas / riscos:**
- Fricção de setup real: precisa de conta Azure (cartão pra verificação de
  identidade, mesmo o tier grátis não cobrando) — bem mais alto que o
  cadastro de um provider LLM tipo Groq. Usuário optou por isso
  conscientemente depois de ver as alternativas (ElevenLabs, manter voz
  local).
- Cada fala vira uma chamada de rede — latência adicional (perceptível,
  mas TTS já não é instantâneo mesmo local) e dependência de internet pra
  a Aurora falar (mitigado pelo fallback local).
- Chave da Azure Speech é mais um segredo pra guardar — mesmo tratamento
  de segurança (safeStorage) que as chaves de LLM já recebem.

## Alternativas rejeitadas

- **Adaptador de terceiros pra extrair as vozes do Narrator:** rejeitado —
  não-oficial, extrai chaves de criptografia de arquivos da Microsoft,
  frágil a qualquer update do Windows (ver Contexto).
- **ElevenLabs em vez de Azure:** ofertado ao usuário como opção; Azure
  venceu por ser literalmente a mesma voz (Francisca) que o usuário já
  tinha visto e gostado no Narrator, com tier gratuito maior.
- **Manter só a voz local:** rejeitado pelo usuário — o pedido explícito
  era qualidade/naturalidade, que a voz SAPI5 legada não entrega.
