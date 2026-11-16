import { describe, expect, it } from 'vitest';
import { avanzarAcompanamiento, crearAcompanamiento } from './acompanamiento';
import { PARAMETROS_ASISTENTE as P } from './seguimiento';

const dt = 1 / 60;
const entrada = () => ({
  distancia: P.distancia,
  velocidadUsuario: 2.3,
  sinRuta: false,
  razonRuta: 1,
});
describe('forma de compañía', () => {
  it('camina como persona sin alternar durante un recorrido normal', () => {
    const e = crearAcompanamiento();
    for (let i = 0; i < 1800; i++) {
      avanzarAcompanamiento(e, { ...entrada(), distancia: 2 + Math.sin(i * dt) }, dt);
      expect(e.forma.forma).toBe(1);
    }
  });
  it.each(['distancia', 'sinRuta', 'razonRuta'] as const)(
    'sale por %s y regresa cerca sin correr',
    (motivo) => {
      const e = crearAcompanamiento();
      const datos = entrada();
      if (motivo === 'distancia') datos.distancia = P.forma.distanciaOrbe + 1;
      if (motivo === 'sinRuta') datos.sinRuta = true;
      if (motivo === 'razonRuta') datos.razonRuta = P.forma.razonRutaOrbe + 1;
      for (let i = 0; i < 120; i++) avanzarAcompanamiento(e, datos, dt);
      expect(e.forma.forma).toBe(0);
      for (let i = 0; i < 120; i++)
        avanzarAcompanamiento(e, { ...entrada(), velocidadUsuario: 4.8 }, dt);
      expect(e.forma.forma).toBe(0);
      for (let i = 0; i < 180; i++) avanzarAcompanamiento(e, entrada(), dt);
      expect(e.forma.forma).toBe(1);
    },
  );
  it('respeta la permanencia mínima aunque la ruta fluctúe', () => {
    const e = crearAcompanamiento();
    let ultimo = -Infinity;
    let previo = e.orbe;
    for (let i = 0; i < 1200; i++) {
      avanzarAcompanamiento(e, { ...entrada(), sinRuta: Math.floor(i / 20) % 2 === 0 }, dt);
      if (e.orbe !== previo) {
        expect(i * dt - ultimo).toBeGreaterThanOrEqual(P.forma.permanenciaMinima - dt);
        ultimo = i * dt;
        previo = e.orbe;
      }
    }
  });
});
