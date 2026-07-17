import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { VAULT_ROOT, todayISO } from "../vault.js";

export const logEventSchema = {
  type: z.string().describe("classe do evento, ex.: 'evidence', 'proactive-question', 'session-close', 'strategy-measured'"),
  summary: z.string().describe("descrição curta e factual do que aconteceu"),
  entities: z.array(z.string()).optional().describe("ids de notas relacionadas a este evento (goals/habits/projects/etc.)"),
  data: z.record(z.string(), z.any()).optional().describe("dados estruturados adicionais (ex.: métricas de uma strategy)"),
};

export interface LogEventInput {
  type: string;
  summary: string;
  entities?: string[];
  data?: Record<string, any>;
}

export function logEvent(input: LogEventInput) {
  const eventsDir = path.join(VAULT_ROOT, "events");
  fs.mkdirSync(eventsDir, { recursive: true });

  const day = todayISO();
  const filePath = path.join(eventsDir, `${day}.jsonl`);
  const existingLines = fs.existsSync(filePath)
    ? fs.readFileSync(filePath, "utf-8").split("\n").filter((l: string) => l.trim().length > 0).length
    : 0;
  const seq = String(existingLines + 1).padStart(3, "0");
  const id = `evt-${day.replace(/-/g, "")}-${seq}`;

  const event = {
    id,
    ts: new Date().toISOString(),
    type: input.type,
    summary: input.summary,
    entities: input.entities ?? [],
    data: input.data ?? {},
  };

  fs.appendFileSync(filePath, JSON.stringify(event) + "\n", "utf-8");

  return { id, path: path.relative(VAULT_ROOT, filePath).split(path.sep).join("/"), event };
}
