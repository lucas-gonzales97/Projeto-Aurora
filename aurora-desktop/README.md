# aurora-desktop v0

App Electron + React + TypeScript: chat com a Aurora com voz (STT/TTS), visão
(imagem), memória real do vault via `noesis-mcp`, e (em construção, ver
"Provedores multi-LLM" abaixo) suporte a múltiplos provedores de LLM com
chave configurada pelo usuário. Ver `decisions/ADR-0003-aurora-desktop.md`
para as decisões de stack original e `ORCAMENTO-FUTURO.md` para o caminho de
upgrade pago de cada fallback gratuito usado aqui.

## Setup

```bash
cd aurora-desktop
npm install
npm run build          # gera dist/main (Electron) e dist/renderer (Vite)
```

Requer `noesis-mcp/dist/index.js` já buildado (`cd ../noesis-mcp && npm run
build`). **A chave de API não é mais lida de variável de ambiente** (ver
"Provedores multi-LLM" abaixo) — abra a aba **Config** no app pra colar/testar
a chave de cada provedor e escolher o modelo ativo.

```bash
npm start               # build + abre a janela Electron
```

Para desenvolvimento com hot-reload do renderer:

```bash
npm run dev              # Vite dev server + Electron apontando pra ele
```

## Arquitetura

- **Main process** (`src/main/index.ts`): cria a janela (420×780, sem frame
  nativo), spawna `noesis-mcp` via stdio (protocolo MCP, mesmo transporte que
  o Claude Code usa) e roteia `chat:send` para o provedor de LLM ativo
  (`src/main/providers/`, ver ADR-0006) em vez de falar só com Anthropic. A
  chave de API nunca é exposta ao renderer.
- **Providers** (`src/main/providers/`): `LLMProvider` (interface comum),
  `AnthropicProvider`/`GeminiProvider` (shape próprio) e
  `OpenAICompatibleProvider` (uma classe, várias instâncias — OpenAI, Groq,
  Mistral, OpenRouter, Ollama, DeepSeek), `keyStore.ts` (persistência de
  chave via `electron-store` + `safeStorage`), `index.ts` (registro +
  `getProvider(id)`). Testado por unidade com `vitest` (`npm test`).
- **Preload** (`src/main/preload.ts`): ponte `contextBridge` — expõe
  `window.aurora.{chat,mcp,window,onboarding,providers}` ao renderer, sem
  `nodeIntegration`.
- **Renderer** (`src/renderer/AuroraApp.tsx`): UI baseada fielmente no
  protótipo `aurorav0.jsx` (paleta, `Metabolismo`, chips), com voz, visão,
  contexto do vault e opções numeradas clicáveis adicionados por cima. 4
  abas: Conversa, Painel, Automações, **Config** (`src/renderer/Settings.tsx`,
  ver "Provedores multi-LLM" abaixo) — reusa a paleta exportada de
  `AuroraApp.tsx` (`export const C`) em vez de duplicá-la.

## IPC exposto (`window.aurora`)

O pedido original desta feature especificava "IPC handlers" para o main
process mas a lista de handlers não chegou completa na mensagem — os
handlers abaixo foram inferidos do resto do escopo pedido (chat com
streaming, `get_context`/`log_event` via `noesis-mcp`, janela sem frame
precisando de controles próprios). Revise e ajuste se a intenção original
era outra.

| canal | direção | o que faz |
|---|---|---|
| `chat:send` / `chat:chunk` / `chat:done` / `chat:error` | renderer→main / main→renderer | envia mensagem (texto + imagens) pra API Anthropic com streaming |
| `mcp:get-context` | renderer→main (invoke) | chama `get_context(intent)` no `noesis-mcp` |
| `mcp:log-event` | renderer→main (invoke) | chama `log_event(...)` no `noesis-mcp` |
| `window:close` / `window:minimize` | renderer→main | controles de janela (necessário — janela é `frame: false`) |
| `window:toggle-always-on-top` | renderer→main (invoke) | liga/desliga always-on-top em runtime |
| `mcp:create-note` | renderer→main (invoke) | chama `create_note(...)` no `noesis-mcp` (usado pelo onboarding, ver abaixo) |
| `mcp:create-relation` | renderer→main (invoke) | chama `create_relation(...)` no `noesis-mcp` (exposto para o loop de evidência contínua de ADR-0005 §4; não usado por nenhum fluxo automático ainda) |
| `aurora:is-first-run` | renderer→main (invoke) | `true` se `user-model/{goals,values,skills,patterns}` não têm nenhuma nota — ver Onboarding abaixo |
| `providers:list` | renderer→main (invoke) | lista `{id,label,requiresApiKey}` de todos os provedores registrados |
| `providers:list-models` | renderer→main (invoke) | `listModels()` do provedor pedido |
| `providers:validate-key` | renderer→main (invoke) | `validateKey()` do provedor pedido, sem salvar |
| `providers:save-key` / `providers:delete-key` | renderer→main (invoke) | grava/remove a chave via `keyStore` (`safeStorage` + `electron-store`) |
| `providers:has-key` | renderer→main (invoke) | `true`/`false` — nunca devolve a chave em si |
| `providers:is-key-storage-secure` | renderer→main (invoke) | reflete `safeStorage.isEncryptionAvailable()` — UI deveria avisar se `false` |
| `providers:get-active` / `providers:set-active` | renderer→main (invoke) | lê/grava `{providerId, model}` ativos (default: `anthropic`, sem modelo) |

## Provedores multi-LLM (ADR-0006) — EM ANDAMENTO

> Handoff pra continuar isso fora desta sessão: leia
> `decisions/research-llm-providers.md` (pesquisa) e
> `decisions/ADR-0006-multi-provider-llm.md` (decisão de arquitetura)
> primeiro — este bloco só resume o estado do código.

**Feito (fase 3, parte 1/3 — camada de providers + IPC):**
- `src/main/providers/types.ts` — contrato `LLMProvider` (`sendMessage`,
  `listModels`, `validateKey`).
- `src/main/providers/openAICompatible.ts` + testes — cobre OpenAI, Groq,
  Mistral, OpenRouter, Ollama, DeepSeek via uma classe parametrizada.
- `src/main/providers/anthropic.ts` + testes — mantém `@anthropic-ai/sdk`.
- `src/main/providers/gemini.ts` + testes — shape `contents/parts` próprio.
- `src/main/providers/keyStore.ts` + testes — `saveProviderKey`,
  `getProviderKey`, `deleteProviderKey`, `hasProviderKey`,
  `isKeyStorageSecure`, `getActiveProvider`/`setActiveProvider`,
  `getActiveModel`/`setActiveModel`.
- `src/main/providers/index.ts` — `PROVIDER_REGISTRY` + `getProvider(id)`.
- `src/main/index.ts` — `chat:send` não fala mais só com Anthropic: resolve
  provedor/modelo/chave ativos e roteia pro `LLMProvider` certo.
  `ANTHROPIC_API_KEY` de variável de ambiente foi **removido** do código.
- IPC `providers:*` completo (tabela acima) + exposto em `preload.ts` e
  tipado em `global.d.ts`.
- 29 testes unitários (`npm test`), todos verdes; `tsc` limpo em main e
  renderer; `vite build` limpo. **Só validado em nível de lógica/IPC nessa
  parte — Electron de verdade não tinha rodado ainda (dev era WSL, sem
  display).**

**Feito (fase 3, parte 2/3 — tela de Configurações + primeiro run real no Electron):**
- `src/renderer/Settings.tsx` (novo) — implementa ADR-0006 §6: lista os
  provedores (`providers.list()`), por provedor com `requiresApiKey` mostra
  campo de chave (`type="password"`) + botão "testar" (`validateKey` antes
  de salvar) + botão "salvar"/"trocar"/"remover"; Ollama (não pede chave)
  mostra "servidor local: respondendo/não respondendo" chamando
  `validateKey(providerId, "")` (que já faz um GET real em `/models` — é
  exatamente o check de "tá de pé?"); seletor de modelo (`listModels`) +
  botão "usar" (`providers.setActive`) uma vez que o provedor está utilizável
  (tem chave, ou não precisa); aviso vermelho quando
  `isKeyStorageSecure()` é `false`; nota específica no card do Gemini sobre
  o tier grátis usar as mensagens pra treino do Google (`research-llm-providers.md`).
  Reusa a paleta exportada de `AuroraApp.tsx` (`export const C`) em vez de
  duplicá-la num arquivo próprio.
- `src/renderer/AuroraApp.tsx` — nova 4ª aba "Config" na tab bar (`tab` agora
  é `"chat" | "painel" | "auto" | "settings"`), renderiza `<Settings />`.
- **Bug real encontrado e corrigido ao rodar o Electron de verdade pela
  primeira vez** (Windows nativo, não WSL): `tsconfig.main.json` compila o
  main process pra `module: "commonjs"`, e nesse alvo o TypeScript rebaixa
  `await import(x)` pra `require(x)` — o que quebra em runtime com
  `ERR_REQUIRE_ESM` pra qualquer dependência `"type": "module"`-only.
  Isso afetava **dois** pontos: `keyStore.ts` (`electron-store` v11, ESM-only)
  e `index.ts` (`@modelcontextprotocol/sdk`, também ESM-only) — ambos
  "pareciam" usar `import()` dinâmico corretamente no código-fonte, mas o
  `.js` compilado continha `require()`. Isso quebrava **toda** chamada IPC
  `providers:*` (inclusive `chat:send`, que agora depende do `keyStore`) e
  também `mcp:*` (que depende do SDK MCP) — invisível pros 29 testes
  unitários porque `keyStore.test.ts` injeta um backend fake via
  `__setBackendForTests`, nunca exercitando o `getBackend()` real. Corrigido
  com `src/main/esmImport.ts` (novo): um `new Function("specifier", "return
  import(specifier)")` que esconde o `import()` da análise estática do
  compilador — mesmo workaround documentado pelo próprio `electron-store`
  pra consumidores CommonJS. `keyStore.ts` e `index.ts` agora usam
  `dynamicImport(...)` em vez de `await import(...)` direto.
- **Validado rodando o Electron de verdade** (Windows nativo, `npx electron .`):
  aba Config abre, lista os 8 provedores, badge "ativo" no Anthropic (default),
  campo de chave + testar/salvar funcionam — testado com uma chave Anthropic
  fake e confirmado que o IPC `providers:validate-key` faz a chamada HTTP
  real e devolve o erro 401 genuíno da API (`authentication_error`). Ollama
  mostrou corretamente "não respondendo" (não há servidor local rodando
  nesta máquina). `npm test` (29/29), `tsc` (main + renderer) e `npm run
  build` continuam limpos depois da correção.

**Feito (fase 3, parte 3/3 — telemetria por chamada, MODEL-ROUTER.md §5):**
- `src/main/providers/types.ts` — `SendMessageResult` ganhou `inputTokens`/
  `outputTokens` opcionais (`undefined`, não `0`, quando o provedor não
  informa — 0 seria dado falso).
- `anthropic.ts` — vem de `finalMessage.usage.{input,output}_tokens` (SDK já
  devolve isso). `gemini.ts` — vem do `usageMetadata.{prompt,candidates}TokenCount`
  do último chunk SSE que o trouxer. `openAICompatible.ts` — passou a pedir
  `stream_options: {include_usage: true}` no corpo da requisição (padrão
  OpenAI, seguido por Groq/Mistral/OpenRouter/DeepSeek; servidor que não
  reconhece o campo — ex.: builds antigos do Ollama — ignora, JSON solto,
  não quebra a chamada) e lê `usage.{prompt,completion}_tokens` do chunk
  final. 3 testes novos (32/32 no total) cobrindo os três caminhos de
  extração.
- `src/main/index.ts` — `chat:send` agora mede latência e chama
  `logModelRouterTelemetry(...)` no sucesso **e** na falha, que grava via
  `log_event` do noesis-mcp em `events/{dia}.jsonl` — o mesmo arquivo/formato
  que MODEL-ROUTER.md §5 já especificava como dataset do roteador
  automático futuro. `tier: "cloud-manual"` e `custo_estimado_usd: null` são
  placeholders deliberados e documentados no código: o roteador T0–T5
  (MODEL-ROUTER.md §1/§3) ainda não existe, e uma tabela de preço por
  modelo/provedor mantida à mão desatualiza rápido — nenhum dos dois vale
  fingir agora. Falha ao gravar telemetria (ex.: noesis-mcp offline) só
  gera um `console.warn`, nunca quebra o chat.
- **Validado rodando o Electron de verdade** (Windows nativo): configurada
  uma chave Anthropic fake pela aba Config, ativado Claude Haiku 4.5,
  enviada uma mensagem pelo chat — confirmado no arquivo real
  `events/2026-07-22.jsonl` um evento `type: "model-router-telemetry"` com
  o shape completo (`sucesso: false`, `latencia_ms`, `erro` com o 401 real
  da API, `tokens_in`/`tokens_out: null` porque a chamada falhou antes de
  qualquer uso ser reportado).

**Não feito ainda (por aqui parou):**
1. **Testes e2e com Playwright** — nada configurado ainda (`@playwright/test`
   não é dependência do projeto). Precisa: instalar, configurar o launcher
   `_electron` (Playwright dirige o binário Electron direto, não precisa
   baixar Chromium/Firefox pra isso), escrever e2e de "configurar uma chave",
   "trocar de provedor/modelo" e "uma chamada falha grava telemetria em
   events/*.jsonl" cobrindo `Settings.tsx` + a telemetria nova. Já
   confirmamos que o Electron roda de verdade em Windows nativo, então
   esses testes também deveriam rodar de verdade aqui.
2. **Testar cada provedor com uma chave real** — só Anthropic foi exercitado
   até agora (com chave fake, só pra validar o pipeline de erro e, agora,
   o de telemetria). Falta testar `sendMessage`/`listModels`/`validateKey`
   de verdade — com sucesso, não só falha — em Gemini, OpenAI, Groq,
   Mistral, OpenRouter, DeepSeek (chave paga ou tier grátis) e Ollama (com
   servidor local rodando). É o jeito de: (a) pegar bug de parsing de
   streaming/erro específico de provedor que só aparece com tráfego real
   (ver "riscos" em ADR-0006); (b) confirmar que `tokens_in`/`tokens_out`
   realmente chegam preenchidos numa chamada bem-sucedida (só testamos o
   caminho `null` da falha até aqui).
3. **Protocolo de validação de uma semana** (o objetivo real de tudo isso —
   ver MODEL-ROUTER.md §5 e ORCAMENTO-FUTURO.md): definir um critério de
   "aprovado" por provedor (latência aceitável, zero falha de autenticação,
   qualidade da resposta em português pra persona da Aurora) e trocar de
   provedor a cada dia/sessão pela aba Config, usando a Aurora de verdade
   no dia a dia. A telemetria em `events/*.jsonl` já é o dataset — falta só
   ler/agregar isso ao final (uma query simples sobre os JSONL do período,
   nada de dashboard por enquanto) pra comparar sucesso/latência por
   provedor e decidir o(s) motor(es) vencedor(es).
4. Depois de 1–3: considerar se `AURORA_SYSTEM` (ainda hardcoded em
   `AuroraApp.tsx` com contexto pessoal do Lucas) deveria virar algo que o
   Settings também edita, ou se fica como está por enquanto.

**Como retomar:** `cd aurora-desktop && npm install && npm test` pra
confirmar que a base ainda está verde (32 testes), depois seguir pelo item
1 da lista acima.

## Onboarding epistêmico (ADR-0005)

Na primeira execução (`aurora:is-first-run` = `true`), a UI mostra
`Onboarding` (`src/renderer/AuroraApp.tsx`) em vez do chat normal: uma
entrevista conduzida pela Aurora sob um system prompt próprio
(`ONBOARDING_SYSTEM`), uma pergunta por vez, sem formulário. Depois de
6+ trocas o usuário pode encerrar manualmente; em 12 o encerramento é
automático. Ao fechar, uma segunda chamada ao modelo
(`ONBOARDING_SYNTH_SYSTEM`) pede uma síntese em JSON estrito, que vira:

- `goal`/`value`/`skill` em `user-model/{goals,values,skills}/` via
  `mcp:create-note` (só para o que a pessoa realmente declarou);
- `journal/onboarding.md` com a síntese completa + transcrição;
- um `log_event` marcando o onboarding como concluído.

**Traços autodeclarados (interesses, personalidade, estilo de
aprendizagem, bloqueios) não viram nota em `user-model/patterns/`** —
`ontology/ontology.yaml` reserva essa pasta para hipóteses *inferidas* pelo
sistema com evidência acumulada, nunca para algo declarado manualmente. Eles
ficam só em `journal/onboarding.md` (ver ADR-0005 §3 para o raciocínio
completo). Se a síntese em JSON falhar por qualquer motivo, o onboarding não
trava: grava a transcrição bruta em `journal/onboarding.md` e segue para o
chat normal sem notas estruturadas.

Como o critério de "primeira execução" é "nenhuma nota em
`user-model/goals|values|skills|patterns`", e este vault (o de Lucas) já
tem 8 goals e 3 skills desde a Genesis, `aurora:is-first-run` retorna
`false` aqui — o onboarding só dispara de fato num vault novo, vazio.

## Evoluções sobre o protótipo (ver ADR-0003)

- **Microfone**: botão no campo de input, `SpeechRecognition` (`lang:
  'pt-BR'`), pulsa cobre enquanto grava, auto-envia ao parar.
- **TTS**: toda resposta da Aurora é falada via `SpeechSynthesis`
  (`lang: 'pt-BR'`, prioriza voz feminina e, quando instalada, uma voz
  "natural"/neural — ver "Voz da Aurora" abaixo); toggle no header, estado
  em `localStorage`.
- **Visão**: anexo por clipe (file picker), `Ctrl+V` (clipboard) ou
  drag-and-drop na janela do chat — vira thumbnail na bolha do usuário e
  `image` content block (base64) na chamada à API.
- **Contexto do vault**: antes de cada mensagem, o renderer chama
  `get_context(intent)` e injeta o resultado no `system` prompt; depois da
  resposta, `log_event` registra a interação como evidência no vault.
- **Opções numeradas**: linhas `"1. texto"`, `"2. texto"` etc. na resposta
  da Aurora também viram botões clicáveis abaixo da bolha.

## Voz da Aurora

`speak()` em `AuroraApp.tsx` escolhe a voz pt-BR na ordem: **natural +
feminina** (melhor caso) > **feminina** (mesmo que não-natural) > **natural**
(gênero incerto pelo nome) > primeira voz pt-BR disponível. "Natural" aqui
significa qualquer nome de voz contendo `natural`/`online` — é assim que o
Windows 11 nomeia as vozes neurais modernas (bem mais naturais que as vozes
SAPI5 legadas tipo "Microsoft Maria").

**Bug corrigido:** a versão original chamava
`window.speechSynthesis.getVoices()` direto, sem esperar a lista carregar
— no Chromium/Electron essa lista carrega de forma assíncrona, então a
primeira fala da sessão quase sempre pegava a lista vazia, caía em
`voice = null`, e o navegador escolhia seu próprio default pra pt-BR (nesta
máquina, "Microsoft Daniel", masculino — daí a voz sair errada mesmo com a
lógica de preferência por voz feminina já existindo no código). Agora
`loadVoices()` cacheia a lista e espera o evento `voiceschanged` (com
timeout de segurança de 1s) antes da primeira fala.

**Ter uma voz de qualidade instalada é responsabilidade do Windows, não do
app.** Se `speechSynthesis.getVoices()` só devolve vozes SAPI5 legadas
(`Microsoft Maria`/`Microsoft Daniel`), instale uma voz neural:
`Configurações` → `Hora e Idioma` → `Fala` → `Vozes` → `Adicionar vozes` →
buscar "Português (Brasil)" e adicionar a(s) voz(es) natural(is)
disponível(is). Depois de instalada, o app já passa a usá-la automaticamente
(prioridade "natural + feminina" no `pickPortugueseVoice()`) — não precisa
mudar nada no código. Confirmar quais vozes uma máquina tem instaladas via
PowerShell:
```powershell
Add-Type -AssemblyName System.Speech
(New-Object System.Speech.Synthesis.SpeechSynthesizer).GetInstalledVoices() |
  ForEach-Object { $_.VoiceInfo } | Select-Object Name, Culture, Gender
```

## Ícone e empacotamento

O ícone oficial ("Aurora Icon v2") vive como fonte em `assets/icon.svg` — um
SVG 1024×1024 extraído do Design Component original (mesma iconografia da
`Metabolismo` do chat: hub disparando + trilhas de cobre), já nas cores de
`design/tokens.md`. Ele não é usado diretamente pelo Electron/electron-builder
(SVG não é um formato de ícone confiável em todas as plataformas) — em vez
disso:

```bash
npm run icons   # gera build/icon.png (1024, runtime) + build/icon.ico (Windows) + build/icon.icns (macOS)
```

Rode de novo sempre que `assets/icon.svg` mudar. `build/icon.*` são
versionados no repo (não regenerados automaticamente no `npm install`) para
que `npm start`/`npm run dist` funcionem em um checkout limpo sem depender
de `sharp`/`png2icons` (dependências nativas) estarem instaladas.

```bash
npm run dist     # icons + build + electron-builder → release/
```

A config do electron-builder está em `package.json` (`"build"`) —
`win.icon`/`mac.icon`/`linux.icon` apontam para `build/icon.{ico,icns,png}`
respectivamente. Testado localmente com `electron-builder --linux dir` e com
`npm run dist` (gera `.AppImage` + `.snap` no Linux) — ambos com o ícone
oficial aplicado.

### Build Windows (`.exe`) — precisa rodar no Windows nativo, não no WSL

```bash
npm run dist:win            # instalador NSIS (.exe)
npm run dist:win-portable   # .exe portátil, sem instalador
```

**`wine` não está instalado neste WSL** (checado — `which wine`/`wine64`
não encontram nada), e cross-compilar NSIS via Wine a partir do Linux é
historicamente instável (fontes/ícone corrompidos, erros de assinatura
silenciosos) mesmo quando funciona. Em vez de depender disso, rode o build
Windows **direto no Windows, fora do WSL** — o próprio vault já mora no
filesystem do Windows (`C:\Users\Pichau\Projeto-Aurora`, montado como
`/mnt/c/Users/Pichau/Projeto-Aurora` aqui no WSL), então não precisa clonar
de novo:

1. **Instalar Node.js no Windows** (não o do WSL — precisa de um Node.js
   nativo do Windows para compilar módulos nativos como `sharp` para o
   target certo):
   - Via `winget` (PowerShell como usuário normal):
     ```powershell
     winget install OpenJS.NodeJS.LTS
     ```
   - Ou baixando o instalador em https://nodejs.org (versão LTS) e rodando
     o `.msi`.
   - Feche e reabra o PowerShell depois de instalar, para o `PATH` pegar o
     `node`/`npm` novos.

2. **Abrir um PowerShell nativo do Windows** (não o terminal do VS Code
   apontando pro WSL, não `wsl.exe` — o atalho "Windows PowerShell" ou
   "Terminal" do menu Iniciar).

3. **Entrar na pasta do projeto** (já existe — é a mesma pasta que o WSL
   enxerga em `/mnt/c/...`, só que pelo caminho Windows nativo):
   ```powershell
   cd C:\Users\Pichau\Projeto-Aurora\aurora-desktop
   ```

4. **Reinstalar as dependências como Windows** — o `node_modules/` que já
   existe aí foi montado rodando `npm install` de dentro do WSL (Linux), e
   `sharp` tem binário nativo por plataforma; rodar `npm install` de novo
   agora, mas a partir do PowerShell, garante os binários certos para
   Windows:
   ```powershell
   npm install
   ```
   Se aparecer erro estranho de módulo nativo, apague `node_modules` e
   rode `npm install` de novo:
   ```powershell
   Remove-Item -Recurse -Force node_modules
   npm install
   ```

5. **Gerar o instalador**:
   ```powershell
   npm run dist:win
   ```
   (ou `npm run dist:win-portable` para o `.exe` avulso, sem instalador).

6. **Artefato final** em `aurora-desktop\release\` — `Aurora Setup 0.1.0.exe`
   (NSIS, `oneClick: false` — deixa escolher a pasta de instalação) e/ou
   `Aurora 0.1.0.exe` (portátil).

## Pendências conhecidas (v0)

- Testes e2e do fluxo multi-provedor (Playwright) e protocolo de validação
  de uma semana — ver seção "Provedores multi-LLM (ADR-0006) — EM ANDAMENTO"
  acima, é o trabalho em aberto agora (a tela de Configurações em si já
  está pronta e validada com um provedor real).
- Sem voz neural/natural instalada por padrão — depende do que o Windows
  de cada máquina tem instalado, ver "Voz da Aurora" acima.
- Sem assinatura de código (`codeSigningIdentity`/notarization) configurada
  — instaladores gerados hoje disparariam aviso de "app não verificado" no
  Windows/macOS. Fora de escopo enquanto o app não é distribuído a ninguém
  além do próprio Lucas (ver ADR-0003 §"Privacidade do conceito").
