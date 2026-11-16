# Infraestructura de voz y demo

- `docker-compose.yml`: LiveKit/Redis existentes y servicio independiente `emisor`.
- `livekit.yaml`: configuración base; conserva los ajustes verificados del VPS al integrar.
- `Dockerfile.emisor`: bundle de producción sin el servidor local de agentes.
- `.env.example`: variables privadas del servidor y límites iniciales.

Sigue `docs/despliegue/demo-en-vivo.md` para agregar sólo el emisor a una instalación existente,
configurar el proxy y compilar la página. `docs/despliegue/vivo-vps.md` conserva la guía del servidor
de voz original. No reemplaces `.env` ni levantes todo el stack en el VPS ocupado por copiar archivos.
