# NOESIS Vault — Setup (Fase 0)

## O que é este pacote
Esqueleto do vault com as 15 entidades cognitivas fundacionais criadas em coautoria
(persona, user-model, motor epistêmico, roteador de modelos, 8 goals, 1 habit, 2 decisões)
+ validador de frontmatter exigido pelo roadmap.

## Passos
1. Extraia esta pasta onde será o vault Obsidian.
2. **Copie os 10 arquivos do Discovery Pack** (00-INDEX ... 08-RESEARCH-BACKLOG + CLAUDE.md) para a RAIZ.
3. **Ratifique a emenda**: leia `decisions/EMENDA-CONSTITUCIONAL-ART-VII-VIII.md`, ajuste se quiser,
   cole os Artigos VII e VIII em `06-CONSTITUICAO.md` e mude o status da emenda para `ratified`.
   Este passo é SEU — o sistema não pode fazê-lo.
4. Git:
   ```
   git init
   ln -s ../../scripts/pre-commit.sh .git/hooks/pre-commit
   python3 scripts/validate_frontmatter.py     # deve passar
   git add -A && git commit -m "cog(genesis): fundacao do vault NOESIS + populacao inicial"
   ```
5. Abra no Obsidian (vault = esta pasta) e no Claude Code (repo = esta pasta).
   O CLAUDE.md do Discovery Pack assume o comando a partir daí.

## Pendências da Fase 0 (checklist do roadmap)
- [ ] `ontology/ontology.yaml` v0.1
- [ ] `IDENTITY.md` inicial na raiz
- [ ] Completar 15–30 entidades: faltam `projects/` (ps4-slim-lab, caixa-energia-kraus, noesis-lca),
      `values/` (3–5 declarados) e `skills/` — goals e habit já populados
- [ ] Executar as `next_action` de cada goal (as evidências iniciais do grafo)
