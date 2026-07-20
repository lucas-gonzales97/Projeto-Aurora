import { describe, it, expect, vi, beforeEach } from "vitest";

const safeStorageMock = {
  isEncryptionAvailable: vi.fn(),
  encryptString: vi.fn((s: string) => Buffer.from(`enc(${s})`)),
  decryptString: vi.fn((b: Buffer) => b.toString().replace(/^enc\(/, "").replace(/\)$/, "")),
};

vi.mock("electron", () => ({ safeStorage: safeStorageMock }));

const {
  saveProviderKey,
  getProviderKey,
  deleteProviderKey,
  hasProviderKey,
  isKeyStorageSecure,
  getActiveProvider,
  setActiveProvider,
  getActiveModel,
  setActiveModel,
  __setBackendForTests,
} = await import("./keyStore.js");

function fakeBackend() {
  const data = new Map<string, string>();
  return {
    get: (k: string) => data.get(k),
    set: (k: string, v: string) => void data.set(k, v),
    delete: (k: string) => void data.delete(k),
    _data: data,
  };
}

describe("keyStore", () => {
  beforeEach(() => {
    safeStorageMock.isEncryptionAvailable.mockReset();
    safeStorageMock.encryptString.mockClear();
    safeStorageMock.decryptString.mockClear();
  });

  it("encrypts via safeStorage before persisting when encryption is available", async () => {
    safeStorageMock.isEncryptionAvailable.mockReturnValue(true);
    const backend = fakeBackend();
    __setBackendForTests(backend);

    await saveProviderKey("groq", "sk-groq-123");
    expect(safeStorageMock.encryptString).toHaveBeenCalledWith("sk-groq-123");

    const stored = backend._data.get("providerKeys.groq")!;
    expect(stored.startsWith("enc:")).toBe(true);

    const roundTripped = await getProviderKey("groq");
    expect(roundTripped).toBe("sk-groq-123");
  });

  it("falls back to a plain (flagged) value when safeStorage encryption is unavailable", async () => {
    safeStorageMock.isEncryptionAvailable.mockReturnValue(false);
    const backend = fakeBackend();
    __setBackendForTests(backend);

    await saveProviderKey("groq", "sk-groq-123");
    const stored = backend._data.get("providerKeys.groq")!;
    expect(stored).toBe("plain:sk-groq-123");
    expect(await getProviderKey("groq")).toBe("sk-groq-123");
  });

  it("returns undefined for a provider with no stored key", async () => {
    safeStorageMock.isEncryptionAvailable.mockReturnValue(true);
    __setBackendForTests(fakeBackend());
    expect(await getProviderKey("mistral")).toBeUndefined();
  });

  it("deleteProviderKey removes the stored value", async () => {
    safeStorageMock.isEncryptionAvailable.mockReturnValue(true);
    const backend = fakeBackend();
    __setBackendForTests(backend);
    await saveProviderKey("groq", "sk-groq-123");
    await deleteProviderKey("groq");
    expect(await getProviderKey("groq")).toBeUndefined();
  });

  it("isKeyStorageSecure reflects safeStorage.isEncryptionAvailable()", () => {
    safeStorageMock.isEncryptionAvailable.mockReturnValue(true);
    expect(isKeyStorageSecure()).toBe(true);
    safeStorageMock.isEncryptionAvailable.mockReturnValue(false);
    expect(isKeyStorageSecure()).toBe(false);
  });

  it("hasProviderKey reports presence without exposing the key value", async () => {
    safeStorageMock.isEncryptionAvailable.mockReturnValue(true);
    __setBackendForTests(fakeBackend());
    expect(await hasProviderKey("groq")).toBe(false);
    await saveProviderKey("groq", "sk-groq-123");
    expect(await hasProviderKey("groq")).toBe(true);
  });

  it("defaults the active provider to anthropic and the model to empty when unset", async () => {
    __setBackendForTests(fakeBackend());
    expect(await getActiveProvider()).toBe("anthropic");
    expect(await getActiveModel()).toBe("");
  });

  it("persists the active provider and model once set", async () => {
    __setBackendForTests(fakeBackend());
    await setActiveProvider("groq");
    await setActiveModel("llama-3.3-70b-versatile");
    expect(await getActiveProvider()).toBe("groq");
    expect(await getActiveModel()).toBe("llama-3.3-70b-versatile");
  });
});
