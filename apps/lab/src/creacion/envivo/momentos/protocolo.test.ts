import { describe, expect, it } from 'vitest';
import { leerPaquete } from '../protocolo';
import { crearReceptorMomentos, crearMomento, segundosRestantes } from './protocolo';

describe('momentos D5', () => {
  it('los clientes existentes ignoran todos los mensajes D5', () => {
    for (const accion of [
      'foto',
      'temporizador',
      'celebrar',
      'atencion',
      'apagar',
      'bienvenida',
    ] as const)
      expect(leerPaquete(JSON.stringify(crearMomento(accion, 10_000)))).toBeNull();
  });
  const ahora = 10_000;
  it('sincroniza veinte participantes por fecha, sin ticks de red', () => {
    const mensaje = crearMomento('temporizador', ahora, { minutos: 3, texto: 'Receso' });
    const clientes = Array.from({ length: 20 }, () => crearReceptorMomentos('dueno'));
    for (const cliente of clientes) {
      expect(cliente(JSON.stringify(mensaje), 'dueno', ahora)).toEqual(mensaje);
      expect(segundosRestantes(mensaje.fin, ahora + 31_000)).toBe(149);
    }
  });
  it('rechaza invitados, dueño vacío, desconocidos, JSON inválido y paquetes enormes', () => {
    const texto = JSON.stringify(crearMomento('foto', ahora));
    expect(crearReceptorMomentos('dueno')(texto, 'invitado', ahora)).toBeNull();
    expect(crearReceptorMomentos('')(texto, '', ahora)).toBeNull();
    for (const dato of ['{', '{}', 'x'.repeat(3000), JSON.stringify({ tipo: 'mundo' })])
      expect(crearReceptorMomentos('dueno')(dato, 'dueno', ahora)).toBeNull();
  });
  it('acota textos, minutos, fechas y rechaza repetición y ráfagas por efecto', () => {
    const recibir = crearReceptorMomentos('dueno');
    const mensaje = crearMomento('bienvenida', ahora, { texto: 'Hola' });
    expect(recibir(JSON.stringify(mensaje), 'dueno', ahora)).toEqual(mensaje);
    expect(recibir(JSON.stringify(mensaje), 'dueno', ahora)).toBeNull();
    expect(
      recibir(
        JSON.stringify({ ...mensaje, inicio: ahora + 1, fin: mensaje.fin + 1 }),
        'dueno',
        ahora + 1,
      ),
    ).toBeNull();
    expect(() => crearMomento('bienvenida', ahora, { texto: 'x'.repeat(81) })).toThrow();
    expect(() => crearMomento('temporizador', ahora, { minutos: 0 })).toThrow();
    expect(() => crearMomento('temporizador', ahora, { minutos: 61 })).toThrow();
    expect(
      crearReceptorMomentos('dueno')(JSON.stringify({ ...mensaje, fin: Infinity }), 'dueno', ahora),
    ).toBeNull();
    expect(
      crearReceptorMomentos('dueno')(JSON.stringify(mensaje), 'dueno', ahora + 100_000),
    ).toBeNull();
  });
  it('atención se puede apagar inmediatamente; el apagado nunca queda bloqueado por cuota', () => {
    const recibir = crearReceptorMomentos('dueno');
    expect(recibir(JSON.stringify(crearMomento('atencion', ahora)), 'dueno', ahora)).not.toBeNull();
    expect(
      recibir(JSON.stringify(crearMomento('apagar', ahora + 1)), 'dueno', ahora + 1),
    ).not.toBeNull();
  });
  it('programa la foto a tres segundos y el cartel dura seis segundos', () => {
    expect(crearMomento('foto', ahora).fin).toBe(ahora + 3000);
    expect(crearMomento('bienvenida', ahora, { texto: 'Hola' }).fin).toBe(ahora + 6000);
    expect(segundosRestantes(ahora, ahora + 1)).toBe(0);
  });
});
