import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ChatStore } from "./chatStore";

// ADR-0011: o histórico de chat é memória episódica crua — os testes cobrem o
// repositório de dados de ponta a ponta CONTRA O DISCO (lição do bug #4 /
// ADR-0008: confirmação em memória ≠ evidência; persistir de verdade é o que
// conta, então cada teste decisivo reabre o banco do zero a partir do arquivo).

let dir: string;
let dbPath: string;
let store: ChatStore;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "aurora-chatdb-"));
  dbPath = path.join(dir, "chat.db");
  store = new ChatStore(dbPath);
});

afterEach(async () => {
  await store.close().catch(() => {});
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("ChatStore — sessões e mensagens (CRUD)", () => {
  it("cria sessão, grava mensagens e as recupera na ordem por ts", async () => {
    await store.newSession("s1", "2026-07-23T10:00:00.000Z");
    await store.appendMessage({ sessionId: "s1", role: "user", content: "primeira", ts: "2026-07-23T10:00:01.000Z" });
    await store.appendMessage({
      sessionId: "s1", role: "assistant", content: "resposta", ts: "2026-07-23T10:00:02.000Z",
      modelUsed: "llama-3.3-70b-versatile", providerUsed: "groq",
    });
    await store.appendMessage({ sessionId: "s1", role: "user", content: "segunda", ts: "2026-07-23T10:00:03.000Z" });

    const msgs = await store.loadSession("s1");
    expect(msgs.map((m) => m.content)).toEqual(["primeira", "resposta", "segunda"]);
    expect(msgs[1].model_used).toBe("llama-3.3-70b-versatile");
    expect(msgs[1].provider_used).toBe("groq");
    expect(msgs[0].model_used).toBeNull();
    expect(msgs[0].domain_classified).toBeNull();
  });

  it("mensagens no MESMO timestamp preservam ordem de inserção", async () => {
    await store.newSession("s1");
    const ts = "2026-07-23T10:00:00.000Z";
    for (const c of ["a", "b", "c"]) {
      await store.appendMessage({ sessionId: "s1", role: "user", content: c, ts });
    }
    const msgs = await store.loadSession("s1");
    expect(msgs.map((m) => m.content)).toEqual(["a", "b", "c"]);
  });

  it("FK: mensagem para sessão inexistente é rejeitada", async () => {
    await expect(
      store.appendMessage({ sessionId: "nao-existe", role: "user", content: "x" }),
    ).rejects.toThrow(/FOREIGN KEY/i);
  });

  it("role fora de user/assistant é rejeitado pelo CHECK", async () => {
    await store.newSession("s1");
    await expect(
      store.appendMessage({ sessionId: "s1", role: "system" as any, content: "x" }),
    ).rejects.toThrow(/CHECK/i);
  });
});

describe("ChatStore — listagem de sessões", () => {
  it("lista mais recente primeiro, com contagem e preview da 1ª mensagem do usuário", async () => {
    await store.newSession("antiga", "2026-07-22T09:00:00.000Z");
    await store.appendMessage({ sessionId: "antiga", role: "user", content: "oi de ontem", ts: "2026-07-22T09:00:01.000Z" });
    await store.newSession("nova", "2026-07-23T09:00:00.000Z");
    await store.appendMessage({ sessionId: "nova", role: "user", content: "oi de hoje", ts: "2026-07-23T09:00:01.000Z" });
    await store.appendMessage({ sessionId: "nova", role: "assistant", content: "olá!", ts: "2026-07-23T09:00:02.000Z" });

    const sessions = await store.listSessions();
    expect(sessions.map((s) => s.id)).toEqual(["nova", "antiga"]);
    expect(sessions[0].message_count).toBe(2);
    expect(sessions[0].preview).toBe("oi de hoje");
  });

  it("sessão sem nenhuma mensagem NÃO aparece na lista (ruído de sessões abertas e abandonadas)", async () => {
    await store.newSession("vazia", "2026-07-23T09:00:00.000Z");
    await store.newSession("com-msg", "2026-07-23T10:00:00.000Z");
    await store.appendMessage({ sessionId: "com-msg", role: "user", content: "oi" });
    const sessions = await store.listSessions();
    expect(sessions.map((s) => s.id)).toEqual(["com-msg"]);
  });

  it("endSession grava ended_at", async () => {
    await store.newSession("s1", "2026-07-23T09:00:00.000Z");
    await store.appendMessage({ sessionId: "s1", role: "user", content: "oi" });
    await store.endSession("s1", "2026-07-23T09:30:00.000Z");
    const [s] = await store.listSessions();
    expect(s.ended_at).toBe("2026-07-23T09:30:00.000Z");
  });
});

describe("ChatStore — persistência real no disco (critério do ADR-0011)", () => {
  it("mensagens sobrevivem a fechar e reabrir o banco (simula restart do app)", async () => {
    await store.newSession("s1", "2026-07-23T10:00:00.000Z");
    await store.appendMessage({ sessionId: "s1", role: "user", content: "sobrevive?", ts: "2026-07-23T10:00:01.000Z" });
    await store.appendMessage({ sessionId: "s1", role: "assistant", content: "sim", ts: "2026-07-23T10:00:02.000Z", modelUsed: "m", providerUsed: "p" });
    await store.close();

    // Reabre DO ARQUIVO — nada em memória compartilhada.
    expect(fs.existsSync(dbPath)).toBe(true);
    const reopened = new ChatStore(dbPath);
    try {
      const msgs = await reopened.loadSession("s1");
      expect(msgs.map((m) => m.content)).toEqual(["sobrevive?", "sim"]);
      const sessions = await reopened.listSessions();
      expect(sessions[0].id).toBe("s1");
      expect(sessions[0].message_count).toBe(2);
    } finally {
      await reopened.close();
      store = new ChatStore(dbPath); // pro afterEach fechar sem erro
    }
  });
});
