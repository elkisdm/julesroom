# Pulir la respuesta del avatar propio

Clasificación: fix · mediano · riesgo medio · conocido · Tier 2. Origen: encargo H.
Se ejecuta en la sesión principal: la adaptación de Codex conserva delegación opt-in.

## Objetivo y supuestos

Responder rápido, frenar cerca y conservar la continuidad de los pasos y del salto.
Se conserva caminar a 2,3 m/s, correr a 4,8 m/s, el rig y el salto de altura fija.
No se toca la cámara, el editor, las exportaciones públicas ni los pasos de creación.

## Archivos verificados y ejecución

1. `animacion/locomocion.ts`: integrar la fase con la distancia del cuadro.
2. `animacion/avatar.ts`: frenado propio, tolerancias de salto y consumo de nodos de ruta.
3. `render/entradaAvatar.ts`: transformar la palanca con zona muerta y curva continua.
4. `apps/lab/src/creacion/Dentro.tsx`: conectar únicamente el cálculo de la palanca.
5. `render/ControlesAvatar.tsx`: marca de destino breve, sin persistir tras entrada manual.
6. Nuevas pruebas en `animacion/movimientoPulido.test.ts`, `render/palanca.test.ts`
   y `render/destino.test.ts`.
   Las rutas del motor son relativas a `packages/oficina/src/`.

## Criterios y escenarios

- Dada entrada desde reposo, en un cuadro hay desplazamiento y en ≤ 50 ms se supera
  0,5 m/s. Desde carrera, soltar se detiene en ≤ 0,18 s y ≤ 0,4 m.
- Dada cualquier velocidad de un barrido de 0 a 4,8, la distancia por ciclo coincide
  con la zancada. Al acelerar/frenar, la fase usa la velocidad media del cuadro.
- Dado un borde, pulsar hasta 100 ms después permite un salto; fuera del margen no.
  Un salto ya consumido nunca permite un segundo impulso en el aire.
- Dada una pulsación hasta 120 ms antes de aterrizar, se inicia el siguiente impulso
  al tocar suelo. Si la pulsación caducó, no se repite.
- Dado un nodo intermedio alcanzado, se conduce hacia el siguiente en ese cuadro.
  Rutas largas rodean obstáculos, terminan sin órbitas y se cancelan con el teclado.
  Una marca visible identifica el destino durante 1,2 s y desaparece ante entrada manual.
- Dada una palanca cerca del centro, no hay desplazamiento; desde el centro hasta
  el borde la velocidad deseada es continua, con caminar en el recorrido intermedio
  y correr al fondo. Soltar restaura ejes a cero.
- Contra una pared se conserva el avance paralelo; una esquina convexa no atrapa.

## Pre-mortem

- Caminos: teclado, clic y palanca; remotos conservan sus parámetros de frenado.
- Fallas: sin servicios externos; la cola de salto caduca y no repite entradas.
- Invariantes: velocidades aprobadas, una pulsación/un salto, sin entrar en sólidos.
- Simetrías: ambos signos de giro y ambos pies; subir y bajar siguen el mismo suelo.
- Reutilización: `pedirSalto`, `despegar`, `avanzarFaseCaminata`, colisión existente.
- Consumidores: `avatar.ts` consume locomoción; `Dentro.tsx` escribe el mismo `Mando`;
  render y presencia leen los campos actuales. No se cambia el contrato de red.
- Datos reales: escenarios trading/mansión, pisos y muebles del repo; palanca normalizada.
- Variantes: con y sin suelo; poses activadas/desactivadas; 30/60/144 Hz en pruebas.
- Afirmaciones: videos deterministas antes/después; revisión visual limitada a cuadros,
  la aprobación perceptiva final a velocidad real corresponde a quien integra o al dueño.

## Verificación

TDD por cada fallo, solo los archivos de pruebas propios, typecheck y lint de motor/lab.
La suite y cobertura completas quedan a cargo de quien integra, por instrucción del encargo.
Videos de los mismos guiones a 60 fps, escritorio y 390×844; servidor exclusivo 5336.
No se requieren dependencias ni una decisión nueva de arquitectura.

## Definition of Ready

- [x] Criterios comprobables y rutas verificadas.
- [x] Supuestos explícitos; sin dependencias externas ni acciones irreversibles.
- [x] NFR: respuesta, continuidad temporal, costo sin asignaciones por cuadro, entrada táctil.

## Cierre

- Arranque/frenado a 30/60/144 Hz, velocidades, fase/distancia, ambos pies, salto con
  tolerancias, borde durante anticipación, nodos, obstáculos y escaleras →
  `animacion/movimientoPulido.test.ts`.
- Zona muerta, velocidad continua y soltar → `render/palanca.test.ts`.
- Aparición, desvanecimiento y cancelación manual de la marca → `render/destino.test.ts`.
- Rojo observado antes de implementar: ocho casos de movimiento, tres de palanca,
  uno del borde durante anticipación y dos de la marca. Verde final: 26 pruebas propias.
- Typecheck y lint de ambos paquetes; pruebas existentes sin modificaciones.
- No se corrió suite completa ni cobertura global: las ejecuta quien integra.
- Límite visual: la mansión oculta al personaje con otras plantas y escaleras; no se
  modifica la cámara reservada a otro ejecutor. La revisión por cuadros no acredita
  aprobación perceptiva a velocidad real. No se implementa altura de salto variable.
