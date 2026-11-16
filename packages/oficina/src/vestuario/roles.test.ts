import { describe, expect, it } from 'vitest';
import { catalogoBase } from '../catalogo/base';
import { crearCatalogo } from '../catalogo/registro';
import { resolverAtuendo } from './resolver';
import { LOOK_POR_ROL, atuendoPorRol, rolesConocidos } from './roles';

describe('rolesConocidos', () => {
  it('lista los roles con look propio, sin repetidos y todos resuelven', () => {
    expect(rolesConocidos.length).toBeGreaterThan(10);
    expect(new Set(rolesConocidos).size).toBe(rolesConocidos.length);
    expect(rolesConocidos).toContain('QA');
    for (const rol of rolesConocidos) expect(LOOK_POR_ROL[rol]).toBeDefined();
  });
});

describe('atuendoPorRol', () => {
  it('usa el look del rol (Backend: polera oscura, rizos, audífonos, {  })', () => {
    const a = atuendoPorRol('Backend', 0);
    expect(a.top).toBe('polera');
    expect(a.topColor).toBe('#2b2f36');
    expect(a.hair).toBe('rizos');
    expect(a.acc).toEqual(['audifonos']);
    expect(a.print).toBe('{ }');
  });

  it('un rol desconocido cae a un look por defecto válido', () => {
    const a = atuendoPorRol('Rol inventado', 3);
    expect(a.top).toBe('polera');
    expect(a.bottom).toBe('pantalon');
    expect(a.acc).toEqual([]);
  });

  it('varía piel y cara con el índice (como defaultAvatar)', () => {
    expect(atuendoPorRol('QA', 0).skin).not.toBe(atuendoPorRol('QA', 1).skin);
    expect(atuendoPorRol('QA', 0).face).toBe('feliz');
    expect(atuendoPorRol('QA', 2).face).toBe('concentrado');
  });

  it('devuelve copias: mutar acc no afecta la siguiente llamada', () => {
    atuendoPorRol('Backend', 0).acc.push('gorra');
    expect(atuendoPorRol('Backend', 0).acc).toEqual(['audifonos']);
  });

  it('todos los roles del prototipo resuelven sin avisos', () => {
    const catalogo = crearCatalogo(catalogoBase);
    const roles = [
      'Front designer',
      'Backend',
      'QA',
      'Integrador',
      'Ejecutivo de ventas',
      'Analista comercial',
      'Redactor',
      'Guionista',
      'Editor de video',
      'Community',
      'Contador',
      'Planificador',
      'Cobranza',
      'Asistente personal',
      'Coach',
      'Compras',
      'Científico',
      'Vigía de novedades',
      'Verificador',
    ];
    for (const [i, rol] of roles.entries()) {
      const avisos: string[] = [];
      const r = resolverAtuendo(catalogo, atuendoPorRol(rol, i), (m) => avisos.push(m));
      expect(avisos, rol).toEqual([]);
      expect(r.acc, rol).toEqual(atuendoPorRol(rol, i).acc);
    }
  });
});
