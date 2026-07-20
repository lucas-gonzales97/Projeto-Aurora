import { safeStorage } from "electron";

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
  const { default: Store } = await import("electron-store");
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
