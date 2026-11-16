# ADR-0021 — Jules Room como proyecto abierto, con nube propia después

Estado: aceptado. Fecha: 2026-11-16. Decide: Elkis.

## Contexto

Jules Room nació el 2026-11-14 como producto por suscripción en un repositorio privado (ADR 0001 y 0008). Dos días después Elkis decidió abrirlo: que cualquiera pueda instalarlo, modificarlo y aportar, y que más adelante exista un servicio alojado propio para quien no quiera instalar nada.

Antes de decidir se revisó el repositorio: sin secretos en el historial, 89 dependencias de producción con licencias permisivas (MIT, Apache, BSD, ISC), texturas CC0 de Poly Haven, fuente Figtree con licencia OFL y modelos generados por código.

## Decisión

| Tema                        | Elección                                                                                                                                        |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Licencia                    | **AGPL-3.0-only** para todo el repositorio                                                                                                      |
| Alcance                     | Se abre todo lo que existe: motor, sala, presencia, agentes y laboratorio                                                                       |
| Lo que queda privado        | Solo lo que nazca para operar la nube (cobro, facturación, panel de operación), en un repositorio aparte                                        |
| Historial                   | El repositorio público empieza con un primer commit limpio; el privado queda de archivo                                                         |
| Marca                       | El código es libre; el nombre Jules Room, el logo y el personaje de Jules están reservados ([TRADEMARK.md](../../TRADEMARK.md))                 |
| Aportes                     | Quien aporta acepta un acuerdo corto de contribución ([CLA.md](../../CLA.md))                                                                   |
| Colaboración                | Todo el código acepta aportes desde el primer día                                                                                               |
| Idioma                      | Español primero; README y guía de inicio también en inglés                                                                                      |
| Nube                        | Cobra por tener el mismo producto ya funcionando (salas alojadas, voz, créditos de agentes, respaldos); ninguna función es exclusiva de la nube |
| Escenario «Sala de trading» | Se publica con el resto; Elkis confirmó que es suyo                                                                                             |

## Por qué

- **AGPL y no una licencia permisiva:** quien ofrezca Jules Room como servicio tiene que publicar sus cambios. Protege la nube futura sin dejar de ser código abierto reconocido por la OSI, a diferencia de agregar una cláusula que prohíba revender o de usar una licencia «fair source».
- **CLA:** permite combinar los aportes con las piezas privadas de la nube y cambiar de licencia si algún día hace falta, sin pedir permiso a cada persona.
- **Marca reservada:** evita que otra instalación se presente como la oficial.
- **Historial limpio:** los 247 commits del repositorio privado traen briefs y coordinación interna que no aportan a quien llega.
- **Nube sin funciones exclusivas:** la comunidad no compite con un producto recortado; se paga por comodidad y por lo que cuesta servir (tiempo conectado con voz y uso de modelos).

## Consecuencias

- Los ADR 0001 a 0020 siguen vigentes en lo técnico. Del [0008](0008-planes-y-cobro.md) cambia el marco: los planes y el cobro describen la nube futura, no el único modo de usar el producto.
- La regla del [0009](0009-configuracion.md) (valores por defecto en el código, reemplazo en la base, secretos en variables de entorno) pasa a ser también la garantía de que una instalación propia funciona sin tocar código.
- El atuendo de fundador ([0018](0018-catalogo-ampliado-y-fundador.md)) deja de ser exclusivo en la práctica: con el código abierto cualquiera puede activarlo en su instalación. El hash nunca fue una autorización.
- Cada cambio en las piezas abiertas que use la nube se publica aquí. Lo privado se comunica con lo abierto por interfaces, no por parches al motor.
- Mantener la guía de instalación probada desde un clon limpio pasa a ser parte de «terminado».

## Alternativas descartadas

- **Apache-2.0 o MIT:** cualquiera podría cerrar el código y vender su nube sin devolver nada.
- **AGPL con prohibición de revender (el camino de WorkAdventure) o FSL:** más protección, pero ya no es código abierto y varios directorios lo listan como no libre.
- **Abrir solo el motor:** poca gente podría usarlo de verdad.
- **Publicar el historial completo:** muestra cómo se construyó con agentes, pero deja público para siempre material interno.
- **Funciones exclusivas de la nube:** más ingreso por cliente y roce permanente con quienes aportan.

## Cuándo revisar

- Si un tercero ofrece Jules Room alojado sin publicar cambios: revisar si la AGPL basta.
- Si el CLA frena aportes de forma visible: evaluar pasar a DCO.
- Si la nube no cubre su costo de servir: revisar la decisión de no tener funciones exclusivas.
