import { Color } from 'three';
import type { Material, WebGLProgramParametersWithUniforms } from 'three';

/**
 * Volumen barato para las personas, al estilo de «Illustrative Rendering in Team Fortress 2»
 * (Mitchell, Francke y Eng, NPAR 2007): luz de media rampa (Half Lambert con bandas) cuyas
 * sombras van a un tono frío en vez de a negro, y luz de contorno (Fresnel `(1 − n·v)^4`
 * modulada por la normal hacia arriba) para que la silueta se lea. Un solo término de la luz
 * principal y cero texturas extra. Los interruptores son uniformes compartidos: encender o
 * apagar no recompila ningún material.
 */
export const uniformesVolumen = {
  uRampa: { value: 1 },
  uRim: { value: 1 },
  uRimColor: { value: new Color(1.0, 0.93, 0.82) },
  uRimFuerza: { value: 0.9 },
};

const FRAGMENTO = /* glsl */ `
{
  vec3 luzPlena = outgoingLight;
  float lado = 1.0;
  #if NUM_DIR_LIGHTS > 0
    float medioLambert = dot(normal, directionalLights[0].direction) * 0.5 + 0.5;
    lado = smoothstep(0.30, 0.50, medioLambert) * 0.5 + smoothstep(0.58, 0.82, medioLambert) * 0.5;
  #endif
  vec3 frio = luzPlena * vec3(0.74, 0.84, 1.16) + diffuseColor.rgb * vec3(0.04, 0.06, 0.12);
  outgoingLight = mix(luzPlena, mix(frio, luzPlena, lado), uRampa);
  vec3 haciaOjo = normalize(vViewPosition);
  float borde = pow(1.0 - clamp(dot(normal, haciaOjo), 0.0, 1.0), 3.0);
  vec3 arriba = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  float haciaArriba = clamp(dot(normal, arriba) * 1.2 + 0.1, 0.0, 1.0);
  outgoingLight += uRimColor * (borde * haciaArriba * uRimFuerza * uRim);
}
`;

/** Añade el volumen a un material estándar, encadenándose a lo que ya tuviera (p. ej. el atlas). */
export function conVolumen<M extends Material>(m: M): M {
  const anterior = m.onBeforeCompile.bind(m);
  const claveAnterior = m.customProgramCacheKey.bind(m);
  m.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms, renderer) => {
    anterior(shader, renderer);
    Object.assign(shader.uniforms, uniformesVolumen);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform float uRampa;\nuniform float uRim;\nuniform vec3 uRimColor;\nuniform float uRimFuerza;',
      )
      .replace('#include <opaque_fragment>', `${FRAGMENTO}\n#include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => `${claveAnterior()}|volumen`;
  return m;
}
