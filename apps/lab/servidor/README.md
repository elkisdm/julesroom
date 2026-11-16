# Levantar una sala completa en local

Desde la raíz, con dependencias instaladas (`pnpm install`) y `livekit-server` en PATH:

```sh
pnpm dev:sala
```

Abre **http://localhost:5352/crear.html**. Elige mundo, nombre, personaje y agentes. Copia la invitación
y entra primero. Abre el enlace en otro navegador o perfil: el invitado elige nombre y ropa y recibe
el mundo y los muebles del dueño. Acerca los personajes y pulsa «Usar mi voz»; la explicación aparece
antes de solicitar permiso. Prueba silencio y camina más de 5,625 metros para dejar de oír al otro.
Acércate a un agente y pulsa E, o escribe `@Nova hola` (usa el nombre de un agente de tu mundo).
Ambos ven su respuesta con streaming.

Servicios propios: web 5352, tokens 8797, agentes 8798, LiveKit 7880 (señal), 7881 (TCP), 7882 (UDP).
Solo escuchan en loopback. LiveKit anuncia su candidato de loopback y el cliente usa `iceServers: []`: la presencia no consulta STUN externo ni necesita permiso previo del micrófono. Ctrl+C termina los grupos que inició el script; si un puerto ya estaba
ocupado, falla sin tocar el proceso ajeno. No usa LiveKit Cloud ni despliega nada.

El servidor reutiliza `agentes-lab/servidor/app.ts` y `sala/server/app.ts`. Si existe
`~/.config/oficina-agentes/.env`, lee su clave en memoria; no la copia ni la registra. Sin clave usa
el proveedor simulado y la interfaz lo indica. Para pruebas automáticas SIEMPRE:

```sh
SALA_SIMULADA=1 pnpm dev:sala
# En otra terminal, desde la raíz:
node apps/sala/e2e/envivo.mjs --video
node apps/sala/e2e/resiliencia-envivo.mjs
pnpm test
pnpm typecheck
pnpm lint
```

E2E usa Chrome instalado, dos contextos aislados y micrófono falso. La prueba de rechazo usa Chrome sin `--use-fake-ui-for-media-stream` para que Chrome respete la denegación de permisos. Capturas y video van en
Una carpeta local de capturas. El video captura ambos Canvas a 60 fps con tiempo real
(sin reloj virtual que altere WebRTC); el MP4 los presenta lado a lado. La UI HTML se documenta en
las capturas, no forma parte del flujo de los Canvas grabados.

Sin servicios locales, `pnpm --filter @oficina/lab dev --port 5352` permite usar la sala individual.
No es una entrega de producción: faltan identidad/autorización del dueño, almacenamiento servidor,
TLS, historial compartido, cuotas autenticadas, observabilidad y pruebas de red y carga.

## Pizarra inteligente D8 (sin Docker ni claves de API)

Desde la raíz, en dos terminales:

```sh
pnpm --filter @oficina/lab exec vite --host 127.0.0.1 --port 5381 --strictPort
pnpm --filter @oficina/lab pizarra
```

Abre `http://127.0.0.1:5381/crear.html`, entra a tu sala y abre **Pizarra**. Pega el código
que imprime el puente y pulsa **Conectar**. Solo el anfitrión autorizado tiene controles.
Pulsa **Poner pizarra aquí** en un espacio abierto; el tablero mide 6 × 3,375 m y se apoya
sobre el suelo. Si no cabe sin cruzar obstáculos, el panel pide otra ubicación.
**Mirar en el mundo** encuadra el tablero; **Volver a caminar** restaura la cámara anterior.
**Ver grande** abre la lámina completa. Mantén V o pulsa **Dictar** (es-CL); el navegador
puede requerir permiso de micrófono y su servicio de reconocimiento. Escribir siempre funciona.
**Explicar** no permite herramientas; **Investigar** permite solo WebSearch/WebFetch y exige fuentes.
**Ampliar** añade contexto a la pizarra actual; ←/→ recorren hasta 30 versiones en esta sesión.
Comandos completos de voz/texto: «borra la pizarra», «siguiente» y «vuelve».

Para ensayar sin llamar a Claude:

```sh
PIZARRA_SIMULADA=1 pnpm --filter @oficina/lab pizarra
```

En modo simulado escribe `idea`, `pasos`, `mapa`, `comparacion`, `linea-tiempo`, `barras` o
`capas` dentro de la idea. Las respuestas son ejemplos fijos, identificados en el panel.
No se simula una investigación real. El modo normal requiere `claude` instalado y una sesión
por suscripción iniciada previamente. No lee archivos `.env` ni pasa claves API a la CLI;
usa `--safe-mode`, sin personalizaciones, sin MCP y sin persistir sesiones. No registra dictados.

| Variable                    | Valor inicial                           |
| --------------------------- | --------------------------------------- |
| `PIZARRA_ORIGEN`            | `http://127.0.0.1:5381`                 |
| `PIZARRA_MODELO_EXPLICAR`   | `claude-haiku-5-5`                      |
| `PIZARRA_MODELO_INVESTIGAR` | `claude-sonnet-5-5`                     |
| `PIZARRA_EXPLICAR_MS`       | `20000`                                 |
| `PIZARRA_INVESTIGAR_MS`     | `60000`                                 |
| `PIZARRA_CODIGO`            | Código aleatorio nuevo en cada arranque |

El puente escucha exclusivamente en `127.0.0.1:5390`. Para un cliente publicado, usa su origen
exacto en `PIZARRA_ORIGEN`; el panel muestra el comando correspondiente. Permite el acceso a la
red local si el navegador lo solicita. El preflight incluye `Access-Control-Allow-Private-Network`.
CORS no sustituye el código. Una petición activa, hasta dos en espera; el timeout abarca ambos
intentos y mata el proceso CLI. Dos JSON inválidos producen una guía de respaldo explícita.
Sin puente puedes mostrar una idea escrita a mano; no se presenta como investigación.

La pizarra viaja por el canal fiable existente en mensajes `d8:*` acotados, aceptados solo del
anfitrión confirmado por la sesión. Los invitados dibujan su propia textura; no reciben el código
ni llaman a localhost. La entrada tardía pide una foto; el dueño repite su estado cada 5 segundos
para recuperar reconexiones. Solo se guarda historial en memoria del anfitrión. Una lámina puede
obtenerse con `laminaActual()` desde `creacion/envivo/pizarra/PizarraViva` para integrarla en el cine.

Verificación sin llamadas reales:

```sh
pnpm --filter @oficina/lab exec vitest run src/creacion/envivo/pizarra --maxWorkers=2
pnpm --filter @oficina/motor exec vitest run src/index.test.ts src/guardia.test.ts --maxWorkers=2
pnpm --filter @oficina/lab typecheck
pnpm --filter @oficina/lab lint
pnpm --filter @oficina/motor typecheck
pnpm --filter @oficina/motor lint
```

Las pruebas inyectan un cerebro falso y un canal de 20 invitados en memoria. No prueban transporte
LiveKit real, voz humana ni investigación web real. Ctrl+C termina cada servidor local.

Con los dos procesos abiertos y el puente en modo simulado, el recorrido reproducible (una pestaña,
siete tipos, ampliar, historial, 1440/390/320, capturas y video) se ejecuta desde la raíz:

```sh
D8_CODIGO=el-codigo-de-tu-terminal node apps/lab/src/creacion/envivo/pizarra/e2e.mjs
```

Escribe la idea, coloca el tablero hacia donde mira la cámara y muévete a un lado para no taparlo
con tu avatar. En teléfono, **Ver grande → Acercar para leer** permite recorrer la lámina con el dedo.
