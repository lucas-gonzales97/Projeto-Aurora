import { app, BrowserWindow, ipcMain, nativeImage } from "electron";
import fs from "node:fs";
import path from "node:path";
import { PROVIDER_REGISTRY, getProvider } from "./providers/index.js";
import type { ChatMessage } from "./providers/types.js";
import {
  saveProviderKey,
  getProviderKey,
  deleteProviderKey,
  hasProviderKey,
  isKeyStorageSecure,
  getActiveProvider,
  setActiveProvider,
  getActiveModel,
  setActiveModel,
  saveTtsConfig,
  getTtsConfig,
  deleteTtsConfig,
  hasTtsConfig,
} from "./providers/keyStore.js";
import { synthesizeSpeech, validateAzureSpeechConfig } from "./tts/azureSpeech.js";
import dynamicImport from "./esmImport.js";

// Vault root: aurora-desktop/ vive na raiz do vault, ao lado de noesis-mcp/
// (dist/main/index.js -> dist/ -> aurora-desktop/ -> raiz do vault).
const VAULT_ROOT = path.resolve(__dirname, "../../..");
const NOESIS_MCP_ENTRY = path.join(VAULT_ROOT, "noesis-mcp/dist/index.js");
// build/icon.png é gerado a partir de assets/icon.svg via `npm run icons`
// (script/generate-icons.mjs) — nativeImage não decodifica SVG de forma
// confiável em todas as plataformas, então o ícone de janela em runtime usa
// o PNG raster; o empacotamento (electron-builder) usa build/icon.{ico,icns,png}
// diretamente, ver a seção "build" em package.json.
const ICON_PATH = path.join(__dirname, "../../build/icon.png");

const isDev = process.env.NODE_ENV === "development";
const RENDERER_DEV_URL = "http://localhost:5173";
const RENDERER_BUILD_FILE = path.join(__dirname, "../renderer/index.html");

let mainWindow: BrowserWindow | null = null;

// --- noesis-mcp: cliente MCP falando stdio com o servidor do vault ---
// O SDK do MCP é ESM-only; `dynamicImport` (esmImport.ts) evita que o TS
// rebaixe isso pra `require()` sob module:"commonjs" e quebre com
// ERR_REQUIRE_ESM em runtime (mesmo problema resolvido em keyStore.ts pro
// electron-store — ver ADR-0003).
type McpClient = { callTool: (args: { name: string; arguments: Record<string, unknown> }) => Promise<any> };
let mcpClientPromise: Promise<McpClient> | null = null;

async function getMcpClient(): Promise<McpClient> {
  if (!mcpClientPromise) {
    mcpClientPromise = (async () => {
      const { Client } = await dynamicImport("@modelcontextprotocol/sdk/client/index.js");
      const { StdioClientTransport } = await dynamicImport("@modelcontextprotocol/sdk/client/stdio.js");
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

// --- Telemetria por chamada (MODEL-ROUTER.md §5) ---
// Grava em events/{dia}.jsonl via log_event do noesis-mcp — é o mesmo
// arquivo/formato JSONL que MODEL-ROUTER.md §5 já especifica como dataset
// pro roteador automático futuro, só que hoje quem decide o motor é o
// usuário (aba Config), não um roteador de verdade.
//
// `tier: "cloud-manual"` é um placeholder deliberado: o roteador T0–T5
// (MODEL-ROUTER.md §1/§3) ainda não existe em código, e fingir uma
// classificação T0–T5 aqui seria inventar um dado que o sistema não sabe
// produzir de verdade. `custo_estimado_usd` fica sempre `null` pelo mesmo
// motivo — calcular custo real exigiria manter uma tabela de preço por
// modelo/provedor à mão (desatualiza rápido); fica pra quando os dados de
// uso real (ver README "Provedores multi-LLM") justificarem o esforço.
function logModelRouterTelemetry(entry: {
  providerId: string;
  model: string;
  latencyMs: number;
  success: boolean;
  inputTokens?: number;
  outputTokens?: number;
  error?: string;
}): void {
  const summary = entry.success
    ? `${entry.providerId}/${entry.model} · ${entry.latencyMs}ms`
    : `${entry.providerId}/${entry.model} · falhou: ${entry.error ?? "erro desconhecido"}`;
  callMcpTool("log_event", {
    type: "model-router-telemetry",
    summary,
    data: {
      task_class: "chat-conversacional",
      tier: "cloud-manual",
      modelo: entry.model,
      provedor: entry.providerId,
      tokens_in: entry.inputTokens ?? null,
      tokens_out: entry.outputTokens ?? null,
      custo_estimado_usd: null,
      sucesso: entry.success,
      escalou_de: null,
      latencia_ms: entry.latencyMs,
      erro: entry.error ?? null,
    },
  }).catch((err) => {
    // Nunca deixa telemetria quebrar o chat — só avisa no console do main.
    console.warn("Telemetria: falha ao gravar log_event (noesis-mcp offline?):", err);
  });
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
    // build/icon.png (gerado por `npm run icons` a partir de assets/icon.svg,
    // o ícone oficial "Aurora Icon v2") pode não existir ainda em checkout
    // limpo antes do primeiro `npm run icons`/`npm run dist` — cai pro ícone
    // padrão do Electron nesse caso em vez de quebrar a janela.
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

// --- IPC: chat (streaming, multi-provedor — ADR-0006) ---
interface ChatSendPayload {
  requestId: string;
  system: string;
  messages: ChatMessage[];
}

ipcMain.on("chat:send", async (event, payload: ChatSendPayload) => {
  const { requestId, system, messages } = payload;
  const sender = event.sender;

  const providerId = await getActiveProvider();
  const provider = PROVIDER_REGISTRY[providerId];
  if (!provider) {
    sender.send("chat:error", {
      requestId,
      message: `Provedor '${providerId}' não encontrado. Abra Configurações e escolha um provedor.`,
    });
    return;
  }

  const model = await getActiveModel();
  if (!model) {
    sender.send("chat:error", {
      requestId,
      message: `Nenhum modelo selecionado para ${provider.label}. Abra Configurações e escolha um modelo.`,
    });
    return;
  }

  const apiKey = provider.requiresApiKey ? await getProviderKey(providerId) : "";
  if (provider.requiresApiKey && !apiKey) {
    sender.send("chat:error", {
      requestId,
      message: `Nenhuma chave configurada para ${provider.label}. Abra Configurações para adicionar uma.`,
    });
    return;
  }

  const startedAt = Date.now();
  try {
    // provider.sendMessage entrega o texto ACUMULADO a cada onDelta (ver
    // providers/*.ts e seus testes); o canal chat:chunk existente espera um
    // delta INCREMENTAL (o renderer já faz `buffer += delta`) — a conversão
    // fica aqui pra não precisar tocar no contrato de IPC nem no renderer.
    let sent = "";
    const result = await provider.sendMessage({
      apiKey: apiKey ?? "",
      model,
      system,
      messages,
      onDelta: (buffer) => {
        const delta = buffer.slice(sent.length);
        sent = buffer;
        if (delta) sender.send("chat:chunk", { requestId, delta });
      },
    });

    sender.send("chat:done", { requestId, text: result.text });
    logModelRouterTelemetry({
      providerId,
      model,
      latencyMs: Date.now() - startedAt,
      success: true,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    sender.send("chat:error", { requestId, message });
    logModelRouterTelemetry({
      providerId,
      model,
      latencyMs: Date.now() - startedAt,
      success: false,
      error: message,
    });
  }
});

// --- IPC: provedores (ADR-0006 §7) ---
ipcMain.handle("providers:list", async () => {
  return Object.values(PROVIDER_REGISTRY).map((p) => ({ id: p.id, label: p.label, requiresApiKey: p.requiresApiKey }));
});

ipcMain.handle("providers:list-models", async (_event, providerId: string) => {
  const provider = getProvider(providerId);
  const apiKey = provider.requiresApiKey ? await getProviderKey(providerId) : undefined;
  return provider.listModels(apiKey);
});

ipcMain.handle("providers:validate-key", async (_event, providerId: string, apiKey: string) => {
  return getProvider(providerId).validateKey(apiKey);
});

ipcMain.handle("providers:save-key", async (_event, providerId: string, apiKey: string) => {
  await saveProviderKey(providerId, apiKey);
});

ipcMain.handle("providers:delete-key", async (_event, providerId: string) => {
  await deleteProviderKey(providerId);
});

ipcMain.handle("providers:has-key", async (_event, providerId: string) => {
  return hasProviderKey(providerId);
});

ipcMain.handle("providers:is-key-storage-secure", async () => {
  return isKeyStorageSecure();
});

ipcMain.handle("providers:get-active", async () => {
  return { providerId: await getActiveProvider(), model: await getActiveModel() };
});

ipcMain.handle("providers:set-active", async (_event, providerId: string, model: string) => {
  await setActiveProvider(providerId);
  await setActiveModel(model);
});

// --- IPC: TTS em nuvem (Azure AI Speech — ADR-0007) ---
ipcMain.handle("tts:save-config", async (_event, subscriptionKey: string, region: string) => {
  await saveTtsConfig(subscriptionKey, region);
});

ipcMain.handle("tts:delete-config", async () => {
  await deleteTtsConfig();
});

ipcMain.handle("tts:has-config", async () => {
  return hasTtsConfig();
});

ipcMain.handle("tts:validate", async (_event, subscriptionKey: string, region: string) => {
  return validateAzureSpeechConfig(subscriptionKey, region);
});

ipcMain.handle("tts:speak", async (_event, text: string) => {
  const config = await getTtsConfig();
  if (!config) {
    throw new Error("Azure Speech não configurado. Abra Configurações.");
  }
  return synthesizeSpeech({ ...config, text });
});
