import fs from "node:fs";
import type { ParsedNote } from "./vault.js";

// Retrieval triplo (ADR-0010): score = w_rel·relevância + w_rec·recência + w_imp·importância,
// termos normalizados em [0,1], forma do memory stream de Generative Agents
// (Park et al. 2023 — ver research/PESQUISA-FRONTEIRA-COMPLETA-AURORA.md §1.2).
// Nota de design: o plano escreveu a fórmula como produto, mas produto puro
// faz recência↓ esmagar nota antiga-e-relevante (viola o critério "sem perder
// o relevante") e pesos constantes num produto nem mudam a ordenação; a soma
// ponderada é a forma do paper e satisfaz o critério de regressão do plano:
// com w_rec = w_imp = 0 a ordenação reproduz exatamente o comportamento antigo
// (só relevância textual, transformada monotonicamente).
//
// Pesos numa constante única, como o plano pede. Ajustar AQUI, nunca inline.
export interface RetrievalWeights {
  rel: number;
  rec: number;
  imp: number;
}

export const DEFAULT_WEIGHTS: RetrievalWeights = { rel: 1.0, rec: 0.5, imp: 0.5 };

/** Pesos que reproduzem o comportamento pré-ADR-0010 (só relevância textual). */
export const LEGACY_WEIGHTS: RetrievalWeights = { rel: 1.0, rec: 0, imp: 0 };

// Meia-vida da recência, em dias. Goals/hábitos são entidades duráveis — a
// recência deve dar um empurrão, não dominar (o dilema estabilidade↔plasticidade
// da Parte 3.2 da pesquisa se manifesta exatamente aqui: decaimento agressivo
// = memórias novas "abafando" antigas relevantes). 30 dias ≈ nota de um mês
// atrás ainda vale metade do frescor de uma de hoje.
export const RECENCY_HALF_LIFE_DAYS = 30;

// importance é campo OPCIONAL de frontmatter, escala 0-10 (validadores aceitam
// ausência — notas existentes não quebram). Default 5 = neutro.
export const DEFAULT_IMPORTANCE = 5;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Timestamp de referência da nota: updated > created > mtime do arquivo. */
export function noteTimestamp(note: ParsedNote, statFn: (p: string) => Date = mtimeOf): Date {
  for (const field of ["updated", "created"]) {
    const v = note.data?.[field];
    if (typeof v === "string" && v) {
      const d = new Date(v.length <= 10 ? `${v}T00:00:00Z` : v);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  return statFn(note.absPath);
}

function mtimeOf(absPath: string): Date {
  try {
    return fs.statSync(absPath).mtime;
  } catch {
    return new Date(0);
  }
}

/** Decaimento exponencial em [0,1]: 1 = agora, 0.5 = uma meia-vida atrás. */
export function recencyScore(ts: Date, now: Date = new Date()): number {
  const ageDays = Math.max(0, (now.getTime() - ts.getTime()) / MS_PER_DAY);
  return Math.pow(0.5, ageDays / RECENCY_HALF_LIFE_DAYS);
}

/** importance do frontmatter (0-10) normalizada pra [0,1]; ausente/inválida = default 5. */
export function importanceScore(note: ParsedNote): number {
  const raw = note.data?.importance;
  const n = typeof raw === "number" ? raw : typeof raw === "string" && raw !== "" ? Number(raw) : NaN;
  const clamped = Number.isFinite(n) ? Math.min(10, Math.max(0, n)) : DEFAULT_IMPORTANCE;
  return clamped / 10;
}

export interface TripleScore {
  /** score final combinado (o que ordena) */
  final: number;
  /** componentes normalizados, pra transparência/bancada */
  relevance_norm: number;
  recency: number;
  importance: number;
}

/**
 * Combina os três termos. `textScore` e `maxTextScore` vêm do scoreNote
 * existente (relevância textual crua); o gate "textScore > 0" continua sendo
 * responsabilidade do chamador — recência/importância NUNCA trazem pra
 * superfície uma nota que não casou nada com a intenção.
 */
export function tripleScore(
  note: ParsedNote,
  textScore: number,
  maxTextScore: number,
  weights: RetrievalWeights = DEFAULT_WEIGHTS,
  now: Date = new Date(),
): TripleScore {
  const relevance_norm = maxTextScore > 0 ? textScore / maxTextScore : 0;
  const recency = recencyScore(noteTimestamp(note), now);
  const importance = importanceScore(note);
  return {
    final: weights.rel * relevance_norm + weights.rec * recency + weights.imp * importance,
    relevance_norm,
    recency,
    importance,
  };
}
