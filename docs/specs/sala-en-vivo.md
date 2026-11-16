# Unir la sala en vivo (Encargo S)

Clasificación: feat · grande · riesgo alto (concurrencia, transporte) · Tier 3.
Origen: encargo S. Solo local; sin commits ni servicios externos.

## Exploración y diseño

Presencia ya entrega FuentePresencia, voz selectiva y estado; render/remotas interpola.
Agentes-lab ya valida, pone en cuarentena y transmite SSE. Se reutilizan su servidor y cliente.
La sala del dueño viaja por datos fiables, con validación de SalaGuardada y revisión creciente.
El invitado conserva nombre y ropa propios, recibe mundo y agentes del dueño; solo el dueño construye.
El dueño debe permanecer conectado. No se pretende persistencia ni autorización de producción.

## Archivos verificados / ejecución

1. `packages/presencia/src/fuenteLiveKit.ts`: canal fiable adicional y nivel de audio, sin cambiar posiciones.
2. Nuevos `apps/lab/src/creacion/envivo/`: protocolo validado, cola acotada, conexión y UI.
3. Integración mínima en `Crear.tsx`, `Dentro.tsx`, `Entrada.tsx`, `pasos/Invitar.tsx`.
4. Nuevos `apps/lab/servidor/`, `scripts/dev-sala.mjs`; reutilizan servidores Hono existentes.
5. Pruebas nuevas y E2E en `apps/sala/e2e/`; documentación y evidencias locales.
   Ejecución: sesión principal; delegación opt-in no solicitada. Sin tocar las áreas reservadas.

## Escenarios / aceptación

- Dado el onboarding, al invitar, el enlace contiene sala y dueño; el invitado elige nombre y ropa.
- Dados dos perfiles, al entrar reciben el mismo mundo y agentes, y se ven con interpolación existente.
- Al correr, saltar o sentarse, el estado remoto coincide; al salir se retira la persona.
- Antes de activar el micrófono se explica su uso; rechazo y silencio tienen estado visible.
- Cerca se recibe audio; lejos se desuscribe según histéresis existente.
- Al pulsar E o mencionar un agente elegido, la respuesta SSE aparece sobre él para todos.
- Sin servidor de sala se conserva el modo individual; sin clave hay simulador identificado.
- Datos inválidos, no autorizados, repetidos y sobredimensionados no modifican la sala.

## Pre-mortem

Caminos: creación, invitación, reconexión, construcción, conversación, salida cubiertos; producción fuera.
Fallas: servidor ausente → individual; dueño ausente → espera; agentes caídos → frase local.
Invariantes: preservar yo, solo dueño publica mundo, revisión monótona, cola/largo/frecuencia acotados.
Simetrías: ambos clientes publican presencia y respuestas; solo dueño escribe diseño.
Reutilización: validarSala, FuenteLiveKit, remotas, cuarentena, crearApp, enviarMensaje.
Consumidores: Crear/Oficina reciben fuente real; Dentro conserva misiones y controles.
Datos reales: SalaGuardada v2 y atuendo del motor; SSE EventoRespuesta.
Variantes: real, simulado, offline; tests siempre simulados.
Afirmaciones: README declara dependencia del dueño, alcance local y falta de autenticación.

## Verificación

TDD protocolo/mezcla/cola/enrutado; pruebas existentes de interpolación; Chrome dos contextos,
voz real WebRTC con dispositivo falso, capturas 1440×900 y 390×844, video 60 fps.
Suite raíz, typecheck, lint; revisión explícita del diff (comandos de review de Claude no disponibles).
DoR: objetivo, rutas, supuestos y dependencias verificados; NFR: privacidad, validación, accesibilidad,
resiliencia y límites parametrizados. Cierre y resultados en README/evidencias.

## Cierre de verificación

- Invitación, estado entre perfiles, ropa, correr, salto, asiento, E, @mención, respuesta compartida,
  silencio y salida → `apps/sala/e2e/envivo.mjs`, LiveKit local y proveedor simulado.
- Audio comprobado por crecimiento de RTP y RMS > 0,002 cerca; sin RTP entrante lejos.
- Modo individual, recuperación, conexión sin permiso de micrófono, denegación y construcción
  sin perder la conexión → `apps/sala/e2e/resiliencia-envivo.mjs`.
- Dueño/revisión/identidad local/datos inválidos/cola → `envivo/protocolo.test.ts`.
- Presentes/cuota de canal/fases → `envivo/enrutado.test.ts`; límite entre agentes → servidor/app.test.
- Metadatos/posiciones/postura/audio/datos fiables → `packages/presencia/src/perfil.test.ts` y
  `fuenteLiveKit.test.ts`. Se reutiliza y ejecuta la suite de interpolación/remotas del motor.
- Burbuja encuadrada → `envivo/encuadre.test.ts`, capturas de ambos tamaños inspeccionadas.
- Consumidores revisados: Crear integra la fuente y conserva Canvas, mando y construcción;
  Dentro conserva misiones/controles; Ancla admite encuadre opcional sin cambiar a otros consumidores;
  los otros clientes de FuenteLiveKit conservan sus valores por defecto.
- Se retiró `enlaceEjemplo` y su prueba, reemplazados por el enlace real probado en protocolo/E2E.
- Se habilitó loopback ICE explícito y `iceServers: []` al detectar que la conexión sin permiso
  previo no se establecía en Chrome; la prueba de resiliencia lo cubre.
- Suite raíz: 2.287 tests en verde; typecheck y lint en 0. Build del laboratorio en 0
  (advertencia de tamaño de chunks). Gitleaks sin hallazgos.
- Cobertura: el comando raíz existe, pero ningún paquete define `test:coverage`; no genera informe
  ni existe un ratchet con el que comparar. No se afirma que se haya medido.
- Revisión explícita del diff realizada en esta sesión; no hay comandos de revisión de Claude ni
  se lanzaron agentes de revisión (delegación no solicitada). Sin commit/push/deploy.
- Claude está conectado al proveedor existente mediante la clave externa; no se hicieron llamadas
  pagadas. La prueba funcional completa usó siempre el simulador.
