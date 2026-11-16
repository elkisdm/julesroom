# agentes-lab (Jules Room)

Sala 3D (la Nave de la mañana) donde un equipo comparte el espacio con agentes de IA. Te acercas a un agente, ves «E · hablar con Dato», abres una burbuja anclada a su cabeza y la respuesta llega en streaming. Dato, Lienzo y Guía son agentes de ejemplo (`@oficina/agentes`).

## Cómo correrlo

```bash
pnpm --filter @oficina/agentes-lab servidor   # servidor Hono en 127.0.0.1:8791 (la clave vive en ~/.config/oficina-agentes/.env, solo la lee el servidor)
pnpm --filter @oficina/agentes-lab dev        # la sala en http://127.0.0.1:5329
pnpm --filter @oficina/agentes-lab test       # pruebas
```

El navegador solo habla con su propio origen: Vite reenvía `/api/*` al servidor (5329 → 8791).

## Protocolo (una línea)

`POST /api/agentes/:id/mensaje { conversacionId, texto, quien?, via? }` → `text/event-stream`; cada `data:` es un `EventoRespuesta` (`inicio`, `texto`, `fin`, `error`). También `GET /api/agentes`, `GET /api/salud`. Detalle en `docs/specs/agentes.md`.

## Qué viaja por presencia (y qué no)

Viaja (`PresenciaConversacion`, ver `packages/agentes/src/tipos.ts`): `agenteId`, `conPersonaId`, `estado` (`escuchando` | `pensando` | `respondiendo`) y `desde` (ms del último cambio, para expirar indicadores huérfanos: `expiro`, ttl 15 s).

No viaja: el contenido de la conversación, ni lo que escribes ni lo que responde el agente. Quien está cerca solo ve «conversando con <nombre>» sobre la cabeza del agente. El recuadro «Presencia: lo que viajaría» (arriba a la derecha) muestra el JSON de tu conversación actual. Una persona simulada (Camila) conversa con Lienzo en ciclos de 20 s para ver el indicador.

## Cómo se usa

- `W A S D` o clic: mover. `E`: hablar con el agente cercano (si el motor tiene a mano sentarse o abrir algo más cerca, `E` es suyo). `Enter`: escribir. `Esc`: cerrar.
- Barra «Escríbele a…»: `@` abre la lista de agentes; `@Nombre mensaje` le habla aunque esté lejos (la burbuja no se cierra al alejarte; si el agente queda fuera de pantalla, se ancla al borde con una flecha).
- Una conversación abierta por cercanía se cierra al alejarte.

## Parámetros (valores iniciales, en código)

| Dónde                                       | Qué                                                                       |
| ------------------------------------------- | ------------------------------------------------------------------------- |
| `src/proximidad.ts` `PARAMETROS_PROXIMIDAD` | radio de entrada 2,3 m, de salida 3,4 m, empate 0,3 m, evaluación a 10 Hz |
| `src/anclaje.ts` `PARAMETROS_ANCLAJE`       | margen 12 px, hueco sobre la cabeza                                       |
| `src/vidaAgente.ts` `PARAMETROS_VIDA`       | 1,5 s para que el agente vuelva a lo suyo tras cerrar                     |
| `src/presenciaSimulada.ts`                  | ciclo de la persona simulada (20 s), radio de la marca (9 m)              |
| `src/tipeo.ts` `PARAMETROS_TIPEO`           | velocidad del tipeo suave                                                 |
| definición del agente                       | `maxCaracteresEntrada` (600), `maxTokens`, `modelo`                       |

## Medición para automatizar

`window.__agentes`: `abrir(id)`, `cerrar()`, `enviar(texto)`, `mencionar(texto)`, `estado()`, `ultimaMedicion()` (`tPrimeraPalabraMs`, `tTotalMs`, tokens y `cacheLeida`), `avatar {x, y, z}`, `ir(x, z)`, `posicionesAgentes()`, `agentes`.

## Límites conocidos

El motor no expone la posición de un agente: se estima invirtiendo el `Proyector` (`src/proximidad.ts`). Para un agente sentado el error puede ser de unas decenas de centímetros (la raíz baja con la pelvis); no afecta a los radios usados.
