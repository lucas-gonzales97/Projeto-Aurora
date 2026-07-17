#!/bin/sh
# NOESIS pre-commit: valida frontmatter das notas staged antes do commit
FILES=$(git diff --cached --name-only --diff-filter=ACM | grep '\.md$')
[ -z "$FILES" ] && exit 0
python3 scripts/validate_frontmatter.py $FILES || {
  echo "Commit bloqueado: corrija o frontmatter acima (Fase 0, roadmap)."; exit 1; }
