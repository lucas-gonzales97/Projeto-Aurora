// Temporalidade das interações — formatação e marcação temporal do chat.
//
// O `ts` de cada mensagem existe no chat.db desde o ADR-0011, mas era
// descartado em dois pontos: o renderer não o carregava (a UI nunca mostrou
// hora) e o histórico enviado ao modelo ia como texto puro — a Aurora sabia
// que horas são AGORA (nowContext em prompt.ts) mas não QUANDO cada fala da
// conversa aconteceu. Este módulo resolve os dois usos, com funções puras.
//
// Nota de arquitetura: main e renderer têm tsconfigs com rootDir separados
// (mexer nisso mudaria dist/main/index.js), então reflection.ts formata seu
// próprio timestamp no main. Não é a duplicação de schema que o ADR-0008
// combate — aqui só se compartilha "formatar ISO em America/Sao_Paulo",
// enquanto as REGRAS de apresentação são genuinamente diferentes (a UI agrupa
// por dia; a transcrição da reflexão precisa de data absoluta por linha).

export const TZ = "America/Sao_Paulo";

/** Minutos de silêncio a partir dos quais a próxima fala ganha marca temporal. */
export const GAP_MINUTES = 30;

function toDate(iso: string | undefined | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "14:16" no fuso do usuário. Retorna "" para ts ausente/inválido. */
export function formatTime(iso: string | undefined | null, tz: string = TZ): string {
  const d = toDate(iso);
  if (!d) return "";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(d);
}

/**
 * Chave de dia no fuso do usuário ("2026-07-24") — usada pra agrupar e comparar.
 * en-CA porque produz YYYY-MM-DD, que ordena e compara como string.
 */
export function dayKey(iso: string | undefined | null, tz: string = TZ): string {
  const d = toDate(iso);
  if (!d) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** "24/07/2026 14:16" — forma absoluta, usada nas marcas pro modelo. */
export function formatAbsolute(iso: string | undefined | null, tz: string = TZ): string {
  const d = toDate(iso);
  if (!d) return "";
  const date = new Intl.DateTimeFormat("pt-BR", { timeZone: tz, day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
  return `${date} ${formatTime(iso, tz)}`;
}

/** Rótulo do separador de dia: "Hoje", "Ontem" ou "24 de julho de 2026". */
export function formatDayLabel(iso: string | undefined | null, now: Date = new Date(), tz: string = TZ): string {
  const d = toDate(iso);
  if (!d) return "";
  const key = dayKey(iso, tz);
  if (key === dayKey(now.toISOString(), tz)) return "Hoje";
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (key === dayKey(yesterday.toISOString(), tz)) return "Ontem";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: tz, day: "numeric", month: "long", year: "numeric" }).format(d);
}

/** Minutos entre dois ts. null se algum for inválido. */
export function minutesBetween(aIso: string | undefined | null, bIso: string | undefined | null): number | null {
  const a = toDate(aIso);
  const b = toDate(bIso);
  if (!a || !b) return null;
  return Math.abs(b.getTime() - a.getTime()) / 60000;
}

/**
 * Decide se a mensagem no índice `i` abre um novo bloco de dia (ou seja, se um
 * separador de data deve ser desenhado antes dela). A primeira mensagem COM ts
 * sempre abre; mensagens sem ts nunca abrem (a saudação de UI, por exemplo).
 */
export function startsNewDay(messages: Array<{ ts?: string }>, i: number, tz: string = TZ): boolean {
  const key = dayKey(messages[i]?.ts, tz);
  if (!key) return false;
  for (let j = i - 1; j >= 0; j--) {
    const prev = dayKey(messages[j]?.ts, tz);
    if (prev) return prev !== key;
  }
  return true;
}

export interface TimedMessage {
  role: "user" | "assistant";
  text: string;
  ts?: string;
}

/**
 * Marca temporal no histórico enviado ao MODELO. Só anota onde a informação
 * muda algo — primeira fala datada, virada de dia, ou silêncio maior que
 * `gapMinutes` — pra não poluir trocas rápidas com um carimbo por linha.
 * Mensagens sem ts passam intactas.
 */
export function annotateHistoryForModel<T extends TimedMessage>(
  messages: T[],
  opts: { gapMinutes?: number; tz?: string } = {},
): Array<{ role: T["role"]; text: string }> {
  const gap = opts.gapMinutes ?? GAP_MINUTES;
  const tz = opts.tz ?? TZ;
  let lastTs: string | undefined;
  return messages.map((m) => {
    if (!m.ts || !dayKey(m.ts, tz)) return { role: m.role, text: m.text };
    const gapMin = minutesBetween(lastTs, m.ts);
    const newDay = lastTs ? dayKey(lastTs, tz) !== dayKey(m.ts, tz) : true;
    const longSilence = gapMin !== null && gapMin >= gap;
    const mark = newDay || longSilence;
    lastTs = m.ts;
    return mark ? { role: m.role, text: `[${formatAbsolute(m.ts, tz)}] ${m.text}` } : { role: m.role, text: m.text };
  });
}
