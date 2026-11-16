# Pasos del onboarding

Cada paso con lógica propia vive aquí: la interfaz en `<Paso>.tsx`, la lógica pura en un `.ts`
con su `.test.ts` y el estilo en su `.css`. `Crear.tsx` y `Entrada.tsx` solo los conectan.

## Selección de mundos

`ElegirMundo` presenta el selector con los tokens de `crear.css`. `mundos.ts` contiene
navegación, datos, estilos, progreso y encuadres; su contrato está en `mundos.test.ts`.
La cola, cancelación, caché, lotes GPU y marcador tienen pruebas en `colaPrecarga`,
`bancosInactivos`, `prepararBanco` y `marcadorMundo`.

`usePrecargaMundos` prepara primero la plantilla y variante elegidas. Esa preparación basta
para habilitar la llegada. La llegada conserva su primer render de la elegida mientras se
prepara; el bloqueo detrás del marcador se aplica solo al comparar. Luego `colaPrecarga` anticipa vecinos en turnos ociosos: siguiente,
anterior y los restantes, sin escribir nunca la selección. Antes de cada vecina deja el
margen `turnoMaximoMs` para que la llegada interactiva alcance a pintarse; la selección
urgente no espera ese margen. Una nueva intención cancela lo
intermedio; si el vecino ya se está preparando se promueve sin reiniciarlo. Solo los éxitos
entran en la caché; los errores permiten continuar y se reintentan al volver explícitamente.

`EscenaMundos`, hijo del Canvas existente, conserva cada `BancoMundo` por mundo y variante.
El banco se registra tras su commit completo, no durante render concurrente. La preparación
secundaria usa `prepararBancoPorPartes`: lotes de objetos en escenas y destinos auxiliares,
`compileAsync` y subida de geometrías/texturas, cediendo entre lotes. Cada lote también se
inicializa con la salida del lienzo y scissor 0×0: ningún píxel puede cambiar, pero quedan
preparadas las variantes de color, tono y recorte que un render target normal no cubre. La miniatura se lee de
forma asíncrona. No se crean contextos WebGL adicionales ni se pinta otro mundo en pantalla.
Los dibujos ya forman parte del módulo estático del motor; no hay un import nuevo por mundo.

Durante la comparación el motor principal conserva su copia anterior, mientras el banco
elegido toma el render con prioridad 1 y su cámara de presentación. La elección guardada
sigue siendo la actual. Los portales ocultos conservan recursos, pero filtran sus suscripciones
`useFrame` para no ejecutar animaciones (incluidas las que ignoran `movimiento=0`). Esta
adaptación está aislada en `BancoMundos` y depende del contrato `internal.subscribe` de R3F.
Al salir se liberan los bancos no elegidos; el elegido sigue disponible para el fondo del
vestidor y se libera al desmontar la página. Volver al selector reconstruye los descartados.

`ElegirMundo` resalta de inmediato la selección. Si falta preparación muestra una miniatura
real (`public/mundos`, capturada del mismo renderer), y la funde tras el primer cuadro 3D.
Las salas ya preparadas se presentan directamente. `data-mundo-cuadro` y las marcas
`mundo:cuadro:<mundo>:<variante>` identifican el primer render enviado para cada cambio.
El tiempo de CPU de una llamada indivisible de construcción del motor no está acotado por
el tamaño de los lotes: particularmente la mansión todavía requiere perfilar y partir esas
fábricas. No se garantiza ausencia total de tareas de más de 50 ms.

La variante tiene UNA sola fuente: `sala.mundo.variante` (formato guardado, ADR-0012). La
muestra que eliges aquí se escribe con `elegirVariante` (`construir/variantes.ts`) en la sala
en creación, que pasa tal cual a la sala guardada al entrar; la pestaña «Estilo» del modo
construir lee y escribe ese mismo campo. `conPlantilla` conserva la variante al cambiar de
mundo: si no existe en el nuevo, `varianteActiva` cae a la primera, y al volver reaparece (solo
recuerda la última elegida, no una por mundo). La prueba de la unión es
`creacion/varianteUnica.test.ts`.

## Vestidor de personaje

`Personaje.tsx` contiene el panel y el teclado; `estadoPersonaje.ts` deriva las categorías
del catálogo, selecciona, sortea con semilla y conserva un único cambio para deshacer.
`encuadreVestidor.ts` reserva el área del panel antes de calcular la cámara frontal.

`Vestidor3D.tsx` se monta durante `nombre` y `personaje` como hijo de la oficina existente.
Reutiliza `laboratorio.Persona`, `Flota` y `aplicarCuerpo`: es el mismo modelo y atuendo,
sin otro estilo ni sistema de animación. Durante este paso sustituye visualmente al avatar
controlable; al salir se desmonta y `controlCamaraVestidor.ts` restaura cámara y órbita.
El avatar se compone en una escena auxiliar tras limpiar la profundidad: la geometría de la sala
no puede taparlo. El fondo usa el mismo banco sin ocupantes del selector y un velo suave, antes
del avatar. La etiqueta lee el centro real de la cabeza del rig, incluido su idle y giro.
Las miniaturas son renders a textura de las mismas piezas, en el contexto WebGL existente.
El encuadre de cada miniatura acerca ropa, piernas o cabeza según el rasgo editado.
La caché se invalida al cambiar de categoría o atuendo. La reacción reutiliza el idle `asentir`.

El rectángulo de cámara y el panel móvil comparten un contrato: panel de 330 px más margen
inferior, dentro de los 340 px reservados en `PARAMETROS_VESTIDOR.panelMovil`.
Los controles de avatar y `avanzarSeguimiento` permanecen intactos.

`MuestrasEstilo.tsx` es el componente compartido por el selector y la pestaña Estilo del editor;
ambos consumen los colores de `estiloMundo`. Las muestras y pestañas admiten flechas, Inicio y Fin.
`fronteraMotor.test.ts` recorre las fuentes de `apps/` e impide accesos relativos al interior del motor.

## Comprobar

Desde la raíz:

```sh
pnpm --filter @oficina/lab exec vitest run src/creacion/pasos --maxWorkers=4
pnpm --filter @oficina/lab typecheck
pnpm --filter @oficina/lab lint
pnpm --filter @oficina/lab exec vite --port 5335 --strictPort
# En otra terminal, desde la raíz:
node scripts/capturar-pulido.mjs
```

La precarga informa cada fallo y termina aunque una sala no
compile; el porcentaje cuenta éxitos, nunca los errores. Un límite por sala permite
continuar si el renderer no responde.

Las capturas de pulido se guardan en una carpeta local de capturas, con el número
del defecto, plantilla y tamaño. El script usa el Playwright ya instalado y Chrome con GPU.

## Llegada, nombre, agentes e invitación

`Entrada.tsx` solo conecta `Llegada`, `Nombre`, `Personaje`, `Agentes` e `Invitar`.
`Flujo` conserva el riel común, volver y la captura de teclado. Enter confirma desde
cualquier control; Espacio activa el botón enfocado antes de que lo capture el avatar.
En agentes, las flechas recorren las sugerencias y Espacio alterna la selección.

`estadoFlujo.ts` contiene los contratos puros y `PARAMETROS_FLUJO`, incluida la duración y
curva compartidas entre CSS y la transición de entrada. La selección no elimina las
sugerencias del borrador: `Crear` la aplica en la presentación de invitación y al guardar.
La hoja móvil informa su alto real con ResizeObserver para reservar la escena por encima.
`zonaDeAgentes` usa mesas por orden o la habitación del departamento en la mansión.
`TransicionFlujo` va después de los demás hijos del Canvas (ADR-0014).

Comprobación del encargo F, sin ejecutar la suite completa:

```sh
pnpm --filter @oficina/lab exec vitest run src/creacion/pasos/estadoFlujo.test.ts --maxWorkers=4
pnpm --filter @oficina/lab typecheck
pnpm --filter @oficina/lab lint
pnpm --filter @oficina/lab exec vite --port 5334 --strictPort
node scripts/capturar-flujo.mjs
```

Las capturas se guardan en una carpeta local a 1440×900,
390×844 y 320×640. El script verifica validación, Enter desde otros botones, Esc, selección
reversible, persistencia de la selección al entrar y confirmación de copiado. Con
`REDUCIDO=1` repite el recorrido con movimiento reducido.

## Entrada y biblioteca

`Llegada` conserva la misma composición que el HTML de arranque; el fondo entra por opacidad al preparar la selección. `biblioteca.ts` decide la acción principal, fecha relativa y navegación circular (pruebas en `biblioteca.test.ts`). `MisSalas` usa un diálogo con foco modal, flechas para recorrer, Enter para entrar/guardar y Escape para cancelar/cerrar. El foco vuelve al control que abrió el diálogo. Las miniaturas capturadas se conservan con el resumen de cada sala y se reutilizan durante la sesión; al no haber captura se muestra una vista isométrica editorial del mundo.

`useSala` conserva la identidad activa aparte del documento v2 y asigna otra al comenzar una creación. El motor administra índice, migración y cuota (ADR-0012); la interfaz confirma la eliminación y muestra fallos de persistencia incluso fuera del modo construir. La conexión LiveKit se importa únicamente después de activar la sala en vivo y confirmar la salud del servidor.
