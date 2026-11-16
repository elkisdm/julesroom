# 0003 — Base de datos: un Postgres relacional y normalizado

- **Estado:** Aceptado (2026-11-14)
- **Fecha:** 2026-11-14
- **Decisor:** Elkis

## Contexto

Los datos son relacionales: equipos, miembros, oficinas, salas, muebles, agentes, conversaciones, saldos y pagos. Lo que más importa es la integridad, sobre todo en el dinero. El volumen esperado a 12 meses es chico: cientos de equipos, no millones de filas por segundo.

## Decisión

**Postgres** (la versión que ya corre en el VPS, 18 en Jules), con Drizzle y migraciones versionadas. El modelo inicial, normalizado:

- **Cuentas:** `organizacion` (el equipo, dueño de la suscripción), `miembro` (persona + rol: dueño, admin, miembro, invitado), `invitacion`. Son las tablas del plugin de organizaciones de better-auth.
- **Oficina:** `oficina` (una o más por organización), `sala`, `objeto` (mueble del catálogo + posición + rotación), `puesto` (asignación de persona o agente a un lugar), `atuendo` (vestuario por persona o agente).
- **Agentes:** `agente` (nombre, rol, oficina), `agente_prompt_version` (cada versión es una fila nueva; nunca se pisa), `conversacion`, `mensaje`.
- **Dinero:** `plan`, `suscripcion` (proveedor `mercadopago` | `hotmart`, id externo, estado), `movimiento_credito` (libro de solo inserción: abono mensual, compra, consumo, ajuste), `evento_pago` (webhook crudo con su id único para no procesarlo dos veces).
- **Configuración:** `config_global` y `config_organizacion` (ver 0009).

Reglas:
- Toda tabla de un equipo lleva `organizacion_id`.
- El saldo de créditos se calcula como la suma de `movimiento_credito`, en **milicréditos enteros** (un mensaje cuesta fracciones de crédito; nada de `float` para dinero).
- Índices solo por las consultas reales: `(organizacion_id, …)` en cada tabla de equipo y `(conversacion_id, creado_en)` en `mensaje`.
- La posición en vivo de las personas **no** se guarda en la base: vive en LiveKit (0006).

## Consecuencias

- Un solo motor de base para datos, colas (pg-boss) y configuración: un respaldo, una cosa que monitorear.
- El libro de créditos de solo inserción da auditoría gratis y evita saldos corruptos por escrituras concurrentes.
- Si el saldo calculado como suma se vuelve lento (muchos movimientos), se agrega una tabla de saldo materializado actualizada en la misma transacción; no antes.

## Respaldo

`knowledge/adr/0001-elegir-tipo-de-base-de-datos.md` (relacional por defecto), `knowledge/adr/0002-normalizar-vs-denormalizar.md` (normalizar primero), `knowledge/adr/0003-cuando-usar-indices.md` (índices por patrón de consulta).
