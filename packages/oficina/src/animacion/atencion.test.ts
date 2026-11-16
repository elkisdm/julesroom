import { describe, expect, it } from 'vitest';
import {
  actualizarAtencion,
  crearAtencion,
  ASISTENTE,
  NADIE,
  SEGUNDOS_GESTO,
  yawObjetivoAtento,
} from './atencion';
import type { EntradaAtencion } from './atencion';
import { crearCoordinador } from './interacciones';
import type { Coordinador } from './interacciones';
import { calcularMirada, suavizar } from './mirada';
import { azarSecuencia } from '../test-utils';

/** Tres en la sala 0 (la 0 sentada), una en la sala 1; Asistente lejos. */
function escena(): Coordinador {
  const c = crearCoordinador(4, 2, 0, azarSecuencia(0));
  const datos = [
    { sala: 0, sentado: true, x: 0, z: 0 },
    { sala: 0, sentado: true, x: 2, z: 0 },
    { sala: 0, sentado: false, x: 4, z: 0 },
    { sala: 1, sentado: true, x: 20, z: 0 },
  ];
  datos.forEach((d, i) => {
    const v = c.vistas[i];
    if (!v) return;
    v.sala = d.sala;
    v.sentado = d.sentado;
    v.x = d.x;
    v.z = d.z;
    v.quieta = true;
  });
  return c;
}

const entrada = (e: Partial<EntradaAtencion> = {}): EntradaAtencion => ({
  enfocado: -1,
  salaAmbiente: -1,
  asistenteX: 100,
  asistenteZ: 100,
  permitido: true,
  ...e,
});

const rol = (a: ReturnType<typeof crearAtencion>, i: number) => a.personas[i]?.rol;

describe('agente enfocado', () => {
  it('queda como enfocado y mira a cámara', () => {
    const c = escena();
    const a = crearAtencion(4);
    actualizarAtencion(a, 4, c.vistas, entrada({ enfocado: 1 }), 1);
    expect(rol(a, 1)).toBe('enfocado');
    expect(a.personas[1]?.objetivo).toBe(NADIE);
  });

  it('se orienta a cámara dentro de 1,5 s con el límite y el suavizado de la mirada', () => {
    const mirada = { yaw: 0, pitch: 0 };
    calcularMirada(
      {
        posCabeza: { x: 0, y: 1.4, z: 0 },
        yawCuerpo: 0,
        objetivo: { x: 5, y: 2, z: 5 },
      },
      mirada,
    );
    let yaw = 0;
    for (let t = 0; t < 1.5; t += 1 / 60) yaw = suavizar(yaw, mirada.yaw, 1 / 60, 0.25);
    expect(Math.abs(yaw - mirada.yaw)).toBeLessThan(0.05);
  });

  it('sentado asiente y de pie saluda, una sola vez por enfoque', () => {
    const c = escena();
    const a = crearAtencion(4);
    actualizarAtencion(a, 4, c.vistas, entrada({ enfocado: 0 }), 1);
    expect(a.personas[0]?.gesto).toBe('ninguno');
    actualizarAtencion(a, 4, c.vistas, entrada({ enfocado: 0 }), 1.3);
    expect(a.personas[0]?.gesto).toBe('asentir');
    expect(a.personas[0]?.gestoDesde).toBe(1.3);
    // Pasa el gesto y no se repite mientras dure el enfoque.
    actualizarAtencion(a, 4, c.vistas, entrada({ enfocado: 0 }), 1.3 + SEGUNDOS_GESTO + 0.1);
    expect(a.personas[0]?.gesto).toBe('ninguno');
    actualizarAtencion(a, 4, c.vistas, entrada({ enfocado: 0 }), 10);
    expect(a.personas[0]?.gesto).toBe('ninguno');
    // De pie.
    actualizarAtencion(a, 4, c.vistas, entrada({ enfocado: 2 }), 12);
    actualizarAtencion(a, 4, c.vistas, entrada({ enfocado: 2 }), 12.3);
    expect(a.personas[2]?.gesto).toBe('saludo');
    // Un enfoque nuevo sobre la misma persona vuelve a saludar.
    actualizarAtencion(a, 4, c.vistas, entrada({ enfocado: -1 }), 20);
    actualizarAtencion(a, 4, c.vistas, entrada({ enfocado: 2 }), 21);
    actualizarAtencion(a, 4, c.vistas, entrada({ enfocado: 2 }), 21.3);
    expect(a.personas[2]?.gesto).toBe('saludo');
  });

  it('espera a detenerse para gesticular', () => {
    const c = escena();
    const a = crearAtencion(4);
    const v = c.vistas[2];
    if (v) v.quieta = false;
    actualizarAtencion(a, 4, c.vistas, entrada({ enfocado: 2 }), 1);
    expect(a.personas[2]?.gesto).toBe('ninguno');
    if (v) v.quieta = true;
    actualizarAtencion(a, 4, c.vistas, entrada({ enfocado: 2 }), 1.4);
    expect(a.personas[2]?.gesto).toBe('saludo');
  });

  it('sin gestos amplios con prefers-reduced-motion, pero igual queda atento', () => {
    const c = escena();
    const a = crearAtencion(4);
    actualizarAtencion(a, 4, c.vistas, entrada({ enfocado: 2, permitido: false }), 1);
    expect(rol(a, 2)).toBe('enfocado');
    expect(a.personas[2]?.gesto).toBe('ninguno');
  });

  it('al soltar el enfoque todos vuelven a su rutina', () => {
    const c = escena();
    const a = crearAtencion(4);
    actualizarAtencion(a, 4, c.vistas, entrada({ enfocado: 1 }), 1);
    actualizarAtencion(a, 4, c.vistas, entrada(), 3);
    for (let i = 0; i < 4; i++) {
      expect(rol(a, i)).toBe('ninguno');
      expect(a.personas[i]?.gesto).toBe('ninguno');
    }
  });
});

describe('el resto de la sala del enfocado', () => {
  it('mira al enfocado; la otra sala no se entera', () => {
    const c = escena();
    const a = crearAtencion(4);
    actualizarAtencion(a, 4, c.vistas, entrada({ enfocado: 1 }), 1);
    expect(rol(a, 0)).toBe('sala');
    expect(a.personas[0]?.objetivo).toBe(1);
    expect(a.personas[2]?.objetivo).toBe(1);
    expect(rol(a, 3)).toBe('ninguno');
  });

  it('mira al asistente si está más cerca que el enfocado', () => {
    const c = escena();
    const a = crearAtencion(4);
    actualizarAtencion(a, 4, c.vistas, entrada({ enfocado: 0, asistenteX: 4.5, asistenteZ: 0 }), 1);
    expect(a.personas[2]?.objetivo).toBe(ASISTENTE);
    expect(a.personas[1]?.objetivo).toBe(0);
  });

  it('no parpadea entre Asistente y el enfocado en el límite', () => {
    const c = escena();
    const a = crearAtencion(4);
    // Persona 2 a 4 m del enfocado; Asistente a 3,9 m de ella: apenas más cerca, no basta para cambiar.
    actualizarAtencion(a, 4, c.vistas, entrada({ enfocado: 0, asistenteX: 0.1, asistenteZ: 0 }), 1);
    expect(a.personas[2]?.objetivo).toBe(0);
  });
});

describe('cámara dentro de un ambiente, sin enfoque', () => {
  it('los de esa sala quedan en rol ambiente; los demás no', () => {
    const c = escena();
    const a = crearAtencion(4);
    actualizarAtencion(a, 4, c.vistas, entrada({ salaAmbiente: 0 }), 1);
    expect(rol(a, 0)).toBe('ambiente');
    expect(rol(a, 2)).toBe('ambiente');
    expect(rol(a, 3)).toBe('ninguno');
    expect(a.personas[0]?.gesto).toBe('ninguno');
  });

  it('el enfoque manda sobre el ambiente', () => {
    const c = escena();
    const a = crearAtencion(4);
    actualizarAtencion(a, 4, c.vistas, entrada({ salaAmbiente: 0, enfocado: 3 }), 1);
    expect(rol(a, 0)).toBe('ninguno');
    expect(rol(a, 3)).toBe('enfocado');
  });
});

describe('yawObjetivoAtento', () => {
  it('de pie gira entero hacia el objetivo', () => {
    const yaw = yawObjetivoAtento(false, 0, 0, 0, 0, 5, 0);
    expect(yaw).toBeCloseTo(Math.PI / 2);
  });

  it('sentado solo gira la silla dentro de su límite', () => {
    const yaw = yawObjetivoAtento(true, 1, 0.5, 0, 0, -5, 0);
    expect(Math.abs(yaw - 1)).toBeCloseTo(0.5);
  });
});
