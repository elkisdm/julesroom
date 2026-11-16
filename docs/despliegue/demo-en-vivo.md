# Demo pública en vivo sin cuentas

Esta guía prepara una demo; no instala cuentas ni persistencia de oficinas. El front estático y el
emisor son procesos independientes. Las claves de LiveKit y la llave de demo viven sólo en el
entorno del emisor. No pongas ninguna de ellas en variables `VITE_`.

## 1. Preparar el emisor junto al LiveKit existente

En el VPS, desde una copia de este árbol de trabajo ya revisada:

```bash
cd infra/vivo
# Si ya existe .env, conserva las credenciales del LiveKit instalado: no lo sobrescribas.
# En una instalación nueva: cp .env.example .env
```

Completa `.env` usando el mismo par `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` del LiveKit existente.
Define `LIVEKIT_URL=wss://vivo.tu-dominio.ejemplo` y
`DEMO_ORIGEN=https://demo.tu-dominio.ejemplo` (origen exacto, sin ruta ni barra final).
Pon un código aleatorio en `DEMO_LLAVE` para exigirlo tanto al crear como al entrar.
Genera los valores privados en el servidor (`openssl rand -hex 32`); no los copies al repositorio.

Valores iniciales: 10 salas vivas durante 14.400 s, 120 pases globales/minuto, 30 intentos/IP/minuto,
25 participantes por sala y pases de 300 s. Los límites se cambian con las variables `DEMO_*` de
`.env.example`; el emisor rechaza un tope superior a 25. El registro de salas y límites vive en la
memoria de una única réplica: no escales horizontalmente este servicio.

```bash
docker compose --env-file .env config --quiet
docker compose --env-file .env build emisor
```

Conecta la red del proxy según el siguiente paso **antes del primer `up`**. No ejecutes `up` del stack
completo en el VPS ocupado sin revisar antes su configuración real. La imagen final contiene un
bundle del emisor y Node, corre sin privilegios, con sistema de archivos de sólo lectura, máximo
256 MB y 0,5 CPU. No contiene las rutas de tokens/red del servidor local ni el servidor de agentes.

## 2. Publicar el emisor mediante el proxy existente

Crea DNS para `pases.tu-dominio.ejemplo` hacia el VPS. El emisor se conecta a la misma red Docker
privada que Traefik con el alias `demo-emisor`; el backend será `http://demo-emisor:5370`.
El puerto 5370 publicado en loopback queda sólo para diagnóstico local. No uses
`host.docker.internal:5370`: un proxy en bridge no alcanza por ahí un puerto ligado a loopback.

Identifica el contenedor Traefik y su red existente:

```bash
docker ps --format '{{.Names}}\t{{.Image}}'
# Sustituye este nombre si la lista anterior muestra otro contenedor Traefik.
PROXY_CONTENEDOR=coolify-proxy
docker inspect "$PROXY_CONTENEDOR" --format '{{range $nombre, $_ := .NetworkSettings.Networks}}{{println $nombre}}{{end}}'
docker network ls
# Sustituye coolify por una red privada de Traefik mostrada arriba.
RED_PROXY=coolify
docker network inspect "$RED_PROXY" --format 'Red {{.Name}}; controlador {{.Driver}}'
```

Desde `infra/vivo`, crea el override con **el nombre de red real** ya seleccionado:

```bash
cat > compose.proxy.yml <<EOF_PROXY
services:
  emisor:
    networks:
      proxy:
        aliases: [demo-emisor]
networks:
  proxy:
    external: true
    name: ${RED_PROXY}
EOF_PROXY
docker compose -f docker-compose.yml -f compose.proxy.yml --env-file .env config --quiet
docker compose -f docker-compose.yml -f compose.proxy.yml --env-file .env up -d --no-deps emisor
docker compose -f docker-compose.yml -f compose.proxy.yml --env-file .env ps emisor
curl --fail http://127.0.0.1:5370/api/salud
```

`--no-deps emisor` conserva LiveKit y Redis existentes. Mantén esa red limitada a contenedores
confiables. Conserva el override para operaciones posteriores; no publiques 5370 en todas las
interfaces ni recrees el LiveKit compartido.

En el proveedor dinámico de Traefik de Coolify agrega el siguiente router HTTPS, ajustando el
resolver al que ya usa tu proxy. Conserva la ruta WebSocket de LiveKit:

```yaml
http:
  routers:
    demo-pases:
      rule: Host(`pases.tu-dominio.ejemplo`)
      entryPoints: [https]
      tls:
        certResolver: letsencrypt
      service: demo-pases
  services:
    demo-pases:
      loadBalancer:
        servers:
          - url: http://demo-emisor:5370
```

Para límites por visitante configura `DEMO_CABECERA_IP` únicamente si el proxy **sobrescribe** esa
cabecera con la IP de la conexión recibida. No copies una cabecera `X-Forwarded-For` arbitraria del
cliente. En Traefik, mantén `forwardedHeaders.insecure=false` y no confíes en proxies arbitrarios;
verifica enviando una cabecera falsa que el backend recibe la IP real. Con cabecera vacía, el límite
usa la IP del peer (detrás de Traefik todos comparten el cupo del proxy: seguro, menos útil).
No registres cuerpos HTTP, respuestas de pases, secretos ni códigos de demo en el proxy.

Verifica TLS y CORS desde fuera:

```bash
curl --fail https://pases.tu-dominio.ejemplo/api/salud
curl -i -X OPTIONS https://pases.tu-dominio.ejemplo/api/pases \
  -H 'Origin: https://demo.tu-dominio.ejemplo' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: content-type'
```

Debe devolver el origen exacto permitido; otro origen no debe obtener autorización CORS.
CORS es protección de navegador, no autenticación de quien usa curl.

## 3. Construir y publicar la página

Desde la raíz, define ambas URL públicas durante **la compilación**, sin credenciales:

```bash
VITE_URL_EMISOR_PASES=https://pases.tu-dominio.ejemplo \
VITE_LIVEKIT_URL=wss://vivo.tu-dominio.ejemplo \
pnpm --filter @oficina/lab build
```

Publica `apps/lab/dist` con el procedimiento del alojamiento estático y abre `/crear.html`.
En el alojamiento que compila el proyecto configura ambas variables y vuelve a compilar: cambiarlas
después de generar `dist` no modifica el cliente. Sin configuración completa, la página conserva
su uso individual y no intenta conectarse a un servicio remoto. El modo local sigue usando el proxy
de desarrollo. Fuera de loopback se usa ICE normal de LiveKit; no fuerces `iceServers: []`.

Los agentes públicos usan un simulador local identificado en la interfaz: no hacen llamadas de
modelo ni a un endpoint SSE de agentes. En desarrollo, `apps/lab/servidor/main.ts` elige el simulador cuando no hay clave de modelo
(también al forzar `SALA_SIMULADA=1`). El arranque independiente de `agentes-lab/servidor/main.ts`
responde con el error `sin-clave` cuando falta su clave. No publiques el servidor completo de
`apps/lab/servidor/main.ts` para habilitarlos.

## 4. Probar con personas de dos redes

1. En la página publicada, crea una sala. Si hay llave de demo, introduce el código compartido en
   el paso «Invitar» y espera la conexión antes de copiar el enlace. También puedes introducirlo
   dentro de la sala en «Personas y voz»; el código no se añade al enlace; se conserva solo durante la pestaña.
2. Copia el enlace de invitación y compártelo sin el secreto de dueño. Conserva el navegador que creó
   la sala: su almacenamiento guarda la capacidad de anfitrión. El parámetro `dueno` del enlace
   no autoriza ese rol en modo público.
3. Abre el enlace desde otro perfil, y desde un teléfono con datos móviles (Wi-Fi apagado). Usa
   nombres distintos. Con `VITE_SALA_SIN_VOZ=1` no debe aparecer permiso de micrófono; usa Meet.
   Si pruebas el modo habitual con voz, concede el micrófono tras una acción de usuario.
4. Mueve los avatares en ambos extremos. En modo sin voz verifica cero pistas de audio y controles
   ocultos. Solo al compilar con voz, prueba conversación con auriculares: confirma escucha
   bidireccional y observa estadísticas WebRTC (`chrome://webrtc-internals`) de audio enviado y
   recibido, bytes crecientes y sin pérdida sostenida. No basta con que se encienda el icono del micrófono.
5. Construye como dueño: los invitados deben recibir el mundo. Edita `dueno` en la URL de un invitado:
   debe seguir sin construir ni reemplazar el mundo del anfitrión.
6. Cierra la pestaña del dueño: el invitado debe ver «el anfitrión salió» y conservar el último mundo
   recibido. Vuelve desde el navegador dueño: debe recuperar su rol y transmitir de nuevo.
7. A 390 px de ancho, confirma que el chat y el avatar inicial no se tapan.
8. Repite con dueño y tres invitados. La prueba de distintas redes queda pendiente hasta publicarlo;
   una prueba local no comprueba TURN, TLS ni firewall reales.

## 5. Apagar y revocar

```bash
cd infra/vivo
docker compose -f docker-compose.yml -f compose.proxy.yml --env-file .env stop emisor
```

Quita el router de pases o déjalo devolver indisponibilidad, y publica el front sin las dos variables
para deshabilitar nuevas sesiones. Cambiar `DEMO_LLAVE` exige recrear el emisor y cierra el acceso con
el código anterior. Reiniciarlo elimina salas y capacidades de dueño de su memoria.

**Detener el emisor o caducar un JWT no expulsa participantes ya conectados a LiveKit.** Para un
cierre inmediato usa la administración de LiveKit para borrar las salas de demo, con credenciales
sólo de servidor; verifica que no haya otras salas que deban conservarse. No detengas el LiveKit
compartido. Los pases emitidos antes del cierre admiten conexiones hasta su vencimiento.

## Riesgos aceptados

No hay cuentas ni recuperación de dueño: quien roba el secreto del navegador puede actuar como
anfitrión; perderlo, expirar la sala o reiniciar el emisor exige crear otra sala. No hay persistencia
servidor del mundo: un invitado conectado conserva su última foto, pero no sustituye al dueño para
nuevas entradas. El enlace y la llave son capacidades compartibles, sin membresía ni identidad real.
El permiso de datos de LiveKit permite paquetes de invitados; el cliente valida identidad firmada
del dueño para aceptar mundos, y la interfaz impide construir como invitado. Un cliente modificado
puede modificar su escena local y emitir tráfico; esto no cambia el mundo aceptado por otros clientes.
El pase dura poco pero una conexión puede durar más. Los límites en memoria se reinician con el
proceso y las IP compartidas pueden producir rechazos legítimos. No hay moderación, bloqueo
individual, garantía de disponibilidad ni protección distribuida contra abuso. Para abrirla a
personas desconocidas, habilita la llave y monitorea CPU, red y conexiones sin registrar secretos.

Los invitados usan una identidad aleatoria por pestaña. El anfitrión usa una identidad aleatoria
reservada por sala: abrir dos pestañas como dueño desplaza la conexión anterior. Esta demo admite
un único emisor autorizado del mundo a la vez.

Referencia de permisos: [tokens y grants de LiveKit](https://docs.livekit.io/frontends/reference/tokens-grants/).
El pase autoriza audio, datos y suscripción; la metadata de presencia no concede el rol de dueño.

## Demo sin voz (D1, Meet en paralelo)

Para esta noche añade `VITE_SALA_SIN_VOZ=1` **durante la compilación** del laboratorio:

```bash
VITE_SALA_SIN_VOZ=1 \
VITE_URL_EMISOR_PASES=https://pases.tu-dominio.ejemplo \
VITE_LIVEKIT_URL=wss://vivo.tu-dominio.ejemplo \
pnpm --filter @oficina/lab build
```

El cliente no captura ni publica micrófono, no se suscribe a audio y oculta controles e
indicadores de voz. Presencia, movimiento, mundo y datos siguen activos. La voz va por Meet.
Sin esa variable (o con valor distinto de `1`) se conserva la voz habitual.

La llave se confirma una vez por pestaña y se conserva solo en `sessionStorage` (`demo/llave`),
nunca en el enlace ni en `localStorage`. Cerrar la pestaña termina esa conservación; una pestaña
nueva puede volver a pedirla. El secreto de dueño sí permanece en el navegador, como antes.
Cada sala guardada se vincula con su sala en vivo: volver desde portada, «Mis salas» o repetir
«Invitar» recupera esa conexión mientras el emisor conserve la sala y el navegador su capacidad.
La relación se publica con el primer autoguardado de la sala en la biblioteca.

El emisor consulta el cupo real de LiveKit antes del pase (HTTP 409 si está lleno); mantiene la
cota de LiveKit como defensa ante entradas simultáneas. Admite reconexión de la misma identidad.
429, cupo y red reintentan con espera creciente de 2 s hasta 60 s; solo el error de llave abre su
formulario. No se garantiza reservar un lugar al emitir un pase. El emisor necesita alcanzar la
API HTTP de administración del mismo LiveKit (`ws` → `http`, `wss` → `https`); no publiques claves.

El invitado recorre nombre → personaje → dentro. «Entrar ya» elige un atuendo del catálogo;
la conexión empieza durante la selección de personaje. En Chrome, la medida
`performance.getEntriesByName('d1-enlace-hasta-dentro')` informa milisegundos desde la navegación
hasta estar dentro con mundo recibido y precarga lista (incluye el tiempo de interacción).
