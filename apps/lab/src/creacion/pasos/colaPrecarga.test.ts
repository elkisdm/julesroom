import { describe, expect, it, vi } from 'vitest';
import { crearColaPrecarga } from './colaPrecarga';

function banco() {
  const turnos: (() => void)[] = [];
  const pendientes: {
    clave: string;
    signal: AbortSignal;
    resolver: (imagen: string) => void;
    rechazar: (error: Error) => void;
  }[] = [];
  const cambiar = vi.fn();
  const cola = crearColaPrecarga({
    programar: (tarea) => {
      turnos.push(tarea);
      return () => {
        const i = turnos.indexOf(tarea);
        if (i >= 0) turnos.splice(i, 1);
      };
    },
    preparar: (clave, signal) =>
      new Promise<string>((resolver, rechazar) =>
        pendientes.push({ clave, signal, resolver, rechazar }),
      ),
    cambiar,
  });
  const turno = () => turnos.shift()?.();
  const terminar = async (imagen = 'foto') => {
    pendientes.at(-1)!.resolver(imagen);
    await Promise.resolve();
    await Promise.resolve();
  };
  return { cola, turno, terminar, pendientes, turnos, cambiar };
}

describe('cola de precalentado', () => {
  it('prepara la elegida primero y luego un vecino por turno, sin cambiar la elección', async () => {
    const b = banco();
    b.cola.elegir('a', ['b', 'c'], true);
    expect(b.pendientes).toHaveLength(0);
    b.turno();
    expect(b.pendientes[0]?.clave).toBe('a');
    await b.terminar();
    expect(b.cambiar).toHaveBeenLastCalledWith('a', 'lista', 'foto');
    expect(b.pendientes).toHaveLength(1);
    b.turno();
    expect(b.pendientes[1]?.clave).toBe('b');
    await b.terminar();
    b.turno();
    expect(b.pendientes[2]?.clave).toBe('c');
  });
  it('una selección ya preparada reutiliza la caché sin preparar ni capturar otra vez', async () => {
    const b = banco();
    b.cola.elegir('a', [], true);
    b.turno();
    await b.terminar();
    b.cola.elegir('a', [], true);
    b.turno();
    expect(b.pendientes).toHaveLength(1);
  });
  it('tres gestos antes del turno solo construyen la última sala', () => {
    const b = banco();
    b.cola.elegir('a', [], true);
    b.cola.elegir('b', [], true);
    b.cola.elegir('c', [], true);
    b.turno();
    expect(b.pendientes.map((p) => p.clave)).toEqual(['c']);
  });
  it('aborta lo intermedio y descarta una resolución tardía sin contaminar la caché', async () => {
    const b = banco();
    b.cola.elegir('a', [], true);
    b.turno();
    const vieja = b.pendientes[0]!;
    b.cola.elegir('b', [], true);
    expect(vieja.signal.aborted).toBe(true);
    vieja.resolver('vieja');
    await Promise.resolve();
    await Promise.resolve();
    expect(b.cambiar).not.toHaveBeenCalled();
    b.turno();
    expect(b.pendientes[1]?.clave).toBe('b');
  });
  it('el error se informa y permite preparar el vecino; no reintenta en bucle', async () => {
    const b = banco();
    b.cola.elegir('a', ['b'], true);
    b.turno();
    b.pendientes[0]!.rechazar(new Error('GPU'));
    await Promise.resolve();
    await Promise.resolve();
    expect(b.cambiar).toHaveBeenCalledWith('a', 'error', '', expect.any(Error));
    expect(b.pendientes[0]!.signal.aborted).toBe(true);
    b.turno();
    expect(b.pendientes[1]?.clave).toBe('b');
  });
  it('al salir cancela vecinos, conserva solo la elegida y la otra se reconstruye al volver', async () => {
    const b = banco();
    b.cola.elegir('a', ['b'], true);
    b.turno();
    await b.terminar();
    b.turno();
    await b.terminar();
    b.cola.elegir('a', [], false);
    b.turno();
    expect(b.pendientes).toHaveLength(2);
    b.cola.elegir('b', [], true);
    b.turno();
    expect(b.pendientes).toHaveLength(3);
    b.cola.cancelar();
    expect(b.pendientes[2]!.signal.aborted).toBe(true);
    expect(b.turnos).toHaveLength(0);
  });
});

it('promueve el vecino que ya se está preparando sin abortar ni repetirlo', async () => {
  const b = banco();
  b.cola.elegir('a', ['b', 'c'], true);
  b.turno();
  await b.terminar();
  b.turno();
  const vecino = b.pendientes[1]!;
  b.cola.elegir('b', ['a', 'c'], true);
  expect(vecino.signal.aborted).toBe(false);
  b.turno();
  expect(b.pendientes).toHaveLength(2);
  await b.terminar();
  expect(b.cambiar).toHaveBeenLastCalledWith('b', 'lista', 'foto');
  b.turno();
  expect(b.pendientes[2]?.clave).toBe('c');
});
it('un fallo se reintenta al volver explícitamente, sin guardarlo como caché lista', async () => {
  const b = banco();
  b.cola.elegir('a', [], true);
  b.turno();
  b.pendientes[0]!.rechazar(new Error('GPU'));
  await Promise.resolve();
  await Promise.resolve();
  b.cola.elegir('a', [], true);
  b.turno();
  expect(b.pendientes).toHaveLength(2);
});

it('distingue la selección urgente del vecino que debe dejar pintar la llegada', async () => {
  const turnos: (() => void)[] = [];
  const programar = vi.fn((tarea: () => void, fondo: boolean) => {
    expect(typeof fondo).toBe('boolean');
    turnos.push(tarea);
    return () => {};
  });
  const cola = crearColaPrecarga({ programar, preparar: async () => 'foto', cambiar: () => {} });
  cola.elegir('a', ['b'], true);
  expect(programar).toHaveBeenLastCalledWith(expect.any(Function), false);
  turnos.shift()?.();
  await Promise.resolve();
  await Promise.resolve();
  expect(programar).toHaveBeenLastCalledWith(expect.any(Function), true);
  cola.cancelar();
});
