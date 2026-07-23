---
id: adr-0011
type: decision
version: 1.0.0
status: accepted
created: 2026-07-23
confidence: 0.75
mutable_by_system: never
supersedes: none
---

# ADR-0011 — Persistência de chat: memória episódica crua em SQLite local

## Hipótese (do plano de 23/07)

> O histórico de chat é a camada episódica crua da arquitetura (CoALA) —
> persistir íntegro localmente, com metadados que já alimentam o futuro
> roteador.

É a "opção alinhada com a arquitetura" da pesquisa (Parte 1.3): o chat
persiste completo como camada 0; o que sobe pro grafo é o destilado
(reflexão/consolidação — fase futura). Resolve a tensão "guardar tudo vs.
grafo limpo" com camadas de semântica distinta — exatamente a distinção de
persistência que a crítica ao CoALA (arXiv 2604.11364) pede.

## Decisão

1. **SQLite local em `userData/chat.db`** (`%APPDATA%\aurora-desktop\chat.db`)
   — perfil do usuário do SO, tanto em dev quanto empacotado. NUNCA no repo,
   NUNCA no instalador (electron-builder só empacota `dist/**` +
   `extraResources`; userData fica fora por construção — mesma lógica de
   isolamento do vault no ADR-0008). `.gitignore` não é necessário: o arquivo
   nem nasce dentro do repo.
2. **Schema** (`aurora-desktop/src/main/chatStore.ts`):
   - `sessions(id, started_at, ended_at, summary)`
   - `messages(id, session_id FK CASCADE, role CHECK(user|assistant), content,
     ts, model_used, provider_used, domain_classified)`
   - índice `(session_id, ts, id)`; `PRAGMA foreign_keys = ON` (OFF por
     padrão no SQLite — sem isso o REFERENCES é decorativo); WAL.
   - `model_used/provider_used/domain_classified` já nascem no schema: são a
     telemetria que o roteador por domínio (Camada 1) vai consumir.
3. **Driver: `sqlite3` (N-API), divergência deliberada do plano** (que
   sugeria better-sqlite3): better-sqlite3 compila contra a ABI do V8 — o
   binário do vitest (Node) não serve o Electron, exigindo rebuild alternado
   e Visual Studio Build Tools. O sqlite3 N-API tem UM binário pré-compilado
   que serve Node (testes), Electron dev e app empacotado. Mesma lição do
   ADR-0008 (validador sem Python): dependência de toolchain é bug de
   empacotamento esperando pra acontecer. Trade-off (API assíncrona, menos
   throughput) é irrelevante pra chat mensagem-a-mensagem.
4. **IPC**: `chat:new-session`, `chat:append`, `chat:list-sessions`,
   `chat:load-session`. A mensagem do usuário é persistida pelo renderer; a
   resposta do assistente é persistida **no main** (payload de `chat:send`
   ganhou `sessionId` opcional) — o main é quem sabe modelo/provedor
   autoritativos, e grava mesmo se o renderer morrer antes do done.
5. **UI mínima**: botão de histórico na barra de input → overlay com sessões
   (data, contagem, preview da 1ª mensagem do usuário); carregar = retomar a
   sessão (mensagens novas continuam nela). Sessão criada preguiçosamente no
   primeiro envio; sessões sem mensagem não aparecem na listagem.
6. A saudação inicial da UI deixou de alegar "já conheço teus goals" —
   confabulação de interface com vault vazio (coerência com ADR-0009). Ela é
   local da UI e não é persistida (não é fala do modelo).

## Validação (2026-07-23)

- **Testes** (`src/main/chatStore.test.ts`, vitest): 8 testes — CRUD com
  ordenação por ts (e desempate por ordem de inserção), FK rejeitando sessão
  inexistente, CHECK de role, listagem (recente primeiro, contagem, preview,
  sessões vazias filtradas), ended_at, e o decisivo: **fechar e reabrir o
  banco a partir do arquivo** com tudo íntegro (lição do bug #4: confirmação
  em memória ≠ evidência). Suíte completa: 59/59; tsc limpo (main+renderer).
- **Validação em disco real**: ciclo executado contra o caminho de produção
  de dev (`C:\Users\Pichau\AppData\Roaming\aurora-desktop\chat.db`) —
  gravar → fechar processo de escrita → reabrir do disco → sessão listada
  com preview e contagem corretas, mensagens na ordem, metadados
  model/provider presentes → dados de teste removidos.
- **Pendente**: o fluxo completo pela UI (3+ mensagens reais → fechar app →
  reabrir → retomar sessão) depende de provedor LLM ativo — re-testar junto
  com A2/A4. O caminho renderer→IPC→store é o mesmo validado acima.

## Consequências / aberto

- `sessions/messages` é a semente do sync desktop↔mobile (Frente 7) — o
  espelho Postgres+RLS replica estas tabelas.
- `ended_at`/`summary` ainda não são preenchidos pelo app (ficam pro job de
  fim de sessão da reflexão automática — Bloco E futuro, que também vai
  destilar o episódico pro grafo).
- `domain_classified` fica null até o classifyDomain v0 existir.
- Imagens não são persistidas no histórico (só o texto; anexo vira "(imagem)")
  — decisão de v0 pra não inflar o banco com base64.
