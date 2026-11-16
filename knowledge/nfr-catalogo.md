# Catálogo de NFR (requisitos no funcionales)

Última revisión: 2026-11-05. Índice pedido por ADR-0043 §5. No duplica decisiones: dice qué pregunta responder y dónde está decidido. Se marca en la DoR de los briefs de Tier 2–3.

Convención: `knowledge/adr/` = KB-NNNN; `docs/adr/` = ADR-NNNN.

| Atributo                      | Pregunta a responder                                                           | Dónde está decidido                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Seguridad: secretos           | ¿Hay credenciales en código, logs o commits?                                   | ADR-0008                                                                                                       |
| Seguridad: entrada y webhooks | ¿Se valida toda entrada externa y se verifica la firma de los webhooks?        | ADR-0009                                                                                                       |
| Seguridad: agentes            | ¿Qué puede hacer un agente y qué contenido puede obedecer?                     | ADR-0044                                                                                                       |
| Rendimiento: caché            | ¿Qué se lee mucho y cambia poco? ¿Cómo se invalida?                            | [KB-0008](adr/0008-estrategia-de-cache.md)                                                                     |
| Escalado: lecturas            | ¿Réplica de lectura o caché?                                                   | [KB-0009](adr/0009-read-replicas-vs-cache.md)                                                                  |
| Escalado: escrituras          | ¿Qué escrituras pueden ir a una cola?                                          | [KB-0010](adr/0010-queues-y-workers-para-escrituras.md)                                                        |
| Escalado: abuso               | ¿Hay rate limiting distribuido en endpoints públicos?                          | ADR-0007                                                                                                       |
| Resiliencia                   | ¿Qué pasa si una dependencia externa se cuelga o falla?                        | [KB-0011](adr/0011-timeouts-y-circuit-breakers.md)                                                             |
| Mantenibilidad: tamaño        | ¿Módulos y funciones dentro del límite?                                        | ADR-0010                                                                                                       |
| Mantenibilidad: tipos         | ¿Hay `any` en fronteras externas?                                              | ADR-0011, ADR-0004                                                                                             |
| Calidad: rutas críticas       | ¿Las rutas de dinero, leads y auth tienen tests?                               | ADR-0012                                                                                                       |
| Calidad: cobertura            | ¿La cobertura sube o se mantiene?                                              | ADR-0025                                                                                                       |
| Calidad: terminado            | ¿Los tests son parte del DoD?                                                  | ADR-0029                                                                                                       |
| Configuración                 | ¿El valor va en código, env, DB o feature flag?                                | [KB-0012](adr/0012-donde-vive-cada-configuracion.md)                                                           |
| Despliegue                    | ¿Se despliega solo cuando cambia el código del servicio?                       | ADR-0041                                                                                                       |
| Costo                         | ¿Cuánto cuesta orientar a un agente? ¿Hay límites de gasto?                    | ADR-0015, ADR-0044 §5                                                                                          |
| Accesibilidad (UI)            | ¿Botones icon-only con `aria-label`, errores asociados al campo, foco visible? | Parcial: sección «Accesibilidad y estados de foco» de `packages/ui-conventions` (reglas de UI, sin ADR propio) |
| Observabilidad                | ¿Cómo se sabrá que falló en producción (logs, métricas, alertas)?              | Sin decisión                                                                                                   |
| Datos personales y privacidad | ¿Qué datos personales se guardan, con qué base legal y cuánto tiempo?          | Sin decisión                                                                                                   |
| Disponibilidad / SLO          | ¿Qué disponibilidad se promete y cómo se mide?                                 | Sin decisión                                                                                                   |
