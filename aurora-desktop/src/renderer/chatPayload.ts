// Montagem do payload de mensagens enviado ao modelo.
//
// Existe por causa de um bug observado ao vivo em 27/07: o envio remapeava as
// imagens de TODAS as mensagens do histórico, então bastava uma imagem entrar
// na conversa pra ela viajar junto em todo request seguinte. Com modelo sem
// visão isso quebrava a sessão de forma permanente — o usuário removia o anexo,
// mandava texto puro, e continuava recebendo 404 "No endpoints found that
// support image input" (registrado em events/2026-07-27.jsonl, 13:14→13:15);
// com modelo de visão, era custo de tokens repetido a cada turno.
//
// Regra: só o turno atual (última mensagem) carrega imagem. O modelo já
// respondeu às imagens anteriores — o que ele viu está no texto da resposta,
// que continua no histórico. Trade-off assumido: a Aurora não consegue
// "reolhar" uma imagem de turnos atrás; em troca, uma imagem nunca mais
// contamina o resto da conversa.

import { annotateHistoryForModel } from "./chatTime";

export interface PayloadImage {
  mediaType: string;
  base64: string;
}

export interface HistoryMessage {
  role: "user" | "assistant";
  text: string;
  ts?: string;
  images?: PayloadImage[];
}

export type PayloadPart =
  | { type: "text"; text: string }
  | { type: "image"; mediaType: string; base64: string };

export interface PayloadMessage {
  role: "user" | "assistant";
  content: PayloadPart[];
}

export function buildModelMessages(
  history: HistoryMessage[],
  opts: { gapMinutes?: number; tz?: string } = {},
): PayloadMessage[] {
  const annotated = annotateHistoryForModel(history, opts);
  const lastIndex = history.length - 1;
  return history.map((m, i) => {
    const text = annotated[i].text;
    const carriesImages = i === lastIndex ? (m.images ?? []) : [];
    const content: PayloadPart[] = [
      ...(text ? [{ type: "text" as const, text }] : []),
      ...carriesImages.map((img) => ({ type: "image" as const, mediaType: img.mediaType, base64: img.base64 })),
    ];
    // Provedores rejeitam content vazio; texto vazio sem anexo vira string vazia
    // explícita em vez de lista sem partes.
    return { role: m.role, content: content.length > 0 ? content : [{ type: "text" as const, text: "" }] };
  });
}
