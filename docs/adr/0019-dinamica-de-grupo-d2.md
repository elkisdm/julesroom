# ADR-0019 — Dinámica D2 sobre la fuente y el render existentes

## Contexto

La demo necesita acciones de grupo para veinte personas y una grabación sin controles.
La voz va por Meet. Crear, useEnVivo y el servidor son zonas reservadas; otras tareas
agregan mensajes y contenido al mismo mundo.

## Decisión

La dinámica usa suscripciones independientes al canal fiable de FuenteLiveKit, con tipos
`d2-*`, validación de tamaño/forma, identidad autenticada del transporte y cuota para
reacciones. Presencia entrega fuente/rol, Conversacion entrega identidad y Dentro monta
la experiencia mediante un pequeño almacén local. No se altera el protocolo anterior.
El anfitrión autoriza llamadas y votaciones. Cada cliente acepta o rechaza su traslado,
que el render vuelve a validar contra obstáculos y suelo antes de consumirlo.
Seguir utiliza destinos y navegación existentes. Los nombres humanos conservan el atlas
SDF instanciado, con presupuesto persistente, apilado dentro del encuadre y borde lateral.
Los discos son geometrías estables; rótulos y reacciones usan el Proyector existente.

## Consecuencias

Sin cambios de servidor, audio, credenciales ni nuevas dependencias. Datos efímeros;
una sala por página y puentes internos de demo. Una llamada no incluye a quien entra
después de enviarla; las manos se conservan por conexión incluso durante la construcción, pero no tienen recuperación
histórica para una entrada tardía.
El estado de votación sí se repite para nuevos invitados y congela su conteo al cerrar.
En espacios estrechos se rechaza la acción con explicación en vez de colocar personas
u opciones dentro de obstáculos. Enfocar una zona puede requerir rotar o alejar la cámara.

## Alternativas consideradas

- Extender useEnVivo/Crear: excede la zona y aumenta los conflictos de integración.
- Enviar posiciones de invitados como anfitrión: elimina el consentimiento y la autoridad local.
- Reemplazar los nombres por HTML: añade bucles de proyección y pierde el render instanciado.
- Persistencia/servidor de dinámicas: innecesario para esta demo y fuera de alcance.
