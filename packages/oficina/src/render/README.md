# render/ — cómo se dibuja la oficina

Zona de **oficina-grafica** (salvo `animador.ts`, `camara.ts`, `orbita.ts`, `ControlesCamara.tsx` y `remotas.ts`, que son de oficina-movimiento).

## Cómo se dibuja una persona

1. `Persona.tsx` arma el esqueleto (árbol de `Group`, sin mallas). Cada pieza se anota como `Parte` (`Pieza.tsx`).
2. `Personas.tsx` tiene **un solo `useFrame`**: anima, calcula matrices de mundo y escribe cada pieza en la `Flota`.
3. `flota.ts`: las familias sin atlas van a **un `BatchedMesh` por familia** (todas sus geometrías dentro, una llamada de dibujo); las de atlas (caras, torso frontal, iconos) son `InstancedMesh` con el atributo `aAtlas`.
4. Antes de escribir una persona: **descarte por cámara** (`rendimiento/visibilidad.ts`) y **LOD de geometría** (`lod.ts`: caja de la bounding box para las lejanas, con histéresis).

## Técnicas gráficas e interruptores

Cada técnica es un booleano de `Tecnicas` (`rendimiento/tecnicas.ts`). El nivel de calidad trae los suyos (`TECNICAS_POR_NIVEL`) y `<Oficina tecnicas={{ rim: false }}>` sobrescribe cualquiera. En la página de medición (`apps/lab/grafica.html`) hay una casilla por técnica y `?t=rim=0,anisotropia=2`.

| Técnica                   | Dónde                                | Costo                                                        |
| ------------------------- | ------------------------------------ | ------------------------------------------------------------ |
| LOD de geometría          | `lod.ts`, `Personas.tsx`             | ahorra triángulos (≈ 740 k → 260 k con 100 en vista general) |
| Descarte por cámara       | `visibilidad.ts`, `Personas.tsx`     | ahorra matrices y piezas de quien no se ve                   |
| Rampa + sombras frías     | `volumen.ts`                         | un término de la luz principal                               |
| Luz de contorno (Fresnel) | `volumen.ts`                         | un término más en el mismo bloque                            |
| Sombra blob               | `Personas.tsx`, `texturas.ts`        | una instancia por persona                                    |
| Contorno casco invertido  | `contorno.ts`                        | solo seleccionado y quien habla                              |
| Nombres SDF               | `Etiquetas.tsx`, `textoEtiquetas.ts` | una llamada para todos los nombres                           |
| DPR adaptable             | `rendimiento/ajuste.ts`, `senal.ts`  | un cambio de tamaño por escalón                              |
| Anisotropía               | `texturas.ts` (`fijarAnisotropia`)   | filtrado de atlas                                            |
| Rangos parciales          | `flota.ts` (`fijarRangosParciales`)  | sube solo las instancias en uso                              |

## Cosas que la investigación no decía (medidas aquí)

- **El DPR no se decide con el tiempo entre cuadros.** Con vsync ese tiempo nunca baja de 16,7 ms, así que umbrales de «p95 > 14 ms» bajan la calidad en cualquier pantalla de 60 Hz. Tampoco ayuda bajar píxeles si el cuello es la CPU. La señal es la **pérdida de cuadros** (`senal.ts`), hay gracia en el arranque y enfriamiento tras bajar.
- **`addUpdateRange` va en elementos del array, no en instancias** (`WebGLAttributes.updateBuffer`, r169: `bufferSubData(…, start * BYTES_PER_ELEMENT, array, start, count)`). Instancia `i` de `instanceMatrix` empieza en `i * 16`. Solo aplica a las mallas instanciadas; `BatchedMesh` guarda las matrices en una textura y sube entera.
- **Las llamadas de dibujo de la casa son fijas** (~63): se fusionan por material y costado de corte porque la cámara oculta cada costado por separado.

## Medir

`apps/lab/src/grafica/medir.mjs` (Playwright + Chrome con GPU, perfiles escritorio/móvil y CPU ×N) y `comparar.mjs` (cada técnica encendida y apagada). La página `grafica.html?n=100&calidad=alta&t=…&sinCasa=1` mide con su propio bucle y expone `window.__grafica`.

## Demo de grupo D2

Los ids humanos que recibe Oficina tienen nombres SDF persistentes: mínimo de pantalla,
apilado a ambos lados del ancla y corrección lateral. `nombresVivos.test.ts` cubre veinte
nombres y bordes; los agentes conservan sus restricciones gráficas.
`trasladoD2.ts` consume una orden consentida del mando y revalida colisión/altura.
`espacioD2.ts` consulta ese mismo suelo para distribuir el público y las zonas de voto.
`reaccionD2.ts` reutiliza la pose de saludo; `MarcasD2.tsx` dibuja las zonas de suelo.
Estos puentes internos son efímeros y exclusivos de la demo, sin ampliar la API pública.
