import { describe, expect, it } from 'vitest';
import { agregar, aMensajesModelo, crearMemoria } from './memoria';
import type { Memoria, Mensaje } from './tipos';

const u = (t: string): Mensaje => ({
  rol: 'usuario',
  texto: `<mensaje_usuario>${t}</mensaje_usuario>`,
});
const a = (t: string): Mensaje => ({ rol: 'agente', texto: t });

function llenar(n: number, max: number): Memoria {
  let m = crearMemoria();
  for (let i = 0; i < n; i++)
    m = agregar(m, i % 2 === 0 ? u(`pregunta ${i}`) : a(`respuesta ${i}`), max);
  return m;
}

describe('memoria', () => {
  it('nace vacía', () => {
    expect(crearMemoria()).toEqual({ resumen: '', mensajes: [] });
  });

  it('guarda completos los mensajes mientras no pasen del máximo', () => {
    const m = llenar(4, 4);
    expect(m.mensajes).toHaveLength(4);
    expect(m.resumen).toBe('');
  });

  it('mueve los más viejos al resumen y no muta la memoria anterior', () => {
    const m0 = llenar(4, 4);
    const m1 = agregar(m0, u('quinta'), 4);
    expect(m0.mensajes).toHaveLength(4);
    expect(m1.mensajes).toHaveLength(4);
    expect(m1.mensajes.at(-1)?.texto).toContain('quinta');
    expect(m1.resumen).toContain('te preguntaron "pregunta 0"');
  });

  it('es determinista', () => {
    expect(llenar(20, 4)).toEqual(llenar(20, 4));
  });

  it('acota el resumen aunque desborde varias veces', () => {
    const config = { maxCaracteresResumen: 200, maxCaracteresFragmento: 30 };
    let m = crearMemoria();
    for (let i = 0; i < 200; i++) {
      m = agregar(
        m,
        i % 2 === 0
          ? u(`pregunta número ${i} bastante larga ${'x'.repeat(100)}`)
          : a(`respuesta ${i} ${'y'.repeat(100)}`),
        4,
        config,
      );
    }
    expect(m.resumen.length).toBeLessThanOrEqual(200);
    expect(m.mensajes).toHaveLength(4);
    expect(m.resumen).toContain('respuesta 195');
    expect(m.resumen).not.toContain('pregunta número 0 ');
  });

  it('recorta cada fragmento del resumen y aplana saltos de línea', () => {
    const m = agregar(agregar(crearMemoria(), a('uno\ndos\n' + 'z'.repeat(500)), 1), u('x'), 1);
    expect(m.resumen).toContain('respondiste "uno dos');
    expect(m.resumen).toContain('…');
    expect(m.resumen.split('\n').every((l) => l.length < 150)).toBe(true);
  });
});

describe('aMensajesModelo', () => {
  it('traduce roles y alterna user/assistant', () => {
    const r = aMensajesModelo(llenar(3, 8));
    expect(r.map((x) => x.role)).toEqual(['user', 'assistant', 'user']);
    expect(r[1]?.content).toBe('respuesta 1');
  });

  it('une turnos consecutivos del mismo rol (p. ej. tras una respuesta fallida)', () => {
    let m = crearMemoria();
    m = agregar(m, u('uno'), 8);
    m = agregar(m, u('dos'), 8);
    const r = aMensajesModelo(m);
    expect(r).toHaveLength(1);
    expect(r[0]?.content).toContain('uno');
    expect(r[0]?.content).toContain('dos');
  });

  it('empieza siempre con user aunque la ventana empiece con una respuesta', () => {
    const m = llenar(7, 4); // ventana: respuesta 3, pregunta 4, respuesta 5, pregunta 6
    expect(m.mensajes[0]?.rol).toBe('agente');
    const r = aMensajesModelo(m);
    expect(r[0]?.role).toBe('user');
    for (let i = 1; i < r.length; i++) expect(r[i]?.role).not.toBe(r[i - 1]?.role);
    expect(r[0]?.content).toContain('respuesta 3');
  });

  it('pone el resumen como contexto en el primer turno de usuario, fuera de la etiqueta de datos', () => {
    const m = llenar(7, 4);
    const r = aMensajesModelo(m);
    const primero = r[0]?.content ?? '';
    const idx = primero.indexOf('<mensaje_usuario>');
    expect(primero.slice(0, idx)).toContain('pregunta 0');
    expect(primero.slice(idx)).not.toContain('pregunta 0');
  });

  it('devuelve vacío si no hay turnos de usuario', () => {
    expect(aMensajesModelo(crearMemoria())).toEqual([]);
  });
});
