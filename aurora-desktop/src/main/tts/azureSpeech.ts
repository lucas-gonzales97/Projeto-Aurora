import type { SynthesizeParams, SynthesizeResult, ValidateConfigResult } from "./types.js";

// Voz confirmada contra a doc oficial da Azure (ver ADR-0007) — é a mesma
// voz "Francisca" que o Narrator do Windows usa, só que acessível fora dele.
const DEFAULT_VOICE = "pt-BR-FranciscaNeural";
const OUTPUT_FORMAT = "audio-16khz-128kbitrate-mono-mp3";

function escapeSsml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildSsml(text: string, voice: string): string {
  return `<speak version='1.0' xml:lang='pt-BR'><voice xml:lang='pt-BR' xml:gender='Female' name='${voice}'>${escapeSsml(text)}</voice></speak>`;
}

// Endpoint cognitiveservices/v1 aceita a subscription key direto no header
// — ao contrário do Speech-to-Text, não precisa do passo de troca por um
// token via issueToken (ver ADR-0007 §1).
export async function synthesizeSpeech(params: SynthesizeParams): Promise<SynthesizeResult> {
  const voice = params.voice ?? DEFAULT_VOICE;
  const res = await fetch(`https://${params.region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": params.subscriptionKey,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": OUTPUT_FORMAT,
    },
    body: buildSsml(params.text, voice),
  });

  if (!res.ok) {
    const errText = await safeReadText(res);
    throw new Error(`Azure Speech: falha na síntese (${res.status}) ${errText}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  return { audioBase64: buffer.toString("base64"), mimeType: "audio/mpeg" };
}

// Mesmo padrão do validateKey dos providers de LLM: uma síntese real
// mínima, sem salvar nada — confirma key+region válidos antes do usuário
// gravar a config.
export async function validateAzureSpeechConfig(subscriptionKey: string, region: string): Promise<ValidateConfigResult> {
  try {
    await synthesizeSpeech({ subscriptionKey, region, text: "teste" });
    return { valid: true };
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function safeReadText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
