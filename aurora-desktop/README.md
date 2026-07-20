# aurora-desktop v0

App Electron + React + TypeScript: chat com a Aurora com voz (STT/TTS), visão
(imagem) e memória real do vault via `noesis-mcp`. Ver
`decisions/ADR-0003-aurora-desktop.md` para as decisões de stack e
`ORCAMENTO-FUTURO.md` para o caminho de upgrade pago de cada fallback
gratuito usado aqui.

## Setup

```bash
cd aurora-desktop
npm install
npm run build          # gera dist/main (Electron) e dist/renderer (Vite)
```

Requer `noesis-mcp/dist/index.js` já buildado (`cd ../noesis-mcp && npm run
build`) e a variável de ambiente `ANTHROPIC_API_KEY` definida — sem ela, o
chat responde com uma mensagem de erro explicando o que falta.

```bash
export ANTHROPIC_API_KEY=sk-...
npm start               # build + abre a janela Electron
```

Para desenvolvimento com hot-reload do renderer:

```bash
npm run dev              # Vite dev server + Electron apontando pra ele
```

## Arquitetura

- **Main process** (`src/main/index.ts`): cria a janela (420×780, sem frame
  nativo), spawna `noesis-mcp` via stdio (protocolo MCP, mesmo transporte que
  o Claude Code usa) e fala com a API Anthropic via `@anthropic-ai/sdk`
  (streaming). A chave de API nunca é exposta ao renderer.
- **Preload** (`src/main/preload.ts`): ponte `contextBridge` — expõe
  `window.aurora.{chat,mcp,window,onboarding}` ao renderer, sem `nodeIntegration`.
- **Renderer** (`src/renderer/AuroraApp.tsx`): UI baseada fielmente no
  protótipo `aurorav0.jsx` (paleta, 3 tabs, `Metabolismo`, chips), com voz,
  visão, contexto do vault e opções numeradas clicáveis adicionados por cima.

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
  (`lang: 'pt-BR'`, prioriza voz feminina se disponível); toggle no header,
  estado em `localStorage`.
- **Visão**: anexo por clipe (file picker), `Ctrl+V` (clipboard) ou
  drag-and-drop na janela do chat — vira thumbnail na bolha do usuário e
  `image` content block (base64) na chamada à API.
- **Contexto do vault**: antes de cada mensagem, o renderer chama
  `get_context(intent)` e injeta o resultado no `system` prompt; depois da
  resposta, `log_event` registra a interação como evidência no vault.
- **Opções numeradas**: linhas `"1. texto"`, `"2. texto"` etc. na resposta
  da Aurora também viram botões clicáveis abaixo da bolha.

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
respectivamente. Testado localmente com `electron-builder --linux dir`
(gera um app Linux "unpacked" sem instalador — suficiente pra validar a
config; gerar `.exe`/`.dmg` de verdade depende de rodar em/rumo à
plataforma alvo, ou de ferramentas cross-compile como `wine` para NSIS a
partir do Linux, não configuradas aqui).

## Pendências conhecidas (v0)

- `ANTHROPIC_API_KEY` fica em variável de ambiente; config de app com
  armazenamento seguro é trabalho futuro (ver ADR-0003, riscos).
- Sem assinatura de código (`codeSigningIdentity`/notarization) configurada
  — instaladores gerados hoje disparariam aviso de "app não verificado" no
  Windows/macOS. Fora de escopo enquanto o app não é distribuído a ninguém
  além do próprio Lucas (ver ADR-0003 §"Privacidade do conceito").
