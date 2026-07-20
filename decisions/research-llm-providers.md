---
id: research-llm-providers
type: meta
status: active
created: 2026-07-20
---

# Pesquisa — Provedores de LLM para o Aurora Desktop (multi-provider)

> Fase 1 da evolução multi-provedor do `aurora-desktop` (hoje só fala com a
> API Anthropic via `ANTHROPIC_API_KEY` fixa em variável de ambiente — ver
> `decisions/ADR-0003-aurora-desktop.md`). Este documento é pesquisa datada,
> não decisão — a decisão de arquitetura fica em
> `decisions/ADR-0006-multi-provider-llm.md`. Pesquisado via busca web em
> 2026-07-20; **preços, free tiers e nomes de modelo mudam com frequência —
> revalidar contra a doc oficial de cada provedor antes de confiar em
> qualquer número aqui em uso futuro.**

## Tabela comparativa

| provedor | free tier real | auth | endpoint base | compat. OpenAI | destaque |
|---|---|---|---|---|---|
| **Anthropic** | Não (trial único de US$5, precisa SMS) | header `x-api-key` + `anthropic-version` | `https://api.anthropic.com/v1` | Não (shape próprio) | já implementado hoje; melhor para a persona/voz da Aurora |
| **OpenAI** | Inconsistente (crédito de US$5 no cadastro não é mais garantido); programa opt-in de tokens grátis/dia em troca de compartilhar tráfego para treino | `Authorization: Bearer` | `https://api.openai.com/v1` | É a origem do formato | catálogo mais amplo de ferramentas/ecossistema |
| **Google Gemini** | Sim, por modelo (ex.: Gemini 3 Flash: 10 RPM/1500 req/dia; Gemini 2.5 Pro: 50 req/dia) — some ao ligar billing no projeto | header `x-goog-api-key` (ou `?key=` na query) | `https://generativelanguage.googleapis.com/v1beta` | Não (`contents[]`, não `messages[]`) | free tier genuinamente usável; **atenção:** free tier permite Google usar input/output pra treino |
| **Groq** | Sim, generoso, sem cartão — todo modelo, só limitado por rate limit (~30 RPM/6K TPM/14,4K req/dia, varia por modelo) | `Authorization: Bearer` | `https://api.groq.com/openai/v1` | **Sim, nativo** | inferência absurdamente rápida (hardware LPU próprio) |
| **Mistral** | Sim ("Experiment tier"): todos os modelos incl. Mistral Large/Codestral, ~1B tokens/mês, sem cartão | `Authorization: Bearer` | `https://api.mistral.ai/v1` | Próximo o suficiente (chat completions) | bom custo-benefício nos modelos pagos (Small 3: US$0,10/US$0,30 por 1M) |
| **Cohere** | Trial key automática no cadastro: 1000 chamadas/mês, 20 req/min — **não pode uso produtivo/comercial** | `Authorization: Bearer` | `https://api.cohere.com/v2` (Chat API v2) | Não (shape próprio) | forte em RAG/rerank, menos relevante pra chat geral |
| **OpenRouter** | Sim: 28+ modelos `:free`, sem cartão; rate limit 50 req/dia (<US$10 de crédito já comprado) ou 1000 req/dia (≥US$10) | `Authorization: Bearer` | `https://openrouter.ai/api/v1` | **Sim, nativo** | agregador — um endpoint, catálogo de 300+ modelos de dezenas de provedores |
| **Ollama** | Sim, sempre — é local, sem chave, sem custo de API (custo é hardware/energia do usuário) | nenhuma | `http://localhost:11434/v1` | **Sim, nativo** (desde as versões recentes) | única opção 100% offline; exige o usuário rodar `ollama pull <modelo>` antes |
| **DeepSeek** | Não encontrado free tier — só pago, mas extremamente barato (Flash: US$0,14/1M in, US$0,28/1M out; cache-hit 50x mais barato) | `Authorization: Bearer` | `https://api.deepseek.com/v1` | **Sim, nativo** | melhor custo por token entre os pagos; aliases antigos (`deepseek-chat`/`deepseek-reasoner`) descontinuando 2026-07-24 |

## Notas por provedor

### Anthropic (já implementado)
SDK `@anthropic-ai/sdk` já é dependência do `aurora-desktop`
(`src/main/index.ts`). Sem free tier de API direta — só o trial único de
US$5. Fica como o provedor "padrão de fábrica" do app por já estar
funcionando e por ser quem dá nome/voz à persona da Aurora, mas deixa de
ser a única opção.

### OpenAI
Sem free tier confiável hoje (o crédito de cadastro varia e vem sendo
descontinuado). O formato de `chat/completions` é o que os outros
provedores "compatíveis com OpenAI" imitam — então, ironicamente, dá pra
tratar o OpenAI oficial como só mais uma instância desse formato genérico.

### Google Gemini
Free tier real e generoso em requisições/dia, mas **shape de API
diferente** (`contents: [{ role, parts: [{ text }] }]`, não
`messages: [{ role, content }]`) e **imagem também é diferente** (`parts`
com `inline_data`). Ponto de atenção de privacidade: no free tier, o Google
pode usar input/output para treinar modelos — vale um aviso na UI se/quando
o usuário selecionar Gemini.

### Groq
Free tier é o mais generoso e "sem pegadinha" da lista — sem cartão, todos
os modelos, só limitado por rate limit. Como já é OpenAI-compatível
nativamente, é o candidato mais forte pra "primeiro provedor grátis
recomendado" no onboarding de configuração de key.

### Mistral
Free "Experiment tier" cobre inclusive os modelos maiores (Mistral Large,
Codestral) com teto generoso (~1B tokens/mês), mas Mistral não publica mais
os números exatos de rate limit publicamente (fica no Admin Console). Vale
tratar como "compatível o bastante" com o formato OpenAI para reaproveitar
a mesma classe genérica, com teste dedicado pra confirmar.

### Cohere
Free trial é pequeno (1000 chamadas/mês) e explicitamente proibido para
uso comercial/produtivo — adequado só para o usuário testar a integração,
não para uso diário do Aurora Desktop. Shape de API é próprio (Chat API
v2: `message`, não `messages[]` no formato OpenAI). **Decisão de escopo:**
documentado aqui, mas fora da implementação de código do v0 (ver
ADR-0006) — exigiria uma classe dedicada só para um free tier que já vem
com aviso de "não use em produção".

### OpenRouter
Agregador — não é "mais um provedor", é uma forma de acessar dezenas
deles por uma chave só, incluindo muitos gratuitos. Nativamente compatível
com o formato OpenAI. Bom "modo fácil" para o usuário que não quer decidir
entre 8 provedores: configura uma chave OpenRouter e escolhe o modelo (que
pode ser gratuito) na lista.

### Ollama
Único provedor sem API key — "autenticação" é só ter o Ollama rodando
localmente (`http://localhost:11434`). Requer o usuário ter instalado o
Ollama e feito `ollama pull <modelo>` antes de usar; o app deveria detectar
se o servidor local responde antes de oferecê-lo como opção ativa (não dá
pra "validar a chave" porque não existe chave — a validação vira "o
servidor local está de pé e tem pelo menos 1 modelo baixado?").

### DeepSeek
Sem free tier, mas o mais barato entre os pagos por uma boa margem — vale
como opção de "produção econômica" depois que o usuário já validou o app
com um provedor gratuito. Nativamente compatível com OpenAI.

## Recomendação para a Fase 2 (arquitetura)

Dos 9 provedores pesquisados, **6 falam nativamente (ou quase) o formato
`chat/completions` da OpenAI**: OpenAI, Groq, Mistral, OpenRouter, Ollama,
DeepSeek. Isso justifica uma única classe `OpenAICompatibleProvider`
parametrizada por `baseURL`/`apiKeyHeader`/lista de modelos, em vez de 6
classes quase idênticas — Anthropic e Gemini precisam de classes próprias
por terem shape de request/response genuinamente diferente. Cohere fica
documentado mas fora do escopo de implementação do v0 (ver seção acima e
`decisions/ADR-0006-multi-provider-llm.md`).

## Fontes

- [Free Models Router — OpenRouter](https://openrouter.ai/openrouter/free)
- [OpenRouter Pricing](https://openrouter.ai/pricing)
- [OpenRouter Free Tier 2026 — Klymentiev](https://klymentiev.com/blog/openrouter-free-tier)
- [Ollama — OpenAI compatibility (docs oficiais)](https://docs.ollama.com/api/openai-compatibility)
- [Ollama Blog — OpenAI compatibility](https://ollama.com/blog/openai-compatibility)
- [Gemini API — Rate limits (docs oficiais)](https://ai.google.dev/gemini-api/docs/rate-limits)
- [Gemini API — Pricing (docs oficiais)](https://ai.google.dev/gemini-api/docs/pricing)
- [Gemini API Free Tier 2026 — TokenMix](https://tokenmix.ai/blog/gemini-api-free-tier-limits)
- [Groq Free Tier Limits 2026 — TokenMix](https://tokenmix.ai/blog/groq-free-tier-limits-2026)
- [Groq Pricing 2026 — CloudZero](https://www.cloudzero.com/blog/groq-pricing/)
- [OpenAI API Billing 2026 — TokenMix](https://tokenmix.ai/blog/openai-api-billing-explained)
- [OpenAI Free Credits 2026 — Klymentiev](https://klymentiev.com/blog/openai-free-credits)
- [Mistral — Pricing (site oficial)](https://mistral.ai/pricing/)
- [Mistral AI Pricing 2026 — Grizzly Peak Software](https://www.grizzlypeaksoftware.com/articles/p/mistral-ai-pricing-in-2026-pro-costs-free-tier-limits-and-api-rates-lx4o2n2v)
- [Cohere — Rate limits (docs oficiais)](https://docs.cohere.com/docs/rate-limits)
- [Cohere Trial Key Pricing and Limits — codenote](https://codenote.net/en/posts/cohere-trial-api-key-pricing-and-limits/)
- [DeepSeek — Models & Pricing (docs oficiais)](https://api-docs.deepseek.com/quick_start/pricing/)
- [DeepSeek API Pricing July 2026 — TLDL](https://www.tldl.io/resources/deepseek-api-pricing)
- [Claude Platform Docs — Pricing (site oficial Anthropic)](https://platform.claude.com/docs/en/about-claude/pricing)
- [Anthropic Free Tier 2026 — Price Per Token](https://pricepertoken.com/endpoints/anthropic/free)
