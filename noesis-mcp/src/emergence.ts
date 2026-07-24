// Métrica de emergência (ADR-0013, Frente 5 da agenda de pesquisa): a razão
// emergido/inserido é o sinal mais simples e honesto de que "está nascendo
// algo" — quanto do vault veio de reflexão automática (consolidação, sem
// input humano direto) vs. tudo que entrou por mão do usuário/onboarding.
// Fonte de verdade do marcador: frontmatter.origin === "reflection"
// (ontology.yaml, hypothesis.origin), gravado pelo job de fim de sessão.

export interface EmergenceEntry {
  frontmatter?: Record<string, unknown>;
}

export interface EmergenceRatio {
  total: number;
  emerged: number;
  inserted: number;
  /** emerged / inserted; null quando não há denominador (vault vazio ou só reflexões). */
  ratio: number | null;
}

export function emergenceRatio(entries: EmergenceEntry[]): EmergenceRatio {
  const total = entries.length;
  const emerged = entries.filter((e) => e.frontmatter?.origin === "reflection").length;
  const inserted = total - emerged;
  return {
    total,
    emerged,
    inserted,
    ratio: inserted > 0 ? emerged / inserted : null,
  };
}
