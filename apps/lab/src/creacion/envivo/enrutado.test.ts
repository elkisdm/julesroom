import { describe, it, expect } from 'vitest';
import { crearEnrutador } from './enrutado';
import { salaNueva, atuendoInicial } from '../plantillas';
const sala = salaNueva('trading', {
  nombre: 'Sala',
  equipo: '',
  tuNombre: 'Ana',
  atuendo: atuendoInicial(3),
});
describe('enrutado fiable', () => {
  it('entrega una burbuja de un presente, descarta agentes ajenos y retrocesos de turno', () => {
    const r = crearEnrutador();
    const b = {
      tipo: 'burbuja',
      id: 'turno',
      agente: 'ag-1',
      fase: 'texto',
      texto: 'Hola',
      x: 0,
      y: 0,
      z: 0,
    };
    expect(r.recibir(JSON.stringify(b), 'b', sala, ['b'])).toMatchObject({ texto: 'Hola' });
    expect(r.recibir(JSON.stringify({ ...b, fase: 'pensando' }), 'b', sala, ['b'])).toBeNull();
    expect(r.recibir(JSON.stringify({ ...b, agente: 'externo' }), 'b', sala, ['b'])).toBeNull();
    expect(r.recibir(JSON.stringify(b), 'extraño', sala, ['b'])).toBeNull();
  });
  it('limita paquetes de cada emisor sin bloquear a los demás', () => {
    const r = crearEnrutador({ paquetesSegundo: 1 }, () => 1);
    expect(r.recibir('{"tipo":"pedir"}', 'b', sala, ['b'])).toEqual({ tipo: 'pedir' });
    expect(r.recibir('{"tipo":"pedir"}', 'b', sala, ['b'])).toBeNull();
    expect(r.recibir('{"tipo":"pedir"}', 'c', sala, ['b', 'c'])).not.toBeNull();
  });
});
