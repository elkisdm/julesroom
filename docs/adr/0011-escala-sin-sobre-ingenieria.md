# 0011 — Escala: lo que NO se agrega en la v1

- **Estado:** Aceptado (2026-11-14)
- **Fecha:** 2026-11-14
- **Decisor:** Elkis

## Contexto

La escala real a 12 meses son cientos de equipos chicos. El tráfico pesado (audio y posiciones) ya está en LiveKit.

## Decisión

| Pieza | v1 | Se agrega cuando… |
| --- | --- | --- |
| Caché (Redis) | No | Una lectura caliente medida (p. ej. cargar el diseño de la oficina) pasa de 100 ms p95 con índices bien hechos |
| Réplicas de lectura | No | La base pasa de ~70 % de CPU por lecturas |
| Colas | Solo pg-boss, para webhooks de pago, abonos mensuales y limpieza | Un trabajo dentro del request pasa de ~1 s de forma sostenida |
| Timeouts | Sí, desde el día 1: 15 s al modelo, 10 s a los proveedores de pago, reconexión con espera creciente a LiveKit | — |
| Circuit breaker | No | Una caída del proveedor del modelo tumba otras partes de la API |
| Servidor propio de tiempo real | No | Ver triggers de 0006 |

## Consecuencias

Menos piezas que operar; cada una tiene una señal medible para entrar.

## Respaldo

`knowledge/adr/0008-estrategia-de-cache.md`, `knowledge/adr/0009-read-replicas-vs-cache.md`, `knowledge/adr/0010-queues-y-workers-para-escrituras.md`, `knowledge/adr/0011-timeouts-y-circuit-breakers.md`.
