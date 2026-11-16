# Jules Room

Jules Room es una sala 3D compartida que se abre en el navegador. Tu equipo camina con su personaje, habla por cercanía y conversa con agentes de IA. Cada persona arma su sala con mundos (plantillas), muebles y atuendos.

Está hecha con React Three Fiber y LiveKit. El código es abierto bajo AGPL-3.0.

[English version](README.en.md)

## Qué puedes hacer hoy

- Crear una sala a partir de cuatro mundos: Trading, Oficina, Mansión y Auditorio.
- Elegir nombre, personaje y atuendo.
- Invitar a otra persona con un enlace: recibe tu mundo y tus muebles.
- Hablar con voz por cercanía: oyes a quien tienes cerca y dejas de oírlo al alejarte.
- Hablar con agentes de IA acercándote y pulsando E, o escribiendo `@Nombre mensaje`.
- Cambiar muebles y estilos en el modo construir, y guardar la sala en tu navegador.

## Levantarlo en local

Necesitas Node 22 (la versión con la que se prueba), pnpm 10 (el repo fija `pnpm@10.0.0`) y `livekit-server` disponible en tu PATH.

```sh
pnpm install
pnpm dev:sala
```

Abre http://localhost:5352/crear.html. Hay una guía con más detalle en [docs/guia-de-inicio.md](docs/guia-de-inicio.md).

Sin clave de modelo, los agentes responden con un proveedor simulado y la interfaz lo indica.

## Estructura del repo

| Ruta                 | Qué es                                                             |
| -------------------- | ------------------------------------------------------------------ |
| `packages/oficina`   | Motor 3D: mundos, muebles, atuendos, animación y editor de salas   |
| `packages/presencia` | Posiciones y voz por cercanía sobre LiveKit                        |
| `packages/agentes`   | Conversación con agentes, proveedor de Claude y proveedor simulado |
| `apps/lab`           | Aplicación web: creación de sala, entrada y laboratorio del motor  |
| `apps/sala`          | Servidor de tokens de LiveKit y cliente de la sala                 |
| `apps/agentes-lab`   | Servidor de agentes y sala de pruebas de conversación              |
| `docs/`              | Guías, decisiones de arquitectura (`docs/adr/`) y especificaciones |

## Estado del proyecto

Funciona en local: sala compartida entre navegadores, voz por cercanía, agentes con respuesta en streaming, editor de muebles y estilos, y atuendos.

Todavía no existe:

- Cuentas ni inicio de sesión. Quien crea la sala debe permanecer conectado para compartir su mundo.
- Guardado en servidor. La sala se guarda en el navegador.
- Cobro de ningún tipo.
- Una instalación lista para producción: faltan TLS, historial compartido, cuotas autenticadas, observabilidad y pruebas de red y carga.

Más adelante habrá una nube oficial que cobrará por tener lo mismo ya funcionando. Ninguna función será exclusiva de ella.

## Aportar

Todo el código acepta aportes. Empieza por [CONTRIBUTING.md](CONTRIBUTING.md). El primer PR pide aceptar el [CLA](CLA.md). La convivencia se rige por el [código de conducta](CODE_OF_CONDUCT.md). Para vulnerabilidades, mira [SECURITY.md](SECURITY.md).

## Licencia y marca

El código se distribuye bajo [AGPL-3.0-only](LICENSE). El nombre Jules Room, el logo y el personaje de Jules están reservados: lee [TRADEMARK.md](TRADEMARK.md). Las decisiones detrás de este modelo están en [docs/adr/0021-modelo-abierto.md](docs/adr/0021-modelo-abierto.md).
