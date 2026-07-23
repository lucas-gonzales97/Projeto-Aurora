#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { readNoteSchema, readNote } from "./tools/readNote.js";
import { searchNotesSchema, searchNotes } from "./tools/searchNotes.js";
import { listNotesSchema, listNotes } from "./tools/listNotes.js";
import { createNoteSchema, createNote } from "./tools/createNote.js";
import { createRelationSchema, createRelation } from "./tools/createRelation.js";
import { logEventSchema, logEvent } from "./tools/logEvent.js";
import { getContextSchema, getContext } from "./tools/getContext.js";

const server = new McpServer({
  name: "noesis",
  version: "0.1.0",
});

function asToolResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function asErrorResult(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

server.tool(
  "read_note",
  "Lê uma nota do vault NOESIS por id ou por caminho relativo, retornando frontmatter e corpo.",
  readNoteSchema,
  async (input) => {
    try {
      return asToolResult(readNote(input));
    } catch (err) {
      return asErrorResult(err);
    }
  }
);

server.tool(
  "search_notes",
  "Busca notas do vault por texto livre (id, frontmatter e corpo), com filtros opcionais de type/status.",
  searchNotesSchema,
  async (input) => {
    try {
      return asToolResult(searchNotes(input));
    } catch (err) {
      return asErrorResult(err);
    }
  }
);

server.tool(
  "list_notes",
  "Lista notas do vault por type/status/dir, sem pontuação de relevância (para dashboards: 'todos os meus goals', 'todos os hábitos ativos'). Ordena por created desc.",
  listNotesSchema,
  async (input) => {
    try {
      return asToolResult(listNotes(input));
    } catch (err) {
      return asErrorResult(err);
    }
  }
);

server.tool(
  "create_note",
  "Cria uma nova nota no vault seguindo o schema de ontology/ontology.yaml. Valida com scripts/validate_frontmatter.py antes de confirmar; em caso de falha, nada é deixado no disco.",
  createNoteSchema,
  async (input) => {
    try {
      return asToolResult(await createNote(input));
    } catch (err) {
      return asErrorResult(err);
    }
  }
);

server.tool(
  "create_relation",
  "Adiciona uma relação em 'relations:' da nota de origem (source_id -> target_id), validando o resultado antes de confirmar.",
  createRelationSchema,
  async (input) => {
    try {
      return asToolResult(await createRelation(input));
    } catch (err) {
      return asErrorResult(err);
    }
  }
);

server.tool(
  "log_event",
  "Registra um evento append-only em events/YYYY-MM-DD.jsonl (evidência, sessão, medição de estratégia, etc.).",
  logEventSchema,
  async (input) => {
    try {
      return asToolResult(logEvent(input));
    } catch (err) {
      return asErrorResult(err);
    }
  }
);

server.tool(
  "get_context",
  "Expande o grafo a partir de uma intenção em linguagem natural: retorna as entidades mais relevantes do USER-MODEL/SELF-MODEL e suas relações de 1 hop.",
  getContextSchema,
  async (input) => {
    try {
      return asToolResult(getContext(input));
    } catch (err) {
      return asErrorResult(err);
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("noesis-mcp falhou ao iniciar:", err);
  process.exit(1);
});
