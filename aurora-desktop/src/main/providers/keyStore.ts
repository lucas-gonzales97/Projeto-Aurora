import { safeStorage } from "electron";
import dynamicImport from "../esmImport.js";

// Persistência de API keys por provedor — ver
// decisions/ADR-0006-multi-provider-llm.md §4: a chave passa primeiro pelo
// safeStorage do Electron (cifra real, delegada ao cofre do SO) e só o
// resultado já cifrado é guardado via electron-store (que aplica sua própria
// encryptionKey por cima, como camada extra de ofuscação do arquivo — não é
// a proteção real, safeStorage é).

export interface KeyStoreBackend {
  get(key: string): string | undefined;
  set(key: string, value: string): void;
  delete(key: string): void;
}

const STORE_ENCRYPTION_KEY = "aurora-desktop-local-store-v1";

let backend: KeyStoreBackend | null = null;

async function getBackend(): Promise<KeyStoreBackend> {
  if (backend) return backend;
  // dynamicImport (não `await import` direto) — ver esmImport.ts: electron-store
  // v11 é ESM-only, e o `await import` normal seria rebaixado pro TS pra
  // `require()` sob module:"commonjs" (tsconfig.main.json), quebrando em
  // runtime com ERR_REQUIRE_ESM.
  const { default: Store } = await dynamicImport("electron-store");
  // O tipo de ElectronStore<T> (via Conf<T>) não resolve get/set/delete sob
  // a resolução de módulo deste projeto (mesma classe de colisão de tipos do
  // fetch/Response — ver readJson em types.ts) — a store real tem esses
  // métodos em runtime; só o assert resolve o gap de tipagem.
  const store = new Store({
    name: "aurora-provider-config",
    encryptionKey: STORE_ENCRYPTION_KEY,
  }) as unknown as KeyStoreBackend;
  backend = {
    get: (key) => store.get(key),
    set: (key, value) => store.set(key, value),
    delete: (key) => store.delete(key),
  };
  return backend;
}

// Só para testes — injeta um backend fake em vez do electron-store real.
export function __setBackendForTests(b: KeyStoreBackend | null): void {
  backend = b;
}

export async function saveProviderKey(providerId: string, apiKey: string): Promise<void> {
  const store = await getBackend();
  const value = safeStorage.isEncryptionAvailable()
    ? `enc:${safeStorage.encryptString(apiKey).toString("base64")}`
    : `plain:${apiKey}`;
  store.set(`providerKeys.${providerId}`, value);
}

export async function getProviderKey(providerId: string): Promise<string | undefined> {
  const store = await getBackend();
  const raw = store.get(`providerKeys.${providerId}`);
  if (!raw) return undefined;
  if (raw.startsWith("enc:")) {
    return safeStorage.decryptString(Buffer.from(raw.slice(4), "base64"));
  }
  if (raw.startsWith("plain:")) return raw.slice(6);
  return undefined;
}

export async function deleteProviderKey(providerId: string): Promise<void> {
  const store = await getBackend();
  store.delete(`providerKeys.${providerId}`);
}

// Só reporta presença — nunca devolve a chave em si pro chamador (a UI de
// Configurações usa isto pra mostrar "chave configurada: sim/não" sem nunca
// ecoar o segredo, ver ADR-0006 §6).
export async function hasProviderKey(providerId: string): Promise<boolean> {
  const store = await getBackend();
  return Boolean(store.get(`providerKeys.${providerId}`));
}

export function isKeyStorageSecure(): boolean {
  return safeStorage.isEncryptionAvailable();
}

const DEFAULT_ACTIVE_PROVIDER = "anthropic"; // ver ADR-0006 §"Anthropic (já implementado)"

export async function getActiveProvider(): Promise<string> {
  const store = await getBackend();
  return store.get("activeProvider") ?? DEFAULT_ACTIVE_PROVIDER;
}

export async function setActiveProvider(providerId: string): Promise<void> {
  const store = await getBackend();
  store.set("activeProvider", providerId);
}

export async function getActiveModel(): Promise<string> {
  const store = await getBackend();
  return store.get("activeModel") ?? "";
}

export async function setActiveModel(model: string): Promise<void> {
  const store = await getBackend();
  store.set("activeModel", model);
}

// Config do Azure Speech (TTS em nuvem, ver ADR-0007-tts-azure-speech.md) —
// reusa este mesmo store/backend (electron-store + safeStorage) em vez de
// um novo, é o mesmo "config local cifrada" que as chaves de provider LLM
// já usam, só um caso de uso diferente. Region não é segredo, fica em
// texto plano; a subscription key passa pelo mesmo enc:/plain: das chaves
// de provider.
export async function saveTtsConfig(subscriptionKey: string, region: string): Promise<void> {
  const store = await getBackend();
  const value = safeStorage.isEncryptionAvailable()
    ? `enc:${safeStorage.encryptString(subscriptionKey).toString("base64")}`
    : `plain:${subscriptionKey}`;
  store.set("tts.azureSpeech.key", value);
  store.set("tts.azureSpeech.region", region);
}

export async function getTtsConfig(): Promise<{ subscriptionKey: string; region: string } | undefined> {
  const store = await getBackend();
  const raw = store.get("tts.azureSpeech.key");
  const region = store.get("tts.azureSpeech.region");
  if (!raw || !region) return undefined;
  let subscriptionKey: string | undefined;
  if (raw.startsWith("enc:")) subscriptionKey = safeStorage.decryptString(Buffer.from(raw.slice(4), "base64"));
  else if (raw.startsWith("plain:")) subscriptionKey = raw.slice(6);
  if (!subscriptionKey) return undefined;
  return { subscriptionKey, region };
}

export async function deleteTtsConfig(): Promise<void> {
  const store = await getBackend();
  store.delete("tts.azureSpeech.key");
  store.delete("tts.azureSpeech.region");
}

// Mesma regra do hasProviderKey: só presença, nunca a chave em si.
export async function hasTtsConfig(): Promise<boolean> {
  const store = await getBackend();
  return Boolean(store.get("tts.azureSpeech.key")) && Boolean(store.get("tts.azureSpeech.region"));
}
