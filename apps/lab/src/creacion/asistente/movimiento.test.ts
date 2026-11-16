import { describe, expect, it } from 'vitest';
import { escenarioAuditorio, escenarioOficina, sueloDe } from '@oficina/motor';
import { crearMapaDeSuelo } from '@oficina/motor';
import { crearNavegacion } from '@oficina/motor';
import { avanzarSeguimiento, crearSeguimiento, PARAMETROS_ASISTENTE } from '@oficina/motor';
import { lugaresDe } from './lugares';

describe('guía con el navegador físico real', () => {
  for (const mundo of [escenarioAuditorio, escenarioOficina]) {
    it(`${mundo.id}: llega caminando a cada lugar y regresa al puesto`, () => {
      const mapa = crearMapaDeSuelo(sueloDe(mundo));
      const nav = crearNavegacion(mapa, PARAMETROS_ASISTENTE.celda, PARAMETROS_ASISTENTE.radioRuta);
      const entrada = mundo.entradas[0]!;
      for (const lugar of [...lugaresDe(mundo), { ...entrada, id: 'puesto' }]) {
        const e = crearSeguimiento(nav, entrada, { x: 0, y: 7, z: 20 });
        for (let i = 0; i < 1800; i++) {
          e.recuperacion = 'normal';
          const anterior = { x: e.avatar.x, y: e.avatar.y, z: e.avatar.z };
          avanzarSeguimiento(e, lugar, entrada, 1 / 30, undefined, true, false, false);
          expect(Math.hypot(e.avatar.x - anterior.x, e.avatar.z - anterior.z)).toBeLessThan(0.5);
          if (Math.hypot(e.avatar.x - lugar.x, e.avatar.z - lugar.z, e.avatar.y - lugar.y) < 0.7)
            break;
        }
        expect(
          Math.hypot(e.avatar.x - lugar.x, e.avatar.z - lugar.z, e.avatar.y - lugar.y),
          lugar.id,
        ).toBeLessThan(0.7);
      }
    });
  }
});

it('auditorio: retoma la guía desde el borde de las butacas', () => {
  const nav = crearNavegacion(
    crearMapaDeSuelo(sueloDe(escenarioAuditorio)),
    PARAMETROS_ASISTENTE.celda,
    PARAMETROS_ASISTENTE.radioRuta,
  );
  const e = crearSeguimiento(nav, { x: 1.1056485318209364, y: 0, z: 9.3089881869736 });
  const destino = { x: 0, y: 0.4, z: -8 };
  for (let i = 0; i < 1800; i++) {
    e.recuperacion = 'normal';
    avanzarSeguimiento(e, destino, destino, 1 / 60, undefined, true, false, false);
  }
  expect(
    Math.hypot(e.avatar.x - destino.x, e.avatar.z - destino.z),
    JSON.stringify({ x: e.avatar.x, z: e.avatar.z, n: e.avatar.nRuta, sin: e.sinRuta }),
  ).toBeLessThan(0.7);
});
