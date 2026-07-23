import { useEffect, useRef, useState } from "react";
import { DataSet, Network } from "vis-network/standalone";
import { C } from "./AuroraApp";
import { TYPE_INFO, typeInfo, cleanLabel } from "./graphVocab";

// Aba Mente (ADR-0012): o "mapa da mente" da Aurora — tudo o que ela sabe,
// como uma rede viva. Cada conversa acende os nós que ela consultou, pra você
// ACOMPANHAR o que está acontecendo por dentro, em linguagem acessível (não
// precisa ser técnico). Nós coloridos por tipo, zoom/arraste livres, clique
// abre a nota em linguagem clara.

const ACTIVATION_COLOR = "#8FDDBE";
const ACTIVATION_FADE_MS = 2000;

interface NoteDetail {
  path: string;
  frontmatter: Record<string, any>;
  body: string;
}

interface NodeMeta {
  label: string;
  type: string;
}

export default function GraphView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);
  const nodesRef = useRef<DataSet<any> | null>(null);
  const nodeMetaRef = useRef<Map<string, NodeMeta>>(new Map());
  const fadeTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [counts, setCounts] = useState<{ nodes: number; edges: number } | null>(null);
  const [presentTypes, setPresentTypes] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ id: string; detail: NoteDetail | null } | null>(null);
  const [activated, setActivated] = useState<NodeMeta[]>([]);
  const [showLegend, setShowLegend] = useState(true);
  const [showTech, setShowTech] = useState(false);

  function baseNodeStyle(type: string) {
    const color = typeInfo(type).color;
    return {
      color: { background: C.panelUp, border: color, highlight: { background: C.panel, border: color } },
      font: { color: C.bone, size: 14, face: "Sora, system-ui, sans-serif" },
      borderWidth: 2,
      shadow: { enabled: false },
    };
  }

  useEffect(() => {
    let disposed = false;

    window.aurora.graph
      .getSnapshot()
      .then((snap) => {
        if (disposed || !containerRef.current) return;
        const meta = new Map<string, NodeMeta>();
        const typeSet = new Set<string>();
        const nodes = new DataSet(
          snap.nodes.map((n) => {
            const label = cleanLabel(n.label, n.id);
            meta.set(n.id, { label, type: n.type });
            typeSet.add(n.type);
            return {
              id: n.id,
              // Sem "…": rótulos longos quebram em linhas (widthConstraint),
              // pra ler o nome inteiro em vez de cortar.
              label,
              widthConstraint: { maximum: 150 },
              title: `${typeInfo(n.type).label}: ${label}`,
              shape: "dot",
              size: n.type === "goal" ? 18 : n.type === "project" || n.type === "skill" ? 15 : 12,
              ...baseNodeStyle(n.type),
              noteType: n.type,
            };
          }),
        );
        const edges = new DataSet(
          snap.edges.map((e, i) => ({
            id: `e${i}`,
            from: e.from,
            to: e.to,
            width: 0.6 + e.weight * 2,
            color: { color: C.line, highlight: C.copper, opacity: 0.6 },
            smooth: { enabled: true, type: "continuous", roundness: 0.4 },
          })),
        );
        nodesRef.current = nodes;
        nodeMetaRef.current = meta;
        setCounts({ nodes: snap.nodes.length, edges: snap.edges.length });
        setPresentTypes(Object.keys(TYPE_INFO).filter((t) => typeSet.has(t)));

        const network = new Network(
          containerRef.current,
          { nodes, edges },
          {
            physics: {
              solver: "forceAtlas2Based",
              forceAtlas2Based: { gravitationalConstant: -55, springLength: 130, damping: 0.7 },
              stabilization: { iterations: 160 },
            },
            interaction: { hover: true, tooltipDelay: 150, zoomView: true, dragView: true, navigationButtons: false },
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
          setShowTech(false);
          window.aurora.mcp
            .readNote({ id })
            .then((detail) => setSelected((cur) => (cur?.id === id ? { id, detail } : cur)))
            .catch(() => setSelected((cur) => (cur?.id === id ? { id, detail: null } : cur)));
        });
      })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));

    const offActivated = window.aurora.graph.onActivated(({ ids }) => {
      const nodes = nodesRef.current;
      if (!nodes) return;
      const metas = ids.map((id) => nodeMetaRef.current.get(id)).filter(Boolean) as NodeMeta[];
      setActivated(metas);
      for (const id of ids) {
        if (!nodes.get(id)) continue;
        const prev = fadeTimersRef.current.get(id);
        if (prev) clearTimeout(prev);
        nodes.update({
          id,
          color: { background: ACTIVATION_COLOR, border: ACTIVATION_COLOR },
          font: { color: "#0C1517", size: 14, face: "Sora, system-ui, sans-serif" },
          shadow: { enabled: true, color: ACTIVATION_COLOR, size: 26, x: 0, y: 0 },
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

  function zoom(factor: number) {
    const net = networkRef.current;
    if (!net) return;
    net.moveTo({ scale: net.getScale() * factor, animation: { duration: 220, easingFunction: "easeInOutQuad" } });
  }
  function fit() {
    networkRef.current?.fit({ animation: { duration: 350, easingFunction: "easeInOutQuad" } });
  }

  const selMeta = selected ? nodeMetaRef.current.get(selected.id) : null;
  const selType = selMeta ? typeInfo(selMeta.type) : null;

  const ctrlBtn: React.CSSProperties = {
    background: C.panel, color: C.bone, border: `1px solid ${C.line}`, borderRadius: 8,
    width: 34, height: 34, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center",
  };

  return (
    <div className="flex flex-col h-full" style={{ position: "relative", minWidth: 0 }}>
      {/* Cabeçalho amigável */}
      <div className="px-4 pt-3 pb-2" style={{ borderBottom: `1px solid ${C.line}` }}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="aur-display" style={{ fontSize: 15, fontWeight: 700, color: C.bone }}>
              A mente da Aurora
            </div>
            <div className="aur-mono" style={{ fontSize: 10.5, color: C.dim, marginTop: 1 }}>
              {err
                ? `não consegui montar o mapa: ${err}`
                : counts
                  ? `${counts.nodes} elementos · ${counts.edges} conexões · acendem quando ela consulta`
                  : "montando o mapa…"}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button style={ctrlBtn} title="Aproximar" onClick={() => zoom(1.3)}>+</button>
            <button style={ctrlBtn} title="Afastar" onClick={() => zoom(1 / 1.3)}>−</button>
            <button style={{ ...ctrlBtn, width: "auto", padding: "0 10px", fontSize: 11.5 }} title="Enquadrar tudo" onClick={fit}>ajustar</button>
            <button
              style={{ ...ctrlBtn, width: "auto", padding: "0 10px", fontSize: 11.5, color: showLegend ? C.phosphor : C.dim }}
              title="Mostrar/ocultar legenda"
              onClick={() => setShowLegend((v) => !v)}
            >
              legenda
            </button>
          </div>
        </div>

        {/* Caption de ativação — em linguagem clara */}
        {activated.length > 0 && (
          <div className="aur-mono" style={{ fontSize: 11, color: C.phosphor, marginTop: 6, opacity: 0.92, lineHeight: 1.4 }}>
            Aurora acabou de consultar:{" "}
            {activated.map((m, i) => (
              <span key={i}>
                <span style={{ color: typeInfo(m.type).color }}>{typeInfo(m.type).label}</span> "{m.label}"
                {i < activated.length - 1 ? " · " : ""}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Canvas do grafo */}
      <div ref={containerRef} className="flex-1" style={{ minHeight: 0 }} />

      {/* Legenda — o que cada cor/tipo significa, em português simples */}
      {showLegend && presentTypes.length > 0 && (
        <div style={{
          position: "absolute", left: 12, bottom: 12, maxWidth: 320, zIndex: 8,
          background: "rgba(18,32,35,0.92)", border: `1px solid ${C.line}`, borderRadius: 12, padding: "10px 12px",
        }}>
          <div className="aur-display" style={{ fontSize: 11.5, fontWeight: 600, color: C.bone, marginBottom: 6 }}>
            O que você está vendo
          </div>
          {presentTypes.map((t) => {
            const info = TYPE_INFO[t];
            return (
              <div key={t} className="flex items-start gap-2" style={{ marginBottom: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 5, background: info.color, marginTop: 3, flexShrink: 0, border: `1px solid ${C.line}` }} />
                <span style={{ fontSize: 11, color: C.dim, lineHeight: 1.35 }}>
                  <span style={{ color: C.bone, fontWeight: 600 }}>{info.label}</span> — {info.meaning}
                </span>
              </div>
            );
          })}
          <div className="aur-mono" style={{ fontSize: 9.5, color: C.dim, marginTop: 6, opacity: 0.8, lineHeight: 1.4 }}>
            as linhas são relações entre eles · quanto mais grossa, mais forte
          </div>
        </div>
      )}

      {/* Painel de detalhe — a nota em linguagem clara, tecnês escondido */}
      {selected && (
        <div style={{
          position: "absolute", right: 12, top: 92, bottom: 12, width: 340, maxWidth: "calc(100% - 24px)",
          background: C.panel, border: `1px solid ${C.line}`, borderLeft: `3px solid ${selType?.color ?? C.copper}`,
          borderRadius: 12, padding: "12px 14px", overflowY: "auto", zIndex: 10,
        }}>
          <div className="flex items-center justify-between gap-2 mb-2">
            {selType && (
              <span className="aur-mono" style={{
                fontSize: 10, color: "#0C1517", background: selType.color, borderRadius: 5, padding: "2px 7px", fontWeight: 600,
              }}>
                {selType.label}
              </span>
            )}
            <button onClick={() => setSelected(null)} className="aur-mono"
              style={{ color: C.dim, fontSize: 13, background: "transparent", border: "none", cursor: "pointer", marginLeft: "auto" }}>
              ✕
            </button>
          </div>

          <div className="aur-display" style={{ fontSize: 15, fontWeight: 600, color: C.bone, marginBottom: 2 }}>
            {selMeta?.label ?? selected.id}
          </div>
          {selType && (
            <div style={{ fontSize: 11.5, color: C.dim, marginBottom: 10, fontStyle: "italic" }}>
              {selType.meaning}
            </div>
          )}

          {!selected.detail && <p style={{ color: C.dim, fontSize: 12 }}>abrindo…</p>}
          {selected.detail && (
            <>
              <div style={{ fontSize: 13, color: C.bone, whiteSpace: "pre-wrap", lineHeight: 1.55 }}>
                {selected.detail.body}
              </div>
              <button
                onClick={() => setShowTech((v) => !v)}
                className="aur-mono"
                style={{ color: C.dim, fontSize: 10.5, background: "transparent", border: "none", cursor: "pointer", marginTop: 10, padding: 0, textDecoration: "underline" }}
              >
                {showTech ? "ocultar dados técnicos" : "ver dados técnicos"}
              </button>
              {showTech && (
                <pre className="aur-mono" style={{
                  fontSize: 10, color: C.dim, whiteSpace: "pre-wrap", background: C.panelUp,
                  border: `1px solid ${C.line}`, borderRadius: 8, padding: 8, marginTop: 6,
                }}>{JSON.stringify(selected.detail.frontmatter, null, 1)}</pre>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
