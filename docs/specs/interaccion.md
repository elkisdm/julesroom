# Interacción física del avatar

Alcance: sentarse/levantarse, abrir paneles, hablar mediante `accionesExtra` y confirmar con E o toque.
No cambia velocidades, locomoción, cámara ni el estilo de los personajes.

- `escenarios/acciones.ts`: la selección conserva el objetivo bajo `umbralMovimiento`; ocupación,
  retirada o cambio de planta invalidan la elección. Una acción extra recién disponible permite
  reconsiderar la elección (contrato preexistente de `render/Acciones.test.ts`).
- `animacion/avatar.ts`: llegada al apoyo parametrizada y rechazo de asientos ocupados tanto por E
  como por clic; ocupación durante la aproximación o la bajada cancela el sentado.
- `render/Acciones.tsx`: resalte del objetivo, presencia vigente y consumo único de pulsaciones
  táctiles en el motor. `Mando.mirar` alimenta la mirada suave del cuerpo a través de
  `render/miradaAccion.ts` y dos líneas de integración en `Personas.tsx`.
- `creacion/useInteraccionFisica.ts`: posiciones vivas del proyector, mirada cercana y saludo temporal.
  `Crear.tsx` conecta estas acciones sin un listener alternativo de E; conserva la respuesta de ejemplo.
- `escenarios/AvisoAccion.tsx`: etiqueta compartida por teclado y botón; identifica al agente.
- `escenarios/paneles`: `alternarPanel` abre/cierra por activación; Escape cierra; transición con
  origen proyectado y respeto de movimiento reducido. `interesesPorCercania=false` evita aperturas
  automáticas en Crear/Escenarios; el valor predeterminado del motor conserva la API anterior.
- Confirmaciones de sentarse, levantarse, abrir y hablar usan el sonido existente y su silencio.

## Verificación dirigida

Motor: `animacion/interaccionAvatar.test.ts`, `escenarios/seleccionAccion.test.ts`,
`render/AccionesFisicas.test.ts`, `render/miradaAccion.test.ts` y las suites existentes de
`escenarios/acciones.test.ts`, `render/Acciones.test.ts`, `animacion/avatarSentarse.test.ts`.
Laboratorio: `creacion/interaccionFisica.test.ts`, `escenarios/AccionTactil.test.ts`,
`escenarios/paneles/alternar.test.ts`, `escenarios/paneles/abrir.test.ts`, `escenarios/aviso.test.ts`.

La ruta desde detrás comprueba los segmentos libres hasta el apoyo; levantarse se comprueba en
cada asiento de las tres plantillas. El clic al piso cancela la orden pendiente. Las suites existentes
no se modificaron. Las pruebas nuevas de etiquetas, alternancia, mirada y ocupación tardía se
observaron fallar antes de implementar su contrato.

Chrome real: apertura por E/toque, cierre E/Escape y hablar con Nova en escritorio y 390×844.
Las grabaciones están fuera del repositorio: antes/después del recorrido heredado y comparativos
lado a lado, a 60 fps; revisión de muestras a 4 fps. La toma heredada detrás del sofá empieza fuera
del muro y la de detrás de la silla dentro de una obstrucción; no prueban una aproximación válida.
La evidencia complementaria reubica un sofá del mismo estilo en una zona accesible únicamente
para grabar. La valoración perceptual continua a velocidad real requiere revisión humana.

Resultado final: 64 pruebas del motor, incluida guardia, y 15 del laboratorio; ninguna saltada.
Typecheck y lint de ambos paquetes pasan. Chrome también comprueba mirada, saludo, conservación
del modo de cámara y confirmación sonora con silencio; la falta de sonido al sentarse en Escenarios
se reprodujo antes de corregirla. No se ejecutó la suite completa ni cobertura global por el alcance del encargo.
