# 0006 — Tiempo real y voz: LiveKit Cloud, una sala por oficina, suscripción por cercanía

- **Estado:** Aceptado (2026-11-14)
- **Fecha:** 2026-11-14
- **Decisor:** Elkis

## Contexto

La v1 comparte la oficina en vivo: cada persona ve moverse a las demás y habla con quien tiene cerca. Hay que dejar cimientos para salas de hasta ~100 personas sin construir ese nivel ahora. LiveKit ya está probado en Jules (agentes de voz).

## Decisión

- **Transporte único: LiveKit Cloud.** Voz (WebRTC) y estado efímero (posición, hacia dónde mira, quién habla, burbujas de chat) van por la misma conexión; los datos usan los mensajes de datos de LiveKit. No hay servidor propio de WebSockets.
- **Una sala de LiveKit por oficina**, con nombre `org:<id>:oficina:<id>`.
- **Posiciones:** cada cliente publica la suya a ~10 por segundo (valor inicial configurable) en un canal sin garantía de entrega y con interpolación en el receptor. El diseño de la oficina **no** viaja por aquí: se lee de la API y, cuando un admin lo cambia, llega un aviso para recargarlo.
- **Voz por cercanía con suscripción selectiva:** cada cliente se suscribe solo al audio de quienes están dentro de su radio (valor inicial 4,5 m, tomado como idea de la demo) o de su misma sala cerrada. Así 100 personas no son 100×100 flujos de audio.
- **Conexión solo cuando hace falta:** el cliente se conecta mientras la oficina está abierta y visible, y se desconecta tras N minutos oculta (valor inicial 5), porque LiveKit Cloud cobra por minuto conectado.
- **Tope de personas por sala:** configurable por plan, con un valor inicial de 25. El objetivo de diseño es 100.

### Cuánto cuesta servirlo (estimado, a verificar en livekit.com/pricing antes de fijar precios)

Unos USD 0,0005 por persona y minuto conectado. Una persona conectada 8 horas al día y 22 días al mes son ~10.500 minutos, unos **USD 5 al mes**. El precio por puesto tiene que cubrir eso.

## Consecuencias

- Una sola pieza de infraestructura para voz y presencia, la misma que Jules, y la cámara se suma después sin cambiar el transporte.
- Depender de LiveKit Cloud tiene costo variable, y el tope por sala y la desconexión por inactividad lo acotan.
- **Triggers:**
  - si la factura de LiveKit pasa **USD 100 al mes** (valor inicial), se evalúa LiveKit propio en el VPS;
  - si una sala pasa de ~50 personas con lag medido, se agrega gestión de interés (posiciones solo de quienes están cerca) y salas de LiveKit por zona;
  - si se piden salas de más de 100, se revisa la arquitectura de tiempo real completa.

## Respaldo

`knowledge/adr/0007-serverless-vs-servidor-dedicado.md` (las conexiones persistentes no van en serverless) y `knowledge/adr/0011-timeouts-y-circuit-breakers.md` (reconexión con espera creciente). La elección de LiveKit es criterio general más lo probado en Jules.
