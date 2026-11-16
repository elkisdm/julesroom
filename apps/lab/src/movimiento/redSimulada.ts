import type { FuentePresencia, FuenteSimulada, PersonaPresente } from '@oficina/motor';

/** Cómo se comporta el canal de datos simulado (valores iniciales parametrizables). */
export interface ParametrosRedSimulada {
  /** Actualizaciones por segundo que envía cada persona (LiveKit: ~10). */
  hz: number;
  /** Retraso de llegada (ms). */
  retardoMs: number;
  /** Variación aleatoria del retraso, ± ms (puede desordenar la llegada). */
  jitterMs: number;
  /** Fracción de paquetes que se pierden (0..1). */
  perdida: number;
  semilla: number;
}

export const RED_LIVEKIT: ParametrosRedSimulada = {
  hz: 10,
  retardoMs: 120,
  jitterMs: 40,
  perdida: 0.1,
  semilla: 1,
};

export interface RedSimulada extends FuentePresencia {
  parametros: ParametrosRedSimulada;
  /** Avanza el reloj de la red `dt` segundos; entrega lo que ya «llegó». */
  avanzar(dt: number): void;
}

interface Paquete {
  llegada: number;
  indice: number;
  x: number;
  y: number;
  z: number;
  rumbo: number;
  estado: PersonaPresente['estado'];
  asiento: PersonaPresente['asiento'];
}

function mulberry32(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Envuelve una fuente de presencia «verdadera» y la hace llegar como lo haría la red: muestras a
 * `hz`, con retraso, jitter y pérdida; las posiciones solo cambian cuando llega un paquete (en
 * sitio, como exige el contrato de `FuentePresencia`). Sirve para comprobar que el movimiento de
 * los remotos se ve fluido aun con datos escasos.
 */
export function crearRedSimulada(
  base: FuenteSimulada,
  parametros: ParametrosRedSimulada = RED_LIVEKIT,
): RedSimulada {
  const azar = mulberry32(parametros.semilla);
  const p = { ...parametros };
  let reloj = 0;
  let proximoEnvio = 0;
  let copias: PersonaPresente[] = [];
  let pendientes: Paquete[] = [];
  const oyentes = new Set<() => void>();

  const reconstruir = () => {
    copias = base.personas().map((q) => ({ ...q }));
    pendientes = [];
  };
  reconstruir();
  base.suscribir(() => {
    reconstruir();
    oyentes.forEach((f) => f());
  });

  return {
    parametros: p,
    personas: () => copias,
    suscribir(alCambiar) {
      oyentes.add(alCambiar);
      return () => void oyentes.delete(alCambiar);
    },
    avanzar(dt) {
      reloj += dt;
      const origen = base.personas();
      while (reloj >= proximoEnvio) {
        for (let i = 0; i < origen.length; i++) {
          if (azar() < p.perdida) continue;
          const q = origen[i]!;
          const jitter = (azar() * 2 - 1) * p.jitterMs;
          pendientes.push({
            llegada: reloj + Math.max(0, p.retardoMs + jitter) / 1000,
            indice: i,
            x: q.x,
            y: q.y,
            z: q.z,
            rumbo: q.rumbo,
            estado: q.estado,
            asiento: q.asiento,
          });
        }
        proximoEnvio += 1 / Math.max(0.1, p.hz);
      }
      if (pendientes.length === 0) return;
      pendientes.sort((a, b) => a.llegada - b.llegada);
      let usados = 0;
      for (const paquete of pendientes) {
        if (paquete.llegada > reloj) break;
        const destino = copias[paquete.indice];
        if (destino) {
          destino.x = paquete.x;
          destino.y = paquete.y;
          destino.z = paquete.z;
          destino.rumbo = paquete.rumbo;
          destino.estado = paquete.estado;
          destino.asiento = paquete.asiento;
        }
        usados++;
      }
      if (usados > 0) pendientes = pendientes.slice(usados);
    },
  };
}
