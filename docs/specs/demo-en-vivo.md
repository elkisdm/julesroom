# Demo pública por enlace (AE)

Clasificación: feat/fix · grande · riesgo alto (autorización y API pública) · conocido tras exploración · Tier 3.
Origen: encargo AE. Sin cuentas, commits, push, acceso remoto ni despliegue.

## Objetivo y diseño

Publicar el cliente con dos URL de compilación y un emisor independiente junto al LiveKit existente.
La API genera salas y entrega un secreto al creador; lo conserva el navegador, nunca el enlace.
Cada pase identifica al dueño únicamente después de verificar ese secreto. Las identidades de
invitados pertenecen a otro espacio de nombres; los receptores solo aceptan mundos del dueño
confirmado por la API. Los metadatos de perfil siguen editables y no conceden autoridad.
Estado efímero de una sola réplica, con caducidad fija y límites acotados; reiniciar invalida salas.
No se introduce persistencia ni autenticación de personas. Se conserva el último mundo recibido
en cada invitado mientras el dueño está ausente; el dueño continúa siendo la fuente autorizada.

## Rutas y archivos verificados / ejecución

| Tarea                      | Responsable                | Archivos                                                   | Entrega                                               |
| -------------------------- | -------------------------- | ---------------------------------------------------------- | ----------------------------------------------------- |
| API, secreto y límites     | emisor (modelo de sesión)  | `apps/sala/server/`                                        | pruebas primero, producción separada del servidor dev |
| Configuración y estados UI | cliente (modelo de sesión) | `apps/lab/src/creacion/`, `apps/lab/.env.example`          | pruebas, enlace sin autoridad, ICE, chat móvil        |
| Contenedor y guía          | infra (modelo de sesión)   | `infra/vivo/`, `docs/despliegue/demo-en-vivo.md`, ADR-0017 | compose, imagen, pasos sin ejecutarlos remotamente    |
| Integración y E2E          | sesión principal           | `apps/sala/e2e/demo-vivo.mjs`, este documento              | cuatro perfiles, audio medido y capturas              |

La división sigue la ejecución por agentes requerida por spec-flow; se conserva el modelo de sesión.
Los archivos nuevos se ubican junto a los contratos inspeccionados. No se fusiona la rama de infra:
se leen y adaptan sus archivos mediante git show.

## Escenarios y criterios de aceptación

- Dada una compilación sin configuración, al abrir la página funciona individualmente sin buscar el emisor.
- Dadas ambas URL, al crear sala se obtiene un enlace compartible y un secreto solo en el navegador.
- Dado un invitado, aunque cambie `dueno`, su pase nunca obtiene la identidad autorizada para emitir mundo.
- Dado un pase válido, solo permite audio, datos y suscripción, sala del servidor y máximo 25 participantes.
- Dadas entradas inválidas, origen ajeno, exceso de intentos/salas/pases o llave incorrecta, se rechazan.
- Dados cuatro perfiles aislados, ven posiciones y cambios del dueño; audio produce RTP saliente/entrante.
- Dado el dueño ausente, los invitados conservan el mundo y ven el estado; al volver reciben sus cambios.
- Dada la demo pública, los agentes tienen un modo explícito sin claves ni servicios de modelos.
- Dado un teléfono de 390 px, el chat no cubre al avatar al entrar.

## Pre-mortem

Caminos: crear, invitar, reingresar, reconectar, construir, voz, abandonar y regresar cubiertos.
Fallas: emisor caído no concede rol; LiveKit conserva su reconexión; sin configuración no hay red de sala.
Invariantes: identidad dueño solo servidor, secreto nunca en enlace/log, sala y cupo no elegidos por invitado.
Simetrías: presencia y audio para todos; solo identidad autorizada publica diseño aceptable.
Reutilización: FuenteLiveKit, validarSala, protocolo de revisiones, simulador local, Hono y SDK existentes.
Consumidores: Crear calcula construcción/enlace; useEnVivo filtra emisor; Presencia muestra ausencias;
Conversacion selecciona modo público; FuenteLiveKit requiere setMetadata para nombre/ropa/asiento.
Datos reales: SalaGuardada v2, UUID por pestaña, perfil mutable; roles no se leen desde metadata.
Variantes: dev loopback preservado, público configurado, producción sin configuración inactiva, llave opcional.
Afirmaciones: ADR-0017 y guía describen autorización de capacidad, memoria volátil y dependencia del dueño.

## Verificación prevista y DoR

Pruebas focalizadas del emisor y cliente con rojo observado antes del código; typecheck/lint de ambos.
Guardia de datos, compose config e imagen. Chrome real con LiveKit Docker `demo-vivo-`, cuatro
contextos, audio falso medido con getStats, movimiento/construcción/suplantación/salida/regreso.
Capturas en el destino indicado por el encargo. Solo procesos propios y limpieza al terminar.
Objetivo/rutas/supuestos/dependencias verificados; NFR: seguridad, privacidad, límites, resiliencia,
accesibilidad móvil. Las pruebas entre redes externas y el VPS quedan a quien integra.

## Cierre real (2026-11-15)

- `pnpm --filter @oficina/sala exec vitest run server/demo.test.ts server/app.test.ts --maxWorkers=2`: 26 pruebas verdes, incluida firma con TokenVerifier, grants, secreto, CORS, llave, cuotas y caducidad.
- `pnpm --filter @oficina/lab exec vitest run src/creacion/envivo/configuracion.test.ts src/creacion/envivo/sinServidor.test.ts src/creacion/envivo/protocolo.test.ts src/creacion/pasos/invitar.test.ts --maxWorkers=2`: 20 pruebas verdes.
- `pnpm --filter @oficina/motor exec vitest run src/guardia.test.ts --maxWorkers=2`: 2 pruebas verdes.
- Typecheck y lint de sala/lab: exit 0. Diff revisado explícitamente y `git diff --check` limpio; no se presupone ningún hook de Claude.
- Compose validado con variables ficticias; `docker build -f infra/vivo/Dockerfile.emisor -t demo-vivo-emisor:verificacion .`: exit 0. Imagen read-only/UID1000: salud 200, rutas locales 404, crear 201.
- Build del laboratorio con las URL públicas ficticias y sin configuración: exit 0; advertencia existente de chunks grandes. Chrome real abrió el build sin configuración: modo individual, cero solicitudes a `/api`/`vivo` y chat plegado a 390 px.
- `pnpm --filter @oficina/sala exec node e2e/demo-vivo.mjs`: verde; repetido con `DEMO_LLAVE_PRUEBA` y emisor con llave. Cuatro contextos Chrome aislados: todos se mueven y los otros tres reciben posiciones; construcción compartida, URL editada sin rol, mundo intruso con revisión máxima rechazado, ausencia y regreso del dueño.
- Audio WebRTC falso medido, no audio humano: cuatro pistas salientes (una por cliente) y doce entrantes (tres por cliente). En la pasada con llave se enviaron 12.681–14.449 bytes y se recibieron 38.214–40.847 bytes por cliente al final del intervalo; los cuatro contadores crecieron.
- Capturas inspeccionadas de escritorio/390 px y resultados: en una carpeta local. El servidor usado fue LiveKit 1.13.11 en Docker propio `demo-vivo-livekit`, puertos 7880/7881/7882 sólo en loopback. En Docker Mac se omitió `--rtc.enable_loopback_candidate`: activarlo anunciaba un socket loopback interno que no establecía ICE a través del mapeo. No se modificó la configuración del VPS.
- La suite completa queda a quien integra. No existe script de cobertura por paquete ni ratchet utilizable en este árbol; no se afirma cobertura medida. TLS, TURN y redes externas requieren la prueba publicada de la guía.

La conservación del último mundo es en memoria de invitados ya conectados: no se retransmite entre invitados nuevos sin anfitrión. La autorización pertenece a una capacidad, no a una cuenta; el anfitrión tiene una identidad aleatoria reservada por sala, mientras los invitados usan UUID por pestaña. Dos pestañas de anfitrión compiten por esa misma identidad.
