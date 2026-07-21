import { useEffect, useState } from "react";
import { C } from "./AuroraApp";

/* ============================================================
   Settings — tela de Configurações (ADR-0006 §6)
   Consome window.aurora.providers.* (src/main/index.ts + preload.ts,
   ver decisions/ADR-0006-multi-provider-llm.md). Não guarda nenhum
   segredo em estado além do rascunho de chave sendo digitado — a
   chave real fica só no main process via keyStore.ts (safeStorage).
   ============================================================ */

interface ProviderMeta {
  id: string;
  label: string;
  requiresApiKey: boolean;
}

interface ModelInfo {
  id: string;
  label: string;
  contextWindow?: number;
}

export default function Settings() {
  const [providers, setProviders] = useState<ProviderMeta[]>([]);
  const [active, setActive] = useState<{ providerId: string; model: string } | null>(null);
  const [secure, setSecure] = useState<boolean | null>(null);
  const [loadError, setLoadError] = useState("");

  async function refresh() {
    try {
      const [list, activeState, isSecure] = await Promise.all([
        window.aurora.providers.list(),
        window.aurora.providers.getActive(),
        window.aurora.providers.isKeyStorageSecure(),
      ]);
      setProviders(list);
      setActive(activeState);
      setSecure(isSecure);
      setLoadError("");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="overflow-y-auto h-full px-3 py-3">
      <p className="aur-mono" style={{ fontSize: 10, color: C.dim, marginBottom: 10 }}>
        provedores de LLM · a chave fica só neste dispositivo, nunca no vault/git
      </p>

      {secure === false && (
        <div
          style={{
            background: "rgba(217,123,108,0.12)",
            border: `1px solid ${C.danger}`,
            borderRadius: 10,
            padding: "9px 11px",
            marginBottom: 10,
          }}
        >
          <p style={{ color: C.danger, fontSize: 12, lineHeight: 1.45 }}>
            este sistema não tem um cofre de credenciais do SO disponível (safeStorage):
            as chaves salvas aqui não recebem a cifra real, só a ofuscação do arquivo.
            evite usar chaves de contas importantes nesta máquina.
          </p>
        </div>
      )}

      {loadError && (
        <p className="aur-mono" style={{ color: C.danger, fontSize: 12, marginBottom: 10 }}>
          falha ao carregar provedores: {loadError}
        </p>
      )}

      {providers.map((p) => (
        <ProviderRow
          key={p.id}
          provider={p}
          isActive={active?.providerId === p.id}
          activeModel={active?.providerId === p.id ? active.model : ""}
          onActivated={refresh}
        />
      ))}
    </div>
  );
}

function ProviderRow({
  provider,
  isActive,
  activeModel,
  onActivated,
}: {
  provider: ProviderMeta;
  isActive: boolean;
  activeModel: string;
  onActivated: () => void;
}) {
  const [hasKey, setHasKey] = useState(false);
  const [editingKey, setEditingKey] = useState(false);
  const [keyDraft, setKeyDraft] = useState("");
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  const [models, setModels] = useState<ModelInfo[]>([]);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [modelDraft, setModelDraft] = useState(activeModel);
  const [activating, setActivating] = useState(false);

  const [localStatus, setLocalStatus] = useState<"unknown" | "up" | "down">("unknown");
  const [checkingLocal, setCheckingLocal] = useState(false);

  const usable = !provider.requiresApiKey || hasKey;

  useEffect(() => {
    if (!provider.requiresApiKey) return;
    window.aurora.providers.hasKey(provider.id).then(setHasKey);
  }, [provider.id, provider.requiresApiKey]);

  useEffect(() => {
    setModelDraft(activeModel);
  }, [activeModel]);

  useEffect(() => {
    if (provider.requiresApiKey) return;
    checkLocal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider.id]);

  useEffect(() => {
    if (!usable || modelsLoaded) return;
    window.aurora.providers
      .listModels(provider.id)
      .then(setModels)
      .finally(() => setModelsLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usable]);

  async function checkLocal() {
    setCheckingLocal(true);
    try {
      // Ollama não pede chave — validateKey("") faz um GET real em /models,
      // que é exatamente "o servidor local está de pé?".
      const res = await window.aurora.providers.validateKey(provider.id, "");
      setLocalStatus(res.valid ? "up" : "down");
    } catch {
      setLocalStatus("down");
    } finally {
      setCheckingLocal(false);
    }
  }

  async function handleTest() {
    if (!keyDraft) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await window.aurora.providers.validateKey(provider.id, keyDraft);
      setTestResult(
        res.valid ? { ok: true, message: "chave válida" } : { ok: false, message: res.error ?? "chave inválida" }
      );
    } catch (err) {
      setTestResult({ ok: false, message: err instanceof Error ? err.message : String(err) });
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    if (!keyDraft) return;
    setSaving(true);
    try {
      await window.aurora.providers.saveKey(provider.id, keyDraft);
      setHasKey(true);
      setKeyDraft("");
      setEditingKey(false);
      setTestResult(null);
      setModelsLoaded(false); // recarrega modelos agora que há chave
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    await window.aurora.providers.deleteKey(provider.id);
    setHasKey(false);
    setModels([]);
    setModelsLoaded(false);
  }

  async function handleActivate() {
    if (!modelDraft) return;
    setActivating(true);
    try {
      await window.aurora.providers.setActive(provider.id, modelDraft);
      onActivated();
    } finally {
      setActivating(false);
    }
  }

  const inUse = isActive && modelDraft === activeModel && Boolean(modelDraft);

  return (
    <div
      style={{
        background: C.panel,
        border: `1px solid ${isActive ? C.phosphor : C.line}`,
        borderRadius: 12,
        padding: "11px 12px",
        marginBottom: 10,
      }}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="aur-display" style={{ color: C.bone, fontSize: 14, fontWeight: 600 }}>
          {provider.label}
        </span>
        {isActive && (
          <span
            className="aur-mono"
            style={{
              fontSize: 9.5,
              color: C.phosphor,
              border: `1px solid ${C.phosphor}`,
              borderRadius: 4,
              padding: "1px 6px",
            }}
          >
            ativo
          </span>
        )}
      </div>

      {!provider.requiresApiKey ? (
        <div className="flex items-center gap-2">
          <span
            className="aur-mono"
            style={{
              fontSize: 11,
              color: localStatus === "up" ? C.phosphor : localStatus === "down" ? C.danger : C.dim,
            }}
          >
            servidor local:{" "}
            {checkingLocal
              ? "verificando…"
              : localStatus === "up"
                ? "respondendo"
                : localStatus === "down"
                  ? "não respondendo"
                  : "desconhecido"}
          </span>
          <button
            onClick={checkLocal}
            disabled={checkingLocal}
            className="aur-mono"
            style={{
              background: "transparent",
              color: C.dim,
              border: `1px solid ${C.line}`,
              borderRadius: 6,
              padding: "2px 6px",
              fontSize: 10,
              cursor: checkingLocal ? "default" : "pointer",
            }}
          >
            checar de novo
          </button>
        </div>
      ) : hasKey && !editingKey ? (
        <div className="flex items-center gap-3">
          <span className="aur-mono" style={{ fontSize: 11, color: C.phosphor }}>
            chave configurada
          </span>
          <button
            onClick={() => setEditingKey(true)}
            className="aur-mono"
            style={{ background: "transparent", color: C.dim, border: "none", fontSize: 10.5, cursor: "pointer", textDecoration: "underline" }}
          >
            trocar
          </button>
          <button
            onClick={handleRemove}
            className="aur-mono"
            style={{ background: "transparent", color: C.danger, border: "none", fontSize: 10.5, cursor: "pointer", textDecoration: "underline" }}
          >
            remover
          </button>
        </div>
      ) : (
        <div>
          <div className="flex gap-2">
            <input
              type="password"
              value={keyDraft}
              onChange={(e) => {
                setKeyDraft(e.target.value);
                setTestResult(null);
              }}
              placeholder={`chave ${provider.label}`}
              style={{
                flex: 1,
                background: C.panelUp,
                color: C.bone,
                border: `1px solid ${C.line}`,
                borderRadius: 6,
                padding: "6px 8px",
                fontSize: 12.5,
                minWidth: 0,
                outline: "none",
              }}
            />
            <button
              onClick={handleTest}
              disabled={!keyDraft || testing}
              className="aur-mono"
              style={{
                background: "transparent",
                color: C.bone,
                border: `1px solid ${C.line}`,
                borderRadius: 6,
                padding: "6px 8px",
                fontSize: 11,
                cursor: keyDraft ? "pointer" : "default",
              }}
            >
              {testing ? "testando…" : "testar"}
            </button>
            <button
              onClick={handleSave}
              disabled={!keyDraft || saving}
              className="aur-display"
              style={{
                background: C.copper,
                color: "#1a120b",
                fontWeight: 600,
                border: "none",
                borderRadius: 6,
                padding: "6px 10px",
                fontSize: 11,
                cursor: keyDraft ? "pointer" : "default",
              }}
            >
              {saving ? "salvando…" : "salvar"}
            </button>
          </div>
          {testResult && (
            <p className="aur-mono" style={{ fontSize: 10.5, color: testResult.ok ? C.phosphor : C.danger, marginTop: 4 }}>
              {testResult.message}
            </p>
          )}
          {hasKey && editingKey && (
            <button
              onClick={() => {
                setEditingKey(false);
                setKeyDraft("");
                setTestResult(null);
              }}
              className="aur-mono"
              style={{ background: "transparent", color: C.dim, border: "none", fontSize: 10, cursor: "pointer", marginTop: 4, padding: 0 }}
            >
              cancelar
            </button>
          )}
        </div>
      )}

      {usable && (
        <div className="flex items-center gap-2 mt-2.5" style={{ borderTop: `1px solid ${C.line}`, paddingTop: 8 }}>
          <select
            value={modelDraft}
            onChange={(e) => setModelDraft(e.target.value)}
            style={{
              flex: 1,
              background: C.panelUp,
              color: C.bone,
              border: `1px solid ${C.line}`,
              borderRadius: 6,
              padding: "5px 6px",
              fontSize: 12,
              minWidth: 0,
            }}
          >
            <option value="" disabled>
              escolher modelo…
            </option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          <button
            onClick={handleActivate}
            disabled={!modelDraft || activating || inUse}
            className="aur-display"
            style={{
              background: inUse ? C.panelUp : C.phosphor,
              color: inUse ? C.dim : "#0C1517",
              fontWeight: 600,
              border: "none",
              borderRadius: 6,
              padding: "6px 10px",
              fontSize: 11,
              whiteSpace: "nowrap",
              cursor: modelDraft && !inUse ? "pointer" : "default",
            }}
          >
            {inUse ? "em uso" : activating ? "usando…" : "usar"}
          </button>
        </div>
      )}

      {provider.id === "gemini" && (
        <p className="aur-mono" style={{ fontSize: 9.5, color: C.dim, marginTop: 6, opacity: 0.85 }}>
          tier grátis do Gemini permite o Google usar suas mensagens pra treino —
          ver decisions/research-llm-providers.md
        </p>
      )}
    </div>
  );
}
