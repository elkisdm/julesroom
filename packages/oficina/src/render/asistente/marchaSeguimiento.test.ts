import { describe, expect, it } from 'vitest';
import { crearMapaDeCajas } from '../../animacion/colision';
import { crearNavegacion } from '../../animacion/navegacion';
import { avanzarSeguimiento, crearSeguimiento, PARAMETROS_ASISTENTE as P } from './seguimiento';
import { avanzarAcompanamiento, crearAcompanamiento } from './acompanamiento';
import '../../escenarios/mansion';
import '../../escenarios/oficina';
import '../../escenarios/trading';
import { accionesDe } from '../../escenarios/acciones';
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
import { pendienteSuelo, topeVelocidadEscalera } from '../../animacion/pisada';
import { lineaLibre } from '../../animacion/colision';

const dt = 1 / 60,
  camara = { x: 0, y: 8, z: 15 };
function banco(cajas: Parameters<typeof crearMapaDeCajas>[0] = []) {
  const mapa = crearMapaDeCajas(cajas, { x0: -100, x1: 100, z0: -100, z1: 100 });
  return crearSeguimiento(crearNavegacion(mapa, P.celda, P.radioRuta), {
    x: -P.distancia,
    y: 0,
    z: 0,
  });
}
describe('marcha de compañía integrada', () => {
  it('cede y deja de marchar cuando el usuario quieto ocupa una puerta', () => {
    const escenario = escenarioPorId('trading'),
      mapa = crearMapaDeSuelo(sueloDe(escenario));
    const e = crearSeguimiento(crearNavegacion(mapa, P.celda, P.radioRuta), {
      x: 15.04,
      y: 0,
      z: -7.6,
    });
    const usuario = { x: 14.5, y: 0, z: -8.925 };
    const otros = { x: new Float64Array([usuario.x]), z: new Float64Array([usuario.z]), n: 1 };
    for (let i = 0; i < 120; i++) {
      avanzarSeguimiento(e, usuario, camara, dt, otros);
      if (i * dt > P.periodoRuta) expect(e.avatar.velocidad).toBeLessThan(P.velocidadMin);
    }
  });
  it.each(['trading', 'mansion'])('espera como persona junto a un asiento real de %s', (id) => {
    const escenario = escenarioPorId(id),
      entrada = escenario.entradas[0]!;
    const mapa = crearMapaDeSuelo(sueloDe(escenario)),
      nav = crearNavegacion(mapa, P.celda, P.radioRuta);
    const e = crearSeguimiento(nav, entrada, camara),
      forma = crearAcompanamiento();
    const asiento = accionesDe(escenario)
      .filter((s) => s.tipo === 'sentarse' && Math.abs(s.asiento.aproximacion.y - entrada.y) < 1)
      .sort(
        (a, b) =>
          Math.hypot(a.x - entrada.x, a.z - entrada.z) -
          Math.hypot(b.x - entrada.x, b.z - entrada.z),
      )[0]!;
    if (asiento.tipo !== 'sentarse') throw new Error('El escenario no tiene asiento');
    const usuario = {
      x: asiento.x,
      y: asiento.asiento.y,
      z: asiento.z,
      estado: 'sentado' as const,
    };
    for (let i = 0; i < 900; i++) {
      avanzarSeguimiento(e, usuario, camara, dt, undefined, true, true, forma.orbe);
      avanzarAcompanamiento(
        forma,
        {
          distancia: Math.hypot(e.avatar.x - usuario.x, e.avatar.z - usuario.z),
          velocidadUsuario: e.velocidadUsuario,
          sinRuta: e.sinRuta,
          razonRuta: e.razonRuta,
        },
        dt,
      );
    }
    expect(e.sinSitio).toBe(false);
    expect(forma.forma.forma).toBe(1);
    expect(e.avatar.velocidad).toBeLessThan(P.velocidadMin);
    expect(Math.hypot(e.avatar.x - usuario.x, e.avatar.z - usuario.z)).toBeGreaterThan(
      P.distanciaMin,
    );
  });
  it('ceder el paso conserva segmentos libres en oficina', () => {
    const escenario = escenarioPorId('oficina'),
      entrada = escenario.entradas[0]!;
    const mapa = crearMapaDeSuelo(sueloDe(escenario)),
      nav = crearNavegacion(mapa, P.celda, P.radio);
    const e = crearSeguimiento(nav, entrada),
      usuario = crearAvatar(entrada.x, entrada.z, 0, entrada.y),
      mando = crearMando();
    for (const zona of escenario.zonas.slice(0, 4)) {
      fijarDestino(mando, (zona.x0 + zona.x1) / 2, (zona.z0 + zona.z1) / 2, true, zona.y);
      for (let i = 0; i < 600; i++) {
        avanzarAvatar(usuario, mando, 0, mapa, nav, PARAMETROS_AVATAR, dt);
        const antes = { x: e.avatar.x, y: e.avatar.y, z: e.avatar.z };
        avanzarSeguimiento(e, usuario, camara, dt);
        if (e.recuperacion !== 'normal') continue;
        expect(
          lineaLibre(mapa, antes.x, antes.z, e.avatar.x, e.avatar.z, P.radio, antes.y),
          JSON.stringify({
            i,
            antes,
            despues: { x: e.avatar.x, y: e.avatar.y, z: e.avatar.z },
            destino: e.destino,
          }),
        ).toBe(true);
      }
    }
  });
  it('acompaña por la escalera caminable como persona', () => {
    const escenario = escenarioPorId('mansion'),
      entrada = escenario.entradas[0]!;
    const mapa = crearMapaDeSuelo(sueloDe(escenario));
    const nav = crearNavegacion(mapa, P.celda, P.radioRuta);
    const e = crearSeguimiento(nav, entrada, camara),
      forma = crearAcompanamiento();
    const usuario = crearAvatar(entrada.x, entrada.z, 0, entrada.y),
      mando = crearMando();
    const otros = { x: new Float64Array(1), z: new Float64Array(1), n: 1 };
    fijarDestino(mando, 3.2, -3.2, false, 3.9);
    let cuadrosPersonaEscalera = 0,
      cuadrosOrbeEscalera = 0;
    const cambios: unknown[] = [];
    let esperandoFila = 0;
    for (let i = 0; i < 1800; i++) {
      usuario.loc.topeVelocidad = topeVelocidadEscalera(
        pendienteSuelo(mapa.suelo!, usuario.x, usuario.z, usuario.rumbo, usuario.ySuelo),
        usuario.loc.correr,
      );
      avanzarAvatar(usuario, mando, 0, mapa, nav, PARAMETROS_AVATAR, dt);
      otros.x[0] = usuario.x;
      otros.z[0] = usuario.z;
      const ceder =
        usuario.velocidad < P.velocidadMin &&
        Math.hypot(e.avatar.x - usuario.x, e.avatar.y - usuario.y, e.avatar.z - usuario.z) <
          P.distancia &&
        Math.abs(e.avatar.y - usuario.y) > P.radio;
      avanzarSeguimiento(e, usuario, camara, dt, otros, true, true, forma.orbe);
      esperandoFila = ceder ? esperandoFila + dt : 0;
      if (esperandoFila > P.periodoRuta) expect(e.avatar.velocidad).toBeLessThan(P.velocidadMin);
      const antes = forma.orbe;
      avanzarAcompanamiento(
        forma,
        {
          distancia: Math.hypot(
            e.avatar.x - usuario.x,
            e.avatar.y - usuario.y,
            e.avatar.z - usuario.z,
          ),
          velocidadUsuario: e.velocidadUsuario,
          sinRuta: e.sinRuta,
          razonRuta: e.razonRuta,
        },
        dt,
      );
      if (antes !== forma.orbe)
        cambios.push({
          i,
          orbe: forma.orbe,
          sinRuta: e.sinRuta,
          sinSitio: e.sinSitio,
          razon: e.razonRuta,
          distancia: Math.hypot(
            e.avatar.x - usuario.x,
            e.avatar.y - usuario.y,
            e.avatar.z - usuario.z,
          ),
          velocidad: e.velocidadUsuario,
          y: e.avatar.y,
          yUsuario: usuario.y,
          usuario: [usuario.x, usuario.z],
          jules: [e.avatar.x, e.avatar.z],
          destino: e.destino,
        });
      if (e.avatar.y > 0 && e.avatar.y < 3.9) {
        if (forma.orbe) cuadrosOrbeEscalera++;
        else cuadrosPersonaEscalera++;
      }
    }
    expect(e.avatar.y).toBeGreaterThan(3.9 - P.toleranciaPiso);
    expect(e.avatar.velocidad).toBeLessThan(P.velocidadMin);
    expect(cuadrosPersonaEscalera).toBeGreaterThan(0);
    expect(cuadrosOrbeEscalera, JSON.stringify(cambios)).toBe(0);
  });
  it('acompaña caminando como persona y se orienta hacia el usuario al parar', () => {
    const e = banco(),
      forma = crearAcompanamiento();
    const usuario = { x: 0, y: 0, z: 0 };
    let cambios = 0;
    for (let i = 0; i < 900; i++) {
      usuario.z = Math.min(i, 300) * dt * P.locomocion.velMax;
      avanzarSeguimiento(e, usuario, camara, dt);
      const previa = forma.orbe;
      avanzarAcompanamiento(
        forma,
        {
          distancia: Math.hypot(e.avatar.x - usuario.x, e.avatar.z - usuario.z),
          velocidadUsuario: e.velocidadUsuario,
          sinRuta: e.sinRuta,
          razonRuta: e.razonRuta,
        },
        dt,
      );
      if (previa !== forma.orbe) cambios++;
    }
    expect(cambios).toBe(0);
    expect(e.avatar.velocidad).toBeLessThan(P.velocidadMin);
    expect(e.avatar.rumbo).toBeCloseTo(Math.atan2(usuario.x - e.avatar.x, usuario.z - e.avatar.z));
  });
  it('detecta la carrera del usuario antes de perder la distancia lateral', () => {
    const e = banco(),
      usuario = { x: 0, y: 0, z: 0 };
    avanzarSeguimiento(e, usuario, camara, dt);
    usuario.z += P.locomocion.velCorrer * dt;
    avanzarSeguimiento(e, usuario, camara, dt);
    expect(e.velocidadUsuario).toBeCloseTo(P.locomocion.velCorrer);
    expect(e.mando.correr).toBe(true);
  });
  it('la transformación no pausa ni recoloca la física', () => {
    const e = banco(),
      forma = crearAcompanamiento(),
      usuario = { x: 9, y: 0, z: 0 };
    let vioOrbe = false,
      vioPersona = false;
    for (let i = 0; i < 900; i++) {
      const { x, z } = e.avatar;
      avanzarSeguimiento(e, usuario, camara, dt, undefined, true, true, forma.orbe);
      const posicion = { x: e.avatar.x, z: e.avatar.z, velocidad: e.avatar.velocidad };
      avanzarAcompanamiento(
        forma,
        {
          distancia: Math.hypot(e.avatar.x - usuario.x, e.avatar.z - usuario.z),
          velocidadUsuario: e.velocidadUsuario,
          sinRuta: e.sinRuta,
          razonRuta: e.razonRuta,
        },
        dt,
      );
      expect({ x: e.avatar.x, z: e.avatar.z, velocidad: e.avatar.velocidad }).toEqual(posicion);
      expect(Math.hypot(e.avatar.x - x, e.avatar.z - z)).toBeLessThan(
        P.locomocionOrbe.velCorrer * dt + Number.EPSILON * 100,
      );
      if (forma.forma.forma === 0) vioOrbe = true;
      if (vioOrbe && forma.forma.forma === 1) vioPersona = true;
    }
    expect(vioOrbe && vioPersona).toBe(true);
  });
  it('informa ruta inexistente para activar el orbe', () => {
    const e = banco([{ x0: -0.4, x1: 0.4, z0: -100, z1: 100 }]);
    for (let i = 0; i < 30; i++) avanzarSeguimiento(e, { x: 4, y: 0, z: 0 }, camara, dt);
    expect(e.sinRuta).toBe(true);
  });
  it('informa que no hay sitio caminable aunque el destino anterior ya estuviera alcanzado', () => {
    const e = banco([{ x0: 2, x1: 8, z0: -3, z1: 3 }]);
    avanzarSeguimiento(e, { x: 5, y: 0, z: 0 }, camara, dt);
    expect(e.sinRuta).toBe(true);
  });
  it('informa un desvío largo alrededor de un muro', () => {
    const e = banco([{ x0: -0.4, x1: 0.4, z0: -10, z1: 10 }]);
    avanzarSeguimiento(e, { x: 4, y: 0, z: 0 }, camara, dt);
    expect(e.sinRuta).toBe(false);
    expect(e.razonRuta).toBeGreaterThan(P.forma.razonRutaOrbe);
  });
});
