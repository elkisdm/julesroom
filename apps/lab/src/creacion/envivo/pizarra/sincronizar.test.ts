import { afterEach, expect, it, vi } from 'vitest';
import { sincronizarPizarra, type CanalPizarra } from './sincronizar';
import { ejemplos } from './modelo';
import type { FotoPizarra } from './mensajes';
afterEach(() => vi.useRealTimers());
it('veinte participantes reciben solo al dueño y quien entra tarde recupera la pizarra', async () => {
  vi.useFakeTimers();
  const suscriptores = new Map<string, (texto: string, id: string) => void>();
  const canal = (id: string): CanalPizarra => ({
    personas: () => [...suscriptores.keys()].map((id) => ({ id })),
    suscribirDatos: (f) => {
      suscriptores.set(id, f);
      return () => {
        suscriptores.delete(id);
      };
    },
    enviarDatos: async (texto) => {
      for (const f of suscriptores.values()) f(texto, id);
    },
  });
  const foto: FotoPizarra = {
    tipo: 'd8:pizarra',
    revision: 20,
    estado: 'lista',
    pizarra: ejemplos('mapa'),
    posicion: { x: 0, y: 0, z: 0, giro: 0 },
    texto: '',
  };
  const fotos = Array.from(
    { length: 20 },
    () => ({ ...foto, revision: 0, pizarra: null }) as FotoPizarra,
  );
  const salir = [
    sincronizarPizarra(
      canal('dueno'),
      'dueno',
      true,
      () => foto,
      () => {},
      () => {},
    ),
  ];
  for (let i = 0; i < 20; i++)
    salir.push(
      sincronizarPizarra(
        canal(`invitado-${i}`),
        'dueno',
        false,
        () => fotos[i]!,
        (f) => {
          fotos[i] = f;
        },
        () => {},
      ),
    );
  expect(fotos.every((f) => f.pizarra?.tipo === 'mapa' && f.revision === 20)).toBe(true);
  await canal('invitado-0').enviarDatos(JSON.stringify({ ...foto, revision: 999, pizarra: null }));
  expect(fotos.every((f) => f.revision === 20)).toBe(true);
  foto.revision = 21;
  foto.pizarra = ejemplos('capas');
  await vi.advanceTimersByTimeAsync(5000);
  expect(fotos.every((f) => f.pizarra?.tipo === 'capas' && f.revision === 21)).toBe(true);
  salir.forEach((f) => f());
  expect(suscriptores.size).toBe(0);
  expect(vi.getTimerCount()).toBe(0);
});
