// Vocabulário amigável do grafo (decisão de produto): traduz os tipos técnicos
// do vault para linguagem que QUALQUER pessoa entende, não só quem é da área.
// A aba Mente é pra você acompanhar o que a Aurora "pensa" a cada conversa —
// então cada nó precisa dizer, em português claro, o que representa.

export interface TypeInfo {
  /** rótulo curto e humano (aparece no selo do nó) */
  label: string;
  /** cor do tipo (paleta bancada) */
  color: string;
  /** uma frase em linguagem simples: o que esse tipo de nó É */
  meaning: string;
}

// Ordem importa: é a ordem da legenda (do mais "seu" ao mais "da Aurora").
export const TYPE_INFO: Record<string, TypeInfo> = {
  goal: { label: "Meta", color: "#8FDDBE", meaning: "algo que você quer conquistar" },
  habit: { label: "Hábito", color: "#6FBFA0", meaning: "uma rotina que você está construindo ou largando" },
  project: { label: "Projeto", color: "#C98B5F", meaning: "algo concreto que você está tocando" },
  skill: { label: "Habilidade", color: "#B0764F", meaning: "algo que você sabe fazer" },
  value: { label: "Valor", color: "#E7E2D6", meaning: "um princípio que importa pra você" },
  hypothesis: { label: "Suspeita", color: "#9FB4D8", meaning: "algo que a Aurora percebeu sobre você e ainda está confirmando" },
  identity: { label: "Autoconhecimento", color: "#D8C89F", meaning: "como a própria Aurora se entende" },
  foundation: { label: "Base", color: "#8FA3A0", meaning: "as regras fundamentais que a Aurora não muda sozinha" },
  decision: { label: "Decisão", color: "#7A8F98", meaning: "uma escolha de como a Aurora foi construída" },
  conflict: { label: "Tensão", color: "#D97B6C", meaning: "um conflito entre duas coisas suas" },
  meta: { label: "Anotação", color: "#5F7376", meaning: "um registro interno da Aurora" },
};

export const UNKNOWN_TYPE: TypeInfo = { label: "Nó", color: "#5F7376", meaning: "um elemento da memória da Aurora" };

export function typeInfo(type: string | null | undefined): TypeInfo {
  return (type && TYPE_INFO[type]) || UNKNOWN_TYPE;
}

// Traduz os "kind" de relação (que no vault são slugs tipo depende_de) pra
// frases legíveis: "X depende de Y", "X sustenta Y".
const KIND_LABEL: Record<string, string> = {
  emerge_de: "nasce de",
  serve_a: "serve a",
  subordinada_a: "obedece a",
  entrelaçado_com: "está entrelaçada com",
  sustenta: "sustenta",
  sustentado_por: "é sustentada por",
  depende_de: "depende de",
  coordena: "coordena",
  coordenado_por: "é coordenada por",
  complementa: "complementa",
  pode_usar_como_meio: "pode usar como meio para",
  irmã_de: "é irmã de",
  parte_de: "é parte de",
  sinergia_com: "tem sinergia com",
  avanca_com: "avança junto com",
};

export function kindLabel(kind: string): string {
  return KIND_LABEL[kind] ?? kind.replace(/_/g, " ");
}

// Limpa o rótulo do nó pra leitura humana. Regras (nesta ordem):
//  1. Journal ("journal-2026-07-23-…") vira "Diário de 23/07/2026".
//  2. Tira crase/aspas.
//  3. Num título "A — B", escolhe o lado certo do travessão: normalmente o
//     depois ("Goal — Emprego CLT" -> "Emprego CLT"), MAS quando o depois é
//     fraco (uma palavra só, ou começa minúsculo = subtítulo), fica com o antes
//     ("Rotina Nutricional — compartimento coordenador" -> "Rotina Nutricional";
//      "Extensão do USER-MODEL — strategy (...)" -> "Extensão do USER-MODEL").
//  4. Corta o parêntese explicativo do fim se ainda sobra nome com ≥2 palavras.
export function cleanLabel(title: string | null | undefined, id: string): string {
  // 1. journals -> data amigável
  if (id.startsWith("journal")) {
    const d = `${title ?? ""} ${id}`.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (d) return `Diário de ${d[3]}/${d[2]}/${d[1]}`;
  }

  let s = (title ?? "").trim();
  if (!s) {
    // sem título: transforma o id-slug em algo legível
    return id
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();
  }

  // 2. tira crase e aspas (retas e curvas)
  s = s.replace(/[`"'“”‘’]/g, "").trim();

  // 3. escolhe o lado do travessão
  const parts = s.split(/\s+—\s+/);
  if (parts.length > 1) {
    const after = parts.slice(1).join(" — ").trim();
    const f = after.charAt(0);
    const afterWeak = !after.includes(" ") || (f !== "" && f === f.toLowerCase() && f !== f.toUpperCase());
    s = afterWeak ? parts[0].trim() : after;
  }

  // 4. corta parêntese final se ainda sobra nome com ≥2 palavras
  const noParen = s.replace(/\s*\([^)]*\)\s*$/, "").trim();
  if (noParen && noParen.split(/\s+/).length >= 2) s = noParen;

  return s || (title ?? id);
}
