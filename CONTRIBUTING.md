# Cómo aportar a Jules Room

Gracias por querer aportar. Todo el código del repositorio acepta cambios desde el primer día.

## Antes de empezar

- Para un cambio grande (una función nueva, un cambio de arquitectura), abre primero un issue y cuéntanos la idea. Así evitas trabajo que no encaje.
- Para un arreglo pequeño, una corrección de texto o un mundo, mueble o atuendo nuevo, puedes abrir el PR directamente.
- Las decisiones de arquitectura viven en `docs/adr/`. Léelas si tu cambio toca algo de fondo, en especial [0021](docs/adr/0021-modelo-abierto.md).
- Para levantar el proyecto, sigue la [guía de inicio](docs/guia-de-inicio.md).

## Ramas y commits

- Trabaja en una rama propia a partir de `main`.
- Los commits siguen [Conventional Commits](https://www.conventionalcommits.org/es/): `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`, `style:`, `perf:`, `ci:`, `revert:`. El repo valida el mensaje con commitlint y husky.
- Cada commit es una idea completa. El mensaje explica el porqué, no solo el qué.
- Husky también corre lint-staged antes de cada commit.

## Pruebas

- Primero la prueba, después el código. Toda función o comportamiento nuevo lleva su prueba junto al código (`archivo.ts` y `archivo.test.ts`).
- Mientras desarrollas, corre solo las pruebas de lo que tocas. Por ejemplo, para el motor:

  ```sh
  pnpm -F @oficina/motor test
  pnpm -F @oficina/motor exec vitest run src/catalogo/paquetes.test.ts
  ```

- Antes de abrir el PR, corre typecheck y lint de lo que cambiaste, o de todo el repo:

  ```sh
  pnpm typecheck
  pnpm lint
  ```

- Sin código muerto: borra lo que no uses, en lugar de comentarlo.

## Por dónde es más fácil empezar

Los mundos, los muebles y los atuendos son datos. Agregar uno rara vez toca la lógica del motor.

| Qué                                    | Dónde                                                                             |
| -------------------------------------- | --------------------------------------------------------------------------------- |
| Atuendos y paquetes de ropa            | `packages/oficina/src/catalogo/` (`colecciones.ts`, `halloween.ts`, `navidad.ts`) |
| Muebles y piezas de construcción       | `packages/oficina/src/editor/` (`ampliacion.ts`, `catalogo.ts`)                   |
| Mundos y sus planos                    | `packages/oficina/src/escenarios/` (`oficina/`, `auditorio/`, `mansion.ts`)       |
| Plantillas de sala y agentes sugeridos | `apps/lab/src/creacion/plantillas.ts`                                             |

Mira cómo están hechas las piezas existentes y copia su forma. Cada una trae su prueba al lado.

## Idioma

El código, los commits y la mayoría de los documentos están en español. Puedes escribir issues y PR en español o en inglés.

## CLA

El primer PR pide aceptar el [CLA](CLA.md) marcando la casilla de la plantilla. Es un acuerdo corto: conservas la autoría y nos das permiso para usar tu aporte, incluido el servicio alojado oficial.

## Trabajar con agentes de IA

Puedes usar agentes de IA para escribir código. El repo tiene un [AGENTS.md](AGENTS.md) con las convenciones. Quien abre el PR responde por el código: léelo, pruébalo y entiéndelo antes de enviarlo.

## Conducta y seguridad

Al participar aceptas el [código de conducta](CODE_OF_CONDUCT.md). Para vulnerabilidades no abras un issue: sigue [SECURITY.md](SECURITY.md).

## In English

All code accepts contributions from day one. Open an issue first for large changes. Use Conventional Commits (commitlint and husky check them), write tests next to the code (test first), and run the tests of what you touch plus `pnpm typecheck` and `pnpm lint` before opening a PR. Worlds, furniture and outfits are data: start in `packages/oficina/src/catalogo/`, `packages/oficina/src/editor/` and `packages/oficina/src/escenarios/`. Issues and PRs in English are welcome. Your first PR asks you to accept the [CLA](CLA.md) by ticking the box in the PR template. AI agents are fine (see [AGENTS.md](AGENTS.md)), but whoever opens the PR is responsible for the code. See [README.en.md](README.en.md) and [docs/getting-started.md](docs/getting-started.md) to run the project.
