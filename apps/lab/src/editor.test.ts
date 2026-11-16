import { describe, expect, it } from 'vitest';
import {
  catalogoDe,
  agregarAgente,
  alternarAccesorio,
  alternarPaquete,
  cambiarAtuendo,
  cambiarDepartamento,
  cambiarRol,
  quitarOcupante,
  renombrar,
} from './editor';
import { ejemploEquipo, validarDefinicion } from '@oficina/motor';
import type { DefinicionOficina, OcupanteAgente } from '@oficina/motor';

const base = (): DefinicionOficina => JSON.parse(JSON.stringify(ejemploEquipo));
const agente = (d: DefinicionOficina, id: string) =>
  d.ocupantes.find((o): o is OcupanteAgente => o.id === id && o.tipo === 'agente');

describe('editor de definición', () => {
  it('agregarAgente suma un agente válido con id único y atuendo propio', () => {
    const d0 = base();
    const d1 = agregarAgente(d0);
    expect(d1.ocupantes).toHaveLength(d0.ocupantes.length + 1);
    expect(d0.ocupantes).toHaveLength(ejemploEquipo.ocupantes.length);
    expect(validarDefinicion(d1).ok).toBe(true);
    const nuevo = d1.ocupantes[d1.ocupantes.length - 1];
    expect(nuevo?.tipo).toBe('agente');
    expect(nuevo?.atuendo).toBeDefined();
    const d2 = agregarAgente(d1);
    expect(new Set(d2.ocupantes.map((o) => o.id)).size).toBe(d2.ocupantes.length);
  });

  it('agregarAgente tras quitar uno no repite un id vivo', () => {
    let d = base();
    d = quitarOcupante(d, 'eq-1');
    d = agregarAgente(d);
    d = agregarAgente(d);
    expect(new Set(d.ocupantes.map((o) => o.id)).size).toBe(d.ocupantes.length);
  });

  it('quitarOcupante quita solo ese; un id inexistente no cambia nada', () => {
    const d = base();
    expect(quitarOcupante(d, 'eq-2').ocupantes.map((o) => o.id)).not.toContain('eq-2');
    expect(quitarOcupante(d, 'eq-2').ocupantes).toHaveLength(d.ocupantes.length - 1);
    expect(quitarOcupante(d, 'zzz')).toEqual(d);
  });

  it('se puede quitar al último ocupante y la definición sigue siendo válida', () => {
    let d = base();
    for (const o of [...d.ocupantes]) d = quitarOcupante(d, o.id);
    expect(d.ocupantes).toEqual([]);
    expect(validarDefinicion(d).ok).toBe(true);
  });

  it('renombrar cambia el nombre sin tocar el original; un nombre en blanco queda inválido', () => {
    const d = base();
    const d1 = renombrar(d, 'eq-1', 'Marta');
    expect(agente(d1, 'eq-1')?.nombre).toBe('Marta');
    expect(agente(d, 'eq-1')?.nombre).not.toBe('Marta');
    expect(validarDefinicion(renombrar(d, 'eq-1', '   ')).ok).toBe(false);
  });

  it('cambiarRol cambia el rol y reinicia el atuendo al del rol', () => {
    const d1 = cambiarRol(base(), 'eq-1', 'Científico');
    const a = agente(d1, 'eq-1');
    expect(a?.rol).toBe('Científico');
    expect(a?.atuendo?.top).toBe('bata');
  });

  it('cambiarDepartamento solo acepta departamentos declarados', () => {
    const d = base();
    expect(agente(cambiarDepartamento(d, 'eq-1', 'ventas'), 'eq-1')?.departamento).toBe('ventas');
    expect(cambiarDepartamento(d, 'eq-1', 'no-existe')).toEqual(d);
  });

  it('cambiarAtuendo aplica un parche sobre el atuendo (y crea el del rol si no tenía)', () => {
    const cat = catalogoDe(base());
    const d = base();
    expect(agente(d, 'eq-1')?.atuendo).toBeUndefined();
    const d1 = cambiarAtuendo(d, 'eq-1', { topColor: '#123456', top: 'blazer' }, cat);
    expect(agente(d1, 'eq-1')?.atuendo?.topColor).toBe('#123456');
    expect(agente(d1, 'eq-1')?.atuendo?.top).toBe('blazer');
    expect(validarDefinicion(d1).ok).toBe(true);
  });

  it('alternarAccesorio equipa y desequipa; un id que no existe no cambia nada', () => {
    const cat = catalogoDe(base());
    const d1 = alternarAccesorio(base(), 'eq-3', 'audifonos', cat);
    expect(agente(d1, 'eq-3')?.atuendo?.acc).toContain('audifonos');
    const d2 = alternarAccesorio(d1, 'eq-3', 'audifonos', cat);
    expect(agente(d2, 'eq-3')?.atuendo?.acc).not.toContain('audifonos');
    expect(alternarAccesorio(base(), 'eq-3', 'inventado', cat)).toEqual(base());
  });

  it('alternarPaquete suma y quita un paquete de skins del tema; el catálogo lo refleja', () => {
    const d1 = alternarPaquete(base(), 'halloween');
    expect(d1.tema.paquetes).toEqual(['halloween']);
    expect(catalogoDe(d1).paquetes).toEqual(['halloween']);
    expect(alternarPaquete(d1, 'halloween').tema.paquetes).toEqual([]);
    expect(alternarPaquete(base(), 'inexistente')).toEqual(base());
  });
});
