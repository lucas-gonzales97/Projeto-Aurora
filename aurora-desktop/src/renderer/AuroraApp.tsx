import { useCallback, useEffect, useRef, useState } from "react";
import Settings from "./Settings";
import GraphView from "./GraphView";
import { buildChatSystemPrompt, buildOnboardingSystemPrompt } from "./prompt";

/* ============================================================
   AURORA v0 — Aurora Desktop (Projeto NOESIS / LCA)
   Chat real via API (main process) · Painel e Automações
   Paleta "bancada": substrato, fósforo suave, cobre, osso
   Evoluções sobre o protótipo web: voz (STT/TTS), visão (imagem),
   contexto do vault via noesis-mcp, opções numeradas clicáveis.
   Ver decisions/ADR-0003-aurora-desktop.md.
   ============================================================ */

// Exportado para Settings.tsx (tela de Configurações, ADR-0006 §6) reusar os
// mesmos tokens em vez de duplicar a paleta — design/tokens.md é a fonte
// única de verdade, um componente novo não deve redefinir cor por conta própria.
export const C = {
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
// AURORA_SYSTEM, ONBOARDING_SYSTEM e a montagem final do system prompt moram
// em ./prompt.ts (módulo sem React, testável no vitest). Invariante ADR-0009:
// NENHUM dado do usuário no prompt estático — tudo vem do vault em runtime via
// get_context; vault vazio = Aurora admite que ainda não sabe.

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
function MaximizeIcon({ maximized }: { maximized: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      {maximized ? (
        <>
          <rect x="8" y="8" width="12" height="12" rx="1.5" />
          <path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" strokeLinecap="round" />
        </>
      ) : (
        <rect x="4" y="4" width="16" height="16" rx="1.5" />
      )}
    </svg>
  );
}
function HistoryIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 7v5l3 3" strokeLinecap="round" strokeLinejoin="round" />
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
// speechSynthesis.getVoices() carrega de forma ASSÍNCRONA no Chromium/Electron
// — chamar direto (como a versão antiga fazia) quase sempre pega a lista
// ainda vazia na primeira fala da sessão, cai em voice=null, e o navegador
// escolhe seu próprio default pra pt-BR (que nesta máquina é "Microsoft
// Daniel", masculino — daí a voz sair errada mesmo com regex de voz
// feminina no código). Aqui cacheia a lista uma vez, esperando o evento
// voiceschanged quando necessário, com um timeout de segurança pra browsers
// que nunca disparam o evento.
let cachedVoices: SpeechSynthesisVoice[] = [];
let voicesPromise: Promise<SpeechSynthesisVoice[]> | null = null;

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!("speechSynthesis" in window)) return Promise.resolve([]);
  const existing = window.speechSynthesis.getVoices();
  if (existing.length > 0) {
    cachedVoices = existing;
    return Promise.resolve(existing);
  }
  if (voicesPromise) return voicesPromise;
  voicesPromise = new Promise((resolve) => {
    const finish = () => {
      window.speechSynthesis.removeEventListener("voiceschanged", finish);
      cachedVoices = window.speechSynthesis.getVoices();
      resolve(cachedVoices);
    };
    window.speechSynthesis.addEventListener("voiceschanged", finish);
    setTimeout(finish, 1000); // rede de segurança — nem todo browser dispara o evento
  });
  return voicesPromise;
}
// Aquece o cache assim que o módulo carrega, pra primeira fala da sessão
// já ter a lista pronta em vez de esperar o timeout de 1s.
if (typeof window !== "undefined" && "speechSynthesis" in window) loadVoices();

// Prioriza voz pt-BR NATURAL (as vozes neurais "Online (Natural)" do
// Windows 11, quando instaladas — ver aurora-desktop/README.md "Voz da
// Aurora") e feminina, nessa ordem: natural+feminina > só feminina >
// só natural (gênero incerto pelo nome) > primeira pt-BR disponível.
function pickPortugueseVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const ptVoices = voices.filter((v) => v.lang.toLowerCase().startsWith("pt"));
  const isFemale = (v: SpeechSynthesisVoice) => /female|mulher|maria|luciana|francisca|thalita/i.test(v.name);
  const isNatural = (v: SpeechSynthesisVoice) => /natural|online/i.test(v.name);
  return (
    ptVoices.find((v) => isNatural(v) && isFemale(v)) ??
    ptVoices.find((v) => isFemale(v)) ??
    ptVoices.find((v) => isNatural(v)) ??
    ptVoices[0] ??
    null
  );
}

function speakLocal(text: string) {
  if (!text || !("speechSynthesis" in window)) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "pt-BR";
  utter.voice = pickPortugueseVoice(cachedVoices);
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
}

// Voz natural em nuvem (Azure AI Speech — ADR-0007-tts-azure-speech.md):
// a mesma voz "Francisca" que o Narrator do Windows usa, só que acessível
// por API em vez de exclusiva do Narrator (Narrator não expõe suas vozes
// naturais a nenhum outro app, nem via SAPI5/speechSynthesis — confirmado,
// não é limitação deste código). Se não estiver configurada, ou se a
// chamada falhar (rede, quota, chave inválida), cai pra speechSynthesis
// local — a Aurora nunca fica muda por causa de um problema de rede.
async function speak(text: string) {
  if (!text) return;
  try {
    const hasAzure = await window.aurora.tts.hasConfig();
    if (hasAzure) {
      const { audioBase64, mimeType } = await window.aurora.tts.speak(text);
      const audio = new Audio(`data:${mimeType};base64,${audioBase64}`);
      await audio.play();
      return;
    }
  } catch (err) {
    console.warn("Azure Speech falhou, caindo pra voz local do Windows:", err);
  }
  await loadVoices();
  speakLocal(text);
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

// Traduz erros crus do provedor em mensagens que ajudam o usuário a resolver,
// em vez de despejar o JSON da API. Caso real observado: modelo só-texto
// recebendo imagem anexada devolve 404 "No endpoints found that support image
// input" — o usuário não tem como adivinhar que o problema é o modelo, não a
// rede. Casos não mapeados caem no texto genérico (com o detalhe técnico junto).
function friendlyChatError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("image input") || (m.includes("image") && m.includes("support"))) {
    return "O modelo escolhido não aceita imagens. Para enviar imagem, escolha um modelo com visão na aba Config — ou reenvie a mensagem sem o anexo.";
  }
  if (m.includes("429") || m.includes("rate limit") || m.includes("quota")) {
    return "O provedor atingiu o limite de uso (rate limit). Espere um pouco e tente de novo, ou troque de provedor/modelo na aba Config.";
  }
  if (m.includes("401") || m.includes("invalid") && m.includes("key")) {
    return "A chave do provedor parece inválida ou expirada. Confira em Config (testar a chave).";
  }
  return `Falha de conexão com o motor: ${message}`;
}

// Saudação de UI (não persistida em chat.db — não é fala do modelo). Sem
// alegação de conhecer o usuário: com vault vazio isso seria confabulação de
// interface (ADR-0009).
const GREETING: ChatMsg = {
  role: "assistant",
  text: "Oi. Eu sou a Aurora — Desktop v0. Minha memória vem do teu vault via noesis-mcp, e eu ouço, falo e vejo imagem. O que a gente ataca?",
};

function useAuroraChat(onAssistantReply: (text: string) => void) {
  const [messages, setMessages] = useState<ChatMsg[]>([GREETING]);
  const [busy, setBusy] = useState(false);
  const requestIdRef = useRef<string | null>(null);
  const streamBufferRef = useRef("");
  const onAssistantReplyRef = useRef(onAssistantReply);
  onAssistantReplyRef.current = onAssistantReply;

  // Persistência (ADR-0011): sessão criada de forma preguiçosa no primeiro
  // envio (evita gravar sessão pra quem só abriu e fechou o app; sessões sem
  // mensagem nem apareceriam na listagem, mas melhor nem criar a linha).
  const sessionIdRef = useRef<string | null>(null);
  async function ensureSession(): Promise<string | null> {
    if (sessionIdRef.current) return sessionIdRef.current;
    try {
      const id = crypto.randomUUID();
      await window.aurora.chat.newSession(id);
      sessionIdRef.current = id;
      return id;
    } catch (err) {
      console.warn("chat.db indisponível — conversa segue sem persistir:", err);
      return null;
    }
  }

  /** Carrega uma sessão antiga do chat.db e CONTINUA nela. */
  async function loadSession(sessionId: string) {
    if (busy) return;
    const rows = await window.aurora.chat.loadSession(sessionId);
    sessionIdRef.current = sessionId;
    setMessages(rows.map((r) => ({ role: r.role, text: r.content })));
  }

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
        next[next.length - 1] = { role: "assistant", text: friendlyChatError(message) };
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

    const intent = text || "usuário enviou uma imagem";
    let contextEntities: any[] = [];
    let contextEntityIds: string[] = [];
    try {
      const ctx = await window.aurora.mcp.getContext(intent);
      contextEntities = ctx.entities ?? [];
      contextEntityIds = contextEntities.map((e: any) => e.id).filter(Boolean);
    } catch (err) {
      console.warn("get_context indisponível (noesis-mcp offline?):", err);
    }

    const requestId = crypto.randomUUID();
    requestIdRef.current = requestId;

    // Persiste a mensagem do usuário; a resposta do assistente é gravada no
    // MAIN process (chat:done), com model/provider autoritativos (ADR-0011).
    const sessionId = await ensureSession();
    if (sessionId) {
      window.aurora.chat
        .append({ sessionId, role: "user", content: text || "(imagem)" })
        .catch((err) => console.warn("chat.db: falha ao persistir mensagem do usuário:", err));
    }

    window.aurora.chat.send({
      requestId,
      sessionId: sessionId ?? undefined,
      system: buildChatSystemPrompt(intent, contextEntities),
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

  return { messages, busy, send, loadSession };
}

function Chat({ chat, tab }: { chat: ReturnType<typeof useAuroraChat>; tab: string }) {
  const [input, setInput] = useState("");
  const [pendingImage, setPendingImage] = useState<ChatImage | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // Reflete o que está de fato ativo (motor/voz), não um valor fixo no
  // código — refaz a leitura toda vez que volta pra aba Conversa, que é
  // exatamente quando algo pode ter mudado na aba Config.
  const [engineStatus, setEngineStatus] = useState("carregando…");
  const [voiceStatus, setVoiceStatus] = useState("carregando…");

  useEffect(() => {
    // Atualiza o status na aba Conversa E na aba Mente (o cockpit tem o chat
    // ao lado do grafo) — nos dois é onde o motor/voz pode ter mudado.
    if (tab !== "chat" && tab !== "grafo") return;
    let cancelled = false;
    Promise.all([
      window.aurora.providers.getActive(),
      window.aurora.providers.list(),
      window.aurora.tts.hasConfig(),
    ])
      .then(([active, list, hasAzure]) => {
        if (cancelled) return;
        const provider = list.find((p) => p.id === active.providerId);
        const label = provider?.label ?? active.providerId;
        setEngineStatus(active.model ? `${label} · ${active.model}` : `${label} · sem modelo escolhido`);
        setVoiceStatus(hasAzure ? "Azure (Francisca, natural)" : "local do Windows");
      })
      .catch(() => {
        if (!cancelled) {
          setEngineStatus("indisponível");
          setVoiceStatus("indisponível");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tab]);

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

  // Histórico de sessões (ADR-0011) — lista do chat.db, carregar = retomar.
  type SessionSummary = Awaited<ReturnType<typeof window.aurora.chat.listSessions>>[number];
  const [showHistory, setShowHistory] = useState(false);
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  function toggleHistory() {
    const next = !showHistory;
    setShowHistory(next);
    if (next) {
      window.aurora.chat
        .listSessions()
        .then(setSessions)
        .catch((err) => { console.warn("chat.db: falha ao listar sessões:", err); setSessions([]); });
    }
  }
  function fmtSessionDate(iso: string): string {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(d);
  }

  return (
    <div className="flex flex-col h-full" style={{ position: "relative" }}>
      {showHistory && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 20, background: C.bg,
          display: "flex", flexDirection: "column",
        }}>
          <div className="flex items-center justify-between px-3" style={{ padding: "10px 12px", borderBottom: `1px solid ${C.line}` }}>
            <span className="aur-display" style={{ fontSize: 13, fontWeight: 600, color: C.bone }}>Conversas anteriores</span>
            <button onClick={() => setShowHistory(false)} className="aur-mono"
              style={{ color: C.dim, fontSize: 11, background: "transparent", border: `1px solid ${C.line}`, borderRadius: 8, padding: "4px 8px", cursor: "pointer" }}>
              fechar
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3" style={{ minHeight: 0 }}>
            {sessions === null && <p style={{ color: C.dim, fontSize: 12 }}>Lendo chat.db…</p>}
            {sessions?.length === 0 && (
              <p style={{ color: C.dim, fontSize: 12, lineHeight: 1.5 }}>
                Nenhuma conversa gravada ainda. A partir de agora, tudo o que vocês
                conversarem fica guardado aqui, nesta máquina.
              </p>
            )}
            {sessions?.map((s) => (
              <button key={s.id}
                onClick={() => { chat.loadSession(s.id).catch((err) => console.warn("chat.db: falha ao carregar sessão:", err)); setShowHistory(false); }}
                className="text-left w-full"
                style={{
                  background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12,
                  padding: "10px 12px", marginBottom: 8, cursor: "pointer", display: "block",
                }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="aur-mono" style={{ fontSize: 10.5, color: C.phosphor }}>{fmtSessionDate(s.started_at)}</span>
                  <span className="aur-mono" style={{ fontSize: 10, color: C.dim }}>{s.message_count} msg</span>
                </div>
                <div style={{ fontSize: 12.5, color: C.bone, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.preview ?? "(sem mensagem de usuário)"}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
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
          <button onClick={toggleHistory} title="Conversas anteriores"
            style={{
              background: showHistory ? C.panelUp : C.panel, color: showHistory ? C.phosphor : C.dim,
              border: `1px solid ${C.line}`, borderRadius: 10,
              padding: "10px", cursor: "pointer", display: "flex",
            }}><HistoryIcon /></button>
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
          memória: vault via noesis-mcp · motor: {engineStatus} · voz: {voiceStatus}
          {!stt.supported && " · ditado indisponível neste navegador"}
        </div>
      </div>
    </div>
  );
}

/* ---------- Painel ---------- */
// Espelho VIVO do vault — zero dado hardcoded. Lista goals/hábitos reais via
// list_notes (noesis-mcp). Vault novo = vazio, e o Painel diz isso com
// honestidade em vez de mostrar metas de mentira (ver ADR-0009).
interface VaultNote {
  id: string | null;
  path: string;
  type: string | null;
  status: string | null;
  title: string | null;
  frontmatter: Record<string, any>;
}

function num(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function EmptyVault({ label }: { label: string }) {
  return (
    <div style={{
      background: C.panelUp, border: `1px dashed ${C.line}`, borderRadius: 12,
      padding: "14px 12px", color: C.dim, fontSize: 12, lineHeight: 1.5,
    }}>
      {label} Nada aqui ainda — a Aurora popula isto conforme vocês conversam
      (primeiro no onboarding, depois no dia a dia). Fale com ela na aba Conversa.
    </div>
  );
}

function Painel() {
  const [goals, setGoals] = useState<VaultNote[] | null>(null);
  const [habits, setHabits] = useState<VaultNote[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [g, h] = await Promise.all([
          window.aurora.mcp.listNotes({ type: "goal" }),
          window.aurora.mcp.listNotes({ type: "habit" }),
        ]);
        if (!alive) return;
        setGoals(g.results);
        setHabits(h.results);
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { alive = false; };
  }, []);

  const loading = goals === null && habits === null && !err;

  return (
    <div className="overflow-y-auto h-full px-3 py-3">
      <p className="aur-mono" style={{ fontSize: 10, color: C.dim, marginBottom: 10 }}>
        user-model/ · {goals?.length ?? 0} goals · {habits?.length ?? 0} hábitos · vivo do vault via noesis-mcp
      </p>

      {err && (
        <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: 12, color: C.copper, fontSize: 12 }}>
          Não consegui ler o vault: {err}
        </div>
      )}
      {loading && <p style={{ color: C.dim, fontSize: 12 }}>Lendo o vault…</p>}

      {goals && goals.length === 0 && <EmptyVault label="GOALS." />}
      {goals?.map((g) => {
        const conf = num(g.frontmatter.confidence);
        const prog = num(g.frontmatter.progress) ?? 0;
        return (
          <div key={g.path} style={{
            background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12,
            padding: "12px 12px 10px", marginBottom: 10,
          }}>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="aur-display" style={{ color: C.bone, fontSize: 14, fontWeight: 600 }}>
                {g.title ?? g.id}
              </span>
              {g.frontmatter.horizon && <Chip>{g.frontmatter.horizon}</Chip>}
            </div>
            <div style={{ height: 4, background: C.panelUp, borderRadius: 2, overflow: "hidden" }}>
              <div style={{ width: `${Math.max(prog * 100, 2)}%`, height: "100%", background: C.phosphor, opacity: 0.9 }} />
            </div>
            <div className="flex items-center justify-between gap-2 mt-2">
              <span style={{ fontSize: 12, color: C.dim }}>
                {g.frontmatter.success_criteria ? `→ ${g.frontmatter.success_criteria}` : g.status ?? ""}
              </span>
              {conf !== null && <Chip tone="copper">conf {conf.toFixed(2)}</Chip>}
            </div>
          </div>
        );
      })}

      <p className="aur-display" style={{ color: C.dim, fontSize: 12, fontWeight: 600, margin: "14px 2px 8px" }}>
        HÁBITOS
      </p>
      {habits && habits.length === 0 && <EmptyVault label="Hábitos." />}
      {habits?.map((h) => (
        <div key={h.path} style={{
          background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12,
          padding: "11px 12px", marginBottom: 8,
        }}>
          <div className="flex items-center justify-between gap-2">
            <span className="aur-display" style={{ color: C.bone, fontSize: 13.5, fontWeight: 600 }}>{h.title ?? h.id}</span>
            {h.frontmatter.direction && <Chip tone="phos">{h.frontmatter.direction}</Chip>}
          </div>
          {h.frontmatter.frequency_target && (
            <div style={{ fontSize: 12, color: C.dim, marginTop: 3 }}>{h.frontmatter.frequency_target}</div>
          )}
          <div className="aur-mono" style={{ fontSize: 10, color: C.dim, marginTop: 4, opacity: 0.85 }}>
            {h.status ?? ""}{h.frontmatter.trigger ? ` · gatilho: ${h.frontmatter.trigger}` : ""}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Automações ---------- */
// Sem alarmes hardcoded — as automações nascem de rotinas reais que a Aurora
// registra no vault conforme conhece o usuário (ADR-0009). Enquanto não há
// rotinas, mostra o conceito (escada de insistência) e um estado vazio honesto.
function Automacoes() {
  const [routines, setRoutines] = useState<VaultNote[] | null>(null);
  useEffect(() => {
    let alive = true;
    window.aurora.mcp
      .listNotes({ dir: "user-model/routines" })
      .then((r) => { if (alive) setRoutines(r.results); })
      .catch(() => { if (alive) setRoutines([]); });
    return () => { alive = false; };
  }, []);

  return (
    <div className="overflow-y-auto h-full px-3 py-3">
      <p className="aur-mono" style={{ fontSize: 10, color: C.dim, marginBottom: 10 }}>
        rotinas · canal T0 (automação) · {routines?.length ?? 0} no vault
      </p>
      {routines && routines.length === 0 && <EmptyVault label="Automações." />}
      {routines?.map((r) => (
        <div key={r.path} className="flex items-center gap-3" style={{
          background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12,
          padding: "10px 12px", marginBottom: 8,
        }}>
          <span style={{ color: C.bone, fontSize: 13, flex: 1 }}>{r.title ?? r.id}</span>
          <Chip tone="phos">{r.status ?? "rotina"}</Chip>
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

/* ---------- Onboarding epistêmico (ADR-0005) ---------- */

// Chat "cru": fala direto com o bridge de IPC, sem os efeitos colaterais de
// vault do chat normal (get_context/log_event) — o onboarding usa um system
// prompt diferente e não deve poluir o USER-MODEL antes dele existir.
function useRawChat() {
  const requestIdRef = useRef<string | null>(null);
  const pendingRef = useRef<{
    resolve: (text: string) => void;
    reject: (err: Error) => void;
    onDelta?: (buffer: string) => void;
    buffer: string;
  } | null>(null);

  useEffect(() => {
    const offChunk = window.aurora.chat.onChunk(({ requestId, delta }) => {
      if (requestId !== requestIdRef.current || !pendingRef.current) return;
      pendingRef.current.buffer += delta;
      pendingRef.current.onDelta?.(pendingRef.current.buffer);
    });
    const offDone = window.aurora.chat.onDone(({ requestId, text }) => {
      if (requestId !== requestIdRef.current || !pendingRef.current) return;
      const pending = pendingRef.current;
      pendingRef.current = null;
      requestIdRef.current = null;
      pending.resolve(text || pending.buffer);
    });
    const offError = window.aurora.chat.onError(({ requestId, message }) => {
      if (requestId !== requestIdRef.current || !pendingRef.current) return;
      const pending = pendingRef.current;
      pendingRef.current = null;
      requestIdRef.current = null;
      pending.reject(new Error(message));
    });
    return () => { offChunk(); offDone(); offError(); };
  }, []);

  function ask(
    system: string,
    messages: { role: "user" | "assistant"; text: string }[],
    onDelta?: (buffer: string) => void
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const requestId = crypto.randomUUID();
      requestIdRef.current = requestId;
      pendingRef.current = { resolve, reject, onDelta, buffer: "" };
      window.aurora.chat.send({
        requestId,
        system,
        messages: messages.map((m) => ({ role: m.role, content: [{ type: "text" as const, text: m.text }] })),
      });
    });
  }

  return { ask };
}

// ONBOARDING_SYSTEM mora em ./prompt.ts (ver ADR-0005 §2).

const ONBOARDING_SYNTH_SYSTEM = `Você acabou de entrevistar um novo usuário pela primeira vez. Abaixo está a transcrição completa (pergunta sua, resposta dele). Devolva SOMENTE um bloco JSON válido (sem markdown, sem texto antes ou depois) neste formato exato:
{
  "name": "string ou null se não foi dito",
  "summary": "2 a 4 frases em português, tom caloroso, resumindo quem é essa pessoa",
  "goals": [{ "title": "string curta", "horizon": "short|mid|long", "success_criteria": "string observável" }],
  "values": ["string", "..."],
  "skills": [{ "name": "string curta", "level": "novice|intermediate|advanced|expert" }],
  "interests": ["string", "..."],
  "personality_notes": "string ou null",
  "learning_style": "string ou null",
  "blockers": "string ou null — só se a pessoa compartilhou de livre vontade"
}
Só inclua um goal/value/skill se a pessoa realmente declarou algo equivalente na conversa — não invente para preencher o formato. Arrays podem ficar vazios.`;

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40) || "sem-titulo"
  );
}

interface OnboardingMsg { role: "user" | "assistant"; text: string }

function Onboarding({ onComplete }: { onComplete: () => void }) {
  const rawChat = useRawChat();
  const [messages, setMessages] = useState<OnboardingMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(true);
  const [phase, setPhase] = useState<"interview" | "synthesizing" | "error">("interview");
  const [errorMsg, setErrorMsg] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    rawChat
      .ask(buildOnboardingSystemPrompt(), [{ role: "user", text: "Comece a entrevista." }])
      .then((text) => { setMessages([{ role: "assistant", text }]); setBusy(false); })
      .catch((err) => { setPhase("error"); setErrorMsg(err instanceof Error ? err.message : String(err)); setBusy(false); });
  }, []);

  const exchangeCount = messages.filter((m) => m.role === "user").length;

  async function writeOnboardingResult(parsed: any, transcript: string) {
    const today = new Date().toISOString().slice(0, 10);
    const entityIds: string[] = [];

    for (const g of parsed?.goals ?? []) {
      if (!g?.title) continue;
      const id = `goal-${slugify(g.title)}`;
      try {
        await window.aurora.mcp.createNote({
          type: "goal", id, dir: "user-model/goals", status: "active",
          fields: {
            horizon: ["short", "mid", "long"].includes(g.horizon) ? g.horizon : "mid",
            origin: "declared", confidence: 0.6, progress: 0,
            success_criteria: g.success_criteria ?? "",
            review_cycle: "monthly",
          },
          body: `# Goal — ${g.title}\n\nDeclarado no onboarding inicial (${today}). Ver \`journal/onboarding.md\` para o contexto completo da conversa.`,
        });
        entityIds.push(id);
      } catch (err) { console.warn(`Falha ao criar goal '${id}':`, err); }
    }

    for (const v of parsed?.values ?? []) {
      if (!v) continue;
      const id = `value-${slugify(v)}`;
      try {
        await window.aurora.mcp.createNote({
          type: "value", id, dir: "user-model/values", status: "active",
          fields: { origin: "declared" },
          body: `# Value — ${v}\n\nDeclarado no onboarding inicial (${today}).`,
        });
        entityIds.push(id);
      } catch (err) { console.warn(`Falha ao criar value '${id}':`, err); }
    }

    for (const s of parsed?.skills ?? []) {
      if (!s?.name) continue;
      const id = `skill-${slugify(s.name)}`;
      try {
        await window.aurora.mcp.createNote({
          type: "skill", id, dir: "user-model/skills", status: "active",
          fields: { origin: "declared", level: s.level ?? "novice", evidence: ["Autorrelato no onboarding inicial."] },
          body: `# Skill — ${s.name}\n\nDeclarado no onboarding inicial (${today}).`,
        });
        entityIds.push(id);
      } catch (err) { console.warn(`Falha ao criar skill '${id}':`, err); }
    }

    // Interesses/personalidade/estilo de aprendizagem/bloqueios são traços
    // AUTODECLARADOS, não inferidos — não viram nota em user-model/patterns/
    // (ontology/ontology.yaml: "patterns/ só recebe type: hypothesis
    // subtype: user-pattern, nunca criadas manualmente"; ver ADR-0005 §3).
    // Ficam registrados aqui, em texto, disponíveis para get_context.
    const journalBody = parsed
      ? `# Onboarding — primeira apresentação\n\n**Data:** ${today}\n**Nome:** ${parsed.name ?? "(não informado)"}\n\n## Síntese\n\n${parsed.summary ?? ""}\n\n## Interesses\n\n${(parsed.interests ?? []).map((i: string) => `- ${i}`).join("\n") || "(nenhum declarado)"}\n\n## Personalidade percebida\n\n${parsed.personality_notes ?? "(não observado)"}\n\n## Como aprende melhor\n\n${parsed.learning_style ?? "(não declarado)"}\n\n## Bloqueios/medos (se compartilhados)\n\n${parsed.blockers ?? "(não compartilhado)"}\n\n## Transcrição completa\n\n${transcript}`
      : `# Onboarding — primeira apresentação\n\n**Data:** ${today}\n\n_A síntese estruturada falhou nesta sessão — segue só a transcrição bruta._\n\n## Transcrição completa\n\n${transcript}`;

    try {
      await window.aurora.mcp.createNote({
        type: "meta", id: "onboarding", dir: "journal", status: "active",
        body: journalBody,
      });
    } catch (err) { console.warn("Falha ao criar journal/onboarding.md:", err); }

    try {
      await window.aurora.mcp.logEvent({
        type: "onboarding-complete",
        summary: `Onboarding concluído${parsed?.name ? ` — ${parsed.name}` : ""}.`,
        entities: entityIds,
        data: { structured: Boolean(parsed) },
      });
    } catch (err) { console.warn("Falha ao registrar log_event de onboarding:", err); }
  }

  async function finishOnboarding(history: OnboardingMsg[]) {
    setPhase("synthesizing");
    setBusy(true);
    const transcript = history.map((m) => `${m.role === "assistant" ? "Aurora" : "Usuário"}: ${m.text}`).join("\n");
    let parsed: any = null;
    try {
      const raw = await rawChat.ask(ONBOARDING_SYNTH_SYSTEM, [{ role: "user", text: transcript }]);
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch (err) {
      console.warn("Síntese do onboarding falhou, gravando só a transcrição bruta:", err);
    }
    try {
      await writeOnboardingResult(parsed, transcript);
    } finally {
      onComplete();
    }
  }

  async function send(overrideText?: string) {
    const t = (overrideText ?? input).trim();
    if (!t || busy) return;
    setInput("");
    const history = [...messages, { role: "user" as const, text: t }];
    setMessages([...history, { role: "assistant" as const, text: "" }]);
    setBusy(true);
    try {
      const reply = await rawChat.ask(
        buildOnboardingSystemPrompt(),
        history,
        (buffer) => {
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = { role: "assistant", text: buffer };
            return next;
          });
        }
      );
      const finalHistory = [...history, { role: "assistant" as const, text: reply }];
      setMessages(finalHistory);
      setBusy(false);
      if (finalHistory.filter((m) => m.role === "user").length >= 12) {
        finishOnboarding(finalHistory);
      }
    } catch (err) {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: "assistant", text: `Falha de conexão: ${err instanceof Error ? err.message : String(err)}` };
        return next;
      });
      setBusy(false);
    }
  }

  if (phase === "error") {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center">
        <p className="aur-display" style={{ color: C.bone, fontSize: 15, marginBottom: 8 }}>Não consegui começar a conversa.</p>
        <p className="aur-mono" style={{ color: C.dim, fontSize: 12 }}>{errorMsg}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-2" style={{ borderBottom: `1px solid ${C.line}` }}>
        <p className="aur-display" style={{ color: C.bone, fontSize: 16, fontWeight: 700 }}>Bem-vindo(a) à Aurora</p>
        <p style={{ color: C.dim, fontSize: 12.5, lineHeight: 1.5, marginTop: 4 }}>
          Antes de começarmos a trabalhar juntos, a Aurora quer te conhecer.
          Ela vai fazer algumas perguntas abertas — sem certo ou errado, sem
          pressa. Você pode encerrar quando quiser.
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3" style={{ minHeight: 0 }}>
        {messages.map((m, i) => (
          <div key={i} className={`flex mb-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div style={{
              maxWidth: "85%", padding: "9px 12px", fontSize: 14, lineHeight: 1.45,
              color: C.bone, whiteSpace: "pre-wrap",
              background: m.role === "user" ? C.panelUp : C.panel,
              border: `1px solid ${C.line}`,
              borderLeft: m.role === "assistant" ? `2px solid ${C.phosphor}` : `1px solid ${C.line}`,
              borderRadius: m.role === "user" ? "12px 12px 3px 12px" : "3px 12px 12px 12px",
            }}>{m.text}</div>
          </div>
        ))}
        {phase === "synthesizing" && (
          <div className="aur-mono" style={{ color: C.dim, fontSize: 12, padding: "2px 4px" }}>
            aurora está juntando o que aprendeu…
          </div>
        )}
        {busy && phase === "interview" && (
          <div className="aur-mono" style={{ color: C.dim, fontSize: 12, padding: "2px 4px" }}>
            aurora está pensando…
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="px-3 pb-3 pt-1" style={{ borderTop: `1px solid ${C.line}` }}>
        <div className="flex gap-2 items-end pt-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            rows={1}
            placeholder="Responde aqui…"
            disabled={phase !== "interview" || busy}
            style={{
              flex: 1, resize: "none", background: C.panel, color: C.bone,
              border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 12px",
              fontSize: 14, outline: "none",
            }}
          />
          <button onClick={() => send()} disabled={phase !== "interview" || busy}
            className="aur-display"
            style={{
              background: busy ? C.panelUp : C.phosphor, color: busy ? C.dim : "#0C1517",
              fontWeight: 600, fontSize: 13, border: "none", borderRadius: 10,
              padding: "10px 14px", cursor: busy ? "default" : "pointer",
            }}>Enviar</button>
        </div>
        {exchangeCount >= 6 && phase === "interview" && (
          <button onClick={() => finishOnboarding(messages)} disabled={busy}
            className="aur-mono" style={{
              marginTop: 8, background: "transparent", color: C.copper, fontSize: 11.5,
              border: `1px solid ${C.line}`, borderRadius: 8, padding: "6px 10px", cursor: "pointer",
            }}>Isso já é suficiente por agora — pode seguir</button>
        )}
      </div>
    </div>
  );
}

/* ---------- Shell ---------- */
const TTS_STORAGE_KEY = "aurora:tts-enabled";

export default function AuroraApp() {
  const [phase, setPhase] = useState<"loading" | "onboarding" | "app">("loading");
  const [tab, setTab] = useState<"chat" | "painel" | "grafo" | "auto" | "settings">("chat");
  const [ttsEnabled, setTtsEnabled] = useState(() => {
    const saved = localStorage.getItem(TTS_STORAGE_KEY);
    return saved === null ? true : saved === "1";
  });
  const ttsEnabledRef = useRef(ttsEnabled);
  ttsEnabledRef.current = ttsEnabled;

  useEffect(() => {
    localStorage.setItem(TTS_STORAGE_KEY, ttsEnabled ? "1" : "0");
  }, [ttsEnabled]);

  useEffect(() => {
    window.aurora.onboarding
      .isFirstRun()
      .then((isFirst) => setPhase(isFirst ? "onboarding" : "app"))
      .catch((err) => {
        console.warn("Falha ao checar primeira execução, seguindo para o chat normal:", err);
        setPhase("app");
      });
  }, []);

  const handleAssistantReply = useCallback((text: string) => {
    if (ttsEnabledRef.current) speak(text);
  }, []);

  const chat = useAuroraChat(handleAssistantReply);

  // Estado da janela: maximizada (pro botão do header refletir) e largura
  // (pro cockpit da aba Mente virar split só quando há espaço).
  const [maximized, setMaximized] = useState(true);
  const [wide, setWide] = useState(() => window.innerWidth >= 900);
  useEffect(() => {
    window.aurora.window.isMaximized().then(setMaximized).catch(() => {});
    const offMax = window.aurora.window.onMaximizedChanged(setMaximized);
    const onResize = () => setWide(window.innerWidth >= 900);
    window.addEventListener("resize", onResize);
    return () => { offMax(); window.removeEventListener("resize", onResize); };
  }, []);

  const tabs: { id: "chat" | "painel" | "grafo" | "auto" | "settings"; label: string }[] = [
    { id: "chat", label: "Conversa" },
    { id: "painel", label: "Painel" },
    { id: "grafo", label: "Mente" },
    { id: "auto", label: "Automações" },
    { id: "settings", label: "Config" },
  ];

  // Nas abas que não são o grafo, centraliza o conteúdo numa coluna legível
  // (senão os balões/cards esticam demais na tela cheia). O grafo usa a
  // largura toda (cockpit).
  const Col = ({ children }: { children: React.ReactNode }) => (
    <div style={{ maxWidth: 760, width: "100%", margin: "0 auto", height: "100%" }}>{children}</div>
  );

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
          {phase === "app" && <Metabolismo thinking={chat.busy} />}
          {phase === "app" && (
            <button onClick={() => setTtsEnabled(v => !v)} title={ttsEnabled ? "Desligar voz da Aurora" : "Ligar voz da Aurora"}
              style={{
                background: "transparent", color: ttsEnabled ? C.phosphor : C.dim,
                border: `1px solid ${C.line}`, borderRadius: 8, padding: 6, cursor: "pointer", display: "flex",
              }}><SpeakerIcon muted={!ttsEnabled} /></button>
          )}
          <button onClick={() => window.aurora.window.minimize()} title="Minimizar"
            style={{ background: "transparent", color: C.dim, border: `1px solid ${C.line}`, borderRadius: 8, padding: 6, cursor: "pointer", display: "flex" }}>
            <MinimizeIcon />
          </button>
          <button onClick={() => window.aurora.window.toggleMaximize().then(setMaximized)}
            title={maximized ? "Restaurar janela" : "Maximizar (tela cheia)"}
            style={{ background: "transparent", color: C.dim, border: `1px solid ${C.line}`, borderRadius: 8, padding: 6, cursor: "pointer", display: "flex" }}>
            <MaximizeIcon maximized={maximized} />
          </button>
          <button onClick={() => window.aurora.window.close()} title="Fechar"
            style={{ background: "transparent", color: C.dim, border: `1px solid ${C.line}`, borderRadius: 8, padding: 6, cursor: "pointer", display: "flex" }}>
            <CloseIcon />
          </button>
        </div>
      </header>

      <main className="flex-1" style={{ minHeight: 0 }}>
        {phase === "loading" && (
          <div className="flex items-center justify-center h-full">
            <Metabolismo thinking />
          </div>
        )}
        {phase === "onboarding" && <Onboarding onComplete={() => setPhase("app")} />}
        {phase === "app" && (
          <>
            <div style={{ display: tab === "chat" ? "block" : "none", height: "100%" }}>
              <Col><Chat chat={chat} tab={tab} /></Col>
            </div>
            {tab === "painel" && <Col><Painel /></Col>}
            {/* Aba Mente (cockpit): em tela larga, grafo grande + conversa
                completa ao lado (mesma voz/imagem). Em janela estreita, só o
                grafo (a conversa continua na aba Conversa). O grafo é montado
                só quando visível — a física do vis-network não roda em
                background; o graph:activated chega enquanto a aba está aberta. */}
            {tab === "grafo" && (
              wide ? (
                <div className="flex h-full">
                  <div className="flex-1" style={{ minWidth: 0 }}>
                    <GraphView />
                  </div>
                  <div style={{ width: 420, height: "100%", borderLeft: `1px solid ${C.line}`, display: "flex", flexDirection: "column" }}>
                    <Chat chat={chat} tab={tab} />
                  </div>
                </div>
              ) : (
                <GraphView />
              )
            )}
            {tab === "auto" && <Col><Automacoes /></Col>}
            {tab === "settings" && <Col><Settings /></Col>}
          </>
        )}
      </main>

      {phase === "app" && (
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
      )}
    </div>
  );
}
