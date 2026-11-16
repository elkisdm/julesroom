import { describe, expect, it } from 'vitest';
import { altoMaximoBurbuja, PARAMETROS_ANCLAJE, rectAvatar, ubicarBurbuja } from './anclaje';
import type { Lado, Rect } from './anclaje';

const V = { ancho: 1280, alto: 720 };
const TAM = { ancho: 340, alto: 160, altoMax: 260 };
const R = PARAMETROS_ANCLAJE.radioCabeza;

/** ¿La burbuja se cruza con el círculo de la cabeza? */
function cubre(
  u: { x: number; y: number },
  t: { ancho: number; alto: number },
  c: { x: number; y: number },
) {
  const cx = Math.min(Math.max(c.x, u.x), u.x + t.ancho);
  const cy = Math.min(Math.max(c.y, u.y), u.y + t.alto);
  return Math.hypot(c.x - cx, c.y - cy) < R;
}

describe('ubicarBurbuja', () => {
  it('va arriba de la cabeza, centrada y con la cola apuntando a ella', () => {
    const c = { x: 640, y: 500, visible: true };
    const u = ubicarBurbuja(c, TAM, V);
    expect(u.lado).toBe('arriba');
    expect(u.y + TAM.alto).toBeLessThanOrEqual(c.y - PARAMETROS_ANCLAJE.hueco);
    expect(u.x + u.cola).toBeCloseTo(c.x, 5);
    expect(cubre(u, TAM, c)).toBe(false);
  });

  it('se mantiene dentro de la ventana con margen (cabeza cerca del borde izquierdo)', () => {
    const c = { x: 20, y: 500, visible: true };
    const u = ubicarBurbuja(c, TAM, V);
    expect(u.x).toBeGreaterThanOrEqual(PARAMETROS_ANCLAJE.margen);
    expect(u.x + TAM.ancho).toBeLessThanOrEqual(V.ancho - PARAMETROS_ANCLAJE.margen);
    expect(u.cola).toBeLessThan(TAM.ancho);
  });

  it('si no hay espacio arriba baja al costado sin cubrir la cabeza', () => {
    const c = { x: 400, y: 120, visible: true };
    const u = ubicarBurbuja(c, TAM, V);
    expect(u.lado).toBe('derecha');
    expect(cubre(u, TAM, c)).toBe(false);
    expect(u.y).toBeGreaterThanOrEqual(PARAMETROS_ANCLAJE.margen);
  });

  it('usa el costado izquierdo si a la derecha no cabe', () => {
    const c = { x: 1150, y: 100, visible: true };
    const u = ubicarBurbuja(c, TAM, V);
    expect(u.lado).toBe('izquierda');
    expect(cubre(u, TAM, c)).toBe(false);
  });

  it('en una ventana angosta sin espacio arriba va debajo, sin cubrir la cabeza', () => {
    const movil = { ancho: 390, alto: 800 };
    const tam = { ancho: 358, alto: 150, altoMax: 240 };
    const c = { x: 200, y: 110, visible: true };
    const u = ubicarBurbuja(c, tam, movil);
    expect(u.lado).toBe('abajo');
    expect(cubre(u, tam, c)).toBe(false);
    expect(u.x).toBeGreaterThanOrEqual(PARAMETROS_ANCLAJE.margen);
    expect(u.x + tam.ancho).toBeLessThanOrEqual(movil.ancho - PARAMETROS_ANCLAJE.margen);
  });

  it('decide el lado con el alto máximo: no salta al crecer el texto', () => {
    const c = { x: 640, y: 300, visible: true };
    const chico = ubicarBurbuja(c, { ...TAM, alto: 60 }, V);
    const grande = ubicarBurbuja(c, { ...TAM, alto: 260 }, V);
    expect(chico.lado).toBe(grande.lado);
  });

  it('fuera de pantalla se ancla al borde con una flecha hacia el agente', () => {
    const c = { x: 2000, y: 360, visible: true };
    const u = ubicarBurbuja(c, TAM, V);
    expect(u.lado).toBe('borde');
    expect(Math.abs(u.angulo)).toBeLessThan(0.01);
    expect(u.x + TAM.ancho).toBeLessThanOrEqual(V.ancho - PARAMETROS_ANCLAJE.margen);
    expect(u.x).toBeGreaterThan(V.ancho / 2);
  });

  it('un agente detrás de la cámara apunta al lado contrario', () => {
    const u = ubicarBurbuja({ x: 640, y: 100, visible: false }, TAM, V);
    expect(u.lado).toBe('borde');
    expect(u.angulo).toBeGreaterThan(0);
    expect(u.y).toBeGreaterThan(V.alto / 2);
  });
});

describe('ubicarBurbuja evitando rectángulos', () => {
  const c = { x: 640, y: 500, visible: true };
  // Avatar justo donde caería la burbuja de arriba (centrada sobre la cabeza).
  const avatarArriba = { x: 600, y: 300, ancho: 80, alto: 200 };

  it('sin evitar no cambia el comportamiento', () => {
    expect(ubicarBurbuja(c, TAM, V, undefined, { evitar: [] }).lado).toBe('arriba');
  });

  it('agente abajo del avatar: la burbuja pasa de arriba a un costado', () => {
    const u = ubicarBurbuja(c, TAM, V, undefined, { evitar: [avatarArriba] });
    expect(u.lado).toBe('derecha');
    expect(cubre(u, TAM, c)).toBe(false);
  });

  it('avatar lejos: sigue arriba', () => {
    const lejos = { x: 50, y: 600, ancho: 80, alto: 100 };
    expect(ubicarBurbuja(c, TAM, V, undefined, { evitar: [lejos] }).lado).toBe('arriba');
  });

  it('sin lado libre elige el de menor intersección', () => {
    // Bloquea arriba (centro) y la derecha por completo; la izquierda queda con una intersección menor.
    const bloqueo: Rect[] = [
      { x: 460, y: 200, ancho: 360, alto: 330 },
      { x: 700, y: 400, ancho: 600, alto: 200 },
      { x: 300, y: 540, ancho: 100, alto: 20 },
    ];
    const u = ubicarBurbuja(c, TAM, V, undefined, { evitar: bloqueo });
    expect(['izquierda', 'abajo']).toContain(u.lado);
    const todo = { x: 0, y: 0, ancho: V.ancho, alto: V.alto };
    expect(ubicarBurbuja(c, TAM, V, undefined, { evitar: [todo] }).lado).toBe('arriba');
  });

  it('histéresis: no alterna con ruido de ±3 px', () => {
    let lado: Lado | undefined;
    const vistos = new Set<Lado>();
    for (const dy of [0, 3, -3, 3, -3, 0, 3]) {
      const av = { ...avatarArriba, y: avatarArriba.y + 160 + dy };
      const u = ubicarBurbuja(c, TAM, V, undefined, { evitar: [av], ladoPrevio: lado });
      lado = u.lado;
      vistos.add(u.lado);
    }
    expect(vistos.size).toBe(1);
  });

  it('conserva el lado previo mientras siga libre', () => {
    const u = ubicarBurbuja(c, TAM, V, undefined, {
      evitar: [{ x: 0, y: 0, ancho: 10, alto: 10 }],
      ladoPrevio: 'derecha',
    });
    expect(u.lado).toBe('derecha');
  });
});

describe('rectAvatar', () => {
  it('une pies y cabeza con ancho proporcional, holgura y aro', () => {
    const r = rectAvatar({ x: 100, y: 300 }, { x: 100, y: 200 });
    expect(r.x).toBeCloseTo(100 - 28 - 24);
    expect(r.ancho).toBeCloseTo(2 * (28 + 24));
    expect(r.y).toBe(200 - 24);
    expect(r.y + r.alto).toBe(300 + 24 + 18);
  });
});

describe('móvil 390×844 con compositor', () => {
  const M = { ancho: 390, alto: 844 };
  const tam = { ancho: 360, alto: 200, altoMax: 284 };
  const reservaAbajo = 96;
  const cabeza = { x: 200, y: 520, visible: true };
  const avatar: Rect = { x: 140, y: 370, ancho: 110, alto: 190 };

  it('agente al pie con el avatar encima: la burbuja va al tope', () => {
    const u = ubicarBurbuja(cabeza, tam, M, undefined, { evitar: [avatar], reservaAbajo });
    expect(u.lado).toBe('tope');
    expect(u.y).toBe(PARAMETROS_ANCLAJE.margen);
    expect(u.x).toBeGreaterThanOrEqual(PARAMETROS_ANCLAJE.margen);
    expect(u.x + tam.ancho).toBeLessThanOrEqual(M.ancho - PARAMETROS_ANCLAJE.margen);
    expect(cubre(u, tam, cabeza)).toBe(false);
  });

  it('nada pasa por debajo del compositor, ni en el último recurso', () => {
    for (const y of [300, 520, 700, 800]) {
      for (const ev of [[], [avatar], [{ x: 0, y: 0, ancho: 390, alto: 844 }]]) {
        const u = ubicarBurbuja({ x: 200, y, visible: true }, tam, M, undefined, {
          evitar: ev,
          reservaAbajo,
        });
        expect(u.y + tam.alto).toBeLessThanOrEqual(M.alto - reservaAbajo);
      }
    }
  });

  it('el tope no se elige si cubriría la cabeza', () => {
    const u = ubicarBurbuja({ x: 200, y: 150, visible: true }, tam, M, undefined, {
      evitar: [{ x: 0, y: 0, ancho: 390, alto: 120 }],
      reservaAbajo,
    });
    expect(u.lado).not.toBe('tope');
  });

  it('sin reserva ni tope libre, el escritorio no cambia', () => {
    const c = { x: 640, y: 500, visible: true };
    expect(ubicarBurbuja(c, TAM, V).lado).toBe('arriba');
  });
});

describe('altoMaximoBurbuja', () => {
  it('escritorio: 46 % con tope de 340', () => {
    expect(altoMaximoBurbuja(720, 1280, 0)).toBeCloseTo(331.2);
    expect(altoMaximoBurbuja(1200, 1280, 96)).toBe(340);
  });
  it('a 560 px o menos: 38 % del alto visible sin el compositor', () => {
    expect(altoMaximoBurbuja(844, 390, 96)).toBeCloseTo(0.38 * 748);
    expect(altoMaximoBurbuja(844, 560, 96)).toBeCloseTo(0.38 * 748);
  });
});
