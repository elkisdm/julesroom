import { describe, expect, it } from 'vitest';
import { crearMapaDeCajas, lineaLibre, puntoLibre } from '../../animacion/colision';
import { crearNavegacion } from '../../animacion/navegacion';
import { avanzarSeguimiento, crearSeguimiento, PARAMETROS_ASISTENTE as P } from './seguimiento';

const DT = 1 / 60;
const camara = { x: 0, y: 8, z: 15 };
const objetivo = { x: 4, y: 0, z: 0 };
function banco() {
  const mapa = crearMapaDeCajas([{ x0: -0.5, x1: 0.5, z0: -3, z1: 3 }], {
    x0: -15,
    x1: 15,
    z0: -15,
    z1: 15,
  });
  return crearSeguimiento(crearNavegacion(mapa, 0.25, P.radio), { x: -4, y: 0, z: 0 });
}
describe('Jules acompaña por la navegación del avatar', () => {
  it('rodea un muro sin cruzarlo entre cuadros y termina cerca', () => {
    const e = banco();
    for (let i = 0; i < 1200; i++) {
      const { x, z } = e.avatar;
      avanzarSeguimiento(e, objetivo, camara, DT);
      expect(puntoLibre(e.nav.mapa, e.avatar.x, e.avatar.z, P.radio)).toBe(true);
      expect(lineaLibre(e.nav.mapa, x, z, e.avatar.x, e.avatar.z, P.radio)).toBe(true);
    }
    expect(Math.hypot(e.avatar.x - objetivo.x, e.avatar.z - objetivo.z)).toBeLessThan(
      P.distanciaMax,
    );
  });
  it.each([2.3, 4.8])('acompaña a %s m/s y se asienta sin oscilar', (velocidad) => {
    const e = banco();
    const usuario = { x: -5, y: 0, z: -8 };
    for (let i = 0; i < 600; i++) {
      usuario.z = -8 + Math.min(i * DT * velocidad, 16);
      avanzarSeguimiento(e, usuario, camara, DT);
      if (i > 150) {
        const distancia = Math.hypot(e.avatar.x - usuario.x, e.avatar.z - usuario.z);
        expect(distancia).toBeLessThan(P.distanciaMax);
        expect(distancia).toBeGreaterThan(P.distanciaMin);
      }
    }
    for (let i = 0; i < 600; i++) avanzarSeguimiento(e, usuario, camara, DT);
    const { x, z } = e.avatar;
    for (let i = 0; i < 600; i++) avanzarSeguimiento(e, usuario, camara, DT);
    expect(Math.hypot(e.avatar.x - x, e.avatar.z - z)).toBeLessThan(0.01);
    expect(e.avatar.velocidad).toBeLessThan(0.01);
  });
});

import '../../escenarios/trading';
import '../../escenarios/oficina';
import { escenarioPorId } from '../../escenarios/registro';
import { sueloDe } from '../../escenarios/suelo';
import { crearMapaDeSuelo } from '../../animacion/colision';
import {
  avanzarAvatar,
  crearAvatar,
  crearMando,
  fijarDestino,
  PARAMETROS_AVATAR,
} from '../../animacion/avatar';

describe('geometría real de las plantillas', () => {
  it.each(['trading', 'oficina', 'mansion'])(
    '%s: posiciones y segmentos libres siguiendo un avatar por rutas reales',
    (id) => {
      const escenario = escenarioPorId(id);
      const entrada = escenario.entradas[0]!;
      const mapa = crearMapaDeSuelo(sueloDe(escenario));
      const nav = crearNavegacion(mapa, 0.25, P.radio);
      const e = crearSeguimiento(nav, entrada);
      const usuario = crearAvatar(entrada.x, entrada.z, 0, entrada.y);
      const mando = crearMando();
      for (const zona of escenario.zonas.slice(0, 4)) {
        fijarDestino(mando, (zona.x0 + zona.x1) / 2, (zona.z0 + zona.z1) / 2, true, zona.y);
        for (let i = 0; i < 600; i++) {
          avanzarAvatar(usuario, mando, 0, mapa, nav, PARAMETROS_AVATAR, DT);
          const { x, y, z } = e.avatar;
          avanzarSeguimiento(e, usuario, camara, DT);
          if (e.recuperacion !== 'normal') continue;
          expect(puntoLibre(mapa, e.avatar.x, e.avatar.z, P.radio, e.avatar.y)).toBe(true);
          expect(lineaLibre(mapa, x, z, e.avatar.x, e.avatar.z, P.radio, y)).toBe(true);
        }
      }
    },
  );
  it('recupera distancia excesiva solo cuando está invisible y en un punto libre', () => {
    const e = banco();
    const usuario = { x: 12, y: 0, z: 12 };
    let recolocada = false;
    for (let i = 0; i < 300; i++) {
      const { x, z } = e.avatar;
      avanzarSeguimiento(e, usuario, camara, DT);
      if (Math.hypot(e.avatar.x - x, e.avatar.z - z) > 1) {
        expect(e.visibilidad).toBe(0);
        expect(puntoLibre(e.nav.mapa, e.avatar.x, e.avatar.z, P.radio)).toBe(true);
        recolocada = true;
      }
    }
    expect(recolocada).toBe(true);
    expect(e.visibilidad).toBe(1);
  });
});

import { avanzarForma, crearForma, DISTANCIA_SALTO } from './maquina';

it('transforma antes de viajar y no salta de posición al cambiar de forma', () => {
  const e = banco();
  const forma = crearForma();
  let orbe = false;
  for (let i = 0; i < 1200; i++) {
    const { x, yCuerpo, z } = e.avatar;
    avanzarSeguimiento(e, objetivo, camara, DT, undefined, forma.forma === 0);
    const a = e.avatar;
    const viaje =
      a.velocidad > P.velocidadMin ||
      Math.hypot(a.x - e.destino.x, a.z - e.destino.z) > P.distanciaViaje;
    avanzarForma(forma, viaje ? DISTANCIA_SALTO + P.distanciaViaje : 0, DT, false);
    expect(Math.hypot(a.x - x, a.yCuerpo - yCuerpo, a.z - z)).toBeLessThan(0.2);
    if (forma.forma === 0) orbe = true;
  }
  expect(orbe).toBe(true);
  expect(forma.forma).toBe(1);
  expect(Math.hypot(e.avatar.x - objetivo.x, e.avatar.z - objetivo.z)).toBeLessThan(P.distanciaMax);
});

it('sube con el usuario por la escalera real de la mansión', () => {
  const escenario = escenarioPorId('mansion');
  const entrada = escenario.entradas[0]!;
  const zona = escenario.zonas.find((z) => z.y > entrada.y)!;
  const mapa = crearMapaDeSuelo(sueloDe(escenario));
  const nav = crearNavegacion(mapa, P.celda, P.radioRuta);
  const e = crearSeguimiento(nav, entrada);
  const usuario = crearAvatar(entrada.x, entrada.z, 0, entrada.y);
  const mando = crearMando();
  const forma = crearForma();
  fijarDestino(mando, (zona.x0 + zona.x1) / 2, (zona.z0 + zona.z1) / 2, false, zona.y);
  for (let i = 0; i < 7200; i++) {
    avanzarAvatar(usuario, mando, 0, mapa, nav, PARAMETROS_AVATAR, DT);
    const y = e.avatar.y;
    avanzarSeguimiento(e, usuario, camara, DT, undefined, forma.forma === 0);
    const viaje =
      e.avatar.velocidad > P.velocidadMin ||
      Math.hypot(e.avatar.x - e.destino.x, e.avatar.z - e.destino.z) > P.distanciaViaje;
    avanzarForma(forma, viaje ? DISTANCIA_SALTO + P.distanciaViaje : 0, DT, false);
    expect(e.recuperacion).toBe('normal');
    expect(Math.abs(e.avatar.y - y)).toBeLessThanOrEqual(mapa.suelo!.paso);
  }
  expect(usuario.y).toBeCloseTo(zona.y, 1);
  expect(e.avatar.y).toBeCloseTo(usuario.y, 1);
  expect(Math.hypot(e.avatar.x - usuario.x, e.avatar.z - usuario.z)).toBeLessThan(P.distanciaMax);
});

it('recupera un destino cercano sin ruta tras esperar, sin cruzar el muro visible', () => {
  const mapa = crearMapaDeCajas([{ x0: -0.4, x1: 0.4, z0: -10, z1: 10 }], {
    x0: -10,
    x1: 10,
    z0: -10,
    z1: 10,
  });
  const e = crearSeguimiento(crearNavegacion(mapa, P.celda, P.radioRuta), { x: -2, y: 0, z: 0 });
  const usuario = { x: 2, y: 0, z: 0 };
  let invisible = false;
  for (let i = 0; i < 900; i++) {
    avanzarSeguimiento(e, usuario, camara, DT);
    if (e.visibilidad === 0) invisible = true;
  }
  expect(invisible).toBe(true);
  expect(e.avatar.x).toBeGreaterThan(0);
  expect(e.visibilidad).toBe(1);
});

it('evita el cono delante de la cámara cuando los costados están ocupados', () => {
  const mapa = crearMapaDeCajas([], { x0: -10, x1: 10, z0: -10, z1: 10 });
  const e = crearSeguimiento(crearNavegacion(mapa, P.celda, P.radioRuta), { x: 0, y: 0, z: -4 });
  const otros = { x: new Float64Array([1.8, -1.8]), z: new Float64Array([0, 0]), n: 2 };
  for (let i = 0; i < 600; i++) avanzarSeguimiento(e, { x: 0, y: 0, z: 0 }, camara, DT, otros);
  expect(e.avatar.z).toBeLessThanOrEqual(P.distancia * 0.35);
});

it('elige un sitio libre al iniciar sobre un mueble', () => {
  const e = banco();
  const sobreMuro = crearSeguimiento(e.nav, { x: 0, y: 0, z: 0 });
  expect(puntoLibre(e.nav.mapa, sobreMuro.avatar.x, sobreMuro.avatar.z, P.radio)).toBe(true);
});

it('acompaña al usuario sentado sin ocuparlo y mantiene la banda mínima', () => {
  const e = banco();
  const sentado = { x: -6, y: 0.45, z: 6 };
  for (let i = 0; i < 600; i++) avanzarSeguimiento(e, sentado, camara, DT);
  expect(Math.hypot(e.avatar.x - sentado.x, e.avatar.z - sentado.z)).toBeGreaterThan(
    P.distanciaMin,
  );
  expect(Math.hypot(e.avatar.x - sentado.x, e.avatar.z - sentado.z)).toBeLessThan(P.distanciaMax);
});

it('inicia acompañando a un costado libre, sin superponerse al usuario', () => {
  const nav = banco().nav;
  const usuario = { x: -4, y: 0, z: 0 };
  const e = crearSeguimiento(nav, usuario, camara);
  expect(Math.hypot(e.avatar.x - usuario.x, e.avatar.z - usuario.z)).toBeGreaterThan(
    P.distanciaMin,
  );
  expect(puntoLibre(nav.mapa, e.avatar.x, e.avatar.z, P.radio)).toBe(true);
});

it('se aparta de quien se acerca incluso mientras se transforma', () => {
  const mapa = crearMapaDeCajas([], { x0: -10, x1: 10, z0: -10, z1: 10 });
  const e = crearSeguimiento(crearNavegacion(mapa, P.celda, P.radioRuta), { x: 0, y: 0, z: 0 });
  const usuario = { x: 1.5, y: 0, z: 0 };
  const otros = { x: new Float64Array(1), z: new Float64Array(1), n: 1 };
  for (let i = 0; i < 90; i++) {
    usuario.x -= DT;
    otros.x[0] = usuario.x;
    avanzarSeguimiento(e, usuario, camara, DT, otros, false);
    expect(Math.hypot(e.avatar.x - usuario.x, e.avatar.z - usuario.z)).toBeGreaterThan(0.7);
  }
});

it('conserva su reposo para volver cuando termina el acompañamiento', () => {
  const e = banco();
  const origen = { x: e.avatar.x, y: e.avatar.y, z: e.avatar.z };
  expect(e.origen).toEqual(origen);
  for (let i = 0; i < 900; i++) avanzarSeguimiento(e, objetivo, camara, DT);
  for (let i = 0; i < 900; i++) avanzarSeguimiento(e, e.origen, camara, DT, undefined, true, false);
  expect(Math.hypot(e.avatar.x - origen.x, e.avatar.z - origen.z)).toBeLessThan(P.distanciaViaje);
});

it('recupera una ruta que queda bloqueada aunque siga cerca del usuario', () => {
  const limites = { x0: -10, x1: 10, z0: -10, z1: 10 };
  const mapa = crearMapaDeCajas([], limites);
  const nav = crearNavegacion(mapa, P.celda, P.radioRuta);
  // Un sólido nuevo invalida el recorrido ya rasterizado.
  Object.assign(mapa, crearMapaDeCajas([{ x0: -0.4, x1: 0.4, z0: -10, z1: 10 }], limites));
  const e = crearSeguimiento(nav, { x: -2, y: 0, z: 0 });
  const usuario = { x: 2, y: 0, z: 0 };
  for (let i = 0; i < 900; i++) avanzarSeguimiento(e, usuario, camara, DT);
  expect(e.avatar.x).toBeGreaterThan(0);
  expect(e.mando.destino).toBeNull();
  expect(e.avatar.velocidad).toBeLessThan(P.velocidadMin);
});
