---
id: adr-0008
type: decision
version: 1.0.0
status: accepted
created: 2026-07-22
confidence: 0.65
mutable_by_system: never
supersedes: none
---

# ADR-0008 — Vault por instalação (empacotado) + noesis-mcp sem depender de Python

## Contexto

Testando o instalador de verdade (`Aurora Setup 0.1.0.exe`) pela primeira
vez com uma instalação real — não o `npx electron .` de dev — o onboarding
completou uma conversa inteira (nome, salário, cargo/CBO, localização,
sonhos) e, na conversa seguinte, a Aurora não lembrava de nada disso.
Investigado ao vivo, achamos três bugs empilhados, todos pré-existentes
(nenhum introduzido nesta sessão), todos invisíveis em dev porque `npx
electron .` roda de dentro da árvore fonte, onde as suposições de caminho
por acaso batem:

1. **`noesis-mcp/` não vai no instalador.** `electron-builder` só empacota
   `dist/**/*` de `aurora-desktop/` — nada do `noesis-mcp/` sequer existe
   dentro de `Program Files\Aurora\`.
2. **`VAULT_ROOT` assume estrutura de árvore fonte.** `path.resolve(__dirname,
   "../../..")`, calculado a partir de `dist/main/index.js`, resolve pra
   dentro de `Program Files\Aurora\` no app empacotado — que (a) não tem
   vault nenhum lá e (b) normalmente não é gravável sem admin de qualquer
   forma.
3. **`create_note`/`create_relation` exigiam Python 3** (`scripts/
   validate_frontmatter.py`, chamado via `execFile("python3", ...)`) — sem
   Python 3 instalado, toda criação de nota falhava e apagava o arquivo já
   escrito (`fs.unlinkSync` no catch). Onboarding grava resultado via
   `create_note` pra cada goal/value/skill — se isso falha silenciosamente
   (erro só vira `console.warn` no `AuroraApp.tsx`), o onboarding "completa"
   na UI mas nada persiste.

Consequência prática: o onboarding que rodou no instalador não escreveu
nada no vault. A resposta da Aurora que pareceu "lembrar" de contexto do
usuário (e-commerce de refrigeração, NOESIS/LCA) na verdade só repetia o
`AURORA_SYSTEM` hardcoded em `AuroraApp.tsx` — não veio de `get_context`
real. Nada disso é sobre o modelo/LLM; é infraestrutura de vault quebrada
pro cenário empacotado.

## Decisão

### 1. Cada instalação tem seu próprio vault, em `userData/vault`

Alinhado com o objetivo de produto (uma instância — e um perfil — por
pessoa, cada instalação nova começa do zero): `VAULT_ROOT` no app
empacotado (`app.isPackaged === true`) vira `app.getPath("userData")+
"/vault"` (Windows, hoje: `%APPDATA%\aurora-desktop\vault` — Electron
deriva `app.name` do campo `name` do package.json, não do
`build.productName` do electron-builder; pra virar `%APPDATA%\Aurora\vault`
seria preciso `productName` no nível raiz do package.json, o que também
mudaria o userData de dev e exigiria migrar config/vault existentes — fica
como melhoria futura, comportamento é idêntico) — sempre gravável (é a pasta
de dados do próprio usuário, não exige admin), sobrevive a reinstalação/
update do app (fica fora de `Program Files`), e é naturalmente isolada por
máquina/conta do Windows. Em dev, `VAULT_ROOT` continua sendo a raiz do
checkout (comportamento inalterado — não quebra o fluxo de quem desenvolve
direto no vault real).

A pasta é criada (`fs.mkdirSync(VAULT_ROOT, {recursive: true})`) logo no
início do main process, antes de qualquer coisa poder precisar dela — sem
isso, `listNoteFiles()` do noesis-mcp lança ENOENT numa instalação nova
onde a pasta ainda nem existe (subpastas o próprio noesis-mcp cria sob
demanda via `mkdirSync recursive` ao escrever a primeira nota; a raiz em
si, não).

### 2. `noesis-mcp` vai junto no instalador via `extraResources`

`electron-builder` copia `noesis-mcp/dist/`, `noesis-mcp/node_modules/` e
`noesis-mcp/package.json` (necessário pelo `"type": "module"`) pra
`resources/noesis-mcp/` — ao lado do `app.asar`, não dentro dele (Node
precisa abrir esses `.js` como arquivos soltos no disco, não de dentro de
um archive). `NOESIS_MCP_DIR` no main process aponta pra
`process.resourcesPath + "/noesis-mcp"` quando empacotado, ou pro
`noesis-mcp/` de dentro do vault quando em dev.

### 3. `noesis-mcp` recebe `VAULT_ROOT` via env var, não recalcula sozinho

`noesis-mcp/src/vault.ts` já suportava `NOESIS_VAULT_ROOT` como override
(não precisou mudar nada lá) — só faltava o processo que o spawna passar
essa env var. `getMcpClient()` em `aurora-desktop/src/main/index.ts` agora
passa `env: {...getDefaultEnvironment(), NOESIS_VAULT_ROOT: VAULT_ROOT}`
pro `StdioClientTransport` (usa `getDefaultEnvironment()` do próprio SDK
do MCP como base — o comportamento padrão sem `env` explícito — em vez de
`process.env` cru, que vazaria mais do que o necessário pro processo
filho).

### 4. Validador de frontmatter portado de Python pra TypeScript

Em vez de exigir Python 3 (fricção real pra usuário não-técnico — o
objetivo declarado é "cada usuário, nova instalação", raramente alguém
com ambiente de dev) ou pular a validação silenciosamente (perde a
garantia de qualidade de dado que essa validação existe pra dar), a lógica
de `scripts/validate_frontmatter.py` (125 linhas, zero dependência externa
— "parser mínimo próprio", nem PyYAML) foi portada pra
`noesis-mcp/src/validateFrontmatter.ts`. `vault.ts#runValidator` chama essa
função em processo — sem spawnar subprocesso nenhum, sem PATH, sem
depender de nada estar instalado na máquina do usuário final, pra sempre.

`scripts/validate_frontmatter.py` **continua existindo** — é a validação
usada pelo hook de pre-commit (`scripts/pre-commit.sh`) de quem edita o
vault direto via git, cenário onde Python 3 é uma expectativa razoável pra
quem já está contribuindo num repo. As duas cópias das regras (`RULES`,
`REQUIRED_COMMON`) precisam ficar sincronizadas manualmente — mudou uma
regra, muda nos dois lugares. Validado rodando a porta TS contra notas
reais do vault (passa) e um arquivo malformado de propósito (pega os 9
erros esperados: campos obrigatórios, enum inválido, id≠nome do arquivo,
confidence fora de [0,1], data não-ISO).

## Consequências

**Positivas:**
- App empacotado agora tem memória de verdade — `get_context`/`log_event`/
  `create_note` funcionam numa instalação limpa, sem nenhum setup manual
  além de instalar o `.exe`.
- Zero dependência de Python 3 pro uso normal do app (só o workflow de
  dev/git de quem edita o vault direto continua usando o script Python,
  onde já é esperado ter Python).
- Cada instalação isolada — bate com "uma instância por pessoa" sem
  precisar de nenhuma UI de "escolher usuário" ou multi-perfil dentro do
  mesmo app.

**Negativas / riscos:**
- Instalador cresce (~70MB de `noesis-mcp/node_modules/` a mais).
- Duas cópias da lógica de validação (Python pro pre-commit, TS pro
  runtime) — risco de regra nova ser adicionada só numa das duas. Aceito
  porque os dois cenários (contribuidor de git vs usuário final do app)
  são genuinamente diferentes o bastante pra não valer a pena forçar um
  caminho único agora.
- `userData/vault` não é backupeado/sincronizado automaticamente — se o
  usuário desinstalar com "remover dados" ou trocar de máquina sem
  exportar, perde o vault. Fora de escopo aqui; é o tipo de coisa que
  ORCAMENTO-FUTURO.md deveria cobrir quando/se isso virar produto de
  verdade pra múltiplas pessoas.

## Validação (2026-07-22)

Instalador rebuildado com os três fixes, instalado de verdade (elevado,
`C:\Program Files\Aurora`). Confirmado na instalação real:
`resources/noesis-mcp/` presente (dist + node_modules + package.json,
incluindo `validateFrontmatter.js`); `%APPDATA%\aurora-desktop\vault/`
criado no primeiro launch; primeira chamada de chat do app instalado
(Groq llama-3.3-70b, 526ms) gerou evento de telemetria via `log_event`
do noesis-mcp em `vault/events/2026-07-22.jsonl` — MCP de ponta a ponta
funcionando no cenário empacotado. Falta só o `create_note` disparar em
produção (acontece quando o onboarding da instalação nova completar);
a porta TS do validador já foi verificada em teste manual direto.

## Alternativas rejeitadas

- **Bundlar o vault (conteúdo, não só noesis-mcp) dentro do instalador:**
  rejeitado — congelaria o vault no momento do build (toda instalação nova
  herdaria os dados do Lucas), e `Program Files` normalmente não é
  gravável sem admin, quebrando toda escrita subsequente.
- **Pular validação de frontmatter quando Python 3 ausente:** rejeitado —
  perde garantia de qualidade de dado sem o usuário nunca perceber (o
  warning ficaria só no console, que ninguém não-técnico abre).
- **Instalar Python 3 automaticamente durante a instalação do Aurora:**
  considerado (ideia do usuário), rejeitado em favor da porta TS — mais
  simples, sem risco de falhar silenciosamente num ambiente corporativo/
  travado, sem inflar o instalador com um runtime Python inteiro, e
  elimina a dependência de vez em vez de só escondê-la.
