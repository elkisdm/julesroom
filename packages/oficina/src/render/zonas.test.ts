import { describe, expect, it } from 'vitest';
import { plano } from '../mansion/plano';
import { encuadreCasa } from './camara';
import {
  ambienteBajoRayo,
  esDobleToque,
  puntoDeEnfoque,
  RADIO_DOBLE_TOQUE,
  VENTANA_DOBLE_TOQUE,
} from './zonas';
import type { Vec3 } from './zonas';

/** Rayo desde la cámara de la casa completa hacia un punto del mundo. */
function rayoHacia(punto: Vec3) {
  const { posicion } = encuadreCasa(1440, 900);
  const d = { x: punto.x - posicion.x, y: punto.y - posicion.y, z: punto.z - posicion.z };
  const largo = Math.hypot(d.x, d.y, d.z);
  return { origen: posicion, direccion: { x: d.x / largo, y: d.y / largo, z: d.z / largo } };
}

const tocar = (punto: Vec3) => {
  const { origen, direccion } = rayoHacia(punto);
  return ambienteBajoRayo(origen, direccion, plano.ambientes)?.id ?? null;
};

describe('ambienteBajoRayo', () => {
  it.each([
    ['gimnasio', { x: -13, y: 1.5, z: 0 }],
    ['living', { x: -7, y: 1.5, z: 0 }],
    ['cocina', { x: 10, y: 1.5, z: 0 }],
    ['finanzas', { x: -10, y: 5.5, z: 0 }],
    ['ventas', { x: 10, y: 5.5, z: 0 }],
    ['desarrollo', { x: -10, y: 9.5, z: 0 }],
    ['contenido', { x: 10, y: 9.5, z: 0 }],
    ['investigacion', { x: 0, y: 13, z: 0 }],
    ['terraza', { x: -14, y: 0.1, z: 7 }],
  ])('un toque en %s lo elige', (id, punto) => {
    expect(tocar(punto)).toBe(id);
  });

  it('en el vacío del atrio elige el atrio', () => {
    expect(tocar({ x: 0, y: 1.5, z: 0 })).toBe('atrio');
  });

  it('la pasarela (dentro del volumen del atrio) gana por ser más específica', () => {
    expect(tocar({ x: 0, y: 5.5, z: -3.2 })).toBe('pasarela');
  });

  it('el cielo y el costado de la casa no son ningún ambiente', () => {
    expect(tocar({ x: 0, y: 22, z: 0 })).toBeNull();
    expect(tocar({ x: 24, y: 3, z: 0 })).toBeNull();
  });

  it('un rayo paralelo a un eje fuera de la caja no la cruza', () => {
    expect(
      ambienteBajoRayo({ x: 50, y: 1, z: 20 }, { x: 0, y: 0, z: -1 }, plano.ambientes),
    ).toBeNull();
  });

  it('un rayo que apunta lejos del ambiente no lo elige', () => {
    expect(
      ambienteBajoRayo({ x: 0, y: 2, z: 30 }, { x: 0, y: 0, z: 1 }, plano.ambientes),
    ).toBeNull();
  });
});

describe('puntoDeEnfoque', () => {
  const enfoque = (punto: Vec3) => {
    const { origen, direccion } = rayoHacia(punto);
    return puntoDeEnfoque(origen, direccion, plano.ambientes);
  };

  it('sobre un ambiente devuelve un punto de su interior, no de su fachada', () => {
    const p = enfoque({ x: 10, y: 5.5, z: 3.9 });
    const ventas = plano.ambientes.find((a) => a.id === 'ventas');
    expect(p).not.toBeNull();
    expect(p?.x).toBeGreaterThan((ventas?.x0 ?? 0) - 1e-6);
    expect(p?.x).toBeLessThan((ventas?.x1 ?? 0) + 1e-6);
    expect(p?.z).toBeLessThan(3.5);
    expect(p?.z).toBeGreaterThan(-4);
    expect(p?.y).toBeGreaterThan(3.9);
    expect(p?.y).toBeLessThan(7.5);
  });

  it('fuera de la casa apunta al suelo', () => {
    const p = enfoque({ x: 30, y: 0, z: 12 });
    expect(p?.y).toBeCloseTo(0, 6);
    expect(p?.x).toBeCloseTo(30, 3);
  });

  it('un rayo hacia el cielo no enfoca nada', () => {
    expect(
      puntoDeEnfoque({ x: 0, y: 5, z: 40 }, { x: 0, y: 1, z: -0.1 }, plano.ambientes),
    ).toBeNull();
  });

  it('un suelo lejísimos de la casa tampoco', () => {
    expect(
      puntoDeEnfoque({ x: 60, y: 20, z: 0 }, { x: 0.95, y: -0.3, z: 0 }, plano.ambientes),
    ).toBeNull();
  });

  it('un ambiente que está debajo de otro no roba el toque', () => {
    const { origen, direccion } = rayoHacia({ x: 10, y: 5.5, z: 3.9 });
    expect(ambienteBajoRayo(origen, direccion, plano.ambientes)?.id).toBe('ventas');
  });
});

describe('esDobleToque', () => {
  const primero = { t: 1000, x: 100, y: 100 };

  it('dos toques cerca en el tiempo y el espacio lo son', () => {
    expect(esDobleToque(primero, { t: 1200, x: 105, y: 98 })).toBe(true);
  });

  it('demasiado tarde no', () => {
    expect(esDobleToque(primero, { t: 1000 + VENTANA_DOBLE_TOQUE + 1, x: 100, y: 100 })).toBe(
      false,
    );
  });

  it('demasiado lejos no', () => {
    expect(esDobleToque(primero, { t: 1100, x: 100 + RADIO_DOBLE_TOQUE + 1, y: 100 })).toBe(false);
  });

  it('el primer toque nunca es doble', () => {
    expect(esDobleToque(null, primero)).toBe(false);
  });
});
