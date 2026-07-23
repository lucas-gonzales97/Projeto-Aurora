# AURORA / NOESIS — Pesquisa de Fronteira Completa
## Estado da arte em todas as frentes da visão, com fontes — material de trabalho para as sessões com Fable no desktop

> Data: 22/07/2026. Escopo: as frentes levantadas por Lucas no áudio de visão (Aurora nascendo
> zerada, base de conhecimento de fábrica, persistência de chat, multi-tenant com login,
> visualização do grafo em tempo real, plasticidade contínua, roteamento multi-modelo por
> domínio, benchmark contínuo, emergência, "idade mental"). Complementa e integra o relatório
> anterior (PESQUISA-MOTOR-ADAPTATIVO-AURORA.md) — as camadas de roteamento/benchmark/emergência
> aparecem aqui resumidas e conectadas ao todo, não repetidas na íntegra.
> Números de estrelas, versões e benchmarks mudam rápido: revalidar antes de citar em decisão formal.

---

# PARTE 0 — O mapa: uma descoberta que organiza tudo

Antes das frentes individuais, o achado estrutural mais importante desta pesquisa:
**a visão da Aurora já tem um "esqueleto teórico" publicado e amplamente adotado — o CoALA
(Cognitive Architectures for Language Agents, Sumers/Yao/Narasimhan/Griffiths, TMLR 2023,
arXiv 2309.02427).** É o framework de referência que o campo inteiro usa para organizar
agentes de linguagem, e ele mapeia quase um-para-um no que o NOESIS já desenha:

| CoALA | NOESIS/Aurora (hoje) |
|---|---|
| Working memory (contexto da conversa atual) | contexto da sessão no Aurora Desktop |
| Episodic memory (registros cronológicos de experiências) | `journal/` + `events/*.jsonl` |
| Semantic memory (conhecimento geral/fatos) | `user-model/`, notas do vault |
| Procedural memory (habilidades/código) | skills/, o próprio código do noesis-mcp |
| Decision cycle (planejar → agir → observar) | ciclo de sessão + ritual de destilação |
| Ações internas: retrieval / reasoning / learning | get_context / LLM / create_note+log_event |

**Por que isso importa:** (1) valida que a arquitetura não é excêntrica — está alinhada com a
fronteira; (2) dá vocabulário padrão para conversar com a literatura (tudo que se pesquisar em
"episodic memory for LLM agents" se aplica diretamente); (3) expõe uma lacuna conhecida do
próprio CoALA que o NOESIS pode resolver melhor: uma crítica publicada (arXiv 2604.11364)
aponta que o CoALA **não distingue a semântica de persistência** entre memória semântica e
episódica — ambas viram "long-term memory" sem diferença formal de mecanismo de atualização ou
decaimento. O fato "LoRA atinge 95% do full fine-tuning" (deve ser *superado* por evidência
nova, nunca esquecido) e a experiência "o usuário me corrigiu ontem" (deve *decair* se não for
consolidada) habitam a mesma categoria. O NOESIS já tem os campos para resolver isso
(confidence, recency, evidence, status) — falta formalizar as **regras de transição** distintas
por tipo. Isso é contribuição original possível, inclusive para o TCC.

---

# PARTE 1 — Memória de longo prazo e persistência de conversas

## 1.1 O campo em 2026: cinco arquiteturas dominantes

A área explodiu. As referências, cada uma com uma aposta estrutural diferente:

- **Mem0** (~48k estrelas, open-source + cloud): a camada de memória "drop-in" mais adotada.
  Extrai fatos das conversas, armazena com embeddings, faz **consolidação semântica** (funde
  informação relacionada, resolve conflitos, poda redundância) e **esquecimento inteligente**
  (despriorizacão de entradas velhas/irrelevantes). Variante **Mem0g** armazena memórias como
  grafo dirigido rotulado (entidades como nós, relações como arestas).
- **Zep / Graphiti** (Graphiti ~26,9k estrelas, Apache 2.0): a aposta em **grafo de conhecimento
  temporal**. Cada fato tem *janela de validade temporal* — o sistema sabe não só o que você
  disse mas quando, e o que era verdade em qual período. Forte em consultas do tipo "como
  estavam os goals desse usuário no Q1 vs. agora". Trade-off: construção do grafo é cara
  (chamadas de LLM na ingestão — o custo cai na escrita e se paga na leitura).
- **Letta (ex-MemGPT)**: trata o LLM como um **sistema operacional gerenciando a própria
  memória** — três camadas: core memory (em contexto, editável pelo próprio agente), archival
  (vetor externo), recall (histórico de conversa indexado). O modelo decide quando paginar
  informação para dentro/fora via tool calls. Fev/2026: `letta-ai/learning-sdk` empacota isso
  como SDK drop-in.
- **A-MEM**: rede de memória interconectada **inspirada no Zettelkasten** — cada memória nova é
  uma nota estruturada com atributos, o sistema linka dinamicamente memórias relacionadas e
  atualiza notas existentes quando informação nova chega, com *supersede detection* (detecta
  quando memória velha ficou obsoleta). É a mais parecida filosoficamente com o vault NOESIS.
- **HeLa-Mem** (ACL 2026, já detalhada no relatório anterior): grafo de memória dinâmico com
  regras Hebbianas, spreading activation e consolidação episódico→semântico.

**Benchmarks da área** (para a Camada 2 do motor): LoCoMo, **LongMemEval** (500 perguntas sobre
históricos longos, testando 5 habilidades: extração, raciocínio multi-sessão, raciocínio
temporal, atualização de conhecimento e abstenção) e **BEAM** (ICLR 2026 — 10 habilidades de
memória, conversas até 10M tokens). Aviso honesto da literatura: cada vendor vence no próprio
benchmark; os números não são diretamente comparáveis entre relatórios.

## 1.2 A arquitetura seminal que falta na Aurora: Generative Agents (Stanford)

O paper de Park et al. 2023 ("Generative Agents: Interactive Simulacra of Human Behavior") é
a pedra fundamental de memória para agentes com persona, e três dos seus mecanismos são
diretamente transplantáveis:

1. **Memory stream com pontuação tripla de retrieval:** cada memória recebe
   `score = recência × importância × relevância` — recência com decaimento exponencial,
   importância avaliada por LLM no momento da gravação, relevância por embedding contra a
   query atual. O `get_context` do noesis-mcp hoje é só relevância textual + 1 hop; adicionar
   recência e importância é upgrade direto e barato.
2. **Reflection tree:** quando memórias salientes acumulam acima de um limiar, o agente
   sintetiza *reflexões* — conclusões de nível mais alto sobre padrões ("Klaus viu papéis na
   mesa" + "falou do projeto" + "ficou até tarde na biblioteca" → "Klaus está ocupado com um
   deadline importante"). Reflexões podem refletir sobre reflexões, formando camadas: observações
   cruas embaixo, conclusões duráveis em cima — que "se comportam quase como personalidade".
   **A ablação do paper mostrou que sem reflexão, o comportamento degrada em horizontes longos**
   — os agentes esquecem temas recorrentes e não desenvolvem consistência. Isso é literalmente
   o mecanismo que faz a Aurora "virar alguém" com o tempo, e é o ritual de destilação do
   DIA-1-OPERACAO.md formalizado como processo automático.
3. **Emergência social validada:** com só memória+reflexão+planejamento, os 25 agentes de
   Smallville produziram difusão de informação e coordenação (a festa de Valentine's Day)
   **não programadas** — evidência empírica de que emergência real acontece com esses
   ingredientes.

## 1.3 Persistência de chat (a parte fácil, mas com uma decisão importante)

Persistir o histórico é trivial tecnicamente (SQLite no Electron — o Aurora Desktop já usa
`better-sqlite3` indiretamente via OmniRoute-like stack; adicionar uma tabela `messages` com
`session_id` resolve o básico). A decisão real é **o que o histórico é para o sistema**:

- **Opção rasa:** histórico = log para exibir. Só UI.
- **Opção alinhada com a arquitetura:** histórico = **memória episódica crua** (camada 0), da
  qual a destilação/reflexão extrai o que sobe para o grafo. O chat persiste íntegro; o que
  entra no vault é o destilado. Isso resolve elegantemente a tensão "guardar tudo vs. grafo
  limpo": tudo é guardado, mas em camadas com semânticas diferentes (cru → episódico →
  semântico), exatamente a distinção que a crítica ao CoALA pede.

Recomendação: opção 2, com o esquema `sessions(id, started_at, ended_at, summary)` +
`messages(id, session_id, role, content, ts, model_used, domain_classified)` — os dois últimos
campos já alimentam a telemetria do roteador de graça.

---

# PARTE 2 — Nascimento zerado + base de conhecimento de fábrica

## 2.1 A separação conceitual (validada pela literatura)

Sua intuição de separar "o que dá vida a ela" (arquitetura, imutável pelo sistema) de "o que
ela vive" (dados, tudo mutável/emergente) tem paralelo direto na ciência cognitiva
computacional: é a distinção entre **priors arquiteturais** (a estrutura inata — como o cérebro
nasce com córtex organizado mas sem memórias) e **conhecimento adquirido**. Formalizando para
a Aurora, três camadas de "fábrica":

1. **Núcleo imutável pelo sistema** (`mutable_by_system: never`): Constituição, ontologia base,
   regras de plasticidade (as "leis da física" do grafo), o motor epistêmico como algoritmo.
   Só muda por commit humano.
2. **Seed genérico não-pessoal** (`mutable_by_system: review_required` ou livre): a "base de
   conhecimento de fábrica" que você descreveu — conhecimento sobre o mundo que qualquer
   instância nasce sabendo, mas que pode ser refinado/superado por evidência. Importante: isso
   NÃO precisa ser grande, porque o LLM por trás já carrega o conhecimento do mundo — o seed é
   mais sobre *como a Aurora se entende e opera* (AURORA-PERSONA genérica, esquemas de
   goal/habit vazios, heurísticas iniciais de conversa) do que sobre fatos.
3. **Tudo do usuário**: nasce vazio, sempre. O bug #4/ADR-0008 já provou na prática por que —
   e o princípio agora é permanente.

## 2.2 O "parto": como a Aurora conhece um usuário novo (cold start)

O problema de cold start tem uma solução de fronteira publicada que é quase um manual para o
onboarding epistêmico da Aurora: o estudo de Stanford/DeepMind com **1.052 pessoas reais**
(Park et al. 2024). Método: entrevista de ~2h sobre a história de vida e visões da pessoa, com
perguntas de follow-up baseadas nas respostas anteriores; o transcript vira memória do agente;
e — o detalhe genial — **um LLM revisa o transcript e produz sínteses de alto nível sob a
perspectiva de diferentes especialistas** (um "psicólogo social" comenta a extroversão, um
"economista" comenta a propensão a risco), e essas sínteses também entram na memória. Os
agentes resultantes replicaram as respostas das pessoas reais em surveys canônicos com
precisão impressionante.

Tradução para a Aurora: o onboarding não é um formulário — é uma **entrevista adaptativa**
(perguntas que dependem das respostas), seguida de um passo de **síntese multi-perspectiva**
que gera as primeiras notas de USER-MODEL com `confidence` baixa (são hipóteses, Art. VIII-2:
nada sobre emoção vira consolidado sem confirmação). O onboarding atual do Aurora Desktop já
aponta nessa direção; o que a pesquisa adiciona é o passo de síntese e a gradação de confiança.

---

# PARTE 3 — Plasticidade contínua (o "ontem não ser igual a hoje")

## 3.1 A grande bifurcação do campo — e por que a Aurora está do lado certo

Continual learning tem dois paradigmas:

- **Paramétrico** (mudar os pesos do modelo): fine-tuning contínuo, EWC, replay, model editing.
  Problema central: **esquecimento catastrófico** — conhecimento fica distribuído de forma
  emaranhada em bilhões de pesos ("não existe um módulo limpo para 'preferências do usuário'"),
  e edição em escala leva a esquecimento gradual e depois catastrófico. Caro, arriscado, e
  test-time training chega a **minar guardrails de segurança** (ICLR 2026 workshop).
- **Não-paramétrico** (backbone congelado + memória externa que evolui): o aprendizado vive na
  memória, não nos pesos. Reflexões/lições, skills executáveis, trajetórias, abstrações
  persistentes. O paper **Memento** resume o espírito no título: "Fine-tuning LLM Agents
  without Fine-tuning LLMs". A linha "From RAG to Memory: Non-Parametric Continual Learning
  for LLMs" (arXiv 2502.14802) formaliza.

**A Aurora é, por construção, um sistema de continual learning não-paramétrico.** A
plasticidade que você quer não exige treinar modelo nenhum — ela vive nas regras de atualização
do grafo. Isso é uma enorme vantagem prática: troca de modelo no motor não apaga nada do que a
Aurora "aprendeu", porque o aprendizado está no vault.

## 3.2 O aviso da fronteira: o dilema estabilidade-plasticidade não desaparece

Achado recente e importante (arXiv 2604.27003): **o trade-off estabilidade↔plasticidade
reemerge mesmo em continual learning não-paramétrico** — não por sobrescrita de pesos, mas por
**diluição de memória na recuperação**: a condição com maior transferência de aprendizado
também mostrou esquecimento significativo, via dinâmica de retrieval (memórias novas "abafando"
antigas relevantes). Tradução: o design das regras de decaimento, consolidação e do retrieval
(a pontuação tripla da Parte 1.2) não é detalhe — é onde o dilema central da plasticidade vai
se manifestar na Aurora. As duas forças do relatório anterior (Hebbiana pra fortalecer,
homeostática pra impedir runaway) são a resposta, agora com uma terceira: **consolidação
seletiva** (o que sobrevive ao decaimento é o que foi refletido/destilado — de novo, o ritual).

## 3.3 Multi-escalas temporais

Trabalho recente propõe **dinâmica de memória em múltiplas escalas de tempo** (arXiv
2605.05097) — atualização guiada por evidência contínua em vez de regras fixas externas, com
camadas atualizando em frequências diferentes (o análogo do Continuum Memory System / HOPE e
dos Titans do Google, que aprendem a memorizar em test-time priorizando o que é *surpreendente*
para o modelo). Nota de design para a Aurora: "surpresa" como critério de prioridade de gravação
é literalmente Active Inference (Parte 7) — as pontas se encontram.

---

# PARTE 4 — Visualização do grafo em tempo real ("sinapses acendendo")

## 4.1 O trio de bibliotecas e a regra prática de 2026

- **Cytoscape.js** (~500k downloads/semana): a mais completa — algoritmos de grafo, layouts,
  análise. Melhor quando o grafo é *objeto de análise*. Já existe um caso publicado (jan/2026)
  de **Agentic Knowledge Graph em tempo real** usando exatamente Cytoscape.js: o agente decide
  quais conceitos viram nós e como as relações se formam, e o grafo se atualiza dinamicamente
  conforme a interação — "a visualização espelha diretamente a lógica interna do agente". É a
  prova de conceito de que o que você imagina é implementável hoje com stack web comum.
- **vis-network** (~200k/semana): a melhor para diagramas interativos com física, drag/drop e
  clustering embutidos — a "sensação orgânica" de nós se acomodando é nativa.
- **Sigma.js** (~50k/semana): WebGL, a única prática acima de ~50k nós (100k+). Dados via
  graphology.

Regra 2026: Cytoscape para análise, vis-network para interatividade, Sigma para escala. O vault
da Aurora tem dezenas→centenas de nós no horizonte próximo: **qualquer uma das três serve com
folga; vis-network ou Cytoscape (layout COSE) são os pontos de partida naturais** para o
Electron/React do Aurora Desktop, com migração a Sigma só se um dia o grafo explodir.

## 4.2 Como fazer a "sinapse acender" (o efeito que você descreveu)

Receita concreta, combinando as peças desta pesquisa:
1. O noesis-mcp emite **eventos de grafo** (nó criado, relação criada, nó *ativado* por
   retrieval) — hoje `log_event` já grava em JSONL; basta também publicar via IPC pro renderer.
2. O renderer mantém o grafo na lib escolhida; ao receber `node_activated`, aplica uma classe
   visual temporária (brilho/cor fósforo da paleta, decaindo em ~1s) no nó e nas arestas do
   caminho de retrieval.
3. **Spreading activation** (o mecanismo do HeLa-Mem) vira animação natural: quando o
   `get_context` expande 1 hop, os vizinhos acendem com intensidade proporcional à relevância,
   meio segundo depois do nó central — a "onda" sináptica.
4. Clique num nó → painel lateral com frontmatter + corpo da nota (expansão que você pediu);
   nós nascidos de reflexão/consolidação ganham marca visual distinta ("o que emergiu").
Isso é ~2-3 dias de trabalho com Fable no desktop, não um projeto de meses — os eventos já
existem, falta o transporte IPC e o componente de visualização.

---

# PARTE 5 — Multi-tenant, login/senha e onde a Aurora "mora"

## 5.1 O padrão de isolamento (quando houver servidor)

O padrão dominante de 2026 para SaaS multi-tenant: **schema compartilhado + coluna tenant_id +
Row-Level Security do Postgres** como rede de segurança no nível do banco (se uma query escapar
da aplicação, o próprio banco bloqueia). Notion roda assim (particionado por workspace_id em
480 shards lógicos). Detalhe técnico que evita vazamento sutil: contexto de tenant com escopo
de transação (`set_config('app.current_tenant_id', ..., true)`) para poolers em transaction
mode não vazarem estado entre conexões. Database-per-tenant só quando regulação exigir.
Para a Aurora: `user_id` é o tenant; RLS em toda tabela (`vault_notes`, `messages`, `events`).

## 5.2 A decisão arquitetural maior: local-first com sync, não cloud-first

Aqui a pesquisa aponta um caminho que preserva os princípios do NOESIS (Art. VIII-5: nenhum
dado sai do perímetro sem decisão humana) E entrega o login/persistência que você quer: o
paradigma **local-first** (Kleppmann/Ink & Switch: "quando o dado vive primariamente na nuvem,
o usuário vira inquilino da própria informação"). Arquitetura:

- **Fonte primária = SQLite/vault local** (leituras/escritas instantâneas, funciona offline —
  o Aurora Desktop já é assim por natureza).
- **Conta com login = identidade + sincronização**, não moradia do dado: um backend (Postgres +
  RLS) recebe réplica cifrada/sincronizada do vault, permitindo (a) recuperação, (b) o mesmo
  usuário em várias máquinas, (c) futuro acesso via celular.
- **Motores de sync maduros em 2026:** PowerSync (mais estável em produção nas avaliações de
  início de 2026; replicação Postgres→SQLite com write-back) e ElectricSQL (mais ambicioso,
  sync ativo-ativo com CRDTs; avaliações sugerem esperar mais maturidade para produção).
  Terceira via legítima para o caso Aurora: **sync custom simples** (push/pull do vault via
  API própria) — como o vault já é Git-friendly e single-user-per-device, conflito é raro e um
  sync que você entende 100% pode vencer um engine genérico. Avaliação da Smashing Magazine
  (mai/2026) recomenda exatamente isso para apps onde colaboração multi-usuário simultânea não
  é o caso.

Recomendação faseada: (1) agora — persistência local SQLite (Parte 1.3), zero servidor;
(2) MVP de conta — auth simples (Supabase dá Postgres+auth+RLS prontos) + sync custom do vault;
(3) só se/quando houver multi-dispositivo intenso — avaliar PowerSync.

---

# PARTE 6 — Roteamento por domínio + benchmark contínuo (integração)

Já detalhados no relatório anterior; aqui só o encaixe no todo com o que esta rodada adicionou:

- O roteamento semântico por domínio (embeddings + limiar, fast path com fallback pra LLM
  classificador) vira **mais um sinal do decision cycle CoALA** — a escolha de modelo é uma
  ação interna do agente, registrável como evento (e portanto visualizável no grafo: qual
  "região do cérebro" atendeu cada pergunta).
- O benchmark contínuo (minissuíte por domínio + LLM-as-judge + eval gate) alimenta o
  `domainModelMap` e também o painel de capacidade da Parte 8 — mesma infraestrutura, dois
  consumidores.
- OrcaRouter (contextual bandit, aprendizado híbrido offline→online) é a formalização a citar
  quando o roteador da Aurora começar a se auto-ajustar por telemetria.

---

# PARTE 7 — Active Inference computável (o Motor Epistêmico tem uma biblioteca de referência)

O MOTOR-EPISTEMICO.md do NOESIS cita Friston como fundamento. A pesquisa confirma que existe
implementação de referência open-source: **pymdp** (infer-actively/pymdp, JOSS 2022, hoje com
backend JAX), a biblioteca padrão para simular agentes de Active Inference em POMDPs discretos.
O ponto de conexão direta: um dos traços definidores desses agentes é a maximização de
**"epistemic value" — literalmente curiosidade formalizada** — que em ambientes com estrutura
oculta desvendável produz "epistemic chaining": o agente forrageia por pistas em cadeia, cada
uma revelando a próxima, sem que a sequência tenha sido ensinada. É a versão matemática rigorosa
do `prioridade(e) = incerteza(e) × valor(e)` do vault.

Uso pragmático (não acadêmico): não é preciso reimplementar Active Inference completo. O que
vale importar: (a) a decomposição da escolha de ação em **risco** (divergência do preferido) +
**ambiguidade** (incerteza a reduzir) para decidir *o que a Aurora pergunta proativamente*;
(b) "surpresa" como gatilho de gravação/consolidação de memória (liga com Titans/multi-escala,
Parte 3.3); (c) pymdp como bancada de simulação se um dia quisermos validar o motor epistêmico
isolado do LLM.

---

# PARTE 8 — "Idade mental" e psicometria de LLMs (o estado real da ciência)

Esta frente pedia honestidade máxima, e a literatura entrega um quadro claro:

## 8.1 O que existe de sólido
- **Um campo formal nasceu:** "LLM Psychometrics" tem review sistemático (arXiv 2505.08245)
  cobrindo avaliação, validação e aprimoramento — aplicando construtos de inteligência,
  personalidade, criatividade, Theory of Mind e raciocínio moral a LLMs. Um paper de 2026
  (Journal of Psychological Science) argumenta que a integração psicometria↔IA é "fundacional
  para um novo paradigma de medida na era da coexistência humano-IA". Ou seja: a sua ambição
  tem um campo acadêmico ativo por trás — não é doideira.
- **Existe até o conceito exato que você nomeou:** "Evaluating Cognitive Age Alignment in
  Interactive AI Agents" (arXiv 2605.17894) — pesquisa de 2026 sobre alinhamento de *idade
  cognitiva* em agentes, usando experimentos da psicologia do desenvolvimento (a linha de Kail:
  "comparando máquinas e crianças").
- **Theory of Mind:** Kosinski (PNAS 2024) reportou GPT-4 no nível de crianças em tarefas de
  falsa crença; benchmarks robustos posteriores (ToMBench: 8 tarefas, 31 habilidades sociais,
  construído do zero contra contaminação) mostram LLMs ainda >10% abaixo de humanos, com
  quedas fortes em ordens altas (crença de 6ª ordem, detecção de faux pas).

## 8.2 O que a fronteira diz para NÃO fazer
- Um position paper no **ICML 2025** afirma no título: *"Theory of Mind benchmarks are broken
  for large language models"* — pequenas alterações triviais nas tarefas derrubam o desempenho,
  sugerindo heurísticas frágeis, não compreensão; e tarefas humanas clássicas estão no treino
  dos modelos (contaminação).
- A crítica metodológica central é **validade de constructo** (Messick): um escore só significa
  algo se medir o que diz medir — e testes desenhados para mentes humanas em desenvolvimento
  não transferem automaticamente para LLMs.

## 8.3 A síntese honesta para a Aurora
O caminho defensável não é "a Aurora tem idade mental de X anos" (indefensável cientificamente),
e sim um **Painel de Capacidade Multidimensional**: um radar por domínio (código, matemática,
ToM/social, criatividade, memória temporal...) alimentado pela minissuíte da Parte 6, por
modelo de motor, com histórico temporal — mostrando a Aurora "crescendo" em cada eixo conforme
o grafo acumula e os modelos mudam. Itens de ToM podem entrar (usando os benchmarks robustos
como ToMBench, nunca os clássicos contaminados), rotulados como o que são. "Idade mental" pode
existir como *apelido de UI* de um índice composto — desde que a documentação diga com todas as
letras que é metáfora de acompanhamento, não medida psicométrica validada. Assim você fica com
o painel inspirador que queria E com integridade científica — que é, inclusive, o que dá valor
de portfólio/TCC ao trabalho.

---

# PARTE 9 — Emergência (integração final)

Do relatório anterior, os pilares seguem: HeLa-Mem como espelho acadêmico do NOESIS;
Self-Organized Criticality como o "ponto ótimo" entre ordem e caos que plasticidade Hebbiana +
homeostática produz; e a lição de design — emergência vem de regras locais, nunca de script.
O que esta rodada adiciona: **evidência empírica de emergência comportamental com os exatos
ingredientes que a Aurora terá** — em Smallville (Generative Agents), memória + reflexão +
planejamento bastaram para difusão de informação e coordenação social não programadas, com
ablações provando que cada pilar era necessário. E o alerta de 3.2: a dinâmica de retrieval é
onde estabilidade↔plasticidade vai se decidir — ou seja, os parâmetros de decaimento/limiar
não são detalhes de implementação, são **os hiperparâmetros da personalidade emergente**.
Medir emergência: registrar como evento toda nota/relação criada por consolidação (não por
input direto do usuário) — a razão `emergido/inserido` ao longo do tempo é a métrica mais
simples e honesta de "está nascendo algo".

---

# PARTE 10 — Síntese arquitetural: como tudo se encaixa

```
                    ┌─────────────────────────────────────────┐
                    │  NÚCLEO IMUTÁVEL (Constituição, ontologia, │
                    │  regras de plasticidade, motor epistêmico) │
                    └───────────────┬─────────────────────────┘
                                    │ governa
   ┌────────────────────────────────▼───────────────────────────────┐
   │                    VAULT / GRAFO (por usuário, nasce vazio)      │
   │  camadas: chat cru → episódico (journal/events) → semântico      │
   │  (notas) → reflexões/consolidações (emergente)                   │
   │  plasticidade: Hebbiana (uso fortalece) + homeostática (decay)   │
   │  retrieval: recência × importância × relevância + spreading      │
   └───────┬──────────────────┬─────────────────────┬────────────────┘
           │                  │                      │
   ┌───────▼───────┐  ┌───────▼────────┐   ┌────────▼─────────┐
   │ VISUALIZAÇÃO  │  │ MOTOR (LLMs)   │   │ AVALIAÇÃO         │
   │ tempo real    │  │ roteador por   │   │ minissuíte/domínio│
   │ (Cytoscape/   │  │ domínio (sem.) │   │ LLM-as-judge      │
   │ vis-network,  │  │ + cascata de   │   │ eval gate         │
   │ eventos IPC,  │  │ custo + bandit │◄──┤ atualiza o        │
   │ "sinapses")   │  │ contínuo       │   │ domainModelMap    │
   └───────────────┘  └────────────────┘   └───────┬──────────┘
                                                    │ alimenta
                                          ┌─────────▼──────────┐
                                          │ PAINEL DE CAPACIDADE│
                                          │ multidimensional    │
                                          │ ("idade mental" como│
                                          │ apelido documentado)│
                                          └────────────────────┘
   Persistência: SQLite local (fonte primária) ──sync cifrado──► conta
   (Postgres+RLS, login) — local-first, Art. VIII-5 preservado.
```

# PARTE 11 — POCs concretas para as sessões com Fable (priorizadas)

1. **[pequena, alto valor] Retrieval triplo:** adicionar recência + importância ao score do
   `get_context` (Generative Agents). Muda a qualidade da memória imediatamente.
2. **[pequena] Persistência de chat:** tabela `sessions`/`messages` no SQLite do desktop, com
   `model_used` e `domain_classified` — já plantando a telemetria do roteador.
3. **[média, o "uau"] Visualização v0:** componente React com vis-network ou Cytoscape lendo o
   vault + eventos IPC de ativação — nós acendendo no retrieval. Base pro spreading activation.
4. **[média] Reflexão automática:** job de fim de sessão que roda o padrão reflection-tree
   (limiar de importância acumulada → síntese → nota nova marcada como `origin: reflection`).
   Junto, a métrica `emergido/inserido`.
5. **[média] classifyDomain v0:** por regras/keywords primeiro (validar o conceito), evoluindo
   pra embeddings (semantic-router como referência). Liga no roteador existente.
6. **[maior, depois] Minissuíte de benchmark por domínio + LLM-as-judge** rodando contra os
   provedores já configurados; primeiro `domainModelMap` real.
7. **[pesquisa/depois] Sync + conta:** protótipo Supabase (auth + Postgres + RLS) com sync
   custom do vault.

# Caveats gerais
- Números (estrelas, versões, benchmarks) são snapshot de jul/2026 e mudam rápido.
- Benchmarks de memória são auto-reportados por cada vendor; comparar com ceticismo.
- Psicometria de LLM é campo novo com disputa metodológica ativa; tudo da Parte 8 deve ser
  tratado como "estado do debate", não consenso.
- semantic-router e pymdp são Python; integração com o stack TS exige microserviço local ou port.
- Emergência genuína não tem garantia — o que a literatura garante é que *as condições* estão
  corretas; se algo emerge, e o quê, é exatamente a pergunta de pesquisa (e a graça do projeto).

# Fontes principais desta rodada
- CoALA: arXiv 2309.02427 (TMLR); crítica de persistência: arXiv 2604.11364.
- Memória: Mem0 (arXiv 2504.19413); Zep/Graphiti (arXiv 2501.13956); Letta/MemGPT; A-MEM;
  LongMemEval (arXiv 2410.10813); BEAM (ICLR 2026); HeLa-Mem (ACL 2026).
- Generative Agents: Park et al. 2023 (Smallville) e Park et al. 2024 (1.052 indivíduos,
  Stanford HAI).
- Continual learning: survey CSUR 2025 (Wang et al.); Memento (arXiv 2508.16153); From RAG to
  Memory (arXiv 2502.14802); estabilidade-plasticidade em CL não-paramétrico (arXiv 2604.27003);
  multi-timescale (arXiv 2605.05097); Titans (arXiv 2501.00663).
- Visualização: comparativos PkgPulse 2026 (Cytoscape/vis-network/Sigma); caso Agentic KG em
  tempo real com Cytoscape.js (jan/2026).
- Multi-tenant: padrões Postgres RLS 2026 (ClickHouse eng., AWS Database Blog); local-first:
  Kleppmann/Ink & Switch; PowerSync vs ElectricSQL (avaliações 2026, Smashing Magazine mai/2026).
- Active Inference: pymdp (JOSS 2022, repo infer-actively).
- Psicometria: review sistemático arXiv 2505.08245; ToMBench; Kosinski PNAS 2024; position
  ICML 2025 "ToM benchmarks are broken"; Cognitive Age Alignment arXiv 2605.17894.
