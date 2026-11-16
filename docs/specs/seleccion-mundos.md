# Seleccionar mundos en la creación

Clasificación: feat/perf · mediano · riesgo medio · Tier 2. Origen: Encargo D.

## Objetivo y alcance

Comparar tres escenarios vivos con miniaturas reales, vuelo corto, datos derivados y variantes.
Archivos verificados: Crear.tsx y Entrada.tsx (conexión mínima), crear.css (retirar selector anterior).
Archivos nuevos: pasos/ElegirMundo.tsx, mundos.css, mundos.ts, mundos.test.ts,
EscenaMundos.tsx. No se edita el motor ni archivos reservados. Ruta: crear.html, puerto 5331.

## Contratos y escenarios

- Dada la lista ordenada, flechas y deslizamiento recorren circularmente; Enter confirma y Esc vuelve.
- Dado cualquier escenario, nombre, puestos, niveles y zonas salen de su contrato actual.
- Dadas cero/una variantes, no hay control; un id inválido cae a la primera.
- Dadas tres precargas, solo tres éxitos producen 100%; un error termina sin bloquear y se informa.
- Dado movimiento reducido, el vuelo se resuelve sin animación.
- Dado un teléfono, escena y selector ocupan regiones separadas; textos y foco caben a 320 px.

## Diseño y ejecución

Ejecución local por instrucción opt-in de AGENTS: pruebas rojas → lógica → UI y puente Canvas → verificación.
Se aprovecha children de Oficina, useThree y compileAsync en su propio renderer, sin otra identidad visual.
La llegada recorre las plantillas y conserva sus renders como miniaturas. El vuelo reutiliza encuadreGeneral.
La variante elegida vive por plantilla en Crear y se pasa a Oficina; persistencia fuera de alcance.
Valores de movimiento y dimensiones agrupados en parámetros y variables CSS.

## Pre-mortem

Caminos: llegada, selección, vuelta y continuación cubiertos; carga de sala guardada conserva flujo existente.
Fallas: compilación rechazada o lenta termina con aviso y permite continuar; GPU no disponible requiere salida usable.
Invariantes: progreso por éxitos, navegación circular, datos actuales y fallback de variante → mundos.test.ts.
Simetrías: clic, teclado y toque llaman la misma selección.
Reutilización: PLANTILLAS, datos del escenario, encuadreGeneral, tokens y botones de crear.css.
Consumidores: Entrada recibe precarga/miniaturas/variante; Crear alimenta Oficina; guardado externo pendiente de integración.
Datos reales: variantes con paleta parcial, puestos extra excluidos y niveles del contrato.
Variantes: movimiento reducido, anchos 1440/390/320; sin dependencias ni APIs de pago.
Afirmaciones: no se afirma persistencia ni producción. Se documentan límites reales de la precarga.

## Definition of Ready

Objetivo verificable, rutas confirmadas, dependencias instaladas; NFR: rendimiento, accesibilidad, resiliencia.

## Verificación prevista

Solo mundos.test.ts (máximo 4 trabajadores), typecheck y lint de lab. Playwright Chrome/Metal,
capturas inspeccionadas en una carpeta local. Revisión explícita del diff
(el comando de revisión de Claude no está disponible). No commit, push ni despliegue.

## Cierre y evidencia

- Navegación/teclado/toque, datos mutables, fallback de estilos y muestras de luz: `mundos.test.ts`.
- Progreso y fallo parcial: prueba unitaria y fallo de GPU inyectado en Playwright; termina en 67 %, aviso visible y Enter continúa.
- Cámara, órbita y movimiento reducido: pruebas puras; capturas con Chrome/Metal y escenario de fallo con `reducedMotion: reduce`.
- 13 pruebas propias verdes. Typecheck y lint de `@oficina/lab` verdes; `git diff --check` sin errores.
- Se inspeccionaron los tres mundos a 1440×900, 390×844 y 320×640, más variantes y estado de fallo.
- Se corrigieron el contraste del encabezado y el espacio del aviso de fallo. No hubo errores de página ni desborde horizontal en el recorrido final.
- Medición local en Chrome/Metal, seis cambios: p95 17 ms; máximos 17–33 ms, frente a hasta 200 ms al reconstruir la mansión.
- Revisión explícita del diff realizada sin delegación: se mantienen los archivos reservados intactos y se retira el selector reemplazado.
- La suite completa y la cobertura global quedan para quien integra por el alcance explícito del encargo.
- Evidencia en la carpeta de capturas solicitada, que prevalece sobre el destino global de evidencia.

### Integración y límites

El banco conserva también las variantes, no solo los programas: la comparación dibuja escenas ya
montadas, sin reconstruir el mundo activo. Más memoria GPU mientras la página está abierta es el
costo de esa decisión (ADR-0013). Los mundos de la selección no llevan ocupantes; las pantallas sí
siguen vivas. Los agentes aparecen en los pasos siguientes. No se editaron archivos del motor.

Al integrarse con el modo construir, la variante quedó con UNA sola fuente: `sala.mundo.variante`
(formato guardado, ADR-0012). El selector la escribe con `elegirVariante` en la sala en creación,
que pasa entera a la guardada al entrar, y la pestaña «Estilo» lee y escribe el mismo campo.
`conPlantilla` la conserva al cambiar de mundo, así que ir y volver la mantiene (se recuerda la
última elegida, no una por mundo). Prueba: `apps/lab/src/creacion/varianteUnica.test.ts`.
