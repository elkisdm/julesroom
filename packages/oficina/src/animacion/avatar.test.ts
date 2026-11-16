import { afterEach, describe, expect, it } from 'vitest';
import {
  avanzarAvatar,
  cancelar,
  crearAvatar,
  crearMando,
  fijarDestino,
  PARAMETROS_AVATAR,
  RADIO_AVATAR,
  saltar,
} from './avatar';
import type { Avatar, Mando } from './avatar';
import { crearMapaDeCajas, puntoLibre } from './colision';
import { crearNavegacion } from './navegacion';
import { encenderTodo, fijarOpciones } from './opciones';
import { crearOtros, PARAMETROS_SEPARACION } from './separacion';

const DT = 1 / 60;
/** Sala de 12 × 12 con un mueble en el centro (x 5..7, z 2..10) que obliga a rodear. */
const mapa = crearMapaDeCajas([{ x0: 5, x1: 7, z0: 2, z1: 10 }], { x0: 0, x1: 12, z0: 0, z1: 12 });
const nav = crearNavegacion(mapa, 0.25, RADIO_AVATAR);
/** Cámara de frente: azimut 0, «adelante» es −z. */
const AZ = 0;

const paso = (a: Avatar, m: Mando, n = 1, az = AZ) => {
  for (let i = 0; i < n; i++) avanzarAvatar(a, m, az, mapa, nav, PARAMETROS_AVATAR, DT);
};

afterEach(() => encenderTodo());

describe('avanzarAvatar con teclas', () => {
  it('responde en el mismo cuadro: velocidad > 0 tras un solo paso', () => {
    const a = crearAvatar(2, 6, 0);
    const m = crearMando();
    m.adelante = 1;
    paso(a, m);
    expect(a.velocidad).toBeGreaterThan(0);
    expect(a.velocidad).toBeCloseTo(PARAMETROS_AVATAR.aceleracion * DT, 6);
    expect(a.loc.x !== 2 || a.loc.z !== 6).toBe(true);
  });

  it('adelante va hacia donde mira la cámara (−z con azimut 0) y lateral a su derecha (+x)', () => {
    const a = crearAvatar(2, 6, Math.PI);
    const m = crearMando();
    m.adelante = 1;
    paso(a, m, 60);
    expect(a.z).toBeLessThan(6 - 0.3);
    expect(Math.abs(a.x - 2)).toBeLessThan(0.05);
    const b = crearAvatar(2, 6, 0);
    const n = crearMando();
    n.lateral = 1;
    paso(b, n, 60);
    expect(b.x).toBeGreaterThan(2 + 0.3);
  });

  it('con la cámara girada media vuelta, adelante es +z', () => {
    const a = crearAvatar(2, 6, 0);
    const m = crearMando();
    m.adelante = 1;
    paso(a, m, 60, Math.PI);
    expect(a.z).toBeGreaterThan(6 + 0.3);
  });

  it('frena al soltar las teclas', () => {
    const a = crearAvatar(2, 6, 0);
    const m = crearMando();
    m.adelante = 1;
    paso(a, m, 60);
    m.adelante = 0;
    paso(a, m, 90);
    expect(a.velocidad).toBe(0);
  });

  it('no atraviesa el mueble ni los muros aunque se empuje contra ellos', () => {
    const a = crearAvatar(2, 6, 0);
    const m = crearMando();
    m.lateral = 1;
    for (let i = 0; i < 600; i++) {
      paso(a, m);
      expect(puntoLibre(mapa, a.x, a.z, RADIO_AVATAR - 0.001)).toBe(true);
    }
    expect(a.x).toBeLessThan(5 - RADIO_AVATAR + 0.01);
    m.lateral = 0;
    m.adelante = 1;
    for (let i = 0; i < 900; i++) {
      paso(a, m);
      expect(puntoLibre(mapa, a.x, a.z, RADIO_AVATAR - 0.001)).toBe(true);
    }
    expect(a.z).toBeGreaterThanOrEqual(RADIO_AVATAR - 0.01);
  });

  it('al chocar de frente pierde la velocidad (no camina en el sitio)', () => {
    const a = crearAvatar(4.6, 6, 0);
    const m = crearMando();
    m.lateral = 1;
    paso(a, m, 120);
    expect(a.velocidad).toBeLessThan(0.1);
  });
});

describe('marcha contra un obstáculo', () => {
  it('empujando de frente contra el mueble los pies no avanzan (la fase se congela)', () => {
    const a = crearAvatar(4.6, 6, 0);
    const m = crearMando();
    m.lateral = 1;
    paso(a, m, 30); // llega al mueble
    const fase0 = a.fase;
    paso(a, m, 120);
    let d = Math.abs(a.fase - fase0);
    d = Math.min(d, 1 - d);
    expect(d).toBeLessThan(0.02);
  });

  it('rozando un muro en diagonal la fase avanza solo lo que avanza el cuerpo', () => {
    const a = crearAvatar(6, 6, 0);
    const m = crearMando();
    m.lateral = 1;
    m.adelante = 1;
    paso(a, m, 90);
    // Se desliza a lo largo de la pared: el avance real es < el pedido, así que su fase también.
    expect(a.velocidad).toBeLessThanOrEqual(PARAMETROS_AVATAR.velMax);
  });
});

describe('separación de otras personas', () => {
  const otrosEn = (x: number, z: number) => {
    const o = crearOtros(4);
    o.x[0] = x;
    o.z[0] = z;
    o.n = 1;
    return o;
  };
  const minimo = PARAMETROS_SEPARACION.radioAvatar + PARAMETROS_SEPARACION.radioOtro;

  it('al detenerse encima de alguien lo empuja hasta quedar a su lado', () => {
    const a = crearAvatar(2, 2, 0);
    const m = crearMando();
    const o = otrosEn(2.05, 2);
    for (let i = 0; i < 240; i++) avanzarAvatar(a, m, AZ, mapa, nav, PARAMETROS_AVATAR, DT, o);
    expect(Math.hypot(a.x - 2.05, a.z - 2)).toBeGreaterThanOrEqual(minimo - 0.03);
  });

  it('yendo de frente contra alguien no termina dentro: lo bordea', () => {
    const a = crearAvatar(2, 4, 0);
    const m = crearMando();
    m.adelante = 1; // hacia −z
    const o = otrosEn(2, 2.5);
    let minDist = Infinity;
    for (let i = 0; i < 240; i++) {
      avanzarAvatar(a, m, AZ, mapa, nav, PARAMETROS_AVATAR, DT, o);
      minDist = Math.min(minDist, Math.hypot(a.x - 2, a.z - 2.5));
    }
    expect(minDist).toBeGreaterThanOrEqual(minimo - 0.05);
    expect(a.z).toBeLessThan(2.5); // pasó de largo, no se quedó atascado
  });

  it('el empujón no atraviesa un muro', () => {
    const a = crearAvatar(0.4, 6, 0);
    const m = crearMando();
    const o = otrosEn(0.6, 6); // empuja hacia x<0, donde está el borde del mapa
    for (let i = 0; i < 240; i++) avanzarAvatar(a, m, AZ, mapa, nav, PARAMETROS_AVATAR, DT, o);
    expect(a.x).toBeGreaterThanOrEqual(RADIO_AVATAR - 0.01);
  });

  it('con la opción apagada atraviesa como antes', () => {
    fijarOpciones({ separacion: false });
    const a = crearAvatar(2, 2, 0);
    const o = otrosEn(2.05, 2);
    for (let i = 0; i < 120; i++)
      avanzarAvatar(a, crearMando(), AZ, mapa, nav, PARAMETROS_AVATAR, DT, o);
    expect(Math.hypot(a.x - 2.05, a.z - 2)).toBeLessThan(0.1);
  });

  it('sin `otros` se comporta como antes', () => {
    const a = crearAvatar(2, 2, 0);
    for (let i = 0; i < 60; i++)
      avanzarAvatar(a, crearMando(), AZ, mapa, nav, PARAMETROS_AVATAR, DT);
    expect(a.x).toBeCloseTo(2, 9);
  });
});

describe('avanzarAvatar con clic', () => {
  it('rodea el mueble y llega al destino sin pisarlo', () => {
    const a = crearAvatar(2, 6, 0);
    const m = crearMando();
    fijarDestino(m, 10, 6);
    let recorrido = 0;
    for (let i = 0; i < 60 * 40; i++) {
      const x = a.x;
      const z = a.z;
      paso(a, m);
      recorrido += Math.hypot(a.x - x, a.z - z);
      expect(puntoLibre(mapa, a.x, a.z, RADIO_AVATAR - 0.03)).toBe(true);
    }
    expect(Math.hypot(a.x - 10, a.z - 6)).toBeLessThan(0.2);
    expect(a.velocidad).toBe(0);
    // Tuvo que dar un rodeo: más largo que la línea recta de 8 m.
    expect(recorrido).toBeGreaterThan(9);
  });

  it('una tecla cancela la ruta', () => {
    const a = crearAvatar(2, 6, 0);
    const m = crearMando();
    fijarDestino(m, 10, 6);
    paso(a, m, 30);
    m.adelante = 1;
    paso(a, m, 10);
    m.adelante = 0;
    paso(a, m, 240);
    expect(a.x).toBeLessThan(6);
  });

  it('cancelar detiene la marcha hacia el destino', () => {
    const a = crearAvatar(2, 6, 0);
    const m = crearMando();
    fijarDestino(m, 10, 6);
    paso(a, m, 30);
    cancelar(m);
    paso(a, m, 240);
    expect(a.velocidad).toBe(0);
    expect(a.x).toBeLessThan(6);
  });

  it('un clic nuevo al mismo punto es otra orden', () => {
    const a = crearAvatar(2, 2, 0);
    const m = crearMando();
    fijarDestino(m, 4, 2);
    paso(a, m, 60 * 6);
    expect(Math.hypot(a.x - 4, a.z - 2)).toBeLessThan(0.2);
    a.loc.x = 2;
    a.x = 2;
    fijarDestino(m, 4, 2);
    paso(a, m, 60 * 6);
    expect(Math.hypot(a.x - 4, a.z - 2)).toBeLessThan(0.2);
  });
});

describe('retardo con la predicción apagada', () => {
  it('no responde hasta pasado el retardo y luego sí', () => {
    fijarOpciones({ prediccionAvatar: false });
    const a = crearAvatar(2, 6, 0);
    const m = crearMando();
    m.adelante = 1;
    paso(a, m, 5);
    expect(a.velocidad).toBe(0);
    paso(a, m, 6); // ~11 cuadros = 0,18 s > 0,15 s
    expect(a.velocidad).toBeGreaterThan(0);
  });

  it('el retardo es parametrizable y también retrasa al soltar', () => {
    fijarOpciones({ prediccionAvatar: false });
    const a = crearAvatar(2, 6, 0);
    a.retardoEntrada = 0.5;
    const m = crearMando();
    m.adelante = 1;
    paso(a, m, 20);
    expect(a.velocidad).toBe(0);
    paso(a, m, 20);
    expect(a.velocidad).toBeGreaterThan(0);
    m.adelante = 0;
    paso(a, m, 10);
    expect(a.velocidad).toBeGreaterThan(0);
    paso(a, m, 90);
    expect(a.velocidad).toBe(0);
  });

  it('con la predicción encendida el mismo mando responde de inmediato', () => {
    const a = crearAvatar(2, 6, 0);
    const m = crearMando();
    m.adelante = 1;
    paso(a, m, 1);
    expect(a.velocidad).toBeGreaterThan(0);
  });
});

describe('correr y saltar', () => {
  it('con Shift corre a la velocidad de carrera; sin Shift camina', () => {
    const a = crearAvatar(1, 11, Math.PI);
    const m = crearMando();
    m.adelante = 1;
    paso(a, m, 20);
    expect(a.velocidad).toBeCloseTo(PARAMETROS_AVATAR.velMax, 3);
    m.correr = true;
    paso(a, m, 20);
    expect(a.velocidad).toBeCloseTo(PARAMETROS_AVATAR.velCorrer, 3);
  });

  it('una ruta larga por clic se recorre corriendo; una corta, caminando; doble clic corre igual', () => {
    const maxima = (x: number, z: number, doble: boolean) => {
      const a = crearAvatar(1, 1, 0);
      const m = crearMando();
      fijarDestino(m, x, z, doble);
      let v = 0;
      for (let i = 0; i < 600; i++) {
        paso(a, m);
        v = Math.max(v, a.velocidad);
      }
      return v;
    };
    expect(maxima(11, 11, false)).toBeGreaterThan(PARAMETROS_AVATAR.velMax + 0.5);
    expect(maxima(3, 3, false)).toBeLessThanOrEqual(PARAMETROS_AVATAR.velMax + 1e-9);
    expect(maxima(3, 3, true)).toBeGreaterThan(PARAMETROS_AVATAR.velMax + 0.1);
  });

  it('cada pulsación de salto despega una vez; mantenerla no repite', () => {
    const a = crearAvatar(2, 6, 0);
    const m = crearMando();
    saltar(m);
    let maxY = 0;
    for (let i = 0; i < 90; i++) {
      paso(a, m);
      maxY = Math.max(maxY, a.loc.salto.y);
    }
    expect(maxY).toBeGreaterThan(0.5);
    expect(a.loc.salto.saltos).toBe(1);
    expect(a.loc.salto.fase).toBe('suelo');
  });
});
