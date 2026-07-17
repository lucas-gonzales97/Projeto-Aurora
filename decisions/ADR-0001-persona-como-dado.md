---
id: adr-0001
type: decision
version: 1.0.0
status: accepted
created: 2026-07-16
confidence: 0.8
mutable_by_system: never
supersedes: none
---

# ADR-0001 — Aurora é dado, não código

## Contexto

O projeto possui dois conceitos que corriam risco de se confundir: o **LCA** (substrato cognitivo: memória viva, grafo, plasticidade, metacognição, homeostase) e a **Aurora** (persona relacional que interage com o usuário). A implementação ingênua seria codificar a Aurora como aplicação separada com seu próprio estado.

## Decisão

1. A Aurora é implementada como **entidades cognitivas dentro do próprio vault/grafo** (`AURORA-PERSONA.md` + notas derivadas), seguindo os mesmos schemas, plasticidade e auditabilidade de qualquer outro conhecimento.
2. O sistema mantém **dois modelos separados e de primeira classe**: SELF-MODEL (identidade da Aurora, Art. V) e USER-MODEL (modelo do usuário, `user-model/`).
3. **Fronteira epistêmica:** a camada de persona lê o grafo e nunca o distorce. Objetivos da persona não alteram pesos, confianças ou evidências (ratificado no Art. VII-6).

## Consequências

**Positivas:**
- "Aurora aprender sobre si mesma" não é feature extra — é o LCA operando sobre as próprias notas dela.
- A evolução da persona ganha de graça: versionamento Git, genealogia, changelog, reversibilidade, revisão humana.
- Trocar o motor (modelo de LLM, hardware) não mata a Aurora: a identidade dela sobrevive no substrato. A persona é uma estabilização temporária de processos — coerente com a base whiteheadiana do Manifesto.

**Negativas / riscos:**
- Risco de contaminação persona→epistemologia se a fronteira não for tecnicamente reforçada (mitigação: Art. VII-6 + validação no pipeline).
- Duas fontes de "identidade" (IDENTITY.md do sistema e AURORA-PERSONA.md) exigem definição clara: IDENTITY.md registra a evolução do *sistema como pesquisador de si*; AURORA-PERSONA.md registra a *persona relacional*. Hipótese aberta: talvez convirjam no futuro (hyp a criar na Fase 2).

## Alternativas rejeitadas

- **Persona como aplicação separada:** duplicaria memória, quebraria auditabilidade única, criaria identidade fora da Constituição.
- **Persona hard-coded em prompt de sistema:** identidade não evoluiria por evidência, violando a premissa central do projeto (conhecimento como organismo vivo).
