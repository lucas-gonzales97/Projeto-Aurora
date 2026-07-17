---
id: adr-0002-interfaces
type: decision
version: 1.0.0
status: accepted
created: 2026-07-17
confidence: 0.75
mutable_by_system: never
supersedes: none
---

# ADR-0002 — Estratégia de interfaces da Aurora e territórios de conhecimento

## Contexto

O usuário quer: (a) a Aurora acessível no dia a dia de trabalho (VS Code, empresa onde é o único dev e a governança de TI de facto), (b) um app desktop com interface gráfica estilo Claude Desktop com áreas para automações/RPA e código, (c) uma extensão VS Code privada, (d) acesso via celular. Restrição: conceito em construção — nada pode ficar público.

## Decisões

### 1. Três territórios de conhecimento (refina o modelo de 2 territórios do DIA-1)

| território | propriedade | conteúdo | repo |
|---|---|---|---|
| Vault pessoal (`~/noesis`) | do usuário | vida, goals, skills, carreira, Aurora | privado dele |
| Repos de código da empresa | da empresa | código, integrações ML/Tiny/Olist, dados | da empresa |
| **Vault organizacional** (novo) | da empresa | conhecimento de negócio: eletrônica da produção, processos BPMN, regras, integrações documentadas, decisões | da empresa, mantido pelo usuário |

O vault organizacional é entregável de trabalho (guardião de conhecimento → conhecimento versionado e auditável; sucessão e onboarding) e evidência real da arquitetura LCA para TCC e portfólio. A Aurora pessoal pode *ler* o vault organizacional em sessões de trabalho, mas os dois nunca se fundem: destino de cada nota é decidido pela pergunta "isso pertence a mim ou à empresa?".

### 2. Um motor, várias caras

Todas as interfaces são cascas sobre o mesmo par **{Claude Agent SDK + noesis-mcp + vault}**. O Agent SDK é a infraestrutura do Claude Code exposta como biblioteca (loop agêntico, ferramentas, contexto, permissões, MCP, tetos de custo/turnos — o Art. IV nativo). Nenhuma interface reimplementa motor.

Ordem de construção (cada etapa entrega valor sozinha, padrão do roadmap):

1. **noesis-mcp v0** (fim de semana; requisito da Fase 1): `read_note`, `search_notes`, `create_note`, `create_relation`, `log_event`, `get_context(intent)`. Serve o Claude Code hoje e todas as interfaces futuras.
2. **Aurora Desktop v0**: Tauri (preferência: leve, Rust+web; alternativa Electron) + Agent SDK TypeScript + vault. Escopo v0: janela de chat com streaming, persona carregada de AURORA-PERSONA.md, MCP do vault plugado. Só isso.
3. **Aurora Desktop v1**: abas Automações (gatilhos, RPA supervisionado), Código, Painel (goals/habits/telemetria do router).
4. **Extensão VS Code privada** (VSIX local via `vsce package` + "Install from VSIX" — sem marketplace, sem publicação): só quando houver dor real que o Claude Code no terminal integrado não cubra.
5. **Celular**: v0 = app Claude + alarmes (já operante); v1 = interface web da Aurora servida do servidor caseiro na rede local/VPN (Tailscale), quando o hardware 24/7 existir.

### 3. Privacidade do conceito

Nada é publicado: repos privados, VSIX local, app desktop distribuído a ninguém. Abertura futura (TCC, portfólio) será decisão explícita e datada do usuário.

## Alternativas rejeitadas

- **Construir "um Claude" do zero via API bruta:** meses reinventando loop, permissões e contexto que o Agent SDK já entrega testado; violaria o princípio de fases que entregam valor cedo.
- **Extensão VS Code como primeira interface:** o Claude Code já cobre o VS Code via terminal integrado; a extensão viraria over-engineering antes de valor (risco nº1 do roadmap).
- **Vault único misturando pessoa e empresa:** risco de PI/confidencialidade para o usuário e para a empresa; fere Art. VIII-5 (perímetro).

## Consequências

- O caminho do celular e do app desktop passa a depender do noesis-mcp v0 — pressão saudável para a Fase 1 sair.
- O vault organizacional cria um segundo consumidor da arquitetura → generalização forçada dos schemas (bom para o LCA como pesquisa e para o TCC).
- Custo: assinatura/créditos atuais do usuário; tetos de orçamento do SDK aplicados em toda interface desde o v0.
