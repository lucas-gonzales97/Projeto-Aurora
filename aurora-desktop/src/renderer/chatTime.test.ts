import { describe, it, expect } from "vitest";
import {
  formatTime,
  dayKey,
  formatAbsolute,
  formatDayLabel,
  minutesBetween,
  startsNewDay,
  annotateHistoryForModel,
} from "./chatTime";

// America/Sao_Paulo é UTC-3 (sem horário de verão desde 2019).

describe("formatTime", () => {
  it("formata no fuso do usuário, não em UTC", () => {
    expect(formatTime("2026-07-24T17:16:00Z")).toBe("14:16");
  });

  it("devolve string vazia pra ts ausente ou inválido", () => {
    expect(formatTime(undefined)).toBe("");
    expect(formatTime(null)).toBe("");
    expect(formatTime("nao-e-data")).toBe("");
  });
});

describe("dayKey", () => {
  it("usa o dia local, não o dia UTC", () => {
    // 02:00Z do dia 25 ainda é dia 24 às 23:00 em São Paulo.
    expect(dayKey("2026-07-25T02:00:00Z")).toBe("2026-07-24");
  });

  it("é vazio pra ts inválido (nunca agrupa lixo)", () => {
    expect(dayKey("xx")).toBe("");
  });
});

describe("formatAbsolute", () => {
  it("junta data e hora locais", () => {
    expect(formatAbsolute("2026-07-24T17:16:00Z")).toBe("24/07/2026 14:16");
  });
});

describe("formatDayLabel", () => {
  const now = new Date("2026-07-27T15:00:00Z"); // segunda, 12:00 em SP

  it("diz Hoje pro mesmo dia local", () => {
    expect(formatDayLabel("2026-07-27T13:00:00Z", now)).toBe("Hoje");
  });

  it("diz Ontem pro dia anterior", () => {
    expect(formatDayLabel("2026-07-26T13:00:00Z", now)).toBe("Ontem");
  });

  it("usa data por extenso pra dias mais antigos", () => {
    expect(formatDayLabel("2026-07-24T17:16:00Z", now)).toBe("24 de julho de 2026");
  });
});

describe("minutesBetween", () => {
  it("mede o intervalo em minutos", () => {
    expect(minutesBetween("2026-07-24T17:00:00Z", "2026-07-24T17:45:00Z")).toBe(45);
  });

  it("é null quando falta um dos lados", () => {
    expect(minutesBetween(undefined, "2026-07-24T17:00:00Z")).toBeNull();
  });
});

describe("startsNewDay", () => {
  const msgs = [
    { ts: "2026-07-24T17:00:00Z" },
    { ts: "2026-07-24T17:05:00Z" },
    { ts: "2026-07-27T13:00:00Z" },
  ];

  it("a primeira mensagem datada abre o primeiro dia", () => {
    expect(startsNewDay(msgs, 0)).toBe(true);
  });

  it("mensagem do mesmo dia não abre separador", () => {
    expect(startsNewDay(msgs, 1)).toBe(false);
  });

  it("virada de dia abre separador", () => {
    expect(startsNewDay(msgs, 2)).toBe(true);
  });

  it("mensagem sem ts (saudação de UI) nunca abre separador", () => {
    expect(startsNewDay([{}, { ts: "2026-07-24T17:00:00Z" }], 0)).toBe(false);
  });

  it("ignora mensagens sem ts ao procurar o dia anterior", () => {
    const withGreeting = [{}, { ts: "2026-07-24T17:00:00Z" }, { ts: "2026-07-24T17:05:00Z" }];
    expect(startsNewDay(withGreeting, 1)).toBe(true);
    expect(startsNewDay(withGreeting, 2)).toBe(false);
  });
});

describe("annotateHistoryForModel", () => {
  it("marca a primeira fala datada", () => {
    const out = annotateHistoryForModel([
      { role: "user" as const, text: "oi", ts: "2026-07-24T17:16:00Z" },
    ]);
    expect(out[0].text).toBe("[24/07/2026 14:16] oi");
  });

  it("NÃO marca troca rápida (não polui a conversa)", () => {
    const out = annotateHistoryForModel([
      { role: "user" as const, text: "primeira", ts: "2026-07-24T17:00:00Z" },
      { role: "assistant" as const, text: "resposta", ts: "2026-07-24T17:00:30Z" },
      { role: "user" as const, text: "segunda", ts: "2026-07-24T17:02:00Z" },
    ]);
    expect(out[1].text).toBe("resposta");
    expect(out[2].text).toBe("segunda");
  });

  it("marca depois de silêncio longo", () => {
    const out = annotateHistoryForModel([
      { role: "user" as const, text: "antes", ts: "2026-07-24T17:00:00Z" },
      { role: "user" as const, text: "depois", ts: "2026-07-24T19:00:00Z" },
    ]);
    expect(out[1].text).toBe("[24/07/2026 16:00] depois");
  });

  it("marca virada de dia mesmo com intervalo curto", () => {
    const out = annotateHistoryForModel([
      { role: "user" as const, text: "ontem", ts: "2026-07-25T02:50:00Z" }, // 23:50 SP dia 24
      { role: "user" as const, text: "hoje", ts: "2026-07-25T03:10:00Z" }, // 00:10 SP dia 25
    ]);
    expect(out[1].text).toBe("[25/07/2026 00:10] hoje");
  });

  it("deixa intacta mensagem sem ts e não a usa como referência", () => {
    const out = annotateHistoryForModel([
      { role: "assistant" as const, text: "saudação sem ts" },
      { role: "user" as const, text: "primeira real", ts: "2026-07-24T17:16:00Z" },
    ]);
    expect(out[0].text).toBe("saudação sem ts");
    expect(out[1].text).toBe("[24/07/2026 14:16] primeira real");
  });

  it("respeita gapMinutes customizado", () => {
    const msgs = [
      { role: "user" as const, text: "a", ts: "2026-07-24T17:00:00Z" },
      { role: "user" as const, text: "b", ts: "2026-07-24T17:10:00Z" },
    ];
    expect(annotateHistoryForModel(msgs, { gapMinutes: 5 })[1].text).toBe("[24/07/2026 14:10] b");
    expect(annotateHistoryForModel(msgs, { gapMinutes: 60 })[1].text).toBe("b");
  });

  it("preserva o papel de cada mensagem", () => {
    const out = annotateHistoryForModel([
      { role: "user" as const, text: "p", ts: "2026-07-24T17:00:00Z" },
      { role: "assistant" as const, text: "r", ts: "2026-07-24T17:00:10Z" },
    ]);
    expect(out.map((m) => m.role)).toEqual(["user", "assistant"]);
  });
});
