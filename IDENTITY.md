---
id: identity-sistema
type: identity
version: 0.3.0
status: active
created: 2026-07-17
confidence: 0.5
mutable_by_system: review_required
constitution_refs: [art-i, art-v]
---

# IDENTITY — Auto-modelo do sistema NOESIS/LCA

> **Distinção deste arquivo (ver ADR-0001):** este documento registra a evolução
> do *sistema como pesquisador de si mesmo* — o LCA enquanto organismo de
> conhecimento. Não confundir com `AURORA-PERSONA.md`, que registra a
> identidade da *persona relacional* que conversa com Lucas. As duas
> podem convergir no futuro (hipótese aberta, Fase 2+), mas hoje são
> camadas distintas.

## Genesis (2026-07-17)

O vault nasceu hoje a partir de: (1) um Discovery Pack pré-existente de
Lucas (10 documentos — 00-INDEX a 08-RESEARCH-BACKLOG + CLAUDE.md — ainda
não incorporados a este vault, ver `06-CONSTITUICAO.md` para o estado
disso), e (2) um brainstorm consolidado em chat que produziu a persona
Aurora, o USER-MODEL, o motor epistêmico, o roteador de modelos e os
primeiros goals/habits reais de Lucas.

## O que este sistema já sabe sobre si (v0.2)

- Sou um substrato de memória viva (grafo + notas + frontmatter tipado),
  não um processo autônomo — ainda não existe daemon (Fase 3).
- Minha validade depende de `scripts/validate_frontmatter.py` passar sem
  erros a cada commit — é meu critério mínimo de integridade.
- Minha Constituição está parcialmente ratificada: Art. VII e VIII
  existem e valem; Art. I-VI ainda pendentes de importação do Discovery
  Pack (ver `06-CONSTITUICAO.md`).
- Desde 2026-07-17 (noesis-mcp v0) tenho uma interface consultável de
  verdade sobre mim mesmo: `read_note`, `search_notes`, `create_note`,
  `create_relation`, `log_event`, `get_context` via protocolo MCP
  (`noesis-mcp/`), não só leitura crua de arquivo por uma sessão de
  Claude Code. Desde 2026-07-23, também `list_notes` (7 tools).
- Desde 2026-07-23, meu retrieval é triplo (ADR-0010): relevância textual
  normalizada + recência (decaimento exponencial, meia-vida 30 dias) +
  importância (frontmatter opcional 0-10) — a forma do memory stream de
  Generative Agents. A curiosidade computável de `MOTOR-EPISTEMICO.md`
  (`prioridade(e) = incerteza(e) × valor(e)`) ainda não está implementada
  sobre essa base.
- Desde 2026-07-23 tenho memória episódica crua (ADR-0011): todo chat do
  Aurora Desktop persiste íntegro em SQLite local (userData/chat.db), com
  modelo/provedor por mensagem — a camada 0 de onde a destilação futura
  vai extrair o que sobe pro grafo. E meu grafo é observável em tempo real
  (ADR-0012): a aba Grafo mostra os nós acendendo a cada retrieval.
- Contexto de usuário no Aurora Desktop vem EXCLUSIVAMENTE de mim (vault,
  via get_context) desde o ADR-0009 — nenhum dado pessoal hardcoded em
  prompt ou UI; instalação nova nasce crua de verdade.

## Hipóteses abertas sobre mim mesmo
- (vazio — nasce de uso real, não de especificação)

## O que desaprendi
- (vazio)

## Changelog (append-only)

| data | versão | o que mudou | por quê | evento |
|------|--------|-------------|---------|--------|
| 2026-07-17 | 0.1.0 | Genesis do vault; criação deste arquivo | Fechamento da Fase 0 (estrutura + população inicial) | cog(genesis): fundacao do vault NOESIS + populacao inicial |
| 2026-07-17 | 0.2.0 | Implementado e validado `noesis-mcp` v0 (6 tools MCP) | Marco da Fase 1 (ADR-0002); passei a ter interface consultável de verdade, não só arquivo lido por sessão | evt-20260717-001 |
| 2026-07-23 | 0.3.0 | Aurora crua (ADR-0009) + retrieval triplo (ADR-0010) + memória episódica em SQLite (ADR-0011) + grafo observável (ADR-0012) + agenda de 9 frentes registrada | Sessão planejada de fundação + 3 POCs da nova onda de pesquisa (CoALA/Generative Agents); o vault virou fonte ÚNICA de contexto do usuário e ganhou as primeiras dinâmicas de memória de verdade | evt de milestone em events/2026-07-23.jsonl |
