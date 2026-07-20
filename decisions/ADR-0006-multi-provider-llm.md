---
id: adr-0006
type: decision
version: 1.0.0
status: accepted
created: 2026-07-20
confidence: 0.65
mutable_by_system: never
supersedes: none
---

# ADR-0006 — Arquitetura multi-provedor de LLM no Aurora Desktop

## Contexto

O Aurora Desktop v0 (`decisions/ADR-0003-aurora-desktop.md`) fala só com a
API Anthropic, com a chave lida de `process.env.ANTHROPIC_API_KEY` no main
process (`src/main/index.ts`) — sem UI de configuração, sem opção de trocar
de provedor ou modelo, sem fallback se a chave faltar além de uma mensagem
de erro no chat. Isso trava o usuário a um único provedor pago, sem opção
gratuita, e exige editar variável de ambiente do sistema pra trocar de
chave — inviável pra distribuir o app pra qualquer pessoa além de quem
sabe mexer em terminal.

`decisions/research-llm-providers.md` (Fase 1) levantou 9 provedores; 6
deles falam nativamente (ou quase) o formato `chat/completions` da OpenAI
(OpenAI, Groq, Mistral, OpenRouter, Ollama, DeepSeek), 2 têm shape próprio
(Anthropic, Google Gemini), e 1 (Cohere) fica documentado mas fora do
escopo de implementação do v0 por ter free tier explicitamente proibido
para uso não-trivial e exigir uma classe dedicada só para isso.

## Decisão

### 1. Interface `LLMProvider`

```ts
// aurora-desktop/src/main/providers/types.ts
export interface ChatContentBlock {
  type: "text" | "image";
  text?: string;
  mediaType?: string;
  base64?: string;
}
export interface ChatMessage {
  role: "user" | "assistant";
  content: ChatContentBlock[];
}
export interface SendMessageParams {
  apiKey: string;              // "" para Ollama (não usa chave)
  model: string;
  system: string;
  messages: ChatMessage[];
  onDelta?: (delta: string) => void;
}
export interface SendMessageResult { text: string }
export interface ModelInfo { id: string; label: string; contextWindow?: number }
export interface ValidateKeyResult { valid: boolean; error?: string }

export interface LLMProvider {
  id: string;
  label: string;
  requiresApiKey: boolean;     // false só para Ollama
  sendMessage(params: SendMessageParams): Promise<SendMessageResult>;
  listModels(apiKey?: string): Promise<ModelInfo[]>;
  validateKey(apiKey: string): Promise<ValidateKeyResult>;
}
```

`ChatContentBlock`/`ChatMessage` reaproveitam exatamente o shape que já
atravessa o IPC `chat:send` hoje (`src/main/index.ts`,
`src/renderer/global.d.ts`) — trocar de provedor não deve exigir mudar o
contrato entre renderer e main, só o que acontece *dentro* do handler.

**Por que `apiKey` é parâmetro, não estado do provider:** cada chamada
recebe a chave explicitamente em vez de o provider guardar estado interno.
Isso mantém os providers como funções puras (mesma entrada → mesma
chamada HTTP), o que é o que faz `sendMessage`/`validateKey` serem
testáveis por unidade sem precisar instanciar nada com side-effects (ver
Fase 3).

### 2. Uma classe genérica para os 6 provedores compatíveis com OpenAI

`OpenAICompatibleProvider` implementa `LLMProvider` uma vez, parametrizada
por config (`baseURL`, header de auth, endpoint de `/models`). Cada
provedor compatível (OpenAI, Groq, Mistral, OpenRouter, DeepSeek, Ollama)
é uma *instância* dessa classe com config diferente, não uma classe nova —
evita 6 implementações quase idênticas divergindo ao longo do tempo.
Anthropic e Gemini ganham classes próprias (`AnthropicProvider`,
`GeminiProvider`) por terem shape de request/response genuinamente
diferente. Cohere fica fora da implementação de código (ver Fase 1,
seção "Cohere").

Todas as chamadas HTTP usam `fetch` nativo (Node 18+/Electron já tem
global), não SDKs de vendor — exceção à Anthropic, que mantém
`@anthropic-ai/sdk` (já testado, já funcionando, aceita `fetch` customizado
via opção do construtor, o que mantém a chamada mockável no mesmo padrão
dos demais). Usar `fetch` puro pros outros 7 evita 6+ dependências de SDK
só pra chamadas REST simples, e deixa o mock de HTTP nos testes uniforme
(`vi.stubGlobal("fetch", ...)`) em vez de um mock por SDK.

### 3. Registro de provedores (`PROVIDER_REGISTRY`)

Tabela estática `id → { label, requiresApiKey, factory }` em
`providers/index.ts`. `getProvider(id)` resolve a instância a partir daí —
nenhum `if/else` de provedor espalhado pelo resto do código; adicionar um
9º provedor OpenAI-compatível vira uma linha na tabela, não uma nova
classe nem um novo `case`.

### 4. Armazenamento de chave: `electron-store` + `safeStorage` (não só `encryptionKey`)

O pedido original especificava `electron-store` com `encryptionKey`. Isso
entra, mas com uma ressalva de segurança real que vale documentar em vez
de esconder: **a `encryptionKey` do `electron-store` protege contra leitura
casual do arquivo JSON em disco, não é uma vaga cofre criptográfica** — a
chave de cifra fica embutida no próprio código do app, então qualquer
pessoa com acesso ao binário consegue decifrar o arquivo. Isso é adequado
como camada de "não fica em texto puro se alguém abrir o arquivo sem
querer", mas insuficiente para segredos reais como API keys de provedores
pagos.

Por isso, a chave de cada provedor passa primeiro pelo `safeStorage` do
Electron (`encryptString`/`decryptString`) — que delega a cifra real ao
cofre do sistema operacional (DPAPI no Windows, Keychain no macOS,
libsecret/kwallet no Linux) — e só o resultado (já cifrado pelo SO) é
persistido via `electron-store` (que por sua vez ainda aplica sua própria
`encryptionKey` como camada extra de ofuscação do arquivo). Fallback
explícito e logado se `safeStorage.isEncryptionAvailable()` for `false`
(ex.: alguns ambientes Linux sem keyring configurado) — nesse caso a chave
é salva marcada como `plain:` no valor, e a UI de configurações deve
avisar o usuário que a proteção do SO não está disponível nesta máquina.

```ts
// aurora-desktop/src/main/providers/keyStore.ts (assinatura — Fase 2; corpo real na Fase 3)
export function saveProviderKey(providerId: string, apiKey: string): void;
export function getProviderKey(providerId: string): string | undefined;
export function deleteProviderKey(providerId: string): void;
export function isKeyStorageSecure(): boolean; // reflete safeStorage.isEncryptionAvailable()
```

Schema do store (`aurora-provider-config`):
```ts
interface StoreSchema {
  activeProvider: string;
  activeModel: string;
  providerKeys: Record<string, string>; // "enc:<base64>" | "plain:<key>"
}
```

### 5. Remoção de `ANTHROPIC_API_KEY` do ambiente

`process.env.ANTHROPIC_API_KEY` deixa de ser lido em qualquer lugar do
código. `chat:send` passa a resolver a chave via `getProviderKey(activeProvider)`.
Se não houver chave salva para o provedor ativo, `chat:send` responde
`chat:error` orientando o usuário a abrir Configurações — mesmo padrão de
erro que já existe hoje pra "chave ausente", só trocando a fonte.

### 6. Tela de Configurações no renderer

Nova aba/tela `Settings` (mesma paleta, `design/tokens.md`): lista os
provedores do `PROVIDER_REGISTRY`, permite colar/editar/remover a chave de
cada um (`type="password"`, nunca eco em texto plano na UI), botão
"Testar chave" chamando `validateKey` via IPC antes de salvar, e um
seletor de provedor+modelo ativo (populado por `listModels` quando o
provedor tem endpoint de listagem; fallback pra lista estática do registro
quando não tem ou a chamada falha). Ollama não pede chave — só mostra
status "servidor local respondendo: sim/não" (chamando `listModels` sem
`apiKey`).

### 7. IPC novo

| canal | direção | o que faz |
|---|---|---|
| `providers:list` | renderer→main (invoke) | retorna `PROVIDER_REGISTRY` (id/label/requiresApiKey) |
| `providers:list-models` | renderer→main (invoke) | `listModels()` do provedor pedido |
| `providers:validate-key` | renderer→main (invoke) | `validateKey()` do provedor pedido |
| `providers:save-key` | renderer→main (invoke) | grava chave via `keyStore` |
| `providers:delete-key` | renderer→main (invoke) | remove chave via `keyStore` |
| `providers:get-active` / `providers:set-active` | renderer→main (invoke) | lê/grava `activeProvider`+`activeModel` |

`chat:send` continua existindo sem mudar de forma na borda do IPC — só
passa a resolver provider/chave internamente em vez de assumir Anthropic
fixo.

## Consequências

**Positivas:**
- Usuário pode rodar o Aurora Desktop 100% de graça (Groq ou OpenRouter
  `:free`, ou Ollama local) sem nunca configurar uma chave paga.
- Adicionar um provedor OpenAI-compatível novo no futuro é uma entrada na
  tabela de registro, não uma classe nova.
- Separar `sendMessage`/`validateKey`/`listModels` de qualquer estado do
  Electron (chave vem por parâmetro) é o que torna a Fase 3 (TDD) viável
  sem subir um app Electron inteiro pra testar uma chamada HTTP.

**Negativas / riscos:**
- Cada provedor tem seu próprio dialeto de streaming/erro — a normalização
  pro shape comum (`onDelta`/`SendMessageResult`) é onde bug de provedor
  específico mais provavelmente vai aparecer; mitigado por testes unitários
  por provedor (Fase 3).
- `encryptionKey` do `electron-store` sozinha não protegeria as chaves de
  verdade — resolvido combinando com `safeStorage` (seção 4), mas isso é
  mais código/superfície de teste do que só usar `electron-store` como
  pedido originalmente.
- Gemini free tier usa input/output do usuário para treino do Google — a
  UI de Configurações deve avisar isso quando o usuário selecionar Gemini
  (ver `research-llm-providers.md`).

## Alternativas rejeitadas

- **Uma classe por provedor, mesmo os 6 compatíveis com OpenAI:** rejeitado
  — duplicaria ~90% do código 6 vezes por uma diferença real de config
  (baseURL, header, lista de modelos).
- **SDK oficial de cada provedor:** rejeitado pro conjunto compatível com
  OpenAI — `fetch` cru já cobre o necessário e mantém os testes uniformes;
  mantido só pra Anthropic por já estar em produção e testado.
- **`electron-store` com `encryptionKey` sozinho, sem `safeStorage`:**
  rejeitado por dar falsa sensação de segurança para segredos reais (ver
  seção 4) — vale o código extra de combinar os dois.
- **Implementar Cohere no v0:** rejeitado (ver `research-llm-providers.md`)
  — free tier proibido pra uso não-trivial, shape de API próprio exigiria
  uma classe dedicada só pra uma opção que a própria Cohere desaconselha
  usar de verdade.
