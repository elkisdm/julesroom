import { afterEach, describe, expect, it } from 'vitest';
import { CONTRAHUELLA_MAX, crearSuelo, sueloDe } from '../escenarios/suelo';
import { escenarioMansion } from '../escenarios/mansion';
import { NIVEL_Y, plano } from '../mansion/plano';
import {
  avanzarAvatar,
  crearAvatar,
  crearMando,
  fijarDestino,
  PARAMETROS_AVATAR,
  RADIO_AVATAR,
  saltar,
} from './avatar';
import type { Avatar, Mando } from './avatar';
import {
  avanzarFaseCaminata,
  calcularCaminata,
  crearSalidaCaminata,
  largoZancada,
  PARAMETROS_CAMINATA,
} from './caminata';
import { crearMapaDeCajas, crearMapaDeSuelo, moverConColision, puntoLibre } from './colision';
import { conducir, crearLocomocion } from './locomocion';
import { crearNavegacion } from './navegacion';
import { encenderTodo, fijarOpciones } from './opciones';

const PARAMETROS_PRUEBA = {
  dt: 1 / 60,
  umbral: 0.5,
  tiempoArranque: 0.05,
  tiempoFreno: 0.18,
  distanciaFreno: 0.4,
  tolerancia: 1e-8,
};
const P = PARAMETROS_AVATAR;
const DT = PARAMETROS_PRUEBA.dt;
const limites = { x0: -20, x1: 20, z0: -20, z1: 20 };
const mapa = crearMapaDeCajas([], limites);
const nav = crearNavegacion(mapa, 0.25, RADIO_AVATAR);
const suelo = crearSuelo({
  limites,
  superficies: [{ id: 'piso', tipo: 'losa', forma: 'caja', ...limites, y: 0, grosor: 0.2 }],
  solidos: [],
});
const mapaSuelo = crearMapaDeSuelo(suelo);
const navSuelo = crearNavegacion(mapaSuelo, 0.25, RADIO_AVATAR);
const paso = (a: Avatar, m: Mando, n = 1) => {
  for (let i = 0; i < n; i++) avanzarAvatar(a, m, 0, mapaSuelo, navSuelo, P, DT);
};
afterEach(encenderTodo);

describe('respuesta del avatar', () => {
  it('arranca en el primer cuadro y supera el umbral perceptible a tiempo', () => {
    const l = crearLocomocion(0, 0, 0);
    conducir(l, 0, 1, 1, P, DT);
    expect(l.z).toBeGreaterThan(0);
    for (let t = DT; t < PARAMETROS_PRUEBA.tiempoArranque; t += DT) conducir(l, 0, 1, 1, P, DT);
    expect(l.velocidad).toBeGreaterThan(PARAMETROS_PRUEBA.umbral);
  });

  it.each([30, 60, 144])('frena desde carrera cerca y rápido a %s Hz', (hz) => {
    const l = crearLocomocion(0, 0, 0);
    l.velocidad = P.velCorrer;
    l.correr = true;
    let t = 0;
    while (l.velocidad > 0 && t < 1) {
      conducir(l, 0, 1, 0, P, 1 / hz);
      t += 1 / hz;
    }
    expect(t).toBeLessThanOrEqual(PARAMETROS_PRUEBA.tiempoFreno);
    expect(l.z).toBeLessThanOrEqual(PARAMETROS_PRUEBA.distanciaFreno);
  });

  it('conserva las velocidades de caminar y correr y desacelera al soltar Shift', () => {
    expect(P.velMax).toBe(2.3);
    expect(P.velCorrer).toBe(4.8);
    const l = crearLocomocion(0, 0, 0);
    l.correr = true;
    for (let i = 0; i < 60; i++) conducir(l, 0, 1, 1, P, DT);
    expect(l.velocidad).toBe(4.8);
    l.correr = false;
    const previo = l.velocidad;
    conducir(l, 0, 1, 1, P, DT);
    expect(l.velocidad).toBeLessThan(previo);
    for (let i = 0; i < 60; i++) conducir(l, 0, 1, 1, P, DT);
    expect(l.velocidad).toBe(2.3);
  });

  it('la fase sigue la distancia integrada también al acelerar y frenar', () => {
    const l = crearLocomocion(0, 0, 0);
    l.correr = true;
    for (let i = 0; i < 60; i++) {
      const fase = l.fase,
        z = l.z,
        v = l.velocidad;
      conducir(l, 0, 1, i < 30 ? 1 : 0, P, DT);
      const media = (v + l.velocidad) / 2;
      const avance = (l.fase - fase + 1) % 1;
      expect(Math.abs(avance * largoZancada(media) - (l.z - z))).toBeLessThan(
        PARAMETROS_PRUEBA.tolerancia,
      );
    }
  });

  it('barrido de velocidades: el avance por ciclo coincide con la zancada', () => {
    for (let v = 0; v <= P.velCorrer; v += 0.1) {
      const fase = avanzarFaseCaminata(0, v, DT);
      expect(Math.abs(fase * largoZancada(v) - v * DT)).toBeLessThan(PARAMETROS_PRUEBA.tolerancia);
    }
  });

  it('ambos pies apoyados se mantienen sobre el suelo en el barrido completo', () => {
    const p = PARAMETROS_CAMINATA;
    const pose = crearSalidaCaminata();
    const dt = 1 / 240;
    for (let v = 0.1; v <= P.velCorrer; v += 0.1) {
      for (const pie of [0, 1] as const) {
        let fase = 0,
          mundoAnterior: number | null = null;
        for (let k = 0; k < 240; k++) {
          calcularCaminata(fase, v, pose);
          const cadera = -pose.cadera[pie];
          const pantorrilla = cadera - pose.rodilla[pie];
          const x =
            (pie === 0 ? 1 : -1) * p.separacionCadera * Math.sin(pose.pelvisGiro) +
            p.muslo * Math.sin(cadera) +
            p.pantorrilla * Math.sin(pantorrilla) +
            v * k * dt;
          const y =
            p.muslo +
            p.pantorrilla +
            pose.pelvisY +
            (pie === 0 ? -1 : 1) * p.separacionCadera * Math.sin(pose.pelvisLadeo) -
            p.muslo * Math.cos(cadera) -
            p.pantorrilla * Math.cos(pantorrilla);
          if (pose.apoyado[pie]) {
            expect(Math.abs(y)).toBeLessThan(0.006);
            if (mundoAnterior !== null) expect(Math.abs(x - mundoAnterior)).toBeLessThan(0.004);
            mundoAnterior = x;
          } else mundoAnterior = null;
          fase = avanzarFaseCaminata(fase, v, dt);
        }
      }
    }
  });
});

describe('tolerancias del salto', () => {
  it.each([true, false])(
    'recupera un salto al salir caminando de una plataforma (poses %s)',
    (poses) => {
      fijarOpciones({ caminataPoses: poses });
      const plataforma = crearSuelo({
        limites,
        superficies: [
          ...suelo.superficies,
          {
            id: 'borde',
            tipo: 'tarima',
            forma: 'caja',
            x0: -10,
            x1: 0,
            z0: -5,
            z1: 5,
            y: 2,
            grosor: 0.2,
          },
        ],
        solidos: [],
      });
      const mapaBorde = crearMapaDeSuelo(plataforma);
      const navBorde = crearNavegacion(mapaBorde, 0.25, RADIO_AVATAR);
      const a = crearAvatar(-0.5, 0, Math.PI / 2, 2),
        m = crearMando();
      m.lateral = 1;
      const avanzar = () => avanzarAvatar(a, m, 0, mapaBorde, navBorde, P, DT);
      for (let i = 0; i < 60 && a.enSuelo; i++) avanzar();
      expect(a.enSuelo).toBe(false);
      for (let i = 0; i < 2; i++) avanzar();
      saltar(m);
      avanzar();
      expect(a.loc.salto.saltos).toBe(1);
      expect(a.vy).toBeGreaterThan(0);
    },
  );
  it.each([0.03, 0.08])('salta %s s después de abandonar un borde', (tiempo) => {
    const a = crearAvatar(0, 0, 0, 2);
    const m = crearMando();
    paso(a, m, Math.ceil(tiempo / DT));
    expect(a.enSuelo).toBe(false);
    saltar(m);
    paso(a, m, 5);
    expect(a.loc.salto.saltos).toBe(1);
    expect(a.vy).toBeGreaterThan(0);
  });

  it('saltar en el último cuadro del borde no pierde el impulso durante la anticipación', () => {
    const plataforma = crearSuelo({
      limites,
      superficies: [
        ...suelo.superficies,
        {
          id: 'borde',
          tipo: 'tarima',
          forma: 'caja',
          x0: -10,
          x1: 0,
          z0: -5,
          z1: 5,
          y: 2,
          grosor: 0.2,
        },
      ],
      solidos: [],
    });
    const mapaBorde = crearMapaDeSuelo(plataforma);
    const navBorde = crearNavegacion(mapaBorde, 0.25, RADIO_AVATAR);
    const a = crearAvatar(-0.01, 0, Math.PI / 2, 2),
      m = crearMando();
    a.loc.velocidad = P.velMax;
    m.lateral = 1;
    saltar(m);
    avanzarAvatar(a, m, 0, mapaBorde, navBorde, P, DT);
    expect(a.x).toBeGreaterThan(0);
    expect(a.loc.salto.saltos).toBe(1);
    expect(a.vy).toBeGreaterThan(0);
  });

  it('fuera del margen del borde no salta', () => {
    const a = crearAvatar(0, 0, 0, 2),
      m = crearMando();
    paso(a, m, 10);
    saltar(m);
    paso(a, m, 5);
    expect(a.loc.salto.saltos).toBe(0);
    expect(a.vy).toBeLessThan(0);
  });

  it('recuerda la pulsación antes de aterrizar y no pierde la carrera', () => {
    const a = crearAvatar(0, 0, Math.PI),
      m = crearMando();
    m.adelante = 1;
    m.correr = true;
    saltar(m);
    for (let i = 0; i < 90 && !(a.vy < 0 && a.y < 0.3); i++) paso(a, m);
    expect(a.enSuelo).toBe(false);
    saltar(m);
    for (let i = 0; i < 20 && a.loc.salto.saltos < 2; i++) paso(a, m);
    expect(a.loc.salto.saltos).toBe(2);
    expect(a.vy).toBeGreaterThan(0);
    expect(a.velocidad).toBe(P.velCorrer);
  });

  it('una pulsación caducada no produce rebote ni doble salto', () => {
    const a = crearAvatar(0, 0, 0),
      m = crearMando();
    saltar(m);
    paso(a, m, 10);
    saltar(m);
    paso(a, m, 80);
    expect(a.loc.salto.saltos).toBe(1);
    expect(a.enSuelo).toBe(true);
  });
});

describe('ruta y colisión', () => {
  it.each([true, false])(
    'recorre la escalera de la mansión sin tirones ni atravesar sólidos (subir %s)',
    (subir) => {
      const mapaMansion = crearMapaDeSuelo(sueloDe(escenarioMansion));
      const navMansion = crearNavegacion(mapaMansion, 0.25, RADIO_AVATAR);
      const t = plano.escaleras[0]!.tramos[0]!;
      const a = crearAvatar(
        t.desde.x,
        subir ? t.desde.z + 0.8 : t.hasta.z - 0.5,
        subir ? Math.PI : 0,
        subir ? 0 : NIVEL_Y.piso2,
      );
      const m = crearMando();
      m.adelante = subir ? 1 : -1;
      m.correr = true;
      for (let i = 0; i < 240; i++) {
        const previo = a.yCuerpo;
        avanzarAvatar(a, m, 0, mapaMansion, navMansion, P, DT);
        expect(Math.abs(a.yCuerpo - previo)).toBeLessThanOrEqual(0.6 * CONTRAHUELLA_MAX);
        expect(puntoLibre(mapaMansion, a.x, a.z, RADIO_AVATAR, a.y)).toBe(true);
        if (subir ? a.z < t.hasta.z - 0.2 : a.z > t.desde.z + 0.2) break;
      }
      expect(a.y).toBeCloseTo(subir ? NIVEL_Y.piso2 : 0, 6);
      expect(a.enSuelo).toBe(true);
    },
  );

  it('un nodo alcanzado conduce hacia el siguiente en ese mismo cuadro', () => {
    const a = crearAvatar(0, 0, Math.PI / 2),
      m = crearMando();
    a.ruta.set([-0.1, 0, 3, 0]);
    a.nRuta = 2;
    avanzarAvatar(a, m, 0, mapa, nav, P, DT);
    expect(a.iRuta).toBe(1);
    expect(a.x).toBeGreaterThan(0);
    expect(a.loc.giro).toBe(0);
  });

  it('rodea un obstáculo, llega quieto y el teclado cancela la ruta', () => {
    const obstaculo = crearMapaDeCajas([{ x0: -1, x1: 1, z0: -2, z1: 2 }], limites);
    const n = crearNavegacion(obstaculo, 0.25, RADIO_AVATAR);
    const a = crearAvatar(-5, 0, Math.PI / 2),
      m = crearMando();
    fijarDestino(m, 5, 0);
    for (let i = 0; i < 600; i++) {
      avanzarAvatar(a, m, 0, obstaculo, n, P, DT);
      expect(puntoLibre(obstaculo, a.x, a.z, RADIO_AVATAR)).toBe(true);
    }
    expect(Math.hypot(a.x - 5, a.z)).toBeLessThan(P.radioLlegada);
    expect(a.velocidad).toBe(0);
    fijarDestino(m, -5, 0);
    m.lateral = 1;
    avanzarAvatar(a, m, 0, obstaculo, n, P, DT);
    expect(a.nRuta).toBe(0);
  });

  it('desliza paralelo a la pared sin entrar y sale de una esquina convexa', () => {
    const pared = crearMapaDeCajas([{ x0: 0, x1: 2, z0: -2, z1: 2 }], limites);
    const salida = { x: -RADIO_AVATAR, z: -1 };
    for (let i = 0; i < 100; i++) {
      moverConColision(pared, salida.x, salida.z, 0.04, 0.04, RADIO_AVATAR, salida);
      expect(puntoLibre(pared, salida.x, salida.z, RADIO_AVATAR)).toBe(true);
    }
    expect(salida.z).toBeGreaterThan(2.9);
    expect(salida.x).toBeGreaterThan(0);
  });
});
