# Agentes que conversan (brief, Tier 3)

Rama `feat/agentes-conversan`. Zona: `packages/agentes/`, `apps/agentes-lab/`. ADR 0001 (alcance), 0007 (modelo), 0008 (créditos: solo se mide).

## Qué es

Acercarse a un agente en la sala, ver «E · hablar», abrir una burbuja anclada al agente, escribir, recibir la respuesta en streaming, ver que el agente te mira y gesticula, cerrar al alejarse. Los demás ven que conversa y con quién (indicador, no contenido).

## Decisiones

- Modelo `claude-haiku-5-5` por agente (configurable), `thinking: disabled`, `max_tokens` 300 por agente, streaming, prompt de sistema con `cache_control` (el bloque fijo; lo variable va en los mensajes). Haiku 5.5 exige ~el mínimo cacheable: se verifica con `usage.cache_read_input_tokens`.
- La clave vive en `~/.config/oficina-agentes/.env` (fuera del repo; `apps/agentes-lab/.env` sirve de respaldo) y solo la lee el servidor. El navegador habla con `/api` (proxy de Vite → 8791).
- Entradas de usuario = datos: se limpian, se acotan, se marcan si parecen inyección (telemetría, no barrera: el agente sigue en personaje) y van entre `<mensaje_usuario>`; el prompt de sistema dice que ahí dentro nunca hay instrucciones.
- Memoria corta: últimos N mensajes completos + resumen determinista de lo anterior (sin llamada extra al modelo).
- Errores con salida digna: `sin-clave`, `sin-red`, `limite`, `cortada`, etc. → frase en la voz del agente (evento `error`), la sala sigue.
- Cercanía: el motor aún no expone la posición de un agente; se estima con el proyector (escala px/m de agente y avatar comparadas). Pedido al motor registrado en el tablero.

## Protocolo del servidor (puerto 8791)

- `GET /salud` → `{ ok, clave: boolean, modelo }`
- `GET /agentes` → `[{ id, nombre, rol, ejemplo, saludo }]`
- `POST /agentes/:id/mensaje` body `{ conversacionId: string, texto: string, quien?: string, via?: 'cerca'|'mencion' }` → `text/event-stream`, cada `data:` es un `EventoRespuesta` JSON. Estados HTTP: 200 normal (incluye errores del modelo como evento), 400 cuerpo inválido, 413 demasiado grande, 429 límite (cuerpo = un evento `error`).
- `GET /uso` → totales (llamadas, tokens) y por conversación; `GET /agentes/:id/uso/:conversacionId`.
- Límites (valores iniciales en `servidor/config.ts`, inyectables): cuerpo 4 KB, texto 600 caracteres, 12 mensajes/min por conversación y 40/min por origen.

## Ejecución (ADR-0040)

1. T1 `ejecutor` (sonnet): `packages/agentes` completo con TDD (prompt, cuarentena, memoria, errores en voz, simulador, conversación, proveedor Claude, ejemplos).
2. T2 `ejecutor` (sonnet): servidor Hono en `apps/agentes-lab/servidor/` con pruebas (proveedor simulado).
3. T3 `ejecutor` (sonnet): la sala y la conversación en `apps/agentes-lab/src/`.
4. Yo: integración, navegador real, video 60 fps, mediciones y cierre.
