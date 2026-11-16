import { describe, expect, it } from 'vitest';
import {
  enCurso,
  estadoInicial,
  historialDe,
  idAleatorio,
  reducir,
  ultimoIntercambio,
} from './estadoConversacion';
import type { Accion, EstadoConversacion } from './estadoConversacion';

const correr = (acciones: Accion[], desde: EstadoConversacion = estadoInicial) =>
  acciones.reduce(reducir, desde);

const abrirA = (id = 'analista', via: 'cerca' | 'mencion' = 'cerca', idNuevo = 'id-1'): Accion => ({
  tipo: 'abrir',
  agenteId: id,
  via,
  idNuevo,
});
const USO = { entrada: 100, salida: 20, cacheLeida: 80 };

describe('idAleatorio', () => {
  it('genera 16 caracteres alfanuméricos', () => {
    expect(idAleatorio()).toMatch(/^[a-z0-9]{16}$/);
  });
});

describe('abrir y cerrar', () => {
  it('abre en fase abierta con id de conversación', () => {
    const e = correr([abrirA()]);
    expect(e).toMatchObject({ fase: 'abierta', agenteId: 'analista', via: 'cerca' });
    expect(e.conversaciones.analista).toBe('id-1');
  });

  it('el id de conversación es estable por agente: no se regenera al reabrir', () => {
    const e = correr([abrirA(), { tipo: 'cerrar' }, abrirA('analista', 'cerca', 'id-2')]);
    expect(e.conversaciones.analista).toBe('id-1');
    const otro = correr([abrirA('disenadora', 'cerca', 'id-3')], e);
    expect(otro.conversaciones).toEqual({ analista: 'id-1', disenadora: 'id-3' });
  });

  it('cerrar vuelve a cerrada y conserva el historial', () => {
    const e = correr([
      abrirA(),
      { tipo: 'enviar', texto: 'hola', ahora: 0 },
      { tipo: 'llegoTexto', trozo: 'Hola', ahora: 10 },
      { tipo: 'llegoFin', uso: USO, ahora: 20 },
      { tipo: 'cerrar' },
    ]);
    expect(e.fase).toBe('cerrada');
    expect(e.agenteId).toBeNull();
    expect(historialDe(e, 'analista')).toEqual([{ usuario: 'hola', respuesta: 'Hola' }]);
  });

  it('reabrir el mismo agente ya abierto conserva la vía original', () => {
    const e = correr([abrirA('analista', 'mencion'), abrirA('analista', 'cerca')]);
    expect(e.via).toBe('mencion');
  });

  it('cerrar con un turno en curso lo marca cortado', () => {
    const e = correr([
      abrirA(),
      { tipo: 'enviar', texto: 'hola', ahora: 0 },
      { tipo: 'llegoTexto', trozo: 'Ho', ahora: 5 },
      { tipo: 'cerrar' },
    ]);
    expect(historialDe(e, 'analista')[0]).toEqual({
      usuario: 'hola',
      respuesta: 'Ho',
      cortada: true,
    });
  });
});

describe('turno de conversación', () => {
  it('recorre abierta → pensando → respondiendo → abierta y mide tiempos y tokens', () => {
    let e = correr([abrirA(), { tipo: 'escribir', texto: 'cuánto' }]);
    expect(e.borrador).toBe('cuánto');
    e = reducir(e, { tipo: 'enviar', texto: '  cuánto vale  ', ahora: 1000 });
    expect(e.fase).toBe('pensando');
    expect(e.borrador).toBe('');
    expect(enCurso(e)).toBe(true);
    e = reducir(e, { tipo: 'llegoTexto', trozo: 'Vale ', ahora: 1450 });
    expect(e.fase).toBe('respondiendo');
    expect(e.tPrimeraPalabra).toBe(450);
    e = reducir(e, { tipo: 'llegoTexto', trozo: 'diez.', ahora: 1500 });
    expect(e.tPrimeraPalabra).toBe(450);
    e = reducir(e, { tipo: 'llegoFin', uso: USO, ahora: 1800 });
    expect(e).toMatchObject({ fase: 'abierta', tTotal: 800, tokens: USO });
    expect(ultimoIntercambio(e)).toEqual({ usuario: 'cuánto vale', respuesta: 'Vale diez.' });
  });

  it('ignora un envío vacío', () => {
    const e = correr([abrirA()]);
    expect(reducir(e, { tipo: 'enviar', texto: '   ', ahora: 0 })).toBe(e);
  });

  it('ignora eventos que llegan sin turno en curso (p. ej. tras cerrar)', () => {
    const e = correr([abrirA(), { tipo: 'cerrar' }]);
    expect(reducir(e, { tipo: 'llegoTexto', trozo: 'x', ahora: 1 })).toBe(e);
    expect(reducir(e, { tipo: 'llegoFin', uso: USO, ahora: 1 })).toBe(e);
  });

  it('guarda solo el último intercambio y 2 previos', () => {
    let e = correr([abrirA()]);
    for (const t of ['uno', 'dos', 'tres', 'cuatro']) {
      e = correr(
        [
          { tipo: 'enviar', texto: t, ahora: 0 },
          { tipo: 'llegoTexto', trozo: `r-${t}`, ahora: 1 },
          { tipo: 'llegoFin', uso: USO, ahora: 2 },
        ],
        e,
      );
    }
    expect(historialDe(e, 'analista').map((i) => i.usuario)).toEqual(['dos', 'tres', 'cuatro']);
  });

  it('un nuevo enviar mientras responde deja cortado el anterior', () => {
    const e = correr([
      abrirA(),
      { tipo: 'enviar', texto: 'a', ahora: 0 },
      { tipo: 'llegoTexto', trozo: 'parcial', ahora: 1 },
      { tipo: 'enviar', texto: 'b', ahora: 2 },
    ]);
    expect(e.fase).toBe('pensando');
    expect(historialDe(e, 'analista')).toEqual([
      { usuario: 'a', respuesta: 'parcial', cortada: true },
      { usuario: 'b', respuesta: '' },
    ]);
  });

  it('el historial es por agente', () => {
    const e = correr([
      abrirA('analista'),
      { tipo: 'enviar', texto: 'a', ahora: 0 },
      { tipo: 'llegoFin', uso: USO, ahora: 1 },
      abrirA('disenadora', 'mencion', 'id-9'),
    ]);
    expect(ultimoIntercambio(e)).toBeNull();
    expect(historialDe(e, 'analista')).toHaveLength(1);
  });
});

describe('historialDe', () => {
  it('devuelve el mismo arreglo vacío cada vez (estable para el almacén)', () => {
    expect(historialDe(estadoInicial, 'x')).toBe(historialDe(estadoInicial, 'y'));
  });
});

describe('borrador y detener', () => {
  it('se puede escribir con la conversación cerrada y cerrar no borra lo escrito', () => {
    const e = correr([{ tipo: 'escribir', texto: '@Dato ho' }, abrirA(), { tipo: 'cerrar' }]);
    expect(e.borrador).toBe('@Dato ho');
  });

  it('detener corta el turno en curso, conserva lo recibido y deja la conversación abierta', () => {
    const e = correr([
      abrirA(),
      { tipo: 'enviar', texto: 'hola', ahora: 0 },
      { tipo: 'llegoTexto', trozo: 'Ho', ahora: 5 },
      { tipo: 'detener', ahora: 50 },
    ]);
    expect(e).toMatchObject({ fase: 'abierta', tTotal: 50 });
    expect(ultimoIntercambio(e)).toEqual({ usuario: 'hola', respuesta: 'Ho', cortada: true });
    expect(reducir(e, { tipo: 'detener', ahora: 60 })).toBe(e);
  });
});

describe('errores', () => {
  const error = (codigo: 'sin-red' | 'cortada', mensaje = 'Frase digna.'): Accion => ({
    tipo: 'llegoError',
    evento: { tipo: 'error', codigo, mensaje },
    ahora: 500,
  });

  it('un error deja la frase como respuesta del turno y pasa a fase error', () => {
    const e = correr([abrirA(), { tipo: 'enviar', texto: 'hola', ahora: 0 }, error('sin-red')]);
    expect(e.fase).toBe('error');
    expect(ultimoIntercambio(e)?.error).toEqual({ codigo: 'sin-red', mensaje: 'Frase digna.' });
    expect(ultimoIntercambio(e)?.cortada).toBeUndefined();
  });

  it('cortada conserva lo recibido y lo marca', () => {
    const e = correr([
      abrirA(),
      { tipo: 'enviar', texto: 'hola', ahora: 0 },
      { tipo: 'llegoTexto', trozo: 'Empecé a', ahora: 10 },
      error('cortada'),
    ]);
    expect(ultimoIntercambio(e)).toMatchObject({ respuesta: 'Empecé a', cortada: true });
  });

  it('reintentar reenvía lo último sin duplicar el intercambio', () => {
    const e = correr([
      abrirA(),
      { tipo: 'enviar', texto: 'hola', ahora: 0 },
      error('sin-red'),
      { tipo: 'reintentar', ahora: 900 },
    ]);
    expect(e.fase).toBe('pensando');
    expect(historialDe(e, 'analista')).toEqual([{ usuario: 'hola', respuesta: '' }]);
    expect(e.tEnvio).toBe(900);
  });

  it('reintentar fuera de la fase error no hace nada', () => {
    const e = correr([abrirA()]);
    expect(reducir(e, { tipo: 'reintentar', ahora: 1 })).toBe(e);
  });
});
