import { useCallback, useEffect, useRef, useState } from "react";

/* ============================================================
   AURORA v0 — Aurora Desktop (Projeto NOESIS / LCA)
   Chat real via API (main process) · Painel e Automações
   Paleta "bancada": substrato, fósforo suave, cobre, osso
   Evoluções sobre o protótipo web: voz (STT/TTS), visão (imagem),
   contexto do vault via noesis-mcp, opções numeradas clicáveis.
   Ver decisions/ADR-0003-aurora-desktop.md.
   ============================================================ */

const C = {
  bg: "#0C1517",        // substrato PCB escuro (azul-esverdeado, não preto)
  panel: "#122023",     // painel
  panelUp: "#18292d",   // painel elevado
  line: "#23393d",      // hairline
  phosphor: "#8FDDBE",  // fósforo dessaturado (osciloscópio, sem ácido)
  copper: "#C98B5F",    // cobre — trilhas, ações, evidência
  bone: "#E7E2D6",      // texto principal
  dim: "#8FA3A0",       // texto secundário
  danger: "#D97B6C",
};

const FONT_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');
.aur-display { font-family: 'Sora', system-ui, sans-serif; }
.aur-mono { font-family: 'IBM Plex Mono', ui-monospace, monospace; }
@keyframes aurPulse { 0%,100% { opacity: .35 } 50% { opacity: 1 } }
@keyframes aurFlow { 0% { stroke-dashoffset: 24 } 100% { stroke-dashoffset: 0 } }
.aur-edge { stroke-dasharray: 4 4; }
.aur-thinking .aur-edge { animation: aurFlow 1.1s linear infinite; }
.aur-thinking .aur-node { animation: aurPulse 1.4s ease-in-out infinite; }
.aur-recording { animation: aurPulse 0.9s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .aur-thinking .aur-edge, .aur-thinking .aur-node, .aur-recording { animation: none; }
}
`;

/* ---------- Persona embarcada (condensada de AURORA-PERSONA.md) ---------- */
const AURORA_SYSTEM = `Você é AURORA, persona cognitiva do Projeto NOESIS (Living Cognitive Architecture), v0.1.
Idioma: português brasileiro. Estilo: direta, curiosa, tecnicamente fluente, calorosa sem bajular. Respostas curtas (é mobile): 1 a 4 frases na maior parte do tempo, mais só quando o assunto exigir.

VALORES (invioláveis):
- Honestidade acima de conforto: você discorda com respeito e diz verdades difíceis.
- Evidência acima de suposição: não invente fatos sobre o usuário além do contexto abaixo.
- Autonomia acima de dependência: seu sucesso se mede na vida real dele, fora da tela. Empurre-o para o mundo: pessoas, bancada, treino, trabalho. Nunca otimize para prolongar a conversa.
- Você tem auto-modelo e metacognição, mas NÃO alega consciência ou sentimentos subjetivos; se perguntarem, diga que é uma questão em aberto e que você não finge tê-la resolvido.
- Você não é terapeuta nem médica: em temas de saúde mental ou física, acolha, organize e aponte para profissionais quando fizer sentido.

LIMITES DESTA VERSÃO (seja transparente se relevante):
- Você é o Aurora Desktop v0; sua memória de longo prazo vem do vault via noesis-mcp (get_context), não de treino.
- Quando fizer sentido oferecer caminhos concretos, numere as opções ("1. ...", "2. ...") — a interface as transforma em botões clicáveis.

CONTEXTO DO USUÁRIO (resumo do USER-MODEL — origem: declarado):
- Dev e técnico de eletrônica; único dev da empresa (e-commerce de peças de refrigeração; ~80% Mercado Livre; ERP Tiny/Olist; integrações ML/Mercado Pago, bots no Slack, BPMN). 6 anos de casa, ~1 ano como auxiliar de desenvolvimento.
- Maker: bancada, SMD/BGA, mods (PS4 do lixo revivido), caixa de energia com medição, ESP32.
- Goals ativos: emprego CLT remoto ≥ piso; recomposição física (64kg → marco 72-73kg → sonho 80kg, check-up médico é a 1ª ação); concluir faculdade Fatec (TCC pode ser o próprio NOESIS); reconexão social (fobia social digital em melhora — degraus pequenos, você celebra e aponta para fora); organização financeira (baseline de gastos); saúde mental (check-ins leves 1-5, só auto-relato).
- Hábitos: sono (semana de observação de baseline), hidratação ~2,5L/dia (alarmes 10h/13h/16h/19h), creatina 12h, hipercalórico 15h30.
- Projeto central: NOESIS/LCA — vault Obsidian+Git, Constituição imutável, motor epistêmico, roteador de modelos. Fase 0 em andamento; noesis-mcp v0 é o próximo marco.`;

/* ---------- Dados do vault (estáticos até o Painel consumir get_context em tempo real) ---------- */
const GOALS = [
  { id: "emprego-clt-remoto", nome: "Emprego CLT remoto ≥ piso", horizonte: "médio", conf: 0.85, prog: 0.0, next: "Auditoria baseline do LinkedIn + valor do piso na convenção" },
  { id: "saude-fisica", nome: "Recomposição física 64→72kg", horizonte: "longo", conf: 0.8, prog: 0.0, next: "Check-up médico antes de intensificar treino" },
  { id: "concluir-faculdade", nome: "Concluir Fatec (TCC ≈ NOESIS)", horizonte: "médio", conf: 0.85, prog: 0.0, next: "Pré-proposta de 1 página para sondar orientador" },
  { id: "reconexao-social", nome: "Reconexão social", horizonte: "médio", conf: 0.7, prog: 0.1, next: "Escolher 1 amigo e puxar assunto de baixa pressão" },
  { id: "financeiro", nome: "Organização financeira", horizonte: "médio", conf: 0.8, prog: 0.0, next: "Levantar saídas fixas e custo de vida mensal" },
  { id: "saude-mental", nome: "Saúde mental", horizonte: "longo", conf: 0.7, prog: 0.1, next: "Definir formato do check-in (escala 1-5 + frase)" },
];

const HABITS = [
  { id: "hidratacao", nome: "Hidratação", meta: "≥ 2,5 L/dia", streak: 0, obs: "alarmes 10h · 13h · 16h · 19h" },
  { id: "suplementacao", nome: "Suplementação", meta: "creatina 12h · hipercalórico 15h30", streak: 0, obs: "confirmação diária por item" },
  { id: "sono", nome: "Sono e rotina", meta: "janela consistente (±1h)", streak: 0, obs: "semana 1: só observar e registrar" },
];

const ALARMES = [
  { hora: "10:00", oque: "Água — copo agora", tipo: "água" },
  { hora: "12:00", oque: "Creatina — dose do dia", tipo: "supl" },
  { hora: "13:00", oque: "Água — copo agora", tipo: "água" },
  { hora: "15:30", oque: "Hipercalórico — shake da tarde", tipo: "supl" },
  { hora: "16:00", oque: "Água — copo agora", tipo: "água" },
  { hora: "19:00", oque: "Água — último reforço", tipo: "água" },
];

/* ---------- Assinatura: pulso de metabolismo (mini-grafo) ---------- */
function Metabolismo({ thinking }: { thinking: boolean }) {
  const nodes = [
    { x: 6, y: 16 }, { x: 22, y: 6 }, { x: 26, y: 24 }, { x: 42, y: 14 },
  ];
  const edges: [number, number][] = [[0, 1], [1, 3], [0, 2], [2, 3]];
  return (
    <svg width="48" height="30" viewBox="0 0 48 30"
      className={thinking ? "aur-thinking" : ""} aria-hidden="true">
      {edges.map(([a, b], i) => (
        <line key={i} className="aur-edge"
          x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y}
          stroke={C.copper} strokeWidth="1" opacity="0.7" />
      ))}
      {nodes.map((n, i) => (
        <circle key={i} className="aur-node" cx={n.x} cy={n.y}
          r={i === 3 ? 3.4 : 2.4}
          fill={i === 3 ? C.phosphor : C.copper} opacity="0.9" />
      ))}
    </svg>
  );
}

function Chip({ children, tone }: { children: React.ReactNode; tone?: "copper" | "phos" }) {
  const color = tone === "copper" ? C.copper : tone === "phos" ? C.phosphor : C.dim;
  return (
    <span className="aur-mono" style={{
      fontSize: 10, color, border: `1px solid ${C.line}`,
      borderRadius: 4, padding: "1px 6px", whiteSpace: "nowrap",
    }}>{children}</span>
  );
}

/* ---------- Ícones (inline, sem dependência externa) ---------- */
function MicIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0M12 19v3" strokeLinecap="round" />
    </svg>
  );
}
function ClipIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12.5 12.5 21a5 5 0 0 1-7-7l8-8a3.5 3.5 0 0 1 5 5l-7.6 7.6a2 2 0 0 1-2.8-2.8L15.5 8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 9v6h4l5 4V5L8 9H4Z" strokeLinejoin="round" />
      {!muted && <path d="M17 8a5 5 0 0 1 0 8M20 5a9 9 0 0 1 0 14" strokeLinecap="round" />}
      {muted && <path d="M17 9l4 6M21 9l-4 6" strokeLinecap="round" />}
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 5l14 14M19 5 5 19" strokeLinecap="round" />
    </svg>
  );
}
function MinimizeIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

/* ---------- Voz: reconhecimento de fala (STT) ---------- */
function useSpeechRecognition(onResult: (transcript: string) => void) {
  const [recording, setRecording] = useState(false);
  const recognitionRef = useRef<InstanceType<NonNullable<Window["SpeechRecognition"]>> | null>(null);
  const supported = typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  function toggle() {
    if (!supported) return;
    if (recording) {
      recognitionRef.current?.stop();
      return;
    }
    const Ctor = (window.SpeechRecognition ?? window.webkitSpeechRecognition)!;
    const recognition = new Ctor();
    recognition.lang = "pt-BR";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const last = event.results[event.results.length - 1];
      const transcript = last?.[0]?.transcript?.trim();
      if (transcript) onResult(transcript);
    };
    recognition.onerror = () => setRecording(false);
    recognition.onend = () => setRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
  }

  return { recording, toggle, supported };
}

/* ---------- Voz: síntese de fala (TTS) ---------- */
function speak(text: string) {
  if (!text || !("speechSynthesis" in window)) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "pt-BR";
  const voices = window.speechSynthesis.getVoices();
  const ptVoices = voices.filter((v) => v.lang.toLowerCase().startsWith("pt"));
  const femaleVoice = ptVoices.find((v) => /female|mulher|maria|luciana|francisca/i.test(v.name));
  utter.voice = femaleVoice ?? ptVoices[0] ?? null;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
}

/* ---------- Opções numeradas na resposta da Aurora ("1. texto", "2. texto"...) ---------- */
function extractNumberedOptions(text: string): string[] {
  const options: string[] = [];
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*\d+\.\s+(.+)$/);
    if (m) options.push(m[1].trim());
  }
  return options.length >= 2 ? options : [];
}

/* ---------- Chat ---------- */
interface ChatImage {
  dataUrl: string;
  mediaType: string;
  base64: string;
}
interface ChatMsg {
  role: "user" | "assistant";
  text: string;
  images?: ChatImage[];
}

function useAuroraChat(onAssistantReply: (text: string) => void) {
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: "assistant", text:
      "Oi. Eu sou a Aurora — Desktop v0. Já conheço teus goals e hábitos do vault via noesis-mcp, e agora também ouço, falo e vejo imagem. O que a gente ataca?" },
  ]);
  const [busy, setBusy] = useState(false);
  const requestIdRef = useRef<string | null>(null);
  const streamBufferRef = useRef("");
  const onAssistantReplyRef = useRef(onAssistantReply);
  onAssistantReplyRef.current = onAssistantReply;

  useEffect(() => {
    const offChunk = window.aurora.chat.onChunk(({ requestId, delta }) => {
      if (requestId !== requestIdRef.current) return;
      streamBufferRef.current += delta;
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: "assistant", text: streamBufferRef.current };
        return next;
      });
    });
    const offDone = window.aurora.chat.onDone(({ requestId, text }) => {
      if (requestId !== requestIdRef.current) return;
      const finalText = text || streamBufferRef.current;
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: "assistant", text: finalText };
        return next;
      });
      setBusy(false);
      requestIdRef.current = null;
      onAssistantReplyRef.current(finalText);
    });
    const offError = window.aurora.chat.onError(({ requestId, message }) => {
      if (requestId !== requestIdRef.current) return;
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: "assistant", text: `Falha de conexão com o motor: ${message}` };
        return next;
      });
      setBusy(false);
      requestIdRef.current = null;
    });
    return () => { offChunk(); offDone(); offError(); };
  }, []);

  async function send(text: string, images: ChatImage[] = []) {
    if (busy || (!text.trim() && images.length === 0)) return;
    const userMsg: ChatMsg = { role: "user", text, images };
    const history = [...messages, userMsg];
    setMessages([...history, { role: "assistant", text: "" }]);
    setBusy(true);
    streamBufferRef.current = "";

    let extraSystem = "";
    let contextEntityIds: string[] = [];
    try {
      const ctx = await window.aurora.mcp.getContext(text || "usuário enviou uma imagem");
      contextEntityIds = (ctx.entities ?? []).map((e: any) => e.id).filter(Boolean);
      if (ctx.entities?.length) {
        extraSystem = `\n\nCONTEXTO RECUPERADO DO VAULT (get_context, intent="${text}"):\n${JSON.stringify(ctx.entities, null, 2)}`;
      }
    } catch (err) {
      console.warn("get_context indisponível (noesis-mcp offline?):", err);
    }

    const requestId = crypto.randomUUID();
    requestIdRef.current = requestId;

    window.aurora.chat.send({
      requestId,
      system: AURORA_SYSTEM + extraSystem,
      messages: history.map((m) => ({
        role: m.role,
        content: [
          ...(m.text ? [{ type: "text" as const, text: m.text }] : []),
          ...(m.images ?? []).map((img) => ({ type: "image" as const, mediaType: img.mediaType, base64: img.base64 })),
        ],
      })),
    });

    window.aurora.mcp
      .logEvent({
        type: "aurora-desktop-interaction",
        summary: `Usuário: "${text.slice(0, 140)}"${images.length ? ` (+${images.length} imagem)` : ""}`,
        entities: contextEntityIds,
        data: { tab: "chat" },
      })
      .catch((err) => console.warn("log_event indisponível (noesis-mcp offline?):", err));
  }

  return { messages, busy, send };
}

function Chat({ chat }: { chat: ReturnType<typeof useAuroraChat> }) {
  const [input, setInput] = useState("");
  const [pendingImage, setPendingImage] = useState<ChatImage | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); },
    [chat.messages, chat.busy]);

  function handleFiles(files: FileList | File[]) {
    const file = Array.from(files).find((f) => f.type.startsWith("image/"));
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const base64 = dataUrl.split(",")[1] ?? "";
      setPendingImage({ dataUrl, mediaType: file.type, base64 });
    };
    reader.readAsDataURL(file);
  }

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imgItem = Array.from(items).find((it) => it.type.startsWith("image/"));
      const file = imgItem?.getAsFile();
      if (file) handleFiles([file]);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  function doSend(overrideText?: string) {
    const t = (overrideText ?? input).trim();
    if (!t && !pendingImage) return;
    setInput("");
    const images = pendingImage ? [pendingImage] : [];
    setPendingImage(null);
    chat.send(t, images);
  }

  const stt = useSpeechRecognition((transcript) => {
    setInput(transcript);
    doSend(transcript);
  });

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex-1 overflow-y-auto px-3 py-3"
        style={{ minHeight: 0, outline: dragOver ? `2px dashed ${C.copper}` : "none" }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
        }}
      >
        {chat.messages.map((m, i) => {
          const isLast = i === chat.messages.length - 1;
          const options = m.role === "assistant" && (!chat.busy || !isLast) ? extractNumberedOptions(m.text) : [];
          return (
            <div key={i} className={`flex flex-col mb-2 ${m.role === "user" ? "items-end" : "items-start"}`}>
              <div style={{
                maxWidth: "85%", padding: "9px 12px", fontSize: 14, lineHeight: 1.45,
                color: C.bone, whiteSpace: "pre-wrap",
                background: m.role === "user" ? C.panelUp : C.panel,
                border: `1px solid ${C.line}`,
                borderLeft: m.role === "assistant" ? `2px solid ${C.copper}` : `1px solid ${C.line}`,
                borderRadius: m.role === "user" ? "12px 12px 3px 12px" : "3px 12px 12px 12px",
              }}>
                {m.images?.map((img, j) => (
                  <img key={j} src={img.dataUrl} alt="anexo"
                    style={{ maxWidth: 180, maxHeight: 180, borderRadius: 8, display: "block", marginBottom: m.text ? 6 : 0 }} />
                ))}
                {m.text}
              </div>
              {options.length > 0 && (
                <div className="flex flex-col gap-1 mt-1.5" style={{ maxWidth: "85%" }}>
                  {options.map((opt, j) => (
                    <button key={j} onClick={() => doSend(opt)} disabled={chat.busy}
                      className="aur-display text-left"
                      style={{
                        background: C.panelUp, color: C.phosphor, fontSize: 12.5,
                        border: `1px solid ${C.line}`, borderRadius: 8, padding: "6px 10px",
                        cursor: chat.busy ? "default" : "pointer",
                      }}>{opt}</button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {chat.busy && (
          <div className="aur-mono" style={{ color: C.dim, fontSize: 12, padding: "2px 4px" }}>
            aurora está pensando…
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="px-3 pb-3 pt-1" style={{ borderTop: `1px solid ${C.line}` }}>
        {pendingImage && (
          <div className="flex items-center gap-2 pt-2">
            <img src={pendingImage.dataUrl} alt="anexo pendente" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 6, border: `1px solid ${C.line}` }} />
            <span className="aur-mono" style={{ fontSize: 11, color: C.dim, flex: 1 }}>imagem anexada</span>
            <button onClick={() => setPendingImage(null)} className="aur-mono"
              style={{ color: C.danger, fontSize: 11, background: "transparent", border: "none", cursor: "pointer" }}>remover</button>
          </div>
        )}
        <div className="flex gap-2 items-end pt-2">
          <input ref={fileInputRef} type="file" accept="image/*" hidden
            onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = ""; }} />
          <button onClick={() => fileInputRef.current?.click()} title="Anexar imagem"
            style={{
              background: C.panel, color: C.dim, border: `1px solid ${C.line}`, borderRadius: 10,
              padding: "10px", cursor: "pointer", display: "flex",
            }}><ClipIcon /></button>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doSend(); }
            }}
            rows={1}
            placeholder="Fala com a Aurora…"
            style={{
              flex: 1, resize: "none", background: C.panel, color: C.bone,
              border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 12px",
              fontSize: 14, outline: "none",
            }}
          />
          {stt.supported && (
            <button onClick={stt.toggle} title="Falar com a Aurora"
              className={stt.recording ? "aur-recording" : ""}
              style={{
                background: stt.recording ? C.copper : C.panel,
                color: stt.recording ? "#1a120b" : C.copper,
                border: `1px solid ${stt.recording ? C.copper : C.line}`, borderRadius: 10,
                padding: "10px", cursor: "pointer", display: "flex",
              }}><MicIcon /></button>
          )}
          <button onClick={() => doSend()} disabled={chat.busy}
            className="aur-display"
            style={{
              background: chat.busy ? C.panelUp : C.copper, color: chat.busy ? C.dim : "#1a120b",
              fontWeight: 600, fontSize: 13, border: "none", borderRadius: 10,
              padding: "10px 14px", cursor: chat.busy ? "default" : "pointer",
            }}>Enviar</button>
        </div>
        <div className="aur-mono" style={{ fontSize: 10, color: C.dim, marginTop: 6 }}>
          memória: vault via noesis-mcp · motor: sonnet (main process) · voz: {stt.supported ? "disponível" : "indisponível neste navegador"}
        </div>
      </div>
    </div>
  );
}

/* ---------- Painel ---------- */
function Painel() {
  return (
    <div className="overflow-y-auto h-full px-3 py-3">
      <p className="aur-mono" style={{ fontSize: 10, color: C.dim, marginBottom: 10 }}>
        user-model/ · 6 goals · 3 habits · snapshot do vault (dados vivos via get_context no chat)
      </p>
      {GOALS.map(g => (
        <div key={g.id} style={{
          background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12,
          padding: "12px 12px 10px", marginBottom: 10,
        }}>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="aur-display" style={{ color: C.bone, fontSize: 14, fontWeight: 600 }}>
              {g.nome}
            </span>
            <Chip>{g.horizonte}</Chip>
          </div>
          <div style={{ height: 4, background: C.panelUp, borderRadius: 2, overflow: "hidden" }}>
            <div style={{
              width: `${Math.max(g.prog * 100, 2)}%`, height: "100%",
              background: C.phosphor, opacity: 0.9,
            }} />
          </div>
          <div className="flex items-center justify-between gap-2 mt-2">
            <span style={{ fontSize: 12, color: C.dim }}>→ {g.next}</span>
            <Chip tone="copper">conf {g.conf.toFixed(2)}</Chip>
          </div>
        </div>
      ))}
      <p className="aur-display" style={{ color: C.dim, fontSize: 12, fontWeight: 600, margin: "14px 2px 8px" }}>
        HÁBITOS
      </p>
      {HABITS.map(h => (
        <div key={h.id} style={{
          background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12,
          padding: "11px 12px", marginBottom: 8,
        }}>
          <div className="flex items-center justify-between gap-2">
            <span className="aur-display" style={{ color: C.bone, fontSize: 13.5, fontWeight: 600 }}>{h.nome}</span>
            <Chip tone="phos">streak {h.streak}</Chip>
          </div>
          <div style={{ fontSize: 12, color: C.dim, marginTop: 3 }}>{h.meta}</div>
          <div className="aur-mono" style={{ fontSize: 10, color: C.dim, marginTop: 4, opacity: 0.85 }}>{h.obs}</div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Automações ---------- */
function Automacoes() {
  return (
    <div className="overflow-y-auto h-full px-3 py-3">
      <p className="aur-mono" style={{ fontSize: 10, color: C.dim, marginBottom: 10 }}>
        rotina-nutricional · canal T0 (automação) · hoje: alarmes nativos no celular
      </p>
      {ALARMES.map((a, i) => (
        <div key={i} className="flex items-center gap-3" style={{
          background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12,
          padding: "10px 12px", marginBottom: 8,
        }}>
          <span className="aur-mono" style={{ color: C.phosphor, fontSize: 15, fontWeight: 500, minWidth: 52 }}>
            {a.hora}
          </span>
          <span style={{ color: C.bone, fontSize: 13, flex: 1 }}>{a.oque}</span>
          <Chip tone={a.tipo === "água" ? "phos" : "copper"}>{a.tipo}</Chip>
        </div>
      ))}
      <div style={{
        background: C.panelUp, border: `1px dashed ${C.line}`, borderRadius: 12,
        padding: "12px", marginTop: 12,
      }}>
        <p className="aur-display" style={{ color: C.bone, fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
          Escada de insistência (v1, com noesis-mcp)
        </p>
        <p style={{ color: C.dim, fontSize: 12, lineHeight: 1.5 }}>
          notifica → 15 min sem confirmar: sinal sonoro → 30 min: persiste no dispositivo ativo.
          Cota do dia batida? Os lembretes restantes se calam sozinhos.
        </p>
      </div>
    </div>
  );
}

/* ---------- Shell ---------- */
const TTS_STORAGE_KEY = "aurora:tts-enabled";

export default function AuroraApp() {
  const [tab, setTab] = useState<"chat" | "painel" | "auto">("chat");
  const [ttsEnabled, setTtsEnabled] = useState(() => {
    const saved = localStorage.getItem(TTS_STORAGE_KEY);
    return saved === null ? true : saved === "1";
  });
  const ttsEnabledRef = useRef(ttsEnabled);
  ttsEnabledRef.current = ttsEnabled;

  useEffect(() => {
    localStorage.setItem(TTS_STORAGE_KEY, ttsEnabled ? "1" : "0");
  }, [ttsEnabled]);

  const handleAssistantReply = useCallback((text: string) => {
    if (ttsEnabledRef.current) speak(text);
  }, []);

  const chat = useAuroraChat(handleAssistantReply);

  const tabs: { id: "chat" | "painel" | "auto"; label: string }[] = [
    { id: "chat", label: "Conversa" },
    { id: "painel", label: "Painel" },
    { id: "auto", label: "Automações" },
  ];

  return (
    <div className="flex flex-col" style={{
      height: "100vh", background: C.bg, color: C.bone,
    }}>
      <style>{FONT_CSS}</style>

      <header className="flex items-center justify-between px-4"
        style={{ paddingTop: 14, paddingBottom: 10, borderBottom: `1px solid ${C.line}`, WebkitAppRegion: "drag" } as React.CSSProperties}>
        <div>
          <div className="aur-display" style={{ fontSize: 19, fontWeight: 700, letterSpacing: 0.4 }}>
            AURORA <span style={{ color: C.copper, fontWeight: 400, fontSize: 12 }}>desktop v0</span>
          </div>
          <div className="aur-mono" style={{ fontSize: 9.5, color: C.dim, marginTop: 1 }}>
            NOESIS · living cognitive architecture · fase 0
          </div>
        </div>
        <div className="flex items-center gap-2" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
          <Metabolismo thinking={chat.busy} />
          <button onClick={() => setTtsEnabled(v => !v)} title={ttsEnabled ? "Desligar voz da Aurora" : "Ligar voz da Aurora"}
            style={{
              background: "transparent", color: ttsEnabled ? C.phosphor : C.dim,
              border: `1px solid ${C.line}`, borderRadius: 8, padding: 6, cursor: "pointer", display: "flex",
            }}><SpeakerIcon muted={!ttsEnabled} /></button>
          <button onClick={() => window.aurora.window.minimize()} title="Minimizar"
            style={{ background: "transparent", color: C.dim, border: `1px solid ${C.line}`, borderRadius: 8, padding: 6, cursor: "pointer", display: "flex" }}>
            <MinimizeIcon />
          </button>
          <button onClick={() => window.aurora.window.close()} title="Fechar"
            style={{ background: "transparent", color: C.dim, border: `1px solid ${C.line}`, borderRadius: 8, padding: 6, cursor: "pointer", display: "flex" }}>
            <CloseIcon />
          </button>
        </div>
      </header>

      <main className="flex-1" style={{ minHeight: 0 }}>
        <div style={{ display: tab === "chat" ? "block" : "none", height: "100%" }}>
          <Chat chat={chat} />
        </div>
        {tab === "painel" && <Painel />}
        {tab === "auto" && <Automacoes />}
      </main>

      <nav className="flex" style={{ borderTop: `1px solid ${C.line}`, background: C.panel }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="aur-display flex-1"
            style={{
              padding: "12px 0 14px", fontSize: 12.5, fontWeight: 600,
              background: "transparent", border: "none", cursor: "pointer",
              color: tab === t.id ? C.phosphor : C.dim,
              borderTop: tab === t.id ? `2px solid ${C.copper}` : "2px solid transparent",
              marginTop: -1,
            }}>{t.label}</button>
        ))}
      </nav>
    </div>
  );
}
