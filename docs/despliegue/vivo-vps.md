# Despliegue de LiveKit en VPS propio (sala en vivo)

Guía verificable para autoalojar la señalización y el media de Jules Room en un VPS Ubuntu 24.04 que ya corre Coolify con Traefik en 80/443. El front sigue en Vercel; este stack no sirve HTML.

Referencias oficiales revisadas al redactar (2026-11-15):

- [Deployment](https://docs.livekit.io/transport/self-hosting/deployment/)
- [Ports and firewall](https://docs.livekit.io/transport/self-hosting/ports-firewall/)
- [Benchmarking y load-test](https://docs.livekit.io/transport/self-hosting/benchmark/)
- [livekit-cli perf load-test](https://docs.livekit.io/reference/developer-tools/livekit-cli/perf/)

Archivos del repo: `infra/vivo/docker-compose.yml`, `infra/vivo/livekit.yaml`, `infra/vivo/.env.example`.

## Decisión de proxy (por qué Traefik y no un proxy nuevo)

| Pieza                          | Dónde termina TLS                                | Motivo                                                                                                                                            |
| ------------------------------ | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Señalización WebSocket (`wss`) | **Traefik de Coolify** → `http://127.0.0.1:7880` | LiveKit recomienda 7880 detrás de un balanceador con TLS. Reusar Traefik no abre un segundo listener en 443 ni compite con el resto de productos. |
| Media WebRTC (UDP/TCP ICE)     | **Directo al proceso LiveKit** (red `host`)      | El RTP no pasa por reverse proxy HTTP. `network_mode: host` es la recomendación de LiveKit en Docker.                                             |
| TURN/TLS                       | **LiveKit integrado en 5349**                    | Traefik ya ocupa 443; usar `turn.tls_port: 5349` evita romper Coolify. Certificados vía `LIVEKIT_TURN_CERT` / `LIVEKIT_TURN_KEY`.                 |

No levantes Caddy ni nginx solo para LiveKit salvo que Traefik no pueda enrutar WebSocket a loopback (caso raro en Coolify).

## Puertos y firewall

| Puerto | Protocolo | Exponer a internet                | Uso                                                   |
| ------ | --------- | --------------------------------- | ----------------------------------------------------- |
| 7880   | TCP       | **No** (solo Traefik en loopback) | API y WebSocket internos                              |
| 7881   | TCP       | Sí                                | ICE/TCP fallback                                      |
| 7882   | UDP       | Sí                                | WebRTC multiplexado (`rtc.udp_port`)                  |
| 3478   | UDP       | Sí                                | TURN/UDP integrado (+ STUN)                           |
| 5349   | TCP       | Sí                                | TURN/TLS integrado                                    |
| 6380   | TCP       | No                                | Redis local del stack                                 |
| 6789   | TCP       | No                                | Prometheus (`prometheus_port`; solo métricas locales) |

Ejemplo UFW (ajusta la interfaz):

```bash
sudo ufw allow 7881/tcp comment 'LiveKit ICE TCP'
sudo ufw allow 7882/udp comment 'LiveKit WebRTC mux'
sudo ufw allow 3478/udp comment 'LiveKit TURN UDP'
sudo ufw allow 5349/tcp comment 'LiveKit TURN TLS'
# No abras 7880 ni 6380 al mundo.
```

## DNS

Subdominio de ejemplo: `vivo.tu-dominio.com` (señalización). Para TURN, crea un registro **A** adicional (p. ej. `turn-vivo.tu-dominio.com`) apuntando al mismo VPS y actualiza `turn.domain` en `infra/vivo/livekit.yaml` para que coincida con el certificado.

## Preparación en el servidor

1. Clona o copia el repo y entra a `infra/vivo/`.
2. `cp .env.example .env` y completa claves (nunca en git).
3. Genera `LIVEKIT_API_KEY` y `LIVEKIT_API_SECRET` (32+ caracteres aleatorios).
4. Edita `livekit.yaml`: `turn.domain` = FQDN del TURN con certificado válido.
5. Apunta `LIVEKIT_TURN_CERT` y `LIVEKIT_TURN_KEY` a los PEM de Let's Encrypt (o sincronízalos desde el volumen de Traefik si Coolify renueva ahí).

## Traefik (ruta de señalización)

Añade un router HTTP(S) hacia el backend local (ejemplo de concepto; el path exacto depende de cómo gestiones Traefik en Coolify):

```yaml
# Fragmento para el file provider o “Dynamic configuration” de Traefik
http:
  routers:
    jules-vivo-senal:
      rule: Host(`vivo.tu-dominio.com`)
      entryPoints: [websecure]
      tls:
        certResolver: letsencrypt
      service: jules-vivo-senal
  services:
    jules-vivo-senal:
      loadBalancer:
        servers:
          - url: http://127.0.0.1:7880
```

Comprueba WebSocket: `curl -sI https://vivo.tu-dominio.com` debe devolver TLS válido; la conexión real la valida el cliente LiveKit.

## Levantar el stack

```bash
cd infra/vivo
docker compose --env-file .env up -d
docker compose ps
```

Validación local de sintaxis (desde el repo, con `.env` temporal o variables de prueba):

```bash
docker compose -f infra/vivo/docker-compose.yml config
```

## Comprobaciones

### Salud básica

Desde el VPS, con claves del `.env`:

```bash
export LIVEKIT_URL=wss://vivo.tu-dominio.com
# Instala lk si falta: https://docs.livekit.io/reference/developer-tools/livekit-cli/
lk room list --url "$LIVEKIT_URL" --api-key "$LIVEKIT_API_KEY" --api-secret "$LIVEKIT_API_SECRET"
```

### Prueba de carga ~20 participantes con audio

En una máquina con buen CPU y `ulimit -n 65535`:

```bash
lk perf load-test \
  --url "$LIVEKIT_URL" \
  --api-key "$LIVEKIT_API_KEY" \
  --api-secret "$LIVEKIT_API_SECRET" \
  --room prueba-20 \
  --audio-publishers 20 \
  --duration 5m
```

En Jules Room el caso real mezcla publicación y suscripción selectiva por cercanía (ADR-0006); este test es el peor caso de **20 voces publicadas**, útil para dimensionar CPU en el VPS compartido.

### Uso de CPU y red en el VPS

```bash
docker stats jules-vivo-livekit-1
# Métricas LiveKit (solo localhost):
curl -s http://127.0.0.1:6789/metrics | head
# Red:
sudo apt install -y iftop   # iftop -i eth0
# CPU por proceso:
top -p "$(pgrep livekit-server)"
```

Criterio orientativo para **20 personas, solo audio**: ~0,5–1,5 vCPU sostenidos y cientos de kbps–pocos Mbps según suscripciones; si CPU del contenedor se acerca al límite `1.5` del compose, baja vecinos ruidosos o sube el límite con medición.

## Dimensionamiento

| Escala  | Audio aprox.                               | CPU LiveKit (4 vCPU VPS)                | RAM         | Notas                                                                              |
| ------- | ------------------------------------------ | --------------------------------------- | ----------- | ---------------------------------------------------------------------------------- |
| **20**  | Todos hablan a la vez (prueba)             | 1–1,5 núcleos reservados en compose     | 512 MB–1 GB | Encaja con ~5,9 GB libres si el límite `mem_limit: 2g` no se dispara.              |
| **100** | Diseño ADR-0006 (suscripción por cercanía) | 2–3+ núcleos; revisar benchmark oficial | 2–4 GB      | Probablemente requiera VPS dedicado o segunda instancia; disparador ADR-0006/0010. |

Redis en `6380` es ligero (límite 128 MB en compose). LiveKit lo usa para estado distribuido; en una sola réplica sigue siendo la configuración recomendada en producción.

## Riesgos

- **Vecinos ruidosos**: otros contenedores en el mismo VPS pueden consumir CPU; los límites de `docker-compose` protegen parcialmente, no garantizan QoS del kernel.
- **UDP bloqueado**: redes corporativas; sin TURN/UDP (3478) o TURN/TLS (5349) el cliente puede conectar señal pero sin audio. El cliente en producción debe usar `iceServers` por defecto de LiveKit (no `iceServers: []` como en local).
- **Puerto 7880 expuesto por error**: cualquiera podría intentar señalización sin TLS; mantén 7880 en loopback + Traefik.
- **Token abierto**: el emisor actual no autentica (ver abajo); LiveKit solo confía en tokens firmados, pero quien obtenga un token entra a la sala.

## Revertir

```bash
cd infra/vivo
docker compose down
# Quita la ruta Traefik de jules-vivo-senal y opcionalmente las reglas UFW anteriores.
```

Los datos de salas en vivo son efímeros; no hay migración de estado en Redis que conservar para rollback.

## Servicio de tokens (qué desplegar)

| Componente                                            | ¿Desplegar en VPS? | Notas                                                                 |
| ----------------------------------------------------- | ------------------ | --------------------------------------------------------------------- |
| `livekit-server` (este compose)                       | **Sí**             | Media + señalización.                                                 |
| `apps/sala/server/app.ts` (`crearApp`, `emitirToken`) | **Sí**             | Emisor JWT LiveKit; hoy expone `GET /api/token` sin auth.             |
| `apps/lab/servidor/main.ts`                           | **No** (completo)  | Mezcla tokens (8797) y agentes (8798); agentes van aparte (ADR-0007). |
| `apps/agentes-lab/servidor`                           | No para presencia  | Solo conversación con LLM en la demo local.                           |

Variables del emisor de tokens en producción:

- `LIVEKIT_URL` = `wss://vivo.tu-dominio.com` (o el dominio final)
- `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` = mismos que `LIVEKIT_KEYS` del compose
- `NODE_ENV=production` (obliga las tres variables; ver `leerConfigLiveKit`)
- CORS / origen: hoy la app asume mismo origen (`/vivo` proxy en Vite); en Vercel el emisor debe vivir en la **API** (`apps/api`) o en un microservicio Hono con `origenesPermitidos` del front.

### Qué falta para no depender del dueño conectado ni del enlace sin auth

Estado en `main` (sala local, ADR-0017):

1. **Token sin autenticación**: cualquiera con `GET /api/token?sala=…&identidad=…&nombre=…` entra; no hay sesión ni membresía de equipo.
2. **Dueño por URL** (`dueno` en query + `sessionStorage`): el invitado confía en un id en el enlace; no hay verificación servidor.
3. **Mundo por datachannel**: el dueño debe estar conectado para reenviar `SalaGuardada`; sin API de oficinas en el flujo vivo.
4. **URL LiveKit fija en cliente**: `useEnVivo.ts` usa `ws://127.0.0.1:7880` e `iceServers: []`; `lite.ts` arma URL desde el hostname de la página.

Ramas de cuentas (revisadas con `git log` / `git show`, sin fusionar):

- **`feat/cuentas-y-guardado`**: `apps/api` con cuentas, equipos y CRUD de oficinas (`routerOficinas`) autenticado; **no** incluye endpoint LiveKit ni nombres de sala `org:…:oficina:…` aún.
- **`feat/cuentas-interfaz`**: UI web de cuentas y flujos E2E; **tampoco** cablea tokens LiveKit ni sustituye el enlace `dueno`.

Camino esperado para producción:

1. Endpoint autenticado en `apps/api` que emita token (reutilizar `emitirToken`) solo si la sesión pertenece al equipo de la oficina.
2. Nombre de sala estable desde ids de organización/oficina (ADR-0006).
3. Cargar mundo desde API (`feat/cuentas-y-guardado`), no desde el dueño en vivo.
4. Cliente: `LIVEKIT_URL` / `VITE_LIVEKIT_URL` y RTC por configuración; quitar `iceServers: []` fuera de loopback.
5. Invitaciones firmadas o de un solo uso en lugar de query `dueno`.

### Lista de cambios pendientes en el cliente (producción)

- [ ] URL del servidor LiveKit por variable de entorno, no `127.0.0.1` ni puerto inferido solo del hostname.
- [ ] Obtener token desde la API autenticada (cookie o bearer), no proxy `/vivo` local.
- [ ] Configuración ICE/TURN por defecto del SDK (servidor integrado), no lista vacía.
- [ ] Identidad estable ligada a cuenta, no UUID aleatorio por pestaña.
- [ ] Sincronización de sala desde API; dueño puede desconectarse sin vaciar el mundo.

## Actualizar ADR-0010

Cuando este despliegue esté validado en el dominio real, conviene enmendar ADR-0010: la fila «Tiempo real y voz» pasaría de LiveKit Cloud a LiveKit autoalojado en el VPS, con disparador de costo/bandwidth documentado aquí.

## Prueba real del 15-11-2026 (VPS compartido de 4 vCPU / 16 GB)

- Ruta del proxy: en Coolify el backend es `http://host.docker.internal:7880` (Traefik corre en contenedor), con entrypoints `http`/`https` y un archivo propio en el directorio dinámico del proxy.
- Primera pasada con TURN solo por UDP (3478); el TURN por TLS (5349) queda pendiente de certificado propio.
- `lk perf load-test` desde fuera del VPS, 20 voces publicando + 20 oyentes, 2 min: 0 errores de conexión, 0 % de pérdida, LiveKit 31–43 % de un núcleo y ~300 MB; red del host ~6 Mbps de salida. Cada oyente recibió 6 de las 20 pistas a la vez (límite no aclarado de la herramienta).
- Con `room.max_participants: 25` una prueba de 40 conexiones rechaza las que pasan del tope («could not establish signal connection»): súbelo solo para la prueba.
- Pendiente de endurecer: 7880 y 6789 escuchan en todas las interfaces y el host no tiene firewall activo; el búfer UDP del sistema es menor que el sugerido por LiveKit.
