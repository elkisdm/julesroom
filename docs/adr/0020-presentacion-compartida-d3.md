# ADR-0020 — Presentación compartida por el canal existente

## Contexto

La demo necesita una pantalla colocable que comparta imágenes y texto entre unas veinte
personas. El canal fiable existente de `FuenteLiveKit` admite hasta 15.000 bytes por mensaje.
La identidad autorizada del anfitrión ya la entrega el emisor de pases. Los otros encargos
agregan sus propios mensajes, y los puntos de entrada de la aplicación están protegidos.
La voz se realiza por Meet; este módulo no abre dispositivos de audio.

## Decisión

Mantener la presentación como módulo aislado con mensajes `d3/*` y suscripción directa a
la fuente existente. Las imágenes se convierten secuencialmente a JPEG de máximo 1600 px
y 200 KB, viajan en trozos base64 de 10.000 caracteres y se confirman por imagen y receptor.
El dueño difunde una imagen una vez para todos los interesados; se reintenta hasta tres
veces y cada invitado solicita lo que sigue faltando, primero la lámina actual. Los cambios
de índice viajan en el manifiesto y no esperan el lote completo. Solo se aceptan cambios,
trozos y láser del dueño autenticado, nunca de una identidad declarada dentro del mensaje.

La pantalla reutiliza el suelo y sólidos que expone el contexto del motor. El render público
recibe un lienzo y conserva una sola textura, liberada al sustituirla. El láser interpola su
posición sin generar texturas. La cámara se suspende temporalmente con el mecanismo del
motor y restaura su pose; el contenido se dibuja sobre posibles obstáculos al encuadrarlo.
Un visor 2D ampliable ofrece lectura en teléfono. La interfaz consume los tokens `.cr`.

## Consecuencias

No se modifica el formato de mundo ni se necesitan servidor de archivos o dependencias.
Cada cliente conserva hasta unos 11 MB de base64 de las cuarenta imágenes máximas y solo
una textura de presentación. La transferencia de un lote puede tardar varios segundos;
los clientes muestran un estado de recepción si aún falta la imagen seleccionada.
El manifiesto debe caber en un mensaje: lotes de texto que lo excedan se rechazan antes de
mutar el estado. La presentación es efímera y no se conserva al cerrar el anfitrión.

La prohibición explícita de editar `Crear.tsx` impide el montaje real con fuente y sesión:
ambas viven únicamente allí. Se pidió excepción para un import y un montaje y se dejó la
integración exacta documentada en el README del módulo. La prueba aislada usa el mismo
hook, motor y fuente reales; no equivale a probar el recorrido de `crear.html` integrado.

## Alternativas consideradas

- Otro WebSocket o servidor de imágenes: agrega infraestructura y autenticación innecesarias.
- URL externa de presentación: depende de alojamiento, permisos y disponibilidad adicionales.
- Cambiar `useEnVivo` o acoplar presentación al protocolo de mundo: invade zonas protegidas.
- Leer `window.__vivo` en el producto: solo existe en desarrollo y no es una API de integración.
- Retener todas las texturas: aumenta memoria gráfica; basta conservar el JPEG comprimido.
