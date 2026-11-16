# ADR 001 · Render y rendimiento de la oficina 3D

Fecha: 2026-11-01 · Estado: aceptada

## Contexto

El prototipo aprobado (`docs/prototipos/oficina-v3.html`) dibujaba unas 25 mallas por persona. Con 30 personas daba 934 draw calls por cuadro, inviable en iPhone (la investigación sugiere ≤ ~150). También regeneraba texturas de canvas en el bucle y no se detenía cuando no se veía.

## Decisión

- **WebGL2 con three 0.169.0 y React Three Fiber 9**, sin WebGPU: es estable y es lo que aprobó Elkis en el prototipo.
- **Lógica separada del render.** Zonas, máquina de estados, marcha, articulaciones, mirada, hora de Chile y calidad viven en TypeScript puro con tests. El render solo aplica transformaciones.
- **Esqueleto lógico sin mallas + `InstancedMesh`.** Un árbol de grupos articulados calcula las matrices; un único `useFrame` las escribe en un `InstancedMesh` por tipo de segmento, con color por instancia. Caras, frente del torso y globos de estado usan un atlas de texturas con un atributo UV por instancia, y las caras con parpadeo están precalculadas.
- **Decorado fusionado** en una malla por material con colores de vértice.
- **Sombras:** blob de contacto por defecto. Las sombras reales del sol solo con `calidad='alta'` y puntero fino.
- **Visibilidad:** `frameloop='never'` cuando `visible=false`.
- **Calidad `auto`:** sube o baja DPR y sombras según el p95 de los últimos 120 cuadros, con histéresis.

## Resultado medido (Chrome del Mac con GPU, lab en :5180)

| 30 agentes                 | Draw calls | p95 CPU 1× | p95 CPU 6× |
| -------------------------- | ---------- | ---------- | ---------- |
| Antes (mallas por persona) | 934        | 3,0 ms     | 11,7 ms    |
| Después (instancing)       | 81         | 3,0 ms     | 4,0 ms     |

Con sombras reales activadas, el contador de WebGL llega a ~140 por el pase de sombras.

### WebKit headless de Playwright (el más cercano a Safari que corre aquí)

Mac con GPU Apple, 2026-11-01, 30 agentes tras los cambios de presencia y paquetes:

| Agentes | fps | p95 del intervalo entre cuadros | Draw calls |
| ------- | --- | ------------------------------- | ---------- |
| 9       | 60  | 18 ms                           | 75         |
| 18      | 60  | 19 ms                           | 81         |
| 30      | 60  | 19 ms                           | 81         |

WebKit limita el bucle a 60 Hz (vsync) y reporta temporizadores con menos resolución, así que este p95 mide el intervalo entre cuadros y no el costo de trabajo: no es comparable con las cifras de Chrome (3 ms) y 18-19 ms no demuestra por sí solo un problema ni lo descarta. Lo que sí confirma es que mantiene 60 fps sostenidos con 30 agentes sin errores. **No reemplaza una medición en un iPhone real** (GPU, memoria y térmica distintas).

## Consecuencias

- El atlas de torsos tiene 128 celdas y lanza un error explícito si se llena. Alcanza para 30 agentes; un vestidor que genere muchas combinaciones distintas en una misma sesión podría llegar al tope.
- La selección al tocar usa una caja invisible por persona, no raycast sobre las instancias.
- **No medido:** Safari de iPhone ni WKWebView. La CPU estrangulada no simula el costo de GPU ni de memoria del iPhone. Hasta tener esa cifra, el criterio de aceptación en iPhone queda abierto.

## Alternativas consideradas

- **Fusionar cada persona en pocas mallas por material:** baja a unos 330 draw calls con 30 agentes; insuficiente para móvil.
- **WebGPU:** Remotion lo marca como experimental; se evalúa después de medir en iPhone.
- **Modelos GLB con rig:** requieren generación 3D de pago; fuera de esta etapa.
