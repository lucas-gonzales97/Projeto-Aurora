// @aurora/core — núcleo cognitivo plataforma-agnóstico da Aurora (ADR-0016).
// Fase 1: persona/prompts + portas (VaultStore/LLMProvider) + retrieval triplo
// + get_context sobre a store abstrata. Próximo: reflexão; e fazer noesis-mcp/
// desktop implementarem VaultStore e delegarem pro Core.
export * from "./persona.js";
export * from "./ports.js";
export * from "./retrieval.js";
export * from "./getContext.js";
