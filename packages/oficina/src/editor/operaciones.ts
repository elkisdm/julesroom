import type { ContenidoPantalla, Escenario } from '../escenarios/tipos';
import { tipoObjeto } from './catalogo';
import { evaluarColocacion } from './colocacion';
import type { ObjetoColocado, SalaGuardada } from './formato';
import { LIMITES_SALA, type LimitesSala } from './limites';
import { ajustar, girar, type Giro } from './rejilla';

export type Resultado = { ok: true; sala: SalaGuardada } | { ok: false; motivo: string };

const NO_EXISTE: Resultado = { ok: false, motivo: 'No existe ese objeto' };
const ok = (sala: SalaGuardada): Resultado => ({ ok: true, sala });

const conObjetos = (sala: SalaGuardada, objetos: ObjetoColocado[]): SalaGuardada => ({
  ...sala,
  mundo: { ...sala.mundo, objetos },
});

function nuevoId(objetos: readonly ObjetoColocado[]): string {
  const usados = new Set(objetos.map((o) => o.id));
  let n = objetos.reduce((m, o) => Math.max(m, Number(/^obj-(\d+)$/.exec(o.id)?.[1] ?? 0)), 0) + 1;
  while (usados.has(`obj-${n}`)) n++;
  return `obj-${n}`;
}

/** Rechaza solo lo que no se puede (choca, fuera); «bloquea» es un aviso y se permite. */
function validar(
  obj: ObjetoColocado,
  sala: SalaGuardada,
  escenario: Escenario,
  limites: LimitesSala,
): string | null {
  const r = evaluarColocacion(obj, { escenario, objetos: sala.mundo.objetos, limites });
  return r.estado === 'choca' || r.estado === 'fuera' ? r.motivo : null;
}

export function colocar(
  sala: SalaGuardada,
  escenario: Escenario,
  nuevo: { tipo: string; x: number; z: number; giro: Giro },
  limites: LimitesSala = LIMITES_SALA,
): Resultado {
  if (!tipoObjeto(nuevo.tipo)) return { ok: false, motivo: 'Ese objeto no está en el catálogo' };
  if (sala.mundo.objetos.length >= limites.maxObjetos) {
    return { ok: false, motivo: `Llegaste al tope de ${limites.maxObjetos} objetos` };
  }
  const obj: ObjetoColocado = {
    id: nuevoId(sala.mundo.objetos),
    tipo: nuevo.tipo,
    x: ajustar(nuevo.x, limites.paso),
    z: ajustar(nuevo.z, limites.paso),
    giro: nuevo.giro,
  };
  const motivo = validar(obj, sala, escenario, limites);
  return motivo ? { ok: false, motivo } : ok(conObjetos(sala, [...sala.mundo.objetos, obj]));
}

function reemplazar(
  sala: SalaGuardada,
  escenario: Escenario,
  id: string,
  cambio: (o: ObjetoColocado) => ObjetoColocado,
  limites: LimitesSala,
): Resultado {
  const actual = sala.mundo.objetos.find((o) => o.id === id);
  if (!actual) return NO_EXISTE;
  const obj = cambio(actual);
  const motivo = validar(obj, sala, escenario, limites);
  return motivo
    ? { ok: false, motivo }
    : ok(
        conObjetos(
          sala,
          sala.mundo.objetos.map((o) => (o.id === id ? obj : o)),
        ),
      );
}

export const mover = (
  sala: SalaGuardada,
  escenario: Escenario,
  id: string,
  x: number,
  z: number,
  limites: LimitesSala = LIMITES_SALA,
): Resultado =>
  reemplazar(
    sala,
    escenario,
    id,
    (o) => ({ ...o, x: ajustar(x, limites.paso), z: ajustar(z, limites.paso) }),
    limites,
  );

export const girarObjeto = (
  sala: SalaGuardada,
  escenario: Escenario,
  id: string,
  sentido: 1 | -1,
  limites: LimitesSala = LIMITES_SALA,
): Resultado =>
  reemplazar(sala, escenario, id, (o) => ({ ...o, giro: girar(o.giro, sentido) }), limites);

/** Copia el objeto en el primer hueco libre a la derecha o abajo (hasta 8 pasos de rejilla en cada dirección). */
export function duplicar(
  sala: SalaGuardada,
  escenario: Escenario,
  id: string,
  limites: LimitesSala = LIMITES_SALA,
): Resultado {
  const origen = sala.mundo.objetos.find((o) => o.id === id);
  if (!origen) return NO_EXISTE;
  if (sala.mundo.objetos.length >= limites.maxObjetos) {
    return { ok: false, motivo: `Llegaste al tope de ${limites.maxObjetos} objetos` };
  }
  for (let k = 1; k <= 8; k++) {
    const d = k * limites.paso;
    for (const [x, z] of [
      [origen.x + d, origen.z],
      [origen.x, origen.z + d],
    ] as const) {
      const copia = { ...origen, id: nuevoId(sala.mundo.objetos), x, z };
      if (!validar(copia, sala, escenario, limites))
        return ok(conObjetos(sala, [...sala.mundo.objetos, copia]));
    }
  }
  return { ok: false, motivo: 'No hay hueco libre cerca para duplicarlo' };
}

export function quitar(sala: SalaGuardada, id: string): Resultado {
  if (!sala.mundo.objetos.some((o) => o.id === id)) return NO_EXISTE;
  return ok(
    conObjetos(
      sala,
      sala.mundo.objetos.filter((o) => o.id !== id),
    ),
  );
}

export function fijarPantalla(
  sala: SalaGuardada,
  idPantalla: string,
  contenido: ContenidoPantalla,
): Resultado {
  return ok({
    ...sala,
    mundo: { ...sala.mundo, pantallas: { ...sala.mundo.pantallas, [idPantalla]: contenido } },
  });
}

/** Un lugar tiene un solo ocupante: si estaba tomado, el anterior queda sin puesto. `null` libera al ocupante. */
export function asignarPuesto(
  sala: SalaGuardada,
  idOcupante: string,
  idLugar: string | null,
): Resultado {
  const puestos: Record<string, string> = {};
  for (const [o, l] of Object.entries(sala.mundo.puestos)) {
    if (o !== idOcupante && l !== idLugar) puestos[o] = l;
  }
  if (idLugar !== null) puestos[idOcupante] = idLugar;
  return ok({ ...sala, mundo: { ...sala.mundo, puestos } });
}

export function fijarVariante(sala: SalaGuardada, id: string | undefined): Resultado {
  return ok({ ...sala, mundo: { ...sala.mundo, variante: id } });
}

/**
 * Pasa la sala a otra plantilla: descarta los objetos que no caben (fuera o chocando), y vacía ajustes de
 * muebles, pantallas y puestos, que dependen de ids de la plantilla anterior.
 */
export function cambiarPlantilla(
  sala: SalaGuardada,
  escenarioNuevo: Escenario,
  limites: LimitesSala = LIMITES_SALA,
): { ok: true; sala: SalaGuardada; descartados: number } {
  const quedan: ObjetoColocado[] = [];
  for (const o of sala.mundo.objetos) {
    const r = evaluarColocacion(o, { escenario: escenarioNuevo, objetos: quedan, limites });
    if (r.estado !== 'fuera' && r.estado !== 'choca') quedan.push(o);
  }
  return {
    ok: true,
    descartados: sala.mundo.objetos.length - quedan.length,
    sala: {
      ...sala,
      plano: { plantilla: escenarioNuevo.id },
      mundo: { objetos: quedan, ajustesMuebles: {}, pantallas: {}, puestos: {} },
    },
  };
}
