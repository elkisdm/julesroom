import { describe, expect, it } from 'vitest';
import { validarPizarra, respaldo, ampliar, comandoVoz, ejemplos, TIPOS } from './modelo';
import { recibirPizarra } from './mensajes';
import { ajustarTexto, componer } from './dibujo';
import { buscarColocacion } from './colocacion';

describe('pizarra: contratos puros', () => {
  it('valida los siete tipos y rechaza datos incompletos y números sin fuente', () => {
    for (const t of TIPOS) expect(validarPizarra(ejemplos(t))).not.toBeNull();
    expect(
      validarPizarra({ tipo: 'barras', titulo: 'Inventado', valores: [{ nombre: 'A', valor: 5 }] }),
    ).toBeNull();
    expect(validarPizarra({ ...ejemplos('mapa'), nodos: [] })).toBeNull();
    expect(validarPizarra({ ...ejemplos('idea'), titulo: 'x'.repeat(5000) })).toBeNull();
  });
  it('ofrece respaldo con título y tres puntos sin inventar una investigación', () => {
    const p = respaldo('Cómo se conecta una idea');
    expect(validarPizarra(p)).not.toBeNull();
    expect(p.tipo === 'idea' && p.puntos).toHaveLength(3);
  });
  it('amplía sin duplicar ni superar la cota y conserva contenido anterior', () => {
    const a = ejemplos('mapa');
    const b = {
      ...a,
      nodos: Array.from({ length: 7 }, (_, i) => ({ texto: `nuevo ${i}`, relacion: 'aporta' })),
    };
    const c = ampliar(a, b);
    expect(c.tipo === 'mapa' && c.nodos.length).toBe(7);
    expect(c.tipo === 'mapa' && c.nodos[0]?.texto).toBe(a.tipo === 'mapa' && a.nodos[0]?.texto);
    expect(ampliar(a, a)).toEqual(a);
  });
  it('reconoce solo comandos completos, normalizando signos y acentos', () => {
    expect(comandoVoz('¡Borra la pizarra!')).toBe('borrar');
    expect(comandoVoz('Siguiente.')).toBe('siguiente');
    expect(comandoVoz('vuelve')).toBe('volver');
    expect(comandoVoz('explica cómo se borra la pizarra')).toBeNull();
  });
  it('solo acepta revisiones del dueño autenticado, incluso borrar y pensando', () => {
    const foto = JSON.stringify({
      tipo: 'd8:pizarra',
      revision: 3,
      pizarra: ejemplos('idea'),
      posicion: null,
      estado: 'lista',
      texto: '',
    });
    expect(recibirPizarra(foto, 'intruso', 'dueno', 0)).toBeNull();
    expect(recibirPizarra(foto, 'dueno', '', 0)).toBeNull();
    expect(recibirPizarra(foto, 'dueno', 'dueno', 3)).toBeNull();
    expect(recibirPizarra(foto, 'dueno', 'dueno', 2)?.revision).toBe(3);
    expect(recibirPizarra(foto.replace('"lista"', '"pensando"'), 'intruso', 'dueno', 0)).toBeNull();
    expect(recibirPizarra('x'.repeat(16000), 'dueno', 'dueno', 0)).toBeNull();
  });
  it('envuelve palabras largas y ajusta cada caja de los siete tipos sin desbordar', () => {
    const medir = (s: string, px: number) => s.length * px * 0.6;
    const ajustado = ajustarTexto('superpalabra'.repeat(30), 400, 170, 56, medir);
    expect(ajustado.lineas.every((l) => medir(l, ajustado.px) <= 400)).toBe(true);
    expect(ajustado.lineas.length * ajustado.px * 1.2).toBeLessThanOrEqual(170);
    for (const t of TIPOS)
      for (const b of componer(ejemplos(t))) {
        if (!b.texto) continue;
        const a = ajustarTexto(
          b.texto + ' explicación'.repeat(15),
          b.w - 32,
          b.h - 32,
          b.px ?? 40,
          medir,
        );
        expect(a.lineas.length * a.px * 1.2).toBeLessThanOrEqual(b.h - 32);
        expect(a.lineas.every((l) => medir(l, a.px) <= b.w - 32)).toBe(true);
      }
  });
  it('coloca sobre suelo libre y rechaza muros, bordes y huecos', () => {
    const limites = { x0: -20, x1: 20, z0: -20, z1: 20 };
    const libre = buscarColocacion({ x: 0, y: 0, z: 0 }, 0, { cajas: [], limites }, () => 0);
    expect(libre?.y).toBe(0);
    expect(
      buscarColocacion({ x: 0, y: 0, z: 0 }, 0, { cajas: [limites], limites }, () => 0),
    ).toBeNull();
    expect(
      buscarColocacion({ x: 0, y: 0, z: 0 }, 0, { cajas: [], limites }, () => -Infinity),
    ).toBeNull();
  });
});

it('ampliar con escritura manual conserva el gráfico actual y añade la idea', () => {
  const actual = ejemplos('mapa');
  const nueva = respaldo('También se aprende conversando');
  const resultado = ampliar(actual, nueva);
  expect(resultado.tipo).toBe('mapa');
  expect(resultado.ejemplo).toContain('También se aprende conversando');
  expect(resultado.tipo === 'mapa' && resultado.nodos).toEqual(
    actual.tipo === 'mapa' && actual.nodos,
  );
});

it('la foto pensando cabe en el canal incluso con Unicode y una pizarra densa', async () => {
  const { serializarPizarra } = await import('./mensajes');
  const texto = serializarPizarra({
    tipo: 'd8:pizarra',
    revision: 20,
    pizarra: ejemplos('comparacion'),
    posicion: null,
    estado: 'pensando',
    texto: '🧠'.repeat(600),
  });
  expect(new TextEncoder().encode(texto).length).toBeLessThan(14500);
  expect(JSON.parse(texto).pizarra).toBeNull();
  expect(recibirPizarra(texto, 'dueno', 'dueno', 0)?.texto).toHaveLength(1200);
});
