---
id: adr-0005
type: decision
version: 1.0.0
status: accepted
created: 2026-07-20
confidence: 0.65
mutable_by_system: never
supersedes: none
---

# ADR-0005 — Onboarding epistêmico conversacional

## Contexto

`design/ADR-0004-design-system.md` já formalizou que a identidade **visual**
da Aurora é agnóstica de usuário. Esta ADR resolve o mesmo problema na
camada de **dados**: hoje, `user-model/` já vem povoado com o USER-MODEL de
Lucas (8 goals, 3 skills) porque nasceu junto com o vault, na Genesis. Isso
é correto para este vault específico, mas não escala — um novo usuário do
Aurora Desktop abre o app e encontra um `user-model/` vazio, sem goals, sem
values, sem skills, sem patterns. Nada no produto hoje resolve essa
inicialização.

`USER-MODEL.md` (`user-model/USER-MODEL.md`) é o **schema** do USER-MODEL
(índice + definição de tipos), não uma instância por usuário — não existe
hoje um arquivo único que represente "o perfil deste usuário". A
inicialização real de um usuário novo é a criação das primeiras notas
`goal`/`value`/`skill` nas pastas correspondentes.

Princípio herdado de `ADR-0001-persona-como-dado.md`: a identidade da
Aurora **emerge** do grafo, nunca é hard-coded. Aplicado a um usuário novo,
isso significa que não existe (e não deve existir) um perfil-padrão
pré-preenchido — o grafo mínimo do usuário só pode nascer de algo que ele
mesmo declarou.

## Decisão

### 1. Onboarding conversacional, não formulário

Na primeira execução do app (USER-MODEL vazio — ver critério operacional na
seção 5), antes de qualquer sessão normal, a Aurora conduz uma entrevista
conversacional: uma pergunta aberta por vez, sem campos de formulário, sem
checkboxes de interesse pré-definidas. Cobre, na ordem que a conversa
permitir (não é um roteiro rígido): nome, o que a pessoa quer da vida,
interesses e paixões (qualquer domínio — filosofia, design, música,
programação, esoterismo, esportes, o que for; sem julgamento e sem viés
para tecnologia/eletrônica só porque foi o domínio do primeiro usuário),
como ela pensa/aprende melhor, personalidade percebida pela própria
conversa, e medos/bloqueios **só se ela quiser compartilhar**.

### 2. System prompt próprio, modo "entrevistador"

O onboarding roda sob um system prompt dedicado — substitui inteiramente o
`AURORA_SYSTEM` do chat normal, não o complementa. Traços obrigatórios do
prompt: empático, curioso, sem julgamento, uma pergunta por mensagem,
aprofunda quando a resposta pedir em vez de pular de tema, e ao final
sintetiza em poucas frases o que aprendeu antes de declarar o onboarding
encerrado. Ver `aurora-desktop/src/renderer/AuroraApp.tsx`
(`ONBOARDING_SYSTEM`) para o texto exato.

### 3. Escrita no vault ao final — via `noesis-mcp`, nunca hard-coded

Ao final da entrevista, o sistema roda uma segunda chamada ao modelo (system
prompt de síntese separado) pedindo um resumo estruturado da conversa, e
grava esse resumo no vault através dos mesmos tools que o Claude Code usa —
`create_note` para cada `goal`/`value`/`skill` declarado, e uma nota
`journal/onboarding.md` com a síntese legível da sessão. Nenhum dado vai
para o grafo sem passar por `scripts/validate_frontmatter.py` (mesma
garantia que `noesis-mcp` já dá para qualquer escrita).

**Desvio deliberado do pedido original — `patterns/` não é escrito no
onboarding.** `ontology/ontology.yaml` é explícito: *"patterns/ só recebe
entidades type: hypothesis subtype: user-pattern, nunca criadas
manualmente"*, e o schema de `pattern` exige `origin: inferred` com no
mínimo 3 eventos de evidência independentes antes de poder ser proposto.
Um traço que o próprio usuário declara na entrevista (ex.: "eu penso
melhor conversando em voz alta") é `declared`, não `inferred` — escrevê-lo
em `patterns/` corromperia a distinção declarado-vs-inferido que é "a regra
mais importante do USER-MODEL" (`USER-MODEL.md` §"Distinção
constitucional"). Esses traços (interesses, personalidade percebida,
estilo de aprendizagem, bloqueios) vão para `journal/onboarding.md` como
texto — ficam disponíveis para `get_context` e para o usuário reler, sem
fingir ser uma hipótese com evidência que ainda não existe. Se, com o
tempo, o comportamento observado do usuário confirmar um desses traços por
evidência real (≥3 eventos), aí sim ele pode nascer como `hypothesis` em
`patterns/` — pelo caminho normal, não pelo onboarding.

### 4. O grafo cresce continuamente depois do onboarding

O onboarding inicializa o grafo; não o encerra. Toda interação posterior
(texto, voz, imagem, contexto trazido em conversa) é evidência potencial
que pode atualizar o USER-MODEL via `create_note` (nova entidade),
`create_relation` (nova conexão) e `log_event` (evidência bruta) — o
sistema aprende a aprender sobre aquele usuário específico, sessão após
sessão. **Escopo desta ADR e do código que a acompanha:** o app já expõe
`create_note`/`create_relation`/`log_event` via IPC e já usa `log_event` em
todo turno do chat normal (evidência bruta contínua); a extração automática
de *novas* entidades (`goal`/`value`/`skill`) a partir de conversas comuns
pós-onboarding — decidir sozinho, no meio de um chat qualquer, que algo
dito vale virar uma nota nova — é trabalho futuro, não implementado aqui.
Hoje isso continua acontecendo do jeito que já funciona no vault: por
proposta explícita revisada por Lucas (ou, na sessão do Claude Code, por
este agente lendo o `log_event`/journal e propondo notas).

### 5. Critério operacional de "primeira execução" (v0)

Não existe um único arquivo "perfil do usuário" para checar vazio/cheio.
Na prática, `is-first-run` = verdadeiro quando `user-model/goals/`,
`user-model/values/`, `user-model/skills/` e `user-model/patterns/` não
contêm nenhuma nota — nenhuma flag adicional, nenhum arquivo de estado
separado. Isso tem uma propriedade conveniente: o próprio ato de escrever
as primeiras notas no final do onboarding já torna `is-first-run` falso na
próxima abertura, sem precisar de um mecanismo de "marcar como concluído"
paralelo.

### 6. Fora do escopo do v0 (futuro)

- Onboarding atrelado a login/senha, com USER-MODEL persistido por conta de
  usuário (hoje o "usuário" é implicitamente "quem está sentado no
  computador rodando este vault local" — sem multiusuário).
- Extração automática de entidades novas a partir de qualquer conversa
  (item 4 acima).
- Reabrir/editar o onboarding depois de concluído (hoje, se `user-model/`
  já tem notas, o onboarding nunca mais roda — não há um "refazer
  apresentação").

## Consequências

**Positivas:**
- A Aurora se mantém genérica por construção: nada no fluxo de onboarding
  assume um domínio de interesse específico — o mesmo código serve alguém
  que só quer falar de poesia e nunca tocou em código.
- O primeiro grafo do usuário nasce com a mesma proveniência
  (`origin: declared`, evidência textual da conversa) que qualquer outra
  nota `declared` do vault — sem caminho especial ou schema paralelo.
- `journal/onboarding.md` funciona como ponto de referência humano-legível
  para o próprio usuário conferir "o que a Aurora entendeu de mim" logo de
  cara, sem precisar ler frontmatter.

**Negativas / riscos:**
- Uma síntese gerada por LLM ao final da entrevista pode interpretar mal
  uma resposta (ex.: confundir um interesse casual com uma meta séria) —
  mitigado por essas notas nascerem com `confidence` moderada (não 0.9
  como uma declaração direta e inequívoca) e por ficarem visíveis /
  editáveis como qualquer nota do vault.
- Se o parsing da síntese estruturada falhar (LLM não devolve o formato
  esperado), o onboarding não deve travar o usuário fora do app — cai para
  gravar só a síntese em texto livre em `journal/onboarding.md` e segue
  para o chat normal mesmo sem `goal`/`value`/`skill` estruturados; a
  entrevista não se perde, só fica menos estruturada até a próxima sessão.

## Alternativas rejeitadas

- **Formulário estruturado (campos fixos, multi-select de interesses):**
  rejeitado — pressupõe categorias de interesse de antemão, o que é
  exatamente o viés de domínio que este ADR existe para evitar.
- **Sem onboarding — deixar o USER-MODEL crescer só organicamente pelo
  uso:** rejeitado para o v0 porque `get_context` fica quase vazio nas
  primeiras sessões, e a Aurora perde a chance de já chegar sabendo o
  básico de quem é a pessoa — pior primeira impressão sem ganho real.
- **Escrever traços declarados na entrevista direto em `patterns/`:**
  rejeitado (ver seção 3) — violaria a distinção declarado-vs-inferido que
  o próprio `USER-MODEL.md` define como regra central.
