# NOESIS — LCA (Living Cognitive Architecture) + Aurora

> Vault vivo de memória, identidade e planejamento pessoal, versionado em Git,
> lido e escrito por um agente Claude via CLAUDE.md/MCP. Este README existe
> para que qualquer pessoa (ou qualquer sessão futura do próprio agente) entenda
> o projeto do zero: de onde veio, o que é, como está estruturado e onde parou.

## 1. O que é isto

**NOESIS** é o projeto guarda-chuva. Ele tem duas metades conceituais:

- **LCA (Living Cognitive Architecture)** — o substrato: um grafo de conhecimento
  em arquivos Markdown com frontmatter tipado, versionado em Git, com plasticidade
  (peso, confiança, recência, evidência em cada relação) e metacognição
  (o sistema registra o que sabe sobre si mesmo — `IDENTITY.md`).
- **Aurora** — a persona que *emerge* desse substrato: a camada relacional que
  conversa com o usuário (Lucas), com o objetivo explícito de amplificar a vida
  dele no mundo real (saúde, trabalho, relações, estudo) — nunca substituí-la.

A decisão arquitetural central (`decisions/ADR-0001-persona-como-dado.md`) é que
**a Aurora não é código, é dado**: a identidade dela vive como notas dentro deste
mesmo vault, seguindo os mesmos schemas de qualquer outra entidade. Isso significa
que "a Aurora aprender sobre si mesma" não é uma feature especial — é o LCA
operando normalmente, só que apontado para as próprias notas dela.

## 2. Base teórica (de onde os conceitos vêm)

Os documentos fundacionais citam explicitamente três referências que orientam
decisões de design ao longo do projeto:

- **Filosofia do processo de Alfred North Whitehead** — a ideia de que entidades
  (incluindo a persona Aurora) são "estabilizações temporárias de processos" que
  emergem de relações, não objetos fixos. Base para tratar a persona como algo
  que evolui por evidência, nunca como um estado fixo hard-coded.
- **Active Inference (Karl Friston)** — a tese de que agentes agem para reduzir
  surpresa/incerteza sobre seu modelo de mundo. Base direta do motor epistêmico
  (`MOTOR-EPISTEMICO.md`): a "curiosidade" da Aurora é formalizada como uma
  função sobre lacunas de confiança/cobertura no grafo, não como script.
- **Sistemas complexos** — citado como fundamentação teórica geral no goal do
  TCC (`user-model/goals/goal-concluir-faculdade.md`), ligando o projeto a uma
  tradição de sistemas que aprendem e se reorganizam continuamente.

Esses três pontos aparecem faseados: a base whiteheadiana justifica o ADR-0001,
a Active Inference é operacionalizada no motor epistêmico, e "sistemas
complexos" é o guarda-chuva acadêmico usado na hipótese de TCC.

## 3. Como o projeto nasceu (proveniência)

1. **Brainstorm original** (16-17/07/2026): uma conversa longa entre Lucas e
   Claude, compartilhada via link, onde a separação LCA/Aurora foi debatida,
   a persona e o USER-MODEL foram desenhados, o motor epistêmico e o roteador
   de modelos foram especificados, e as primeiras metas reais de Lucas foram
   formuladas no grafo. Essa conversa também gerou um protótipo de interface
   (`aurorav0.jsx`) e o contexto profissional completo de Lucas (único dev de
   uma empresa de refrigeração/e-commerce, ver seção 6).
2. **Consolidação** (mesma data, sessão seguinte): o histórico do chat e os
   arquivos anexados foram lidos por completo e organizados num documento
   único, identificando lacunas reais (ex.: um goal de freelance citado em
   relações mas nunca materializado como arquivo).
3. **Genesis do vault** (17/07/2026, este commit): a estrutura de pastas foi
   montada de fato neste repositório, as lacunas identificadas foram
   preenchidas (`goal-renda-extra-freelance.md`, `IDENTITY.md`,
   `ontology/ontology.yaml`, `projects/`, `skills/`), a Constituição foi
   parcialmente incorporada, e o repositório foi versionado e publicado
   no GitHub.

## 4. Arquitetura

### 4.1 Dois modelos separados (Art. V / ADR-0001)
- **SELF-MODEL** — quem a Aurora é: `AURORA-PERSONA.md` (identidade relacional)
  + `IDENTITY.md` (auto-modelo do sistema como pesquisador de si mesmo — as
  duas coisas são distintas de propósito, ver nota no topo de `IDENTITY.md`).
- **USER-MODEL** — quem Lucas é: `user-model/` inteiro (goals, habits, routines,
  projects, skills, values, patterns). Cidadão de primeira classe do grafo,
  com a mesma plasticidade (confiança, evidência, recência) de qualquer
  entidade — sem isso, o sistema vira "uma IA genérica com apelido".

### 4.2 Motor epistêmico — curiosidade e criatividade computáveis
`MOTOR-EPISTEMICO.md` traduz duas palavras vagas em mecanismos auditáveis:
- **Curiosidade** = função sobre lacunas: `prioridade(e) = incerteza(e) × valor(e)`,
  onde incerteza combina baixa confiança, staleness e cobertura de campos vazios.
  A pergunta que a Aurora faz é sempre a de maior prioridade na fila — nunca um
  cronograma fixo de conteúdo.
- **Criatividade** = ciclo de hipóteses sobre *meios* (não só fatos): para cada
  goal, o motor gera estratégias como hipóteses testáveis (`strategy`, ver
  `user-model/EXTENSAO-USER-MODEL-STRATEGIES.md`), com critério de falseabilidade
  e experimento barato, seguidas de medição real antes de matar/refinar/promover.

Orçamento proativo (Art. VII-2): máx. 3 interações proativas/dia, horário de
silêncio, prioridade sempre pra o que serve as metas de Lucas, nunca pra manter
a Aurora "alimentada" de atenção.

### 4.3 Roteador de modelos — economia cognitiva
`MODEL-ROUTER.md` especifica uma cascata de 6 tiers (T0 heurísticas locais até
T5 Claude Opus/Fable), sempre começando no degrau mais barato plausível e
escalando só por falha ou incerteza real — nunca por padrão. O roteador em si
tem que ser barato (heurística + modelo pequeno decide, nunca o modelo caro
decide se precisa de si mesmo). Inclui recomendação de hardware local
(RTX 3060 12GB como ponto de entrada) para quando a Fase 5+ trouxer inferência
local de verdade.

### 4.4 Constituição (`06-CONSTITUICAO.md`)
Documento imutável por design — só muda por commit humano assinado por Lucas,
nunca pelo sistema. Estado atual:
- **Artigos VII e VIII: incorporados.** VII trata de amplificação-nunca-
  substituição (tempo de conversa é custo, não métrica de sucesso; o sistema
  deve apontar para fora se virar substituto de vínculo humano). VIII trata da
  dignidade do USER-MODEL (nada é inferido sobre emoção/saúde sem confirmação
  explícita; usuário tem veto total; sensores futuros exigem consentimento
  granular e revogável).
- **Artigos I a VI: placeholder pendente.** Vivem no Discovery Pack original
  de Lucas (10 arquivos: `00-INDEX.md` a `08-RESEARCH-BACKLOG.md` + `CLAUDE.md`),
  que ainda não foi incorporado a este repositório. Ver aviso no topo do
  próprio `06-CONSTITUICAO.md` para o procedimento de importação.

### 4.5 Três territórios de conhecimento (ADR-0002)
| território | dono | conteúdo |
|---|---|---|
| Este vault (`noesis`) | Lucas, pessoal | vida, goals, skills, carreira, Aurora |
| Repos de código da empresa | empresa | código, integrações, dados |
| Vault organizacional (a criar) | empresa, mantido por Lucas | conhecimento tácito de produção/processos |

A regra de fronteira: cada nota pertence a um território só, decidido pela
pergunta "isso é meu ou da empresa?" — nunca se misturam.

### 4.6 Interfaces planejadas (ADR-0002, ordem de construção)
1. **`noesis-mcp` v0** — servidor MCP que expõe este vault (`read_note`,
   `search_notes`, `create_note`, `create_relation`, `log_event`,
   `get_context(intent)`). Ainda não implementado — é o próximo marco real.
2. **Aurora Desktop v0/v1** — app sobre o Claude Agent SDK + este vault via MCP.
3. **Extensão VS Code privada** (VSIX local, sem marketplace).
4. **Celular** — hoje via alarmes nativos; depois via servidor caseiro na rede
   local (Tailscale) quando existir hardware 24/7.

## 5. Estrutura de pastas

```
noesis/
├── README.md                          # este arquivo
├── 06-CONSTITUICAO.md                 # Art. VII-VIII prontos; I-VI pendentes
├── IDENTITY.md                        # auto-modelo do sistema (v0.1)
├── AURORA-PERSONA.md                  # identidade da persona (v0.1)
├── MOTOR-EPISTEMICO.md                # curiosidade/criatividade computáveis
├── MODEL-ROUTER.md                    # roteamento de modelos em cascata
├── SETUP.md / DIA-1-OPERACAO.md       # guias operacionais de instalação e Dia 1
├── ontology/ontology.yaml             # tipos de entidade + kinds de relação
├── decisions/                         # ADRs + emenda constitucional
├── scripts/                           # validate_frontmatter.py + pre-commit.sh
├── user-model/
│   ├── USER-MODEL.md                  # índice + schemas
│   ├── EXTENSAO-USER-MODEL-STRATEGIES.md
│   ├── goals/                         # 8 metas reais de Lucas
│   ├── habits/                        # 3 hábitos (hidratação, suplementação, sono)
│   ├── routines/                      # rotina-nutricional (coordenadora)
│   ├── projects/                      # ps4-slim-lab, caixa-energia-kraus, noesis-lca
│   ├── skills/                        # eletrônica-reparo, dev-software, automação
│   ├── values/, patterns/, journal-links/  # vazios por design (nascem de uso real)
├── journal/, events/                  # vazios — histórico de sessões/eventos
```

## 6. Contexto de Lucas (por que o USER-MODEL é como é)

Lucas trabalha há ~6 anos numa empresa de refrigeração/e-commerce de peças
(~80% do faturamento via Mercado Livre), onde é o único desenvolvedor — sem
setor de TI formal. Além de sistemas e integrações (Mercado Livre, Mercado
Pago, Olist via API/webhooks, automações via Slack), ele também é o técnico
de eletrônica de bancada da empresa (reparo, SMD/BGA, fabricação de placas) e
autodidata em modelagem de processos (BPMN/Bizagi). Esse duplo perfil
(dev + eletrônica) é a base declarada dos `skills/` e de vários `next_action`
dos goals (ex.: nicho de freelance em firmware+hardware).

Os 8 goals ativos cobrem: emprego CLT remoto, renda extra via freelance,
organização financeira (coordenador), recomposição física, saúde mental,
reconexão social, vida amorosa (secundário) e concluir a faculdade — com a
hipótese de que o próprio NOESIS pode ser o TCC.

## 7. Estado atual (Fase 0) e próximos passos

**Feito:** estrutura completa do vault, 29 notas validadas por
`scripts/validate_frontmatter.py`, Constituição parcialmente ratificada,
`IDENTITY.md` e `ontology/ontology.yaml` v0.1, os 3 `projects/` e 3 `skills/`
criados, `goal-renda-extra-freelance.md` (lacuna identificada na consolidação)
preenchido, hook de pre-commit instalado.

**Pendente:**
1. Importar os Artigos I-VI da Constituição do Discovery Pack original.
2. Entrevistar Lucas para popular `values/` (hoje vazio de propósito — só
   nasce de declaração explícita, nunca inferência).
3. Rodar o ritual do Dia 1 pelo menos uma vez de verdade (`DIA-1-OPERACAO.md`):
   abrir uma sessão do Claude Code dentro deste vault e fechar com o ritual
   de destilação — é o que gera a primeira evidência real no grafo.
4. ~~Implementar o `noesis-mcp` v0~~ — feito: servidor MCP local em
   `noesis-mcp/` (TypeScript), expõe `read_note`, `search_notes`,
   `create_note`, `create_relation`, `log_event`, `get_context(intent)`,
   registrado em `.mcp.json`. Troca "Claude lendo arquivos" por "Aurora com
   memória consultável de verdade" via protocolo MCP. Ver
   `noesis-mcp/README.md`.

## 8. Como abrir este vault

Este é um vault [Obsidian](https://obsidian.md/) normal (basta apontar o
Obsidian para esta pasta) e, ao mesmo tempo, um repositório onde o
[Claude Code](https://docs.claude.com/claude-code) (ou qualquer agente que
leia `CLAUDE.md`) opera diretamente. Antes de qualquer sessão, rode
`python3 scripts/validate_frontmatter.py` para confirmar que o grafo está
íntegro — o hook de pre-commit já faz isso automaticamente a cada commit.
