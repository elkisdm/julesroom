import { describe, expect, it } from 'vitest';
import {
  CONFIG_AJUSTE_INICIAL,
  crearControladorDpr,
  nivelInicialPorEquipo,
  proponerNivel,
} from './ajuste';
import type { ConfigAjuste, Equipo } from './ajuste';

const cfg = { ...CONFIG_AJUSTE_INICIAL, graciaInicial: 0 };
const M = cfg.muestrasMinimas;
const escritorio: Equipo = { nucleos: 18, memoriaGb: 32, dpr: 2, tactil: false, anchoPx: 1920 };

describe('nivelInicialPorEquipo', () => {
  it('móvil potente -> media', () => {
    expect(
      nivelInicialPorEquipo({ nucleos: 8, memoriaGb: 8, dpr: 3, tactil: true, anchoPx: 390 }),
    ).toBe('media');
  });
  it('móvil modesto -> baja', () => {
    expect(
      nivelInicialPorEquipo({ nucleos: 6, memoriaGb: 4, dpr: 2, tactil: true, anchoPx: 390 }),
    ).toBe('baja');
  });
  it('escritorio de 18 núcleos -> alta', () => {
    expect(nivelInicialPorEquipo(escritorio)).toBe('alta');
  });
  it('notebook de 4 núcleos -> media', () => {
    expect(nivelInicialPorEquipo({ ...escritorio, nucleos: 4 })).toBe('media');
  });
  it('menos de 4 núcleos no táctil -> baja', () => {
    expect(nivelInicialPorEquipo({ ...escritorio, nucleos: 2 })).toBe('baja');
  });
  it('sin memoriaGb se trata como 4: móvil de 8 núcleos -> baja', () => {
    expect(nivelInicialPorEquipo({ nucleos: 8, dpr: 3, tactil: true, anchoPx: 390 })).toBe('baja');
  });
  it('pantalla angosta no táctil -> baja', () => {
    expect(nivelInicialPorEquipo({ ...escritorio, anchoPx: 500, nucleos: 4 })).toBe('baja');
  });
});

describe('crearControladorDpr', () => {
  it('empieza en dprMax del nivel', () => {
    expect(crearControladorDpr(cfg, 'alta').dpr).toBe(2);
  });
  it('el devicePixelRatio del equipo limita el dpr inicial', () => {
    expect(crearControladorDpr(cfg, 'alta', 1.5).dpr).toBe(1.5);
  });
  it('sin muestras suficientes no cambia', () => {
    const c = crearControladorDpr(cfg, 'alta');
    expect(c.muestrear(50, M - 1)).toBe(2);
  });
  it('baja un paso cuando p95 supera el presupuesto', () => {
    const c = crearControladorDpr(cfg, 'alta');
    expect(c.muestrear(20, M)).toBe(2 - cfg.pasoDpr);
    expect(c.dpr).toBe(2 - cfg.pasoDpr);
  });
  it('no baja de dprMin', () => {
    const c = crearControladorDpr(cfg, 'baja');
    for (let i = 0; i < 20; i++) c.muestrear(30, M);
    expect(c.dpr).toBe(0.75);
  });
  it('sube un paso cuando hay holgura y ya pasó el enfriamiento', () => {
    const c = crearControladorDpr({ ...cfg, enfriamientoSubida: 0 }, 'alta');
    c.muestrear(20, M);
    c.muestrear(20, M);
    expect(c.muestrear(5, M)).toBe(2 - cfg.pasoDpr);
  });
  it('tras bajar, no sube hasta cumplir el enfriamiento (no oscila)', () => {
    const c = crearControladorDpr({ ...cfg, enfriamientoSubida: 3 }, 'alta');
    c.muestrear(20, M);
    const bajo = c.dpr;
    expect(c.muestrear(0, M)).toBe(bajo);
    expect(c.muestrear(0, M)).toBe(bajo);
    expect(c.muestrear(0, M)).toBe(bajo + cfg.pasoDpr);
  });
  it('bajar estando ya en el mínimo no arma enfriamiento', () => {
    const c = crearControladorDpr({ ...cfg, enfriamientoSubida: 5 }, 'baja');
    for (let i = 0; i < 6; i++) c.muestrear(30, M);
    expect(c.dpr).toBe(cfg.perfiles.baja.dprMin);
    c.cambiarNivel('alta');
    expect(c.muestrear(0, M)).toBeGreaterThan(cfg.perfiles.baja.dprMin);
  });
  it('no sube de dprMax', () => {
    const c = crearControladorDpr(cfg, 'media');
    expect(c.muestrear(1, M)).toBe(1.5);
  });
  it('zona de histéresis no cambia', () => {
    const c = crearControladorDpr(cfg, 'alta');
    expect(c.muestrear(cfg.presupuestoMs, M)).toBe(2);
    expect(c.muestrear(cfg.presupuestoMs - cfg.holguraMs, M)).toBe(2);
    c.muestrear(20, M);
    expect(c.muestrear(cfg.presupuestoMs - cfg.holguraMs + 0.1, M)).toBe(2 - cfg.pasoDpr);
  });
  it('cambiarNivel reencuadra hacia abajo', () => {
    const c = crearControladorDpr(cfg, 'alta');
    c.cambiarNivel('baja');
    expect(c.dpr).toBe(1);
  });
  it('cambiarNivel reencuadra hacia arriba', () => {
    const c = crearControladorDpr(cfg, 'baja');
    for (let i = 0; i < 20; i++) c.muestrear(30, M);
    c.cambiarNivel('alta');
    expect(c.dpr).toBe(1);
  });
  it('los valores son múltiplos del paso', () => {
    const c = crearControladorDpr(cfg, 'alta', 1.93);
    for (let i = 0; i < 7; i++) {
      c.muestrear(i % 2 ? 1 : 30, M);
      expect(Math.abs(c.dpr / cfg.pasoDpr - Math.round(c.dpr / cfg.pasoDpr))).toBe(0);
    }
  });
  it('con otros umbrales (presupuestoMs 8) el resultado cambia', () => {
    const estricta: ConfigAjuste = { ...cfg, presupuestoMs: 8 };
    expect(crearControladorDpr(cfg, 'alta').muestrear(10, M)).toBe(2);
    expect(crearControladorDpr(estricta, 'alta').muestrear(10, M)).toBe(2 - cfg.pasoDpr);
  });
});

describe('proponerNivel', () => {
  it('baja de nivel si dpr está en el mínimo y sigue lento', () => {
    expect(proponerNivel(cfg, 'alta', 1, 20, M)).toBe('media');
    expect(proponerNivel(cfg, 'media', 1, 20, M)).toBe('baja');
  });
  it('no baja de baja', () => {
    expect(proponerNivel(cfg, 'baja', 0.75, 20, M)).toBe('baja');
  });
  it('sube de nivel si dpr está en el máximo y hay holgura', () => {
    expect(proponerNivel(cfg, 'baja', 1, 4, M)).toBe('media');
    expect(proponerNivel(cfg, 'media', 1.5, 4, M)).toBe('alta');
  });
  it('no sube de alta', () => {
    expect(proponerNivel(cfg, 'alta', 2, 4, M)).toBe('alta');
  });
  it('mismo nivel si el dpr aún tiene margen', () => {
    expect(proponerNivel(cfg, 'alta', 1.5, 20, M)).toBe('alta');
    expect(proponerNivel(cfg, 'alta', 1.5, 4, M)).toBe('alta');
  });
  it('mismo nivel sin muestras suficientes', () => {
    expect(proponerNivel(cfg, 'alta', 1, 20, M - 1)).toBe('alta');
  });
  it('mismo nivel dentro de la histéresis', () => {
    expect(proponerNivel(cfg, 'alta', 1, 10, M)).toBe('alta');
  });
  it('con presupuestoMs 8 baja donde el inicial no', () => {
    expect(proponerNivel(cfg, 'alta', 1, 10, M)).toBe('alta');
    expect(proponerNivel({ ...cfg, presupuestoMs: 8 }, 'alta', 1, 10, M)).toBe('media');
  });
});

describe('gracia inicial', () => {
  it('durante la gracia no baja la resolución aunque el p95 sea malo', () => {
    const c = crearControladorDpr({ ...cfg, graciaInicial: 3 }, 'alta');
    expect(c.enGracia).toBe(true);
    expect(c.muestrear(50, M)).toBe(2);
    expect(c.muestrear(50, M)).toBe(2);
    expect(c.muestrear(50, M)).toBe(2);
    expect(c.enGracia).toBe(false);
    expect(c.muestrear(50, M)).toBe(2 - cfg.pasoDpr);
  });
});
