# Continuidad del onboarding — Encargo F

Clasificación: feat/fix · tamaño medio · riesgo medio · Tier 2. Origen: encargo F.
Objetivo: una experiencia continua entre llegada, sala, nombre, personaje, agentes y entrada.
Supuesto: el campo único de Nombre identifica a la persona; el nombre de sala se sugiere a partir de él.

## Alcance y ejecución

Implementación en la sesión principal: la delegación permanece opt-in según AGENTS.md.
Rutas verificadas: `apps/lab/crear.html`, `src/creacion/Crear.tsx`, `Entrada.tsx`, `crear.css`.
Nuevos pasos Llegada, Nombre, Agentes, Invitar con CSS; Flujo (riel/teclado), estadoFlujo (lógica), TransicionFlujo (cámara).
Personaje.tsx: exclusivamente corregir Enter. No editar archivos protegidos ni pruebas existentes.

## Escenarios y pruebas primero

- Dado un nombre vacío, al confirmar permanece en Nombre; con espacios se normaliza; al exceder el máximo se recorta y avisa.
- Dados agentes sugeridos, seleccionar todos/algunos/ninguno conserva exactamente los elegidos y a la persona.
- Dado cualquier control enfocado, Enter avanza; Esc retrocede; en llegada Esc no actúa. Composición, repetición y modificadores no navegan.
- Dada precarga pendiente, el botón espera; al terminar, incluso con errores parciales o totales, permite seguir.
- Dada una transición, su curva empieza en cero, termina en uno, es monótona y respeta movimiento reducido.
- Dado copiar, solo informa éxito tras resolver Clipboard; si falla muestra error visible.

## Pre-mortem

Caminos: alta y vuelta entre pasos cubiertos; reingreso usa la sala guardada existente.
Fallas: precarga conserva su límite existente; copiar falla con mensaje y registro.
Invariantes: ningún agente vuelve al guardar; persona conservada; nombre vacío no avanza; Enter no activa el botón enfocado.
Simetrías: botón y teclado llaman a la misma confirmación.
Reutilización: botones/tokens crear.css, Ancla, Vestidor3D, zonasDeTrabajo, vistaPorPaso.
Consumidores: Crear/Entrada leen selección; guardar usa selección filtrada; nombre actualiza ocupante yo.
Datos reales: nombres iniciales 'Tú'/'Mi sala', agentes tipados, precarga porcentaje no cuenta errores.
Variantes: tres plantillas, escritorio/teléfono, movimiento reducido; sin dependencias nuevas.
Afirmaciones: enlace y agentes se identifican como ejemplos, sin prometer servicio conectado.

## Verificación

Solo pruebas nuevas con maxWorkers=4; typecheck y lint de lab. Revisión explícita del diff, sin agentes de revisión opt-in.
Navegador Chrome real con GPU: 1440×900, 390×844 y 320×640; capturas en una carpeta local.
DoR: criterios y rutas verificados; supuestos declarados; sin servicios externos nuevos; accesibilidad, resiliencia y movimiento reducido aplicables.

## Cierre y revisión

- Validación, límite y normalización: pruebas `nombre`; etiqueta en vivo comprobada en Chrome.
- Todos/algunos/ninguno: pruebas `agentes`; selección reversible y persistida comprobada en Chrome.
- Enter en Sorpréndeme, Volver, Todos y Copiar; Esc en llegada y regreso: comprobados en navegador.
- Conflicto real de Espacio con el avatar: reproducción fallida en Chrome, prueba roja y corrección verde.
- Precarga terminada con errores parciales/totales: prueba `la llegada espera el fin`.
- Cámara: curva acotada probada; entrada capturada durante el viaje y al completar el seguimiento.
- Hoja: reserva medida probada; capturas abiertas y plegadas revisadas a 320 y 390 px.
- `vitest run src/creacion/pasos/estadoFlujo.test.ts --maxWorkers=4`: 21 pruebas verdes.
- `pnpm --filter @oficina/lab typecheck` y `lint`: ambos con salida 0.
- `scripts/capturar-flujo.mjs`: los tres tamaños, con movimiento normal y reducido, sin errores JS.
- Oficina/Mansión: nombres en vivo, sugerencias, error de Clipboard y entrada sin agentes comprobados.
- Revisión explícita de diff y archivos nuevos: se corrigieron resets CSS, solapamiento de la hoja,
  captura de Espacio, encuadre de la mansión y selección al volver a elegir la misma plantilla.
- Sin agentes de revisión ni comando `/review` disponible; revisión realizada en esta sesión.
- Pruebas existentes sin modificar. Suite completa y cobertura global reservadas a quien integra,
  según el encargo. Sin commits, push, despliegue, dependencias nuevas ni ediciones de archivos protegidos.
- Evidencia conservada en la carpeta de capturas indicada por el encargo; no se ejecutó el helper
  global de evidencia porque el encargo limita las escrituras a este árbol y esa carpeta de capturas.
