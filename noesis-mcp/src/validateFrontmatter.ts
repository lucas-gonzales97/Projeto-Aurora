import fs from "node:fs";
import path from "node:path";

// Porta de scripts/validate_frontmatter.py pra dentro do noesis-mcp — mesma
// lógica, mesmas regras (RULES/REQUIRED_COMMON), reescrita em TS pra rodar
// em processo. Motivo: create_note/create_relation (vault.ts#runValidator)
// shelavam pra `python3 scripts/validate_frontmatter.py`, o que quebra em
// qualquer máquina sem Python 3 instalado — inviável pro Aurora Desktop
// empacotado, que precisa funcionar pra usuário não-técnico sem instalar
// nada além do instalador do app (ver decisions/ADR-0008-vault-por-instalacao.md).
// O script Python continua existindo e sendo a validação usada pelo hook de
// pre-commit em `scripts/pre-commit.sh` (workflow de quem edita o vault
// direto via git) — as duas cópias das regras precisam ficar em sincronia
// manualmente; mudou uma, muda a outra.
//
// Parser de frontmatter é deliberadamente mínimo (só `key: value` de
// primeiro nível, sem listas/objetos aninhados) — mesma limitação
// documentada no script original.

type Frontmatter = Record<string, string>;

const REQUIRED_COMMON = ["id", "type", "status", "created"];

interface TypeRule {
  extra: string[];
  allowed: Record<string, Set<string>>;
}

const RULES: Record<string, TypeRule> = {
  goal: {
    extra: ["horizon", "origin", "confidence", "progress", "success_criteria", "review_cycle"],
    allowed: {
      horizon: new Set(["short", "mid", "long"]),
      status: new Set(["active", "paused", "achieved", "killed"]),
      origin: new Set(["declared"]),
    },
  },
  habit: {
    extra: ["direction", "origin", "trigger", "frequency_target"],
    allowed: {
      direction: new Set(["build", "extinguish"]),
      status: new Set(["active", "consolidated", "abandoned"]),
      origin: new Set(["declared"]),
    },
  },
  hypothesis: {
    extra: ["confidence", "origin"],
    allowed: { origin: new Set(["inferred", "aurora", "declared", "co-created", "daemon", "session"]) },
  },
  project: { extra: ["domain"], allowed: { status: new Set(["active", "paused", "done"]) } },
  decision: { extra: [], allowed: {} },
  identity: { extra: ["version", "confidence", "mutable_by_system"], allowed: {} },
  foundation: { extra: ["version", "confidence"], allowed: {} },
  value: { extra: ["origin"], allowed: { origin: new Set(["declared"]) } },
  skill: { extra: [], allowed: {} },
  conflict: { extra: [], allowed: {} },
  meta: { extra: [], allowed: {} },
};

const ID_MUST_MATCH_FILENAME = new Set(["goal", "habit", "project", "value", "skill"]);

function stripChar(s: string, ch: string): string {
  let start = 0;
  let end = s.length;
  while (start < end && s[start] === ch) start++;
  while (end > start && s[end - 1] === ch) end--;
  return s.slice(start, end);
}

// Python: v.strip('"').strip("'") — strip() remove ocorrências repetidas
// nas duas pontas, um caractere por vez, em duas passadas sequenciais.
function stripQuotes(v: string): string {
  return stripChar(stripChar(v, '"'), "'");
}

function parseFrontmatter(text: string): Frontmatter | null {
  const m = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if (!m) return null;
  const fm: Frontmatter = {};
  for (const raw of m[1].split("\n")) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const indent = raw.length - raw.trimStart().length;
    const colonIdx = trimmed.indexOf(":");
    if (indent === 0 && colonIdx !== -1) {
      const key = trimmed.slice(0, colonIdx).trim();
      let value = trimmed.slice(colonIdx + 1);
      value = value.split("#")[0].trim();
      value = stripQuotes(value);
      fm[key] = value;
    }
  }
  return fm;
}

// Python: datetime.date.fromisoformat(c[:10]) — exige YYYY-MM-DD estrito
// (mês 01-12, dia válido pro mês/ano, incluindo ano bissexto).
function isIsoDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.slice(0, 10));
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12) return false;
  const daysInMonth = new Date(year, month, 0).getDate();
  return day >= 1 && day <= daysInMonth;
}

function checkFile(absPath: string): string[] {
  const errs: string[] = [];
  const text = fs.readFileSync(absPath, "utf-8");
  const fm = parseFrontmatter(text);
  if (fm === null) {
    return [`${absPath}: sem frontmatter YAML delimitado por ---`];
  }

  for (const f of REQUIRED_COMMON) {
    if (!fm[f]) errs.push(`${absPath}: campo obrigatório ausente: ${f}`);
  }

  const t = fm.type ?? "";
  const rule = RULES[t];
  if (!rule) {
    errs.push(`${absPath}: type desconhecido: '${t}' (permitidos: ${Object.keys(RULES).sort().join(", ")})`);
  } else {
    for (const f of rule.extra) {
      if (!fm[f]) errs.push(`${absPath}: [${t}] campo obrigatório ausente: ${f}`);
    }
    for (const [field, vals] of Object.entries(rule.allowed)) {
      const v = fm[field] ?? "";
      if (v && !vals.has(v)) {
        errs.push(`${absPath}: [${t}] ${field}='${v}' inválido (permitidos: ${[...vals].sort().join(", ")})`);
      }
    }
  }

  const fid = fm.id ?? "";
  if (fid && ID_MUST_MATCH_FILENAME.has(t)) {
    const stem = path.basename(absPath, ".md");
    if (stem !== fid) {
      errs.push(`${absPath}: id '${fid}' difere do nome do arquivo '${stem}'`);
    }
  }

  for (const numField of ["confidence", "progress"]) {
    const v = fm[numField];
    if (v) {
      const x = Number(v);
      if (Number.isNaN(x)) {
        errs.push(`${absPath}: ${numField}='${v}' não é numérico`);
      } else if (x < 0 || x > 1) {
        errs.push(`${absPath}: ${numField}=${v} fora de [0,1]`);
      }
    }
  }

  const created = fm.created ?? "";
  if (created && !isIsoDate(created)) {
    errs.push(`${absPath}: created='${created}' não é data ISO (YYYY-MM-DD)`);
  }

  return errs;
}

export interface ValidationResult {
  ok: boolean;
  output: string;
}

/** Mesmas regras de scripts/validate_frontmatter.py, em processo — sem spawnar python3. */
export function validateFrontmatterFiles(absPaths: string[]): ValidationResult {
  const allErrs: string[] = [];
  for (const absPath of absPaths) {
    if (!absPath.endsWith(".md") || !fs.existsSync(absPath)) continue;
    allErrs.push(...checkFile(absPath));
  }
  if (allErrs.length > 0) {
    return { ok: false, output: "VALIDAÇÃO FALHOU:\n" + allErrs.map((e) => `  ✗ ${e}`).join("\n") };
  }
  return { ok: true, output: `✓ ${absPaths.length} nota(s) válida(s). Frontmatter OK.` };
}
