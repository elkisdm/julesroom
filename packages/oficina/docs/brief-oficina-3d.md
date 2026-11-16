# Brief · Oficina 3D en React Three Fiber (paquete + laboratorio)

**Clasificación**: feat · large · riesgo med (contrato `<Oficina>` que consume asistente-demo; rendimiento en iPhone) · incertidumbre `unknown` en rendimiento móvil, `known` en el resto · toca `packages/oficina/`, `apps/oficina-lab/`
**Tier**: 3 — Full. Sin preguntas bloqueantes: todo lo no inferible queda como supuesto.

## Objetivo

Pasar el prototipo aprobado (`docs/prototipos/oficina-v3.html`) a un paquete React reutilizable, `@oficina/motor`, con personajes pulidos y 60 FPS con 30 personas, más un laboratorio en `http://localhost:5180` donde se ve y se mide. La demo monta `<Oficina>` sin conocer el motor interno.

## Hallazgos de la exploración

- El repo tiene solo el bootstrap (devground): workspace pnpm con `apps/*` y `packages/*`, sin `node_modules` ni código. El vitest raíz solo recoge `*.test.js`; la zona raíz es de quien integra, así que el paquete trae **su propia** config de vitest y de TypeScript.
- El prototipo (978 líneas) mezcla datos (catálogo, elenco, tareas), construcción de mallas, animación y UI en un solo archivo. Cada persona son ~25 mallas; 30 personas ≈ 750 draw calls más sombras: **no pasa en iPhone** (la investigación sugiere <80 draw calls de escena). Hay que bajarlo por instancing o fusión.
- Cuello de botella ya visible en el prototipo: regenera texturas de canvas por parpadeo y por estado dentro del bucle (`drawFace`, `stateIcon`), y no se detiene cuando no se ve.
- Piernas sin rodilla articulada (muslo y pantorrilla son parte del mismo grupo y solo gira la cadera), brazos sin codo: de ahí lo que Elkis pide pulir.
- La investigación (`docs/base/oficina-3d-investigacion.md`) fija: three.js + R3F, parar el bucle cuando no se ve, DPR tope, sombra falsa tipo blob, estados desde `agent_events`. Remotion marca `WebGPURenderer` como experimental.

## Supuestos (corrígeme si alguno está mal)

- Renderer **WebGL2** en v1 (estable, el mismo del prototipo aprobado). WebGPU queda para una etapa posterior, tras medir.
- three `0.169.x` como el prototipo, salvo que R3F 9 exija otra; la versión se fija exacta, sin rangos.
- Todo procedural, sin modelos pagados ni generación con IA 3D. No hay gasto nuevo en esta etapa.
- «Medido en Safari de iPhone» exige un iPhone: lo mido en Chrome de escritorio con CPU a 4× y 6× de estrangulamiento como sustituto, y dejo el lab accesible por red local (`--host`) para que Elkis lo abra en su teléfono y lea el mismo panel de FPS. Lo que no pueda medir yo, lo declaro como no medido.
- El catálogo de vestuario sigue siendo el del prototipo (piezas procedurales), pero como **datos**; los paquetes de skins (Halloween hoy) se agregan como entradas.
- Los estados del contrato arrancan como los del prototipo (`trabajando`, `esperando_decision`, `libre`) más una `actividad` opcional (`leyendo`, `escribiendo`, `pensando`, `hablando`) que ya prevé la investigación. Nombres en español, como el resto del repo.

## Contrato `<Oficina>` (v0, se avisa a asistente-demo antes de cualquier cambio)

```ts
type EstadoAgente = 'trabajando' | 'esperando_decision' | 'libre';
type Actividad = 'leyendo' | 'escribiendo' | 'pensando' | 'hablando';

interface AgenteOficina {
  id: string; // estable; es la clave de selección
  nombre: string;
  rol: string; // define el atuendo por defecto
  departamento: string; // id de departamento
  estado: EstadoAgente;
  actividad?: Actividad;
  tarea?: string; // texto para el detalle
  atuendo?: Atuendo; // si falta, sale del rol
}

interface OficinaProps {
  agentes: AgenteOficina[];
  onSeleccionar?: (id: string | null) => void;
  seleccionadoId?: string | null;
  visible?: boolean; // false detiene el render (frameloop 'never')
  departamentos?: Departamento[]; // por defecto, los 6 del prototipo
  catalogo?: Catalogo; // por defecto, base + Halloween
  horaChile?: Date; // por defecto, la hora actual de America/Santiago
  calidad?: 'auto' | 'alta' | 'media' | 'baja';
  onMetricas?: (m: MetricasRender) => void;
}
```

Exporta además: `catalogoBase`, `paqueteHalloween`, `registrarPaquete`, `resolverAtuendo`, `atuendoPorRol` y los tipos.

## Criterios de aceptación

- [ ] `<Oficina agentes onSeleccionar />` renderiza las 6 salas con 9, 18 y 30 agentes y devuelve el `id` al tocar a una persona.
- [ ] Agregar un paquete de skins = agregar entradas de datos; el motor no cambia (lo demuestra un test con un paquete falso).
- [ ] Cada pieza declara su zona; dos piezas de la misma zona no coexisten y las incompatibles se resuelven de forma determinista (calabaza oculta pelo, cara y lentes).
- [ ] Rodillas y codos se doblan: la rodilla nunca se hiperextiende, el codo flexiona al teclear y al llevar la taza.
- [ ] Caminata con curva (balanceo de cadera, rebote de pelvis, brazos contrarios a piernas), sin deslizar los pies a velocidad de paseo.
- [ ] Cara según estado: concentrada al trabajar, sonriente al esperar decisión; parpadeo sin regenerar texturas por cuadro.
- [ ] La mirada sigue al asistente o a la cámara con límites de giro y retardo; los idle varían (no dos personas en fase).
- [ ] Con `visible={false}` no se ejecuta ningún cuadro de render; al volver a `true` retoma.
- [ ] Objetos por departamento, luz cálida de escritorios, y ciclo día/noche según la hora de Chile.
- [ ] En el lab, con 30 agentes: p95 ≤ 17 ms medido en Chrome escritorio con CPU 4×; cifra con iPhone si Elkis lo abre.

## Archivos y rutas a tocar

Verificado contra el repo: hoy no existe ninguno; `pnpm-workspace.yaml` ya incluye `apps/*` y `packages/*`.

```
packages/oficina/
  package.json, tsconfig.json, vitest.config.ts, README.md
  src/index.ts                       contrato público
  src/tipos.ts                       AgenteOficina, Atuendo, Zona, Pieza…
  src/catalogo/{base,halloween,registro}.ts     datos + registrarPaquete
  src/vestuario/{resolver,roles}.ts  zonas, exclusiones, atuendoPorRol
  src/animacion/{maquina,marcha,articulaciones,expresion,mirada,idle}.ts   lógica pura
  src/ambiente/{hora,luz}.ts         día/noche en hora de Chile
  src/rendimiento/{percentiles,calidad,visibilidad}.ts
  src/render/{Oficina,Sala,Escritorio,Persona,Asistente,Objetos,Luces}.tsx     R3F
  src/**/*.test.ts                   un test por módulo de lógica
  docs/{brief-oficina-3d.md,adr/001-render-y-rendimiento.md}
apps/oficina-lab/
  package.json, vite.config.ts (puerto 5180, host), index.html, tsconfig.json
  src/{main,Lab,PanelFps,Vestidor,Detalle}.tsx
```

## Diseño

- **Lógica pura separada del render.** Todo lo que decide (zonas, compatibilidades, máquina de estados, curvas de marcha, mirada, hora, percentiles) vive en TypeScript sin three, con tests. La capa R3F solo traduce a transformaciones. Es lo que permite probar sin navegador.
- **Máquina de estados** `estado` + `actividad` → objetivo de postura (`sentado`, `de pie`, `caminando a café`, `volviendo`) con reloj y azar inyectables. Los eventos mueven estados, no clips.
- **Articulaciones por ángulos.** `articulaciones.ts` calcula cadera, rodilla, hombro, codo y columna para cada pose y fase; la rodilla se limita a [0, 2.4] rad y el codo a [0, 2.5] rad.
- **Costo de render (decisión medida, no supuesta).** Primera pasada: una malla por segmento articulado con geometrías y materiales compartidos, caras en un atlas de textura por UV (sin redibujar canvas), sombra blob. Se mide. Si no llega a p95, se pasa a `InstancedMesh` por tipo de segmento. El ADR 001 registra qué se midió y qué se eligió.
- **Visibilidad:** `frameloop` en `'never'` cuando `visible=false`; en `'demand'` no sirve porque hay animación continua.
- **Calidad `auto`:** sube/baja DPR (2 → 1.25) y apaga sombras si el p95 de los últimos 120 cuadros pasa de 14 ms.

## Pre-mortem

- **Caminos**: el atuendo llega por 3 caminos: prop `atuendo`, rol por defecto, vestidor del lab. Los tres pasan por `resolverAtuendo`, que es el único que aplica reglas de zona. Persistencia en `localStorage` queda **fuera del paquete** (es del lab / de la demo).
- **Fallas**: el paquete no hace red. Falla de WebGL → `<Oficina>` muestra un fallback de texto y llama `onMetricas({ webgl: false })`. Pieza con zona desconocida → se descarta con aviso en consola, no rompe el render. `agentes` vacío → sala vacía, sin error.
- **Invariantes**: (1) una pieza por zona; (2) rodilla ≥ 0 y codo ≥ 0 siempre; (3) el estado nunca produce pose no definida; (4) `visible=false` ⇒ cero cuadros; (5) la id de selección devuelta existe en `agentes`. Cada una tiene su test.
- **Simetrías**: la regla de exclusión de zonas aplica igual al aplicar un skin, al alternar una pieza suelta y al cargar un atuendo guardado.
- **Reutilización**: nada interno existe aún; del prototipo se reusan datos y dibujo de caras/torsos, portados, no reinventados. Se descarta RoundedBoxGeometry por pieza cuando una caja basta.
- **Consumidores**: `asistente-demo` es el único consumidor de `@oficina/motor`; se le avisa del contrato antes de montar. Dentro del paquete, `resolverAtuendo` lo leen `Persona` y el vestidor del lab.
- **Datos reales**: los atuendos guardados por el prototipo en `localStorage` (`oficina-asistente-avatares`) tienen el formato del prototipo (`acc: string[]`, `top`, `topColor`…). El nuevo `Atuendo` es el mismo shape para no invalidarlos; `resolverAtuendo` tolera campos extra y faltantes.
- **Variantes**: `prefers-reduced-motion` (movimiento a 0,35×, sin paseos), móvil vs. escritorio (calidad), día vs. noche, `calidad` forzada. Todas pasan por `calidad.ts` y `luz.ts`.
- **Afirmaciones**: el README y el ADR solo declaran lo medido; el FPS en iPhone figura «no medido» hasta que haya cifra real.

## Spec (escenarios clave)

- **Zonas**: GIVEN un atuendo con gorra WHEN se equipa sombrero de bruja THEN la gorra sale y queda el sombrero.
- **Exclusión**: GIVEN calabaza equipada THEN pelo, cara y lentes quedan ocultos; al quitarla vuelven.
- **Paquete nuevo**: GIVEN un paquete con una pieza `capa-roja` en zona `espalda` WHEN `registrarPaquete` THEN aparece en el catálogo y se puede equipar sin tocar el motor.
- **Marcha**: GIVEN fase 0..2π THEN rodilla de la pierna en balanceo > 0 y de la pierna de apoyo ≈ 0; brazo y pierna del mismo lado en contrafase.
- **Estado→cara**: GIVEN `trabajando` THEN `concentrada`; `esperando_decision` THEN `sonrisa`; `libre` THEN variante por azar de las neutras.
- **Mirada**: GIVEN objetivo detrás de la cabeza THEN el giro se limita a ±70° y la cabeza se queda mirando al frente-lateral.
- **Hora**: GIVEN 23:30 en Santiago THEN `noche`; 13:00 THEN `dia`; la transición es continua.
- **Visibilidad**: GIVEN `visible=false` THEN no hay `requestAnimationFrame` activo del render.
- **Rendimiento**: GIVEN 30 agentes THEN el panel del lab reporta p95 y draw calls.

## Fuera de alcance

Lip-sync, modelos GLB, WebGPU, multijugador, persistencia, y montar la oficina en `apps/web` (es de asistente-demo).

## Ejecución

| #   | Tarea                                                                                                                      | Agente            | Modelo · esfuerzo | Archivos                                                                            | Entrega                                                |
| --- | -------------------------------------------------------------------------------------------------------------------------- | ----------------- | ----------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 1   | Andamiaje: workspace `@oficina/motor` + lab Vite 5180, vitest/tsconfig propios, dependencias fijadas                       | ejecutor          | sonnet · medium   | `packages/oficina/{package,tsconfig,vitest.config}`, `apps/oficina-lab/*`           | `pnpm install`, test vacío en verde, lab sirve en 5180 |
| 2   | Lógica pura con TDD: tipos, catálogo, vestuario, máquina, marcha, articulaciones, expresión, mirada, hora, percentiles     | ejecutor          | sonnet · medium   | `packages/oficina/src/{tipos,catalogo,vestuario,animacion,ambiente,rendimiento}/**` | tests en rojo→verde, typecheck, lint                   |
| 3   | Capa R3F: portar prototipo (salas, escritorios, personas, Asistente, luces, selección, visibilidad) usando la lógica de #2 | ejecutor          | sonnet · medium   | `packages/oficina/src/render/**`, `src/index.ts`                                    | `<Oficina>` renderiza en el lab                        |
| 4   | Lab: panel FPS/p95/draw calls, vestidor, detalle, selector 9/18/30                                                         | ejecutor          | sonnet · medium   | `apps/oficina-lab/src/**`                                                           | lab usable                                             |
| 5   | README del paquete + ADR 001 + línea de bitácora                                                                           | ejecutor-mecanico | haiku · low       | `packages/oficina/README.md`, `docs/adr/001-*.md`                                   | docs                                                   |

Orquestación: #1 → #2 → #3 → #4 en secuencia (comparten el árbol y cada una depende de la anterior); #5 al final con las cifras medidas. Yo integro, mido en Chrome real, itero el pulido y decido instancing con datos. 5 agentes, el máximo.

## Cierre

- Criterios: contrato `<Oficina>` con 9/18/30 agentes y selección (lab, `Lab.tsx`); paquete de skins por datos (`registro.test.ts`); una pieza por zona y exclusiones (`resolver.test.ts`, verificado fallando sin la guardia); rodilla y codo acotados (`articulaciones.test.ts`, verificado fallando sin el clamp); caras por estado, mirada, idle, hora de Chile, visibilidad (tests de cada módulo); gestos por actividad (`articulaciones.test.ts`).
- Medido (Chrome del Mac con GPU, 30 agentes): 81 draw calls, p95 3,0 ms (CPU 1×) y ~4 ms (CPU 6×). Meta p95 ≤ 17 ms cumplida en escritorio. **iPhone: no medido.**
- Pre-mortem: las 5 invariantes tienen test; la persistencia queda fuera del paquete (la hace el lab); webgl ausente muestra texto y llama `onMetricas({webgl:false})`.
- Desviaciones del brief: se añadieron las zonas `pelo` y `expresion`; los atuendos resueltos traen `ocultas`; se añadió `enfocadoId`; los pasos de TDD del render visual no existen (se verificó con capturas y medición).
- Supuestos anotados: WebGL2 en v1; sin modelos pagados; atlas de 128 celdas de torso.
