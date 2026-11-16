import { describe, expect, it } from 'vitest';
import { azarSecuencia, azarSemilla } from '../test-utils';
import type { EstadoAgente } from '../tipos';
import {
  avanzarInteracciones,
  crearCoordinador,
  DISTANCIA_CONVERSACION,
  PASO_EVALUACION,
} from './interacciones';
import type { Coordinador } from './interacciones';

interface Datos {
  sala?: number;
  estado?: EstadoAgente;
  sentado?: boolean;
  enPausa?: boolean;
  llego?: boolean;
  disponible?: boolean;
  x?: number;
  z?: number;
}

function poner(c: Coordinador, i: number, d: Datos): void {
  const v = c.vistas[i];
  if (!v) throw new Error(`sin vista ${i}`);
  v.sala = d.sala ?? 0;
  v.estado = d.estado ?? 'libre';
  v.sentado = d.sentado ?? false;
  v.enPausa = d.enPausa ?? false;
  v.llego = d.llego ?? false;
  v.disponible = d.disponible ?? true;
  v.x = d.x ?? 0;
  v.z = d.z ?? 0;
}

const paso = (c: Coordinador, n: number, t: number, azar = azarSecuencia(0.5), permitido = true) =>
  avanzarInteracciones(c, n, t, azar, permitido);

const tipo = (c: Coordinador, i: number) => c.interacciones[i]?.tipo;

describe('conversaciones en el café', () => {
  /** Dos libres en pausa, cerca, en la misma sala. */
  function dosEnElCafe(): Coordinador {
    const c = crearCoordinador(3, 1, 0, azarSecuencia(0));
    poner(c, 0, { enPausa: true, x: 0, z: 0 });
    poner(c, 1, { enPausa: true, x: 0.5, z: 0.2 });
    poner(c, 2, { sentado: true, estado: 'trabajando', x: 3, z: -3 });
    return c;
  }

  it('dos libres que coinciden en la pausa del café conversan', () => {
    const c = dosEnElCafe();
    paso(c, 3, 1);
    expect(tipo(c, 0)).toBe('conversa');
    expect(tipo(c, 1)).toBe('conversa');
    expect(c.interacciones[0]?.socio).toBe(1);
    expect(c.interacciones[1]?.socio).toBe(0);
    expect(tipo(c, 2)).toBe('ninguna');
  });

  it('dura entre 4 y 9 s y se alternan los turnos (uno habla primero, el otro escucha)', () => {
    for (const [azar, duracion] of [
      [azarSecuencia(0), 4],
      [azarSecuencia(0.9999), 9],
    ] as const) {
      const c = dosEnElCafe();
      paso(c, 3, 1, azar);
      const a = c.interacciones[0];
      expect((a?.fin ?? 0) - (a?.inicio ?? 0)).toBeCloseTo(duracion, 1);
    }
    const c = dosEnElCafe();
    paso(c, 3, 1);
    expect(c.interacciones[0]?.primerTurno).not.toBe(c.interacciones[1]?.primerTurno);
  });

  it('se paran a ~1,1 m uno del otro, mirándose, alrededor del punto medio', () => {
    const c = dosEnElCafe();
    paso(c, 3, 1);
    const a = c.interacciones[0];
    const b = c.interacciones[1];
    expect(Math.hypot((a?.x ?? 0) - (b?.x ?? 0), (a?.z ?? 0) - (b?.z ?? 0))).toBeCloseTo(1.1, 6);
    expect(((a?.x ?? 0) + (b?.x ?? 0)) / 2).toBeCloseTo(0.25, 6);
    expect(((a?.z ?? 0) + (b?.z ?? 0)) / 2).toBeCloseTo(0.1, 6);
  });

  it('al cumplirse el tiempo se separan', () => {
    const c = dosEnElCafe();
    paso(c, 3, 1, azarSecuencia(0)); // fin a los 5 s
    paso(c, 3, 4.9);
    expect(tipo(c, 0)).toBe('conversa');
    paso(c, 3, 5.2);
    expect(tipo(c, 0)).toBe('ninguna');
    expect(tipo(c, 1)).toBe('ninguna');
  });

  it('si uno deja la pausa, la conversación termina para los dos', () => {
    const c = dosEnElCafe();
    paso(c, 3, 1);
    poner(c, 1, { enPausa: false, x: 0.5, z: 0.2 });
    paso(c, 3, 2);
    expect(tipo(c, 0)).toBe('ninguna');
    expect(tipo(c, 1)).toBe('ninguna');
  });

  it('nunca más de una conversación por persona: el tercero queda libre', () => {
    const c = crearCoordinador(3, 1, 0, azarSecuencia(0));
    for (const i of [0, 1, 2]) poner(c, i, { enPausa: true, x: i * 0.3 });
    paso(c, 3, 1);
    const conversando = [0, 1, 2].filter((i) => tipo(c, i) === 'conversa');
    expect(conversando).toHaveLength(2);
    const [a, b] = conversando;
    expect(c.interacciones[a ?? 0]?.socio).toBe(b);
  });

  it('no conversan si están lejos, en otra sala o alguno no está libre', () => {
    const lejos = crearCoordinador(2, 2, 0, azarSecuencia(0));
    poner(lejos, 0, { enPausa: true, x: 0 });
    poner(lejos, 1, { enPausa: true, x: DISTANCIA_CONVERSACION + 0.5 });
    paso(lejos, 2, 1);
    expect(tipo(lejos, 0)).toBe('ninguna');

    const otraSala = crearCoordinador(2, 2, 0, azarSecuencia(0));
    poner(otraSala, 0, { enPausa: true, sala: 0 });
    poner(otraSala, 1, { enPausa: true, sala: 1 });
    paso(otraSala, 2, 1);
    expect(tipo(otraSala, 0)).toBe('ninguna');

    const ocupado = crearCoordinador(2, 1, 0, azarSecuencia(0));
    poner(ocupado, 0, { enPausa: true });
    poner(ocupado, 1, { enPausa: true, estado: 'esperando_decision' });
    paso(ocupado, 2, 1);
    expect(tipo(ocupado, 0)).toBe('ninguna');
  });
});

describe('visitas al escritorio', () => {
  /** Índice 0: libre sentado (visitante). 1 y 2: trabajando sentados. Misma sala. */
  function sala(): Coordinador {
    const c = crearCoordinador(3, 1, 0, azarSecuencia(0)); // primera visita permitida desde t=20
    poner(c, 0, { sentado: true });
    poner(c, 1, { sentado: true, estado: 'trabajando' });
    poner(c, 2, { sentado: true, estado: 'trabajando' });
    return c;
  }

  it('no hay visita antes de la espera inicial', () => {
    const c = sala();
    paso(c, 3, 10);
    expect(tipo(c, 0)).toBe('ninguna');
  });

  it('un libre visita a un colega que trabaja en su sala; el colega pasa a recibir', () => {
    const c = sala();
    paso(c, 3, 21);
    expect(tipo(c, 0)).toBe('visita');
    expect(c.interacciones[0]?.fase).toBe('ir');
    const colega = c.interacciones[0]?.socio ?? -1;
    expect([1, 2]).toContain(colega);
    expect(tipo(c, colega)).toBe('recibe');
    expect(c.interacciones[colega]?.socio).toBe(0);
  });

  it('al llegar muestra durante 4–7 s, vuelve y termina al sentarse', () => {
    const c = sala();
    paso(c, 3, 21, azarSecuencia(0)); // muestra 4 s
    poner(c, 0, { llego: true });
    paso(c, 3, 22, azarSecuencia(0));
    expect(c.interacciones[0]?.fase).toBe('mostrar');
    expect((c.interacciones[0]?.fin ?? 0) - 22).toBeCloseTo(4, 1);
    paso(c, 3, 25.5);
    expect(c.interacciones[0]?.fase).toBe('mostrar');
    paso(c, 3, 26.5);
    expect(c.interacciones[0]?.fase).toBe('volver');
    expect(tipo(c, 1)).toBe('ninguna');
    expect(tipo(c, 2)).toBe('ninguna');
    poner(c, 0, { sentado: true });
    paso(c, 3, 27);
    expect(tipo(c, 0)).toBe('ninguna');
  });

  it('máximo una visita por sala y 20–40 s de espera entre visitas', () => {
    const c = crearCoordinador(4, 1, 0, azarSecuencia(0));
    poner(c, 0, { sentado: true });
    poner(c, 1, { sentado: true });
    poner(c, 2, { sentado: true, estado: 'trabajando' });
    poner(c, 3, { sentado: true, estado: 'trabajando' });
    paso(c, 4, 21, azarSecuencia(0));
    const visitantes = [0, 1].filter((i) => tipo(c, i) === 'visita');
    expect(visitantes).toHaveLength(1);
    // termina la visita
    const v = visitantes[0] ?? 0;
    poner(c, v, { llego: true });
    paso(c, 4, 22, azarSecuencia(0));
    paso(c, 4, 27, azarSecuencia(0));
    poner(c, v, { sentado: true, llego: false });
    paso(c, 4, 28, azarSecuencia(0)); // la espera sale 20 s (azar 0)
    expect([0, 1, 2, 3].every((i) => tipo(c, i) === 'ninguna')).toBe(true);
    paso(c, 4, 40);
    expect([0, 1].some((i) => tipo(c, i) === 'visita')).toBe(false);
    paso(c, 4, 48.5);
    expect([0, 1].filter((i) => tipo(c, i) === 'visita')).toHaveLength(1);
    // la espera nunca pasa de 40 s
    const d = crearCoordinador(4, 1, 0, azarSecuencia(0.9999));
    expect(d.visitaDesde[0]).toBeLessThanOrEqual(40);
  });

  it('salas distintas pueden tener su visita a la vez', () => {
    const c = crearCoordinador(4, 2, 0, azarSecuencia(0));
    poner(c, 0, { sala: 0, sentado: true });
    poner(c, 1, { sala: 0, sentado: true, estado: 'trabajando' });
    poner(c, 2, { sala: 1, sentado: true });
    poner(c, 3, { sala: 1, sentado: true, estado: 'trabajando' });
    paso(c, 4, 21);
    expect(tipo(c, 0)).toBe('visita');
    expect(tipo(c, 2)).toBe('visita');
  });

  it('no visita si el colega está en otra sala, no trabaja o el visitante está de paseo', () => {
    const c = crearCoordinador(3, 2, 0, azarSecuencia(0));
    poner(c, 0, { sala: 0, sentado: true });
    poner(c, 1, { sala: 1, sentado: true, estado: 'trabajando' });
    poner(c, 2, { sala: 0, sentado: true, estado: 'esperando_decision' });
    paso(c, 3, 21);
    expect(tipo(c, 0)).toBe('ninguna');
    poner(c, 2, { sala: 0, sentado: true, estado: 'trabajando' });
    poner(c, 0, { sala: 0, sentado: false });
    paso(c, 3, 22);
    expect(tipo(c, 0)).toBe('ninguna');
  });

  it('si el visitante deja de estar libre, vuelve a su sitio y el colega queda libre', () => {
    const c = sala();
    paso(c, 3, 21);
    poner(c, 0, { estado: 'trabajando' });
    paso(c, 3, 22);
    expect(c.interacciones[0]?.fase).toBe('volver');
    expect(tipo(c, 1)).toBe('ninguna');
    expect(tipo(c, 2)).toBe('ninguna');
  });

  it('si el colega deja de trabajar, la visita se corta', () => {
    const c = sala();
    paso(c, 3, 21);
    const colega = c.interacciones[0]?.socio ?? 1;
    poner(c, colega, { sentado: true, estado: 'libre' });
    paso(c, 3, 22);
    expect(c.interacciones[0]?.fase).toBe('volver');
    expect(tipo(c, colega)).toBe('ninguna');
  });
});

describe('coordinador', () => {
  it('evalúa a baja frecuencia: entre dos pasos no hace nada', () => {
    const c = crearCoordinador(2, 1, 0, azarSecuencia(0));
    poner(c, 0, { enPausa: true });
    poner(c, 1, { enPausa: true });
    paso(c, 2, 1);
    expect(c.proximaEvaluacion).toBeCloseTo(1 + PASO_EVALUACION, 6);
    poner(c, 0, { enPausa: false });
    paso(c, 2, 1.1); // aún no toca evaluar: no ve el cambio
    expect(tipo(c, 0)).toBe('conversa');
    paso(c, 2, 1.3);
    expect(tipo(c, 0)).toBe('ninguna');
  });

  it('sin permiso (prefers-reduced-motion) cancela todo y no inicia nada', () => {
    const c = crearCoordinador(2, 1, 0, azarSecuencia(0));
    poner(c, 0, { enPausa: true });
    poner(c, 1, { enPausa: true });
    paso(c, 2, 1);
    expect(tipo(c, 0)).toBe('conversa');
    paso(c, 2, 2, azarSecuencia(0.5), false);
    expect([0, 1].every((i) => tipo(c, i) === 'ninguna')).toBe(true);
    paso(c, 2, 3, azarSecuencia(0.5), false);
    expect(tipo(c, 0)).toBe('ninguna');
  });

  it('no crea objetos al evaluar: reutiliza los de cada persona', () => {
    const c = crearCoordinador(3, 1, 0, azarSemilla(1));
    const antes = [...c.interacciones];
    const vistas = [...c.vistas];
    poner(c, 0, { enPausa: true });
    poner(c, 1, { enPausa: true });
    for (let t = 1; t < 60; t += 0.3) paso(c, 3, t, azarSemilla(2));
    expect(c.interacciones.every((x, i) => x === antes[i])).toBe(true);
    expect(c.vistas.every((x, i) => x === vistas[i])).toBe(true);
  });
});

describe('atención al enfocado', () => {
  it('si uno deja de estar disponible, la conversación en curso termina', () => {
    const c = crearCoordinador(2, 1, 0, azarSecuencia(0));
    poner(c, 0, { enPausa: true, x: 0, z: 0 });
    poner(c, 1, { enPausa: true, x: 0.5, z: 0 });
    paso(c, 2, 1);
    expect(tipo(c, 0)).toBe('conversa');
    poner(c, 1, { enPausa: true, x: 0.5, z: 0, disponible: false });
    paso(c, 2, 1.5);
    expect(tipo(c, 0)).toBe('ninguna');
    expect(tipo(c, 1)).toBe('ninguna');
  });
});
