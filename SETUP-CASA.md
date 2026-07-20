---
id: setup-casa
type: meta
status: active
created: 2026-07-20
---

# SETUP-CASA.md — Replicar o ambiente NOESIS em uma máquina nova

> Guia autocontido para configurar este projeto do zero em qualquer máquina
> Windows 11, usando WSL2. Não assume nenhum conhecimento prévio do vault —
> só que a pessoa sabe abrir um terminal.

Público-alvo: você mesmo (Lucas), numa máquina nova ou reinstalada — casa,
notebook, etc. Se já tem WSL2 instalado e configurado, pule para a
[Etapa 2](#etapa-2--instalar-o-wsl2-se-ainda-não-tiver).

---

## Visão geral das etapas

1. Pré-requisitos (conta GitHub com acesso ao repo)
2. Instalar o WSL2 (se ainda não tiver)
3. Instalar o Node.js (via nvm, dentro do WSL2)
4. Instalar o Git e o GitHub CLI (`gh`), e autenticar
5. Clonar o repositório
6. Instalar o Claude Code
7. Buildar o `noesis-mcp`
8. Validar a integridade do vault
9. Abrir o projeto (Obsidian + Claude Code)
10. Checklist final

---

## Etapa 1 — Pré-requisitos

- Uma conta GitHub com acesso ao repositório
  `https://github.com/lucas-gonzales97/Projeto-Aurora`.
- Windows 11 com privilégios de administrador (para instalar o WSL2).
- Conexão com a internet.

---

## Etapa 2 — Instalar o WSL2 (se ainda não tiver)

Abra o **PowerShell como Administrador** e rode:

```powershell
wsl --install
```

Isso instala o WSL2 com Ubuntu como distribuição padrão. Reinicie a máquina
se for pedido. Na primeira abertura do Ubuntu, crie um usuário e senha Unix
quando solicitado.

Para verificar que está tudo certo, abra o terminal Ubuntu (procure "Ubuntu"
no menu Iniciar) e rode:

```bash
wsl --version   # rode isto no PowerShell, não dentro do Ubuntu, para conferir versão
```

Todos os comandos a partir daqui são executados **dentro do terminal Ubuntu
(WSL2)**, não no PowerShell/CMD.

---

## Etapa 3 — Instalar o Node.js

Recomendado instalar via `nvm` (Node Version Manager), para não depender do
Node do sistema:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 22
nvm use 22
```

Confirme as versões (o ambiente original usa Node 22.x / npm 10.x):

```bash
node -v   # esperado: v22.x
npm -v    # esperado: 10.x
```

---

## Etapa 4 — Instalar Git, Python3 e GitHub CLI, e autenticar

### 4.1 Git e Python3

O Ubuntu do WSL2 geralmente já vem com `git` e `python3`. Confirme e instale
se faltar:

```bash
sudo apt update
sudo apt install -y git python3
git --version
python3 --version   # o vault usa scripts/validate_frontmatter.py, requer Python 3
```

### 4.2 Configurar identidade do Git (se for a primeira vez nesta máquina)

```bash
git config --global user.name "Lucas Gonzales"
git config --global user.email "SEU_EMAIL_DO_GITHUB@exemplo.com"
```

### 4.3 Instalar o GitHub CLI (`gh`)

```bash
(type -p wget >/dev/null || sudo apt install -y wget) \
  && sudo mkdir -p -m 755 /etc/apt/keyrings \
  && wget -qO- https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null \
  && sudo chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
  && sudo apt update \
  && sudo apt install -y gh
```

### 4.4 Autenticar o `gh` e conectar ao Git

```bash
gh auth login
```

Escolha: `GitHub.com` → `HTTPS` → autenticar via navegador (device code) →
siga o link e cole o código de uma vez que aparece no terminal.

Depois de autenticado, conecte o `gh` como credential helper do Git — isso
evita ter que digitar usuário/senha em todo `git push`/`git pull`:

```bash
gh auth setup-git
```

Confirme que funcionou:

```bash
gh auth status
```

---

## Etapa 5 — Clonar o repositório

Escolha onde guardar o projeto (exemplo usa a home do WSL2, recomendado por
performance — evitar `/mnt/c/...` quando possível, mas funciona também):

```bash
cd ~
gh repo clone lucas-gonzales97/Projeto-Aurora
cd Projeto-Aurora
```

Alternativa via `git` puro (equivalente, já que `gh auth setup-git` configurou
as credenciais):

```bash
git clone https://github.com/lucas-gonzales97/Projeto-Aurora.git
cd Projeto-Aurora
```

> Nota: se preferir manter o vault dentro do Windows (para o Obsidian acessar
> nativamente sem plugin WSL), clone em `/mnt/c/Users/<seu_usuario>/Projeto-Aurora`
> em vez de `~`. Funciona igual, só é um pouco mais lento em I/O.

---

## Etapa 6 — Instalar o Claude Code

```bash
npm install -g @anthropic-ai/claude-code
claude --version
```

Autentique na primeira execução (abre fluxo de login no navegador):

```bash
claude
```

Siga o fluxo de login com sua conta Anthropic/Claude. Depois de autenticado,
pode sair (`/exit` ou `Ctrl+D`) — a sessão fica salva para próximas vezes.

---

## Etapa 7 — Buildar o `noesis-mcp`

O servidor MCP que expõe o vault (`read_note`, `search_notes`, `create_note`,
`create_relation`, `log_event`, `get_context`) precisa ser instalado e
compilado localmente — `node_modules/` e `dist/` não vão pro Git
(`noesis-mcp/.gitignore`):

```bash
cd noesis-mcp
npm install
npm run build
cd ..
```

Confirme que o build gerou o entrypoint que `.mcp.json` espera:

```bash
ls noesis-mcp/dist/index.js
```

---

## Etapa 8 — Validar a integridade do vault

Todo o frontmatter das notas precisa passar no validador antes de qualquer
commit (é o mesmo check que roda no hook de pre-commit):

```bash
python3 scripts/validate_frontmatter.py
```

Deve terminar sem erros. Se o hook de pre-commit ainda não estiver linkado
neste clone (ele não vai pelo Git por ser um arquivo dentro de `.git/`),
reinstale-o:

```bash
ln -sf ../../scripts/pre-commit.sh .git/hooks/pre-commit
chmod +x scripts/pre-commit.sh
```

---

## Etapa 9 — Abrir o projeto

### Claude Code

Dentro da pasta do repositório:

```bash
cd ~/Projeto-Aurora   # ou onde você clonou
claude
```

O Claude Code carrega `.mcp.json` automaticamente e sobe o servidor
`noesis-mcp` (tools `read_note`, `search_notes`, etc. ficam disponíveis na
sessão). Se você editar `noesis-mcp/src/`, rode `npm run build` de novo e
reinicie a sessão do Claude Code para pegar o novo `dist/`.

### Obsidian (opcional, para navegação visual do vault)

1. Instale o [Obsidian](https://obsidian.md/) no Windows normalmente (não
   precisa ser dentro do WSL2).
2. Abra o Obsidian → "Open folder as vault" → aponte para a pasta do repo.
   - Se clonou dentro do WSL2 (`~/Projeto-Aurora`), acesse via
     `\\wsl$\Ubuntu\home\<seu_usuario>\Projeto-Aurora` no explorador de
     arquivos do Windows.
   - Se clonou em `/mnt/c/...`, aponte direto para o caminho Windows
     equivalente (ex.: `C:\Users\<seu_usuario>\Projeto-Aurora`).

---

## Etapa 10 — Checklist final

Rode estes comandos e confira se tudo bate:

```bash
node -v                                   # v22.x
npm -v                                    # 10.x
python3 --version                         # 3.x
git --version
gh auth status                            # logado como lucas-gonzales97
git -C ~/Projeto-Aurora remote -v         # aponta pro Projeto-Aurora certo
git -C ~/Projeto-Aurora status            # working tree clean, main atualizado
ls ~/Projeto-Aurora/noesis-mcp/dist/index.js   # build existe
python3 ~/Projeto-Aurora/scripts/validate_frontmatter.py   # sem erros
```

Se todos passarem, o ambiente está pronto: abra `claude` dentro da pasta do
projeto e comece a sessão normalmente.

---

## Troubleshooting

- **`git push` falha com `could not read Username for 'https://github.com'`**:
  o `gh auth setup-git` não rodou ou expirou. Rode `gh auth login` de novo e
  depois `gh auth setup-git`.
- **Claude Code não lista as tools do `noesis-mcp`**: confirme que
  `noesis-mcp/dist/index.js` existe (`npm run build` dentro de `noesis-mcp/`)
  e que você abriu o `claude` a partir da raiz do repositório (onde está o
  `.mcp.json`).
- **`validate_frontmatter.py` reprova**: leia o erro — ele aponta o arquivo e
  o campo de frontmatter inválido. Corrija a nota, não o script.
- **Performance ruim do WSL2 acessando `/mnt/c/...`**: prefira clonar dentro
  do filesystem Linux (`~/Projeto-Aurora`) quando a performance de I/O
  importar (ex.: builds frequentes do `noesis-mcp`).
