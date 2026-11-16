import { afterEach, expect, it, vi } from 'vitest';
import { iniciarDictado } from './dictado';
afterEach(() => vi.unstubAllGlobals());
it('dicta es-CL, muestra parciales y entrega una sola frase al soltar', () => {
  class Voz {
    lang = '';
    interimResults = false;
    continuous = false;
    onresult: ((e: { results: { 0: { transcript: string }; isFinal: boolean }[] }) => void) | null =
      null;
    onend: (() => void) | null = null;
    onerror = null;
    start() {
      instancias.push(this);
    }
    stop() {
      this.onend?.();
    }
    abort() {
      this.onend?.();
    }
  }
  const instancias: Voz[] = [];
  vi.stubGlobal('window', { webkitSpeechRecognition: Voz });
  const parcial = vi.fn(),
    final = vi.fn();
  const sesion = iniciarDictado(parcial, final, vi.fn());
  const voz = instancias[0]!;
  expect(voz.lang).toBe('es-CL');
  expect(voz.interimResults).toBe(true);
  voz.onresult?.({
    results: [
      { 0: { transcript: 'Una idea' }, isFinal: true },
      { 0: { transcript: 'conecta con otra' }, isFinal: false },
    ],
  });
  expect(parcial).toHaveBeenCalledWith('Una idea conecta con otra');
  sesion?.parar();
  expect(final).toHaveBeenCalledExactlyOnceWith('Una idea conecta con otra');
});
it('navegador sin voz deja un error útil y nunca pide permisos', () => {
  vi.stubGlobal('window', {});
  const error = vi.fn();
  expect(iniciarDictado(vi.fn(), vi.fn(), error)).toBeNull();
  expect(error).toHaveBeenCalledWith(expect.stringContaining('Escribe'));
});
it('cancelar no envía contenido parcial', () => {
  class Voz {
    lang = '';
    interimResults = false;
    continuous = false;
    onresult = null;
    onerror = null;
    onend: (() => void) | null = null;
    start() {}
    stop() {}
    abort() {
      this.onend?.();
    }
  }
  vi.stubGlobal('window', { SpeechRecognition: Voz });
  const final = vi.fn();
  iniciarDictado(vi.fn(), final, vi.fn())?.cancelar();
  expect(final).toHaveBeenCalledExactlyOnceWith('');
});
