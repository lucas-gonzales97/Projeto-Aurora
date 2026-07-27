# Pesquisa — Design & arquitetura de produto dos apps de IA de referência

> Síntese para embasar o design system e a arquitetura de superfícies da **Aurora**
> (Projeto NOESIS / LCA). Foco: navegação, layout, componentes, cor/tipografia,
> motion, comunicação de estado, e diferenças desktop↔mobile.
>
> **Data:** 2026-07-24
> **Método / caveat:** fontes majoritariamente independentes (teardowns de UX,
> imprensa de produto), não docs oficiais. Recursos marcados "em teste" estão em
> A/B rollout e podem não estar em GA. Sem números de performance oficiais exceto
> os tokens de motion do Linear, extraídos direto do CSS do produto. Onde uma
> fonte estava desatualizada, corrigi e sinalizei.

---

## Tabelas por produto

### 1. Claude (Anthropic)

| Dimensão | O que faz |
|---|---|
| **Navegação / superfícies** | Layout de duas colunas: sidebar (conversas + **Projects**) à esquerda, thread central à direita. Chat e **Cowork** foram fundidos numa **Home** compartilhada; o seletor de modo está **saindo da barra de prompt e indo pro topo da janela** (em teste) — espelhando o ChatGPT após a fusão do Codex. Projects sendo testado na sidebar, acima das conversas recentes, com pin/sort. |
| **Layout** | Thread conversacional central ladeada por sidebar de gestão de sessão. **Artifacts** abrem em painel editor de tamanho cheio, separado do chat. |
| **Componentes** | Artifacts (código/web em painel próprio), outline/sumário no topo de respostas longas pra pular seções, blocos de código, mensagens rotuladas "You"/"Claude" com timestamp. |
| **Cor / tipografia** | Estética deliberadamente contida — preto/branco (+ dark mode), roxo só em logo/spinners, pra o conteúdo dominar. |
| **Motion / estado** | Animação de reticências (…) indica "pensando". |
| **Desktop vs mobile** | Existe Claude Desktop e o **Claude Code desktop app redesenhado** (+ "Routines") — *corrige o dado desatualizado da IntuitionLabs que dizia "sem app desktop nativo"*. Mobile iOS/Android com voz (transcrição+sumário), acesso offline a chats recentes, trava biométrica. |

Fontes: [TestingCatalog](https://www.testingcatalog.com/anthropic-tests-new-placement-for-projects-on-claude-desktop/) · [IntuitionLabs](https://intuitionlabs.ai/articles/conversational-ai-ui-comparison-2025) · [VentureBeat (Claude Code + Routines)](https://venturebeat.com/orchestration/we-tested-anthropics-redesigned-claude-code-desktop-app-and-routines-heres-what-enterprises-should-know)

### 2. ChatGPT / Codex (OpenAI)

| Dimensão | O que faz |
|---|---|
| **Navegação / superfícies** | Modelo estável desde 2022: campo central + sidebar colapsável de threads (histórico em scroll infinito, chats fixáveis). **Codex foi dobrado dentro do ChatGPT (9/jul)**, com o seletor de modo no canto superior esquerdo. |
| **Layout** | Minimalista, "distraction-free". **Canvas** (fim 2024): whiteboard visual pra organizar texto/código/imagens espacialmente, fora do fluxo linear do chat. |
| **Componentes** | Blocos de código monoespaçados com syntax highlight + botão copiar; **suggestion chips** abaixo do input; Projects pra organização. |
| **Cor / tipografia** | Não documentado em detalhe nas fontes (limpo/neutro). |
| **Motion / estado** | Streaming padrão de resposta; avisa se o input excede capacidade, mas sem medidor de tokens visível. |
| **Modos** | Seletor **Auto / Fast / Thinking** (GPT-5.2) direto na UI + menu de modelos no topo do chat. |
| **Desktop vs mobile** | Desktop: app Windows oficial + web, sidebars fixáveis. Mobile: menu colapsável, botão de microfone, voz em tempo real com screen-share, sync entre dispositivos. |

Fontes: [IntuitionLabs](https://intuitionlabs.ai/articles/conversational-ai-ui-comparison-2025) · [925 Studios — ChatGPT interface breakdown](https://www.925studios.co/blog/chatgpt-interface-design-breakdown) · [TestingCatalog](https://www.testingcatalog.com/anthropic-tests-new-placement-for-projects-on-claude-desktop/)

### 3. Perplexity

| Dimensão | O que faz |
|---|---|
| **Navegação / superfícies** | Threads multi-turno; abas **Answer / Links / Images** ao lado da resposta pra trocar de modalidade sem re-perguntar. |
| **Layout** | Resposta estruturada (headings, bullets) + **sidebar de fontes que mantém a resposta visível** enquanto o usuário audita as referências (sem troca de página cheia). |
| **Componentes** | **Chips de citação numerados** ao fim de cada afirmação, mostrando domínio + favicon (você reconhece a fonte antes de clicar); padrão **`+N`** comunica múltiplas fontes por afirmação sem poluir a frase; lista de fontes expansível. |
| **Cor / tipografia** | Foco em legibilidade de resposta densa; não detalhado nas fontes. |
| **Motion / estado** | Renderização mobile-otimizada de saídas RAG com preview de link. |
| **Desktop vs mobile** | App mobile com captura de voz, threads multi-turno, sync cross-device; a mesma lógica de "fontes ao lado, resposta preservada". |

Fontes: [AI UX Playground — Perplexity citations teardown](https://aiuxplayground.com/teardowns/perplexity/citations/) · [ShapeOfAI — Citations pattern](https://www.shapeof.ai/patterns/citations) · [ToolkitByAI — Perplexity mobile review 2025](https://toolkitbyai.com/perplexity-mobile-app-complete-review-2025/)

### 4. Notion AI

| Dimensão | O que faz |
|---|---|
| **Navegação / superfícies** | IA **inline no documento**, não app de chat separado. Dois paletas: **`/`** abre o command palette geral (blocos, DBs, embeds); **espaço** abre o palette só de comandos de IA (generate/edit/draft, agrupados). |
| **Layout** | Tudo é **bloco**: distinção entre inline (link simples no texto via `+`/`[[`) e full-page block (`/page`, ocupa a linha inteira). |
| **Componentes** | Command palette como componente central; blocos como unidade atômica; IA "aterrissa" no conteúdo existente. |
| **Filosofia** | Slash commands não são sobre economizar teclas — são sobre **descoberta**: o usuário aprende o que a IA faz navegando o menu. |

Fontes: [eesel — Notion AI Inline guide 2025](https://www.eesel.ai/blog/notion-ai-inline) · [Medium — Command Palette UX Patterns](https://medium.com/design-bootcamp/command-palette-ux-patterns-1-d6b6e68f30c1)

### 5. Cursor (editor de IA — referência p/ superfície "Code")

| Dimensão | O que faz |
|---|---|
| **Navegação / superfícies** | **Cursor 2.0** virou "agent workbench": agents, plans e runs são **objetos de primeira classe na sidebar**, com a conversa e os diffs no centro. Deixou de ser "VS Code com IA". |
| **Layout** | Composer faz **edições multi-arquivo coordenadas** e apresenta diffs pra revisão **antes de aplicar**; novo sistema de posicionamento de painéis. |
| **Componentes** | Diff view por arquivo com **accept/reject por mudança**; plano gerado antes da execução; loop visual (ajuste de estilo) + loop de código (hot reload). |
| **Estado** | O design mantém o dev focado no **processo de revisão do diff** como a ação central. |

Fontes: [Prismic — Cursor AI review 2026](https://prismic.io/blog/cursor-ai) · [Cursor — Product](https://cursor.com/product) · [Builder.io — Cursor Design Mode](https://www.builder.io/blog/cursor-design-mode-visual-editing)

### 6. Linear (referência de design system / motion)

*Não é app de IA, mas é o padrão-ouro citado em toda a literatura de UX de produto rápido.*

| Dimensão | O que faz |
|---|---|
| **Motion (tokens reais do CSS)** | `highlightFadeIn: 0s` · `highlightFadeOut: .15s` · `quick: .1s` · `regular: .25s` · `slow: .35s`. Defaults **deliberadamente mais curtos** que Material (200ms) e iOS (~350ms). |
| **Timing assimétrico** | Hover, popovers e o painel de agente **aparecem instantaneamente** ao serem chamados e **somem em 150ms** ao dispensar. |
| **O que anima vs. não** | Anima só GPU-safe: `transform`, `opacity`, `background-color`, `border-color`, `color`. **Nunca** `width/height/margin/padding/top/left` (forçam reflow). |
| **Teclado-first** | Atalho de 1 letra p/ ações frequentes, 2 letras p/ navegação, modificadores globais; **command palette `⌘K`** buscando dados **em memória local** (zero request ao servidor). |
| **Estado** | **UI otimista**: mutação atualiza estado local na hora, rollback só se falhar validação. **Sem spinners** pra mudança local; loading só quando inevitável — "esconde os requests de rede do usuário". |

Fonte: [performance.dev — How is Linear so fast](https://performance.dev/how-is-linear-so-fast-a-technical-breakdown)

### Bônus — Gemini (Google)

Material Design (branco, Google Sans, azul), presente como **overlays/sidebars integrados** nos apps Google em vez de app de chat standalone; "Deep Research" mostra a IA "pensando em estágios" antes da resposta compilada com citações. Fonte: [IntuitionLabs](https://intuitionlabs.ai/articles/conversational-ai-ui-comparison-2025).

---

## Padrões recorrentes (candidatos a princípio de design da Aurora)

1. **Thread central + sidebar de sessões** é o esqueleto quase universal (Claude, ChatGPT, Perplexity, Llama-likes). É o default que o usuário já sabe ler — a Aurora já segue isso.
2. **Seletor de modo migrando pro topo da janela.** Tanto Claude quanto ChatGPT tiraram o switch de modo da barra de prompt e levaram pro canto superior — convergência quando um produto tem múltiplas superfícies (Chat/Cowork/Code). Relevante direto pras abas Conversa/Mente/Painel/Automações/Config.
3. **Saída de trabalho sai do chat pra um painel próprio.** Artifacts (Claude), Canvas (ChatGPT), diffs do Composer (Cursor): quando a IA *produz* algo, vai pra um painel lateral/dedicado, não fica preso no scroll linear. O cockpit "Mente" (grafo ao lado do chat) já é uma variação disso.
4. **Command palette como órgão de descoberta.** `⌘K` (Linear), `/` e espaço (Notion). Não é atalho pra experts — é como o usuário *descobre capacidades*. Casaria com a Frente 8 (habilidades emergentes) da Aurora.
5. **Motion curto e assimétrico.** Entrada instantânea, saída suave (~150ms), só propriedades GPU-safe. É o que faz parecer "rápido".
6. **Transparência de proveniência.** Chips de fonte do Perplexity (`+N`, domínio+favicon). A Aurora tem análogo forte: os nós do grafo acendendo no retrieval já *são* a proveniência ("por que ela disse isso") — vale formalizar como componente.
7. **Estado por ausência de spinner.** Os melhores (Linear) escondem a rede; comunicam "pensando" com sinal mínimo (reticências do Claude), não barras de progresso.

## Diferenciais (o que cada um faz de único)

- **Claude** — Artifacts como painel de produção separado + a ideia de **superfícies nomeadas** (Chat/Cowork/Code) sob uma Home. Estética contida de propósito.
- **ChatGPT** — Canvas espacial (quebra o chat linear) + seletor cognitivo explícito (**Auto/Fast/Thinking**) exposto na UI.
- **Perplexity** — **citação-forward**: o produto inteiro é organizado ao redor de proveniência escaneável e auditável sem sair da resposta.
- **Notion AI** — IA **dentro do documento/bloco**, não em janela de chat; dois paletas (geral vs. IA) que ensinam capacidade por navegação.
- **Cursor** — **agent workbench**: agents/plans/runs como objetos de primeira classe; a ação central é *revisar o diff*, não conversar.
- **Linear** — o benchmark de **percepção de velocidade**: motion tokenizado, UI otimista, teclado-first sobre dados em memória.

---

## Ponte para a Aurora (leitura estratégica)

- A Aurora já acertou o esqueleto (thread + abas, cockpit Mente = painel de produção). O gap vs. os líderes está em **três eixos**: (a) **proveniência como componente de primeira classe** — transformar os nós que acendem num equivalente aos chips do Perplexity, respondendo "por que ela disse isso"; (b) **command palette** como órgão de descoberta de capacidades (liga na Frente 8); (c) **motion tokenizado** ao estilo Linear (curto, assimétrico, GPU-safe) pra sensação de velocidade.
- A convergência do **seletor de modo no topo** valida a decisão de tratar Conversa/Mente/Painel/Automações/Config como superfícies nomeadas — e sugere padronizar esse switch no header, não na barra de input.
- O padrão **"trabalho produzido vai pra painel dedicado"** é um princípio a carregar pras futuras superfícies Code (extensão VS Code, Frente 9) e Cowork/Automações.

## Fontes consolidadas

- [TestingCatalog — Projects placement no Claude Desktop](https://www.testingcatalog.com/anthropic-tests-new-placement-for-projects-on-claude-desktop/)
- [IntuitionLabs — Conversational AI UI comparison 2025](https://intuitionlabs.ai/articles/conversational-ai-ui-comparison-2025)
- [VentureBeat — Claude Code desktop redesign + Routines](https://venturebeat.com/orchestration/we-tested-anthropics-redesigned-claude-code-desktop-app-and-routines-heres-what-enterprises-should-know)
- [925 Studios — ChatGPT interface design breakdown](https://www.925studios.co/blog/chatgpt-interface-design-breakdown)
- [AI UX Playground — Perplexity citations teardown](https://aiuxplayground.com/teardowns/perplexity/citations/)
- [ShapeOfAI — Citations pattern](https://www.shapeof.ai/patterns/citations)
- [ToolkitByAI — Perplexity mobile review 2025](https://toolkitbyai.com/perplexity-mobile-app-complete-review-2025/)
- [eesel — Notion AI Inline guide 2025](https://www.eesel.ai/blog/notion-ai-inline)
- [Medium — Command Palette UX Patterns](https://medium.com/design-bootcamp/command-palette-ux-patterns-1-d6b6e68f30c1)
- [Prismic — Cursor AI review 2026](https://prismic.io/blog/cursor-ai)
- [Cursor — Product](https://cursor.com/product)
- [Builder.io — Cursor Design Mode](https://www.builder.io/blog/cursor-design-mode-visual-editing)
- [performance.dev — How is Linear so fast](https://performance.dev/how-is-linear-so-fast-a-technical-breakdown)
