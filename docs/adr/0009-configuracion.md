# 0009 — Dónde vive cada configuración

- **Estado:** Aceptado (2026-11-14)
- **Fecha:** 2026-11-14
- **Decisor:** Elkis

## Contexto

Regla de Elkis para todos sus productos: todo valor operativo (precios, topes, plazos, modelos, textos) se configura desde el panel, con un valor inicial; nunca fijo en el código ni en variables de entorno.

## Decisión

| Capa | Qué va |
| --- | --- |
| Código | Esquema de cada parámetro: tipo, rango válido y **valor por defecto** |
| Env / secretos | `DATABASE_URL`, clave de Anthropic de la plataforma, credenciales de LiveKit, Mercado Pago y Hotmart, clave maestra de cifrado, **modelos permitidos** |
| Config global en la base (`config_global`) | Valor del crédito, margen mínimo, costos de referencia, umbrales de LiveKit, frecuencia de posiciones, radio de voz, desconexión por inactividad, periodo de gracia, catálogo de planes |
| Config por organización (`config_organizacion`) | Lo que el plan o el dueño ajusta: tope por sala, invitados que gastan créditos, modelo por agente (dentro de los permitidos) |
| Datos | Oficinas, mensajes, pagos, movimientos |

Reglas: el valor por defecto está en el código y la base solo lo reemplaza; si la fila falta o es inválida, se usa el valor por defecto. Lo importante va en columnas con tipo y `CHECK` de rango. Cada cambio deja un registro de auditoría (valor anterior → nuevo, quién y cuándo). **Sin feature flags** hasta que haya un despliegue gradual real.

## Consecuencias

- Elkis cambia precios y topes sin un deploy, con registro de quién los cambió.
- Hace falta un panel de administración mínimo para `config_global`, que es parte de la v1.

## Respaldo

`knowledge/adr/0012-donde-vive-cada-configuracion.md`.
