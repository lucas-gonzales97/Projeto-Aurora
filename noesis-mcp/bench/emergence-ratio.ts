// Métrica de emergência (ADR-0013): razão emergido/inserido do vault REAL,
// neste instante. "Emergido" = notas com origin: reflection (criadas pelo
// job de fim de sessão, sem input humano direto); "inserido" = todo o resto.
//
// Uso: npm run emergence   (de dentro de noesis-mcp/)

import { listNotes } from "../src/tools/listNotes.js";
import { emergenceRatio } from "../src/emergence.js";

const { results } = listNotes({ limit: 200 });
const r = emergenceRatio(results);

console.log(`Notas no vault: ${r.total}`);
console.log(`Emergidas (origin: reflection): ${r.emerged}`);
console.log(`Inseridas (todo o resto): ${r.inserted}`);
console.log(`Razão emergido/inserido: ${r.ratio === null ? "— (sem inseridas ainda, indefinida)" : r.ratio.toFixed(3)}`);

if (r.emerged > 0) {
  const reflections = results.filter((e) => e.frontmatter?.origin === "reflection");
  console.log("\nReflexões existentes:");
  for (const e of reflections) {
    console.log(`  - ${e.id} (${e.path})`);
  }
}
