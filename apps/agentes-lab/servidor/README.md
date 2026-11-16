# Servidor de agentes (puerto 8791)

Hono sobre `@hono/node-server`, solo en `127.0.0.1`. Protocolo en `docs/specs/agentes.md`.

- `app.ts`: `crearApp({ proveedor, equipo?, config?, ahora?, registroUso?, clave? })`. Sin red, se prueba con `app.request`.
- `config.ts`: valores iniciales parametrizables (límites, tope y TTL de conversaciones, CORS).
- `env.ts`: `leerClave(rutaEnv)` lee `ANTHROPIC_API_KEY` de `~/.config/oficina-agentes/.env` (o `apps/agentes-lab/.env`, o la ruta de `AGENTES_ENV`); nunca la imprime.
- `registroUso.ts`: una línea JSON por respuesta en `apps/agentes-lab/.uso/uso.jsonl` (ignorado por git).
- `main.ts`: arranque. Sin clave, el agente responde `sin-clave` en su voz.

Arranque: `pnpm --filter @oficina/agentes-lab servidor`. Pruebas: `pnpm test servidor` (usan el simulador, nunca la API real).
