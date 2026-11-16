/**
 * Sin los servicios locales (como hoy en producción), la sala no consulta /vivo ni /api: se queda
 * individual, «Invitar» no ofrece un enlace que no funciona y los agentes responden con el simulador
 * local, sin pedir nada a la red.
 */
import { describe, expect, it } from 'vitest';
import { avisoInvitar, respuestaLocal, salaEnVivo } from './sinServidor';

describe('sala individual sin configuración', () => {
  it('el modo de desarrollo requiere activación explícita', () => {
    expect(salaEnVivo({ DEV: true, VITE_SALA_EN_VIVO: '1' })).toBe(true);
    expect(salaEnVivo({})).toBe(false);
    expect(salaEnVivo({ VITE_SALA_EN_VIVO: '0' })).toBe(false);
  });

  it('sin servicios, «Invitar» no promete un enlace', () => {
    expect(avisoInvitar(true)).toBeNull();
    const aviso = avisoInvitar(false);
    expect(aviso).toBeTruthy();
    expect(aviso).not.toMatch(/enlace|otro navegador/i);
  });

  it('sin servicios, el agente responde con el simulador local, en streaming y sin red', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (() => {
      throw new Error('no debe haber red');
    }) as typeof fetch;
    try {
      const eventos = [];
      for await (const e of respuestaLocal({ nombre: 'Nova', rol: 'Analista de mercado' }, 'hola'))
        eventos.push(e);
      const texto = eventos
        .filter((e) => e.tipo === 'texto')
        .map((e) => (e.tipo === 'texto' ? e.texto : ''))
        .join('');
      expect(eventos.filter((e) => e.tipo === 'texto').length).toBeGreaterThan(1);
      expect(texto).toContain('Nova');
      expect(texto).toContain('hola');
      expect(eventos.at(-1)?.tipo).toBe('fin');
    } finally {
      globalThis.fetch = original;
    }
  });
});
