# Aurora Mobile — MVP v0

Roda a Aurora no celular (chat + memória do vault via `get_context`), servida por
um servidor headless que reusa o `noesis-mcp` e a persona do desktop. É a semente
do sync da Frente 7.

## O que já funciona
- Chat com a Aurora, streaming em tempo real.
- **Memória viva**: cada mensagem consulta o MESMO vault do desktop (retrieval
  triplo, ADR-0010) — verificado: "freelance" acende `goal-renda-extra-freelance`.
- UI mobile com o Design System (vidro, aurora-glow, respiro, shimmer).
- Token bearer protegendo o acesso.

## O que NÃO tem ainda (v0 honesto)
- Persistência de histórico compartilhada com o desktop (chat.db) — próximo passo.
- Voz, imagem, abas Mente/Painel — só chat no v0 (prioridade de maior uso).
- Roteamento multi-modelo (Model Router, Frente A) — usa um modelo fixo por env.

## Rodar (no desktop onde está o vault)

Pré (uma vez): buildar o noesis-mcp e o Aurora Core (ADR-0016) — o servidor
importa `get_context` de um e a persona do outro:
```bash
cd noesis-mcp && npm run build && cd ..
cd aurora-core && npm run build && cd ..
```

```bash
# PowerShell
$env:AURORA_OPENROUTER_KEY="sk-or-..."   # SUA chave (o agente não a manuseia)
$env:AURORA_TOKEN="escolha-um-segredo"    # opcional; senão o server gera e imprime
$env:AURORA_MODEL="inclusionai/ling-3.0-flash:free"  # opcional
node aurora-mobile/server.mjs
```

O servidor imprime o token, o modelo e se o vault está ON.

## Chegar no celular (escolha uma — em ordem de segurança)

1. **Mesma rede (LAN):** se o celular estiver na MESMA rede do desktop, abra
   `http://<IP-do-desktop>:8787`. (Não serve para celular em casa + desktop na
   empresa.)
2. **Tailscale (recomendado):** instale Tailscale no desktop e no celular (mesma
   conta). O celular abre `http://<IP-tailscale-do-desktop>:8787`. Privado,
   cifrado, sem expor nada à internet pública.
3. **Túnel (último caso):** `cloudflared tunnel --url http://localhost:8787` dá
   uma URL pública. ⚠️ Isso **expõe o servidor à internet** — o token protege,
   mas prefira Tailscale. Não compartilhe a URL nem o token.

No celular: abra a URL → cole o token → conversar. "Adicionar à tela inicial"
deixa com cara de app.

## Segurança
- O servidor guarda **sua** chave do OpenRouter (via env, nunca commitada).
- Todo acesso exige o token bearer.
- `AURORA_HOST` é `0.0.0.0` para Tailscale/LAN alcançarem; combine com o token e,
  de preferência, uma rede privada (Tailscale), não túnel público.
