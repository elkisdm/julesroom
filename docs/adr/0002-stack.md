# 0002 — Stack: TypeScript en un monorepo pnpm, igual que Jules

- **Estado:** Aceptado (2026-11-14)
- **Fecha:** 2026-11-14
- **Decisor:** Elkis

## Contexto

El motor 3D (`packages/oficina`) es React Three Fiber y TypeScript. Jules ya probó en producción, en el VPS de Elkis, un stack completo alrededor de ese motor. Elkis pidió el mismo.

## Decisión

Monorepo pnpm con TypeScript estricto:

| Pieza | Elección | Ubicación |
| --- | --- | --- |
| Motor 3D | React Three Fiber (`@react-three/fiber`, `drei`), ya existente | `packages/oficina` |
| Front | Next.js (App Router) | `apps/web` |
| API | Hono + oRPC (contrato tipado de punta a punta) | `apps/api` |
| Datos | Drizzle ORM + Postgres | `apps/api/src/db` |
| Autenticación | better-auth | `packages/auth` |
| Tareas de fondo | pg-boss (usa el mismo Postgres) | `apps/api` |
| Tiempo real y voz | LiveKit (SDK de cliente y `livekit-server-sdk` para tokens) | ver 0006 |
| Modelo de los agentes | API de Anthropic llamada desde el servidor | ver 0007 |
| Pruebas | Vitest; Postgres de prueba sin fsync, una base por proceso | — |

`apps/lab` (Vite) queda como laboratorio del motor y no es el producto. Los linters, los hooks y el ratchet de cobertura los instala `devground-init` en la rama de «oficina-motor».

## Consecuencias

- Cero piezas nuevas que aprender: se reusan `packages/auth`, el patrón de `apps/api` y el cifrado de columnas de Jules.
- Next en Vercel no mantiene conexiones persistentes. El tiempo real va por LiveKit y no por Next, así que no hay conflicto.
- No se copian `packages/cerebro` ni la carta de identidad de Jules tal cual: son de un solo usuario. Se toma lo genérico (detección de inyección, topes) al construir los agentes.

## Respaldo

`knowledge/BEST-PRACTICES.md` (stack por madurez y por fit con el equipo, no por moda) y `knowledge/adr/0007-serverless-vs-servidor-dedicado.md` (modelo híbrido: front serverless y API en servidor dedicado).
