import { describe, expect, it } from 'vitest';
import { crearOtros, PARAMETROS_SEPARACION, separacionDeAvatar } from './separacion';
import type { SalidaSeparacion } from './separacion';

const DT = 1 / 60;
const P = PARAMETROS_SEPARACION;
const minimo = P.radioAvatar + P.radioOtro;
const salida = (): SalidaSeparacion => ({ dx: 0, dz: 0 });

function otrosEn(...puntos: [number, number][]) {
  const o = crearOtros(8);
  puntos.forEach(([x, z], i) => {
    o.x[i] = x;
    o.z[i] = z;
  });
  o.n = puntos.length;
  return o;
}

/** Aplica el desplazamiento de separación hasta que se asienta. */
function asentar(x: number, z: number, o: ReturnType<typeof crearOtros>, segundos = 3) {
  const s = salida();
  for (let i = 0; i < segundos / DT; i++) {
    separacionDeAvatar(x, z, 0, o, P, DT, s);
    x += s.dx;
    z += s.dz;
  }
  return { x, z };
}

describe('separacionDeAvatar', () => {
  it('lejos de todos no hace nada', () => {
    const s = salida();
    separacionDeAvatar(0, 0, 1, otrosEn([5, 5]), P, DT, s);
    expect(s.dx).toBe(0);
    expect(s.dz).toBe(0);
  });

  it('sin otros no hace nada', () => {
    const s = salida();
    separacionDeAvatar(0, 0, 1, otrosEn(), P, DT, s);
    expect(s.dx + s.dz).toBe(0);
  });

  it('empuja alejándose de quien está dentro del radio', () => {
    const s = salida();
    separacionDeAvatar(0.2, 0, 0, otrosEn([0, 0]), P, DT, s);
    expect(s.dx).toBeGreaterThan(0);
    expect(Math.abs(s.dz)).toBeLessThan(1e-9);
  });

  it('si se detiene encima termina a un radio de cuerpo o más, sin quedar dentro', () => {
    const f = asentar(0.05, 0.02, otrosEn([0, 0]));
    expect(Math.hypot(f.x, f.z)).toBeGreaterThanOrEqual(minimo - 0.02);
  });

  it('exactamente encima (distancia 0) también sale, sin NaN', () => {
    const f = asentar(0, 0, otrosEn([0, 0]));
    expect(Number.isFinite(f.x + f.z)).toBe(true);
    expect(Math.hypot(f.x, f.z)).toBeGreaterThanOrEqual(minimo - 0.02);
  });

  it('el empuje es suave: nunca más de la fuerza máxima por cuadro', () => {
    const s = salida();
    separacionDeAvatar(0.1, 0, 0, otrosEn([0, 0]), P, DT, s);
    expect(Math.hypot(s.dx, s.dz)).toBeLessThanOrEqual(P.empujeMax * DT + 1e-9);
  });

  it('la zona de desvío empuja menos que dentro del radio', () => {
    const dentro = salida();
    const borde = salida();
    separacionDeAvatar(minimo * 0.6, 0, 1, otrosEn([0, 0]), P, DT, dentro);
    separacionDeAvatar(minimo + P.zonaDesvio * 0.5, 0, 1, otrosEn([0, 0]), P, DT, borde);
    expect(Math.hypot(borde.dx, borde.dz)).toBeLessThan(Math.hypot(dentro.dx, dentro.dz));
    expect(Math.hypot(borde.dx, borde.dz)).toBeGreaterThan(0);
  });

  it('al ir de frente contra alguien lo desvía de lado (componente perpendicular)', () => {
    // Avatar en (0,1) yendo hacia −z (velocidad en dirección −z), otro en (0.05, 0): casi de frente.
    const s = salida();
    separacionDeAvatar(0, 0.8, 1, otrosEn([0.05, 0]), P, DT, s, 0, -1);
    const sin = salida();
    separacionDeAvatar(0, 0.8, 1, otrosEn([0.05, 0]), P, DT, sin);
    expect(Math.abs(s.dx)).toBeGreaterThan(Math.abs(sin.dx) * 2);
  });

  it('quieto fuera del contacto no se mueve (la zona exterior solo actúa en movimiento)', () => {
    const s = salida();
    separacionDeAvatar(minimo + 0.1, 0, 0, otrosEn([0, 0]), P, DT, s);
    expect(s.dx).toBe(0);
  });

  it('con varios otros suma sus empujes', () => {
    const uno = salida();
    const dos = salida();
    separacionDeAvatar(0.3, 0, 0, otrosEn([0, 0]), P, DT, uno);
    separacionDeAvatar(0.3, 0, 0, otrosEn([0, 0], [0.6, 0.05]), P, DT, dos);
    expect(Math.hypot(dos.dx, dos.dz)).not.toBeCloseTo(Math.hypot(uno.dx, uno.dz), 6);
  });

  it('radios y fuerza son parámetros', () => {
    const s = salida();
    const grande = { ...P, radioOtro: 1.2 };
    separacionDeAvatar(0.9, 0, 0, otrosEn([0, 0]), grande, DT, s);
    expect(s.dx).toBeGreaterThan(0);
    const t = salida();
    separacionDeAvatar(0.9, 0, 0, otrosEn([0, 0]), P, DT, t);
    expect(Math.abs(t.dx)).toBeLessThan(s.dx);
  });
});
