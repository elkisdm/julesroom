import { describe, expect, it } from 'vitest';
import { EQUIPO_EJEMPLO } from './ejemplos';
import { envolverMensaje, construirSistema } from './prompt';
import { crearSimulador } from './simulador';
import { ErrorProveedor, type EventoModelo, type PeticionModelo } from './tipos';

const def = EQUIPO_EJEMPLO[2]!;
const peticion = (texto = 'dónde está la cocina', senal?: AbortSignal): PeticionModelo => ({
  modelo: def.modelo,
  maxTokens: def.maxTokens,
  sistema: construirSistema(def),
  mensajes: [{ role: 'user', content: envolverMensaje(texto, false, { via: 'cerca' }) }],
  senal,
});

async function juntar(it: AsyncIterable<EventoModelo>) {
  const eventos: EventoModelo[] = [];
  for await (const e of it) eventos.push(e);
  return eventos;
}
const textoDe = (es: EventoModelo[]) =>
  es.flatMap((e) => (e.tipo === 'texto' ? [e.texto] : [])).join('');

describe('simulador', () => {
  it('responde con el nombre del agente (leído del sistema) y cita el último mensaje', async () => {
    const eventos = await juntar(crearSimulador().transmitir(peticion()));
    const t = textoDe(eventos);
    expect(t).toContain(def.nombre);
    expect(t).toContain('dónde está la cocina');
  });

  it('emite trozos de pocas palabras y termina con fin completo', async () => {
    const eventos = await juntar(crearSimulador({ palabrasPorTrozo: 2 }).transmitir(peticion()));
    const trozos = eventos.filter((e) => e.tipo === 'texto');
    expect(trozos.length).toBeGreaterThan(2);
    for (const t of trozos) expect(t.texto.trim().split(/\s+/).length).toBeLessThanOrEqual(2);
    expect(eventos.at(-1)).toMatchObject({ tipo: 'fin', motivo: 'completo' });
  });

  it('es determinista y su uso es estable (≈ caracteres/4)', async () => {
    const a = await juntar(crearSimulador().transmitir(peticion()));
    const b = await juntar(crearSimulador().transmitir(peticion()));
    expect(a).toEqual(b);
    const fin = a.at(-1);
    expect(fin?.tipo === 'fin' && fin.uso.salida).toBe(Math.ceil(textoDe(a).length / 4));
    const p = peticion();
    const esperada = Math.ceil(
      (p.sistema.length + p.mensajes.reduce((n, m) => n + m.content.length, 0)) / 4,
    );
    expect(fin?.tipo === 'fin' && fin.uso).toMatchObject({
      entrada: esperada,
      cacheLeida: 0,
      cacheEscrita: 0,
    });
  });

  it.each(['sin-clave', 'sin-red', 'limite', 'interno'] as const)(
    'falla «%s» antes de emitir nada',
    async (falla) => {
      const emitidos: EventoModelo[] = [];
      const correr = async () => {
        for await (const e of crearSimulador({ falla }).transmitir(peticion())) emitidos.push(e);
      };
      await expect(correr()).rejects.toMatchObject({ codigo: falla });
      await expect(correr()).rejects.toBeInstanceOf(ErrorProveedor);
      expect(emitidos).toEqual([]);
    },
  );

  it('cortarEn emite n trozos y luego lanza «cortada»', async () => {
    const emitidos: EventoModelo[] = [];
    const correr = async () => {
      for await (const e of crearSimulador({ cortarEn: 2 }).transmitir(peticion()))
        emitidos.push(e);
    };
    await expect(correr()).rejects.toMatchObject({ codigo: 'cortada' });
    expect(emitidos).toHaveLength(2);
  });

  it('tope termina con motivo «tope»', async () => {
    const eventos = await juntar(crearSimulador({ tope: true }).transmitir(peticion()));
    expect(eventos.at(-1)).toMatchObject({ tipo: 'fin', motivo: 'tope' });
  });

  it('un aborto a mitad deja de emitir y lanza «cortada»', async () => {
    const ctl = new AbortController();
    const emitidos: EventoModelo[] = [];
    const correr = async () => {
      for await (const e of crearSimulador().transmitir(
        peticion('una pregunta con varias palabras para trocear', ctl.signal),
      )) {
        emitidos.push(e);
        if (emitidos.length === 1) ctl.abort();
      }
    };
    await expect(correr()).rejects.toMatchObject({ codigo: 'cortada' });
    expect(emitidos).toHaveLength(1);
  });

  it('un aborto previo lanza «cortada» sin emitir', async () => {
    const ctl = new AbortController();
    ctl.abort();
    await expect(
      juntar(crearSimulador().transmitir(peticion('hola', ctl.signal))),
    ).rejects.toMatchObject({ codigo: 'cortada' });
  });

  it('el retardo se interrumpe al abortar', async () => {
    const ctl = new AbortController();
    const t0 = Date.now();
    setTimeout(() => ctl.abort(), 20);
    await expect(
      juntar(crearSimulador({ retardoMs: 5000 }).transmitir(peticion('hola', ctl.signal))),
    ).rejects.toMatchObject({
      codigo: 'cortada',
    });
    expect(Date.now() - t0).toBeLessThan(1000);
  });
});
