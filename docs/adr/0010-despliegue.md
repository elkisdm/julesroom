# 0010 — Despliegue: front en Vercel y API en el VPS con Coolify

- **Estado:** Aceptado (2026-11-14)
- **Fecha:** 2026-11-14
- **Decisor:** Elkis

## Contexto

Lo personal de Elkis corre en su VPS de Hostinger con Coolify, y los front en su cuenta personal de Vercel. Jules ya se despliega con Docker Compose en Coolify.

## Decisión

| Pieza             | Dónde                                                   |
| ----------------- | ------------------------------------------------------- |
| `apps/web` (Next) | Vercel, cuenta personal de Elkis                        |
| `apps/api` (Hono) | VPS con Coolify, contenedor Docker                      |
| Worker de pg-boss | VPS con Coolify, mismo código, otro proceso             |
| Postgres          | VPS con Coolify, con respaldo diario fuera del servidor |
| Tiempo real y voz | LiveKit Cloud (0006)                                    |
| Modelo            | API de Anthropic (0007)                                 |

- **Dominio (decidido por Elkis):** por ahora no se compra uno. El front queda en el dominio de Vercel o en un subdominio de `elkis.dev` (p. ej. `front.tu-dominio.com`; en Vercel basta `domains add`, sin registro DNS). La API va en otro subdominio de `elkis.dev`, con CORS solo al dominio del front. Trigger: comprar un dominio propio al abrir la venta pública.
- Un push a `main` no despliega a producción sin un «dale» explícito de Elkis.

## Consecuencias

- El costo fijo es casi cero: el VPS ya existe y Vercel tiene capa gratuita.
- El VPS es un punto único de falla. Es aceptable a esta escala, con respaldo y una restauración ya probada.
- **Trigger:** si la API pasa de ~70 % de CPU sostenido o la base de ~70 % de disco, se sube el VPS o la base sale a un servicio administrado.

## Respaldo

`knowledge/adr/0007-serverless-vs-servidor-dedicado.md` (modelo híbrido).
