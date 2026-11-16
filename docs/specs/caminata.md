# Caminata y carrera de primer nivel

**Clasificación**: feat · large · riesgo medio (cambia cómo se mueve todo el que aparece en la sala) · incierto (el criterio es la sensación, se descubre mirando) · toca `packages/oficina/src/animacion/`, `render/cuerpo.ts`, `render/animador.ts`, `render/remotas.ts`, `render/entradaAvatar.ts`, `apps/lab/src/caminata/`
**Tier**: 3 — Full
**Origen**: revisión de Elkis del 2026-11-14 («la forma de caminar está rara, es lenta… debe ser de primer nivel»)

## Objetivo

Que caminar y correr en Jules Room se sienta como en un juego de primer nivel visto desde arriba: paso ágil, pies que se levantan, cuerpo que rebota y contragira, brazos que acompañan, arranque y frenado inmediatos, y un modo correr. Igual de bien en el avatar propio, en personas remotas (10 Hz con pérdida) y en agentes con rutas.

## Supuestos (corrígeme si alguno está mal)

- El rig no cambia: sin tobillo. El «talón-punta» sale de que el zapato va fijo a la pantorrilla: al contacto la pierna adelantada deja la punta arriba (talón) y al despegar la deja abajo (punta). No se toca `Persona.tsx`.
- La caminata nueva queda detrás de un interruptor más (`OPCIONES.caminataPoses`), como las otras técnicas: apagado vuelve a la marcha de main. Eso da el «antes / ahora» en la misma compilación.
- Correr: mantener Shift, doble clic en el piso, y automático en rutas por clic de más de N metros (parametrizable). Las personas remotas corren solas cuando su rapidez pasa el umbral (no hace falta un campo nuevo en la red).
- La página de afinación usa el `Persona` real del motor (mismas piezas y colores) dibujado con mallas simples, sin la casa; los videos «en juego» se graban en `movimiento.html`.
- Todos los números son valores iniciales parametrizables (deslizadores + copiar valores).

## Criterios de aceptación

- [ ] Videos a 60 fps reales «antes» y «ahora» (caminar, correr, arrancar-frenar, giros; lateral y de juego) y uno lado a lado con una referencia, en una carpeta local de capturas.
- [ ] Tabla de medidas de referencias (pasos/s, cuerpos/s, rebote, apertura, arranque/frenado) con la fuente de cada clip.
- [ ] Ciclo por poses: contacto, bajada, paso, subida; pie con arco y despegue claro (≥ 8 cm caminando); rodilla que dobla en el sentido correcto; cadera que sube/baja y gira; torso que contragira; brazos con codo; cabeza con leve retraso.
- [ ] Velocidad de caminar dentro del rango medido en referencias (en cuerpos de alto por segundo); correr con vuelo, inclinación y brazos doblados.
- [ ] Transición caminar ↔ correr ↔ parar sin saltos de pose (prueba: la pose cambia de forma continua al variar la velocidad).
- [ ] Sin patinar: en apoyo el pie queda quieto respecto del suelo (prueba con tolerancia).
- [ ] Rodilla nunca al revés (prueba en todo el rango de velocidades y fases).
- [ ] Remotas a 10 Hz con retraso y pérdida y agentes en ruta usan el mismo ciclo.
- [ ] 100 en pantalla: animación ≤ ~2 ms por cuadro en esta Mac.
- [ ] Página `apps/lab/caminata.html` con pista, cámaras lateral/frontal/juego, 0,25×, cuadro a cuadro, huellas, deslizadores, copiar valores, «antes» y «ahora» lado a lado, controles propios.

## Archivos y rutas (verificados contra el código)

- `packages/oficina/src/animacion/zancada.ts` — modificar — ciclo por poses (caminar y correr mezclados por velocidad), salida ampliada (giro de pelvis, contragiro de torso, codos, cabeza).
- `packages/oficina/src/animacion/locomocion.ts` — modificar — velocidades de juego, correr, aceleración/frenado altos, derrape al frenar corriendo.
- `packages/oficina/src/animacion/opciones.ts` — modificar — interruptor `caminataPoses`.
- `packages/oficina/src/render/cuerpo.ts` — modificar — aplica la salida ampliada (avatar y remotas).
- `packages/oficina/src/render/animador.ts` — modificar — agentes: misma salida ampliada.
- `packages/oficina/src/render/entradaAvatar.ts` / `animacion/avatar.ts` — modificar — Shift, doble clic, correr en rutas largas.
- `packages/oficina/src/index.ts` — modificar — exportar lo que usa el lab (Persona, cuerpo).
- `apps/lab/caminata.html`, `apps/lab/src/caminata/*` — nuevo — página de afinación.
- Grabador (fuera del repo, scratchpad): Playwright con reloj virtual → PNG por cuadro → ffmpeg.

## Pruebas

- `zancada.test.ts` — sin patinar en apoyo (caminar y correr), rodilla ≥ 0 siempre, altura de pie ≥ umbral en balanceo, continuidad de la pose al variar la velocidad, fase de vuelo al correr (los dos pies arriba en algún tramo).
- `locomocion.test.ts` — alcanza la velocidad de caminar en ≤ 0,15 s y la de correr en ≤ 0,3 s; frena en ≤ 0,15 s; correr pasa a caminar sin saltos.
- `avatar.test.ts` / `entradaAvatar.test.ts` — Shift y doble clic piden correr; ruta larga corre y frena a caminar al final.

## Pre-mortem

- **Caminos**: avatar propio (`cuerpo.ts` + `conducir`), remotas (`alimentarLocomocion`), agentes (`animador.ts` `aplicarZancada`), sentarse/levantarse (transiciones en animador), LOD (tasa reducida: la fase avanza por distancia, tolera dt grande).
- **Fallas**: dt grande o 0 (pestaña oculta, LOD) → fase limitada, sin NaN; remotas con saltos (teletransporte) → no cuentan como correr.
- **Invariantes**: pie en apoyo quieto respecto del suelo; rodilla ≥ 0; pose continua en velocidad; fase congelada a velocidad 0.
- **Simetrías**: lo que valga para el avatar vale para remotas y agentes (mismo `calcularZancada`).
- **Reutilización**: `resorte.ts` (resortes), `avanzarFase`, `secundario.ts` (impulso de pisada).
- **Consumidores**: `calcularZancada` → `cuerpo.ts`, `animador.ts`; `PARAMETROS_LOCOMOCION` → `cuerpo.ts`, `animador.ts`, `avatar.ts`, `remotas.ts`; `velMax` → separación, navegación, cámara (escenarios; se avisa si cambia el rango).
- **Datos reales**: n/a (sin datos persistidos).
- **Variantes**: `OPCIONES.marchaPorDistancia` apagado sigue usando la marcha senoidal; `caminataPoses` apagado = main.
- **Afirmaciones**: README de render, comentarios de cabecera de zancada/locomoción, página de movimiento.

## Ejecución

| #   | Tarea                                                             | Agente          | Modelo · esfuerzo | Archivos                  | Entrega                  |
| --- | ----------------------------------------------------------------- | --------------- | ----------------- | ------------------------- | ------------------------ |
| 1   | Grabador a 60 fps con reloj virtual (Playwright + ffmpeg)         | ejecutor        | sonnet · medium   | scratchpad                | script + video de prueba |
| 2   | Referencias: bajar clips, extraer cuadros, medir                  | general-purpose | sonnet            | fuera del repo            | tabla + cuadros          |
| 3   | Ciclo por poses, correr, transiciones (lógica pura + pruebas)     | mantenedor      | sesión            | `animacion/*`             | diff + pruebas           |
| 4   | Página de afinación                                               | mantenedor      | sesión            | `apps/lab/src/caminata/*` | página                   |
| 5   | Integración en cuerpo/animador/remotas/avatar + medición de costo | mantenedor      | sesión            | `render/*`                | diff + medidas           |

Las tareas 3–5 quedan en el bucle principal porque el criterio es mirar el resultado e iterar: delegarlas obligaría a pasar los videos de ida y vuelta.

## Cambios al brief durante la implementación

- Roblox pasó a ser la referencia principal y se sumó el SALTO (pedido de Elkis, por quien integra): `salto.ts`, pose en `mezclarPoseSalto`, `PersonaPresente.saltos` (contador, opcional).
- Velocidades: en Roblox el movimiento por defecto es un trote (~2,9 cuerpos/s, codos a 90°, patada de talón). Se tomó como «correr» (4,8 m/s ≈ 3 cuerpos/s) y caminar quedó ágil a 2,3 m/s (≈1,45 cuerpos/s, el doble de main).
- Agentes: a paso de juego orbitaban los nodos de su ruta (umbral de 8 cm): `avanzarNav` acepta un umbral de nodo ≥ el radio de giro.
- Fuera de la zona original: `render/cuerpo.ts`, `ControlesAvatar.tsx`, `entradaAvatar.ts`, `presencia/simulada.ts` y `tipos.ts`, `index.ts` (exporta `laboratorio`).

## Verificación final

- Sin patinar en el rig completo, caminando y corriendo → `cuerpo.test.ts` (verificada en los dos sentidos: falla si la cadera no deshace el giro de la pelvis).
- Rodilla nunca al revés, pie ≥ 8 cm, vuelo al correr, pose continua al cambiar de velocidad → `caminata.test.ts`.
- Arranque en ≤ 0,15 s y ≤ 0,3 s, frenado y derrape, llegada corriendo sin pasarse → `locomocion.test.ts`.
- Salto (altura, tiempo, dt grande) → `salto.test.ts`; salto remoto con retraso → `remotas.test.ts`; Shift, doble clic, ruta larga y espacio → `avatar.test.ts` y `entradaAvatar.test.ts`.
- 100 personas: 0,87–0,89 ms de media por cuadro (≤ 2 ms) → `costo-100-personas.txt` de la evidencia.
- Suite del motor (1047), del lab (27), typecheck y lint en verde.
- Lo que queda por debajo de la referencia está en una nota local, fuera del repo.
