import { describe, expect, it } from 'vitest';
import { crearPresentacion } from './sincronizacion';
import { PARAMETROS_PRESENTACION as P } from './protocolo';
describe('entrega fiable D3', () => {
  it('recupera un acuse perdido, entrega primero la actual al tardío y rechaza suplantación', () => {
    let reloj = 0;
    const orden: string[] = [];
    let perder = true;
    const red: { de: string; texto: string }[] = [];
    const crear = (yo: string) =>
      crearPresentacion({
        yo,
        dueno: 'dueno',
        invitado: yo !== 'dueno',
        ahora: () => reloj,
        presentes: () => ['dueno', 'uno', 'tarde'],
        enviar: async (texto) => {
          red.push({ de: yo, texto });
        },
      });
    const d = crear('dueno');
    const u = crear('uno');
    const clientes = [d, u];
    const bombear = (veces: number) => {
      for (let i = 0; i < veces; i++) {
        reloj += P.envioCadaMs;
        clientes.forEach((c) => c.tick());
        while (red.length) {
          const m = red.shift()!;
          if (JSON.parse(m.texto).tipo === 'd3/acuse' && perder) {
            perder = false;
            continue;
          }
          for (const c of clientes) c.recibir(m.texto, m.de);
        }
      }
    };
    const laminas = Array.from({ length: 12 }, (_, i) => ({
      id: `i${i}`,
      tipo: 'imagen' as const,
      nombre: `${i}`,
    }));
    const imagenes = new Map(
      laminas.map((l) => [l.id, 'data:image/jpeg;base64,/9j/' + 'A'.repeat(20000)]),
    );
    d.publicar({ laminas, actual: 5 }, imagenes);
    bombear(400);
    expect(u.ver().imagenes.size).toBe(12);
    const tarde = crear('tarde');
    clientes.push(tarde);
    tarde.suscribir(() => {
      const ids = [...tarde.ver().imagenes.keys()];
      if (ids.length && !orden.includes(ids.at(-1)!)) orden.push(ids.at(-1)!);
    });
    bombear(600);
    expect(orden[0]).toBe('i5');
    expect(tarde.ver().imagenes.size).toBe(12);
    const antes = tarde.ver().estado;
    tarde.recibir(JSON.stringify({ ...antes, revision: 99999, actual: 0 }), 'uno');
    expect(tarde.ver().estado).toBe(antes);
    d.publicar({ actual: 6 });
    bombear(1);
    expect(tarde.ver().estado.actual).toBe(6);
    expect(() => tarde.publicar({ actual: 1 })).toThrow();
  });
  it('reintenta hasta el límite si no recibe ningún acuse', () => {
    let reloj = 0;
    let trozos = 0;
    const d = crearPresentacion({
      yo: 'd',
      dueno: 'd',
      invitado: false,
      ahora: () => reloj,
      presentes: () => ['u'],
      enviar: async (s) => {
        if (JSON.parse(s).tipo === 'd3/trozo') trozos++;
      },
    });
    d.publicar(
      { laminas: [{ id: 'foto', tipo: 'imagen', nombre: 'foto' }] },
      new Map([['foto', 'data:image/jpeg;base64,/9j/AAAA']]),
    );
    d.recibir(JSON.stringify({ tipo: 'd3/pedir', id: 'foto' }), 'u');
    for (let i = 0; i < 200; i++) {
      reloj += P.envioCadaMs;
      d.tick();
    }
    expect(trozos).toBe(P.intentos);
    expect(d.ver().error).toMatch(/confirmar/);
  });
  it('difunde los mismos trozos para veinte personas sin multiplicar la carga del dueño', () => {
    let reloj = 0;
    let trozos = 0;
    const red: { de: string; texto: string }[] = [];
    const ids = Array.from({ length: 20 }, (_, i) => `persona-${i}`);
    const clientes = ids.map((yo) =>
      crearPresentacion({
        yo,
        dueno: ids[0]!,
        invitado: yo !== ids[0],
        presentes: () => ids,
        ahora: () => reloj,
        enviar: async (texto) => {
          if (yo === ids[0] && JSON.parse(texto).tipo === 'd3/trozo') trozos++;
          red.push({ de: yo, texto });
        },
      }),
    );
    clientes[0]!.publicar(
      { laminas: [{ id: 'foto', tipo: 'imagen', nombre: 'Foto' }] },
      new Map([['foto', 'data:image/jpeg;base64,/9j/' + 'A'.repeat(20000)]]),
    );
    for (let i = 0; i < 150; i++) {
      reloj += P.envioCadaMs;
      clientes.forEach((c) => c.tick());
      while (red.length) {
        const m = red.shift()!;
        clientes.forEach((c) => c.recibir(m.texto, m.de));
      }
    }
    expect(clientes.every((c) => c.ver().imagenes.size === 1)).toBe(true);
    expect(trozos).toBe(3);
  });
});
