import { afterEach, describe, expect, it } from 'vitest';
import { accionesDe } from '../escenarios/acciones';
import { escenarioTrading } from '../escenarios/trading';
import { sueloDe } from '../escenarios/suelo';
import type { AccionSentarse } from '../escenarios/tipos';
import {
  avanzarAvatar,
  cancelar,
  crearAvatar,
  crearMando,
  fijarDestino,
  levantarse,
  PARAMETROS_AVATAR,
  RADIO_AVATAR,
  saltar,
  sentarEn,
} from './avatar';
import type { Avatar, Mando } from './avatar';
import { crearMapaDeSuelo } from './colision';
import { crearNavegacion } from './navegacion';
import { encenderTodo } from './opciones';
import { PELVIS_DE_PIE } from './sentarse';

const DT = 1 / 60;
const suelo = sueloDe(escenarioTrading);
const mapa = crearMapaDeSuelo(suelo);
const nav = crearNavegacion(mapa, 0.25, RADIO_AVATAR);
const acciones = accionesDe(escenarioTrading);
const sentadas = acciones.filter((a): a is AccionSentarse => a.tipo === 'sentarse');
const porId = (id: string) => sentadas.find((a) => a.id === id)!;

const paso = (a: Avatar, m: Mando, n = 1) => {
  for (let i = 0; i < n; i++) avanzarAvatar(a, m, 0, mapa, nav, PARAMETROS_AVATAR, DT);
};
/** Corre hasta que `listo` (o 15 s); devuelve los segundos. */
const hasta = (a: Avatar, m: Mando, listo: (a: Avatar) => boolean, max = 15): number => {
  let t = 0;
  while (!listo(a) && t < max) {
    paso(a, m);
    t += DT;
  }
  return t;
};
/** Avatar cerca de (x, z) mirando al sur, ya asentado en el suelo. */
const crearEn = (x: number, z: number, y = 0): Avatar => {
  const a = crearAvatar(x, z, Math.PI, y);
  paso(a, crearMando(), 3);
  return a;
};

afterEach(() => encenderTodo());

describe('avatar: sentarse', () => {
  const sofa = porId('sentarse:sofa:1');

  it('E en un sofá cercano: va a la aproximación, gira, se sienta y queda sentado en el asiento', () => {
    const ap = sofa.asiento.aproximacion;
    const a = crearEn(ap.x - 2, ap.z + 1.5);
    const m = crearMando();
    sentarEn(m, sofa);
    paso(a, m);
    expect(a.sentarse.fase).toBe('yendo');
    expect(a.estado).toBe('de-pie');
    const t = hasta(a, m, (q) => q.estado === 'sentado' && q.sentarse.fase === 'sentado');
    expect(t).toBeLessThan(8);
    expect(a.asiento).toBe(sofa.id);
    expect(a.x).toBeCloseTo(sofa.asiento.x, 3);
    expect(a.z).toBeCloseTo(sofa.asiento.z, 3);
    expect(a.rumbo).toBeCloseTo(sofa.asiento.yaw, 3);
    expect(a.velocidad).toBe(0);
    // La raíz del rig baja hasta que la pelvis queda en el asiento.
    expect(a.yRaiz + PELVIS_DE_PIE).toBeCloseTo(sofa.asiento.y, 3);
  });

  it('pasa por las fases en orden y la raíz baja sin saltos', () => {
    const ap = sofa.asiento.aproximacion;
    const a = crearEn(ap.x - 1.5, ap.z);
    const m = crearMando();
    sentarEn(m, sofa);
    const fases: string[] = [];
    let yAnterior = a.yRaiz;
    let saltoMax = 0;
    for (let i = 0; i < 60 * 8 && a.sentarse.fase !== 'sentado'; i++) {
      paso(a, m);
      if (fases[fases.length - 1] !== a.sentarse.fase) fases.push(a.sentarse.fase);
      saltoMax = Math.max(saltoMax, Math.abs(a.yRaiz - yAnterior));
      yAnterior = a.yRaiz;
    }
    expect(fases).toEqual(['yendo', 'girando', 'sentandose', 'sentado']);
    expect(saltoMax).toBeLessThan(0.05);
  });

  it('cualquier tecla de movimiento lo levanta y echa a andar', () => {
    const ap = sofa.asiento.aproximacion;
    const a = crearEn(ap.x, ap.z);
    const m = crearMando();
    sentarEn(m, sofa);
    hasta(a, m, (q) => q.sentarse.fase === 'sentado');
    m.adelante = 1;
    paso(a, m);
    expect(a.sentarse.fase).toBe('levantandose');
    expect(a.estado).toBe('de-pie');
    hasta(a, m, (q) => q.sentarse.fase === 'libre');
    const x = a.x;
    const z = a.z;
    paso(a, m, 30);
    expect(Math.hypot(a.x - x, a.z - z)).toBeGreaterThan(0.1);
    expect(a.asiento).toBeNull();
    expect(a.yRaiz).toBeCloseTo(a.ySuelo, 3);
  });

  it('el salto lo levanta sin saltar; un clic al piso lo levanta y después va allí', () => {
    const ap = sofa.asiento.aproximacion;
    const a = crearEn(ap.x, ap.z);
    const m = crearMando();
    sentarEn(m, sofa);
    hasta(a, m, (q) => q.sentarse.fase === 'sentado');
    saltar(m);
    paso(a, m);
    expect(a.sentarse.fase).toBe('levantandose');
    expect(a.enSuelo).toBe(true);
    hasta(a, m, (q) => q.sentarse.fase === 'libre');
    paso(a, m, 5);
    expect(a.enSuelo).toBe(true);

    // Otra vez sentado, ahora con un clic al piso.
    sentarEn(m, sofa);
    hasta(a, m, (q) => q.sentarse.fase === 'sentado');
    fijarDestino(m, ap.x - 2.5, ap.z);
    paso(a, m);
    expect(a.sentarse.fase).toBe('levantandose');
    hasta(a, m, (q) => Math.hypot(q.x - (ap.x - 2.5), q.z - ap.z) < 0.25, 10);
    expect(Math.hypot(a.x - (ap.x - 2.5), a.z - ap.z)).toBeLessThan(0.25);
    expect(a.estado).toBe('de-pie');
  });

  it('levantarse() (E estando sentado) lo levanta', () => {
    const ap = sofa.asiento.aproximacion;
    const a = crearEn(ap.x, ap.z);
    const m = crearMando();
    sentarEn(m, sofa);
    hasta(a, m, (q) => q.sentarse.fase === 'sentado');
    levantarse(m);
    paso(a, m);
    expect(a.sentarse.fase).toBe('levantandose');
    hasta(a, m, (q) => q.sentarse.fase === 'libre');
    expect(a.estado).toBe('de-pie');
  });

  it('una tecla mientras va al asiento cancela el camino: no sigue hacia la aproximación', () => {
    const ap = sofa.asiento.aproximacion;
    const a = crearEn(ap.x - 3, ap.z + 2);
    const m = crearMando();
    sentarEn(m, sofa);
    paso(a, m, 10);
    expect(a.sentarse.fase).toBe('yendo');
    saltar(m);
    paso(a, m);
    expect(a.sentarse.fase).toBe('libre');
    expect(a.nRuta).toBe(0);
    paso(a, m, 20);
    expect(a.sentarse.fase).toBe('libre');
    expect(a.estado).toBe('de-pie');
  });

  it('un clic a otro punto mientras va al asiento lo cancela y atiende el clic', () => {
    const ap = sofa.asiento.aproximacion;
    const a = crearEn(ap.x - 4, ap.z + 2);
    const m = crearMando();
    sentarEn(m, sofa);
    paso(a, m, 10);
    fijarDestino(m, ap.x - 6, ap.z + 2);
    paso(a, m);
    expect(a.sentarse.fase).toBe('libre');
    hasta(a, m, (q) => q.velocidad < 0.01 && q.reloj > 1, 10);
    expect(Math.hypot(a.x - (ap.x - 6), a.z - (ap.z + 2))).toBeLessThan(0.5);
    expect(a.estado).toBe('de-pie');
  });

  it('pedir otro asiento mientras va al primero cambia de destino', () => {
    const otro = porId('sentarse:sofa:3');
    const ap = sofa.asiento.aproximacion;
    const a = crearEn(ap.x - 3, ap.z + 0.5);
    const m = crearMando();
    sentarEn(m, sofa);
    paso(a, m, 10);
    sentarEn(m, otro);
    paso(a, m);
    expect(a.sentarse.id).toBe(otro.id);
    hasta(a, m, (q) => q.sentarse.fase === 'sentado');
    expect(a.asiento).toBe(otro.id);
    expect(a.x).toBeCloseTo(otro.asiento.x, 3);
  });

  it('levantarse() mientras va cancela el camino', () => {
    const ap = sofa.asiento.aproximacion;
    const a = crearEn(ap.x - 3, ap.z + 2);
    const m = crearMando();
    sentarEn(m, sofa);
    paso(a, m, 10);
    levantarse(m);
    paso(a, m, 2);
    expect(a.sentarse.fase).toBe('libre');
    expect(a.nRuta).toBe(0);
  });

  it('cancelar() un destino no afecta a quien está sentado', () => {
    const ap = sofa.asiento.aproximacion;
    const a = crearEn(ap.x, ap.z);
    const m = crearMando();
    sentarEn(m, sofa);
    hasta(a, m, (q) => q.sentarse.fase === 'sentado');
    cancelar(m);
    paso(a, m, 10);
    // `cancelar` cuenta como una orden de destino nueva: levanta (es un mando al piso).
    expect(a.sentarse.fase === 'levantandose' || a.sentarse.fase === 'libre').toBe(true);
  });

  it('butaca de la fila alta (sobre la grada): se sienta a la altura de su asiento', () => {
    const b = porId('sentarse:butaca-3-2');
    const ap = b.asiento.aproximacion;
    const a = crearEn(ap.x, ap.z - 1.5, 0);
    const m = crearMando();
    sentarEn(m, b);
    const t = hasta(a, m, (q) => q.sentarse.fase === 'sentado');
    expect(t).toBeLessThan(10);
    expect(a.yRaiz + PELVIS_DE_PIE).toBeCloseTo(b.asiento.y, 3);
    expect(a.rumbo).toBeCloseTo(Math.PI, 3);
    // Al levantarse vuelve a la aproximación (sobre la grada de 0,3 m) y sigue en el suelo.
    levantarse(m);
    paso(a, m);
    hasta(a, m, (q) => q.sentarse.fase === 'libre');
    paso(a, m, 5);
    expect(a.enSuelo).toBe(true);
    expect(a.y).toBeCloseTo(0.3, 3);
  });

  it('con una aproximación inalcanzable no se sienta y queda libre', () => {
    const a = crearEn(0, 0);
    const m = crearMando();
    const lejana: AccionSentarse = {
      ...sofa,
      asiento: { ...sofa.asiento, aproximacion: { x: 500, y: 0, z: 500 } },
    };
    sentarEn(m, lejana);
    hasta(a, m, (q) => q.sentarse.fase !== 'yendo', 20);
    expect(a.sentarse.fase).toBe('libre');
    expect(a.estado).toBe('de-pie');
  });

  it('con el avatar sentado, avanzar no asigna objetos nuevos (la salida y la ruta se reutilizan)', () => {
    const ap = sofa.asiento.aproximacion;
    const a = crearEn(ap.x, ap.z);
    const m = crearMando();
    sentarEn(m, sofa);
    hasta(a, m, (q) => q.sentarse.fase === 'sentado');
    const { salida, ruta, loc } = a;
    const salidaSentarse = a.sentarse.salida;
    paso(a, m, 120);
    expect(a.salida).toBe(salida);
    expect(a.ruta).toBe(ruta);
    expect(a.loc).toBe(loc);
    expect(a.sentarse.salida).toBe(salidaSentarse);
    expect(a.estado).toBe('sentado');
  });
});
