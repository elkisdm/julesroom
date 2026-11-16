import { afterEach, describe, expect, it, vi } from 'vitest';
import { RoomEvent } from 'livekit-client';
import { crearFuenteLiveKit, type FuenteLiveKit } from './fuenteLiveKit';
import { codificar } from './codec';
const simuladas = vi.hoisted(() => ({
  salas: [] as Array<{
    eventos: Map<string, (...args: unknown[]) => void>;
    localParticipant: { publishData: ReturnType<typeof vi.fn>; audioLevel: number };
  }>,
}));
vi.mock('livekit-client', async (original) => {
  const real = await original<typeof import('livekit-client')>();
  return {
    ...real,
    Room: class {
      state = 'disconnected';
      remoteParticipants = new Map();
      eventos = new Map<string, (...args: unknown[]) => void>();
      localParticipant = {
        publishData: vi.fn().mockResolvedValue(undefined),
        setMetadata: vi.fn().mockResolvedValue(undefined),
        setMicrophoneEnabled: vi.fn().mockResolvedValue(undefined),
        audioLevel: 0.5,
      };
      constructor() {
        simuladas.salas.push(this);
      }
      on(evento: string, f: (...args: unknown[]) => void) {
        this.eventos.set(evento, f);
        return this;
      }
      async connect() {
        this.state = 'connected';
      }
      async disconnect() {
        this.state = 'disconnected';
      }
    },
  };
});
const atuendo = {
  skin: '#ffffff',
  face: 'feliz',
  hair: 'corto',
  hairColor: '#ffffff',
  top: 'camisa',
  topColor: '#ffffff',
  print: '',
  bottom: 'jeans',
  bottomColor: '#ffffff',
  shoes: '#ffffff',
  acc: [],
};
const fuentes: FuenteLiveKit[] = [];
async function montar() {
  const f = crearFuenteLiveKit({
    url: 'ws://localhost:7880',
    obtenerToken: async () => 'local',
    yo: { id: 'ana', nombre: 'Ana', atuendo, escenario: 'sala' },
  });
  fuentes.push(f);
  await f.conectar();
  return { f, room: simuladas.salas.at(-1)! };
}
afterEach(async () => {
  for (const f of fuentes.splice(0)) await f.desconectar();
  vi.unstubAllGlobals();
});
describe('fuente: posiciones y datos fiables comparten conexión', () => {
  it('sin conectar se comporta como fuente individual; luego enruta datos sin confundir posiciones', async () => {
    const { f, room } = await montar();
    expect(f.personas()).toEqual([]);
    const recibir = vi.fn();
    const salir = f.suscribirDatos(recibir);
    room.eventos.get(RoomEvent.DataReceived)!(
      new TextEncoder().encode('{"tipo":"pedir"}'),
      { identity: 'beto' },
      undefined,
      'sala',
    );
    expect(recibir).toHaveBeenCalledWith('{"tipo":"pedir"}', 'beto');
    expect(f.personas()).toEqual([]);
    await f.enviarDatos('hola');
    expect(room.localParticipant.publishData).toHaveBeenCalledWith(expect.any(Uint8Array), {
      reliable: true,
      topic: 'sala',
    });
    await expect(f.enviarDatos('x'.repeat(16000))).rejects.toThrow();
    salir();
  });
  it('valida perfiles y replica postura y saltos por el canal existente', async () => {
    const { f, room } = await montar();
    const p = {
      identity: 'beto',
      metadata: JSON.stringify({ n: 'Beto', a: atuendo, e: 'sala', s: 'silla' }),
    };
    const bytes = codificar({ seq: 1, x: 1, y: 0, z: 2, rumbo: 1, saltos: 2, sentado: true });
    room.eventos.get(RoomEvent.DataReceived)!(bytes, p, undefined, 'pos');
    expect(f.personas()[0]).toMatchObject({
      nombre: 'Beto',
      estado: 'sentado',
      saltos: 2,
      asiento: 'silla',
    });
    room.eventos.get(RoomEvent.ParticipantDisconnected)!(p);
    expect(f.personas()).toEqual([]);
  });
  it('expone nivel sin otra captura y retira el audio aunque LiveKit ya lo haya desanclado', async () => {
    const { f, room } = await montar();
    expect(f.nivelPropio()).toBe(0);
    await f.activarMicrofono();
    expect(f.nivelPropio()).toBe(0.5);
    await f.silenciarPropio(true);
    expect(f.nivelPropio()).toBe(0);
    const el = { dataset: {} as Record<string, string>, style: {}, remove: vi.fn() };
    vi.stubGlobal('document', { body: { appendChild: vi.fn() }, removeEventListener: vi.fn() });
    const pista = { kind: 'audio', attach: () => el, detach: () => [] };
    room.eventos.get(RoomEvent.TrackSubscribed)!(pista, {}, { identity: 'beto' });
    room.eventos.get(RoomEvent.TrackUnsubscribed)!(pista, {}, { identity: 'beto' });
    expect(el.remove).toHaveBeenCalled();
  });
});
