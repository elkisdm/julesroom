import { describe, expect, it } from 'vitest';
import { responder, opciones, PASOS, avanzarRecorrido, iniciarRecorrido } from './ayuda';
const contexto = {
  nombre: 'Ana',
  dueno: false,
  personas: [
    { nombre: 'Ana', anfitrion: false },
    { nombre: 'Luis', anfitrion: true },
  ],
  lugares: [{ id: 'centro', nombre: 'Zona central', x: 0, y: 0, z: 0 }],
};
describe('ayuda sin modelo', () => {
  it('es honesta con preguntas libres y ofrece opciones', () => {
    const r = responder('¿Cuál es la capital de Francia?', contexto);
    expect(r.texto).toContain('Todavía no puedo responder preguntas libres aquí');
    expect(r.opciones.length).toBe(4);
  });
  it('reconoce ayuda y nombres sin inventar asistentes presentes', () => {
    expect(responder('QUIÉN ESTÁ AQUÍ', contexto).detalle).toContain('Luis · anfitrión');
    expect(responder('Dime los atajos', contexto).detalle).toContain('J');
    expect(responder('Muéstrame qué puedo hacer', contexto).accion).toBe('recorrido');
    expect(responder('Llévame a…', contexto).accion).toBe('lugares');
    expect(responder('Zona central', contexto).destino?.id).toBe('centro');
  });
  it('las ayudas del dueño solo se ofrecen al dueño', () => {
    expect(opciones(false)).toHaveLength(4);
    expect(opciones(true)).toHaveLength(6);
    expect(responder('¿Cómo invito gente?', contexto).detalle).not.toContain('enlace');
    expect(responder('¿Cómo presento?', { ...contexto, dueno: true }).detalle).toContain('H');
  });
  it('cada burbuja del recorrido es breve', () => {
    for (const p of PASOS) expect(p.texto.split(/\s+/).length).toBeLessThanOrEqual(12);
  });
});
describe('recorrido', () => {
  it('no avanza por una acción ajena; movimiento, salto, asiento, reacción, pantalla', () => {
    let r = iniciarRecorrido();
    expect(avanzarRecorrido(r, 'sentado')).toEqual(r);
    for (const evento of ['correr', 'saltar', 'sentado', 'reaccion', 'pantalla'] as const)
      r = avanzarRecorrido(r, evento);
    expect(r).toBeNull();
  });
  it('cinco siguientes completan, cancelar termina y no resucita', () => {
    let r = iniciarRecorrido();
    for (let i = 0; i < 5; i++) r = avanzarRecorrido(r, 'siguiente');
    expect(r).toBeNull();
    expect(avanzarRecorrido(iniciarRecorrido(), 'cancelar')).toBeNull();
    expect(avanzarRecorrido(null, 'siguiente')).toBeNull();
  });
});

it('hola saluda con el nombre y no inicia una guía sin pedirla', () => {
  const r = responder('Hola Jules', contexto);
  expect(r.texto).toBe('Hola, Ana. Soy Jules.');
  expect(r.accion).toBeUndefined();
});
