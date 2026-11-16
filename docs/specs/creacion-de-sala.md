# Creación de sala: de cero a dentro, y modo construir

**Classification**: feat · large · med risk (formato guardado = contrato) · unknown (UX) · `apps/lab/src/creacion/`, `apps/lab/crear.html`, `packages/oficina/src/editor/`
**Tier**: 3 — Full
**Origen**: pedido del autor del 2026-11-14.

## Goal

Que alguien que llega por primera vez esté dentro de su propia sala en menos de 2 minutos (plantilla viva, nombre, personaje, agentes, invitar, entrar, primer minuto con pistas en el mundo) y que pueda construir su mundo dentro de la misma sala (tecla B): colocar, mover, girar y quitar objetos con rejilla, fantasma y avisos, con deshacer y guardado en el navegador.

## Assumptions made (correct me if wrong)

- Sin cuentas ni servidor: todo vive en `localStorage`; enlace de invitación y respuestas de agentes son de ejemplo, marcados así.
- La personalización del mundo va dentro de la sala (modo construir), no como paso de la entrada (lo pregunto en el guion; es barato de mover).
- La plantilla trae 3 agentes sugeridos ya sentados (editables y quitables).
- Mientras el motor no mueva muebles de la plantilla (pedido acordado con oficina-escenarios: `ajustesMuebles`), el modo construir mueve y quita solo lo que la persona agrega. El formato ya guarda `ajustesMuebles` para cuando llegue.
- Los objetos colocados se dibujan desde mi zona como `children` de `<Oficina>` (d842d66), con geometría propia en el estilo low-poly del motor.
- El chequeo de «bloquea el paso» es una rejilla propia del editor (0,25 m) sobre `escenario.colision(y)` + objetos, desde la entrada a cada zona; no usa la navegación del motor.
- Límites parametrizables con valor inicial: 60 objetos, rejilla 0,5 m, historia 100 pasos.

## Acceptance criteria

- [ ] Recorrido completo navegable en `crear.html` (5327): llegada con carga sin tirón → elegir plantilla viéndola viva → nombre → personaje con catálogo real, moviéndose → agentes → invitar → dentro, en ≤ 6 clics.
- [ ] Primer minuto: pistas en el mundo para caminar, correr, saltar, sentarse y hablarle a un agente; se apagan al cumplirse; sin modales.
- [ ] Modo construir con B o botón: catálogo por categoría, fantasma con rejilla, verde/rojo/ámbar con motivo, R gira, clic coloca, seleccionar → mover/girar/duplicar/quitar, ⌘Z/⇧⌘Z, Esc sale.
- [ ] Estilo (variante cuando el motor la exponga), qué muestra cada pantalla, puestos de agentes.
- [ ] Todo se guarda solo en el navegador como `SalaGuardada` versionada; exportar e importar JSON con errores legibles; importar un v1 lo migra.
- [ ] 390 px en cada paso; teclado y foco visibles; sin controles nativos (select, date, diálogos); sonido de interfaz apagado por defecto.

## Files & routes to touch (verified against code: yes)

- `packages/oficina/src/editor/` — nuevo — lógica pura (sin three ni DOM):
  - `catalogo.ts` — tipos de objeto colocable (`TipoObjeto`: tipo, nombre, categoria, ancho, fondo, alto, sentable?).
  - `formato.ts` — `SalaGuardada` (versión del formato 2), `migrarDefinicion(v1)`, `validarSala`, `aDefinicion(sala)` (proyección v1 que entiende `<Oficina>`), `serializarSala`, `parsearSala`.
  - `rejilla.ts` — ajustar a rejilla, giro en cuartos, huella girada.
  - `colocacion.ts` — `evaluarColocacion(objeto, contexto)` → libre | choca | bloquea | fuera, con motivo; chequeo de paso por relleno de rejilla.
  - `historia.ts` — deshacer y rehacer con tope.
  - `operaciones.ts` — colocar, mover, girar, quitar, duplicar, pantalla, puesto, variante (respetan límites).
  - `guardado.ts` — guardar/cargar con almacenamiento inyectable.
  - `index.ts` + reexport en `packages/oficina/src/index.ts` (solo líneas añadidas).
- `apps/lab/crear.html` + `apps/lab/src/creacion/` — nuevo — la página: pasos de la entrada, sala, pistas, modo construir, objetos 3D.
- `docs/adr/0012-formato-guardado-de-sala.md` — nuevo — Propuesto.

## Tests

- `packages/oficina/src/editor/*.test.ts` — un archivo por módulo; cada operación con su caso borde (límite alcanzado, objeto inexistente, choque contra muro, bloqueo de paso, migración v1, JSON inválido, versión futura, historia con tope).
- La interfaz se prueba en navegador real con Playwright y GPU (recorrido completo a 1440 y 390, video 60 fps).

## Pre-mortem

- **Caminos**: la sala entra por (a) onboarding nuevo, (b) carga desde localStorage, (c) importar JSON (v1 o v2), (d) deshacer/rehacer. Todos pasan por `validarSala`.
- **Fallas**: localStorage lleno, bloqueado o vacío (modo privado) → la sala sigue en memoria y se avisa «no se pudo guardar»; JSON malformado o de versión futura → error legible, no se pisa la sala actual.
- **Invariantes**: (1) nunca más objetos que `limites.maxObjetos`; (2) ids de objeto únicos; (3) `aDefinicion(sala)` siempre pasa `validarDefinicion`; (4) deshacer tras hacer devuelve el estado exacto; (5) un objeto colocado nunca queda «choca» (la operación lo rechaza).
- **Simetrías**: lo que valida colocar también valida mover, girar y duplicar.
- **Reutilización**: `validarDefinicion` (definicion.ts), `Escenario.colision`, `accionesDe`, `apps/lab/src/editor.ts` (agentes y atuendo), `Selector` del lab.
- **Consumidores**: `DefinicionOficina` la leen `definicionAProps` y el lab (App.tsx, Escenarios.tsx): no cambia; `SalaGuardada` es tipo nuevo.
- **Datos reales**: no hay datos guardados aún (nada en servidor); el formato v1 existe en `ejemploEquipo`/`ejemploEstudio` y en lo que exporta App.tsx → migración probada con ambos.
- **Variantes**: escenario mansión (varios niveles) vs trading/oficina (un nivel): el modo construir trabaja en el nivel de la entrada; mansión queda fuera del construir hasta que haya suelo por nivel en el editor.
- **Afirmaciones**: la interfaz marca «ejemplo» en enlace y respuestas de agente; nada dice «guardado en la nube».

## Out of scope

Paredes y planta libres; cuentas; servidor; multiusuario real; voz; agentes que respondan; permisos de construcción por rol.

## Design

Formato: ADR-0012. La sala (`SalaGuardada`) es la definición v1 de siempre más `mundo` (objetos, ajustes de muebles de la plantilla, contenido de pantallas, puestos, variante) y `equipo`. El motor sigue recibiendo `DefinicionOficina` v1 (`aDefinicion`); los objetos se dibujan como hijos de `<Oficina>` y, cuando escenarios entregue `solidosExtra`, también bloquean al avatar.

## Ejecución

| #   | Tarea                                               | Agente              | Modelo · esfuerzo | Archivos                                                   | Entrega               |
| --- | --------------------------------------------------- | ------------------- | ----------------- | ---------------------------------------------------------- | --------------------- |
| 1   | Lógica pura del editor con TDD                      | ejecutor            | sonnet · medium   | `packages/oficina/src/editor/**`, export en `src/index.ts` | diff + pruebas verdes |
| 2   | Página crear.html: entrada, sala, pistas, construir | mantenedor (diseño) | sesión            | `apps/lab/crear.html`, `apps/lab/src/creacion/**`          | navegable en 5327     |
| 3   | Verificación en navegador y video 60 fps            | mantenedor          | sesión            | scripts en el escritorio                                   | capturas + video      |

## Definition of Ready

- [x] Goal y criterios verificables.
- [x] Rutas verificadas contra el código.
- [x] Supuestos de alto impacto declarados (formato: ADR Propuesto).
- [x] Dependencias externas: oficina-escenarios (children ✔ d842d66; solidosExtra, ajustesMuebles, variantes en curso).
- [x] NFR: rendimiento (objetos instanciados, fantasma sin reconstruir la escena), accesibilidad (teclado, foco, 390 px), privacidad (solo navegador).

## Closing check

- Recorrido completo (criterio 1) → `crear.html` recorrido con Playwright y GPU a 1440 y 390 (capturas y video 60 fps en una carpeta local. Pruebas de datos: `apps/lab/src/creacion/plantillas.test.ts` (sala nueva válida para el motor en las 3 plantillas, nombres vacíos, cambio de plantilla).
- Primer minuto (criterio 2) → `misiones.test.ts`: orden, umbrales, teletransporte que no suma, salto contado por el mando (el motor no informa el arco; hallazgo al probar en el navegador), saltos previos que no cuentan.
- Modo construir (criterio 3) → `packages/oficina/src/editor/*.test.ts` (52): fuera, choca con mueble/objeto/puesto/entrada, cierra el paso, tope de objetos, duplicar sin hueco, historia con tope, deshacer exacto.
- Guardado (criterio 5) → `formato.test.ts` y `guardado.test.ts`: migración v1, versión futura rechazada, JSON inválido, almacenamiento que lanza.
- Invariantes: (1) tope → `operaciones.test.ts`; (2) ids únicos → `formato.test.ts`; (3) `aDefinicion` válida → `plantillas.test.ts` y `formato.test.ts`; (4) deshacer exacto → `historia.test.ts`; (5) nunca se coloca «choca» → `operaciones.test.ts`.
- Desvíos respecto del brief: estilo/variantes y muebles de la plantilla esperan a oficina-escenarios (acordado); el construir en la mansión queda fuera (varias plantas); los objetos aún no bloquean al avatar (espera `solidosExtra`).
