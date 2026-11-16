# Vestidor de personaje

Clasificación: feat · mediano · riesgo medio · conocido. Tier 2. Origen: encargo E.
Ejecución: sesión principal (delegación opt-in por instrucción expresa del encargo).

## Objetivo y alcance

Un avatar frontal vivo, con panel a la derecha en escritorio y abajo en teléfono.
Archivos verificados: `Crear.tsx`, `Entrada.tsx`, `crear.css`; nuevos módulos en
`apps/lab/src/creacion/pasos/`. Se reutilizan `laboratorio.Persona`, `Flota` y
`aplicarCuerpo`; no se modifica la cámara de seguimiento ni los controles compartidos.
El avatar del vestidor usa exactamente el atuendo guardado y el modelo existente.

## Escenarios y pruebas

- Dado un viewport de 1440×900, 390×844 o 320×640, al encuadrar cuerpo completo,
  cabeza y pies quedan dentro del rectángulo libre del panel (proyección geométrica).
- Dado un atuendo y semilla, sorprender produce el mismo resultado y distinto del actual.
- Dado un cambio, deshacer restaura el atuendo completo; sin anterior no hay deshacer.
- Dada cualquier categoría/opción, las flechas recorren y envuelven los extremos.
- Enter confirma, Escape vuelve al nombre; los botones conservan su activación nativa.
- Al salir del personaje se desmonta el encuadre y se restauran los controles;
  la elección de vista en los demás pasos mantiene el contrato anterior.
- Arrastrar gira el avatar; al soltar vuelve al frente, sin desplazarlo por la sala.
- Cara/pelo acercan al busto; ropa/piel/accesorios muestran el cuerpo.
- Miniaturas usan las mismas piezas 3D; colores salen del catálogo real.

## Pre-mortem

- Caminos: entrada, cambio, azar, deshacer, retorno al paso, salida y resize cubiertos.
- Fallas: sin servicios externos; miniaturas aún en preparación mantienen nombre accesible.
- Invariantes: atuendo actual no muta, azar no repite, otros pasos sin encuadre nuevo.
- Simetrías: clic y teclado usan la misma función de selección.
- Reutilización: Persona/Flota/cuerpo/idle y catálogo; una sola identidad visual.
- Consumidores: Entrada monta panel; Crear monta encuadre solo en personaje; sala conserva atuendo.
- Datos reales: Atuendo con acc[], claves del catálogo base y colores hexadecimales.
- Variantes: escritorio, teléfono, movimiento reducido y cambios de tamaño.
- Afirmaciones: capturas reales y comprobación funcional; sin publicación ni commits.

## Verificación

Pruebas propias con máximo cuatro trabajadores, typecheck y lint de lab (único paquete editado).
Navegador Chrome headless GPU; capturas de los tres tamaños. Revisión explícita del diff
(sin comando de revisión Claude disponible). Suite completa a cargo de quien integra.

DoR: criterios, rutas, dependencias y riesgos identificados. Accesibilidad: foco visible,
44 px táctiles y reducción de movimiento. Sin dependencias nuevas.

## Cierre verificado

- Diez pruebas propias verdes. Tres módulos puros: 100 % de líneas, ramas y funciones con V8.
- Geometría de ocho esquinas en tres tamaños, azar (150 semillas), deshacer, catálogo,
  navegación circular, selección de vista y restauración exacta de cámara/controles.
- TDD observado: suite roja sin módulos; prueba de restauración roja antes del helper.
- Chrome GPU: azar, deshacer, flechas, extras, arrastre, Escape y Enter sin doble avance.
- Capturas revisadas en los tres tamaños; miniaturas rasterizadas y objetivos ≥44 px.
  Revisión adicional en las plantillas oficina y mansión. Sin errores JavaScript.
- Typecheck y lint de lab verdes. Diff revisado explícitamente; controles compartidos intactos.
- Suite completa y su cobertura global quedan a quien integra según el encargo.
