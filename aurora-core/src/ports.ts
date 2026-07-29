// Portas do Aurora Core (ADR-0016) — as interfaces pelas quais o núcleo fala
// com o mundo. A plataforma implementa; o Core não sabe se é PC ou celular.
//
// É a FRONTEIRA CRÍTICA do ADR: hoje o retrieval é `fs`+Git (noesis-mcp);
// abstraí-lo por trás de VaultStore é o que permite o mesmo Core rodar sobre
// SQLite no Android sem reescrever a lógica.

/** Uma nota do vault, já parseada, SEM amarra de plataforma (nada de caminho
 * absoluto nem `fs`). O timestamp de fallback (`mtime`) vem da store, não do
 * disco — o Core nunca lê arquivo. */
export interface CoreNote {
  id: string | null;
  /** caminho relativo/identificador de origem, só para exibição/telemetria */
  path: string;
  /** frontmatter cru (type, status, importance, updated, created, relations…) */
  data: Record<string, any>;
  /** corpo em markdown */
  body: string;
  /** timestamp de fallback quando o frontmatter não traz updated/created */
  mtime: Date;
}

/** Fonte das notas. Desktop: Markdown+Git. Android (futuro): SQLite/arquivos. */
export interface VaultStore {
  /** todas as notas candidatas ao retrieval (o Core monta o índice a partir daqui) */
  listNotes(): CoreNote[];
}

/** Bloco de conteúdo de uma mensagem enviada ao modelo. */
export type LLMPart =
  | { type: "text"; text: string }
  | { type: "image"; mediaType: string; base64: string };

export interface LLMMessage {
  role: "user" | "assistant";
  content: LLMPart[];
}

/** Provedor de LLM (OpenRouter, Anthropic, on-device…). onDelta recebe cada
 * pedaço do streaming; resolve quando termina. */
export interface LLMProvider {
  stream(input: { system: string; messages: LLMMessage[] }, onDelta: (delta: string) => void): Promise<void>;
}
