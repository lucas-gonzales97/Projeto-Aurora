// Reflexão automática (ADR-0013) — job de fim de sessão que sintetiza uma
// conclusão de nível mais alto sobre o usuário a partir da conversa e do que
// o vault considerou relevante nela (reflection-tree, Park et al. 2023,
// "Generative Agents"). Módulo puro (sem Electron/IPC/chamada real ao LLM) —
// index.ts orquestra get_context/provider/create_note; aqui só decisão e
// construção de texto, testável sem nenhum dos dois.

export interface ReflectionMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ReflectionEntity {
  id: string;
  title?: string | null;
}

// Heurística de salience v0: contagem de trocas do usuário na sessão — NÃO é
// a soma de importância de memórias desde a última reflexão que o paper usa
// (isso exigiria importância avaliada por LLM em CADA mensagem na gravação,
// que a Aurora ainda não faz — ver pendência "importância via LLM na
// gravação" no journal 2026-07-23). É um placeholder honesto: barato, sempre
// disponível, mas cego a QUÃO relevante foi a conversa, só a quão longa.
export const REFLECTION_THRESHOLD = 3;

export function countUserMessages(messages: ReflectionMessage[]): number {
  return messages.filter((m) => m.role === "user").length;
}

export function shouldReflect(userMessageCount: number, threshold: number = REFLECTION_THRESHOLD): boolean {
  return userMessageCount >= threshold;
}

export const REFLECTION_SYSTEM_PROMPT = `Você é o processo de reflexão da Aurora (ADR-0013) — não conversa com o usuário, analisa uma sessão já encerrada por fora.
Tarefa: ler a transcrição e as entidades do vault que foram ativadas durante ela, e decidir se existe UM padrão, tendência ou conclusão de nível mais alto sobre o usuário que vale a pena registrar como hipótese — algo que uma mensagem isolada não mostraria, mas o conjunto sim.
Seja conservador: a maioria das sessões NÃO produz uma reflexão nova. Só sintetize se houver sinal real (recorrência, contradição, mudança, padrão implícito); nunca parafraseie uma única frase do usuário como se fosse um insight.
Responda em EXATAMENTE um dos dois formatos abaixo, sem nada além disso:

SKIP

ou

CONFIANÇA: <número entre 0.1 e 0.6>
REFLEXÃO: <uma frase objetiva, em português, descrevendo o padrão>`;

export function buildReflectionPrompt(messages: ReflectionMessage[], activatedEntities: ReflectionEntity[]): string {
  const transcript = messages.length > 0
    ? messages.map((m) => `${m.role === "user" ? "Usuário" : "Aurora"}: ${m.content}`).join("\n")
    : "(sessão sem mensagens)";
  const entitiesBlock = activatedEntities.length > 0
    ? activatedEntities.map((e) => `- ${e.id}${e.title ? ` — ${e.title}` : ""}`).join("\n")
    : "(nenhuma entidade do vault foi ativada nesta sessão)";
  return `TRANSCRIÇÃO DA SESSÃO:\n${transcript}\n\nENTIDADES DO VAULT ATIVADAS NESTA SESSÃO:\n${entitiesBlock}`;
}

export interface ReflectionResult {
  skip: boolean;
  body?: string;
  confidence?: number;
}

const MIN_CONFIDENCE = 0.1;
// Reflexão nasce como hipótese, nunca como fato consolidado (Art. VIII-2 —
// nada vira certeza sem confirmação humana); teto deliberadamente baixo
// mesmo que o LLM devolva um número maior.
const MAX_CONFIDENCE = 0.6;
const DEFAULT_CONFIDENCE = 0.3;

export function parseReflectionResponse(raw: string): ReflectionResult {
  const trimmed = (raw ?? "").trim();
  if (!trimmed || /^SKIP\b/i.test(trimmed)) return { skip: true };

  const reflMatch = /REFLEX[ÃA]O:\s*([\s\S]+)/i.exec(trimmed);
  if (!reflMatch) return { skip: true }; // fora do formato esperado — não arrisca nota malformada

  const body = reflMatch[1].trim().split("\n")[0].trim(); // uma frase, ignora qualquer coisa a mais
  if (!body) return { skip: true };

  const confMatch = /CONFIAN[ÇC]A:\s*([0-9]*\.?[0-9]+)/i.exec(trimmed);
  const parsed = confMatch ? Number(confMatch[1]) : NaN;
  const confidence = Math.min(MAX_CONFIDENCE, Math.max(MIN_CONFIDENCE, Number.isFinite(parsed) ? parsed : DEFAULT_CONFIDENCE));

  return { skip: false, body, confidence };
}

/** id kebab-case determinístico — data + prefixo curto da sessão evita colisão entre sessões do mesmo dia. */
export function buildReflectionNoteId(sessionId: string, createdISO: string): string {
  const shortSession = sessionId.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 8) || "sessao";
  return `pattern-reflexao-${createdISO}-${shortSession}`;
}

export function buildReflectionNoteBody(text: string, confidence: number, activatedEntityCount: number): string {
  return `# Reflexão automática\n\n${text}\n\n---\n_Gerada pelo job de fim de sessão (ADR-0013) a partir de ${activatedEntityCount} entidade(s) do vault ativada(s) durante a conversa. Confiança inicial: ${confidence} — é uma hipótese, não um fato consolidado (Art. VIII-2)._`;
}

export interface ReflectionRelation {
  target: string;
  kind: string;
  reason: string;
}

/** Relação semântica: a reflexão EMERGE das entidades que estavam ativas na conversa que a originou. */
export function buildReflectionRelations(activatedEntities: ReflectionEntity[]): ReflectionRelation[] {
  return activatedEntities.map((e) => ({
    target: e.id,
    kind: "emerge_de",
    reason: "entidade ativada na sessão que originou esta reflexão",
  }));
}
