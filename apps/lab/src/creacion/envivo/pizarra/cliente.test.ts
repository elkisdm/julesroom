import { afterEach, expect, it, vi } from 'vitest';
import { comandoPuente, explicar, salud } from './cliente';
import { ejemplos } from './modelo';
afterEach(() => vi.unstubAllGlobals());
it('ofrece el comando exacto para el origen local o publicado', () => {
  expect(comandoPuente('http://127.0.0.1:5381')).toBe('pnpm --filter @oficina/lab pizarra');
  expect(comandoPuente('https://demo.example')).toBe(
    "PIZARRA_ORIGEN='https://demo.example' pnpm --filter @oficina/lab pizarra",
  );
});
it('el código va en cabecera, nunca en URL, y valida lo recibido', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ pizarra: ejemplos('idea'), latenciaMs: 25 })));
  vi.stubGlobal('fetch', fetch);
  expect((await explicar('codigo', 'Una idea', 'explicar')).pizarra.tipo).toBe('idea');
  expect(fetch.mock.calls[0]?.[0]).toBe('http://127.0.0.1:5390/pizarra');
  expect(fetch.mock.calls[0]?.[1].headers['X-Pizarra-Codigo']).toBe('codigo');
  fetch.mockResolvedValue(new Response(JSON.stringify({ pizarra: {} })));
  await expect(explicar('codigo', 'Una idea', 'explicar')).rejects.toThrow('incompleta');
});
it('muestra los errores de autorización del puente y de generación', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response('', { status: 401 }));
  vi.stubGlobal('fetch', fetch);
  await expect(salud('mal')).rejects.toThrow('código');
  fetch.mockResolvedValue(
    new Response(JSON.stringify({ error: 'Tiempo agotado' }), { status: 504 }),
  );
  await expect(explicar('codigo', 'Una idea', 'explicar')).rejects.toThrow('Tiempo agotado');
});
