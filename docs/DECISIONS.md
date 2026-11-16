# Decisiones de arquitectura — Jules Room

Resumen de los cimientos. El detalle y el razonamiento completo están en `docs/adr/`. Elkis las aceptó el 2026-11-14 (estado **Aceptado**). La tabla de planes también (solo CLP por ahora). Respaldo: la knowledge base de devground en `knowledge/` (ADR 0001–0012).

## Contexto

- **Producto:** Jules Room, una oficina 3D de código abierto que cada equipo arma a su gusto, con sus agentes, y comparte en vivo. Cualquiera puede instalarla; más adelante habrá una nube oficial para quien no quiera hacerlo ([ADR-0021](adr/0021-modelo-abierto.md)).
- **Bases:** el motor de la oficina de Jules (`packages/oficina`) y el escenario «Sala de trading», ambos de Elkis.
- **Escala esperada a 6–12 meses:** cientos de equipos chicos; cimientos para salas de hasta ~100 personas.
- **Equipo:** Elkis con agentes.
- **Restricciones:** todo valor operativo es configurable desde el panel; lo personal corre en el VPS con Coolify y los front en Vercel.

## Decisiones

| #   | Decisión            | Elección                                                                                                     | Por qué (resumen)                                                   | ADR                                                             |
| --- | ------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- | --------------------------------------------------------------- |
| —   | Nombre              | **Jules Room**                                                                                               | Lo eligió Elkis                                                     | —                                                               |
| 1   | Alcance v1          | Equipos en vivo, voz por cercanía, un personaje (el de Jules), agentes conversacionales, cursos fuera        | Lo social y visual diferencia; sin permisos ni herramientas todavía | [0001](adr/0001-alcance-version-1.md)                           |
| 2   | Stack               | Monorepo pnpm + TS: Next, Hono + oRPC, Drizzle, better-auth, pg-boss, R3F                                    | Mismo stack probado en Jules                                        | [0002](adr/0002-stack.md)                                       |
| 3   | Base de datos       | Un Postgres normalizado; créditos en un libro de solo inserción, en milicréditos                             | Datos relacionales y dinero exacto                                  | [0003](adr/0003-base-de-datos.md)                               |
| 4   | Arquitectura        | Monolito modular (cuentas, oficinas, agentes, sala-en-vivo, cobro, config)                                   | Una persona, un deploy                                              | [0004](adr/0004-arquitectura.md)                                |
| 5   | Auth y multi-tenant | better-auth con organizaciones; aislamiento por fila con `organizacion_id` de la sesión                      | Lo más simple de operar                                             | [0005](adr/0005-autenticacion-y-multi-tenant.md)                |
| 6   | Tiempo real y voz   | LiveKit Cloud: una sala por oficina, posiciones por canal de datos, audio por cercanía                       | Una sola pieza ya probada; escala por suscripción selectiva         | [0006](adr/0006-tiempo-real-y-voz.md)                           |
| 7   | Agentes y modelo    | Desde el servidor; créditos del plan por defecto, clave propia cifrada opcional; Haiku 5.5                   | Barato (~USD 0,0003 por mensaje) y controlado                       | [0007](adr/0007-agentes-y-modelo.md)                            |
| 8   | Planes y cobro      | Por oficina (puestos + créditos); solo CLP con Mercado Pago por ahora, Hotmart preparado                     | Un medio de pago más = un traductor más                             | [0008](adr/0008-planes-y-cobro.md)                              |
| 9   | Configuración       | Valor por defecto en el código, reemplazo en la base (global y por organización), secretos en env            | Regla de Elkis + ADR-0012                                           | [0009](adr/0009-configuracion.md)                               |
| 10  | Despliegue          | Web en Vercel (dominio de Vercel o subdominio de elkis.dev); API, worker y Postgres en el VPS con Coolify    | Costo fijo casi cero                                                | [0010](adr/0010-despliegue.md)                                  |
| 11  | Escala              | Sin caché, réplicas ni circuit breaker; pg-boss solo para trabajo de fondo                                   | YAGNI con triggers medibles                                         | [0011](adr/0011-escala-sin-sobre-ingenieria.md)                 |
| 12  | Formato de sala     | Una sala es un JSON versionado (`SalaGuardada`): plantilla, variante, objetos, ajustes de muebles, pantallas | Se guarda igual en el navegador, en un archivo y en el servidor     | [0012](adr/0012-formato-guardado-de-sala.md)                    |
| 13  | Carga de mundos     | Los tres mundos y sus variantes se preparan durante la llegada, en el mismo lienzo                           | Cambiar de sala sin pausas (antes hasta 200 ms)                     | [0013](adr/0013-preparar-mundos-en-el-canvas-del-onboarding.md) |
| 14  | Onboarding          | Un indicador de pasos y transiciones comunes; Enter siempre avanza, Esc vuelve                               | De la llegada a la sala como una sola experiencia                   | [0014](adr/0014-continuidad-del-onboarding.md)                  |
| 21  | Modelo abierto      | AGPL-3.0, todo el repositorio abierto, marca reservada, CLA para aportes, nube sin funciones exclusivas      | Abierto de verdad y con la nube futura protegida                    | [0021](adr/0021-modelo-abierto.md)                              |

## Costo de servir (estimado, a verificar en las páginas oficiales)

| Concepto                                                                 | Costo aproximado                                                 |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| Mensaje de agente (Haiku 5.5, ~2.000 tokens de entrada y ~200 de salida) | ~USD 0,0003                                                      |
| Persona conectada en LiveKit Cloud                                       | ~USD 0,0005 por minuto → ~USD 5 al mes con 8 h diarias y 22 días |
| VPS y Vercel                                                             | ya pagados / capa gratuita                                       |

Lo que más pesa es el tiempo conectado, no los agentes: el precio por puesto tiene que cubrirlo.

## Triggers de re-evaluación

| Decisión                       | Re-evaluar cuando…                                                                                 |
| ------------------------------ | -------------------------------------------------------------------------------------------------- |
| LiveKit Cloud → propio         | La factura de LiveKit pase de USD 100 al mes (valor inicial)                                       |
| Tiempo real a más escala       | Una sala pase de ~50 personas con lag medido, o se pidan salas de más de 100                       |
| Row Level Security             | Un cliente exija aislamiento fuerte o aparezca una fuga entre equipos                              |
| Saldo materializado            | Calcular el saldo como suma pase de 50 ms p95                                                      |
| Caché                          | Cargar una oficina pase de 100 ms p95 con índices bien hechos                                      |
| Réplicas / VPS más grande      | Base o API sobre ~70 % de CPU sostenido                                                            |
| Microservicios                 | Se cumpla un criterio de `knowledge/adr/0004` (tráfico 10×, releases distintos, equipos separados) |
| Agentes con herramientas o voz | Se decida sumarlos: revisar costos y el cerebro de riesgo de Jules                                 |

## Pendiente con Elkis

Nada para los cimientos. La tabla de planes en CLP (con IVA incluido) está en [0008](adr/0008-planes-y-cobro.md).
