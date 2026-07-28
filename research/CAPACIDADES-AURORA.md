# CAPACIDADES-AURORA — Auditoria de ferramentas, skills e roteamento

> Discovery para a camada operacional da vontade de potência (ADR-0014/0015):
> capacidades reais de agência, skills/MCPs, e um Model Router que nunca deixa a
> Aurora travada por limite de um modelo. Objetivo: a Aurora **superar em
> capacidade prática** cada ferramenta auditada, via **clean room** — spec
> comportamental reimplementada, nunca cópia de código protegido.
>
> **Status:** EM CONSTRUÇÃO, frente por frente. ✅ Frente A · ⏳ B, C, D, E.
> **Data de início:** 2026-07-27

## Método (constraints do prompt, honrados)

- **Verificar antes de confiar:** cada ferramenta é confirmada por busca/fetch
  atual; o que eu não confirmar entra marcado `⚠️ não verificado`, nunca inventado.
- **Licença antes de reuso:** se a licença permitir fork/reuso direto, sinalizo
  isso **à parte** da recomendação clean-room. Se for ambígua/restritiva, a
  recomendação é sempre reimplementação a partir da spec comportamental.
- **Limitação declarada (Frente E):** extração de transcrição de YouTube é
  não-confiável com as ferramentas desta sessão (páginas JS-pesadas). Vídeos que
  eu não conseguir processar serão reportados como tal, não preenchidos com
  suposição.

---

# Frente A — Roteamento de modelos ✅

### OpenRouter (openrouter.ai)
- **O que faz:** gateway hospedado, endpoint OpenAI-compatible sobre centenas de
  modelos/provedores. Modelos free marcados com sufixo `:free`.
- **Licença:** serviço hospedado (não é repo para fork) — o que se reusa é a API,
  não código. É o provedor que a Aurora já usa hoje.
- **Free tier (com fonte):** **20 req/min** e **50 req/dia** sem compra; **1000
  req/dia** após comprar ≥ US$10 uma vez (não expira). **28+ modelos free** em
  jun/2026 (DeepSeek R1, Llama 3.3 70B, Qwen3 Coder 480B 262K, Gemma 3, Gemini
  Flash). Fonte: [OpenRouter Rate Limits](https://openrouter.zendesk.com/hc/en-us/articles/39501163636379-OpenRouter-Rate-Limits-What-You-Need-to-Know) · [teamday.ai 2026](https://www.teamday.ai/blog/best-free-ai-models-openrouter-2026).
- **Esgotamento de free tier:** retorna **HTTP 429** (`Retry-After`). Faz
  **fallback automático entre provedores do MESMO modelo**; trocar para outro
  modelo é fallback **configurado pelo usuário**, não automático.
- **Contexto na troca:** API é stateless — o histórico é reenviado pelo cliente a
  cada chamada, então o contexto é preservado pelo cliente (é o que o Aurora
  Desktop já faz). Não há estado do lado do OpenRouter a perder.
- **Roteamento por capacidade:** ❌ **não documentado.** Um modelo só-texto
  recebendo imagem devolve erro cru — **é exatamente o 404 que o Lucas levou em
  27/07** (corrigido no nosso lado por payload, commit `56d6e6c`).
- **Capacidade-chave:** maior catálogo free confiável, já integrado.

### OmniRoute (github.com/diegosouzapw/OmniRoute)
- **O que faz:** gateway AI self-hosted, OpenAI-compatible, sobre 290+ provedores
  (90+ free); **superset do 9router**. 14 estratégias de roteamento.
- **Licença:** **MIT** ("100% MIT self-hosted"). 🟢 **Permite reuso/fork direto
  com atribuição** — sinalizado à parte do clean-room: para OmniRoute, fork é
  legalmente possível; a decisão clean-room vs. fork é de arquitetura, não legal.
- **Esgotamento de free tier:** **fallback automático em 4 camadas** —
  Subscription → API Key → Cheap → Free ("always on"), em milissegundos, "zero
  downtime".
- **Contexto na troca:** ✅ **tem estratégias explícitas** — `context-relay`
  ("hand off context across targets for long conversations") e `context-optimized`
  ("pick the best fit for the current context size"). **É o comportamento que a
  Aurora quer** — spec a reimplementar.
- **Roteamento por capacidade:** ❌ o motor de auto-scoring (12 fatores) prioriza
  saúde/quota/custo/latência, **não modalidade** (imagem/áudio). Roteia por erro
  e exaustão, não por matriz de features.
- **Free (com fonte):** ~1.53B tokens/mês em 43 pools; free "forever": OpenCode
  Zen (DeepSeek V4, Nemotron 3), Z.AI GLM, SiliconFlow, Cerebras, NVIDIA NIM,
  Cloudflare AI, Pollinations (sem chave). Fonte: [repo OmniRoute](https://github.com/diegosouzapw/OmniRoute).
- **Capacidade-chave:** **context-relay** (preservação de contexto na troca) +
  fallback multi-camada quota-aware.

### 9router (github.com/decolua/9router)
- **O que faz:** roteador de "AI coding grátis" (Claude Code, Cursor, Cline…) via
  40+ provedores; 17.9K stars. **OmniRoute é seu superset.**
- **Licença:** **MIT** ("MIT License - see LICENSE for details"). 🟢 reuso direto
  possível.
- **Esgotamento:** fallback **3 camadas** (Subscription → Cheap → Free), sem
  detalhar se o gatilho é quota, erro ou ambos.
- **Contexto na troca:** ❌ **não abordado** — trocar de modelo no meio pode
  perder histórico dependendo da implementação (gap reconhecido na própria doc).
- **Roteamento por capacidade:** ❌ só erro/quota; a doc admite que "trocas
  incompatíveis podem falhar silenciosamente".
- **Free:** Kiro AI (~50 créditos/mês), OpenCode Free (lista flutua), Vertex AI
  (US$300/90 dias novos GCP). Descontinuados em 2026: iFlow, Qwen Code, Gemini
  CLI. Fonte: [repo 9router](https://github.com/decolua/9router).
- **Redundância:** 🔁 **descartado por redundância** — OmniRoute é superset
  declarado (adiciona context-relay, 4ª camada, multimodal, circuit breaker).
  Ver OmniRoute para a versão adotada.

## Achado transversal da Frente A (o mais importante para o Model Router)

> **Os três roteadores caem por erro/quota — nenhum roteia por capacidade de
> input.** Nenhum pergunta "este modelo aceita imagem/áudio/arquivo/este tamanho
> de contexto?" *antes* de enviar. É por isso que o bug de 27/07 aconteceu, e é
> exatamente aí que a Aurora pode **superar** todas as três: um **Model Router
> capability-aware** que roteia por matriz de modalidade *antes* do erro, e só usa
> fallback por quota como segunda linha. `context-relay` (OmniRoute, MIT) é a
> spec comportamental a reimplementar para não perder histórico na troca.

## Proposta preliminar do Model Router da Aurora (a consolidar após Frente D)

Diferencial vs. tudo auditado, em três camadas:
1. **Roteamento por capacidade (pré-envio):** matriz `modelo × modalidade`
   (texto/imagem/áudio/arquivo/contexto-máx). Input com imagem só vai para modelo
   com visão. Elimina a classe do 404 na origem (complementa o fix de payload
   `56d6e6c`).
2. **Fallback por quota (pós-erro):** cascata estilo OmniRoute (free→free), com
   **preservação de contexto** estilo `context-relay` — o histórico já é reenviado
   pelo cliente (ADR-0011), então a troca é transparente ao usuário.
3. **Nunca expor o erro:** 429/404 viram troca silenciosa + evento de telemetria
   (o `friendlyChatError` de hoje é o fallback de última linha, não o caminho normal).
- **Onde vive:** camada no `noesis-mcp`? módulo próprio? A decidir na síntese
  final — candidato natural é evoluir o `MODEL-ROUTER.md`/telemetria que já
  existe, com a matriz de capacidade como dado versionado no vault.

---

# Frente B — Arquitetura de referência (Odysseus AI) ⏳ pendente
# Frente C — Skills / MCPs / Plugins (20 itens) ⏳ pendente
# Frente D — Modelos e apps locais ⏳ pendente
# Frente E — Vídeos de referência (13) ⏳ pendente — ver limitação de transcrição no Método

---

## Tabela mestre de capacidades únicas ⏳ (após todas as frentes)
## Arquitetura do Model Router — ADR ⏳ (após Frentes A + D)
