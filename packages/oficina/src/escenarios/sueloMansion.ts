/**
 * El mundo recorrible de la mansión, derivado de `mansion/plano` (sin copiar medidas):
 *
 * - Losas: los ambientes de cada nivel menos sus huecos. El techo de la torre cubre la casa entera
 *   (azotea): desde el observatorio se sale por su frente abierto al techo verde.
 * - Escaleras: la escultórica 1–2 y la 2–3 por peldaños (mismo reparto que el dibujo,
 *   `render/casa/arquitectura.peldanos`), con baranda a cada costado salvo donde hay muro; la de caracol
 *   por sectores entre la columna y el borde exterior, con su columna y un balaustre por peldaño (los
 *   radios son los del dibujo, `render/casa/Casa.tsx`).
 * - Muebles: se pisan los que `sePisa` (tapa al alcance del salto: sofá, mesas, banco de pesas, sillones,
 *   reposeras…); el resto son sólidos de su base a su tapa.
 * - Muros y barandas de cada nivel bloquean del piso de ese nivel al siguiente (los vanos quedan abiertos).
 * - Bordes de seguridad (invisibles): todo lo que no es piso en un nivel (el vacío del atrio, el frente
 *   abierto de las plantas altas, el borde de la azotea) y los bordes de cada hueco salvo por donde llega
 *   su escalera. Así no se cae desde una planta alta; sí se baja de una tarima o un sofá.
 * - Piscina: NO pisable (no hay nado): la lámina queda fuera del piso del primer nivel y su borde de
 *   seguridad la rodea; se camina por el deck.
 */
import { ambienteDe, ESPESOR_LOSA, NIVEL_Y, plano } from '../mansion/plano';
import type { Caja, Escalera, Hueco, Muro, Nivel } from '../mansion/plano';
import {
  ejeCaracol,
  GROSOR_PELDANO,
  peldanosCaracol,
  peldanosRectos,
  restarCajas,
  superficiesDeMuebles,
} from './suelo';
import type { DatosSuelo, Solido, Superficie } from './tipos';

/** Radios del caracol del dibujo: columna, borde exterior de los peldaños y línea de balaustres. */
export const RADIOS_CARACOL = { columna: 0.09, exterior: 1.05, balaustres: 1.0 } as const;
/** Altura (m) de una planta: los muros de un nivel bloquean hasta el piso del siguiente. */
const ALTO_PLANTA = NIVEL_Y.piso2 - NIVEL_Y.piso1;
/** Alto (m) de las barandas de las escaleras sobre cada peldaño. */
const ALTO_BARANDA = 1;
/** Medio espesor (m) de una baranda o un balaustre, y de los bordes de seguridad de un hueco. */
const MEDIO_BARANDA = 0.03;
const ESPESOR_BORDE = 0.1;
/** Radio de contacto (m) de la columna y los balaustres del caracol: los hombros, no los brazos. */
const RADIO_HOMBROS = 0.2;
/** Los últimos peldaños del caracol no llevan balaustre: por ahí se sale a la torre. */
const PELDANOS_SALIDA_CARACOL = 3;
/** Largo (m) del tramo del borde del hueco que queda abierto donde llega el caracol. */
const SALIDA_CARACOL = 0.95;
const LIMITES: Caja = { x0: -16, x1: 16, z0: -4, z1: 10 };
/** Holgura (m) de la huella de una escalera frente al borde de seguridad de cada planta. */
const HOLGURA_ESCALERA = 0.25;
/** El techo de la torre: la casa entera. */
const AZOTEA: Caja = { x0: -16, x1: 16, z0: -4, z1: 4 };
const NIVELES = Object.keys(NIVEL_Y) as Nivel[];

const igual = (a: number, b: number) => Math.abs(a - b) < 1e-6;
const caracol = (e: Escalera) => ejeCaracol(e) !== null;

/**
 * Lo que ocupa una escalera en planta (sus peldaños) más `HOLGURA_ESCALERA` alrededor: el borde de
 * seguridad de una planta no se mete entre la escalera y su baranda o el muro de al lado (al subir, el
 * cuerpo no queda encimado con un borde que se activa a su nueva altura).
 */
function huellaEscalera(e: Escalera): Caja {
  const eje = ejeCaracol(e);
  const g = HOLGURA_ESCALERA;
  if (eje) {
    const r = RADIOS_CARACOL.exterior + g;
    return { x0: eje.x - r, x1: eje.x + r, z0: eje.z - r, z1: eje.z + r };
  }
  const xs = e.tramos.flatMap((t) => [t.desde.x - t.ancho / 2, t.hasta.x + t.ancho / 2]);
  const zs = e.tramos.flatMap((t) => [t.desde.z, t.hasta.z]);
  return {
    x0: Math.min(...xs) - g,
    x1: Math.max(...xs) + g,
    z0: Math.min(...zs),
    z1: Math.max(...zs),
  };
}

const tocaNivel = (e: Escalera, y: number) =>
  e.tramos.some((t) => igual(t.desde.y, y) || igual(t.hasta.y, y));

/** Piso de un nivel: sus ambientes (la azotea en la torre) menos sus huecos y, abajo, la piscina. */
function losas(nivel: Nivel): Caja[] {
  const y = NIVEL_Y[nivel];
  const base = nivel === 'torre' ? [AZOTEA] : plano.ambientes.filter((a) => a.nivel === nivel);
  const quitar: Caja[] = plano.huecos.filter((h) => igual(h.y, y));
  if (nivel === 'piso1') quitar.push(plano.piscina);
  return restarCajas(base, quitar);
}

/** Tramos de un muro con su vano abierto. */
function tramosMuro(m: Muro): [number, number][] {
  if (!m.vano) return [[m.desde, m.hasta]];
  const a = m.vano.centro - m.vano.ancho / 2;
  const b = m.vano.centro + m.vano.ancho / 2;
  const tramos: [number, number][] = [];
  if (a > m.desde) tramos.push([m.desde, a]);
  if (b < m.hasta) tramos.push([b, m.hasta]);
  return tramos;
}

/** Celdas del rectángulo `LIMITES` que no cubre ninguna caja de `piso` (complemento por grilla comprimida). */
function complemento(piso: readonly Caja[]): Caja[] {
  const xs = [...new Set([LIMITES.x0, LIMITES.x1, ...piso.flatMap((c) => [c.x0, c.x1])])]
    .filter((x) => x >= LIMITES.x0 && x <= LIMITES.x1)
    .sort((a, b) => a - b);
  const zs = [...new Set([LIMITES.z0, LIMITES.z1, ...piso.flatMap((c) => [c.z0, c.z1])])]
    .filter((z) => z >= LIMITES.z0 && z <= LIMITES.z1)
    .sort((a, b) => a - b);
  const fuera: Caja[] = [];
  for (let i = 0; i + 1 < xs.length; i++) {
    for (let j = 0; j + 1 < zs.length; j++) {
      const cx = (xs[i]! + xs[i + 1]!) / 2;
      const cz = (zs[j]! + zs[j + 1]!) / 2;
      if (!piso.some((c) => cx > c.x0 && cx < c.x1 && cz > c.z0 && cz < c.z1)) {
        fuera.push({ x0: xs[i]!, x1: xs[i + 1]!, z0: zs[j]!, z1: zs[j + 1]! });
      }
    }
  }
  return fuera;
}

/**
 * Bordes de seguridad de un hueco: una franja por fuera de cada lado, salvo el tramo por donde llega su
 * escalera (toda la boca de una recta; `SALIDA_CARACOL` m junto al último peldaño de un caracol).
 */
function bordesHueco(h: Hueco): Solido[] {
  const llega = plano.escaleras.find((e) => {
    const fin = e.tramos[e.tramos.length - 1]?.hasta;
    return (
      fin &&
      igual(fin.y, h.y) &&
      fin.x >= h.x0 - 0.01 &&
      fin.x <= h.x1 + 0.01 &&
      fin.z >= h.z0 - 0.01 &&
      fin.z <= h.z1 + 0.01
    );
  });
  const fin = llega?.tramos[llega.tramos.length - 1]?.hasta;
  const e = ESPESOR_BORDE;
  const lados: { caja: Caja; eje: 'x' | 'z'; pos: number }[] = [
    { caja: { x0: h.x0 - e, x1: h.x0, z0: h.z0 - e, z1: h.z1 + e }, eje: 'x', pos: h.x0 },
    { caja: { x0: h.x1, x1: h.x1 + e, z0: h.z0 - e, z1: h.z1 + e }, eje: 'x', pos: h.x1 },
    { caja: { x0: h.x0 - e, x1: h.x1 + e, z0: h.z0 - e, z1: h.z0 }, eje: 'z', pos: h.z0 },
    { caja: { x0: h.x0 - e, x1: h.x1 + e, z0: h.z1, z1: h.z1 + e }, eje: 'z', pos: h.z1 },
  ];
  const solidos: Solido[] = [];
  for (const { caja, eje, pos } of lados) {
    let abiertos: Caja[] = [];
    if (fin && llega && igual(eje === 'x' ? fin.x : fin.z, pos)) {
      if (caracol(llega)) {
        // Hacia el lado de los peldaños anteriores (de donde viene el último tramo).
        const u = eje === 'x' ? fin.z : fin.x;
        const previo = llega.tramos[llega.tramos.length - 1]!.desde;
        const s = Math.sign((eje === 'x' ? previo.z : previo.x) - u) || 1;
        const a = Math.min(u - s * 0.15, u + s * SALIDA_CARACOL);
        const b = Math.max(u - s * 0.15, u + s * SALIDA_CARACOL);
        abiertos = [eje === 'x' ? { ...caja, z0: a, z1: b } : { ...caja, x0: a, x1: b }];
      } else {
        abiertos = [caja];
      }
    }
    restarCajas([caja], abiertos).forEach((c, i) =>
      solidos.push({
        id: `borde-${h.id}-${eje}${pos}-${i}`,
        tipo: 'borde',
        ...c,
        y0: h.y - ESPESOR_LOSA,
        y1: h.y + ALTO_PLANTA,
      }),
    );
  }
  return solidos;
}

/** Barandas a los costados de un tramo recto, peldaño a peldaño (siguen la pendiente). */
function barandasRectas(e: Escalera, superficies: readonly Superficie[]): Solido[] {
  const solidos: Solido[] = [];
  e.tramos.forEach((t, i) => {
    const nivel = NIVELES.find((n) => igual(NIVEL_Y[n], Math.min(t.desde.y, t.hasta.y)));
    const z0 = Math.min(t.desde.z, t.hasta.z);
    const z1 = Math.max(t.desde.z, t.hasta.z);
    const peldanos = superficies.filter(
      (s) => s.forma === 'caja' && s.id.startsWith(`${e.id}-${i}#`),
    );
    for (const lado of [-1, 1] as const) {
      const px = t.desde.x + lado * (t.ancho / 2 + MEDIO_BARANDA);
      // Del lado de un muro la baranda sobra (como en el dibujo).
      const conMuro = plano.muros.some(
        (m) =>
          m.nivel === nivel &&
          m.eje === 'x' &&
          m.tipo !== 'baranda' &&
          Math.abs(m.pos - px) < 0.35 &&
          m.desde <= z0 &&
          m.hasta >= z1,
      );
      if (conMuro) continue;
      for (const p of peldanos) {
        if (p.forma !== 'caja') continue;
        solidos.push({
          id: `baranda-${p.id}-${lado}`,
          tipo: 'baranda',
          x0: px - MEDIO_BARANDA,
          x1: px + MEDIO_BARANDA,
          z0: p.z0,
          z1: p.z1,
          y0: p.y - GROSOR_PELDANO,
          y1: p.y + ALTO_BARANDA,
        });
      }
    }
  });
  return solidos;
}

/** Columna y balaustres del caracol (dos por peldaño, salvo en los de la salida). */
function solidosCaracol(e: Escalera, peldanos: readonly Superficie[]): Solido[] {
  const eje = ejeCaracol(e)!;
  const ys = e.tramos.flatMap((t) => [t.desde.y, t.hasta.y]);
  const c = RADIOS_CARACOL.columna;
  const solidos: Solido[] = [
    {
      id: `${e.id}-columna`,
      tipo: 'baranda',
      x0: eje.x - c,
      x1: eje.x + c,
      z0: eje.z - c,
      z1: eje.z + c,
      y0: Math.min(...ys),
      y1: Math.max(...ys) + ALTO_BARANDA,
      radio: RADIO_HOMBROS,
    },
  ];
  const sectores = peldanos.filter((p) => p.forma === 'sector');
  sectores.slice(0, sectores.length - PELDANOS_SALIDA_CARACOL).forEach((p) => {
    if (p.forma !== 'sector') return;
    // Dos por peldaño (a 1/4 y 3/4 del sector): entre ellos no asoma el cuerpo.
    for (const f of [0.25, 0.75]) {
      const angulo = p.desde + (p.hasta - p.desde) * f;
      const x = eje.x + RADIOS_CARACOL.balaustres * Math.cos(angulo);
      const z = eje.z + RADIOS_CARACOL.balaustres * Math.sin(angulo);
      solidos.push({
        id: `balaustre-${p.id}-${f}`,
        tipo: 'baranda',
        x0: x - MEDIO_BARANDA,
        x1: x + MEDIO_BARANDA,
        z0: z - MEDIO_BARANDA,
        z1: z + MEDIO_BARANDA,
        y0: p.y - GROSOR_PELDANO,
        y1: p.y + ALTO_BARANDA,
        radio: RADIO_HOMBROS,
      });
    }
  });
  return solidos;
}

function crearSueloMansion(): DatosSuelo {
  const superficies: Superficie[] = [];
  const solidos: Solido[] = [];

  for (const nivel of NIVELES) {
    const y = NIVEL_Y[nivel];
    const piso = losas(nivel);
    piso.forEach((c, i) =>
      superficies.push({
        id: `losa-${nivel}-${i}`,
        tipo: 'losa',
        forma: 'caja',
        ...c,
        y,
        grosor: ESPESOR_LOSA,
      }),
    );

    for (const m of plano.muros) {
      if (m.nivel !== nivel) continue;
      const h = 0.1;
      tramosMuro(m).forEach(([d, hasta], i) =>
        solidos.push({
          id: `${m.id}-${i}`,
          tipo: m.tipo === 'baranda' ? 'baranda' : 'muro',
          ...(m.eje === 'x'
            ? { x0: m.pos - h, x1: m.pos + h, z0: d, z1: hasta }
            : { x0: d, x1: hasta, z0: m.pos - h, z1: m.pos + h }),
          y0: y,
          y1: y + ALTO_PLANTA,
        }),
      );
    }

    // Borde de seguridad: lo que no es piso ni escalera de este nivel.
    const recorrible = [
      ...piso,
      ...plano.escaleras.filter((e) => tocaNivel(e, y)).map(huellaEscalera),
    ];
    complemento(recorrible).forEach((c, i) =>
      solidos.push({
        id: `borde-${nivel}-${i}`,
        tipo: 'borde',
        ...c,
        y0: y - ESPESOR_LOSA,
        y1: y + ALTO_PLANTA,
      }),
    );
  }

  for (const e of plano.escaleras) {
    if (caracol(e)) {
      const peldanos = peldanosCaracol(e, RADIOS_CARACOL.columna, RADIOS_CARACOL.exterior);
      superficies.push(...peldanos);
      solidos.push(...solidosCaracol(e, peldanos));
    } else {
      const peldanos = e.tramos.flatMap((t, i) => peldanosRectos(`${e.id}-${i}`, t));
      superficies.push(...peldanos);
      solidos.push(...barandasRectas(e, peldanos));
    }
  }
  for (const h of plano.huecos) solidos.push(...bordesHueco(h));

  const muebles = superficiesDeMuebles(plano.muebles, (m) => ambienteDe(m.ambiente).y);
  superficies.push(...muebles.superficies);
  solidos.push(...muebles.solidos);

  return { superficies, solidos, limites: { ...LIMITES } };
}

/** El suelo de la mansión (se arma una vez al importar; son datos). */
export const sueloMansion: DatosSuelo = crearSueloMansion();
