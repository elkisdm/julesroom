import { describe, expect, it } from 'vitest';
import { pasoInvitado, personajeRapido } from './entradaInvitada';
import { salaNueva, atuendoInicial } from '../plantillas';
describe('camino del invitado', () => {
  it('solo permite nombre, personaje y dentro', () => {
    expect(pasoInvitado('sala')).toBe('nombre');
    expect(pasoInvitado('llegada')).toBe('nombre');
    expect(pasoInvitado('agentes')).toBe('dentro');
    expect(pasoInvitado('invitar')).toBe('dentro');
    expect(pasoInvitado('personaje')).toBe('personaje');
  });
  it('Entrar ya cambia solo el atuendo propio con el catálogo existente', () => {
    const sala = salaNueva('trading', {
      nombre: 'Equipo',
      equipo: '',
      tuNombre: 'Ana',
      atuendo: atuendoInicial(3),
    });
    const rapida = personajeRapido(sala, 123);
    expect(rapida.nombre).toBe('Equipo');
    expect(rapida.mundo).toEqual(sala.mundo);
    expect(rapida.ocupantes[0]?.nombre).toBe('Ana');
    expect(rapida.ocupantes[0]?.atuendo).not.toEqual(sala.ocupantes[0]?.atuendo);
    expect(rapida.ocupantes.slice(1)).toEqual(sala.ocupantes.slice(1));
  });
});
