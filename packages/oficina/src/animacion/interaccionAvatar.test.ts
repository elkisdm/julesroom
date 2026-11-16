import { describe, expect, it } from 'vitest';
import { accionesDe } from '../escenarios/acciones';
import { crearEscenarioPrueba } from '../escenarios/prueba';
import { escenarioTrading } from '../escenarios/trading';
import { escenarioOficina } from '../escenarios/oficina/index';
import { escenarioMansion } from '../escenarios/mansion';
import { sueloDe } from '../escenarios/suelo';
import { crearMapaDeSuelo, puntoLibre, lineaLibre } from './colision';
import { crearNavegacion } from './navegacion';
import {
  avanzarAvatar,
  crearAvatar,
  crearMando,
  sentarEn,
  levantarse,
  fijarDestino,
  PARAMETROS_AVATAR,
  RADIO_AVATAR,
} from './avatar';

const ePrueba = crearEscenarioPrueba('interaccion');
ePrueba.planta = {
  ...ePrueba.planta,
  lugares: [],
  muebles: [
    {
      id: 'sofa-libre',
      tipo: 'sofa',
      ambiente: 'comun',
      x: 8,
      z: 8,
      y: 0,
      ancho: 2.6,
      fondo: 0.9,
      alto: 0.8,
      giro: 0,
      conjunto: 'sofa',
    },
  ],
};
const seat = accionesDe(ePrueba).find((a) => a.tipo === 'sentarse')!;
if (seat.tipo !== 'sentarse') throw new Error('Falta sofá');
const mapa = crearMapaDeSuelo(sueloDe(ePrueba));
const nav = crearNavegacion(mapa, 0.25, RADIO_AVATAR);
const paso = (a: ReturnType<typeof crearAvatar>, m: ReturnType<typeof crearMando>) =>
  avanzarAvatar(a, m, 0, mapa, nav, PARAMETROS_AVATAR, 1 / 60);
describe('contrato físico del asiento', () => {
  it('llega alineado al apoyo antes de bajar, sin deslizamiento lateral', () => {
    const ap = seat.asiento.aproximacion;
    const a = crearAvatar(ap.x + 0.25, ap.z, 0, ap.y);
    const m = crearMando();
    sentarEn(m, seat);
    for (let i = 0; i < 900 && a.sentarse.fase !== 'sentandose'; i++) paso(a, m);
    expect(a.sentarse.fase).toBe('sentandose');
    expect(Math.hypot(a.x - ap.x, a.z - ap.z)).toBeLessThan(0.08);
  });
  it('desde detrás rodea el sólido antes de iniciar la transición', () => {
    const s = seat.asiento;
    const a = crearAvatar(s.x - Math.sin(s.yaw) * 2, s.z - Math.cos(s.yaw) * 1.6, s.yaw);
    const m = crearMando();
    sentarEn(m, seat);
    paso(a, m);
    let x = a.x,
      z = a.z;
    for (let i = 0; i < a.nRuta; i++) {
      const px = a.ruta[i * 2]!,
        pz = a.ruta[i * 2 + 1]!;
      expect(lineaLibre(mapa, x, z, px, pz, RADIO_AVATAR, a.y)).toBe(true);
      x = px;
      z = pz;
    }
    expect(x).toBeCloseTo(s.aproximacion.x);
    expect(z).toBeCloseTo(s.aproximacion.z);
  });
  it('un asiento ocupado rechaza tanto E como clic y cancela la aproximación si se ocupa', () => {
    const m = crearMando();
    m.asientosOcupados = new Set([seat.id]);
    sentarEn(m, seat);
    expect(m.sentar).toBeNull();
    m.asientosOcupados = new Set();
    sentarEn(m, seat);
    const ap = seat.asiento.aproximacion;
    const a = crearAvatar(ap.x - 2, ap.z, 0, ap.y);
    paso(a, m);
    m.asientosOcupados = new Set([seat.id]);
    paso(a, m);
    expect(a.sentarse.fase).toBe('libre');
  });
  it('cede el asiento si otra persona lo ocupa durante la bajada', () => {
    const ap = seat.asiento.aproximacion;
    const a = crearAvatar(ap.x, ap.z, seat.asiento.yaw, ap.y),
      m = crearMando();
    sentarEn(m, seat);
    for (let i = 0; i < 180 && a.sentarse.fase !== 'sentandose'; i++) paso(a, m);
    expect(a.sentarse.fase).toBe('sentandose');
    for (let i = 0; i < 15; i++) paso(a, m);
    m.asientosOcupados = new Set([seat.id]);
    paso(a, m);
    expect(a.sentarse.fase).not.toBe('sentandose');
    for (let i = 0; i < 90; i++) paso(a, m);
    expect(a.sentarse.fase).toBe('libre');
    expect(a.estado).toBe('de-pie');
  });
  it('piso cancela un asiento lejano y no lo retoma al llegar', () => {
    const ap = seat.asiento.aproximacion;
    const a = crearAvatar(ap.x + 2, ap.z + 1, 0, ap.y);
    const m = crearMando();
    sentarEn(m, seat);
    paso(a, m);
    fijarDestino(m, ap.x + 1, ap.z + 1);
    for (let i = 0; i < 600; i++) paso(a, m);
    expect(a.sentarse.fase).toBe('libre');
    expect(a.estado).toBe('de-pie');
  });
  it.each([escenarioTrading, escenarioOficina, escenarioMansion])(
    'levantarse termina libre en $id',
    (e) => {
      const mapa = crearMapaDeSuelo(sueloDe(e));
      const nav = crearNavegacion(mapa, 0.25, RADIO_AVATAR);
      for (const seat of accionesDe(e)) {
        if (seat.tipo !== 'sentarse') continue;
        const ap = seat.asiento.aproximacion;
        const a = crearAvatar(ap.x, ap.z, seat.asiento.yaw, ap.y),
          m = crearMando();
        sentarEn(m, seat);
        for (let i = 0; i < 180; i++) avanzarAvatar(a, m, 0, mapa, nav, PARAMETROS_AVATAR, 1 / 60);
        expect(a.sentarse.fase, seat.id).toBe('sentado');
        levantarse(m);
        for (let i = 0; i < 90; i++) avanzarAvatar(a, m, 0, mapa, nav, PARAMETROS_AVATAR, 1 / 60);
        expect(a.sentarse.fase, seat.id).toBe('libre');
        expect(puntoLibre(mapa, a.x, a.z, RADIO_AVATAR, a.y), seat.id).toBe(true);
      }
    },
  );
});
