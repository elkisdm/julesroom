# Preparar los mundos en el Canvas del onboarding

- **Estado:** Aceptado (2026-11-15)

## Contexto

Cambiar el escenario de `Oficina` desmonta el dibujo anterior. Precompilar y luego desmontar
no conserva sus programas: Three los libera con los materiales. Las mediciones en Chrome
con ANGLE Metal mostraron pausas de hasta 200 ms al reconstruir la mansión.

## Decisión

El selector mantiene cada dibujo y sus variantes en escenas auxiliares con portales R3F,
dentro del mismo renderer. La llegada compila únicamente la selección y se habilita cuando
termina esa preparación, incluso si falla. Conserva el primer render de su mundo elegido
durante esa preparación; la espera detrás del marcador se aplica solo al comparar. Después se precalientan vecinos en ocio, de uno
en uno, dejando un margen antes de iniciar cada vecina para no competir con la primera
pintura interactiva. La cola prioriza la última elección y cancela intermedios; elegir el trabajo activo
lo promueve sin reiniciarlo. Nunca se cambia la selección como efecto de una precarga.

El montaje secundario usa una transición React y registra el banco al terminar el commit.
La preparación de GPU se divide en lotes de objetos que comparten materiales y geometrías
con el banco, compilados y dibujados en un render target auxiliar. Después cada lote se
inicializa con la salida real y scissor 0×0, restaurando destino y tijera en `finally`: sin
escribir píxeles, prepara también los programas de color, tono y recorte local de pantalla.
El perfil detectó que `compileAsync` más render target dejaban compilaciones para el primer
cuadro visible de mansión (consultas `getProgramInfoLog`). La miniatura usa lectura
asíncrona de píxeles, restaurando destino y exposición. La cámara principal conserva su
copia mientras se compara: solo el banco dibuja la selección, evitando reconstruir dos
veces el mismo mundo. Al continuar el motor recibe la selección actual.

## Consecuencias

Cambiar a un banco listo reutiliza geometrías, texturas y programas. Una elección pendiente
muestra inmediatamente su miniatura y la funde después del primer cuadro. Los bancos ocultos
no dibujan ni ejecutan sus suscripciones de animación; el filtrado se adapta al
`internal.subscribe` del portal en R3F 9.8.2. Se reserva memoria GPU mientras se compara.
Al salir se liberan los bancos no elegidos; el activo se conserva para el vestidor hasta el
desmontaje de la página. El estado de caché de los descartados se invalida.

Los módulos de dibujo ya se cargan con el motor; no se agregan imports ni contextos nuevos.
Los lotes limitan trabajo de GPU por turno, pero las fábricas síncronas de geometría del motor
no quedan interrumpibles: la mansión puede seguir produciendo tareas largas de construcción.
La variante elegida sigue guardándose en `sala.mundo.variante`, la fuente de «Estilo».

## Alternativas consideradas

- Precompilar alternando solo la escena principal: seguía desmontando recursos y reconstruyendo geometrías.
- Tres Canvas ocultos: sus cachés de GPU son independientes y no calientan la escena visible.
- Modificar Oficina para conservar dibujos: toca un archivo reservado al trabajo paralelo.
