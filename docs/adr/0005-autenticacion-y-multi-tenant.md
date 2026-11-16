# 0005 — Autenticación y multi-tenant: better-auth con organizaciones, aislamiento por fila

- **Estado:** Aceptado (2026-11-14)
- **Fecha:** 2026-11-14
- **Decisor:** Elkis

## Contexto

La v1 es para equipos: un dueño paga, invita a su gente y a invitados de un día. Cada equipo ve solo lo suyo. Jules ya usa better-auth, aunque con passkey de un solo usuario.

## Decisión

- **better-auth** con correo + enlace mágico y Google como métodos de entrada, y passkey opcional. Se usa su **plugin de organizaciones** (organización = equipo, con roles e invitaciones).
- **Inquilino = organización.** Todas las tablas de un equipo llevan `organizacion_id` en la misma base y el mismo esquema.
- **El aislamiento se aplica en un solo lugar:** cada repo recibe el `organizacion_id` de la sesión (nunca del cliente) y lo agrega a cada consulta. Hay una prueba por repo que verifica que un equipo no lee datos de otro.
- **Roles iniciales:** dueño (cobro y todo lo demás), admin (edita la oficina y los agentes), miembro (entra, habla, usa agentes), invitado (entra a la oficina compartida; no edita ni gasta créditos, salvo que el dueño lo permita en la config).
- **Tokens de LiveKit:** solo la API los emite, con la identidad del miembro y la sala; nunca se arman en el cliente.

## Consecuencias

- Una base para todos los equipos es lo más simple de operar y de migrar.
- El riesgo de esta opción es olvidar el filtro en una consulta, y eso lo cubren la prueba por repo y que el `organizacion_id` venga siempre de la sesión.
- **Trigger:** si entra un cliente con requisito de aislamiento fuerte (datos sensibles, contrato) o aparece un bug de fuga entre equipos, se agrega Row Level Security de Postgres como segunda barrera.

## Respaldo

`knowledge/adr/0012-donde-vive-cada-configuracion.md` («multi-tenant = fila por organización»). Elegir el proveedor de autenticación no está en la knowledge base: va con criterio general y con lo ya probado en Jules.
