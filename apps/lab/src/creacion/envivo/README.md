# Sala en vivo local y demo pública

`Crear` conserva el Canvas y el guardado existentes. Sin configuración completa no se consulta el
emisor y la página funciona individualmente. `VITE_SALA_EN_VIVO=1` sólo habilita el modo local en
desarrollo; la pareja `VITE_URL_EMISOR_PASES` (origen sin `/api`) y `VITE_LIVEKIT_URL` habilita la demo.
Véase `.env.example` del laboratorio y `docs/despliegue/demo-en-vivo.md`.

- `configuracion.ts`: configuración validada, enlaces públicos sin credenciales, solicitud de pases,
  validación del rol autorizado y textos de ausencia del anfitrión.
- `useEnVivo.ts`: creación de sala en el paso Invitar, sesión, conexión y fotos del mundo.
- `protocolo.ts`: cotas, validación, revisiones crecientes, mezcla que conserva `yo` y cola.
- `enrutado.ts`: sólo presentes, cuota de paquetes y fases monótonas por turno.
- `equipo.ts`: definiciones de agentes derivadas del mundo.
- `Conversacion.tsx`: simulador sin red en público/individual; SSE sólo en el modo local.
  En teléfono el chat empieza plegado para dejar visible el avatar.
- `Presencia.tsx`: presentes, ausencia del anfitrión y enlace; permite introducir una llave
  de demo si el emisor la exige. En la demo nocturna la voz va por Meet.

## Autorización y recuperación

En público, el enlace contiene únicamente `sala`; el emisor entrega la identidad del anfitrión en
cada pase. El secreto recibido al crear se guarda en `localStorage` bajo `demo/dueno/<sala>` y nunca
se comparte. La relación `demo/guardada/<id de biblioteca>` conserva la sala en vivo correspondiente en `localStorage`; se publica al autoguardar y permite recuperarla desde portada o Mis salas. Invitar repetido comparte incluso una solicitud de creación en curso.
La identidad aleatoria de cada pestaña se conserva allí también. Construir requiere autorización
positiva del emisor; sólo se aplica un mundo cuyo emisor LiveKit es el anfitrión autorizado.
Editar `dueno` en una invitación no cambia esos permisos. Este flujo todavía no es una cuenta:
perder el almacenamiento del navegador pierde el secreto; robarlo permite suplantar al anfitrión.

Al salir el anfitrión, cada invitado conserva su último mundo en memoria y muestra un aviso. Cuando
regresa, las revisiones basadas en tiempo permiten recuperar cambios incluso si recargó la página.
No se retransmite el mundo de invitado a invitado: alguien que entra sin anfitrión debe esperarlo.
Las fotos fiables tienen un máximo de 15.000 bytes y no reemplazan persistencia en servidor.

## Límites y agentes

El cliente admite 8 personas en local y 25 en demo; el emisor y LiveKit fijan el máximo real.
Las cuotas del chat siguen en `LIMITES_VIVO`: 12 mensajes/minuto, 1.000 caracteres, 1 turno pendiente
y 8.000 caracteres de respuesta. En la demo pública las respuestas son ejemplos locales y así lo
indica la interfaz; no se usa ninguna clave ni endpoint de modelos. En local, el servidor existente
usa su simulador cuando no tiene clave. La llave de demo sólo se envía en cuerpos POST y se conserva en `sessionStorage` (`demo/llave`) durante la pestaña, nunca en almacenamiento permanente ni en el enlace.

## Entrada D1 y modo sin voz

`recuperacion.ts` vincula la biblioteca con la sala en vivo sin cambiar el formato guardado.
`entradaInvitada.ts` limita los pasos y reutiliza el catálogo del vestidor para Entrar ya.
`CargaInvitada.tsx` muestra el nombre de sala y anfitrión cuando se conocen; esos nombres se
recuerdan durante la pestaña para una recarga. La conexión comienza al elegir personaje.
`d1-enlace-hasta-dentro` mide en Performance API la entrada completa (incluye interacción humana).

`VITE_SALA_SIN_VOZ=1` activa `sinVoz.ts`: la fuente usa autoSubscribe falso y radio de voz negativo,
sin resolución de recinto; así no se suscribe ni a una persona a distancia cero. El adaptador
bloquea activar micrófono y expone un conjunto vacío de hablantes. Los métodos de presencia y datos
se conservan. Presencia solo cambia una condición para ocultar el bloque de voz.
Sin la variable, se utiliza la fuente original y sus parámetros de voz habituales.

Errores: 401 muestra llave, 429 reintenta sin formulario, 409 informa cupo y reintenta, red/5xx
mantienen la sala individual. La espera inicial es 2 s y duplica hasta 60 s; la reconexión posterior
al primer enlace la conserva FuenteLiveKit, con sus errores traducidos en la interfaz.

## Dinámica de grupo D2

`dinamica/README.md` describe reunir/seguir, reacciones y manos, votaciones y H/Esc para
la grabación. Presencia muestra ocupantes y enlace; la voz de esta demo va por Meet.
Los nuevos paquetes `d2-*` se validan en el módulo propio sin cambiar protocolo/enrutado.
