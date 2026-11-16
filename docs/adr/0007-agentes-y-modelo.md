# 0007 — Agentes conversacionales y conexión al modelo: créditos del plan o clave propia

- **Estado:** Aceptado (2026-11-14)
- **Fecha:** 2026-11-14
- **Decisor:** Elkis

## Contexto

En la v1 los agentes conversan: responden y resumen cuando alguien les habla. El servidor de órdenes del laboratorio de Jules ya resuelve esto con Claude Haiku, un tope de uso, un timeout de 15 s, detección de inyección y una frase local si algo falla.

## Decisión

- **Toda llamada al modelo sale del servidor** (módulo `agentes`), nunca del navegador.
- **Dos formas de pagar el modelo:**
  1. **Créditos del plan (por defecto):** usa la clave de Anthropic de Jules Room y descuenta del libro de créditos de la organización.
  2. **Clave propia (opcional):** el dueño pega su clave de Anthropic, que se guarda cifrada con AES-256-GCM (el patrón de `cifrado.ts` de Jules), se descifra solo al llamar y nunca vuelve al cliente. Esos mensajes no descuentan créditos de modelo.
- **No se conecta la suscripción Pro/Max** de Claude o ChatGPT de la persona: los términos de los proveedores no permiten usarla desde un producto de terceros. Antes de cerrar este ADR se verifica el texto vigente.
- **Modelo:** Claude Haiku 5.5 como valor inicial. Los modelos permitidos están en env; el que usa cada agente se elige en la config de la base dentro de esa lista.
- **Prompt:** dos bloques, uno fijo y cacheable (rol y personalidad, versionados en `agente_prompt_version`) y uno variable (la conversación reciente). Respuesta corta, con un tope de tokens configurable (valor inicial 300).
- **Protecciones:** detección de inyección antes del modelo, timeout de 15 s, tope de mensajes por organización y por ventana (configurable), y respuesta local con aviso si no hay saldo o el modelo falla.
- **Qué ve la sala:** la respuesta del agente se guarda en `mensaje` y se anuncia por el canal de datos de LiveKit, así quienes están cerca la ven en una burbuja.

### Cuánto cuesta servirlo (estimado, a verificar en la página de precios de Anthropic)

Haiku 5.5 a ~USD 0,10 por millón de tokens de entrada y ~USD 0,50 por millón de salida. Un mensaje típico (~2.000 de entrada y ~200 de salida) cuesta ~**USD 0,0003**. Con 1 crédito = USD 0,10 y margen mínimo de 3×, un crédito alcanza para unos 100 mensajes. El costo real de cada llamada (los tokens que informa la API) se guarda en el movimiento.

## Consecuencias

- El costo de los agentes es bajo y predecible, y el riesgo de abuso lo acotan los topes.
- La clave propia suma un secreto por organización que hay que cuidar: cifrado, nunca en logs y rotación de la clave maestra documentada.
- **Trigger:** cuando los agentes ganen herramientas o voz propia (ElevenLabs), se revisan el costo por mensaje y el cerebro de riesgo y aprobación de Jules.

## Respaldo

`knowledge/adr/0011-timeouts-y-circuit-breakers.md` (timeout y respuesta de reserva) y `knowledge/adr/0012-donde-vive-cada-configuracion.md` (modelos permitidos en env, modelo elegido en la base, prompts versionados).
