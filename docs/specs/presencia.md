# Presencia en vivo — brief (Tier 3)

Objetivo: dos o más personas reales, cada una en su navegador, se ven moverse y se oyen por cercanía en la misma sala. Decisión base: `docs/adr/0006-tiempo-real-y-voz.md` (LiveKit, una sala por oficina, posiciones por canal sin garantía ~10/s, voz por cercanía con suscripción selectiva, radio 4,5 m, tope 25).

## Contrato con el motor (no se toca `packages/oficina`)

`FuentePresencia { personas(); suscribir() }`, `PersonaPresente` (id, nombre, atuendo, x/y/z, rumbo, saltos?, estado?, asiento?). Las posiciones se escriben EN SITIO al llegar un paquete; el motor interpola (`render/remotas.ts`, retardo y pérdida). El propio llega por `AvatarPropio.alCambiar` (x, y, z, rumbo, velocidad, estado, asiento); los saltos propios salen de `mando.saltos`.

## Paquete `@oficina/presencia` (`packages/presencia`)

Lógica pura (TDD) + transporte:

- `codec.ts`: paquete de posición binario y versionado (19 bytes): versión u8, flags u8 (bit0 sentado), seq u16, x/y/z f32, rumbo u16 (0..2π), saltos u8 (envuelve). `codificar`/`decodificar` (rechaza versión desconocida y largo incorrecto); `seq` con comparación circular para descartar paquetes viejos.
- `emisor.ts`: cadencia de envío configurable (`hz`, por defecto 10): envía al ritmo si hay cambio; quieto, solo latido (`latidoHz`, 1); `guardiaVisibilidad`: pestaña oculta → pausa de envíos; tras `desconexionMin` (5) oculta → pide desconectar; al volver, reconectar.
- `voz.ts`: `planVoz(yo, otros, previo, config)` → suscritos + volumen por persona. Histéresis: entra a ≤ `radio` (4,5 m), sale a > `radio × 1,25`; misma sala cerrada (callback `salaDe`) también cuenta; volumen = curva que cae con la distancia (1 hasta 1 m, 0 en el radio de salida). Misma planta: la distancia cuenta `y`.
- `interes.ts`: gestión de interés LISTA PERO APAGADA (`habilitada: false`, umbral 50): `planEnvioInteres` decide a quién se envía a tasa completa (cerca) y a quién a tasa reducida (lejos) cuando hay más de N personas.
- `fuenteLiveKit.ts`: `FuentePresencia` sobre `livekit-client`: conecta (token/URL por configuración), publica estado propio por canal sin garantía (topic `pos`), cambios raros (nombre, atuendo, escenario, asiento) por metadatos del participante; entrada/salida de personas, reconexión (`Room` events), pestaña oculta. Voz: micrófono SOLO con gesto del usuario (`activarMicrofono()`), `autoSubscribe: false`, suscripción selectiva con `planVoz`, volumen por distancia, `hablandoIds` (Set mutable), silenciar propio y silenciar a otro.

## App `apps/sala` (puerto 5328)

Vite + React: entrar con nombre y apariencia rápida, `<Oficina>` con un escenario, avatar propio y la fuente real; enlace de sala; botón de micrófono; lista de cercanos con silenciar; panel de depuración (`window.__sala`) para pruebas. Servidor Hono mínimo (token de acceso firmado) montado en el propio Vite (mismo origen). Sin cuentas ni base de datos.

## Configuración (nada de claves en el repo)

`LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` por entorno (`apps/sala/.env.example`); sin ellas, solo en `localhost`/LAN usa las credenciales públicas del modo `--dev` de livekit-server. Valores operativos (hz, radio, histéresis, minutos oculta, tope 25) con valor inicial parametrizable.

## Ejecución

| Tarea                                                             | Quién      | Modelo |
| ----------------------------------------------------------------- | ---------- | ------ |
| T1 codec, emisor+guardia, voz, interés (puros, con pruebas)       | ejecutor   | sonnet |
| T2 servidor Hono de tokens + plugin Vite (con pruebas)            | ejecutor   | sonnet |
| T3 `fuenteLiveKit`, app `sala`, e2e Playwright, mediciones, video | mantenedor | —      |

## Verificación

Playwright con Chrome y GPU, dos contextos en la misma sala: A ve moverse a B; A recibe el audio de B solo cerca. Mediciones con 2, 5 y 25 clientes (ancho de banda, tasa efectiva, retraso extremo a extremo, CPU), también con red degradada. Video a 60 fps lado a lado.
