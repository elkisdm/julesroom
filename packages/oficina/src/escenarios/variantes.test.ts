import { describe, expect, it, vi } from 'vitest';
import { colorDe, emisivoDe, horaFijaDeVariante, luzDe, resolverVariante } from './variantes';
import type { PaletaVariante, VarianteEscenario } from './tipos';
import { escenarioMansion } from './mansion';
import { escenarioTrading } from './trading';
import { escenarioOficina } from './oficina';

const A: VarianteEscenario = { id: 'a', nombre: 'A', paleta: { hora: 10 } };
const B: VarianteEscenario = { id: 'b', nombre: 'B', paleta: { hora: 18 } };

describe('resolverVariante', () => {
  it('sin id: la primera, sin aviso y sin ser explícita', () => {
    expect(resolverVariante([A, B], undefined)).toEqual({
      variante: A,
      explicita: false,
      aviso: null,
    });
  });

  it('con un id válido: esa variante, explícita', () => {
    expect(resolverVariante([A, B], 'b')).toEqual({ variante: B, explicita: true, aviso: null });
  });

  it('con un id inválido: la primera, con aviso que nombra el id y las válidas', () => {
    const r = resolverVariante([A, B], 'noche');
    expect(r.variante).toBe(A);
    expect(r.explicita).toBe(false);
    expect(r.aviso).toContain('noche');
    expect(r.aviso).toContain('a, b');
  });

  it('sin variantes lanza (todo escenario trae al menos una)', () => {
    expect(() => resolverVariante([], undefined)).toThrow(/al menos una/);
  });
});

describe('lectura de la paleta', () => {
  const p: PaletaVariante = {
    hora: 10,
    materiales: { nogal: '#111111' },
    emisivos: { luzCalida: { color: '#222222', fuerza: 5 } },
    luces: { relleno: { color: '#333333', intensidad: 2 }, solo: { intensidad: 0.5 } },
  };

  it('colorDe: el de la variante o, si falta, el de la plantilla', () => {
    expect(colorDe(p, 'nogal', '#c08a63')).toBe('#111111');
    expect(colorDe(p, 'tinta', '#1c2638')).toBe('#1c2638');
    expect(colorDe({ hora: 1 }, 'nogal', '#c08a63')).toBe('#c08a63');
  });

  it('emisivoDe: reemplaza color y fuerza; si falta, deja los de la plantilla', () => {
    expect(emisivoDe(p, 'luzCalida', { color: '#ffcf9a', fuerza: 3 })).toEqual({
      color: '#222222',
      fuerza: 5,
    });
    expect(emisivoDe(p, 'botellas', { color: '#ffb36b', fuerza: 1.4 })).toEqual({
      color: '#ffb36b',
      fuerza: 1.4,
    });
  });

  it('luzDe: multiplica la intensidad y reemplaza el color solo si la variante lo trae', () => {
    expect(luzDe(p, 'relleno', { color: '#fff', intensidad: 10 })).toEqual({
      color: '#333333',
      intensidad: 20,
    });
    expect(luzDe(p, 'solo', { color: '#fff', intensidad: 10 })).toEqual({
      color: '#fff',
      intensidad: 5,
    });
    expect(luzDe(p, 'otra', { color: '#fff', intensidad: 10 })).toEqual({
      color: '#fff',
      intensidad: 10,
    });
  });
});

describe('variantes de los escenarios', () => {
  const todos = [escenarioMansion, escenarioTrading, escenarioOficina];

  it.each(todos)('$id: de 2 a 4 variantes con ids únicos y horas válidas', (e) => {
    expect(e.variantes.length).toBeGreaterThanOrEqual(2);
    expect(e.variantes.length).toBeLessThanOrEqual(4);
    expect(new Set(e.variantes.map((v) => v.id)).size).toBe(e.variantes.length);
    for (const v of e.variantes) {
      expect(v.paleta.hora).toBeGreaterThanOrEqual(0);
      expect(v.paleta.hora).toBeLessThan(24);
    }
  });

  it.each([escenarioTrading, escenarioOficina])(
    '$id: la primera variante es la de siempre (misma hora, sin cambios)',
    (e) => {
      const { hora, ...cambios } = e.variantes[0]!.paleta;
      expect(hora).toBe(e.ambiente.hora);
      expect(cambios).toEqual({});
    },
  );

  it('los nombres pedidos', () => {
    expect(escenarioTrading.variantes.map((v) => v.nombre)).toEqual(['Hora azul', 'Ámbar']);
    expect(escenarioOficina.variantes.map((v) => v.nombre)).toEqual(['Mañana', 'Tarde']);
    expect(escenarioMansion.variantes.map((v) => v.nombre)).toEqual(['Día', 'Noche']);
  });

  it('aviso de variante inválida se puede mostrar sin lanzar', () => {
    const aviso = vi.fn();
    const r = resolverVariante(escenarioOficina.variantes, 'x');
    if (r.aviso) aviso(r.aviso);
    expect(aviso).toHaveBeenCalledOnce();
  });
});

describe('horaFijaDeVariante', () => {
  it('con variante pedida válida manda la hora de la variante; sin ella, la del escenario', () => {
    expect(horaFijaDeVariante(null, resolverVariante([A, B], 'b'))).toBe(18);
    expect(horaFijaDeVariante(null, resolverVariante([A, B], undefined))).toBeNull();
    expect(horaFijaDeVariante(10, resolverVariante([A, B], 'zz'))).toBe(10);
  });
});
