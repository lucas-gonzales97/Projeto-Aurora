// Contrato do módulo de TTS em nuvem (Azure AI Speech) — ver
// decisions/ADR-0007-tts-azure-speech.md. A voz local do navegador
// (window.speechSynthesis, em AuroraApp.tsx) continua existindo como
// fallback quando este não está configurado — não foi substituída, só
// deixou de ser a única opção.

export interface AzureSpeechConfig {
  subscriptionKey: string;
  region: string; // ex.: "brazilsouth" — igual ao campo "Location/Region" do recurso no Azure Portal
}

export interface SynthesizeParams extends AzureSpeechConfig {
  text: string;
  voice?: string; // default: pt-BR-FranciscaNeural
}

export interface SynthesizeResult {
  audioBase64: string;
  mimeType: string;
}

export interface ValidateConfigResult {
  valid: boolean;
  error?: string;
}
