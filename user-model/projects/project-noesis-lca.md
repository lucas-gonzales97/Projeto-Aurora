---
id: project-noesis-lca
type: project
status: active
created: 2026-07-17
origin: declared
domain: software
current_focus: "noesis-mcp v0 implementado e testado; usar de verdade (reload do Claude Code) e rodar o ritual do Dia 1 com os tools reais"
next_action: "Recarregar o Claude Code para carregar .mcp.json, rodar o ritual de abertura/fechamento do Dia 1 usando get_context/log_event de verdade, e entrevistar Lucas para popular user-model/values/"
blockers: ["Art. I-VI da Constituição ainda não importados do Discovery Pack"]
log: journal-links/
relations:
  - target: goal-concluir-faculdade
    kind: pode_usar_como_meio
    weight: 0.9
    reason: "Hipótese já registrada em goal-concluir-faculdade.md: o próprio NOESIS pode ser o TCC da Fatec."
    evidence: []
---

# Project — NOESIS / LCA

## O que é
O projeto guarda-chuva: o LCA (substrato cognitivo) + a Aurora (persona
que emerge dele). Este vault É o projeto em produção — cada nota, ADR e
goal aqui dentro é ao mesmo tempo infraestrutura viva e evidência para o
possível TCC.

## Estado em 2026-07-17 (genesis do vault)
Fase 0 em andamento: estrutura de pastas criada, população inicial de
goals/habits/rotinas feita, Constituição parcialmente ratificada (Art.
VII-VIII sim, Art. I-VI pendentes), `IDENTITY.md` e `ontology/ontology.yaml`
v0.1 criados nesta mesma genesis. Ainda faltam `values/` (aguardando
entrevista com Lucas) e mais `skills/` além das 3 iniciais já registradas
a partir do autorrelato profissional.

## Estado em 2026-07-17 (noesis-mcp v0)
`noesis-mcp/` implementado (TypeScript, `@modelcontextprotocol/sdk`): os 6
tools do ADR-0002 (`read_note`, `search_notes`, `create_note`,
`create_relation`, `log_event`, `get_context`) rodando e validados via um
cliente MCP real sobre stdio — não só chamada direta de função. Registrado
em `.mcp.json` na raiz do vault. `create_note`/`create_relation` usam
`scripts/validate_frontmatter.py` como fonte única de verdade (escrevem,
validam via subprocesso, desfazem se falhar); `create_relation` edita o
YAML cirurgicamente (lib `yaml`) para não reformatar o resto da nota a
cada relação nova — bug real encontrado e corrigido durante o teste
(round-trip via `gray-matter`/`js-yaml` estava convertendo `created` em
timestamp ISO completo e reformatando strings longas). Ver
`noesis-mcp/README.md`. Fase 1 do roadmap (ADR-0002) destravada: próximo
marco de código é Aurora Desktop v0, mas antes disso o servidor precisa
ser usado de verdade numa sessão normal (não só testado).
