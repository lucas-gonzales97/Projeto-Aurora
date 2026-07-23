#!/usr/bin/env python3
"""
NOESIS — Validador de frontmatter (Fase 0 do roadmap)
Uso:
  python3 scripts/validate_frontmatter.py            # valida o vault inteiro
  python3 scripts/validate_frontmatter.py file.md    # valida arquivos específicos
Como pre-commit (na raiz do repo):
  ln -s ../../scripts/pre-commit.sh .git/hooks/pre-commit
Sem dependências externas (não requer PyYAML): parser mínimo próprio.
"""
import re, sys, datetime
from pathlib import Path

VAULT = Path(__file__).resolve().parent.parent

REQUIRED_COMMON = ["id", "type", "status", "created"]
RULES = {
    # type: (campos obrigatórios extras, valores permitidos por campo)
    "goal":       (["horizon", "origin", "confidence", "progress", "success_criteria", "review_cycle"],
                   {"horizon": {"short", "mid", "long"},
                    "status": {"active", "paused", "achieved", "killed"},
                    "origin": {"declared"}}),
    "habit":      (["direction", "origin", "trigger", "frequency_target"],
                   {"direction": {"build", "extinguish"},
                    "status": {"active", "consolidated", "abandoned"},
                    "origin": {"declared"}}),
    "hypothesis": (["confidence", "origin"],
                   {"origin": {"inferred", "aurora", "declared", "co-created", "daemon", "session"}}),
    "project":    (["domain"], {"status": {"active", "paused", "done"}}),
    "decision":   ([], {}),
    "identity":   (["version", "confidence", "mutable_by_system"], {}),
    "foundation": (["version", "confidence"], {}),
    "value":      (["origin"], {"origin": {"declared"}}),
    "skill":      ([], {}),
    "conflict":   ([], {}),
    "meta":       ([], {}),
}

IGNORED_DIRS = {".git", ".obsidian", "node_modules", "scripts", "events", "research"}
IGNORED_FILES = {"SETUP.md", "README.md", "CLAUDE.md", "00-INDEX.md"}

def parse_frontmatter(text):
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n", text, re.DOTALL)
    if not m:
        return None
    fm, stack = {}, []
    for raw in m.group(1).splitlines():
        if not raw.strip() or raw.strip().startswith("#"):
            continue
        indent = len(raw) - len(raw.lstrip())
        line = raw.strip()
        if indent == 0 and ":" in line:
            k, _, v = line.partition(":")
            v = v.split("#")[0].strip().strip('"').strip("'")
            fm[k.strip()] = v if v else {}
    return fm

def check_file(path):
    errs = []
    text = path.read_text(encoding="utf-8", errors="replace")
    fm = parse_frontmatter(text)
    if fm is None:
        return [f"{path}: sem frontmatter YAML delimitado por ---"]
    for f in REQUIRED_COMMON:
        if f not in fm or fm[f] in ("", {}):
            errs.append(f"{path}: campo obrigatório ausente: {f}")
    t = fm.get("type", "")
    if t not in RULES:
        errs.append(f"{path}: type desconhecido: '{t}' (permitidos: {', '.join(sorted(RULES))})")
    else:
        extra, allowed = RULES[t]
        for f in extra:
            if f not in fm or fm[f] in ("", {}):
                errs.append(f"{path}: [{t}] campo obrigatório ausente: {f}")
        for field, vals in allowed.items():
            v = fm.get(field, "")
            if isinstance(v, str) and v and v not in vals:
                errs.append(f"{path}: [{t}] {field}='{v}' inválido (permitidos: {', '.join(sorted(vals))})")
    # id deve bater com o nome do arquivo para tipos de entidade
    fid = fm.get("id", "")
    if isinstance(fid, str) and fid and t in {"goal", "habit", "project", "value", "skill"}:
        if path.stem != fid:
            errs.append(f"{path}: id '{fid}' difere do nome do arquivo '{path.stem}'")
    # confidence e progress no intervalo [0,1]
    for numf in ("confidence", "progress"):
        v = fm.get(numf, "")
        if isinstance(v, str) and v:
            try:
                x = float(v)
                if not (0.0 <= x <= 1.0):
                    errs.append(f"{path}: {numf}={v} fora de [0,1]")
            except ValueError:
                errs.append(f"{path}: {numf}='{v}' não é numérico")
    # importance (opcional, ADR-0010): quando presente, numérico em [0,10]
    v = fm.get("importance", "")
    if isinstance(v, str) and v:
        try:
            x = float(v)
            if not (0.0 <= x <= 10.0):
                errs.append(f"{path}: importance={v} fora de [0,10]")
        except ValueError:
            errs.append(f"{path}: importance='{v}' não é numérico")
    # created deve ser data ISO
    c = fm.get("created", "")
    if isinstance(c, str) and c:
        try:
            datetime.date.fromisoformat(c[:10])
        except ValueError:
            errs.append(f"{path}: created='{c}' não é data ISO (YYYY-MM-DD)")
    return errs

def main(argv):
    raw_targets = [Path(a) for a in argv[1:]] if len(argv) > 1 else list(VAULT.rglob("*.md"))
    # Correcao 2026-07-17: o filtro de IGNORED_DIRS/IGNORED_FILES so era
    # aplicado no modo "vault inteiro". Isso fazia o pre-commit hook (que
    # sempre passa argv explicito com os arquivos staged) falhar em
    # arquivos como SETUP.md, que sao intencionalmente isentos de
    # frontmatter. Aplicamos o mesmo filtro nos dois modos agora.
    targets = [
        p for p in raw_targets
        if not any(part in IGNORED_DIRS for part in p.parts) and p.name not in IGNORED_FILES
    ]
    all_errs = []
    for p in targets:
        if p.suffix == ".md" and p.exists():
            all_errs += check_file(p)
    if all_errs:
        print("VALIDAÇÃO FALHOU:\n" + "\n".join(f"  ✗ {e}" for e in all_errs))
        return 1
    print(f"✓ {len(targets)} nota(s) válida(s). Frontmatter OK.")
    return 0

if __name__ == "__main__":
    sys.exit(main(sys.argv))
