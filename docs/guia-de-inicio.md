# Guía de inicio

De un clon limpio a una sala funcionando en tu máquina. English version: [getting-started.md](getting-started.md).

## Requisitos

- Node 22 (la versión con la que se prueba).
- pnpm 10. El repo fija `pnpm@10.0.0` en `packageManager`.
- `livekit-server` en tu PATH. Es el servidor de voz y posiciones; `pnpm dev:sala` lo lanza en modo desarrollo. Instálalo siguiendo la documentación de LiveKit.
- Un navegador moderno con WebGL. Para probar la voz, un micrófono.

## Pasos

1. Clona el repositorio y entra en la carpeta.
2. Instala las dependencias:

   ```sh
   pnpm install
   ```

3. Levanta la sala completa desde la raíz:

   ```sh
   pnpm dev:sala
   ```

4. Abre http://localhost:5352/crear.html.

`pnpm dev:sala` inicia tres servicios: LiveKit, el servidor de tokens y agentes, y la web. Usa estos puertos, solo en loopback: web 5352, tokens 8797, agentes 8798, LiveKit 7880 (señal), 7881 (TCP) y 7882 (UDP). Si alguno está ocupado, el script falla sin tocar el proceso que lo usa. Ctrl+C termina lo que inició.

## Crear tu sala y entrar con un segundo navegador

1. En `crear.html` elige un mundo, un nombre, un personaje y los agentes. Avanza hasta el paso «Invitar».
2. Copia el enlace de invitación y entra tú primero. Quien crea la sala debe permanecer conectado, porque comparte su mundo y sus muebles.
3. Abre el enlace en otro navegador o en otro perfil. La persona invitada elige nombre y ropa, y recibe el mundo y los muebles del dueño.
4. Acerca los dos personajes y pulsa «Usar mi voz». La explicación aparece antes de que el navegador pida permiso de micrófono. Si caminas más de 5,625 metros, dejas de oír al otro.

Para hablar con un agente, acércate y pulsa E, o escribe `@Nombre hola` con el nombre de un agente de tu mundo.

## Modelo de IA: simulado o con tu clave

Sin clave, los agentes usan un proveedor simulado y la interfaz lo indica. No necesitas nada más para probar.

Para usar Claude con tu propia clave, el servidor busca un archivo `.env` fuera del repo, en `~/.config/oficina-agentes/.env`, con la variable `ANTHROPIC_API_KEY`. El servidor la lee en memoria; no la copia ni la registra. Reinicia `pnpm dev:sala` después de crearlo.

Para forzar el proveedor simulado aunque tengas clave:

```sh
SALA_SIMULADA=1 pnpm dev:sala
```

## Pruebas, typecheck y lint

Desde la raíz:

```sh
pnpm test
pnpm typecheck
pnpm lint
```

Para una sola app o paquete, por ejemplo el motor:

```sh
pnpm -F @oficina/motor test
```

Las pruebas en navegador de la sala necesitan Chrome instalado y la sala corriendo con `SALA_SIMULADA=1 pnpm dev:sala`. En otra terminal:

```sh
node apps/sala/e2e/envivo.mjs --video
node apps/sala/e2e/resiliencia-envivo.mjs
```

## Problemas comunes

- **Puerto ocupado.** El script falla con «Puerto N ocupado». Cierra lo que lo usa y vuelve a intentar.
- **`livekit-server` no se encuentra.** Comprueba que el comando funcione en tu terminal antes de lanzar `pnpm dev:sala`.
- **No oyes al otro personaje.** Acércalos. La voz entra a 4,5 m y se corta a más de 5,6 m. Revisa también el permiso de micrófono del navegador.
- **Los agentes responden con textos de ejemplo.** No hay clave configurada, o `SALA_SIMULADA=1` está activo.
- **Sin servicios de voz.** `pnpm --filter @oficina/lab dev --port 5352` abre la sala individual, sin sala compartida.

El detalle técnico del arranque, la pizarra y las pruebas de extremo a extremo está en [apps/lab/servidor/README.md](../apps/lab/servidor/README.md). Lo que aún no existe (cuentas, guardado en servidor, cobro) está en el [README](../README.md).
