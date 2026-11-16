# 0008 — Planes y cobro: suscripción por oficina, créditos en un libro propio

- **Estado:** Aceptado (2026-11-14)
- **Fecha:** 2026-11-14
- **Decisor:** Elkis

## Contexto

Elkis cobra con Mercado Pago en Chile y con Hotmart fuera de Chile. En un producto anterior definió 1 crédito = USD 0,10 con un precio mínimo de 3× el costo. Decidió cobrar **por oficina**; los valores finos de los planes se modelan después, por rentabilidad.

## Decisión

- **El plan es por oficina (organización):** trae un número de puestos (personas que pueden entrar), un saldo mensual de créditos para todo el equipo y un tope de personas por sala. Se pueden comprar puestos y créditos extra.
- **Dos proveedores, un solo libro:** Mercado Pago (suscripciones) para Chile y Hotmart (producto de suscripción) para el resto. Los dos avisan por webhook; el módulo `cobro` verifica la firma, guarda el evento crudo en `evento_pago` (idempotente por id externo) y lo traduce a un estado de `suscripcion` y a movimientos de crédito. El resto del sistema no sabe qué proveedor se usó.
- **Créditos:** abono mensual al renovar (pg-boss), compras sueltas y consumo por mensaje de agente. Los créditos del mes no se acumulan (valor inicial configurable).
- **Valores iniciales, todos configurables desde el panel y nunca fijos en el código ni en env:**

| Parámetro                                                     | Valor inicial                                          |
| ------------------------------------------------------------- | ------------------------------------------------------ |
| Valor de 1 crédito                                            | USD 0,10                                               |
| Margen mínimo sobre el costo                                  | 3×                                                     |
| Costo de LiveKit por minuto-persona (para calcular el margen) | USD 0,0005                                             |
| Puestos, créditos mensuales y tope por sala por plan          | Por definir con Elkis al modelar la rentabilidad       |
| Precio en CLP                                                 | Se fija por plan en el panel (no se convierte en vivo) |

- **Si no hay pago:** al vencer, la suscripción pasa a un periodo de gracia (valor inicial 7 días); después la oficina queda en solo lectura y no se pierden datos.

## Planes (valores iniciales aprobados por Elkis el 2026-11-14)

Supuestos para el costo: una persona conectada 4 horas al día en promedio, 22 días (~USD 2,50 al mes en LiveKit), y 1 crédito = USD 0,10. Cada mensaje de agente descuenta **0,01 crédito** (10 milicréditos: ~3× su costo de ~USD 0,0003), así que 1 crédito alcanza para 100 mensajes.

| Plan                | Puestos | Créditos al mes | Tope por sala                | Precio USD/mes | Costo esperado | Margen |
| ------------------- | ------- | --------------- | ---------------------------- | -------------- | -------------- | ------ |
| Prueba (14 días)    | 3       | 20              | 10                           | 0              | ~USD 3         | —      |
| Equipo              | 5       | 100             | 25                           | 49             | ~USD 15,50     | ~3,2×  |
| Estudio             | 15      | 300             | 25                           | 149            | ~USD 46,50     | ~3,2×  |
| Empresa             | 50      | 1.000           | 25 (100 cuando esté probado) | 499            | ~USD 155       | ~3,2×  |
| Puesto extra        | +1      | —               | —                            | 10             | ~USD 2,50      | 4×     |
| Paquete de créditos | —       | +100            | —                            | 10             | ~USD 3         | ~3,3×  |

**Por ahora se cobra solo en pesos chilenos, con Mercado Pago.** Hotmart queda preparado en el diseño (mismo libro y otro traductor de webhook), pero no se construye hasta vender fuera de Chile.

Precios iniciales en CLP, **IVA incluido** (19 %), con el dólar a ~$980 (cierre del 6-nov-2026), redondeados hacia arriba para respetar el margen mínimo de 3× sobre el precio neto:

| Plan                    | Precio CLP/mes (con IVA) | Neto en USD | Margen neto               |
| ----------------------- | ------------------------ | ----------- | ------------------------- |
| Prueba (14 días)        | $0                       | —           | —                         |
| Equipo                  | $54.990                  | ~47         | ~3,0×                     |
| Estudio                 | $164.990                 | ~141        | ~3,0×                     |
| Empresa                 | $544.990                 | ~467        | ~3,0×                     |
| Puesto extra            | $9.990                   | ~8,6        | ~3,4×                     |
| Paquete de 100 créditos | $11.990 (pago único)     | ~10,3       | 1 crédito ≈ USD 0,10 neto |

Al cambiar el tipo de cambio o el costo de LiveKit, los precios se revisan en el panel; el margen se calcula siempre sobre el neto, sin IVA.

## Consecuencias

- Agregar un tercer medio de pago es escribir un traductor de webhook más.
- Dos proveedores implican dos verificaciones de firma y dos maneras de cancelar, que se prueban con eventos de ejemplo de cada uno.
- **Trigger:** vender fuera de Chile → construir el traductor de Hotmart y los precios en USD.

## Respaldo

`knowledge/adr/0012-donde-vive-cada-configuracion.md` (precios y topes en la base, por organización, con auditoría) y `knowledge/adr/0010-queues-y-workers-para-escrituras.md` (webhooks y abonos fuera del request).
