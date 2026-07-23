# Pesquisa — Motor Adaptativo da Aurora: Roteamento por Domínio, Benchmark Contínuo e Emergência

> Investigação em três camadas empilhadas, com fontes, cruzando o estado da arte com o que
> a Aurora/NOESIS já tem construído. Datada de 22/07/2026. Preços, versões e números de
> benchmark mudam rápido — revalidar contra fonte oficial antes de confiar em número específico.

---

## Sumário executivo

- **Camada 1 (roteamento por domínio) já é engenharia madura.** O padrão de produção 2026 é
  *roteamento semântico*: embeddar a query, comparar por similaridade de cosseno com vetores de
  domínios pré-definidos, escolher o modelo mapeado. Latência desprezível (<0,4% do custo total
  da requisição). É exatamente o que a Aurora precisa e não existe pronto para "domínios
  customizáveis" — mas as peças existem.
- **Camada 2 (benchmark contínuo) tem um padrão de referência claro:** "eval gate" antes de
  promover qualquer modelo/mudança + "LLM-as-judge" amostrando tráfego real de produção para
  detectar deriva de qualidade. A telemetria por chamada que a Aurora **já grava** (commit
  `c3e2ee5`) é a fundação disso.
- **Camada 3 (emergência) NÃO é só filosofia — há um paper diretamente aplicável:** *HeLa-Mem*
  (ACL 2026) implementa memória associativa Hebbiana como **grafo dinâmico** para agentes LLM,
  com "spreading activation" e consolidação de episódico→semântico. É quase um espelho acadêmico
  do que o NOESIS desenha à mão (pesos, confiança, recência nas relações). A emergência real
  vem de regras locais simples + plasticidade, não de programar cada comportamento.

---

## CAMADA 1 — Roteamento por domínio de conhecimento

### O padrão de produção (2026): roteamento semântico
Roteamento semântico seleciona o modelo pelo **significado** do prompt, não por regra fixa nem
palavra-chave. Encoda a query e as rotas candidatas como embeddings vetoriais e escolhe a rota
de maior similaridade de cosseno. "Qual meu saldo?" e "quanto dinheiro eu tenho?" caem na mesma
rota mesmo sem compartilhar palavra alguma — é justamente onde o classificador de keywords do
OmniRoute (que analisamos ontem) falha, e onde a "nuance emocional" que você quer é capturada.

A decisão crítica é o **limiar de similaridade**: sem ele, o roteador erra com confiança em
tráfego ambíguo. O padrão é usar o roteador semântico como *fast path* e cair para um LLM
classificador quando a query pontua abaixo do limiar.

### Ferramentas de referência
- **vLLM Semantic Router** (vllm-project, open-source): a mais avançada. Já em v0.3 "Themis"
  (jun/2026), com núcleo de classificação em Rust, contribuições de Red Hat, IBM Research, AMD
  e Hugging Face. Compõe **treze tipos de sinal** — padrões de keyword, similaridade de
  embedding, classificadores de domínio, detecção de idioma, verificação factual — em políticas
  de roteamento. Usa um BERT para converter o prompt em embeddings e comparar com "vetores de
  tarefa". Reporta, em benchmark MMLU-Pro, ganhos ao aplicar raciocínio seletivamente por
  classificação. É primariamente infra de servidor (Kubernetes/Envoy) — pesado para embutir
  num Electron, mas é a referência arquitetural mais completa.
- **semantic-router (Aurelio Labs)**: a peça leve, roda local, embeddings + kNN. A mais adequada
  para embutir na camada `providers/` da Aurora. Primariamente Python — para Node/TS, rodar como
  microserviço local ou avaliar port.
- **RouteLLM (LMSYS)**: roteia no eixo **custo × qualidade** (modelo forte vs. fraco), não por
  domínio. Generaliza para pares de modelos não vistos no treino (Claude + Llama funciona sem
  retreinar). Complementar, não substituto, ao roteamento por domínio.
- **OrcaRouter (arXiv 2026)**: formaliza roteamento como *contextual bandit* (LinUCB) com
  aprendizado híbrido offline→online — inicializa de dados e **continua aprendendo com feedback
  em produção**, atualizando só o "braço" do modelo selecionado após observar a recompensa.
  Diretamente relevante para o seu "o benchmark tem que continuar acontecendo": é a formalização
  matemática de um roteador que nunca para de aprender.

### Como isso encaixa na Aurora (aproveitando o que já existe)
O `MODEL-ROUTER.md` já previa cascata T0–T5 e "downgrade contínuo por telemetria". A adição é
uma dimensão nova: além de *tier por custo*, um eixo de *domínio por competência*. Concretamente:
uma função `classifyDomain(prompt) → {code, math, emotional, creative, analysis, general}` por
embeddings, e um `domainModelMap` (aprendido pela Camada 2, não fixo) que resolve qual
provider/modelo atende melhor cada domínio. A telemetria por chamada já existente vira o
substrato de treino. O roteamento adiciona <1ms se por regra, poucos ms se semântico.

---

## CAMADA 2 — Benchmark contínuo e autoavaliação

### O padrão de dois estágios
1. **Eval gate (portão pré-promoção):** toda mudança — novo modelo, novo provider, mudança de
   prompt — passa por uma suíte de benchmark por domínio *antes* de virar o modelo default de
   um domínio. Se qualquer métrica crítica cair abaixo do limiar, a promoção é bloqueada.
   Previne regressão.
2. **Monitoramento contínuo em produção:** amostrar uma fração das respostas reais e rodar
   *LLM-as-judge* nelas para rastrear tendência de qualidade ao longo do tempo. Comparar a
   qualidade de produção contra o benchmark pré-promoção detecta *distribution shift* — se
   divergem, o benchmark não é representativo do uso real.

### LLM-as-judge: o motor da autoavaliação
Um LLM mais capaz avalia as saídas de outro modelo segundo critérios/rubrica. Atinge 80–90% de
concordância com julgamento humano a um custo 500–5000× menor, o que torna o monitoramento
contínuo viável. Cuidados documentados: **viés de posição** (o juiz favorece a primeira/última
resposta), o juiz não deve avaliar modelos **acima da própria capacidade**, e para checagens
determinísticas (formato, cálculo) use verificador, não juiz. Começar com poucas métricas de
alto sinal — muitos juízes tornam o monitoramento ruidoso, caro e difícil de interpretar.

### Benchmarks por domínio (o mapa 2026)
Os benchmarks gerais **saturaram** (MMLU >88%), e o campo fragmentou em avaliações verticais:
medicina (HealthBench — 48.562 critérios de rubrica escritos por 262 médicos), código
(BigCodeBench, LiveCodeBench — problemas competitivos *posteriores* ao cutoff de treino, para
resistir a contaminação), etc. Para a Aurora, o caminho não é usar esses benchmarks gigantes
inteiros, mas montar uma **suíte pequena e própria por domínio** — um punhado de tarefas
representativas de cada área que *você* usa (código, matemática, escrita emocional, análise),
rodada periodicamente contra cada modelo configurado, com LLM-as-judge dando a nota. É o
"minibenchmark rotativo" que alimenta o `domainModelMap` da Camada 1.

### Frameworks reusáveis
DeepEval (define e roda métricas), OpenAI Evals (graders customizáveis), Braintrust (gestão de
dataset + tracking entre experimentos), Phoenix/Arize (observabilidade e deriva em produção).
Qualquer um serve de espinha dorsal — o valor está na suíte de tarefas por domínio que você
curar, não no framework.

### Como isso encaixa
A Aurora já grava `{task_class, tier, modelo, tokens, custo, sucesso, latência}` por chamada.
Adicionar: (a) um campo de *domínio* na telemetria (vindo do classificador da Camada 1); (b) um
job periódico que roda a minissuíte por domínio × modelo e grava as notas como eventos no vault;
(c) uma regra de promoção/rebaixamento que atualiza o `domainModelMap` quando um modelo passa a
vencer consistentemente em um domínio. Isso fecha o loop: rotear → medir → reajustar o roteamento.

---

## CAMADA 3 — Emergência em sistemas complexos aplicada ao grafo

Esta é a camada de fronteira, e a honestidade devida é: aqui convivem ciência séria e muito
hype. O que segue é o lado com lastro.

### O achado central: HeLa-Mem (ACL 2026)
Existe um paper que é quase o espelho acadêmico do NOESIS: *HeLa-Mem — Hebbian Learning and
Associative Memory for LLM Agents* (HKUST-GZ, ACL 2026). Implementa memória para agentes LLM
como um **grafo de memória dinâmico** onde:
- memórias relacionadas se reativam por **spreading activation** (ativação se espalhando pelas
  conexões — exatamente a "sinapse acendendo" que você descreveu);
- experiências episódicas **consolidam gradualmente** em conhecimento semântico mais estável
  (o análogo a "aprender de verdade", não só acumular fatos);
- as conexões seguem regras Hebbianas ("neurônios que disparam juntos, conectam-se").

Ou seja: o comportamento que você quer (novos nós e conexões emergindo da interação, o grafo se
expandindo como rede neural) **já tem formalização e implementação publicadas**. Não precisa
inventar do zero — precisa adaptar.

### O princípio da emergência (por que não se programa)
A literatura de auto-organização é consistente num ponto: **padrões complexos emergem de regras
locais simples, sem agente externo guiando nem ajuste fino de parâmetros**. No caso de memórias
associativas emergentes (Self-Organizing Language, arXiv 2506.23293), as estruturas de memória
"não são postas à mão — não há camada de memória adicionada ao sistema"; introduzir *um único
neurônio novo* é suficiente para elas surgirem, demonstrando que são estruturas *genuinamente
emergentes*. Isso valida sua intuição: você não deve dar os impulsos: você define as regras
locais (como uma relação ganha peso, como decai, quando dois nós se conectam) e o comportamento
global emerge do uso.

### Criticalidade auto-organizada (o estado onde a emergência acontece)
O conceito-chave da neurociência computacional é a **Self-Organized Criticality (SoC)**: redes
neurais se auto-organizam para um "ponto crítico" entre ordem e caos, onde a capacidade de
transmissão de informação e computação é máxima. Nesse estado surgem "avalanches neuronais"
(cascatas de ativação cujo tamanho segue lei de potência). A plasticidade sináptica (Hebbiana +
homeostática) é o mecanismo proposto que leva a rede a esse ponto. Para a Aurora, a lição de
design: você quer que o grafo opere perto desse ponto crítico — plástico o bastante para mudar,
estável o bastante para não virar ruído. As duas forças que equilibram isso:
- **Plasticidade Hebbiana**: conexões usadas juntas se fortalecem (o `weight`/`confidence` das
  suas relações sobe com evidência de co-ativação).
- **Plasticidade homeostática**: um mecanismo que impede o crescimento descontrolado dos pesos
  (decay por recência, normalização) — sem isso, tudo satura e a rede perde a capacidade de
  discriminar. O NOESIS já tem os ingredientes (peso, confiança, recência, evidência); falta a
  regra homeostática explícita que impede runaway.

### O caveat honesto
"Idade mental" e "inteligência" da Aurora (que você mencionou como métrica composta) é a parte
mais especulativa e onde o hype é maior. Há literatura de psicometria aplicada a LLMs, mas
equiparar isso a "idade mental" humana é analogia, não medida validada — qualquer número desses
seria uma construção sua, útil como painel interno de acompanhamento, não como verdade
científica estabelecida. Vale construir como *dashboard de capacidade por domínio* (derivado da
Camada 2), e ser transparente que a rotulagem "idade mental" é metáfora, não psicometria clínica.
Fica como um tema próprio para a próxima rodada de pesquisa, junto com visualização de grafo em
tempo real, persistência de chat e multi-tenancy — que são frentes de engenharia distintas
destas três camadas.

---

## Recomendação de sequência (o que fazer com isto)

1. **Camada 1 primeiro, como código, na próxima onda:** um `classifyDomain()` por embeddings
   (semantic-router como referência) + um `domainModelMap`. Começa até com regras simples e
   evolui para semântico. Não depende das outras camadas.
2. **Camada 2 logo em seguida, reusando a telemetria existente:** minissuíte de tarefas por
   domínio + LLM-as-judge + job periódico que atualiza o `domainModelMap`. É o que torna o
   roteamento *adaptativo* em vez de fixo.
3. **Camada 3 como fundação conceitual do vault, incremental:** adotar explicitamente as duas
   regras de plasticidade (Hebbiana + homeostática) nas relações do grafo, inspiradas em
   HeLa-Mem; deixar a emergência acontecer do uso, medir se acontece, sem forçar. Ler o HeLa-Mem
   antes de desenhar a mecânica final de memória.

## Fontes principais
- Redis — LLM router architecture best practices (2026): roteamento semântico, limiar, cache.
- vLLM Semantic Router (GitHub vllm-project + blog v0.1 Iris / v0.3 Themis): 13 tipos de sinal.
- RouteLLM (LMSYS) e OrcaRouter (arXiv 2605.30736): roteamento custo/qualidade e bandit online.
- Kili / Zylos / essenn (2026): eval gate, LLM-as-judge, benchmarks por domínio, saturação MMLU.
- DeepEval, Label Your Data (2026): LLM-as-judge — concordância, vieses, custos.
- HeLa-Mem (ACL 2026, aclanthology 2026.acl-long.625): memória Hebbiana como grafo dinâmico p/ agentes LLM.
- Self-Organizing Language (arXiv 2506.23293): memórias key-value emergentes de plasticidade.
- Frontiers in Physics (2021) / Frontiers Comp. Neuroscience (2026): self-organized criticality e plasticidade.
- npj Complexity (2025): self-organização, emergência, o que é e como surge.
