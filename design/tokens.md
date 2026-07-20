---
id: design-tokens
type: meta
status: active
created: 2026-07-20
---

# Tokens de design — Aurora v0

> Fonte única de verdade dos tokens visuais do produto Aurora. Qualquer
> interface (Aurora Desktop hoje; web, extensão ou mobile no futuro) consome
> destes tokens — não redefine cor, tipografia ou princípio visual por conta
> própria. Ver `design/ADR-0004-design-system.md` para a decisão que
> formaliza isso.

## Por que estes tokens (a narrativa, não a paleta)

A identidade visual da Aurora não representa um usuário, uma profissão ou um
domínio de conhecimento específico. Ela representa três coisas: uma
**identidade em emergência** (a persona ainda está se formando — ver
`AURORA-PERSONA.md` §5), uma **cognição em formação** (o produto mostra que
está processando, não finge onisciência instantânea) e um **produto de IA
agnóstico de usuário** (o mesmo sistema visual precisa servir qualquer
pessoa que venha a usar a Aurora, não só quem o desenhou primeiro). Os
nomes dos tokens de destaque (`phosphor`, `copper`) vêm de um vocabulário de
materiais e persistem por identidade de marca já estabelecida — mas nenhuma
narrativa de design a partir daqui deve amarrar esses nomes a um domínio
técnico específico (eletrônica, hardware, bancada). O que eles comunicam é
abstrato: sinal computável e ação/evidência, não um objeto físico.

## Paleta de cores

| token | hex | papel semântico |
|---|---|---|
| `bg` | `#0C1517` | Fundo da aplicação — campo profundo e quieto onde o conteúdo repousa. |
| `surface` | `#122023` | Superfície de conteúdo — cards, bolhas de mensagem, blocos de informação. |
| `surface-raised` | `#18292d` | Superfície elevada — estado ativo/selecionado, bolha do usuário, hover. |
| `border` | `#23393d` | Linha divisória (hairline) — separa sem competir com o conteúdo. |
| `accent-primary` / `phosphor` | `#8FDDBE` | Destaque primário — sinaliza o que está computacionalmente ativo agora: progresso, atenção, processamento em curso. |
| `accent-secondary` / `copper` | `#C98B5F` | Destaque secundário — marca ação e evidência: o que é clicável, o que foi provado, o que tem peso no grafo. |
| `text-primary` / `bone` | `#E7E2D6` | Texto principal — máxima legibilidade sobre `bg`/`surface`. |
| `text-secondary` / `dim` | `#8FA3A0` | Texto secundário — metadado, legenda, contexto de apoio. |
| `text-danger` | `#D97B6C` | Estado de erro/alerta — usado com parcimônia, nunca como cor de marca. |

## Tipografia

| papel | fonte | uso |
|---|---|---|
| Display | **Sora** (400/600/700) | Nome da marca, títulos, rótulos de navegação — a "voz" visual da interface. |
| Dados | **IBM Plex Mono** (400/500) | Metadados, timestamps, chips de estado, qualquer leitura que se beneficie de alinhamento monoespaçado — a "leitura" precisa da interface. |

Esse par (uma display humanizada + uma mono técnica) existe para separar
duas vozes na mesma tela: a Sora fala como a Aurora se apresenta; a Plex
Mono mostra o que ela sabe, com precisão, sem dramatizar.

## Princípios visuais

1. **Escuro é foco, não estética.** O fundo profundo existe para reduzir
   ruído visual e manter a atenção no conteúdo — não é uma escolha de
   "modo dark" decorativo.
2. **Cor é sinal, não decoração.** Cada cor de destaque tem um significado
   funcional fixo (o que está ativo vs. o que é ação/evidência); nenhuma
   cor é usada só para preencher espaço.
3. **A interface se comporta como instrumento de raciocínio, não como
   mascote.** Ela mostra estado (pensando, ocioso, com evidência) da mesma
   forma discreta como mostraria qualquer outro dado — sem personificação
   visual forçada.
4. **A identidade é declaradamente inacabada.** Assim como o auto-modelo da
   Aurora (`AURORA-PERSONA.md` §5), o sistema visual é v0: versionado,
   revisável, sem pretensão de estar "pronto".
5. **Nenhum token carrega contexto de um usuário específico.** A paleta,
   a tipografia e os princípios acima valem para qualquer pessoa que use a
   Aurora — o que é pessoal vive no USER-MODEL de cada usuário, nunca no
   sistema visual do produto (ver `design/ADR-0004-design-system.md`).
