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
  };
  window: {
    close: () => void;
    minimize: () => void;
    toggleAlwaysOnTop: () => Promise<boolean>;
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
