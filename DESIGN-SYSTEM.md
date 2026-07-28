---
id: design-system
type: meta
status: active
created: 2026-07-27
depends_on: [design-tokens, adr-0004]
---

# DESIGN-SYSTEM — Aurora

> Sistema de design proprietário da Aurora, a camada de interface do NOESIS.
> Estende `design/tokens.md` (fonte única de verdade da paleta/tipografia,
> ADR-0004) com **motion, componentes, grid e regras** que faltavam para dar
> consistência entre desktop e mobile. Não substitui os tokens existentes —
> formaliza o resto do sistema em volta deles.
>
> **Alimentado por** `research/PESQUISA-DESIGN-APPS-IA.md` (padrões recorrentes
> de Claude, ChatGPT, Perplexity, Notion AI, Cursor, Linear). Onde um padrão vem
> de lá, está citado.

---

## 0. Princípio central — "viva pelo comportamento, não pela decoração"

O brief pede uma Aurora que *pareça viva: autônoma, maleável, fluida, orgânica*.
O `tokens.md` (princípio 3) proíbe personificação — *"instrumento de raciocínio,
não mascote"*. **Não é contradição, e a resolução É o princípio central deste DS:**

> A vivacidade da Aurora se expressa por **movimento e estado**, nunca por
> avatar, rosto ou mascote. A interface parece viva porque **se comporta** como
> algo que pensa — respira quando ociosa, hesita quando processa, acende quando
> lembra — não porque desenha um personagem. Cognição visível, não caricatura.

Consequência operável, que rege todo o resto do documento:

- Tudo que representa **cognição da Aurora** (pensar, lembrar, streaming, ativar
  o grafo) usa **easing orgânico** e nunca linear (§2).
- Tudo que é **cromo de UI** (abrir painel, hover, foco) é rápido e mecânico
  (padrão Linear: entrada instantânea, saída ~150ms, só GPU — `research` §Linear).
- A expressão máxima do princípio já existe no produto: os **nós do grafo
  acendendo no retrieval** (aba Mente). O DS trata isso como o componente-âncora
  da identidade, não como um extra.
- **Materialmente**, a vivacidade é **vidro + luz que flui + líquido** (§2.5):
  superfícies translúcidas que deixam as camadas transparecerem, um brilho
  phosphor→copper que **deriva** devagar atrás da cognição, e transições que
  **transformam** em vez de trocar seco. Volátil e fluido, quase líquido — mas
  de baixa amplitude, nunca agitado. A translucidez também *diz* algo verdadeiro:
  uma identidade **em formação** (tokens.md), não uma caixa opaca e pronta.

---

## 1. Identidade visual

### 1.1 Paleta (herdada de `design/tokens.md` — reproduzida como referência, não redefinida)

| token | hex | papel |
|---|---|---|
| `--bg` | `#0C1517` | fundo da aplicação |
| `--surface` | `#122023` | superfície de conteúdo (bolha, card) |
| `--surface-raised` | `#18292D` | elevada (ativo, bolha do usuário, hover) |
| `--border` | `#23393D` | hairline divisória |
| `--phosphor` (accent-primary) | `#8FDDBE` | **cognição ativa agora** (progresso, atenção, processando) |
| `--copper` (accent-secondary) | `#C98B5F` | **ação e evidência** (clicável, provado, com peso no grafo) |
| `--bone` (text-primary) | `#E7E2D6` | texto principal |
| `--dim` (text-secondary) | `#8FA3A0` | metadado, legenda, timestamp |
| `--danger` | `#D97B6C` | erro/alerta, com parcimônia — nunca cor de marca |

**Regra de cor herdada (não-negociável):** cor é sinal, não decoração. `phosphor`
= o que a Aurora está fazendo *agora*; `copper` = o que tem peso/ação/evidência.
Nenhuma cor preenche espaço.

### 1.2 Tipografia (herdada)

- **Display — Sora** (400/600/700): marca, títulos, navegação. A voz com que a
  Aurora se apresenta.
- **Dados — IBM Plex Mono** (400/500): metadados, timestamps, chips de estado,
  proveniência. A leitura precisa do que ela sabe.

Escala tipográfica (nova — faltava): `--fs-xs 10` · `--fs-sm 11.5` · `--fs-body
14` · `--fs-lg 16` · `--fs-title 20` · `--fs-display 28`. Linha: 1.45 corpo,
1.2 títulos.

---

## 2. Motion language (o coração deste DS)

Fundamentação: percepção de velocidade do Linear (`research`) — durações curtas,
timing **assimétrico**, **só propriedades GPU-safe** (`transform`, `opacity`,
`color`, `background-color`, `border-color`; **nunca** `width/height/margin/top/
left`). Sobre essa base, a Aurora adiciona **duas vozes de easing**:

| easing | curva | usado em |
|---|---|---|
| `--ease-mechanical` | `cubic-bezier(0.2, 0, 0, 1)` | cromo de UI: painéis, hover, foco, tabs |
| `--ease-organic` | `cubic-bezier(0.34, 1.2, 0.64, 1)` | **cognição da Aurora**: pensar, acender nó, streaming, revelar reflexão — leve overshoot = "vivo" |
| `--ease-exit` | `cubic-bezier(0.4, 0, 1, 1)` | saídas (fade-out, dismiss) |

Durações: `--dur-instant 0ms` · `--dur-quick 120ms` · `--dur-base 200ms` ·
`--dur-slow 340ms` · `--dur-breath 2600ms` (ciclo de respiração do ocioso).

**Regras de motion (testáveis):**
1. Entrada de cromo é **instantânea ou ≤120ms**; saída é `--dur-quick` com
   `--ease-exit`. (assimetria do Linear)
2. Qualquer elemento que represente cognição da Aurora usa **`--ease-organic`** e
   **jamais** `linear`. Um `transition-timing-function: linear` num indicador de
   pensamento é bug de identidade.
3. **Sem spinner** para estado local. "Pensando" é respiração/pulso em phosphor
   (§4.3), não um spinner genérico. (padrão "estado por ausência de spinner",
   `research`)
4. Nada anima propriedade que dispara reflow. Auditável no CSS.
5. `prefers-reduced-motion`: respiração e overshoot desligam; transições caem
   para opacity ≤120ms. Acessibilidade não é opcional.

---

## 2.5 Material — vidro, translucidez e líquido (a "cara moderna")

A camada material que traduz "vivo, volátil, quase líquido" em decisões concretas
— **com disciplina**, senão vira lentidão e texto ilegível.

- **Vidro:** superfícies **flutuantes** (overlays, sheets, painel de detalhe, tab
  bar, composer, header) usam `--glass-surface` (translúcido) + `backdrop-filter`
  (`--blur-glass`). As camadas por trás transparecem e desfocam — profundidade
  viva, não caixas opacas. Superfícies de **conteúdo** (bolha, card) permanecem
  sólidas para legibilidade.
- **Aurora viva (luz que flui):** um brilho `--aurora-glow` (gradiente
  `--phosphor`→`--copper` em baixa opacidade) que **deriva** lentamente
  (`--dur-drift`, `--ease-organic`) atrás da cognição — indicador de pensamento,
  nó ativo, header. É a "aurora boreal" da marca: presença viva, nunca estática.
  **Nunca roxo genérico** — é sempre phosphor/copper.
- **Líquido (transições que transformam):** trocas de estado importantes (mudar de
  modo, revelar reflexão, nó acender) usam **morph** — escala + opacity + leve
  blur transitório — em vez de troca seca. Streaming de texto ganha **shimmer**
  sutil percorrendo o texto novo. Superfícies de cognição têm um **respiro**
  contínuo (translate/scale ≤1px em `--dur-breath`): nunca parecem congeladas.
- **Volatilidade contida:** movimento constante, **baixa amplitude** — quase
  líquido, jamais agitado. Nada pisca nem salta.

**Guardas (obrigatórias):**
- **Legibilidade primeiro:** texto sempre sobre contraste suficiente. Sem
  `backdrop-filter` (`@supports not`), vidro cai para `--surface` opaco.
- **Mobile/performance:** `backdrop-filter` é caro — no máximo **1–2 camadas de
  vidro simultâneas** no mobile; **nunca** blur em lista longa que rola.
- **`prefers-reduced-motion`** desliga drift/shimmer/respiro (vira fade ≤120ms);
  **`prefers-reduced-transparency`** troca vidro por opaco.
- Continua valendo: **só GPU-safe** (`transform`/`opacity`/`filter`); nada de
  animar layout.

## 3. Design tokens (reutilizável)

Espaçamento (base 4): `--sp-1 4` · `--sp-2 8` · `--sp-3 12` · `--sp-4 16` ·
`--sp-6 24` · `--sp-8 32` · `--sp-12 48`.
Raio: `--r-notch 3` · `--r-sm 6` · `--r-md 12` · `--r-pill 999`.
> O **`--r-notch` (3px)** é assinatura da Aurora: as bolhas têm três cantos
> `--r-md` e **um canto `--r-notch`** apontando para a origem (usuário à direita,
> Aurora à esquerda). É o detalhe que já existe no código e vira token.
Elevação (UI escura = borda + leve lift, não sombra pesada):
`--elev-flat` (só `--border`) · `--elev-raised` (`--surface-raised` + `--border`)
· `--elev-glow` (sombra phosphor difusa — **exclusiva de cognição ativa**, ex.: nó
aceso).

```json
{
  "color": { "bg": "#0C1517", "surface": "#122023", "surfaceRaised": "#18292D",
    "border": "#23393D", "phosphor": "#8FDDBE", "copper": "#C98B5F",
    "bone": "#E7E2D6", "dim": "#8FA3A0", "danger": "#D97B6C" },
  "space": { "1":4, "2":8, "3":12, "4":16, "6":24, "8":32, "12":48 },
  "radius": { "notch":3, "sm":6, "md":12, "pill":999 },
  "font": { "display": "Sora", "data": "IBM Plex Mono",
    "size": { "xs":10, "sm":11.5, "body":14, "lg":16, "title":20, "display":28 } },
  "motion": {
    "dur": { "instant":0, "quick":120, "base":200, "slow":340, "breath":2600 },
    "ease": { "mechanical":"cubic-bezier(0.2,0,0,1)",
      "organic":"cubic-bezier(0.34,1.2,0.64,1)", "exit":"cubic-bezier(0.4,0,1,1)" }
  }
}
```

```css
:root{
  --bg:#0C1517; --surface:#122023; --surface-raised:#18292D; --border:#23393D;
  --phosphor:#8FDDBE; --copper:#C98B5F; --bone:#E7E2D6; --dim:#8FA3A0; --danger:#D97B6C;
  --sp-1:4px; --sp-2:8px; --sp-3:12px; --sp-4:16px; --sp-6:24px; --sp-8:32px; --sp-12:48px;
  --r-notch:3px; --r-sm:6px; --r-md:12px; --r-pill:999px;
  --dur-quick:120ms; --dur-base:200ms; --dur-slow:340ms; --dur-breath:2600ms; --dur-drift:20000ms;
  --ease-mechanical:cubic-bezier(0.2,0,0,1);
  --ease-organic:cubic-bezier(0.34,1.2,0.64,1);
  --ease-exit:cubic-bezier(0.4,0,1,1);
  /* material fluido (§2.5) */
  --glass-surface:rgba(18,32,35,0.72); --glass-raised:rgba(24,41,45,0.78);
  --blur-glass:blur(16px) saturate(1.2); --blur-heavy:blur(28px);
  --aurora-glow:radial-gradient(120% 120% at 30% 20%, rgba(143,221,190,0.16), rgba(201,139,95,0.10) 45%, transparent 70%);
}
@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){
  :root{ --glass-surface:var(--surface); --glass-raised:var(--surface-raised); }
}
@media (prefers-reduced-transparency:reduce){
  :root{ --glass-surface:var(--surface); --glass-raised:var(--surface-raised); }
}
```

---

## 4. Biblioteca de componentes (só o que tem uso hoje ou no mobile — constraint)

Cada componente: anatomia + estados. Sem código.

### 4.1 Composer (input de chat)
- **Anatomia:** campo de texto (Sora), botão de anexo, botão de microfone, botão
  Enviar (`--copper`), rodapé mono com motor/voz ativos.
- **Estados:** *default* · *focus* (borda `--phosphor`, `--ease-mechanical`) ·
  *com anexo* (thumb do arquivo acima) · *enviando* (Enviar vira estado busy) ·
  *erro* (mensagem acionável via `friendlyChatError`, nunca JSON cru).

### 4.2 Bolha de mensagem
- **Anatomia:** container `--surface` (Aurora) / `--surface-raised` (usuário),
  borda-esquerda `2px --copper` na Aurora, cantos `--r-md` + `--r-notch` na
  origem, corpo `--bone`, **timestamp `--dim` mono abaixo** (temporalidade,
  commit `38dcacd`), imagem inline opcional.
- **Estados:** *default* · *streaming* (texto aparece com `--ease-organic`) ·
  *opção clicável* (§4.6) · *erro*.
- **Separador de dia:** hairline + rótulo mono central ("Hoje"/"Ontem"/data).

### 4.3 Indicador de pensamento
- **Anatomia:** rótulo mono "aurora está pensando…" + pulso em `--phosphor`.
- **Motion:** **respiração** — opacity 0.5↔1 em `--dur-breath` com
  `--ease-organic`, em loop. É a assinatura viva do princípio §0. **Nunca
  spinner.**
- **Estados:** *pensando* (respirando) · *executando ferramenta* (mesmo pulso +
  rótulo da ação, ex.: "consultando o grafo…") · *ocioso* (ausente).

### 4.4 Card de resultado de ferramenta (cowork/automações)
- **Anatomia:** cabeçalho com nome da ação + ícone de estado, corpo do resultado,
  rodapé com fonte/tempo. Borda `--copper` (é ação/evidência).
- **Estados:** *executando* (pulso) · *sucesso* · *erro* (borda `--danger`) ·
  *aguardando aprovação* (S0/S1 — botões confirmar/recusar; ADR-0015 E-3).

### 4.5 Nó do grafo (componente-âncora, aba Mente)
- **Anatomia:** dot colorido por tipo (vocabulário `graphVocab`), rótulo limpo,
  tamanho por relevância.
- **Estados:** *repouso* · *ativado no retrieval* (fundo `--phosphor` + `--elev-glow`,
  entra com `--ease-organic`, fade de volta em ~2s) · **emergido** (contorno
  tracejado — o que a Aurora concluiu sozinha, commit `38f3b12`) · *selecionado*
  (painel de detalhe).

### 4.6 Botão de opção numerada
- **Anatomia:** pill `--surface-raised`, texto `--phosphor` mono, extraído de
  respostas numeradas da Aurora. **Estados:** *default* · *hover* (`--ease-mechanical`)
  · *desabilitado* (durante busy).

### 4.7 Chip de proveniência (novo — padrão recorrente do `research`, estilo Perplexity)
- **Anatomia:** chip mono pequeno "por quê?" que revela as entidades do vault que
  ativaram a resposta (a caption "Aurora consultou: …" já existe). É a resposta
  visível para *"por que ela disse isso"*.
- **Estados:** *colapsado* (contagem) · *expandido* (lista de nós, cada um link
  para a aba Mente).

### 4.8 Navegação entre modos
- **Anatomia:** Conversa · Mente · Painel · Automações · Config.
- **Desktop:** barra no rodapé/topo da janela (o produto já usa rodapé; o
  `research` mostra Claude/ChatGPT movendo o seletor de superfície para o
  **topo** — candidato a alinhar na v1).
- **Mobile:** **tab bar inferior** (§5), rótulos curtos + ícone.
- **Estados:** *ativo* (indicador `--copper`) · *inativo* `--dim` · *com
  novidade* (ponto `--phosphor`, ex.: nó emergido novo na Mente).

---

## 5. Grid e layout — desktop vs. mobile (mesmos tokens, layout adapta)

| aspecto | Desktop | Mobile |
|---|---|---|
| **Estrutura** | duas colunas: thread + painel opcional. Aba Mente vira **cockpit split** (grafo + chat) em ≥900px (já implementado) | **coluna única**; o painel/grafo vira **tela cheia** ou **sheet** por cima, nunca split |
| **Navegação de modos** | barra topo/rodapé da janela | **tab bar inferior fixa** (polegar) |
| **Composer** | rodapé da coluna de chat | **docado no fundo**, acima da tab bar; anexo/mic acessíveis com o polegar |
| **Grafo (Mente)** | lado a lado com a conversa | tela cheia; toque no nó abre o detalhe como sheet |
| **Densidade** | confortável, multi-painel | uma tarefa por tela; proveniência (§4.7) colapsada por padrão |
| **Alvos de toque** | mouse (≥28px) | **≥44px** (guia de toque) |
| **Breakpoint** | ≥900px = split | <600px = mobile; 600–900 = tablet (coluna única larga) |

Regra: **os mesmos tokens e componentes**; muda o *arranjo*, nunca a identidade
(ADR-0004 — "adaptar layout, não identidade").

---

## 6. Do's and Don'ts

**Do**
- ✅ `--phosphor` só para cognição ativa agora; `--copper` só para ação/evidência.
- ✅ Easing orgânico (`--ease-organic`) em tudo que a Aurora "pensa".
- ✅ Mono (IBM Plex) para todo metadado, timestamp e proveniência.
- ✅ O canto-notch (`--r-notch`) apontando para a origem da fala.
- ✅ Estado por sinal mínimo (respiração, pulso), não por barra de progresso.
- ✅ Mesmos tokens em desktop e mobile; só o layout muda.
- ✅ Vidro nas superfícies **flutuantes**; conteúdo (bolha/card) permanece sólido.
- ✅ Gradiente `--aurora-glow` derivando **atrás** da cognição; movimento contínuo de baixa amplitude.
- ✅ Morph nas trocas de estado; shimmer no streaming — sempre GPU-safe.

**Don't**
- ❌ Gradiente roxo genérico de "app de IA" — o glow é phosphor→copper, nunca roxo.
- ❌ Inter / Arial / system-ui como fonte principal (Sora é a voz; mono é a leitura).
- ❌ `linear` em qualquer motion de cognição.
- ❌ Sombra pesada / drop-shadow decorativa (elevação é borda + lift; glow só em cognição).
- ❌ Avatar, rosto, mascote ou emoji-persona — vivacidade é comportamento (§0).
- ❌ Spinner genérico para estado local.
- ❌ Vidro sobre texto que prejudique contraste; >2 camadas de vidro ou blur em lista que rola no mobile.
- ❌ Movimento de alta amplitude, pisca-pisca ou salto brusco — é líquido, não agitado.
- ❌ Redefinir cor/tipografia numa interface nova em vez de ler estes tokens (ADR-0004).

---

## 7. Roadmap — App Mobile da Aurora

**Status:** planejado, depende deste Design System (tokens/componentes/motion já
cobrem mobile — §5).
**Motivação:** maior ganho de interação — Aurora fora do desktop, no celular.

**Pré-requisitos:**
- [x] Design System cobrindo mobile (este doc)
- [ ] Stack do app mobile (nativo vs. wrapper vs. PWA) — a decidir (Frente 7 da
  agenda cita React Native/Expo como candidata)
- [ ] `noesis-mcp` exposto de forma acessível a um client mobile (ver Frente 3/7
  — sync local-first)

**Escopo v0:** chat com Aurora usando os componentes deste DS · sincronização com
o grafo (LCA) via MCP · sem paridade total — priorizar chat antes de cowork/code
no mobile.

---

## 8. Estado de implementação (honesto)

Já existe no código (`aurora-desktop`): paleta, tipografia, bolhas com notch,
timestamp/separador de dia, indicador de pensamento, nó do grafo com emergido,
opções numeradas, navegação de modos, cockpit split. **Falta formalizar:** os
tokens de motion como variáveis reais (hoje são valores soltos), o chip de
proveniência (§4.7) como componente, e o `ui-kit` compartilhado (ADR-0004 fase 2)
— que só se justifica quando o app mobile pedir os mesmos componentes.
