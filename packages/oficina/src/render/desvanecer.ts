import { Material, Vector2, Vector4 } from 'three';
import type { WebGLProgramParametersWithUniforms } from 'three';
import type { Caja3 } from './visual';

/**
 * Desvanecimiento de obstáculos entre la cámara y el avatar. La casa decorada se dibuja fusionada, así
 * que no hay una malla por columna que volver transparente: cada material compila un descarte por
 * punteado dentro de las cajas que la cámara pide desvanecer (`uDesv*`), solo en las mallas estándar y
 * básicas. Los uniformes son únicos y compartidos: escribirlos una vez por cuadro basta para todos.
 */

/** Cajas que pueden estar a medio desvanecer a la vez; las más invisibles ganan. */
export const MAX_DESVANECIDAS = 8;
/** Holgura (m) de cada lado: el muro dibujado es más grueso que su caja de colisión, y la base queda sobre el piso. */
const HOLGURA = 0.06;
const BASE_SOBRE_PISO = 0.05;

export const uniformesDesvanecido = {
  uDesvN: { value: 0 },
  uDesvCaja: { value: Array.from({ length: MAX_DESVANECIDAS }, () => new Vector4()) },
  uDesvAlt: { value: Array.from({ length: MAX_DESVANECIDAS }, () => new Vector2()) },
  uDesvOp: { value: Array.from({ length: MAX_DESVANECIDAS }, () => 1) },
};

const orden: number[] = [];

/**
 * Publica las cajas a medio desvanecer (opacidad < 1): las más invisibles primero y hasta el tope. El
 * asistente, que se mueve, va como una caja más (la suya, con su opacidad).
 */
export function escribirDesvanecidas(
  cajas: readonly Caja3[],
  opacidad: readonly number[],
  asistente: Caja3 | null = null,
  opacidadAsistente = 1,
): void {
  const delAsistente = cajas.length;
  const opacidadDe = (i: number) => (i === delAsistente ? opacidadAsistente : opacidad[i]!);
  orden.length = 0;
  for (let i = 0; i < cajas.length; i++) if (opacidad[i]! < 0.999) orden.push(i);
  if (asistente && opacidadAsistente < 0.999) orden.push(delAsistente);
  orden.sort((a, b) => opacidadDe(a) - opacidadDe(b));
  const n = Math.min(orden.length, MAX_DESVANECIDAS);
  for (let k = 0; k < n; k++) {
    const c = orden[k] === delAsistente ? asistente! : cajas[orden[k]!]!;
    uniformesDesvanecido.uDesvCaja.value[k]!.set(
      c.x0 - HOLGURA,
      c.z0 - HOLGURA,
      c.x1 + HOLGURA,
      c.z1 + HOLGURA,
    );
    uniformesDesvanecido.uDesvAlt.value[k]!.set(c.y0 + BASE_SOBRE_PISO, c.y1 + HOLGURA);
    uniformesDesvanecido.uDesvOp.value[k] = opacidadDe(orden[k]!);
  }
  uniformesDesvanecido.uDesvN.value = n;
}

export function limpiarDesvanecidas(): void {
  uniformesDesvanecido.uDesvN.value = 0;
}

const DECLARACION_VERTICE = 'varying vec3 vDesvPos;\nvoid main() {';
const DECLARACION_FRAGMENTO = `varying vec3 vDesvPos;
uniform int uDesvN;
uniform vec4 uDesvCaja[${MAX_DESVANECIDAS}];
uniform vec2 uDesvAlt[${MAX_DESVANECIDAS}];
uniform float uDesvOp[${MAX_DESVANECIDAS}];
void main() {`;

const POSICION = `#include <project_vertex>
{
  vec4 desvP = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    desvP = instanceMatrix * desvP;
  #endif
  vDesvPos = (modelMatrix * desvP).xyz;
}`;

const DESCARTE = `#include <clipping_planes_fragment>
for (int i = 0; i < ${MAX_DESVANECIDAS}; i++) {
  if (i >= uDesvN) break;
  vec4 c = uDesvCaja[i];
  if (vDesvPos.x > c.x && vDesvPos.x < c.z && vDesvPos.z > c.y && vDesvPos.z < c.w &&
      vDesvPos.y > uDesvAlt[i].x && vDesvPos.y < uDesvAlt[i].y) {
    float ruido = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    if (ruido >= uDesvOp[i]) discard;
  }
}`;

/** Añade el descarte a un sombreador estándar o básico; los demás (puntos, sprites, a medida) quedan igual. */
export function parchearDesvanecido(shader: WebGLProgramParametersWithUniforms): void {
  const { vertexShader: v, fragmentShader: f } = shader;
  if (
    v.includes('vDesvPos') ||
    !v.includes('#include <project_vertex>') ||
    !f.includes('#include <clipping_planes_fragment>') ||
    !v.includes('void main() {') ||
    !f.includes('void main() {')
  ) {
    return;
  }
  Object.assign(shader.uniforms, uniformesDesvanecido);
  shader.vertexShader = v
    .replace('void main() {', DECLARACION_VERTICE)
    .replace('#include <project_vertex>', POSICION);
  shader.fragmentShader = f
    .replace('void main() {', DECLARACION_FRAGMENTO)
    .replace('#include <clipping_planes_fragment>', DESCARTE);
}

/**
 * Hace que todo material de la escena sin parche propio compile el descarte. Los que ya traen su
 * `onBeforeCompile` (el atlas de las personas, el contorno) quedan fuera: nadie se desvanece a sí mismo.
 */
export function instalarDesvanecido(): void {
  Material.prototype.onBeforeCompile = function (shader: WebGLProgramParametersWithUniforms) {
    parchearDesvanecido(shader);
  };
}

instalarDesvanecido();
