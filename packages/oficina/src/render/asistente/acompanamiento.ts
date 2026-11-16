import { avanzarForma, crearForma, DISTANCIA_SALTO } from './maquina';
import { PARAMETROS_ASISTENTE as P } from './seguimiento';

export const crearAcompanamiento = () => ({
  forma: crearForma(),
  orbe: false,
  permanencia: Infinity,
});

interface EntradaAcompanamiento {
  distancia: number;
  velocidadUsuario: number;
  sinRuta: boolean;
  razonRuta: number;
}

/** Decide la forma sin modificar el estado físico; cada transición conserva su duración original. */
export function avanzarAcompanamiento(
  e: ReturnType<typeof crearAcompanamiento>,
  entrada: EntradaAcompanamiento,
  delta: number,
  reducido = false,
): void {
  const dt = Math.max(0, Math.min(delta, P.dtMax));
  e.permanencia += dt;
  const p = P.forma;
  if (e.permanencia >= p.permanenciaMinima) {
    const siguiente = e.orbe
      ? !(
          entrada.distancia < p.distanciaPersona &&
          entrada.velocidadUsuario <= p.velocidadRegreso &&
          !entrada.sinRuta &&
          entrada.razonRuta < p.razonRutaPersona
        )
      : entrada.distancia > p.distanciaOrbe ||
        entrada.sinRuta ||
        entrada.razonRuta > p.razonRutaOrbe;
    if (siguiente !== e.orbe) {
      e.orbe = siguiente;
      e.permanencia = 0;
    }
  }
  avanzarForma(e.forma, e.orbe ? DISTANCIA_SALTO + P.distanciaViaje : 0, dt, reducido);
}
