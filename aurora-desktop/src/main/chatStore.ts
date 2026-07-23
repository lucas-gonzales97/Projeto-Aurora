import sqlite3 from "sqlite3";

// Persistência de chat (ADR-0011): o histórico é a MEMÓRIA EPISÓDICA CRUA da
// arquitetura (camada 0 do CoALA) — persiste íntegro, local, em SQLite no
// userData do usuário (NUNCA no repo nem no instalador). O que sobe pro grafo
// é o destilado (reflexão/consolidação, fase futura); aqui só se guarda tudo.
//
// model_used/provider_used/domain_classified já nascem no schema porque são a
// telemetria que o roteador por domínio (Camada 1 do motor adaptativo) vai
// consumir — mesma tabela, dois consumidores, como a pesquisa recomenda.
//
// Driver: sqlite3 (N-API) e não better-sqlite3 — binário único pré-compilado
// serve Node (vitest) E Electron (dev + empacotado) sem rebuild por ABI nem
// Visual Studio Build Tools na máquina do usuário. Mesma lição do ADR-0008
// (validador sem Python): dependência de toolchain é bug de empacotamento
// esperando pra acontecer. Trade-off (API assíncrona, menos throughput) é
// irrelevante aqui: chat grava mensagem por mensagem.

export interface SessionRow {
  id: string;
  started_at: string;
  ended_at: string | null;
  summary: string | null;
  /** derivados pra UI de histórico */
  message_count: number;
  preview: string | null;
}

export interface MessageRow {
  id: number;
  session_id: string;
  role: string;
  content: string;
  ts: string;
  model_used: string | null;
  provider_used: string | null;
  domain_classified: string | null;
}

export interface AppendMessageInput {
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  ts?: string;
  modelUsed?: string | null;
  providerUsed?: string | null;
  domainClassified?: string | null;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  ended_at   TEXT,
  summary    TEXT
);
CREATE TABLE IF NOT EXISTS messages (
  id                TEXT PRIMARY KEY,
  session_id        TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role              TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content           TEXT NOT NULL,
  ts                TEXT NOT NULL,
  model_used        TEXT,
  provider_used     TEXT,
  domain_classified TEXT
);
CREATE INDEX IF NOT EXISTS idx_messages_session_ts ON messages(session_id, ts, id);
`;

export class ChatStore {
  private db: sqlite3.Database;
  private ready: Promise<void>;
  private seq = 0;

  constructor(dbPath: string) {
    this.db = new sqlite3.Database(dbPath);
    this.ready = this.init();
    // Sem awaiter imediato, um init que falhe (ex.: close() logo após o
    // construtor) viraria unhandled rejection — quem chama os métodos ainda
    // recebe o erro via `await this.ready`.
    this.ready.catch(() => {});
  }

  private run(sql: string, params: unknown[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, (err) => (err ? reject(err) : resolve()));
    });
  }

  private all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows as T[])));
    });
  }

  private async init(): Promise<void> {
    // FKs são OFF por padrão no SQLite — sem o pragma, o REFERENCES é decorativo.
    await this.run("PRAGMA foreign_keys = ON");
    await this.run("PRAGMA journal_mode = WAL");
    for (const stmt of SCHEMA.split(";").map((s) => s.trim()).filter(Boolean)) {
      await this.run(stmt);
    }
  }

  /** id de mensagem ordenável e livre de colisão mesmo com ts idêntico no mesmo ms. */
  private nextMessageId(ts: string): string {
    this.seq = (this.seq + 1) % 1_000_000;
    return `${ts}-${String(this.seq).padStart(6, "0")}-${Math.random().toString(36).slice(2, 8)}`;
  }

  async newSession(id: string, startedAt: string = new Date().toISOString()): Promise<void> {
    await this.ready;
    await this.run("INSERT INTO sessions (id, started_at) VALUES (?, ?)", [id, startedAt]);
  }

  async appendMessage(input: AppendMessageInput): Promise<string> {
    await this.ready;
    const ts = input.ts ?? new Date().toISOString();
    const id = this.nextMessageId(ts);
    await this.run(
      `INSERT INTO messages (id, session_id, role, content, ts, model_used, provider_used, domain_classified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, input.sessionId, input.role, input.content, ts, input.modelUsed ?? null, input.providerUsed ?? null, input.domainClassified ?? null],
    );
    return id;
  }

  async endSession(id: string, endedAt: string = new Date().toISOString()): Promise<void> {
    await this.ready;
    await this.run("UPDATE sessions SET ended_at = ? WHERE id = ?", [endedAt, id]);
  }

  /** Sessões com mensagens, mais recente primeiro, com contagem e preview da 1ª msg do usuário. */
  async listSessions(limit = 50): Promise<SessionRow[]> {
    await this.ready;
    return this.all<SessionRow>(
      `SELECT s.id, s.started_at, s.ended_at, s.summary,
              COUNT(m.id) AS message_count,
              (SELECT content FROM messages
                WHERE session_id = s.id AND role = 'user'
                ORDER BY ts, id LIMIT 1) AS preview
         FROM sessions s
         JOIN messages m ON m.session_id = s.id
        GROUP BY s.id
        ORDER BY s.started_at DESC
        LIMIT ?`,
      [limit],
    );
  }

  async loadSession(sessionId: string): Promise<MessageRow[]> {
    await this.ready;
    return this.all<MessageRow>(
      "SELECT * FROM messages WHERE session_id = ? ORDER BY ts, id",
      [sessionId],
    );
  }

  async close(): Promise<void> {
    // Espera o init terminar antes de fechar — fechar no meio dos pragmas
    // derrubaria as queries pendentes com SQLITE_MISUSE.
    await this.ready.catch(() => {});
    return new Promise((resolve, reject) => {
      this.db.close((err) => (err ? reject(err) : resolve()));
    });
  }
}
