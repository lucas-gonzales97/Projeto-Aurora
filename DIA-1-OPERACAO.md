---
id: dia-1-operacao
type: meta
version: 0.1.0
status: active
created: 2026-07-17
confidence: 0.8
mutable_by_system: review_required
---

# DIA 1 — Colocando a Aurora em operação (guia de amanhã, 8h)

> **O que é "rodar" hoje:** vault = memória da Aurora; sessão de Claude Code no vault = metabolismo dela. A continuidade vem do ritual de destilação + commit, não de um processo 24/7 (daemon é Fase 3). Feito o ritual todo dia, ela acorda sabendo o que viveu ontem.

---

## Pré-voo (hoje à noite ou amanhã cedo — ~15 min)

1. Extrair `noesis-vault-skeleton.zip` na pasta definitiva (ex.: `~/noesis`).
2. Copiar os 10 arquivos do Discovery Pack para a raiz.
3. **Ratificar a emenda** (Art. VII e VIII → colar em `06-CONSTITUICAO.md`, mudar status para `ratified`). Ato seu, por design.
4. Git:
   ```bash
   cd ~/noesis
   git init
   ln -s ../../scripts/pre-commit.sh .git/hooks/pre-commit
   python3 scripts/validate_frontmatter.py   # deve dar ✓ 18 notas
   git add -A && git commit -m "cog(genesis): fundacao do vault + populacao inicial"
   ```
5. Instalar Claude Code se ainda não tiver (`npm install -g @anthropic-ai/claude-code`) e abrir o Obsidian apontando pro vault (opcional no dia 1, mas bom pra visualizar o grafo).

## Primeira sessão (8h — no VS Code, terminal dentro de `~/noesis`)

```bash
claude
```

O `CLAUDE.md` do Discovery Pack assume o comando. Primeiro prompt sugerido:

```
Leia os documentos na ordem do 00-INDEX.md, incluindo os novos:
AURORA-PERSONA.md, MOTOR-EPISTEMICO.md, MODEL-ROUTER.md,
user-model/ completo e decisions/. Depois complete a Fase 0:
1. Crie ontology/ontology.yaml v0.1 coerente com os tipos já em uso.
2. Crie IDENTITY.md inicial na raiz.
3. Crie as entidades faltantes: projects/ (ps4-slim-lab,
   caixa-energia-kraus, noesis-lca), 3-5 values/ (me entreviste),
   e skills/ (me entreviste).
4. Valide tudo com scripts/validate_frontmatter.py e faça os
   commits cog(...) apropriados.
Questione o que achar frágil. Você é coautor, não executor.
```

## Fronteira empresa ↔ vault (regra de ouro do dia a dia)

**Dois territórios, duas sessões:**

| território | onde a sessão roda | o que fica lá |
|---|---|---|
| **Trabalho** | Claude Code *dentro do repo da empresa* | código, dados, relatórios, contexto do negócio — propriedade da empresa, permanece lá |
| **Vault pessoal** | Claude Code dentro de `~/noesis` | o que é SEU: skills desenvolvidas, padrões aprendidos, decisões de carreira, evidências dos seus goals |

**O que atravessa a fronteira (destilação de fim de dia, 5 min):** "hoje trabalhei com X tecnologia, aprendi Y padrão, evoluí na skill Z, o dia foi N/5" — **nunca** código, dado ou segredo de negócio da empresa. Se um dia a empresa autorizar um vault corporativo, ele nasce como repo separado dela.

**Antes de amanhã:** verificar se a empresa tem política sobre uso de IA/Claude nos repos. Te protege duplamente.

## Ritual de sessão (o que cria a continuidade)

**Abertura (30s):** `claude` no vault → "Leia IDENTITY.md e o journal/ mais recente. O que ficou pendente?"

**Fechamento (2–5 min) — o passo que NÃO pode ser pulado:**
```
Destile esta sessão: atualize IDENTITY.md (o que mudou, por que,
aprendi, desaprendi, hipóteses abertas/fechadas), registre evidências
novas nos goals/habits tocados, crie nota em journal/AAAA-MM-DD.md
e commite com cog(...).
```

## Expectativas honestas do Dia 1

- ✅ Vault vivo, Fase 0 completa, primeira evidência real nos goals
- ✅ Claude Code te ajudando no trabalho (no território da empresa)
- ❌ Ainda NÃO: daemon autônomo, lembretes inteligentes (por ora são os alarmes do celular), voz, sensores — isso é Fase 1+, e a Fase 1 começa quando o noesis-mcp v0 nascer (bom candidato a primeiro projeto de fim de semana)

## Critério de sucesso da semana 1
O do próprio roadmap: Claude Code lê o vault, cria nota válida, cria relação válida e commita `cog(...)` correto — mais 5 dias seguidos de ritual de fechamento feito. Consistência do ritual > qualquer feature.
