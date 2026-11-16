# AK — Jules útil sin modelo

Clasificación: feat · mediano · riesgo medio · Tier 2. Origen: encargo AK.
Ejecución directa, modelo de sesión: la adaptación Codex exige delegación opt-in.

## Objetivo y alcance

Órdenes locales de compañía, después ayuda guiada y después presencia reactiva.
Sin Docker, red de modelos, claves, cambios de cámara o navegación. Chat conserva geometría.
Archivos verificados: `envivo/Conversacion.tsx`, `render/Asistente.tsx`; módulo nuevo
`creacion/asistente/`. Integración local mediante evento AK que entrega un control mutable
al render: posición y destino, sin mensajes de red ni cambios al protocolo.

## Escenarios

1. Al entrar, Jules espera cerca. E cerca o tocarla abre cuatro órdenes; J llama.
2. Frases completas, tildes y mayúsculas reconocen órdenes; falsos positivos no mueven.
3. Esperar captura posición; venir y volver caminan y terminan esperando; seguir es explícito.
4. Tras completar 1–3: saludo por nombre, opciones, recorrido de cinco pasos cancelable,
   lugares del mundo, presentes, atajos y ayuda de dueño; función responder extensible.
5. Tras completar 4: saludos limitados a 20 segundos, mirada, aplauso y apartarse.
6. Chocar cinco solo si sobra tiempo; no se inicia antes de cerrar los anteriores.

## Pre-mortem

Caminos: toque, teclado y chat comparten órdenes. Reingreso desmonta listeners.
Fallas: no hay servicio remoto; texto desconocido produce ayuda honesta.
Invariantes: sin seguimiento implícito; sin teleport para órdenes; nada de voz/modelos.
Simetrías: esperar cancela cualquier desplazamiento o guía.
Reutilización: rutas del motor, Ancla, clases cr, fuente de presencia existente.
Consumidores: Asistente recibe objetivo físico; Conversacion monta control y opciones.
Datos: puntos xyz, escenario actual, nombre del ocupante yo y presencia autenticada.
Variantes: escritorio/táctil, individual/público, oficina/auditorio.
Afirmaciones: solo funcionalidades verificadas se declaran terminadas.

## Verificación / DoR

Rutas, restricciones, dependencias y criterios verificados. NFR: sin geometría por cuadro,
texto breve, teclado/táctil, sin tráfico adicional. Pruebas puras primero (rojo/verde),
Chrome local 5388 a 1440 y 390; typecheck/lint de lab y motor; revisión explícita del diff.
Suite completa a cargo del integrador. Capturas y video en carpeta AK del encargo.

## Revisión del avance interrumpido

Se conserva la implementación heredada. Gaps a cerrar: J y las órdenes del menú deben
cancelar también el recorrido/marca; cambiar de mundo debe renovar el puesto; las menciones
«@Jules, ven» comparten el reconocimiento; el paso de pantalla ausente no se autocompleta
por proximidad a la zona central. Verificar recorridos con el navegador físico existente.

La interacción E debe respetar un asiento/acción más cercano y permitir levantarse:
Jules no captura E sentado ni cuando la acción alcanzable está más cerca que ella.
«Hola» saluda sin comenzar automáticamente el recorrido. Las burbujas se limitan a 12 palabras.
El motor publica altura del piso, no del salto: salto se observa por Espacio y el
botón táctil existente, sin alterar navegación. Formularios, botones, repetición y
modificadores no completan pasos por accidente.
Prueba real: en el pasillo del auditorio, la separación suave del usuario empuja a Jules
contra una butaca y bloquea la guía. Durante órdenes a un punto fijo no aplica esa fuerza
entre personajes (los sólidos y rutas se conservan); el seguimiento mantiene la separación.
Esto permite salir aunque el usuario se quede en el pasillo, sin moverlo ni teletransportar.

## Presencia (prioridad 3)

Tras cerrar órdenes/ayuda en ambos mundos y anchos, se añade `presencia.ts` y su hook:
censo de llegadas con 20 s de descanso (sin cola), mirada al vecino cercano, suscripción
al aplauso compartido D2 ya validado y paso lateral sobre suelo libre cuando tapa una
pantalla. El render reconoce la pantalla colocada por su nombre público de escena,
con referencia cacheada y revisión de 1 Hz; no depende del objeto de depuración D3.
No se toca presentación, dinámica ni useEnVivo. No se agregan mensajes de red.
En sala simulada, la barra D2 interceptaba botones de ayuda: la ayuda abierta se eleva
por z-index sin cambiar la geometría del chat. Al ocultarla se retira por completo;
se reabre tocando Jules o escribiendo ayuda, sin tapar las reacciones con un botón plegado.

Corrección de capas: elevar todo el formulario tapaba Presentar (botón existente sobre
su pie). Se conserva el formulario original y solo la ayuda se monta en un portal,
anclado por ResizeObserver al mismo rectángulo. Las pruebas comprueban ambos botones.

## Closing check

- Órdenes: 24 frases iniciales, menciones con puntuación, falsos positivos, seguir/esperar/
  venir/puesto/guiar y prioridad de E ante asiento: `control.test.ts`, `entrada.test.ts`.
- Ayuda y recorrido: `ayuda.test.ts`, `recorrido.test.ts`, `lugares.test.ts`. Se observó
  rojo/verde para menciones, salto, pantalla ausente/colocada y foco de E.
- Movimiento: `movimiento.test.ts` recorre destinos con física real, sin teletransportes.
- Presencia: `presencia.test.ts` prueba censo inicial, llegadas, 20 segundos, reconexión,
  vecino cercano y ambos costados libres frente a una pantalla.
- Chrome 5388: `verificar.mjs` prueba E/chat/J, cinco pasos por Siguiente y acciones reales,
  cancelación y guía en oficina/auditorio a 1440 y 390. Participantes en memoria, sin Docker.
- Review explícita del diff: no se tocó cámara, navegación, useEnVivo, presentación, dinámica,
  pizarra o momentos. Ninguna clave/modelo/servicio añadido; no se ejecutaron hooks de Claude.
- No se inició chocar los cinco: se reservó el tiempo para cerrar y verificar prioridades 1–3.
- La suite completa queda al integrador según las reglas del encargo. No hay script de
  cobertura en los dos paquetes tocados; no se afirma cobertura medida ni despliegue.

## Resultados al cierre

- 56 pruebas del módulo AK (7 archivos): verdes.
- 71 pruebas existentes de `render/asistente` y `guardia.test.ts` (9 archivos): verdes.
- Typecheck y lint de `@oficina/lab` y `@oficina/motor`: exit 0; diff sin errores de espacios.
- Matriz completa en Chrome tras corregir el portal: oficina/auditorio × 1440/390,
  órdenes por E/chat/J y recorrido manual/físico: exit 0, cero errores de página.
- Integración de pantalla colocada, nombres/anfitrión, saludo limitado, mirada y aplauso
  con participantes simulados en memoria: exit 0. Capturas y video se entregan en la carpeta AK.
- Verificación adicional de oficina a 320×640: órdenes, recorrido Siguiente, guía y encuadre verdes.
- Se corrieron 6 pruebas adicionales de reacciones/sesión D2: verdes. Total focalizado: 133.
- Informe entregado antes del minuto 35; no se inició ninguna parte de chocar los cinco.
