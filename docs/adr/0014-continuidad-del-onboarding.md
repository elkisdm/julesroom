# 0014 — Continuidad del onboarding sin modificar el motor

- **Estado:** Aceptado (2026-11-15)

## Contexto

Los pasos nuevos de sala y personaje conviven con capas antiguas. El motor de cámara y
controles se está ajustando en paralelo y tiene otros consumidores.

## Decisión

Cada paso conserva su interfaz y confirmación en `creacion/pasos`. `estadoFlujo.ts` concentra
validación, selección, navegación y parámetros de transición. El teclado se captura antes
de la activación nativa: Enter confirma el paso y Espacio activa el botón enfocado.

Las sugerencias permanecen en el borrador mientras se eligen; la selección se filtra para
la presentación final y al guardar. Así, quitar todos y volver atrás conserva las opciones.
En teléfono, la cámara reserva el alto medido de la hoja, tanto plegada como abierta.

`TransicionFlujo` mezcla la última pose de presentación con la cámara de seguimiento al
entrar. Antes del siguiente cuadro restaura la pose del motor para evitar realimentar la
interpolación. La duración y curva están compartidas con las capas CSS. Se respeta la
preferencia de movimiento reducido.

## Consecuencias

Los controles y el motor conservan su contrato. La capa de transición debe seguir montada
al final de los hijos de Oficina, después de sus controles. El nombre único identifica a
la persona y genera el nombre de sala. El enlace permanece explícitamente como ejemplo.

## Alternativas consideradas

- Cambiar el seguimiento del motor: invade archivos compartidos y afecta otros flujos.
- Borrar agentes del borrador al seleccionar: impide recuperarlos al volver atrás.
- Superponer una hoja de alto fijo: oculta figuras o falla al cambiar de ancho y texto.
