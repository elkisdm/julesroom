import { describe, expect, it } from 'vitest';
import { AUTORES, mensajePropio, mensajesIniciales, mensajesTotales, siguienteMensaje } from './chat';
import type { ChatId } from './chat';

const CHATS = Object.keys(AUTORES) as ChatId[];
const AHORA = new Date(2026, 10, 14, 10, 30);
const PROHIBIDAS = /compr|vend[eé]|garantiz|rentabilidad|gananc|seguro que/i;

describe('guion del chat', () => {
  it('cada conversación trae mensajes y los autores son personas de esa conversación', () => {
    for (const chat of CHATS) {
      const total = mensajesTotales(chat);
      expect(total, chat).toBeGreaterThanOrEqual(6);
      for (let i = 0; i < total; i++)
        expect(AUTORES[chat], chat).toContain(siguienteMensaje(chat, i, AHORA)!.autor);
    }
  });
  it('no promete rentabilidad ni da órdenes de compra o venta', () => {
    for (const chat of CHATS)
      for (let i = 0; i < mensajesTotales(chat); i++)
        expect(siguienteMensaje(chat, i, AHORA)!.texto).not.toMatch(PROHIBIDAS);
  });
});

describe('mensajes iniciales y siguientes', () => {
  it('parte con tres mensajes en orden de hora, en 24 h', () => {
    const m = mensajesIniciales('muro', AHORA);
    expect(m).toHaveLength(3);
    expect(m.map((x) => x.hora)).toEqual(['10:24', '10:26', '10:28']);
  });
  it('el siguiente continúa desde el índice y se acaba al final del guion', () => {
    const total = mensajesTotales('cripto');
    expect(siguienteMensaje('cripto', 3, AHORA)?.id).toBe('cripto-3');
    expect(siguienteMensaje('cripto', total, AHORA)).toBeNull();
  });
});

describe('mensaje propio', () => {
  it('aparece como tuyo, con la hora, sin espacios sobrantes', () => {
    const m = mensajePropio('  Hola a todos  ', AHORA, 'p1')!;
    expect(m).toMatchObject({ autor: 'Tú', texto: 'Hola a todos', hora: '10:30', propio: true });
  });
  it('un texto vacío no se envía y uno largo se recorta', () => {
    expect(mensajePropio('   ', AHORA, 'p2')).toBeNull();
    expect(mensajePropio('a'.repeat(500), AHORA, 'p3')!.texto).toHaveLength(280);
  });
});
