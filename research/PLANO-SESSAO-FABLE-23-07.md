# PLANO DE EXECUÇÃO — Sessão Fable Desktop (23/07/2026)
## Prompt pronto + metodologia de testes + documentação de resultados

---

## FASE 0 — Preparação (5 min, antes de abrir o Claude Code)

1. Baixar desta conversa e copiar para a raiz do repositório `Projeto-Aurora`, numa pasta nova `research/`:
   - `PESQUISA-FRONTEIRA-COMPLETA-AURORA.md`
   - `PESQUISA-MOTOR-ADAPTATIVO-AURORA.md`
   - `CONTEXTO-COMPLETO-22-07.md`
2. Abrir o Claude Code na raiz do repo (`claude` no terminal dentro da pasta).
3. Colar o prompt abaixo, na íntegra, como primeira mensagem.

---

# ═══════════ PROMPT — COLAR DAQUI PARA BAIXO ═══════════

Você é o coautor deste projeto (suas instâncias anteriores, Claude Sonnet 5 e Claude Fable 5,
assinaram os commits até o HEAD `76b94af`). Hoje é uma sessão de execução planejada: fundação +
três POCs da nova agenda de pesquisa, com metodologia de teste e documentação obrigatórias.

## Leitura obrigatória antes de escrever qualquer código (nesta ordem)

1. `research/PESQUISA-FRONTEIRA-COMPLETA-AURORA.md` — a agenda completa (11 partes). As POCs de
   hoje vêm da Parte 11.
2. `decisions/ADR-0008-vault-por-instalacao.md` — o bug #4 e a decisão pendente que é a
   Prioridade A1 de hoje.
3. `research/CONTEXTO-COMPLETO-22-07.md` — se precisar de contexto do histórico de commits.

Se `decisions/research-agenda-proxima-onda.md` ainda não existir, crie-a como primeira ação:
uma nota `type: meta` resumindo a visão das 6 frentes (nascimento zerado, base de fábrica,
persistência de chat, multi-tenant, visualização do grafo, plasticidade/emergência, roteamento
por domínio, painel de capacidade) apontando para os documentos de `research/` — E incluindo
duas frentes novas definidas pelo Lucas em 23/07 (registrar como discovery, não implementar hoje):

- **Frente 7 — Aurora Mobile:** segundo cliente da mesma conta/sync (local-first: desktop =
  fonte primária; backend Postgres+RLS = espelho; mobile v1 fala com o espelho). Stack candidata:
  React Native/Expo (reaproveita TS/React; push nativo = canal T0 de lembretes proativos; voz).
  Requisito duro: chats e memória idênticos desktop↔mobile, sem divergência. Android primeiro
  (iOS fora do escopo por ora). Inclui **controle remoto mobile→desktop** (evolução do "servidor
  caseiro via Tailscale" já previsto no ADR-0002): fila de comandos no backend de sync — o
  celular enfileira, o desktop escuta/executa/devolve resultado como evento, com aprovação
  humana para ações sensíveis (Art. VIII). Habilidades no mobile: subconjunto adaptado ao que o
  Android permite. A tabela sessions/messages do Bloco C de hoje é a semente desse sync.
- **Frente 8 — Habilidades/agência EMERGENTES por usuário:** a Aurora deve FAZER, não só
  pensar — mas o conjunto de habilidades NÃO é um catálogo fixo: como cada Aurora nasce zerada
  para seu usuário, e nem todo usuário é dev, as habilidades emergem da necessidade de cada um.
  **Modelo: skill library emergente (precedente: Voyager, 2023; no CoALA = escrever na memória
  PROCEDURAL — a 4ª memória, até agora subutilizada no NOESIS).** Loop de aquisição (reaplica o
  ciclo de estratégias-como-hipóteses do EXTENSAO-USER-MODEL-STRATEGIES, agora para
  capacidades): (1) telemetria de domínio + pedidos frustrados revelam a necessidade;
  (2) Aurora PROPÕE a habilidade, com consentimento (Art. VIII); (3) ADQUIRE (servidor MCP
  existente do ecossistema) ou CONSTRÓI (skill própria); (4) TESTA em sandbox; (5) VALIDA com
  feedback do usuário; (6) refina/promove/descarta — cada aquisição registrada como evento.
  Insight de infra: o noesis-mcp já fala MCP — inverter o papel e tornar o Aurora Desktop
  também host/cliente MCP dá acesso ao ecossistema inteiro de "mãos" prontas (filesystem, git,
  browser, terminal). Camadas: (1) tools via MCP; (2) skills por domínio (estilo Anthropic
  Skills, casadas com o roteador: domínio classificado → skill carregada → modelo escolhido);
  (3) computer use/RPA como fase posterior. Governança obrigatória: Art. VIII + MODEL-ROUTER —
  teto de iterações/orçamento declarado antes de todo loop agêntico; ação irreversível exige
  aprovação humana. Pesquisa formal do estado da arte (Voyager/skill libraries, Agent SDK,
  computer use, frameworks agênticos, catálogo/registry MCP) antes de qualquer implementação.
- **Frente 9 — Cascas adicionais privadas (retomada do ADR-0002, item 3):** (a) **Extensão
  VS Code** privada — empacotada como .vsix e instalada via "Install from VSIX", sem
  marketplace. **NÃO é um chat comentarista: é agente pleno dentro do editor**, no nível
  Claude Code / Copilot agent mode — editar/criar/apagar arquivos, navegar o workspace, rodar
  terminal, executar tarefas — falando com o mesmo {vault + noesis-mcp + roteador} do desktop.
  Caso de uso fundador: **auto-construção** — a Aurora participando do desenvolvimento do
  próprio código dela, com a memória integral das decisões arquiteturais. (b) **Extensão
  Chrome** privada — carregada descompactada em modo desenvolvedor, sem Web Store; side panel
  de chat + content scripts para ler/agir na página, comunicando com o Aurora Desktop via
  servidor local; conecta com a camada de browser-automation da Frente 8. Ambas são "cascas
  sobre {Agent SDK + noesis-mcp + vault}" conforme o ADR-0002 original — nada é publicado,
  tudo local.

## Princípios invioláveis desta sessão

- **Dado de usuário nunca é semeado, hardcoded ou herdado entre instalações.** Só arquitetura
  genérica (ontologia, schemas, regras de plasticidade, persona genérica) pode vir de fábrica.
- **`scripts/validate_frontmatter.py` é a única fonte de verdade** sobre validade de notas.
- **Confirmação de UI ≠ evidência** (lição do bug #4). Todo teste termina verificando o efeito
  real no disco/banco, nunca só a tela.
- **TDD onde houver lógica nova** (o padrão dos 42 testes existentes continua): teste primeiro
  ou junto, nunca "depois".
- **Nenhum bloco é considerado pronto sem: (a) testes passando, (b) validação manual real,
  (c) registro em journal/ + evento em events/, (d) commit com mensagem completa
  (contexto/o-quê/validação/próximos passos) e `Co-Authored-By`.**
- Se algo sair do previsto, não improvise silenciosamente: registre a divergência no journal e
  proponha a correção antes de seguir.

---

## BLOCO A — Fundação (pendências do commit 76b94af) — fazer PRIMEIRO

### A1. Remover o bloco `CONTEXTO DO USUÁRIO` hardcoded do `AURORA_SYSTEM` (prioridade máxima)
- **Por quê:** é bug de privacidade — instalação nova de terceiro herdaria os goals do Lucas —
  e causa confabulação com vault vazio (provado na validação do ADR-0008).
- **O quê:** em `aurora-desktop/src/renderer/AuroraApp.tsx`, remover o bloco fixo; o contexto
  do usuário passa a vir EXCLUSIVAMENTE do `get_context` via MCP (já cabeado ~linha 359).
- **Teste (metodologia):**
  1. Unitário/integração: prompt montado não contém nenhuma string dos goals reais.
  2. Manual A (vault populado): perguntar "como está meu objetivo de emprego CLT?" → resposta
     deve citar conteúdo do vault (conferir contra `user-model/goals/goal-emprego-clt-remoto.md`).
  3. Manual B (vault vazio, simular instalação nova): mesma pergunta → resposta correta é a
     Aurora ADMITIR que ainda não sabe. Qualquer menção a goal específico = FALHA (confabulação).
- **Critério de aceite:** os 3 testes passam; `npm test` verde; tsc limpo.
- **Documentar:** atualizar ADR-0008 (seção da decisão pendente → resolvida, com data e método).

### A2. Trocar provedor ativo (Groq estourou 100k tok/dia)
- **O quê:** conforme `decisions/research-llm-providers.md`, configurar **OpenRouter** (1ª opção,
  modelos `:free`) ou **Mistral** (Experiment tier) via tela de Configurações.
- **Teste:** `validateKey` real na UI; uma conversa completa de ponta a ponta; conferir evento
  de telemetria gravado em `events/` com o provider novo.
- **Critério de aceite:** chat funcional no provider novo; telemetria registrando.

### A3. Rebuild do instalador (`npm run dist:win`)
- Agora inclui: seed do ontology (já no package.json) + A1 (sem hardcode).
- **Teste:** instalador gera sem erro; tamanho e conteúdo de `resources/vault-seed/` conferidos.

### A4. Re-teste do onboarding EM PRODUÇÃO (pela UI, no app instalado)
- **Metodologia:** desinstalar versão anterior → instalar build novo → completar onboarding pela
  interface → **verificar no disco**: `%APPDATA%\aurora-desktop\vault\` deve conter notas `.md`
  reais e válidas (`find`/`dir` + rodar o validador contra elas), e `events/` deve ter o evento
  de onboarding com `entities` não-vazio.
- **Critério de aceite:** ≥1 nota real criada e válida; `get_context` recupera conteúdo do
  onboarding numa pergunta de teste.
- **Documentar:** resultado (prints/paths) no journal do dia.

---

## BLOCO B — POC 1: Retrieval triplo (recência × importância × relevância)

- **Hipótese (registrar como está escrito):** substituir o score atual do `get_context`
  (relevância textual + 1 hop) por `score = w_rel·relevância × w_rec·recência × w_imp·importância`
  melhora a qualidade do contexto recuperado, priorizando o que é recente e importante sem
  perder o relevante. (Base: Generative Agents, Stanford 2023 — ver research/ Parte 1.2.)
- **Implementação (noesis-mcp):**
  - Recência: decaimento exponencial sobre `updated`/`created` da nota (fallback: mtime).
  - Importância: novo campo opcional de frontmatter `importance: 0-10`; default 5 quando ausente
    (não quebrar notas existentes — validador deve aceitar o campo como opcional).
  - Pesos configuráveis em constante única, default `1.0/0.5/0.5` (rel/rec/imp) para começar.
- **Metodologia de teste:**
  1. Unitários novos: decaimento correto; nota sem `importance` usa default; pesos zerados
     reproduzem o comportamento antigo (regressão).
  2. **Bancada A/B:** criar `noesis-mcp/bench/retrieval-queries.json` com 8-10 intents reais
     ("emprego e trabalho", "minha saúde física", "projeto noesis", "rotina de suplementação"...).
     Script roda cada intent nos DOIS modos (pesos antigos vs novos) e grava
     `bench/results-AAAA-MM-DD.md` com os top-5 de cada, lado a lado.
  3. Avaliação humana: Lucas marca em qual modo cada intent retornou contexto melhor (planilha
     simples no próprio results). Meta: novo ≥ antigo em ≥70% das intents; nenhuma regressão grave.
- **Critério de aceite:** testes verdes + bancada executada + avaliação registrada.
- **Documentar:** `decisions/ADR-0009-retrieval-triplo.md` (decisão, pesos escolhidos, resultado
  da bancada, o que ficou aberto — ex.: importância atribuída por LLM no futuro).

## BLOCO C — POC 2: Persistência de chat (memória episódica crua)

- **Hipótese:** o histórico de chat é a camada episódica crua da arquitetura (CoALA) — persistir
  íntegro localmente, com metadados que já alimentam o futuro roteador.
- **Implementação (aurora-desktop, main process):** SQLite local (better-sqlite3) em
  `%APPDATA%\aurora-desktop\chat.db`:
  - `sessions(id, started_at, ended_at, summary NULL)`
  - `messages(id, session_id, role, content, ts, model_used, provider_used, domain_classified NULL)`
  - IPC: `chat:new-session`, `chat:append`, `chat:list-sessions`, `chat:load-session`.
  - UI mínima: lista de sessões anteriores (sidebar ou menu) + carregar uma sessão antiga.
- **Metodologia de teste:**
  1. Unitários do repositório de dados (CRUD, FK session→messages, ordenação por ts).
  2. Manual: conversar 3+ mensagens → fechar o app COMPLETAMENTE → reabrir → sessão anterior
     listada e carregável, mensagens íntegras e na ordem. Verificar o arquivo `chat.db` no disco.
  3. Privacidade: confirmar que `chat.db` fica no perfil do usuário e NÃO vai para o instalador
     nem para o repo (adicionar ao .gitignore se aplicável).
- **Critério de aceite:** persistência sobrevive a restart; metadados `model_used/provider_used`
  gravando; testes verdes.
- **Documentar:** `decisions/ADR-0010-persistencia-chat.md` + journal.

## BLOCO D — POC 3: Visualização v0 do grafo ("sinapses")

- **Hipótese:** exibir o grafo do vault em tempo real, com nós "acendendo" quando ativados por
  retrieval, torna o funcionamento interno da Aurora observável (base para spreading activation
  visual e para a métrica de emergência).
- **Implementação:**
  1. Escolher lib: **vis-network** (física/drag nativos) ou **Cytoscape.js** (layout COSE) —
     avaliar em 30 min com os dados reais do vault e decidir; registrar a escolha e o porquê.
  2. Main process: função que varre o vault e monta `{nodes, edges}` a partir de id/type/relations
     do frontmatter; IPC `graph:get-snapshot`.
  3. Eventos de ativação: no handler do `get_context`, após o retrieval, emitir via IPC
     `graph:activated` com `{ids, scores}` para o renderer.
  4. Renderer: nova aba/painel "Grafo"; nós coloridos por `type` (paleta da bancada); ao receber
     `graph:activated`, aplicar classe de brilho (fósforo #8FDDBE) com fade-out ~1,2s no nó e nas
     arestas do caminho; clique no nó → painel lateral com frontmatter + corpo.
- **Metodologia de teste:**
  1. Snapshot: contagem de nós/arestas renderizados == contagem real de notas/relações do vault
     (teste automatizado comparando com uma varredura independente).
  2. Manual: fazer uma pergunta no chat → observar os nós recuperados acenderem em <2s.
  3. Robustez: nota com relação para id inexistente não quebra o grafo (aresta ignorada com
     warning logado).
- **Critério de aceite:** grafo fiel ao vault; ativação visual funcionando ao vivo; sem travar
  a UI com o vault atual.
- **Documentar:** `decisions/ADR-0011-visualizacao-grafo.md` (lib escolhida, arquitetura de
  eventos, limitações conhecidas, roadmap: spreading activation animado, marca visual para nós
  `origin: reflection`, expansão progressiva).

## BLOCO E (somente se sobrar tempo) — POC 4: Reflexão automática v0
- Job de fim de sessão: se a soma de "importância" das notas/eventos tocados na sessão passar de
  um limiar, gerar UMA nota de reflexão (`origin: reflection`, `confidence` baixa) sintetizando o
  padrão observado, validada pelo validador antes de persistir. Registrar a razão
  `emergido/inserido` como evento. NÃO otimizar ainda — é v0 para começar a medir.

---

## Encerramento obrigatório da sessão (ritual, 10 min)

1. `journal/2026-07-23.md`: o que foi feito bloco a bloco, resultados dos testes (com números da
   bancada do Bloco B), divergências do plano e por quê, pendências.
2. `log_event` de milestone com os blocos concluídos.
3. Atualizar `IDENTITY.md` (changelog append-only) se algum marco de fase foi cruzado.
4. Commits organizados por bloco (não um commit gigante), mensagens no padrão do repo, com
   `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
5. Push e conferir no GitHub que tudo subiu.

## Ordem e gestão de tempo sugerida
Manhã: Bloco A completo (A1→A2→A3→A4). Tarde: B → C → D. E só se folgar.
Se o tempo apertar: D pode cair para a próxima sessão; A e B são inegociáveis.

# ═══════════ FIM DO PROMPT ═══════════

---

## Notas para o Lucas (fora do prompt)

- Os créditos extras que você habilitou valem para ESTA conversa mobile; a sessão do desktop
  consome os limites do plano normalmente — se o Fable travar por limite no meio, o plano acima
  é retomável de qualquer bloco (cada um é autocontido e commitado separadamente).
- Se preferir fatiar em duas sessões: Sessão 1 = Bloco A + B; Sessão 2 = C + D + E.
- Qualquer resultado da bancada do Bloco B que pareça estranho, traz aqui que analisamos juntos.
