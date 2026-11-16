/**
 * Operaciones del editor sobre muebles de la plantilla: mover, girar, quitar, restablecer.
 *
 * Cada operación toca solo `mundo.ajustesMuebles` (el formato ya lo entiende `aplicarAjustes`).
 * La validación completa (choca, cierra el paso, tapa entrada…) la hace `aplicarAjustes` al
 * generar el escenario; aquí solo se rechaza lo que se sabe sin recalcular (pieza fija, id
 * inexistente) y la posición inválida (mismas reglas que `aplicarAjustes`).
 */
import { cajaDe } from '../mansion/plano';
import { aplicarAjustes, piezasMovibles, TIPOS_FIJOS } from '../escenarios/personalizacion';
import type { AjusteMueble, AjustesMuebles } from '../escenarios/personalizacion';
import type { Escenario, Mueble } from '../escenarios/tipos';
import type { SalaGuardada } from './formato';
import { ajustar } from './rejilla';
import { LIMITES_SALA } from './limites';

export type ResultadoMueble = { ok: true; sala: SalaGuardada } | { ok: false; motivo: string };

const NO_EXISTE = 'No existe esa pieza en esta sala.';
const CUARTO = Math.PI / 2;
const ok = (sala: SalaGuardada): ResultadoMueble => ({ ok: true, sala });
const fallo = (motivo: string): ResultadoMueble => ({ ok: false, motivo });

/** Cuarto de vuelta en (−π, π]: así cuatro giros vuelven al de la plantilla y no a +360°. */
function giroCuarto(giro: number): number {
  const n = ((Math.round(giro / CUARTO) % 4) + 4) % 4;
  return (n === 3 ? -1 : n) * CUARTO;
}

function mismoQueOriginal(ajuste: { x: number; z: number; giro: number }, m: Mueble): boolean {
  return ajuste.x === m.x && ajuste.z === m.z && giroCuarto(ajuste.giro) === giroCuarto(m.giro);
}

function igualAjuste(a: AjusteMueble | undefined, b: AjusteMueble): boolean {
  if (a === undefined) return false;
  if (a === 'quitado' || b === 'quitado') return a === b;
  return a.x === b.x && a.z === b.z && giroCuarto(a.giro) === giroCuarto(b.giro);
}

const conAjustes = (sala: SalaGuardada, ajustesMuebles: AjustesMuebles): SalaGuardada => ({
  ...sala,
  mundo: { ...sala.mundo, ajustesMuebles },
});

/** Busca el mueble original en la plantilla. */
function muebleOriginal(e: Escenario, id: string): Mueble | undefined {
  return e.planta.muebles.find((m) => m.id === id);
}

/** Razón legible por la que un mueble no se puede seleccionar, o `null` si sí. */
export function razonNoSeleccionable(e: Escenario, id: string): string | null {
  const m = muebleOriginal(e, id);
  if (!m) return NO_EXISTE;
  if (TIPOS_FIJOS.has(m.tipo)) return 'Es parte de la arquitectura de la sala.';
  const movibles = piezasMovibles(e);
  if (!movibles.some((p) => p.id === id)) return 'Esta pieza no se puede mover en esta sala.';
  return null;
}

/** Dónde está un mueble ahora (su ajuste si tiene, o su posición original). */
function posicionActual(
  e: Escenario,
  ajustes: Readonly<AjustesMuebles>,
  id: string,
): { x: number; z: number; giro: number } | 'quitado' | null {
  const a = ajustes[id];
  if (a === 'quitado') return 'quitado';
  if (a) return a;
  const m = muebleOriginal(e, id);
  return m ? { x: m.x, z: m.z, giro: m.giro } : null;
}

/**
 * Intenta un ajuste: lo pone en `ajustesMuebles` y prueba con `aplicarAjustes` si pasa.
 * Si no pasa, devuelve el motivo. Si pasa, devuelve la sala con el ajuste.
 */
function intentarAjuste(
  sala: SalaGuardada,
  e: Escenario,
  id: string,
  ajuste: AjustesMuebles[string],
): ResultadoMueble {
  const razon = razonNoSeleccionable(e, id);
  if (razon) return fallo(razon);

  const puesto: AjusteMueble =
    ajuste === 'quitado' ? ajuste : { x: ajuste.x, z: ajuste.z, giro: giroCuarto(ajuste.giro) };
  const previo = sala.mundo.ajustesMuebles[id];
  // El mismo ajuste no fabrica otra sala: un clic sin mover no ensucia el deshacer.
  if (igualAjuste(previo, puesto)) return ok(sala);

  // Volver al sitio de la plantilla borra el ajuste en vez de guardar un giro equivalente.
  if (puesto !== 'quitado') {
    const m = muebleOriginal(e, id)!;
    if (mismoQueOriginal(puesto, m)) {
      if (previo === undefined) return ok(sala);
      return ok(conAjustes(sala, sinClave(sala.mundo.ajustesMuebles, id)));
    }
  }

  const nuevos: AjustesMuebles = { ...sala.mundo.ajustesMuebles, [id]: puesto };
  const { errores } = aplicarAjustes(e, nuevos);
  const error = errores.find((x) => x.id === id);
  if (error) return fallo(error.motivo);

  return ok(conAjustes(sala, nuevos));
}

/** Mueve un mueble de la plantilla a una posición nueva. */
export function moverMueble(
  sala: SalaGuardada,
  e: Escenario,
  id: string,
  x: number,
  z: number,
): ResultadoMueble {
  const paso = LIMITES_SALA.paso;
  const actual = posicionActual(e, sala.mundo.ajustesMuebles, id);
  if (!actual) return fallo(NO_EXISTE);
  const giro = actual === 'quitado' ? (muebleOriginal(e, id)?.giro ?? 0) : actual.giro;
  return intentarAjuste(sala, e, id, { x: ajustar(x, paso), z: ajustar(z, paso), giro });
}

/** Gira un mueble de la plantilla 90° en el sentido indicado. */
export function girarMueble(
  sala: SalaGuardada,
  e: Escenario,
  id: string,
  sentido: 1 | -1,
): ResultadoMueble {
  const actual = posicionActual(e, sala.mundo.ajustesMuebles, id);
  if (!actual) return fallo(NO_EXISTE);
  if (actual === 'quitado') return fallo('No se puede girar un mueble quitado.');
  const giro = actual.giro + sentido * (Math.PI / 2);
  return intentarAjuste(sala, e, id, { x: actual.x, z: actual.z, giro });
}

/** Marca un mueble como quitado. */
export function quitarMueble(sala: SalaGuardada, e: Escenario, id: string): ResultadoMueble {
  return intentarAjuste(sala, e, id, 'quitado');
}

/**
 * El mueble bajo el punto, el de huella más chica si hay varios.
 * `motivo` es null si se puede elegir; si no, la frase para decírselo a la persona.
 */
export function muebleBajoPunto(
  e: Escenario,
  x: number,
  z: number,
): { id: string; motivo: string | null } | null {
  let mejor: { id: string; area: number } | null = null;
  for (const m of e.planta.muebles) {
    const c = cajaDe(m);
    if (x < c.x0 || x > c.x1 || z < c.z0 || z > c.z1) continue;
    const area = (c.x1 - c.x0) * (c.z1 - c.z0);
    if (!mejor || area < mejor.area) mejor = { id: m.id, area };
  }
  if (!mejor) return null;
  return { id: mejor.id, motivo: razonNoSeleccionable(e, mejor.id) };
}

function sinClave(ajustes: AjustesMuebles, id: string): AjustesMuebles {
  const sin = { ...ajustes };
  delete sin[id];
  return sin;
}

/** Devuelve un mueble a su posición original (borra su ajuste). */
export function restablecerMueble(sala: SalaGuardada, id: string): SalaGuardada {
  return conAjustes(sala, sinClave(sala.mundo.ajustesMuebles, id));
}

/** Devuelve toda la sala a su estado original (vacía los ajustes). */
export function restablecerSala(sala: SalaGuardada): SalaGuardada {
  return conAjustes(sala, {});
}
