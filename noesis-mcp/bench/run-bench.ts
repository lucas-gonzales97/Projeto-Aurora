// Bancada A/B do retrieval triplo (ADR-0010).
// Roda cada intent de retrieval-queries.json nos DOIS modos — pesos antigos
// (LEGACY: só relevância textual) vs novos (DEFAULT: triplo) — contra o vault
// REAL, e grava bench/results-AAAA-MM-DD.md com os top-5 lado a lado + coluna
// de avaliação humana (o Lucas marca qual modo retornou contexto melhor).
//
// Uso: npm run bench   (de dentro de noesis-mcp/)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getContext } from "../src/tools/getContext.js";
import { DEFAULT_WEIGHTS, LEGACY_WEIGHTS, RECENCY_HALF_LIFE_DAYS } from "../src/retrieval.js";
import { VAULT_ROOT } from "../src/vault.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOP_N = 5;

interface Query {
  id: string;
  intent: string;
}

const { queries } = JSON.parse(fs.readFileSync(path.join(__dirname, "retrieval-queries.json"), "utf-8")) as {
  queries: Query[];
};

const now = new Date();
const dateStr = now.toISOString().slice(0, 10);

function fmtEntity(e: any): string {
  const s = e.scoring ?? {};
  return `\`${e.id}\` (final ${e.relevance} · rel ${s.relevance_norm} · rec ${s.recency} · imp ${s.importance})`;
}

function fmtLegacy(e: any): string {
  return `\`${e.id}\` (texto ${e.text_relevance})`;
}

const lines: string[] = [];
lines.push(`# Bancada A/B — Retrieval triplo (${dateStr})`);
lines.push("");
lines.push(`- Vault: \`${VAULT_ROOT}\``);
lines.push(`- Modo ANTIGO: pesos ${JSON.stringify(LEGACY_WEIGHTS)} (só relevância textual — comportamento pré-ADR-0010)`);
lines.push(`- Modo NOVO: pesos ${JSON.stringify(DEFAULT_WEIGHTS)} · meia-vida da recência: ${RECENCY_HALF_LIFE_DAYS} dias · importance default 5`);
lines.push(`- Executada em: ${now.toISOString()}`);
lines.push("");
lines.push("## Como avaliar (Lucas)");
lines.push("");
lines.push("Para cada intent, compare os dois top-5 e preencha a coluna **Veredito** com:");
lines.push("`NOVO` (novo é melhor), `ANTIGO` (antigo era melhor), `EMPATE` (iguais/indiferente).");
lines.push("Meta do plano: NOVO ≥ ANTIGO em ≥70% das intents; nenhuma regressão grave.");
lines.push("");
lines.push("| intent | Veredito |");
lines.push("|---|---|");
for (const q of queries) lines.push(`| ${q.id} — "${q.intent}" | _preencher_ |`);
lines.push("");

let changedTop1 = 0;
let changedAny = 0;

for (const q of queries) {
  const legacy = getContext({ intent: q.intent, limit: TOP_N, weights: LEGACY_WEIGHTS, now });
  const triple = getContext({ intent: q.intent, limit: TOP_N, weights: DEFAULT_WEIGHTS, now });

  const legacyIds = legacy.entities.map((e: any) => e.id);
  const tripleIds = triple.entities.map((e: any) => e.id);
  if (legacyIds[0] !== tripleIds[0]) changedTop1++;
  if (JSON.stringify(legacyIds) !== JSON.stringify(tripleIds)) changedAny++;

  lines.push(`## ${q.id} — "${q.intent}"`);
  lines.push("");
  lines.push("| # | ANTIGO (só texto) | NOVO (triplo) |");
  lines.push("|---|---|---|");
  for (let i = 0; i < TOP_N; i++) {
    const a = legacy.entities[i];
    const b = triple.entities[i];
    lines.push(`| ${i + 1} | ${a ? fmtLegacy(a) : "—"} | ${b ? fmtEntity(b) : "—"} |`);
  }
  lines.push("");
}

lines.push("## Resumo mecânico");
lines.push("");
lines.push(`- Intents com top-1 diferente: ${changedTop1}/${queries.length}`);
lines.push(`- Intents com qualquer diferença no top-5: ${changedAny}/${queries.length}`);
lines.push("");
lines.push("_(Diferença mecânica não é qualidade — a avaliação humana acima é o critério do plano.)_");
lines.push("");

const outPath = path.join(__dirname, `results-${dateStr}.md`);
fs.writeFileSync(outPath, lines.join("\n"), "utf-8");
console.log(`Bancada gravada em ${outPath}`);
console.log(`top-1 mudou em ${changedTop1}/${queries.length} intents; top-5 mudou em ${changedAny}/${queries.length}.`);
