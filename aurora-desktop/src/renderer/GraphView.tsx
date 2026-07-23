import { useEffect, useRef, useState } from "react";
import { DataSet, Network } from "vis-network/standalone";
import { C } from "./AuroraApp";

// Aba Grafo (ADR-0012): o vault como rede viva. Nós coloridos por type,
// física do vis-network pra sensação orgânica, e "sinapses acendendo": todo
// get_context real emite graph:activated do main — os nós recuperados ganham
// brilho fósforo com fade-out. Clique num nó abre painel com frontmatter+corpo.

// Cores por type — derivadas da paleta "bancada" (design/tokens.md). Goals em
// fósforo (o que o usuário persegue), skills/projects em cobre (as mãos),
// resto em tons neutros — mesma lógica de ênfase do Painel.
const TYPE_COLORS: Record<string, string> = {
  goal: "#8FDDBE",
  habit: "#6FBFA0",
  project: "#C98B5F",
  skill: "#B0764F",
  value: "#E7E2D6",
  hypothesis: "#9FB4D8",
  identity: "#D8C89F",
  foundation: "#8FA3A0",
  decision: "#7A8F98",
  conflict: "#D97B6C",
  meta: "#5F7376",
};

const ACTIVATION_COLOR = "#8FDDBE";
const ACTIVATION_FADE_MS = 1200;

interface NoteDetail {
  path: string;
  frontmatter: Record<string, any>;
  body: string;
}

export default function GraphView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);
  const nodesRef = useRef<DataSet<any> | null>(null);
  const edgesRef = useRef<DataSet<any> | null>(null);
  const fadeTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [counts, setCounts] = useState<{ nodes: number; edges: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ id: string; detail: NoteDetail | null } | null>(null);
  const [lastActivated, setLastActivated] = useState<string[]>([]);

  function baseNodeStyle(type: string) {
    const color = TYPE_COLORS[type] ?? TYPE_COLORS.meta;
    return {
      color: { background: C.panelUp, border: color, highlight: { background: C.panel, border: color } },
      font: { color: C.bone, size: 11, face: "IBM Plex Mono" },
      borderWidth: 1.5,
      shadow: { enabled: false },
    };
  }

  useEffect(() => {
    let disposed = false;

    window.aurora.graph
      .getSnapshot()
      .then((snap) => {
        if (disposed || !containerRef.current) return;
        const nodes = new DataSet(
          snap.nodes.map((n) => ({
            id: n.id,
            label: n.label.length > 28 ? `${n.label.slice(0, 26)}…` : n.label,
            title: `${n.type} · ${n.id}`,
            shape: "dot",
            size: n.type === "goal" ? 12 : 9,
            ...baseNodeStyle(n.type),
            noteType: n.type,
          })),
        );
        const edges = new DataSet(
          snap.edges.map((e, i) => ({
            id: `e${i}`,
            from: e.from,
            to: e.to,
            title: e.kind,
            width: 0.5 + e.weight * 1.5,
            color: { color: C.line, highlight: C.copper, opacity: 0.7 },
            smooth: { enabled: true, type: "continuous", roundness: 0.4 },
          })),
        );
        nodesRef.current = nodes;
        edgesRef.current = edges;
        setCounts({ nodes: snap.nodes.length, edges: snap.edges.length });

        const network = new Network(
          containerRef.current,
          { nodes, edges },
          {
            physics: {
              solver: "forceAtlas2Based",
              forceAtlas2Based: { gravitationalConstant: -40, springLength: 90, damping: 0.6 },
              stabilization: { iterations: 120 },
            },
            interaction: { hover: true, tooltipDelay: 150 },
            layout: { improvedLayout: true },
          },
        );
        networkRef.current = network;

        network.on("click", (params: any) => {
          const id = params.nodes?.[0];
          if (!id) {
            setSelected(null);
            return;
          }
          setSelected({ id, detail: null });
          window.aurora.mcp
            .readNote({ id })
            .then((detail) => setSelected((cur) => (cur?.id === id ? { id, detail } : cur)))
            .catch(() => setSelected((cur) => (cur?.id === id ? { id, detail: null } : cur)));
        });
      })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));

    // Sinapse acendendo: nó ativado ganha fundo fósforo + sombra, e volta ao
    // estado base depois do fade. Timers por nó pra ativações sobrepostas.
    const offActivated = window.aurora.graph.onActivated(({ ids }) => {
      const nodes = nodesRef.current;
      if (!nodes) return;
      setLastActivated(ids);
      for (const id of ids) {
        if (!nodes.get(id)) continue;
        const prev = fadeTimersRef.current.get(id);
        if (prev) clearTimeout(prev);
        nodes.update({
          id,
          color: { background: ACTIVATION_COLOR, border: ACTIVATION_COLOR },
          font: { color: "#0C1517", size: 11, face: "IBM Plex Mono" },
          shadow: { enabled: true, color: ACTIVATION_COLOR, size: 18, x: 0, y: 0 },
        });
        fadeTimersRef.current.set(
          id,
          setTimeout(() => {
            const noteType = (nodes.get(id) as any)?.noteType ?? "meta";
            nodes.update({ id, ...baseNodeStyle(noteType) });
            fadeTimersRef.current.delete(id);
          }, ACTIVATION_FADE_MS),
        );
      }
    });

    return () => {
      disposed = true;
      offActivated();
      for (const t of fadeTimersRef.current.values()) clearTimeout(t);
      fadeTimersRef.current.clear();
      networkRef.current?.destroy();
      networkRef.current = null;
    };
  }, []);

  return (
    <div className="flex flex-col h-full" style={{ position: "relative" }}>
      <p className="aur-mono px-3 pt-3" style={{ fontSize: 10, color: C.dim, marginBottom: 4 }}>
        {err
          ? `grafo indisponível: ${err}`
          : counts
            ? `${counts.nodes} nós · ${counts.edges} relações · nós acendem a cada retrieval`
            : "montando o grafo do vault…"}
      </p>
      <div ref={containerRef} className="flex-1" style={{ minHeight: 0 }} />
      {lastActivated.length > 0 && (
        <p className="aur-mono px-3 pb-1" style={{ fontSize: 9.5, color: C.phosphor, opacity: 0.8 }}>
          último retrieval: {lastActivated.join(" · ")}
        </p>
      )}
      {selected && (
        <div style={{
          position: "absolute", left: 8, right: 8, bottom: 8, maxHeight: "55%",
          background: C.panel, border: `1px solid ${C.line}`, borderLeft: `2px solid ${C.copper}`,
          borderRadius: 12, padding: "10px 12px", overflowY: "auto", zIndex: 10,
        }}>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="aur-mono" style={{ fontSize: 11, color: C.phosphor }}>{selected.id}</span>
            <button onClick={() => setSelected(null)} className="aur-mono"
              style={{ color: C.dim, fontSize: 11, background: "transparent", border: "none", cursor: "pointer" }}>
              fechar ×
            </button>
          </div>
          {!selected.detail && <p style={{ color: C.dim, fontSize: 12 }}>lendo nota…</p>}
          {selected.detail && (
            <>
              <pre className="aur-mono" style={{
                fontSize: 10, color: C.dim, whiteSpace: "pre-wrap", background: C.panelUp,
                border: `1px solid ${C.line}`, borderRadius: 8, padding: 8, marginBottom: 8,
              }}>{JSON.stringify(selected.detail.frontmatter, null, 1)}</pre>
              <div style={{ fontSize: 12.5, color: C.bone, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                {selected.detail.body}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
