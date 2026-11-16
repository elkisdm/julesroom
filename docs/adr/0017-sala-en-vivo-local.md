# 0017 — Unir el laboratorio con una sala local mediante LiveKit

Estado: aceptado para la rebanada S local. Fecha: 2026-11-15.

## Contexto

Onboarding, presencia y conversación existían separados. Se necesita probarlos juntos sin desplegar
ni interferir con el trabajo paralelo sobre guardado en servidor, muebles o cámara.

## Decisión

Conservar el Canvas de `crear.html` y usar la FuenteLiveKit existente. Añadir un tema fiable `sala`
en la misma conexión para fotos del mundo enviadas por el dueño y respuestas transmitidas por SSE.
La revisión del mundo es creciente; el receptor valida SalaGuardada y conserva su ocupante `yo`.
Solo el dueño construye. Los agentes locales reutilizan el servidor y cliente de agentes-lab y su
cuarentena, con definiciones derivadas del mundo. Todo corre en loopback con un único comando. Se habilita el candidato de loopback del servidor y se fuerza ICE sin STUN externo en este cliente; la conexión de datos no depende de conceder el micrófono.

Esta excepción de desarrollo al ADR-0006 permite transportar el diseño por datos: producción seguirá
leyéndolo de su API. La clave queda fuera del repo; las pruebas fuerzan el simulador.

## Consecuencias

Funciona entre perfiles aislados sin base de datos y sin servidor WebSocket adicional. El dueño
debe permanecer conectado; máximo 15 KB por foto. En el modo local, el enlace no autentica ni autoriza al dueño.
La reproducción de conversaciones anteriores, persistencia y edición simultánea quedan fuera.
No reemplaza las decisiones de autenticación, almacenamiento o despliegue de producción.

### Ampliación para la demo pública (2026-11-15)

El emisor público independiente crea el id de sala y un secreto aleatorio de anfitrión. Guarda
sólo la huella del secreto en memoria; el navegador creador conserva la capacidad en su
almacenamiento local, nunca en el enlace. Los pases de anfitrión requieren ese secreto; los
invitados reciben identidades con un prefijo diferente, aunque alteren `dueno` en la URL.
Los clientes aceptan mundos únicamente de la identidad de anfitrión devuelta por el emisor y
autenticada por LiveKit. La metadata editable de presencia no concede permisos de anfitrión.

Esto corrige la autorización del dueño para la demo pública, sin introducir cuentas ni recuperación:
robar el secreto permite suplantarlo; perderlo, reiniciar el emisor o expirar la sala requiere una
sala nueva. El modo local heredado sigue siendo exclusivamente de desarrollo. Al salir el dueño,
los invitados conservan el último mundo recibido y ven su ausencia; para nuevos invitados sigue
siendo necesaria la retransmisión del dueño. Al volver desde su navegador recupera la capacidad.

La URL del emisor y LiveKit se configura durante la compilación, y ICE normal se conserva fuera de
loopback. El cliente publicado sin configuración queda individual. Los agentes públicos usan un
simulador local identificado, sin ninguna clave de modelo en el cliente. Los límites, cierre y
pasos operativos se documentan en `docs/despliegue/demo-en-vivo.md`.

## Alternativas consideradas

localStorage: no cruza perfiles y no cumple el encargo. Nuevo servidor de estado: duplica una pieza
que se reemplazará al integrar la API de guardado. App paralela: fragmenta otra vez la experiencia.
