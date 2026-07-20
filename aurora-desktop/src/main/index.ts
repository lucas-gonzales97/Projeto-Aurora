import { app, BrowserWindow, ipcMain, nativeImage } from "electron";
import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";

// Vault root: aurora-desktop/ vive na raiz do vault, ao lado de noesis-mcp/
// (dist/main/index.js -> dist/ -> aurora-desktop/ -> raiz do vault).
const VAULT_ROOT = path.resolve(__dirname, "../../..");
const NOESIS_MCP_ENTRY = path.join(VAULT_ROOT, "noesis-mcp/dist/index.js");
const ICON_PATH = path.join(__dirname, "../../assets/icon.svg");

const isDev = process.env.NODE_ENV === "development";
const RENDERER_DEV_URL = "http://localhost:5173";
const RENDERER_BUILD_FILE = path.join(__dirname, "../renderer/index.html");

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

let mainWindow: BrowserWindow | null = null;

// --- noesis-mcp: cliente MCP falando stdio com o servidor do vault ---
// O SDK do MCP é ESM-only; import() dinâmico é o jeito padrão de consumi-lo
// a partir do main process em CommonJS (ver ADR-0003).
type McpClient = { callTool: (args: { name: string; arguments: Record<string, unknown> }) => Promise<any> };
let mcpClientPromise: Promise<McpClient> | null = null;

async function getMcpClient(): Promise<McpClient> {
  if (!mcpClientPromise) {
    mcpClientPromise = (async () => {
      const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
      const { StdioClientTransport } = await import("@modelcontextprotocol/sdk/client/stdio.js");
      const transport = new StdioClientTransport({
        command: "node",
        args: [NOESIS_MCP_ENTRY],
        cwd: path.join(VAULT_ROOT, "noesis-mcp"),
      });
      const client = new Client({ name: "aurora-desktop", version: "0.1.0" }, { capabilities: {} });
      await client.connect(transport);
      return client as unknown as McpClient;
    })();
  }
  return mcpClientPromise;
}

function firstTextBlock(result: any): string {
  const block = Array.isArray(result?.content)
    ? result.content.find((b: any) => b.type === "text")
    : null;
  return block?.text ?? "";
}

async function callMcpTool(name: string, args: Record<string, unknown>) {
  const client = await getMcpClient();
  const result = await client.callTool({ name, arguments: args });
  const text = firstTextBlock(result);
  if (result?.isError) throw new Error(text || `noesis-mcp: falha em ${name}`);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// --- Janela principal ---
function createWindow() {
  const iconImage = nativeImage.createFromPath(ICON_PATH);

  mainWindow = new BrowserWindow({
    width: 420,
    height: 780,
    frame: false,
    resizable: false,
    alwaysOnTop: process.env.AURORA_ALWAYS_ON_TOP === "1",
    backgroundColor: "#0C1517",
    // SVG é placeholder de design (ADR-0003 item 4); nativeImage não decodifica
    // SVG em todas as plataformas, então cai para o ícone padrão do Electron
    // silenciosamente quando isso acontece — trocar por .png/.ico/.icns real
    // antes de empacotar.
    icon: iconImage.isEmpty() ? undefined : iconImage,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL(RENDERER_DEV_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(RENDERER_BUILD_FILE);
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// --- IPC: janela (necessário porque a janela é frameless) ---
ipcMain.on("window:close", (event) => {
  BrowserWindow.fromWebContents(event.sender)?.close();
});

ipcMain.on("window:minimize", (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize();
});

ipcMain.handle("window:toggle-always-on-top", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return false;
  const next = !win.isAlwaysOnTop();
  win.setAlwaysOnTop(next);
  return next;
});

// --- IPC: noesis-mcp ---
ipcMain.handle("mcp:get-context", async (_event, intent: string) => {
  return callMcpTool("get_context", { intent });
});

ipcMain.handle("mcp:log-event", async (_event, payload: { type: string; summary: string; entities?: string[]; data?: Record<string, unknown> }) => {
  return callMcpTool("log_event", payload);
});

ipcMain.handle("mcp:create-note", async (_event, payload: Record<string, unknown>) => {
  return callMcpTool("create_note", payload);
});

ipcMain.handle("mcp:create-relation", async (_event, payload: Record<string, unknown>) => {
  return callMcpTool("create_relation", payload);
});

// --- IPC: onboarding (ADR-0005) ---
// Não existe um único "arquivo de perfil" por usuário — user-model/USER-MODEL.md
// é o schema, não uma instância. "Primeira execução" é operacionalizada como
// "nenhuma nota real ainda em goals/values/skills/patterns" (ver ADR-0005 §5).
const ONBOARDING_DIRS = ["user-model/goals", "user-model/values", "user-model/skills", "user-model/patterns"];

function hasAnyUserModelNotes(): boolean {
  return ONBOARDING_DIRS.some((rel) => {
    const abs = path.join(VAULT_ROOT, rel);
    if (!fs.existsSync(abs)) return false;
    return fs.readdirSync(abs).some((f) => f.endsWith(".md"));
  });
}

ipcMain.handle("aurora:is-first-run", async () => {
  return !hasAnyUserModelNotes();
});

// --- IPC: chat (streaming) ---
interface ChatContentBlock {
  type: "text" | "image";
  text?: string;
  mediaType?: string;
  base64?: string;
}
interface ChatMessage {
  role: "user" | "assistant";
  content: ChatContentBlock[];
}
interface ChatSendPayload {
  requestId: string;
  system: string;
  messages: ChatMessage[];
}

function toAnthropicContent(blocks: ChatContentBlock[]) {
  return blocks.map((b) => {
    if (b.type === "image") {
      return {
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: (b.mediaType ?? "image/png") as "image/png" | "image/jpeg" | "image/gif" | "image/webp",
          data: b.base64 ?? "",
        },
      };
    }
    return { type: "text" as const, text: b.text ?? "" };
  });
}

ipcMain.on("chat:send", async (event, payload: ChatSendPayload) => {
  const { requestId, system, messages } = payload;
  const sender = event.sender;

  if (!anthropic) {
    sender.send("chat:error", {
      requestId,
      message: "ANTHROPIC_API_KEY não configurada no ambiente do app. Defina a variável e reinicie.",
    });
    return;
  }

  try {
    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system,
      messages: messages.map((m) => ({ role: m.role, content: toAnthropicContent(m.content) })),
    });

    stream.on("text", (delta) => {
      sender.send("chat:chunk", { requestId, delta });
    });

    const finalMessage = await stream.finalMessage();
    const text = finalMessage.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    sender.send("chat:done", { requestId, text });
  } catch (err) {
    sender.send("chat:error", {
      requestId,
      message: err instanceof Error ? err.message : String(err),
    });
  }
});
