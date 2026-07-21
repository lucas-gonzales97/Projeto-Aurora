// tsconfig.main.json compila o main process pra module:"commonjs" (Electron
// main não é ESM). Nesse alvo, o TypeScript reescreve `await import(x)` em
// `require(x)` (downleveling) — o que quebra em runtime com ERR_REQUIRE_ESM
// pra qualquer dependência "type": "module"-only, como electron-store (v11)
// e @modelcontextprotocol/sdk. `new Function(...)` esconde a chamada
// `import()` da análise estática do compilador, então o `import()` real do
// V8/Node sobrevive até o runtime — mesmo workaround documentado pelo
// próprio electron-store para consumidores CommonJS.
const dynamicImport = new Function("specifier", "return import(specifier)") as (
  specifier: string
) => Promise<any>;

export default dynamicImport;
