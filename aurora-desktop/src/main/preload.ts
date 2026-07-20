import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

function on<T>(channel: string, cb: (data: T) => void) {
  const listener = (_event: IpcRendererEvent, data: T) => cb(data);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld("aurora", {
  chat: {
    send: (payload: unknown) => ipcRenderer.send("chat:send", payload),
    onChunk: (cb: (data: { requestId: string; delta: string }) => void) => on("chat:chunk", cb),
    onDone: (cb: (data: { requestId: string; text: string }) => void) => on("chat:done", cb),
    onError: (cb: (data: { requestId: string; message: string }) => void) => on("chat:error", cb),
  },
  mcp: {
    getContext: (intent: string) => ipcRenderer.invoke("mcp:get-context", intent),
    logEvent: (payload: unknown) => ipcRenderer.invoke("mcp:log-event", payload),
    createNote: (payload: unknown) => ipcRenderer.invoke("mcp:create-note", payload),
    createRelation: (payload: unknown) => ipcRenderer.invoke("mcp:create-relation", payload),
  },
  window: {
    close: () => ipcRenderer.send("window:close"),
    minimize: () => ipcRenderer.send("window:minimize"),
    toggleAlwaysOnTop: () => ipcRenderer.invoke("window:toggle-always-on-top") as Promise<boolean>,
  },
  onboarding: {
    isFirstRun: () => ipcRenderer.invoke("aurora:is-first-run") as Promise<boolean>,
  },
  providers: {
    list: () => ipcRenderer.invoke("providers:list"),
    listModels: (providerId: string) => ipcRenderer.invoke("providers:list-models", providerId),
    validateKey: (providerId: string, apiKey: string) => ipcRenderer.invoke("providers:validate-key", providerId, apiKey),
    saveKey: (providerId: string, apiKey: string) => ipcRenderer.invoke("providers:save-key", providerId, apiKey),
    deleteKey: (providerId: string) => ipcRenderer.invoke("providers:delete-key", providerId),
    hasKey: (providerId: string) => ipcRenderer.invoke("providers:has-key", providerId) as Promise<boolean>,
    isKeyStorageSecure: () => ipcRenderer.invoke("providers:is-key-storage-secure") as Promise<boolean>,
    getActive: () => ipcRenderer.invoke("providers:get-active") as Promise<{ providerId: string; model: string }>,
    setActive: (providerId: string, model: string) => ipcRenderer.invoke("providers:set-active", providerId, model),
  },
});
