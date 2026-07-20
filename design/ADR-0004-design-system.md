---
id: adr-0004
type: decision
version: 1.0.0
status: accepted
created: 2026-07-20
confidence: 0.7
mutable_by_system: never
supersedes: none
---

# ADR-0004 — Design system vivo e identidade visual agnóstica de usuário

## Contexto

O Aurora Desktop v0 (`aurora-desktop/`, `decisions/ADR-0003-aurora-desktop.md`)
nasceu com uma paleta e tipografia definidas diretamente no código
(`src/renderer/AuroraApp.tsx`, objeto `C`), herdadas do protótipo original
(`aurorav0.jsx`). Isso funciona para uma interface, mas o projeto já prevê
mais de uma (Aurora Desktop, extensão VS Code, celular — `README.md` §4.6):
sem uma fonte única de verdade, cada interface nova reinventaria cor e
tipografia por conta própria, com risco real de divergência visual entre
elas ao longo do tempo.

Ao mesmo tempo, `decisions/ADR-0001-persona-como-dado.md` já estabeleceu a
fronteira entre SELF-MODEL (quem a Aurora é) e USER-MODEL (quem o usuário
é) para a camada de dados/persona. Essa fronteira nunca tinha sido
declarada explicitamente para a camada visual — havia risco de a
identidade visual do produto absorver, sem querer, contexto pessoal do
primeiro usuário (Lucas, eletrônica/maker) como se fosse identidade da
marca.

## Decisão

### 1. `design/tokens.md` é a fonte única de verdade visual

Cor, tipografia e princípios visuais do produto Aurora vivem em
`design/tokens.md`, versionado como qualquer outra nota do vault. Qualquer
interface implementa a partir desses tokens; nenhuma interface define
paleta ou tipografia independentemente. O objeto `C` hardcoded em
`aurora-desktop/src/renderer/AuroraApp.tsx` é o estado atual (v0,
implementação única) — uma tarefa futura de código deve extraí-lo para um
módulo de tokens compartilhado que leia de `design/tokens.md` (ou de um
artefato gerado a partir dele), mas isso não bloqueia o v0.

### 2. Fases futuras do design system

- **Fase atual (v0):** tokens documentados em Markdown (`design/tokens.md`),
  consumidos manualmente por cada interface.
- **`ui-kit` (fase 2):** biblioteca de componentes React reutilizável
  (botões, chips, bolhas de chat, tabs) implementando os tokens uma única
  vez, consumida por todas as interfaces — só quando houver uma segunda
  interface real pedindo os mesmos componentes (mesmo princípio de "nunca
  construir antes da dor real" de `ADR-0002-interfaces.md`).
- **Figma tokens (fase 3):** export/sincronização dos tokens para Figma
  (ex.: via Tokens Studio) quando design deixar de ser só o próprio Lucas
  codificando — útil para colaboração ou handoff, não antes disso.

### 3. Identidade visual é genérica por padrão

A identidade visual da Aurora **não carrega identidade do criador**. Ela é
agnóstica de usuário por design: os mesmos tokens servem qualquer pessoa
que venha a usar o produto, e nenhum princípio de design em
`design/tokens.md` referencia o domínio pessoal/profissional de um usuário
específico. O que é pessoal (por exemplo, o contexto de eletrônica/maker de
Lucas) vive exclusivamente no USER-MODEL dele
(`user-model/skills/eletrônica-reparo.md` etc.) — nunca na camada de marca
ou na persona do produto. Isso estende à camada visual a mesma fronteira
que `ADR-0001` já tinha estabelecido entre persona e USER-MODEL: a
identidade da Aurora emerge do uso e da evidência, não é herdada do
primeiro usuário que a construiu.

## Consequências

**Positivas:**
- Uma nova interface (extensão VS Code, celular) só precisa ler
  `design/tokens.md` para ficar visualmente consistente com o Aurora
  Desktop, sem arqueologia de código.
- A separação persona/produto vs. usuário fica auditável também na camada
  visual, não só na de dados — reforça o princípio central do projeto
  (Aurora é dado que evolui por evidência, não uma casca em torno da vida
  de uma pessoa só).
- Documentar antes de abstrair em código evita investir em `ui-kit`/Figma
  antes de existir uma segunda interface real que justifique o custo.

**Negativas / riscos:**
- Enquanto `design/tokens.md` e `aurora-desktop/src/renderer/AuroraApp.tsx`
  forem duas fontes fisicamente separadas (Markdown vs. código), existe
  risco de desalinhamento se um dos dois for editado sem o outro — mitigado
  por `design/tokens.md` ser a fonte de verdade declarada: qualquer diff de
  cor no código deve ser retroativamente refletido lá.
- Os nomes `phosphor`/`copper` continuam evocando um vocabulário de
  materiais; a decisão não os renomeia (ver `design/tokens.md`), apenas
  proíbe que a narrativa de design os amarre a um domínio técnico
  específico daqui pra frente.

## Alternativas rejeitadas

- **Extrair já um pacote `ui-kit` em código:** rejeitado por não haver
  ainda uma segunda interface consumindo os mesmos componentes — repetiria
  o erro de over-engineering já identificado como risco nº1 do roadmap em
  `ADR-0002-interfaces.md`.
- **Integrar Figma antes de ter tokens estáveis em texto:** rejeitado —
  sincronizar uma ferramenta externa com uma paleta que ainda pode mudar
  (v0) geraria retrabalho sem benefício, já que hoje não há colaborador de
  design além do próprio Lucas.
- **Deixar a paleta implícita apenas no código:** rejeitado porque
  contradiz o princípio do vault de que decisões de identidade (visual ou
  não) são notas auditáveis, não side-effects silenciosos de uma
  implementação.
