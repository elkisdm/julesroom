import { afterEach, describe, expect, it } from 'vitest';
import { encenderTodo } from '../animacion/opciones';
import { escenarioTrading } from '../escenarios/trading';
import { escenarioOficina } from '../escenarios/oficina';
import { crearMapaDeSuelo, moverConColision, puntoLibre } from '../animacion/colision';
import { sueloDe } from '../escenarios/suelo';
import { RADIO_AVATAR } from '../animacion/avatar';
import { cajaDe } from '../mansion/plano';
import {
  avanzarSeguimiento,
  crearSeguimiento,
  normalizarAngulo,
  PARAMETROS_SEGUIMIENTO as P,
} from './camara';
import type { EntradaSeguimiento, EstadoSeguimiento } from './camara';
import { cajasDeLaCasa, lineaLibre, posicionDe } from './visual';

const DT = 1 / 60;
afterEach(encenderTodo);
function paso(s: EstadoSeguimiento, e: EntradaSeguimiento, p = P) {
  avanzarSeguimiento(s, e, p);
  e.azimut = s.azimut;
  e.distanciaActual = s.distancia;
}
function entrada(
  x: number,
  z: number,
  azimut: number,
  escenario = escenarioTrading,
): EntradaSeguimiento {
  return {
    dt: DT,
    x,
    z,
    y: 0,
    adelante: 0,
    lateral: 0,
    azimut,
    elevacion: (escenario.vistas.seguir.elevacion * Math.PI) / 180,
    orbitando: false,
    distanciaActual: escenario.vistas.seguir.distancia,
    cajas: cajasDeLaCasa(escenario.planta),
  };
}
function visible(s: EstadoSeguimiento, e: EntradaSeguimiento, margen: number) {
  for (const delta of [-margen, 0, margen]) {
    const v = { azimut: s.azimut + delta, elevacion: e.elevacion, distancia: s.distancia };
    const camara = posicionDe(s.mira, v);
    if (!lineaLibre(camara, s.mira, e.cajas)) return false;
    for (const altura of P.alturasVistaBrazo) {
      for (const lado of [-P.radioVistaBrazo, 0, P.radioVistaBrazo]) {
        const objetivo = {
          x: e.x + lado * Math.cos(v.azimut),
          y: e.y + altura,
          z: e.z - lado * Math.sin(v.azimut),
        };
        if (!lineaLibre(camara, objetivo, e.cajas)) return false;
      }
    }
  }
  return true;
}

describe('rodeo estable con las cajas reales de ControlesCamara', () => {
  for (const escenario of [escenarioTrading, escenarioOficina]) {
    for (const columna of escenario.planta.muebles.filter((m) => m.tipo === 'columna')) {
      for (const separacion of [0, 0.5, 1.5]) {
        for (let lado = 0; lado < 8; lado++) {
          const c = cajaDe(columna);
          const a = (lado * Math.PI) / 4;
          const radio =
            Math.max(c.x1 - c.x0, c.z1 - c.z0) /
              2 /
              Math.max(Math.abs(Math.sin(a)), Math.abs(Math.cos(a))) +
            RADIO_AVATAR +
            0.001 +
            separacion;
          const e = entrada(
            columna.x + radio * Math.sin(a),
            columna.z + radio * Math.cos(a),
            a + Math.PI,
            escenario,
          );
          const mapa = crearMapaDeSuelo(sueloDe(escenario));
          const recorrible = puntoLibre(mapa, e.x, e.z, RADIO_AVATAR, 0);
          // Algunas posiciones polares caen dentro de escritorios o jardineras: el avatar
          // real las resuelve contra el mismo mapa antes de entregárselas a la cámara.
          if (!recorrible) {
            const solicitada = { x: e.x, z: e.z };
            moverConColision(mapa, e.x, e.z, 0, 0, RADIO_AVATAR, e, 0);
            if (!puntoLibre(mapa, e.x, e.z, RADIO_AVATAR, 0)) {
              // Entre dos sólidos superpuestos no se puede iniciar un avatar. Busca
              // el suelo válido más cercano y camina hacia la posición solicitada.
              let cerca: { x: number; z: number; distancia: number } | undefined;
              for (let dx = -3; dx <= 3; dx += 0.05) {
                for (let dz = -3; dz <= 3; dz += 0.05) {
                  const x = solicitada.x + dx;
                  const z = solicitada.z + dz;
                  const distancia = Math.hypot(dx, dz);
                  if (
                    (!cerca || distancia < cerca.distancia) &&
                    puntoLibre(mapa, x, z, RADIO_AVATAR, 0)
                  ) {
                    cerca = { x, z, distancia };
                  }
                }
              }
              if (!cerca) throw new Error('Sin suelo transitable cerca de la columna');
              moverConColision(
                mapa,
                cerca.x,
                cerca.z,
                solicitada.x - cerca.x,
                solicitada.z - cerca.z,
                RADIO_AVATAR,
                e,
                0,
              );
            }
          }
          it(`${escenario.id}/${columna.id}, lado ${lado}, separación ${separacion}${recorrible ? '' : ' (resuelta con colisión real)'}`, () => {
            expect(puntoLibre(mapa, e.x, e.z, RADIO_AVATAR, 0)).toBe(true);
            const p = { ...P, distanciaSeguir: escenario.vistas.seguir.distancia };
            const s = crearSeguimiento();
            const ultimos: { a: number; d: number }[] = [];
            for (let i = 0; i < 300; i++) {
              const antes = e.distanciaActual;
              paso(s, e, p);
              expect(Math.abs(s.distancia - antes)).toBeLessThanOrEqual(
                P.velocidadDistanciaBrazo * DT + 1e-8,
              );
              if (i >= 240) ultimos.push({ a: s.azimut, d: s.distancia });
            }
            expect(visible(s, e, P.margenAngularBrazo)).toBe(true);
            expect(s.distancia).toBeCloseTo(p.distanciaSeguir, 1);
            expect(
              Math.max(...ultimos.map((v) => v.a)) - Math.min(...ultimos.map((v) => v.a)),
            ).toBeLessThan(0.002);
            expect(
              Math.max(...ultimos.map((v) => v.d)) - Math.min(...ultimos.map((v) => v.d)),
            ).toBeLessThan(0.01);
          });
        }
      }
    }
  }
  it('órbita manual y pausa mandan; al soltar no vuelve al azimut anterior', () => {
    const s = crearSeguimiento();
    const e = entrada(-10, -1.9, 0);
    for (let i = 0; i < 300; i++) paso(s, e);
    e.orbitando = true;
    e.azimut = -1.1;
    for (let i = 0; i < 90; i++) {
      paso(s, e);
      expect(s.azimut).toBe(-1.1);
    }
    e.orbitando = false;
    paso(s, e);
    expect(Math.abs(normalizarAngulo(s.azimut + 1.1))).toBeLessThan(P.velocidadAzimutBrazo * DT);
  });
  for (const escenario of [escenarioTrading, escenarioOficina]) {
    for (const columna of escenario.planta.muebles.filter((m) => m.tipo === 'columna')) {
      it(`${escenario.id}/${columna.id}: una vuelta caminando no mete la cámara en sólidos ni alterna de lado`, () => {
        const mapa = crearMapaDeSuelo(sueloDe(escenario));
        const s = crearSeguimiento();
        const e = entrada(columna.x, columna.z - 1.3, 0, escenario);
        moverConColision(mapa, e.x, e.z, 0, 0, RADIO_AVATAR, e, 0);
        const p = { ...P, distanciaSeguir: escenario.vistas.seguir.distancia };
        let cambios = 0;
        let signo = 0;
        for (let i = 0; i < 1200; i++) {
          const a = -Math.PI / 2 + (i / 1200) * Math.PI * 2;
          const x = columna.x + 1.3 * Math.cos(a);
          const z = columna.z + 1.3 * Math.sin(a);
          moverConColision(mapa, e.x, e.z, x - e.x, z - e.z, RADIO_AVATAR, e, 0);
          const anterior = e.distanciaActual;
          paso(s, e, p);
          expect(Math.abs(s.distancia - anterior)).toBeLessThanOrEqual(
            P.velocidadDistanciaBrazo * DT + 1e-8,
          );
          const c = posicionDe(s.mira, {
            azimut: s.azimut,
            elevacion: e.elevacion,
            distancia: s.distancia,
          });
          expect(
            e.cajas.some(
              (b) =>
                c.x >= b.x0 &&
                c.x <= b.x1 &&
                c.y >= b.y0 &&
                c.y <= b.y1 &&
                c.z >= b.z0 &&
                c.z <= b.z1,
            ),
          ).toBe(false);
          if (s.ladoBrazo !== 0) {
            if (signo && s.ladoBrazo !== signo) cambios++;
            signo = s.ladoBrazo;
          }
        }
        expect(cambios).toBeLessThanOrEqual(1);
      });
    }
  }
});

describe('invariantes del brazo', () => {
  it('conserva el lado hasta que la línea base permanece libre el tiempo de salida', () => {
    const e = entrada(-10, -1.95, 0);
    const s = crearSeguimiento();
    for (let i = 0; i < 300; i++) paso(s, e);
    expect(s.rodeando).toBe(true);
    const elegido = s.azimutObjetivo;
    e.cajas = [];
    for (let i = 0; i < Math.floor(P.esperaSalidaBrazo / DT) - 1; i++) {
      paso(s, e);
      expect(s.azimutObjetivo).toBe(elegido);
    }
    for (let i = 0; i < 300; i++) {
      const antes = s.azimut;
      const distancia = s.distancia;
      paso(s, e);
      expect(Math.abs(normalizarAngulo(s.azimut - antes))).toBeLessThanOrEqual(
        P.velocidadAzimutBrazo * DT + 1e-8,
      );
      expect(Math.abs(s.distancia - distancia)).toBeLessThanOrEqual(
        P.velocidadDistanciaBrazo * DT + 1e-8,
      );
    }
    expect(s.rodeando).toBe(false);
    expect(s.azimut).toBeCloseTo(s.azimutBase, 5);
  });

  it('si no hay un rodeo posible conserva el rescate radial', () => {
    const e = entrada(0, 0, 0);
    e.cajas = [
      { x0: -20, x1: 20, y0: -1, y1: 20, z0: 0.3, z1: 20 },
      { x0: -20, x1: 20, y0: -1, y1: 20, z0: -20, z1: -0.3 },
      { x0: 0.3, x1: 20, y0: -1, y1: 20, z0: -20, z1: 20 },
      { x0: -20, x1: -0.3, y0: -1, y1: 20, z0: -20, z1: 20 },
    ];
    const s = crearSeguimiento();
    for (let i = 0; i < 300; i++) paso(s, e);
    expect(s.rodeando).toBe(false);
    expect(s.azimut).toBe(0);
    expect(s.distancia).toBeLessThanOrEqual(P.distanciaMinBrazo + 1e-8);
  });

  it('si un rodeo ya elegido queda encerrado vuelve al rescate radial', () => {
    const e = entrada(0, 0, 0);
    e.cajas = [{ x0: -0.35, x1: 0.35, y0: -1, y1: 6, z0: 0.3, z1: 1 }];
    const s = crearSeguimiento();
    for (let i = 0; i < 300; i++) paso(s, e);
    expect(s.rodeando).toBe(true);
    e.cajas = [
      { x0: -20, x1: 20, y0: -1, y1: 20, z0: 0.3, z1: 20 },
      { x0: -20, x1: 20, y0: -1, y1: 20, z0: -20, z1: -0.3 },
      { x0: 0.3, x1: 20, y0: -1, y1: 20, z0: -20, z1: 20 },
      { x0: -20, x1: -0.3, y0: -1, y1: 20, z0: -20, z1: 20 },
    ];
    for (let i = 0; i < 300; i++) {
      const anterior = s.distancia;
      paso(s, e);
      expect(Math.abs(s.distancia - anterior)).toBeLessThanOrEqual(
        P.velocidadDistanciaBrazo * DT + 1e-8,
      );
    }
    expect(s.distancia).toBeLessThanOrEqual(P.distanciaMinBrazo + 1e-8);
  });

  it('elige el giro más corto y resuelve el empate de forma determinista', () => {
    const e = entrada(0, 0, 0);
    e.cajas = [{ x0: -0.35, x1: 1.5, y0: -1, y1: 6, z0: 0.3, z1: 1 }];
    const s = crearSeguimiento();
    for (let i = 0; i < 300; i++) paso(s, e);
    expect(s.azimut).toBeLessThan(0);
    expect(visible(s, e, P.margenAngularBrazo)).toBe(true);
    const simetrica = [{ x0: -0.35, x1: 0.35, y0: -1, y1: 6, z0: 0.3, z1: 1 }];
    const estados = [crearSeguimiento(), crearSeguimiento()];
    for (const estado of estados) {
      const entradaSimetrica = { ...entrada(0, 0, 0), cajas: simetrica };
      for (let i = 0; i < 300; i++) paso(estado, entradaSimetrica);
    }
    expect(estados[0]?.azimut).toBe(estados[1]?.azimut);
    expect(estados[0]?.azimut).toBeGreaterThan(0);
  });

  it('cajas lejanas no cambian la trayectoria libre, tampoco al alejarse tras un zoom', () => {
    const libre = entrada(0, 0, 0);
    libre.cajas = [];
    libre.distanciaActual = 0.8;
    const lejanas = { ...libre, cajas: [{ x0: 100, x1: 101, y0: 0, y1: 10, z0: 100, z1: 101 }] };
    const a = crearSeguimiento();
    const b = crearSeguimiento();
    for (let i = 0; i < 300; i++) {
      libre.x = lejanas.x = i * DT * 4.8;
      paso(a, libre);
      paso(b, lejanas);
      expect(b.distancia).toBe(a.distancia);
      expect(b.mira).toEqual(a.mira);
      expect(b.azimut).toBe(a.azimut);
    }
  });
});

it('sin obstáculos conserva la trayectoria afinada: entrada, caminar, correr, parar y zoom', () => {
  const e = entrada(0, 0, 0);
  e.cajas = [];
  e.distanciaActual = 30;
  const s = crearSeguimiento();
  const muestras: number[][] = [];
  for (let i = 0; i < 300; i++) {
    if (i >= 60 && i < 120) e.x += 2.3 * DT;
    if (i >= 120 && i < 180) e.x += 4.8 * DT;
    if (i === 210) e.distanciaActual = 5;
    avanzarSeguimiento(s, e);
    e.distanciaActual = s.distancia;
    if ([0, 30, 60, 120, 180, 210, 299].includes(i)) {
      muestras.push([s.mira.x, s.mira.y, s.mira.z, s.distancia].map((v) => Number(v.toFixed(8))));
    }
  }
  expect(muestras).toMatchInlineSnapshot(`
    [
      [
        0,
        1.5,
        0,
        29.49752924,
      ],
      [
        0,
        1.5,
        0,
        18.74891363,
      ],
      [
        0.00610121,
        1.5,
        0,
        13.37453132,
      ],
      [
        2.17775199,
        1.5,
        0,
        9.34768331,
      ],
      [
        7.1,
        1.5,
        0,
        10.49832715,
      ],
      [
        7.1,
        1.5,
        0,
        9.08777068,
      ],
      [
        7.1,
        1.5,
        0,
        3.89631181,
      ],
    ]
  `);
});
