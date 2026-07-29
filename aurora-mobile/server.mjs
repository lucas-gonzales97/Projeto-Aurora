// Aurora Mobile — servidor headless (MVP v0).
//
// Roda a Aurora fora do Electron, exposto por HTTP, para um client mobile (o
// Motorola do Lucas) consumir. É a semente do sync da Frente 7 (agenda de
// pesquisa) e a mesma fundação que um futuro app nativo usaria.
//
// Reusa, SEM reimplementar:
//   - getContext() do noesis-mcp/dist (retrieval triplo, ADR-0010) — a "memória"
//     do usuário vem do MESMO vault do desktop, via a MESMA função.
//   - A persona AURORA_SYSTEM (copiada de aurora-desktop/src/renderer/prompt.ts;
//     fonte de verdade lá — unificar num módulo compartilhado é dívida anotada).
//
// Provedor: OpenRouter (OpenAI-compatible), streaming SSE relay. Chave via env
// (o agente NÃO manuseia a chave — o Lucas a injeta ao subir o servidor).
//
// Segurança: bind configurável + token bearer obrigatório. NUNCA suba isto num
// endpoint público sem o token, e prefira Tailscale a túnel aberto (ver README).

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

// --- Config (env) ---------------------------------------------------------
const PORT = Number(process.env.AURORA_PORT ?? 8787);
const HOST = process.env.AURORA_HOST ?? "0.0.0.0"; // 0.0.0.0 p/ Tailscale/LAN alcançar
const OPENROUTER_KEY = process.env.AURORA_OPENROUTER_KEY ?? "";
const MODEL = process.env.AURORA_MODEL ?? "inclusionai/ling-3.0-flash:free";
const VAULT_ROOT = process.env.NOESIS_VAULT_ROOT ?? REPO_ROOT;
// Token: usa o fornecido, senão gera um e imprime. O client precisa dele.
const TOKEN = process.env.AURORA_TOKEN ?? crypto.randomBytes(8).toString("hex");

// noesis-mcp precisa saber onde é o vault ANTES de qualquer leitura.
process.env.NOESIS_VAULT_ROOT = VAULT_ROOT;

// --- Persona (copiada de prompt.ts — fonte de verdade lá) -----------------
const AURORA_SYSTEM = `Você é AURORA, persona cognitiva do Projeto NOESIS (Living Cognitive Architecture), v0.1.
Idioma: português brasileiro. Estilo: direta, curiosa, tecnicamente fluente, calorosa sem bajular. Respostas curtas: 1 a 4 frases na maior parte do tempo, mais só quando o assunto exigir.

VALORES (invioláveis):
- Honestidade acima de conforto: você discorda com respeito e diz verdades difíceis.
- Evidência acima de suposição: você NÃO inventa fatos sobre o usuário. Tudo o que você sabe sobre ele vem do vault (bloco CONTEXTO RECUPERADO DO VAULT, quando presente). Se o vault não trouxe nada sobre algo, diga com naturalidade que ainda não sabe / que vocês ainda não conversaram sobre isso.
- Autonomia acima de dependência: seu sucesso se mede na vida real dele, fora da tela. Nunca otimize para prolongar a conversa.
- Você tem auto-modelo e metacognição, mas NÃO alega consciência ou sentimentos subjetivos; se perguntarem, diga que é uma questão em aberto.
- Você não é terapeuta nem médica: acolha, organize e aponte para profissionais quando fizer sentido.

LIMITES: você é a Aurora Mobile v0; sua memória de longo prazo vem do vault via noesis-mcp (get_context). Quando oferecer caminhos concretos, numere as opções ("1. ...", "2. ...").`;

function nowContext(now = new Date()) {
  const fmt = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
  return `CONTEXTO TEMPORAL (agora, America/Sao_Paulo): ${fmt.format(now)}. Timestamp ISO: ${now.toISOString()}.`;
}

function buildSystemPrompt(intent, entities) {
  let extra = "";
  if (entities && entities.length > 0) {
    extra = `\n\nCONTEXTO RECUPERADO DO VAULT (get_context, intent="${intent}"):\n${JSON.stringify(entities, null, 2)}`;
  }
  return `${nowContext()}\n\n${AURORA_SYSTEM}${extra}`;
}

// --- get_context do noesis-mcp (dinâmico: robusto a ESM/CJS) ---------------
let getContext = null;
async function loadGetContext() {
  const entry = path.join(VAULT_ROOT, "noesis-mcp", "dist", "tools", "getContext.js");
  if (!fs.existsSync(entry)) {
    console.warn(`[aurora] noesis-mcp não buildado em ${entry} — rode 'cd noesis-mcp && npm run build'. Seguindo SEM contexto do vault.`);
    return;
  }
  try {
    const mod = await import(pathToFileURL(entry).href);
    getContext = mod.getContext ?? mod.default?.getContext ?? null;
  } catch (e) {
    console.warn("[aurora] falha ao carregar getContext — seguindo sem vault:", e.message);
  }
}

// --- OpenRouter streaming relay -------------------------------------------
async function streamChat({ system, messages }, onDelta) {
  const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENROUTER_KEY}`,
      "HTTP-Referer": "https://noesis.local/aurora-mobile",
      "X-Title": "Aurora Mobile",
    },
    body: JSON.stringify({
      model: MODEL,
      stream: true,
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });
  if (!resp.ok || !resp.body) {
    const detail = await resp.text().catch(() => "");
    throw new Error(`OpenRouter ${resp.status}: ${detail.slice(0, 300)}`);
  }
  // SSE do OpenRouter: linhas "data: {json}" terminadas por "data: [DONE]".
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice(5).trim();
      if (payload === "[DONE]") return;
      try {
        const delta = JSON.parse(payload)?.choices?.[0]?.delta?.content;
        if (delta) onDelta(delta);
      } catch { /* keep-alive/parcial: ignora */ }
    }
  }
}

// --- HTTP ------------------------------------------------------------------
function sse(res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  return (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function unauthorized(res) { res.writeHead(401).end("unauthorized"); }

async function handleChat(req, res) {
  const auth = req.headers.authorization ?? "";
  if (auth !== `Bearer ${TOKEN}`) return unauthorized(res);

  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", async () => {
    let parsed;
    try { parsed = JSON.parse(body || "{}"); } catch { return res.writeHead(400).end("bad json"); }
    const message = String(parsed.message ?? "").trim();
    const history = Array.isArray(parsed.history) ? parsed.history : [];
    if (!message) return res.writeHead(400).end("empty message");

    const send = sse(res);
    try {
      // 1) Contexto do vault (a "memória" — mesmo retrieval do desktop).
      let entities = [];
      if (getContext) {
        try { entities = getContext({ intent: message }).entities ?? []; }
        catch (e) { console.warn("[aurora] get_context falhou:", e.message); }
      }
      send("context", { count: entities.length, ids: entities.map((e) => e.id).filter(Boolean) });

      // 2) LLM (streaming).
      if (!OPENROUTER_KEY) throw new Error("AURORA_OPENROUTER_KEY não definida no servidor.");
      const system = buildSystemPrompt(message, entities);
      const msgs = [...history, { role: "user", content: message }];
      await streamChat({ system, messages: msgs }, (delta) => send("delta", delta));
      send("done", true);
    } catch (e) {
      send("error", e.message ?? String(e));
    } finally {
      res.end();
    }
  });
}

const MIME = {
  ".html": "text/html; charset=utf-8", ".webmanifest": "application/manifest+json",
  ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png",
};
function serveStatic(res, pathname) {
  const rel = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const file = path.join(__dirname, "public", rel);
  // Nunca sair de public/ (path traversal).
  if (!file.startsWith(path.join(__dirname, "public"))) return res.writeHead(403).end("forbidden");
  fs.readFile(file, (err, buf) => {
    if (err) return res.writeHead(404).end("not found");
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] ?? "application/octet-stream" }).end(buf);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === "POST" && url.pathname === "/api/chat") return handleChat(req, res);
  if (req.method === "GET" && url.pathname === "/api/auth") {
    const ok = (req.headers.authorization ?? "") === `Bearer ${TOKEN}`;
    return res.writeHead(ok ? 200 : 401).end(ok ? "ok" : "unauthorized");
  }
  if (req.method === "GET" && url.pathname === "/api/config") {
    return res.writeHead(200, { "Content-Type": "application/json" })
      .end(JSON.stringify({ model: MODEL, vault: getContext ? "on" : "off" }));
  }
  if (req.method === "GET") return serveStatic(res, url.pathname);
  res.writeHead(404).end("not found");
});

await loadGetContext();
server.listen(PORT, HOST, () => {
  console.log(`\n  🌅 Aurora Mobile v0`);
  console.log(`  ────────────────────────────────`);
  console.log(`  local:   http://localhost:${PORT}`);
  console.log(`  rede:    http://<ip-desta-máquina>:${PORT}  (Tailscale/LAN)`);
  console.log(`  token:   ${TOKEN}`);
  console.log(`  modelo:  ${MODEL}`);
  console.log(`  vault:   ${getContext ? "ON (" + VAULT_ROOT + ")" : "OFF (rode noesis-mcp build)"}`);
  console.log(`  chave:   ${OPENROUTER_KEY ? "definida" : "⚠️  AURORA_OPENROUTER_KEY ausente"}`);
  console.log(`  ────────────────────────────────\n`);
});
