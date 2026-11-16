import { afterEach, describe, expect, it } from 'vitest';
import { crearMapaDeSuelo, puntoLibre } from '../animacion/colision';
import { RADIO_AVATAR } from '../animacion/avatar';
import { sueloDe } from '../escenarios/suelo';
import { NIVEL_Y } from '../mansion/plano';
import { encenderTodo } from '../animacion/opciones';
import { escenarioTrading } from '../escenarios/trading';
import { escenarioOficina } from '../escenarios/oficina';
import { escenarioMansion } from '../escenarios/mansion';
import { avanzarSeguimiento, crearSeguimiento, PARAMETROS_SEGUIMIENTO as P } from './camara';
import type { EntradaSeguimiento, EstadoSeguimiento } from './camara';
import { cajasDeLaCasa, posicionDe, lineaLibre } from './visual';

const DT = 1 / 60;
afterEach(encenderTodo);
const entrada = (escenario = escenarioTrading): EntradaSeguimiento => ({
  dt: DT,
  x: 0,
  y: 0,
  z: 0,
  adelante: 0,
  lateral: 0,
  azimut: 0,
  elevacion: (escenario.vistas.seguir.elevacion * Math.PI) / 180,
  distanciaActual: escenario.vistas.seguir.distancia,
  cajas: cajasDeLaCasa(escenario.planta),
  orbitando: false,
});
function paso(s: EstadoSeguimiento, e: EntradaSeguimiento, p = P) {
  avanzarSeguimiento(s, e, p);
  e.distanciaActual = s.distancia;
  e.azimut = s.azimut;
}

describe('encuadre cómodo', () => {
  it('al frenar desde carrera la mira no rebasa los pies ni vuelve hacia atrás', () => {
    const e = entrada();
    e.cajas = [];
    const s = crearSeguimiento();
    for (let i = 0; i < 240; i++) {
      e.x += 4.8 * DT;
      paso(s, e);
    }
    const parada = e.x;
    let anterior = s.mira.x;
    for (let i = 0; i < 180; i++) {
      paso(s, e);
      expect(s.mira.x).toBeLessThanOrEqual(parada + 1e-6);
      expect(s.mira.x).toBeGreaterThanOrEqual(anterior - 1e-6);
      anterior = s.mira.x;
    }
  });
  it('reducir movimiento elimina anticipación y apertura por carrera', () => {
    const e = { ...entrada(), cajas: [], reducirMovimiento: true };
    const s = crearSeguimiento();
    for (let i = 0; i < 240; i++) {
      e.x += 4.8 * DT;
      paso(s, e);
    }
    expect(s.extra).toBe(0);
    expect(s.mira.x).toBeLessThanOrEqual(s.cx);
  });
});

describe('volumen de cámara junto a muros reales', () => {
  for (const escenario of [escenarioTrading, escenarioOficina, escenarioMansion]) {
    const cajas = cajasDeLaCasa(escenario.planta);
    const mapa = crearMapaDeSuelo(sueloDe(escenario));
    const muros = escenario.planta.muros.filter((m) => m.tipo === 'muro' && m.hasta - m.desde > 3);
    for (const muro of muros) {
      const ejeX = muro.eje === 'x';
      const y = NIVEL_Y[muro.nivel];
      // El mobiliario puede impedir caminar por una cara del muro. Elegimos el tramo
      // continuo más largo que permite el mapa real, a 0,4 m de cualquiera de sus caras.
      let tramo = { desde: 0, hasta: 0, cara: 1 };
      for (const cara of [-1, 1]) {
        let inicio: number | null = null;
        for (let u = muro.desde + 0.4; u <= muro.hasta - 0.4; u += 0.05) {
          const x = ejeX ? muro.pos + cara * 0.4 : u;
          const z = ejeX ? u : muro.pos + cara * 0.4;
          if (puntoLibre(mapa, x, z, RADIO_AVATAR, y)) {
            inicio ??= u;
            if (u - inicio > tramo.hasta - tramo.desde) tramo = { desde: inicio, hasta: u, cara };
          } else inicio = null;
        }
      }
      for (const sentido of [-1, 1]) {
        it(`${escenario.id}/${muro.id}, sentido ${sentido}: 6 s a 60 Hz sin penetrar sólidos`, () => {
          expect(tramo.hasta - tramo.desde).toBeGreaterThan(0.1);
          const e = entrada(escenario);
          const s = crearSeguimiento();
          const largo = tramo.hasta - tramo.desde;
          e.azimut = ejeX ? 0 : Math.PI / 2;
          for (let i = 0; i < 360; i++) {
            const fase = (i * DT * P.rapidezCaminar) % (2 * largo);
            const recorrido = fase <= largo ? fase : 2 * largo - fase;
            const u = sentido > 0 ? tramo.desde + recorrido : tramo.hasta - recorrido;
            e.x = ejeX ? muro.pos + tramo.cara * 0.4 : u;
            e.z = ejeX ? u : muro.pos + tramo.cara * 0.4;
            e.y = y;
            const previo = s.distancia;
            paso(s, e, { ...P, distanciaSeguir: escenario.vistas.seguir.distancia });
            const c = posicionDe(s.mira, {
              azimut: s.azimut,
              elevacion: e.elevacion,
              distancia: s.distancia,
            });
            for (const caja of cajas) {
              const dentro =
                c.x > caja.x0 &&
                c.x < caja.x1 &&
                c.y > caja.y0 &&
                c.y < caja.y1 &&
                c.z > caja.z0 &&
                c.z < caja.z1;
              expect(dentro).toBe(false);
            }
            if (i > 0)
              expect(Math.abs(s.distancia - previo)).toBeLessThanOrEqual(
                P.velocidadDistanciaBrazo * DT + 1e-6,
              );
            expect(s.distancia).toBeGreaterThanOrEqual(P.distanciaMinBrazo);
          }
        });
      }
    }
  }
});

it('el volumen no roza el canto de un muro aunque el rayo central quede libre', async () => {
  const { distanciaLibreVolumen } = await import('./camaraColision');
  const caja = cajasDeLaCasa(escenarioTrading.planta).find((c) => c.y1 - c.y0 > 3)!;
  const radio = 0.18;
  const mira = { x: caja.x0 - radio / 2, y: caja.y0 + 1.5, z: caja.z0 - 3 };
  const camara = { ...mira, z: caja.z0 + 1 };
  expect(lineaLibre(camara, mira, [caja])).toBe(true);
  expect(distanciaLibreVolumen(mira, camara, [caja], radio)).toBeLessThan(3);
});

it('diez cruces del canto de un tabique real no bombean el radio y respetan la órbita manual', () => {
  const e = entrada();
  const muro = escenarioTrading.planta.muros.find((m) => m.id === 'tabique-aula')!;
  e.x = muro.pos + 0.4;
  e.z = muro.hasta;
  e.azimut = -Math.PI / 2;
  e.orbitando = true;
  const s = crearSeguimiento();
  for (let i = 0; i < 120; i++) paso(s, e);
  let sentido = 0;
  let inversiones = 0;
  for (let i = 0; i < 200; i++) {
    e.z = muro.hasta + (Math.floor(i / 10) % 2 ? 0.02 : -0.02);
    const anterior = s.distancia;
    paso(s, e);
    const delta = s.distancia - anterior;
    if (Math.abs(delta) > 0.001) {
      const nuevo = Math.sign(delta);
      if (sentido && nuevo !== sentido) inversiones++;
      sentido = nuevo;
    }
    expect(s.azimut).toBe(-Math.PI / 2);
  }
  expect(inversiones).toBeLessThanOrEqual(2);
});

it('el zoom elegido se suaviza y se recuerda al despejar un muro real', () => {
  const e = entrada();
  e.cajas = [];
  e.orbitando = true;
  const s = crearSeguimiento();
  for (let i = 0; i < 300; i++) paso(s, e);
  const anterior = s.distancia;
  e.distanciaActual = 5;
  paso(s, e);
  expect(Math.abs(s.distancia - anterior)).toBeLessThanOrEqual(P.velocidadZoom * DT + 1e-6);
  for (let i = 0; i < 180; i++) paso(s, e);
  expect(s.distancia).toBeCloseTo(5, 1);
  const muro = escenarioTrading.planta.muros.find((m) => m.id === 'tabique-aula')!;
  e.x = muro.pos + 0.4;
  e.z = (muro.desde + muro.hasta) / 2;
  e.azimut = -Math.PI / 2;
  e.cajas = cajasDeLaCasa(escenarioTrading.planta);
  for (let i = 0; i < 180; i++) paso(s, e);
  expect(s.distancia).toBeLessThan(5);
  e.cajas = [];
  for (let i = 0; i < 600; i++) paso(s, e);
  expect(s.distancia).toBeCloseTo(5, 1);
});

it('al terminar de entrar desde la general conserva la distancia de seguimiento', () => {
  const e = entrada();
  e.cajas = [];
  e.distanciaActual = 30;
  const s = crearSeguimiento();
  for (let i = 0; i < 900; i++) paso(s, e);
  expect(s.distancia).toBeCloseTo(P.distanciaSeguir, 1);
});

it('el usuario no puede elegir un zoom por debajo del mínimo cómodo', () => {
  const e = entrada();
  e.cajas = [];
  const s = crearSeguimiento();
  for (let i = 0; i < 300; i++) paso(s, e);
  e.distanciaActual = 0.1;
  paso(s, e);
  for (let i = 0; i < 300; i++) paso(s, e);
  expect(s.distancia).toBeGreaterThanOrEqual(P.distanciaMinBrazo);
});

it('oculta el cuerpo propio a distancia crítica, con histéresis, y restaura las piezas originales', async () => {
  const { crearOcultacionCercana } = await import('./oclusion');
  const cuerpo = { ancla: { visible: true } };
  const accesorio = { ancla: { visible: false } };
  const ocultacion = crearOcultacionCercana();
  const partes = [cuerpo, accesorio];
  ocultacion.actualizar(partes, 1, 1.6, 2.2);
  expect(cuerpo.ancla.visible).toBe(false);
  ocultacion.actualizar(partes, 1.9, 1.6, 2.2);
  expect(cuerpo.ancla.visible).toBe(false);
  ocultacion.actualizar(partes, 3, 1.6, 2.2);
  expect(cuerpo.ancla.visible).toBe(true);
  expect(accesorio.ancla.visible).toBe(false);
  ocultacion.actualizar([cuerpo], 1, 1.6, 2.2);
  ocultacion.restaurar();
  expect(cuerpo.ancla.visible).toBe(true);
});

it('un pellizco fino no se pierde por la tolerancia del acercamiento inicial', () => {
  const e = entrada();
  e.orbitando = true;
  e.cajas = [];
  const s = crearSeguimiento();
  for (let i = 0; i < 900; i++) paso(s, e);
  const elegido = s.distancia - 0.02;
  e.distanciaActual = elegido;
  paso(s, e);
  expect(s.zoomElegido).toBeCloseTo(elegido, 6);
});

it('retiene el brazo corto después de liberar un muro que llevaba tiempo tapando', () => {
  const e = entrada();
  const muro = escenarioTrading.planta.muros.find((m) => m.id === 'tabique-aula')!;
  e.x = muro.pos + 0.4;
  e.z = (muro.desde + muro.hasta) / 2;
  e.azimut = -Math.PI / 2;
  e.orbitando = true;
  const s = crearSeguimiento();
  for (let i = 0; i < 300; i++) paso(s, e);
  const corto = s.distancia;
  e.cajas = [];
  for (let i = 0; i < Math.floor(P.retencionBrazo / DT) - 1; i++) {
    paso(s, e);
    expect(s.distancia).toBeCloseTo(corto, 6);
  }
});

it('no escribe una distancia mayor que el máximo real de OrbitControls ni pierde un zoom pequeño en ese límite', () => {
  const e = { ...entrada(), cajas: [], orbitando: true, distanciaMax: 5 };
  const s = crearSeguimiento();
  for (let i = 0; i < 300; i++) {
    paso(s, e);
    expect(s.distancia).toBeLessThanOrEqual(5);
  }
  e.distanciaActual = 4.98;
  paso(s, e);
  expect(s.zoomElegido).toBeCloseTo(4.98, 6);
});
