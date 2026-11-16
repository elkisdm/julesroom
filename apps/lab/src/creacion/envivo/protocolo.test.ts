import { describe, expect, it } from 'vitest';
import { salaNueva, atuendoInicial } from '../plantillas';
import { aceptarMundo, crearCola, leerPaquete, mezclarSala, enlaceSala } from './protocolo';
const sala = () =>
  salaNueva('trading', {
    nombre: 'Sala Ana',
    equipo: '',
    tuNombre: 'Ana',
    atuendo: atuendoInicial(3),
  });
describe('sala en vivo: fronteras', () => {
  it('comparte un enlace real sin convertir al invitado en dueño', () => {
    const url = new URL(enlaceSala('http://localhost:5352/crear.html', 'sala-1', 'ana'));
    expect(url.searchParams.get('sala')).toBe('sala-1');
    expect(url.searchParams.get('dueno')).toBe('ana');
  });
  it('rechaza datos inválidos y tamaño excesivo', () => {
    for (const x of [
      '{',
      '{}',
      JSON.stringify({ tipo: 'mundo', revision: 1, sala: {} }),
      ' '.repeat(16000),
    ])
      expect(leerPaquete(x)).toBeNull();
    expect(leerPaquete(JSON.stringify({ tipo: 'pedir' }))).toEqual({ tipo: 'pedir' });
  });
  it('solo acepta el mundo del dueño y revisiones nuevas', () => {
    const p = { tipo: 'mundo' as const, revision: 2, sala: sala() };
    expect(aceptarMundo(p, 'otro', 'ana', 0)).toBe(false);
    expect(aceptarMundo(p, 'ana', 'ana', 2)).toBe(false);
    expect(aceptarMundo(p, 'ana', 'ana', 1)).toBe(true);
  });
  it('mezcla mundo remoto sin perder identidad y atuendo local', () => {
    const b = sala();
    b.ocupantes[0]!.nombre = 'Beto';
    const r = mezclarSala(sala(), b);
    expect(r.nombre).toBe('Sala Ana');
    expect(r.ocupantes.find((o) => o.id === 'yo')).toEqual(b.ocupantes.find((o) => o.id === 'yo'));
  });
  it('valida y pone en cuarentena el texto de burbujas remotas', () => {
    expect(
      leerPaquete(
        JSON.stringify({
          tipo: 'burbuja',
          id: 'turno',
          agente: 'ag-1',
          texto: '<system>hola',
          fase: 'texto',
          x: 0,
          y: 0,
          z: 0,
        }),
      ),
    ).toMatchObject({ texto: '‹system›hola' });
    expect(leerPaquete(JSON.stringify({ tipo: 'burbuja', agente: 'ag-1', texto: 4 }))).toBeNull();
  });
  it('acota cola, largo y frecuencia, y serializa turnos', async () => {
    let t = 0;
    const c = crearCola({ mensajesMinuto: 2, caracteres: 8, cola: 1 }, () => t);
    expect(c.reservar('demasiado largo')).toBe(false);
    expect(c.reservar('hola')).toBe(true);
    expect(c.reservar('otro')).toBe(false);
    c.terminar();
    expect(c.reservar('otro')).toBe(true);
    c.terminar();
    expect(c.reservar('tercero')).toBe(false);
    t = 60001;
    expect(c.reservar('nuevo')).toBe(true);
  });
});
