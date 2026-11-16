# 0001 — Alcance de la versión 1 de Jules Room

- **Estado:** Aceptado (2026-11-14)
- **Fecha:** 2026-11-14
- **Decisor:** Elkis

## Contexto

Jules Room nació como producto por suscripción (el modelo abierto llegó después, en el [ADR-0021](0021-modelo-abierto.md)): cada equipo arma su oficina 3D a su gusto, con sus agentes, y la comparte en vivo. Nace de dos trabajos de Elkis: el motor de la oficina de Jules (`packages/oficina`) y un prototipo anterior de sala de trading, de donde vienen ese escenario y varias ideas (paneles por agente, tareas con resultado, voz por cercanía, aula).

## Decisión

La versión 1 es para **equipos que comparten la oficina en vivo**:

| Qué                | En la v1                                                                                                                        | Después                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Personas           | Equipo con dueño e invitados, cada uno con su avatar y su posición en vivo                                                      | —                                                                   |
| Voz entre personas | Sí, por cercanía (y sala completa en salas cerradas)                                                                            | Cámara                                                              |
| Personaje          | **Uno solo: el personaje principal de Jules**, con vestuario por zonas y paquetes de skins                                      | Otros estilos                                                       |
| Oficina            | Editor: elegir y ubicar salas y muebles de un catálogo, y asignar puestos a personas y agentes (editor base de «oficina-motor») | Modelos generados con IA                                            |
| Agentes            | **Conversacionales**: nombre, rol, personalidad y memoria corta; responden y resumen cuando alguien les habla                   | Herramientas conectadas (correo, calendario, repos), voz del agente |
| Cursos             | Fuera del núcleo; opcional, como enlace a la plataforma de cursos                                                               | —                                                                   |
| Tamaño             | Cimientos para salas de hasta ~100 personas; se construye y prueba para equipos chicos                                          | Salas de más de 100                                                 |

## Consecuencias

- Lo que diferencia a la v1 es lo visual y lo social (oficina propia, presencia, voz). Que los agentes solo conversen deja fuera los permisos, la ejecución de acciones y el costo variable de las herramientas.
- El motor tiene que manejar dos tipos de ocupante: el agente y la persona con posición externa. «oficina-motor» ya lo implementó en `feat/motor` (`7791b1a`).
- Agregar herramientas a los agentes más adelante reusa el cerebro de Jules (riesgo, aprobación y cuarentena de entradas), que ya existe y tiene pruebas.

## Respaldo

Criterio general: la knowledge base no cubre el alcance de producto. Calibrado a la escala real con `knowledge/BEST-PRACTICES.md`.
