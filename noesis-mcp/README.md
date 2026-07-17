# noesis-mcp v0

Servidor MCP local que expõe o vault NOESIS (`../`) como memória consultável:
o marco descrito em `README.md` §4.6 e `decisions/ADR-0002-interfaces.md`.
Serve o Claude Code hoje e é a base sobre a qual Aurora Desktop, a extensão
VS Code e o acesso via celular serão construídos (todos "cascas sobre
{Agent SDK + noesis-mcp + vault}").

## Setup

```bash
cd noesis-mcp
npm install
npm run build      # gera dist/ a partir de src/
```

O servidor já está registrado em `.mcp.json` na raiz do vault — o Claude Code
o descobre automaticamente ao abrir este repositório (rebuilde com `npm run
build` sempre que editar `src/`).

Para rodar/depurar manualmente:

```bash
npm run dev         # tsx direto de src/index.ts, sem build
npm start           # node dist/index.js (o que .mcp.json de fato invoca)
```

Por padrão o servidor opera sobre o vault que contém esta pasta
(`noesis-mcp/../`). Para apontar para outro vault, defina
`NOESIS_VAULT_ROOT=/caminho/para/outro/vault`.

## Tools expostos

| tool | o que faz |
|---|---|
| `read_note` | Lê uma nota por `id` (frontmatter) ou `path`, retorna frontmatter + corpo. |
| `search_notes` | Busca por texto livre no id/frontmatter/corpo, com filtros opcionais `type`/`status`. |
| `create_note` | Cria uma nota nova seguindo `ontology/ontology.yaml`; a validade final é sempre decidida por `scripts/validate_frontmatter.py` — se falhar, nada fica no disco. |
| `create_relation` | Adiciona uma relação em `relations:` da nota de origem, preservando byte a byte o resto do arquivo (edição cirúrgica via AST YAML, não um dump completo). |
| `log_event` | Registra um evento append-only em `events/YYYY-MM-DD.jsonl`. |
| `get_context` | Dada uma intenção em linguagem natural, retorna as entidades mais relevantes do grafo e suas relações de 1 hop — a base de retrieval sobre a qual o motor de curiosidade de `MOTOR-EPISTEMICO.md` será construído depois. |

## Princípios de design

- **`scripts/validate_frontmatter.py` é a única fonte de verdade** sobre o que é
  uma nota válida. `create_note`/`create_relation` escrevem, chamam o
  validador como subprocesso, e desfazem a escrita se ele reprovar — em vez
  de reimplementar as regras em TypeScript e arriscar as duas divergirem.
- **`safeResolve()`** (`src/vault.ts`) impede qualquer caminho de escapar do
  vault (sem path traversal via `path`/`dir`).
- **Edições em notas existentes preservam formatação.** `create_relation` usa
  a lib `yaml` (AST com preservação de estilo) para só adicionar o item novo
  em `relations:`, em vez de reserializar o frontmatter inteiro — evita ruído
  de diff (aspas, quebras de linha) toda vez que uma relação é criada.
- **`ontology/ontology.yaml`** é consultado em runtime (não hardcoded) para
  avisos amigáveis de `type`/`kind` desconhecidos — mas nunca é o gate final.

## Estado (v0)

`get_context` implementa retrieval por relevância textual + expansão de 1 hop,
não a fórmula completa de `prioridade(e) = incerteza(e) × valor(e)` do
`MOTOR-EPISTEMICO.md` (isso é o motor de curiosidade proativo — trabalho de
daemon, Fase 3, fora do escopo de um servidor de leitura/escrita sob demanda).
