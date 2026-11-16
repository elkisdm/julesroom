# Auditorio · Sala Encuentro

Brief D4: feat · tamaño medio · riesgo bajo · Tier 2. Ejecución en la sesión principal,
con el modelo de sesión: la adaptación de Codex conserva la delegación opt-in.
Origen: encargo D4, demo del 15 de noviembre. Sin red, Docker, commits ni despliegues.

## Contrato y diseño

Patio de eventos abierto al cielo, 30 × 22 m. Escenario de 14 × 4 m a 0,4 m,
escalón frontal de 0,2 m, 25 butacas en tres filas curvas con pasillos. Centro libre:
x = −5…5, z = −5…3 (10 × 8 m). Mismos materiales, instancias y lienzos del motor.

Reserva para la pantalla de otra tarea: muro liso x = −7…7, z = −10, alto = 5,6 m.
Pantalla sugerida: centro **(0, 2,8, −9,86)**, ancho 6 m, alto 3,375 m,
`rotation.y = 0`: normal +z, hacia el público. Área libre x = −3…3,
y = 1,11…4,49. No hay muebles ni rótulos en esa reserva. Piso del escenario y = 0,4.
Jules reposa a la izquierda; tres puestos de agentes están en ese costado sin ocupar butacas.
Las entradas están repartidas en el vestíbulo posterior, separadas al menos 1,2 m;
la primera está en (0, 0, 10,3), frente al pasillo central. El consumidor de creación
actual usa solo `entradas[0]`: el reparto de invitados entre las 25 posiciones queda
pendiente de integración en el flujo de entrada, fuera de la zona D4.

## Aceptación y pruebas previstas

- Dado el motor importado, al elegir auditorio existen datos, dibujo y plantilla construible.
- Dado el suelo, al caminar por escalón y tarima las alturas son 0 → 0,2 → 0,4;
  las 25 butacas bloquean incluso al saltar y sus aproximaciones son libres.
- Dados los invitados, hay 25 acciones de sentarse, pasillos y entradas libres.
- Dado el laboratorio con 25 simulados, medir FPS y draw calls contra oficina.
- Recorrido Chrome: entrada, escenario, E, salto, clic y construcción; capturas y video.

Archivos: nuevos `escenarios/auditorio/{plano,index,index.test,README}` y
`render/escenarios/auditorio/{DibujoAuditorio,DibujoAuditorio.test}`; conexión mínima
`src/index.ts`, `src/index.test.ts`, `apps/lab/src/creacion/plantillas.ts` y sus pruebas.
Miniatura: el precargador existente la renderiza desde el dibujo, sin catálogo paralelo.

## Pre-mortem y revisión de diseño

Caminos: selector, guardado por id, construcción, laboratorio y registro público cubiertos.
Fallas: no hay servicios nuevos; recursos GPU se liberan al desmontar.
Invariantes: 25 acciones, asientos no pisables, zona central libre, alturas coherentes.
Simetrías: datos y dibujo comparten las mismas coordenadas y huellas.
Reutilización: superficiesDeMuebles, crearRutasPlanta, Instancias, recursos y useLienzo.
Consumidores: motor/index, registroDibujo, plantillas y precarga existentes.
Datos reales: Mueble/Lugar/Accion y SalaGuardada actuales, sin cambio de protocolo.
Variantes: noche y ensayo; movimiento reducido apaga los focos móviles.
Afirmaciones: las mediciones y límites reales se registran al cierre.
DoR: rutas comprobadas, criterios verificables, sin dependencias nuevas; NFR rendimiento y accesibilidad.
Revisión de diseño: se evita techo por cámara; se agregan acciones explícitas para que los
lugares públicos no supriman E; se reserva el muro sin dibujar una pantalla central.

La fila de miniaturas (`pasos/mundos.css`) distribuye las columnas automáticamente para
que la cuarta plantilla no genere una segunda fila ni oculte el botón de entrar.
Los focos se sujetan a las alas laterales: no hay barra atravesando la reserva de pantalla.

## Cierre comprobado

- `index.test.ts`: registro, 28 lugares (25 públicos y 3 de producción), suelo 0/0,2/0,4,
  25 acciones, aproximaciones y rutas transitables, centro y entradas libres, butacas fijas no pisables.
  Mutación manual `pisable: true`: prueba roja; restaurado: cinco pruebas verdes.
- Registro público y dibujo: `src/index.test.ts` y `DibujoAuditorio.test.ts`; guardia sin datos personales.
- Laboratorio: 52 pruebas focalizadas de plantillas, permiso de construir, variantes, selector y flujo.
  Motor: 12 pruebas focalizadas. Typecheck y lint de ambos paquetes: exit 0. Build lab: exit 0,
  con advertencia de chunks mayores de 500 kB. Suite completa y cobertura quedan a quien integra;
  no hay script de cobertura en los paquetes tocados y no se afirma una medición de cobertura.
- Chrome real, ANGLE Metal, 1440×900 DPR1, 25 simulados + avatar, muestra de 8 s tras calentamiento:
  auditorio 60,00 fps, p95 16,8 ms, cero cuadros perdidos, 34 draw calls; oficina 60,00 fps y 150 calls.
  Seguimiento también sostuvo 60,00 fps, p95 16,8 ms y cero cuadros perdidos.
  Es una muestra local sin red; no certifica 25 conexiones reales ni otros equipos.
- Creación completa, miniatura generada, selector revisado a 1440/390/320 px. Recorrido: entrar,
  caminar hasta y=0,4, salto con Espacio comprobado visualmente (el callback informa el suelo), bajar,
  E hasta postura final sobre la butaca, levantarse, clic real al piso y colocar una palmera con el editor.
- Diff revisado explícitamente, sin herramientas de revisión de Claude ni hooks presupuestos.
  No cambian cámara, animación, mundos existentes, Dentro, Crear, envivo ni protocolo.
- Pendiente de integración: usar las entradas separadas en invitados; el flujo existente elige solo la primera.
