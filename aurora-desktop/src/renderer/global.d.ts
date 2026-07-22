export {};

interface ChatContentBlock {
  type: "text" | "image";
  text?: string;
  mediaType?: string;
  base64?: string;
}

interface ChatSendPayload {
  requestId: string;
  system: string;
  messages: { role: "user" | "assistant"; content: ChatContentBlock[] }[];
}

interface AuroraBridge {
  chat: {
    send: (payload: ChatSendPayload) => void;
    onChunk: (cb: (data: { requestId: string; delta: string }) => void) => () => void;
    onDone: (cb: (data: { requestId: string; text: string }) => void) => () => void;
    onError: (cb: (data: { requestId: string; message: string }) => void) => () => void;
  };
  mcp: {
    getContext: (intent: string) => Promise<{ intent: string; entities: any[] }>;
    logEvent: (payload: { type: string; summary: string; entities?: string[]; data?: Record<string, unknown> }) => Promise<unknown>;
    createNote: (payload: {
      type: string;
      id: string;
      dir: string;
      status: string;
      created?: string;
      fields?: Record<string, unknown>;
      relations?: { target: string; kind: string; weight?: number; reason?: string; evidence?: string[] }[];
      body: string;
    }) => Promise<{ path: string; validation: string; warnings: string[] }>;
    createRelation: (payload: {
      source_id: string;
      target_id: string;
      kind: string;
      weight?: number;
      reason?: string;
      evidence?: string[];
    }) => Promise<unknown>;
  };
  window: {
    close: () => void;
    minimize: () => void;
    toggleAlwaysOnTop: () => Promise<boolean>;
  };
  onboarding: {
    isFirstRun: () => Promise<boolean>;
  };
  providers: {
    list: () => Promise<{ id: string; label: string; requiresApiKey: boolean }[]>;
    listModels: (providerId: string) => Promise<{ id: string; label: string; contextWindow?: number }[]>;
    validateKey: (providerId: string, apiKey: string) => Promise<{ valid: boolean; error?: string }>;
    saveKey: (providerId: string, apiKey: string) => Promise<void>;
    deleteKey: (providerId: string) => Promise<void>;
    hasKey: (providerId: string) => Promise<boolean>;
    isKeyStorageSecure: () => Promise<boolean>;
    getActive: () => Promise<{ providerId: string; model: string }>;
    setActive: (providerId: string, model: string) => Promise<void>;
  };
  tts: {
    saveConfig: (subscriptionKey: string, region: string) => Promise<void>;
    deleteConfig: () => Promise<void>;
    hasConfig: () => Promise<boolean>;
    validate: (subscriptionKey: string, region: string) => Promise<{ valid: boolean; error?: string }>;
    speak: (text: string) => Promise<{ audioBase64: string; mimeType: string }>;
  };
}

// Web Speech API — não faz parte do lib.dom.d.ts padrão do TypeScript.
interface SpeechRecognitionResultLike {
  transcript: string;
}
interface SpeechRecognitionEventLike extends Event {
  results: { [index: number]: { [index: number]: SpeechRecognitionResultLike; isFinal: boolean }; length: number };
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    aurora: AuroraBridge;
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}
