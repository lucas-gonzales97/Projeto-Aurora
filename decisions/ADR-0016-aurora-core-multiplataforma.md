---
id: adr-0016
type: decision
version: 1.0.0
status: proposed
created: 2026-07-29
confidence: 0.45
mutable_by_system: never
supersedes: none
depends_on: [adr-0002, adr-0004, adr-0015]
---

# ADR-0016 — Aurora Core compartilhado + arquitetura multiplataforma (Desktop + Android) e PC-como-provider

## Contexto

O `aurora-mobile/` (MVP v0) nasceu como **thin client**: HTML → servidor Node →
OpenRouter, consumindo o vault do desktop. Funciona e prova o pipeline, mas o
Lucas explicitou a direção real: a Aurora Mobile deve ser um **cidadão de
primeira classe**, como ChatGPT/Claude mobile — roda sozinha o que é dela
(conversar, memória, notas, metas, hábitos, voz, câmera, notificações) e ganha
**capacidades extras quando encontra um PC online** (remote control, executar
código, git, docker, VS Code — a "casca VS Code" do ADR-0002 e o remote-control
do ADR-0015). Não é um app "mobile" separado com lógica duplicada; é a **mesma
Aurora** rodando em outra plataforma.

## Decisão

### 1. Existe um **Aurora Core** — plataforma-agnóstico

Um núcleo TS puro (`@aurora/core`), sem dependência de Electron, de `fs` do Node
ou de Git: **persona, prompts, retrieval triplo (ADR-0010), reflexão (ADR-0013),
planner, modelo de memória, agentes**. É só lógica — a mesma que hoje vive
espalhada entre `noesis-mcp` e `aurora-desktop/src/renderer/prompt.ts`. O Core
**não sabe** se está num PC ou num celular.

### 2. Armazenamento e capacidades entram por **adaptador** (a fronteira crítica)

O Core fala com o mundo por interfaces, implementadas por plataforma:

```
interface VaultStore   { listNotes(), readNote(), writeNote(), … }  // hoje: Git+fs; Android: SQLite/arquivos
interface LLMProvider  { stream(messages) }                          // OpenRouter (nuvem) hoje
interface Capabilities { … }                                         // plugins por plataforma
```

- **Desktop** implementa `VaultStore` com o vault Markdown+Git atual (fonte de verdade).
- **Android** implementa `VaultStore` com armazenamento local (SQLite/arquivos) +
  **sync opcional** com o desktop.

> É este adaptador — não a UI — a parte mais difícil e o motivo deste ADR. O
> `noesis-mcp` atual é `fs`+Git; portá-lo cru pro Android é o erro a evitar.

### 3. Modelo de **plugins/capacidades** por plataforma

| Camada | O que traz |
|---|---|
| **Core** (todas as plataformas) | memória, planner, persona, retrieval, notas, metas/hábitos, busca, agentes |
| **Plugins Desktop** | git, docker, VS Code, terminal, filesystem, Claude Desktop, execução de código |
| **Plugins Android** | câmera, GPS, notificações, biometria, bluetooth, arquivos, microfone/voz, widgets |

O Core declara *o que precisa*; a plataforma declara *o que oferece*. Capacidade
ausente = degrada com transparência (nunca finge — LP-a do ADR-0015).

### 4. Dois modos de conectividade (não excludentes)

- **Standalone:** o Android roda o Core localmente. "Qual minha meta da semana?"
  responde **na hora, sem o PC**. (a "independência" que o Lucas pediu.)
- **Provider:** quando o PC está online, aparecem ferramentas extras via um
  **relay** (`Aurora Mobile → Aurora Relay → Aurora Desktop`). "Abre o VS Code",
  "roda esse script", "faz um commit" → executados no PC, streaming de volta.
  Toda ação sensível passa pela governança do **ADR-0015** (aprovação, teto,
  corrigibilidade). **O thin-client atual (`aurora-mobile/`) é a semente deste
  canal** — não é descartado, é reposicionado como o módulo Provider/remote.

### 5. Distinção honesta: independência do PC ≠ independência da internet

Memória, RAG, notas e planner rodam local. O **LLM continua na nuvem**
(OpenRouter) por padrão — cognição 100% offline exigiria modelo on-device
(candidatos tipo LFM2-1.2B da `research/CAPACIDADES-AURORA.md`, muito limitados).
Registrar isso evita prometer o que a plataforma não dá.

### 6. Stack Android — DECIDIDO (2026-07-29): React Native/Expo + `@aurora/core`
- ✅ Reaproveita todo o investimento TS (o Core é TS puro; roda no Hermes).
- ✅ App nativo de verdade (câmera, notificações, biometria, widgets via libs RN).
- ✅ Um Core, duas UIs — sem duplicar persona/prompts/retrieval.
- ⚠️ Exige extrair o Core do acoplamento a `fs`/Git (trabalho da fase 1).

**Alternativas consideradas:**
- **nodejs-mobile** (embutir Node no APK): reaproveita até o `fs`, mas APK gordo
  (~+40–80MB), módulos nativos (sqlite) por ABI, build complexo. Rejeitado como
  padrão; reavaliar só se o custo de portar o Core provar-se alto demais.
- **Flutter (Dart):** ótima UX, mas **joga fora o Core TS** — contradiz a decisão 1.
- **Ficar no PWA/thin-client:** entrega hoje, mas é só o modo Provider — não é a
  independência pedida. Serve como ponte, não como destino.

### 7. Linguagem do Core: TypeScript (Go/Rust não entram no núcleo)

O gargalo da Aurora é **I/O de LLM** (~1–3s por turno), não CPU: o retrieval
sobre o vault pessoal (dezenas–centenas de notas) custa ~ms. Reescrever o núcleo
em Go/Rust otimizaria o que o usuário **não sente** e quebraria o pilar da
decisão 1 (um Core em TS rodando em Node **e** em RN/Hermes — mesma linguagem nos
dois lados). Uma linguagem nativa entra **cirúrgica**, nunca como o núcleo:

- **Rust para inferência on-device** (candle/llama.cpp) SE/quando houver modelo
  local — um plugin, não o Core.
- **Tauri (Rust) para o shell desktop** como alternativa ao Electron (RAM/boot),
  sem trocar a linguagem do Core (frontend segue web/JS).
- **Go para o backend de sync/relay** (Frente 3/7, "Aurora Relay") se virar
  serviço — backend, não cliente.

Regra: não trocar a linguagem do cérebro por performance que não é gargalo;
trocar a casca (Tauri) e adicionar músculo nativo (Rust) só onde CPU for gargalo
real — hoje, lugar nenhum.

## Roadmap faseado (honesto — isto é semanas, não uma sessão)

- **Fase 0 — ✅ feita:** thin-client (`aurora-mobile/`) = semente do modo Provider
  + ponte pra rodar no celular hoje (via túnel; chave no aparelho).
- **Fase 1 — extrair `@aurora/core`:** mover persona/prompts/retrieval/reflexão
  pra um pacote TS plataforma-agnóstico com `VaultStore`/`LLMProvider` por
  interface; **o desktop passa a consumir o Core** (prova a fronteira, zero
  regressão). É a fase que destrava todo o resto.
- **Fase 2 — app Android (RN/Expo):** consome `@aurora/core` com `VaultStore`
  local (SQLite); chat standalone + memória local funcionando sem o PC.
- **Fase 3 — sync + plugins Android:** sync vault desktop↔android; voz,
  notificações, câmera.
- **Fase 4 — Provider/Remote Control:** relay PC-como-provider (evolui o
  thin-client), sob governança do ADR-0015.

## Limitações conhecidas / riscos

- **A fronteira de storage é o risco nº1:** o vault é Markdown+Git (bom pra
  auditoria/versionamento, ruim pra mobile). Sync markdown↔SQLite com resolução
  de conflito é trabalho real, não trivial.
- **Reescrita parcial inevitável:** partes `fs`-bound do `noesis-mcp` precisam de
  adaptador; a matemática (retrieval, reflexão) porta direto.
- **Escopo:** a lista "tudo local" (câmera, widgets, bluetooth…) é grande; a Fase
  2 deve entregar o 80/20 (chat + memória local) antes de plugins.

## Consequências

- Este ADR **redireciona** `aurora-mobile/` de "cliente principal" para "modo
  Provider + ponte", e cria o conceito de `@aurora/core` como fonte única de
  lógica (estende o princípio do ADR-0004, que já fez isso pra identidade visual).
- Alimenta o rewrite do README/estado (a direção multiplataforma passa a ser
  parte declarada dos objetivos do projeto).
- Stack Android **decidido** (§6): React Native/Expo + `@aurora/core`. Fase 1
  (extração do Core) iniciada — primeiro módulo: persona/prompts.
