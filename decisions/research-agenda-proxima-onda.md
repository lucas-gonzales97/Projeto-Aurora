---
id: research-agenda-proxima-onda
type: meta
status: active
created: 2026-07-23
---

# Agenda de pesquisa — próxima onda (visão completa, 9 frentes)

Registro da visão levantada pelo Lucas em 22-23/07/2026 (áudio de visão +
conversa mobile), consolidada em três documentos de pesquisa com fontes:

- `research/PESQUISA-FRONTEIRA-COMPLETA-AURORA.md` — a agenda completa (11 partes,
  POCs priorizadas na Parte 11). Achado estrutural: o CoALA (arXiv 2309.02427)
  é o esqueleto teórico do NOESIS — as 4 memórias (working/episódica/semântica/
  procedural) mapeiam 1:1 no que já existe.
- `research/PESQUISA-MOTOR-ADAPTATIVO-AURORA.md` — roteamento por domínio,
  benchmark contínuo, emergência (HeLa-Mem, SoC, plasticidade Hebbiana+homeostática).
- `research/CONTEXTO-COMPLETO-22-07.md` — histórico consolidado dos 16 commits
  (genesis → ADR-0008).

## As frentes

1. **Nascimento zerado + base de conhecimento de fábrica** — separar núcleo
   imutável (Constituição, ontologia, regras de plasticidade) / seed genérico
   não-pessoal / dados do usuário (nascem vazios, sempre — princípio tornado
   permanente pelo bug #4 do ADR-0008). Cold start como entrevista adaptativa
   com síntese multi-perspectiva (Park et al. 2024).
2. **Persistência de chat como memória episódica crua** — camada 0 do CoALA:
   o chat persiste íntegro (SQLite local), o destilado sobe pro grafo.
   → POC executada em 23/07 (Bloco C).
3. **Multi-tenant + login: local-first com sync** — fonte primária = vault/SQLite
   local; conta = identidade + sincronização (Postgres+RLS como espelho cifrado),
   nunca moradia do dado (Art. VIII-5 preservado). Faseado: local → Supabase +
   sync custom → PowerSync se multi-dispositivo intenso.
4. **Visualização do grafo em tempo real ("sinapses")** — nós acendendo no
   retrieval, spreading activation visual, marca para nós emergidos.
   → POC v0 executada em 23/07 (Bloco D).
5. **Plasticidade contínua / emergência** — continual learning não-paramétrico:
   o aprendizado vive nas regras de atualização do grafo (Hebbiana fortalece,
   homeostática impede runaway, consolidação seletiva via reflexão). Métrica de
   emergência: razão emergido/inserido. Retrieval triplo (recência × importância
   × relevância, Generative Agents 2023) é o primeiro passo → POC executada em
   23/07 (Bloco B).
6. **Roteamento por domínio + benchmark contínuo + painel de capacidade** —
   `classifyDomain()` semântico + `domainModelMap` aprendido por minissuíte por
   domínio + LLM-as-judge (eval gate). Painel de capacidade multidimensional;
   "idade mental" só como apelido de UI documentado como metáfora, nunca como
   medida psicométrica validada.

## Frentes novas definidas pelo Lucas em 23/07 (discovery — não implementar ainda)

7. **Aurora Mobile** — segundo cliente da mesma conta/sync (desktop = fonte
   primária; backend Postgres+RLS = espelho; mobile v1 fala com o espelho).
   Stack candidata: React Native/Expo (reaproveita TS/React; push nativo = canal
   T0 de lembretes proativos; voz). Requisito duro: chats e memória idênticos
   desktop↔mobile, sem divergência. **Android primeiro** (iOS fora do escopo por
   ora). Inclui **controle remoto mobile→desktop** (evolução do "servidor caseiro
   via Tailscale" do ADR-0002): fila de comandos no backend de sync — o celular
   enfileira, o desktop escuta/executa/devolve resultado como evento, com
   aprovação humana para ações sensíveis (Art. VIII). Habilidades no mobile:
   subconjunto adaptado ao que o Android permite. A tabela sessions/messages do
   Bloco C é a semente desse sync.
8. **Habilidades/agência EMERGENTES por usuário** — a Aurora deve FAZER, não só
   pensar — mas o conjunto de habilidades NÃO é catálogo fixo: como cada Aurora
   nasce zerada para seu usuário (e nem todo usuário é dev), as habilidades
   emergem da necessidade de cada um. Modelo: **skill library emergente**
   (precedente: Voyager 2023; no CoALA = escrever na memória PROCEDURAL — a 4ª
   memória, até agora subutilizada no NOESIS). Loop de aquisição (reaplica o
   ciclo de estratégias-como-hipóteses do EXTENSAO-USER-MODEL-STRATEGIES, agora
   para capacidades): (1) telemetria de domínio + pedidos frustrados revelam a
   necessidade; (2) Aurora PROPÕE a habilidade, com consentimento (Art. VIII);
   (3) ADQUIRE (servidor MCP existente do ecossistema) ou CONSTRÓI (skill
   própria); (4) TESTA em sandbox; (5) VALIDA com feedback do usuário;
   (6) refina/promove/descarta — cada aquisição registrada como evento. Insight
   de infra: tornar o Aurora Desktop também host/cliente MCP dá acesso ao
   ecossistema inteiro de "mãos" prontas (filesystem, git, browser, terminal).
   Camadas: (1) tools via MCP; (2) skills por domínio casadas com o roteador;
   (3) computer use/RPA como fase posterior. Governança obrigatória: Art. VIII +
   MODEL-ROUTER — teto de iterações/orçamento declarado antes de todo loop
   agêntico; ação irreversível exige aprovação humana. Pesquisa formal do estado
   da arte (Voyager/skill libraries, Agent SDK, computer use, frameworks
   agênticos, catálogo/registry MCP) antes de qualquer implementação.
9. **Cascas adicionais privadas (retomada do ADR-0002, item 3)** —
   (a) **Extensão VS Code** privada (.vsix local, sem marketplace): **agente
   pleno dentro do editor**, nível Claude Code / Copilot agent mode —
   editar/criar/apagar arquivos, navegar workspace, rodar terminal — falando com
   o mesmo {vault + noesis-mcp + roteador}. Caso de uso fundador:
   **auto-construção** — a Aurora participando do desenvolvimento do próprio
   código, com memória integral das decisões arquiteturais. (b) **Extensão
   Chrome** privada (descompactada, modo desenvolvedor, sem Web Store): side
   panel de chat + content scripts para ler/agir na página, comunicando com o
   Aurora Desktop via servidor local; conecta com a camada de browser-automation
   da Frente 8. Ambas são "cascas sobre {Agent SDK + noesis-mcp + vault}" —
   nada é publicado, tudo local.

## Estado

- POCs 1-3 da Parte 11 (retrieval triplo, persistência de chat, visualização
  do grafo) executadas na sessão de 23/07 — ver ADRs 0010/0011/0012 e
  `journal/2026-07-23.md`.
- Frentes 7-9 são discovery: exigem pesquisa formal antes de implementação.
- Números/versões dos documentos de pesquisa são snapshot de jul/2026 —
  revalidar antes de citar em decisão formal.
