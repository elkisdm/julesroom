/**
 * El mundo recorrible de la sala de trading (un nivel): el piso, la tarima del aula (0,25 m: se sube
 * caminando), el graderío (dos plataformas de 0,3 y 0,6 m: se sube grada a grada) con sus butacas como
 * sólidos (las del dibujo, `render/escenarios/trading/Mobiliario.tsx`), los muebles que `sePisa`
 * (sofá, sillones, mesas y escritorios bajos, pufs: a más de un paso, solo saltando) y el resto de los muebles
 * y los muros como sólidos. El frente abierto queda fuera de los límites (bloquea).
 */
import { superficiesDeMuebles } from '../suelo';
import type { DatosSuelo, Solido, Superficie } from '../tipos';
import { AULA, planta, SALA } from './plano';

/** Media huella de una butaca del aula (asiento, brazos y respaldo) y su alto sobre la grada. */
const BUTACA = { medioAncho: 0.385, delante: 0.3, detras: 0.35, alto: 0.9 } as const;
/** Fondo (m) de cada grada y cuánto se corre hacia la cámara respecto de su fila (como en el dibujo). */
const GRADA = { fondo: 1.6, corrimiento: 0.1 } as const;

function crearSueloTrading(): DatosSuelo {
  const superficies: Superficie[] = [
    {
      id: 'piso',
      tipo: 'losa',
      forma: 'caja',
      x0: SALA.x0,
      x1: SALA.x1,
      z0: SALA.z0,
      z1: SALA.z1,
      y: 0,
      grosor: 0.3,
    },
  ];
  const solidos: Solido[] = planta.muros.map((m) => {
    const h = 0.1;
    return {
      id: m.id,
      tipo: 'muro',
      ...(m.eje === 'x'
        ? { x0: m.pos - h, x1: m.pos + h, z0: m.desde, z1: m.hasta }
        : { x0: m.desde, x1: m.hasta, z0: m.pos - h, z1: m.pos + h }),
      y0: 0,
      y1: SALA.alto,
    };
  });

  // El graderío no es una caja: dos gradas que se pisan y las butacas encima.
  const muebles = superficiesDeMuebles(
    planta.muebles.filter((m) => m.tipo !== 'gradas'),
    () => 0,
  );
  superficies.push(...muebles.superficies);
  solidos.push(...muebles.solidos);
  for (const f of AULA.filas.slice(1)) {
    const z = f.z + GRADA.corrimiento;
    superficies.push({
      id: `grada-${f.z}`,
      tipo: 'tarima',
      forma: 'caja',
      x0: AULA.gradas.x0,
      x1: AULA.gradas.x1,
      z0: z - GRADA.fondo / 2,
      z1: z + GRADA.fondo / 2,
      y: f.y,
      grosor: f.y,
    });
  }
  for (const f of AULA.filas) {
    for (const x of AULA.butacasX) {
      solidos.push({
        id: `butaca-${f.z}-${x}`,
        tipo: 'mueble',
        x0: x - BUTACA.medioAncho,
        x1: x + BUTACA.medioAncho,
        z0: f.z - BUTACA.delante,
        z1: f.z + BUTACA.detras,
        y0: f.y,
        y1: f.y + BUTACA.alto,
      });
    }
  }
  return {
    superficies,
    solidos,
    limites: { x0: SALA.x0, x1: SALA.x1, z0: SALA.z0, z1: SALA.z1 },
  };
}

/** El suelo de la sala de trading (se arma una vez al importar; son datos). */
export const sueloTrading: DatosSuelo = crearSueloTrading();
