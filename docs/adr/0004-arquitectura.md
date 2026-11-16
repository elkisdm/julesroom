# 0004 — Arquitectura: monolito modular

- **Estado:** Aceptado (2026-11-14)
- **Fecha:** 2026-11-14
- **Decisor:** Elkis

## Contexto

Equipo de una persona (Elkis) con agentes. Ningún módulo tiene hoy tráfico 10× mayor que otro ni ciclos de release distintos.

## Decisión

Un solo servicio `apps/api` (Hono + oRPC), organizado por módulos de dominio con fronteras claras:

| Módulo | Responde |
| --- | --- |
| `cuentas` | organizaciones, miembros, invitaciones, sesión |
| `oficinas` | diseño de la oficina: salas, objetos, puestos, atuendos |
| `agentes` | agentes, versiones de prompt, conversaciones, llamada al modelo |
| `sala-en-vivo` | tokens de LiveKit, permisos por sala, tope de personas |
| `cobro` | planes, suscripciones, webhooks de pago, libro de créditos |
| `config` | lectura de configuración con valores por defecto en código |

Cada módulo tiene su router, su servicio y sus repos; un módulo no lee las tablas de otro, lo llama por su servicio. Capas ligeras: transporte → servicio → repo. Nada de hexagonal completo ni CQRS. El worker de pg-boss corre en el mismo código, como proceso aparte.

## Consecuencias

- Un solo deploy de API y una sola base. El tiempo real pesado (audio, posiciones) ya está fuera, en LiveKit, que es lo que más escalaría por separado.
- Las fronteras por módulo dejan la puerta abierta a extraer `cobro` o `agentes` si algún día lo pide uno de los criterios de la knowledge base.

## Respaldo

`knowledge/adr/0004-monolito-vs-microservicios.md` (monolito modular por defecto), `knowledge/adr/0005-cuando-aplicar-clean-hexagonal.md` (capas proporcionales), `knowledge/adr/0006-cuando-aplicar-cqrs.md` (sin CQRS sin asimetría real).
