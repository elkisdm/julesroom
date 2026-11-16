import { useMemo } from 'react';
import { Color, MeshBasicMaterial, MeshStandardMaterial } from 'three';
import type { Material } from 'three';
import {
  BICI,
  COCINA,
  DESCANSO,
  LOUNGE,
  MESA,
  MESA_ALTA,
  MESAS,
  MESAS_ALTAS,
  PLANTAS,
  REUNION,
  SALA,
  SILLAS_DX,
  TABLERO,
} from '../../../escenarios/oficina/plano';
import { MONITOR } from '../../../escenarios/oficina';
import { ConElMueble } from '../ubicar-contexto';
import { Instancias } from '../trading/Instancias';
import type { Item } from '../trading/Instancias';
import { useLienzo } from '../trading/lienzo';
import { aleatorio } from '../trading/mercado';
import { celdaAtlas, geometriaQuads } from '../trading/quads';
import type { Quad } from '../trading/quads';
import { useRecursos } from './recursos';
import { ATLAS_MONITOR, dibujarAlfombra, dibujarAtlasMonitores } from './texturas';

/** Color de cada equipo: el esmalte de las lámparas de su mesa larga. */
export const COLOR_EQUIPO = ['#d9a441', '#3f7f8f', '#c4673f', '#7f9b7c'] as const;
/** Altura de las campanas de las mesas: alta, para no tapar las caras de quien se sienta enfrente. */
export const ALTO_LAMPARA = 3.2;

type V3 = [number, number, number];

/** Silla de mesa: asiento tapizado, respaldo detrás (lejos de la mesa) y cuatro patas de acero. */
function silla(
  x: number,
  z: number,
  s: -1 | 1,
  asientos: Item[],
  respaldos: Item[],
  patas: Item[],
) {
  asientos.push({ p: [x, 0.46, z], e: [0.46, 0.07, 0.44] });
  respaldos.push({ p: [x, 0.8, z + s * 0.21], e: [0.44, 0.34, 0.05], rx: s * 0.12 });
  for (const dx of [-0.19, 0.19])
    for (const dz of [-0.18, 0.18])
      patas.push({ p: [x + dx, 0.22, z + dz], e: [0.03, 0.44, 0.03] });
  patas.push({ p: [x, 0.62, z + s * 0.2], e: [0.03, 0.3, 0.03] });
}

/**
 * Las cuatro mesas largas de roble sobre caballetes de acero, con sus 8 sillas (salvia o terracota por
 * lado), monitores bajos (no tapan a quien se sienta enfrente), teclados, tazas, una planta al centro y
 * tres campanas esmaltadas del color del equipo colgando altas.
 */
export function MesasLargas() {
  const { mat, geo, guardar } = useRecursos();
  const atlas = useLienzo(
    ATLAS_MONITOR.columnas * ATLAS_MONITOR.celda.w,
    ATLAS_MONITOR.filas * ATLAS_MONITOR.celda.h,
    dibujarAtlasMonitores,
  );
  const piezas = useMemo(() => {
    const cubiertas: Item[] = [];
    const caballetes: Item[] = [];
    const biseles: Item[] = [];
    const pies: Item[] = [];
    const teclados: Item[] = [];
    const tazas: Item[] = [];
    const asientosSalvia: Item[] = [];
    const asientosTerracota: Item[] = [];
    const respaldos: Item[] = [];
    const patas: Item[] = [];
    const monitores: Quad[] = [];
    const campanas: Item[][] = COLOR_EQUIPO.map(() => []);
    const bombillas: Item[] = [];
    const cables: Item[] = [];
    let celda = 0;
    MESAS.forEach((m, i) => {
      cubiertas.push({ p: [m.x, MESA.alto - 0.025, m.z], e: [MESA.largo, 0.05, MESA.fondo] });
      for (const dx of [-MESA.largo / 2 + 0.35, MESA.largo / 2 - 0.35]) {
        for (const dz of [-0.45, 0.45])
          caballetes.push({
            p: [m.x + dx, (MESA.alto - 0.05) / 2, m.z + dz],
            e: [0.06, MESA.alto - 0.05, 0.06],
          });
        caballetes.push({ p: [m.x + dx, 0.03, m.z], e: [0.07, 0.05, MESA.fondo - 0.1] });
        caballetes.push({
          p: [m.x + dx, MESA.alto - 0.08, m.z],
          e: [0.06, 0.05, MESA.fondo - 0.15],
        });
      }
      caballetes.push({ p: [m.x, MESA.alto - 0.09, m.z], e: [MESA.largo - 0.8, 0.05, 0.06] });
      for (const s of [-1, 1] as const) {
        const asientos = s < 0 ? asientosSalvia : asientosTerracota;
        SILLAS_DX.forEach((dx, k) => {
          const x = m.x + dx;
          silla(x, m.z + s * 1.0, s, asientos, respaldos, patas);
          teclados.push({ p: [x, MESA.alto + 0.012, m.z + s * 0.36], e: [0.42, 0.02, 0.13] });
          if ((k + i + (s > 0 ? 1 : 0)) % 3 === 0)
            tazas.push({ p: [x + 0.32, MESA.alto + 0.05, m.z + s * 0.3], e: [0.08, 0.1, 0.08] });
          // El monitor mira a quien se sienta: el del lado sur, a la cámara. El que recibe contenido de
          // fuera (`monitor:k`) lo dibuja `Pantallas`.
          const externo = s > 0 && dx === MONITOR.dx;
          const z = m.z + s * MONITOR.dz;
          const giro = s > 0 ? 0 : Math.PI;
          if (!externo)
            monitores.push({
              x,
              y: MONITOR.y,
              z,
              ancho: MONITOR.ancho,
              alto: MONITOR.alto,
              giro,
              inclinacion: -0.05,
              uv: celdaAtlas(celda++, ATLAS_MONITOR.columnas, ATLAS_MONITOR.filas),
            });
          biseles.push({
            p: [x, MONITOR.y, z - s * 0.02],
            e: [MONITOR.ancho + 0.04, MONITOR.alto + 0.04, 0.03],
          });
          pies.push({
            p: [x, (MESA.alto + MONITOR.y) / 2, z - s * 0.05],
            e: [0.04, MONITOR.y - MESA.alto, 0.04],
          });
          pies.push({ p: [x, MESA.alto + 0.008, z - s * 0.05], e: [0.22, 0.016, 0.16] });
        });
      }
      for (const dx of [-1.15, 0, 1.15]) {
        campanas[i]!.push({ p: [m.x + dx, ALTO_LAMPARA, m.z], e: [0.56, 0.3, 0.56] });
        bombillas.push({ p: [m.x + dx, ALTO_LAMPARA - 0.14, m.z], e: [0.14, 0.05, 0.14] });
        cables.push({
          p: [m.x + dx, (ALTO_LAMPARA + 6.2) / 2, m.z],
          e: [0.012, 6.2 - ALTO_LAMPARA, 0.012],
        });
      }
    });
    return {
      cubiertas,
      caballetes,
      biseles,
      pies,
      teclados,
      tazas,
      asientosSalvia,
      asientosTerracota,
      respaldos,
      patas,
      monitores,
      campanas,
      bombillas,
      cables,
    };
  }, []);
  const mallas = useMemo(
    () => ({
      monitores: guardar(geometriaQuads(piezas.monitores)),
      matMonitores: guardar(
        new MeshBasicMaterial({
          map: atlas,
          color: new Color('#ffffff').multiplyScalar(0.95),
          toneMapped: false,
        }),
      ),
      esmaltes: COLOR_EQUIPO.map((c) =>
        guardar(new MeshStandardMaterial({ color: c, roughness: 0.35, metalness: 0.1 })),
      ),
    }),
    [piezas, atlas, guardar],
  );
  return (
    <>
      <Instancias items={piezas.cubiertas} geometria={geo.caja} material={mat.roble} />
      <Instancias items={piezas.caballetes} geometria={geo.caja} material={mat.acero} />
      <Instancias items={piezas.biseles} geometria={geo.caja} material={mat.plastico} />
      <Instancias items={piezas.pies} geometria={geo.caja} material={mat.acero} />
      <Instancias items={piezas.teclados} geometria={geo.caja} material={mat.teclado} />
      <Instancias items={piezas.tazas} geometria={geo.cilindroBajo} material={mat.terracota} />
      <Instancias items={piezas.asientosSalvia} geometria={geo.caja} material={mat.salvia} />
      <Instancias items={piezas.asientosTerracota} geometria={geo.caja} material={mat.terracota} />
      <Instancias items={piezas.respaldos} geometria={geo.caja} material={mat.robleClaro} />
      <Instancias items={piezas.patas} geometria={geo.caja} material={mat.acero} />
      <Instancias items={piezas.cables} geometria={geo.caja} material={mat.acero} />
      <Instancias items={piezas.bombillas} geometria={geo.cilindroBajo} material={mat.luzCalida} />
      {piezas.campanas.map((it, i) => (
        <Instancias key={i} items={it} geometria={geo.campana} material={mallas.esmaltes[i]!} />
      ))}
      <mesh geometry={mallas.monitores} material={mallas.matMonitores} />
    </>
  );
}

/**
 * La caja de vidrio de reunión: paños de vidrio con montantes de acero, mesa de roble con seis sillas de
 * cuero terracota, alfombra salvia y una lámpara lineal. La pantalla la pone `Pantallas`.
 */
export function SalaReunion({ alTocar }: { alTocar: () => void }) {
  const { mat, geo } = useRecursos();
  const piezas = useMemo(() => {
    const z = REUNION.zona;
    const alto = 3.1;
    const vidrios: Item[] = [
      { p: [z.x1, alto / 2, (z.z0 + z.z1) / 2], e: [0.02, alto, z.z1 - z.z0] },
      {
        p: [(z.x0 + REUNION.puerta.x0) / 2, alto / 2, z.z1],
        e: [REUNION.puerta.x0 - z.x0, alto, 0.02],
      },
      {
        p: [(REUNION.puerta.x1 + z.x1) / 2, alto / 2, z.z1],
        e: [z.x1 - REUNION.puerta.x1, alto, 0.02],
      },
    ];
    const marcos: Item[] = [
      { p: [z.x1, alto, (z.z0 + z.z1) / 2], e: [0.08, 0.08, z.z1 - z.z0] },
      { p: [(z.x0 + z.x1) / 2, alto, z.z1], e: [z.x1 - z.x0, 0.08, 0.08] },
      { p: [z.x1, 0.03, (z.z0 + z.z1) / 2], e: [0.08, 0.06, z.z1 - z.z0] },
    ];
    for (let k = z.z0 + 1.4; k < z.z1; k += 1.4)
      marcos.push({ p: [z.x1, alto / 2, k], e: [0.05, alto, 0.05] });
    for (const x of [z.x0 + 1.4, REUNION.puerta.x0, REUNION.puerta.x1, z.x1])
      marcos.push({ p: [x, alto / 2, z.z1], e: [0.06, alto, 0.06] });
    const esmerilado: Item[] = vidrios.map((v) => ({
      p: [v.p[0], 1.2, v.p[2]],
      e: [Math.max(v.e![0], 0.03), 0.42, Math.max(v.e![2], 0.03)],
    }));
    const m = REUNION.mesa;
    const cubierta: Item[] = [{ p: [m.x, 0.75, m.z], e: [m.ancho, 0.05, m.fondo] }];
    const patas: Item[] = [];
    for (const dx of [-m.ancho / 2 + 0.3, m.ancho / 2 - 0.3]) {
      patas.push({ p: [m.x + dx, 0.36, m.z], e: [0.06, 0.72, m.fondo - 0.2] });
      patas.push({ p: [m.x + dx, 0.03, m.z], e: [0.08, 0.05, m.fondo - 0.1] });
    }
    const asientos: Item[] = [];
    const respaldos: Item[] = [];
    for (const s of [-1, 1] as const)
      for (const x of REUNION.sillasX) silla(x, m.z + s * 1.2, s, asientos, respaldos, patas);
    const lampara: Item[] = [{ p: [m.x, 2.35, m.z], e: [2.6, 0.06, 0.12] }];
    const cables: Item[] = [-1.1, 1.1].map((dx) => ({
      p: [m.x + dx, 4.3, m.z],
      e: [0.012, 3.9, 0.012],
    }));
    const tira: Item[] = [{ p: [m.x, 2.315, m.z], e: [2.5, 0.012, 0.06] }];
    const alfombra: Item[] = [{ p: [m.x, 0.004, m.z], e: [5.2, 1, 3.6] }];
    return {
      vidrios,
      esmerilado,
      marcos,
      cubierta,
      patas,
      asientos,
      respaldos,
      lampara,
      cables,
      tira,
      alfombra,
    };
  }, []);
  return (
    <>
      <Instancias items={piezas.alfombra} geometria={geo.plano} material={mat.salvia} />
      <Instancias items={piezas.vidrios} geometria={geo.caja} material={mat.vidrio} />
      <Instancias items={piezas.esmerilado} geometria={geo.caja} material={mat.esmerilado} />
      <Instancias items={piezas.marcos} geometria={geo.caja} material={mat.acero} />
      <Instancias
        items={piezas.cubierta}
        geometria={geo.caja}
        material={mat.roble}
        alTocar={alTocar}
      />
      <Instancias items={piezas.patas} geometria={geo.caja} material={mat.acero} />
      <Instancias items={piezas.asientos} geometria={geo.caja} material={mat.terracotaCuero} />
      <Instancias items={piezas.respaldos} geometria={geo.caja} material={mat.terracotaCuero} />
      <Instancias
        items={[...piezas.lampara, ...piezas.cables]}
        geometria={geo.caja}
        material={mat.acero}
      />
      <Instancias items={piezas.tira} geometria={geo.caja} material={mat.luzCalida} />
    </>
  );
}

/** Credenza de roble bajo el tablero, con libros, una planta y un jarrón. */
export function Credenza() {
  const { mat, geo } = useRecursos();
  const piezas = useMemo(() => {
    const c = TABLERO.credenza;
    const cuerpo: Item[] = [
      { p: [c.x, c.alto / 2 + 0.08, c.z], e: [c.ancho, c.alto - 0.08, c.fondo] },
    ];
    const patas: Item[] = [-1, 1].flatMap((s): Item[] => [
      { p: [c.x + s * (c.ancho / 2 - 0.15), 0.06, c.z], e: [0.05, 0.12, c.fondo - 0.08] },
    ]);
    const libros = librosEnFila(
      c.x - c.ancho / 2 + 0.3,
      c.x - c.ancho / 2 + 1.5,
      c.alto,
      c.z,
      'x',
      41,
    );
    const jarron: Item[] = [{ p: [c.x + 2.2, c.alto + 0.2, c.z], e: [0.2, 0.4, 0.2] }];
    return { cuerpo, patas, libros, jarron };
  }, []);
  return (
    <>
      <Instancias items={piezas.cuerpo} geometria={geo.caja} material={mat.roble} />
      <Instancias items={piezas.patas} geometria={geo.caja} material={mat.acero} />
      <Libros items={piezas.libros} />
      <Instancias items={piezas.jarron} geometria={geo.maceta} material={mat.terracota} />
    </>
  );
}

const COLORES_LIBRO = [
  '#c4673f',
  '#7f9b7c',
  '#e8dccb',
  '#d9a441',
  '#3f7f8f',
  '#2b2b2b',
  '#a8503a',
] as const;

/** Libros de pie en fila sobre una repisa (a lo largo de `eje`), de colores y altos variados. */
function librosEnFila(
  desde: number,
  hasta: number,
  y: number,
  fijo: number,
  eje: 'x' | 'z',
  semilla: number,
): Item[] {
  const rnd = aleatorio(semilla);
  const libros: Item[] = [];
  let u = desde;
  while (u < hasta) {
    const grueso = 0.03 + rnd() * 0.035;
    const alto = 0.2 + rnd() * 0.1;
    const color = COLORES_LIBRO[Math.floor(rnd() * COLORES_LIBRO.length)]!;
    libros.push(
      eje === 'x'
        ? { p: [u + grueso / 2, y + alto / 2, fijo], e: [grueso, alto, 0.2], c: color }
        : { p: [fijo, y + alto / 2, u + grueso / 2], e: [0.2, alto, grueso], c: color },
    );
    u += grueso + 0.004;
    if (rnd() < 0.06) u += 0.15;
  }
  return libros;
}

function Libros({ items }: { items: readonly Item[] }) {
  const { geo, guardar } = useRecursos();
  const material = useMemo(
    () => guardar(new MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 })),
    [guardar],
  );
  return <Instancias items={items} geometria={geo.caja} material={material} />;
}

/**
 * Cocina: muebles bajos salvia con cubierta de piedra, repisas de roble con loza contra el ladrillo,
 * cafetera, nevera de acero, isla larga con taburetes y tres campanas negras encima.
 */
export function Cocina({ alTocar }: { alTocar: () => void }) {
  const { mat, geo } = useRecursos();
  const piezas = useMemo(() => {
    const e = COCINA.encimera;
    const ex = (e.x0 + e.x1) / 2;
    const largo = e.x1 - e.x0;
    const muebles: Item[] = [{ p: [ex, 0.45, (e.z0 + e.z1) / 2 + 0.02], e: [largo, 0.86, 0.6] }];
    const piedra: Item[] = [{ p: [ex, e.alto - 0.02, (e.z0 + e.z1) / 2], e: [largo, 0.04, 0.68] }];
    const zocalo: Item[] = [{ p: [ex, 0.05, e.z1 - 0.06], e: [largo, 0.1, 0.04] }];
    const tiradores: Item[] = [];
    for (let x = e.x0 + 0.3; x < e.x1; x += 0.6)
      tiradores.push({ p: [x, 0.78, e.z1 + 0.025], e: [0.18, 0.02, 0.02] });
    const repisas: Item[] = [1.55, 2.1].map((y) => ({
      p: [ex - 0.6, y, SALA.z0 + 0.15],
      e: [largo - 1.6, 0.04, 0.3],
    }));
    const loza: Item[] = [];
    const rnd = aleatorio(9);
    for (const y of [1.57, 2.12])
      for (let x = e.x0 + 0.2; x < e.x1 - 1.6; x += 0.18 + rnd() * 0.12)
        loza.push({ p: [x, y + 0.08, SALA.z0 + 0.15], e: [0.12, 0.14 + rnd() * 0.1, 0.12] });
    const i = COCINA.isla;
    const ix = (i.x0 + i.x1) / 2;
    const iz = (i.z0 + i.z1) / 2;
    muebles.push({
      p: [ix, (i.alto - 0.05) / 2, iz],
      e: [i.x1 - i.x0 - 0.1, i.alto - 0.05, i.z1 - i.z0 - 0.1],
    });
    piedra.push({ p: [ix, i.alto - 0.02, iz], e: [i.x1 - i.x0 + 0.1, 0.05, i.z1 - i.z0 + 0.1] });
    const inox: Item[] = [
      {
        p: [
          (COCINA.nevera.x0 + COCINA.nevera.x1) / 2,
          COCINA.nevera.alto / 2,
          (COCINA.nevera.z0 + COCINA.nevera.z1) / 2,
        ],
        e: [0.86, COCINA.nevera.alto, 0.68],
      },
      { p: [e.x1 - 0.9, e.alto + 0.2, SALA.z0 + 0.3], e: [0.4, 0.4, 0.36] },
      { p: [e.x0 + 1.4, e.alto + 0.005, (e.z0 + e.z1) / 2], e: [0.6, 0.01, 0.42] },
    ];
    const asientos: Item[] = COCINA.taburetesZ.map((z) => ({
      p: [COCINA.taburetesX, 0.75, z],
      e: [0.38, 0.05, 0.38],
    }));
    const patas: Item[] = COCINA.taburetesZ.flatMap((z): Item[] => [
      { p: [COCINA.taburetesX, 0.37, z], e: [0.05, 0.74, 0.05] },
      { p: [COCINA.taburetesX, 0.26, z], e: [0.3, 0.02, 0.3] },
      { p: [COCINA.taburetesX, 0.015, z], e: [0.36, 0.03, 0.36] },
    ]);
    const campanas: Item[] = [-1.8, 0, 1.8].map((dz) => ({
      p: [ix, 2.45, iz + dz],
      e: [0.42, 0.26, 0.42],
    }));
    const bombillas: Item[] = [-1.8, 0, 1.8].map((dz) => ({
      p: [ix, 2.33, iz + dz],
      e: [0.1, 0.04, 0.1],
    }));
    const cables: Item[] = [-1.8, 0, 1.8].map((dz) => ({
      p: [ix, 4.35, iz + dz],
      e: [0.012, 3.8, 0.012],
    }));
    const frutas: Item[] = [0, 1, 2, 3, 4].map((k) => ({
      p: [ix + (k % 2) * 0.12 - 0.06, i.alto + 0.07, iz + 0.6 + k * 0.09],
      e: [0.11, 0.11, 0.11],
    }));
    return {
      muebles,
      piedra,
      zocalo,
      tiradores,
      repisas,
      loza,
      inox,
      asientos,
      patas,
      campanas,
      bombillas,
      cables,
      frutas,
    };
  }, []);
  return (
    <>
      <Instancias
        items={piezas.muebles}
        geometria={geo.caja}
        material={mat.salviaLaca}
        alTocar={alTocar}
      />
      <Instancias items={piezas.piedra} geometria={geo.caja} material={mat.piedra} />
      <Instancias
        items={[...piezas.zocalo, ...piezas.tiradores]}
        geometria={geo.caja}
        material={mat.acero}
      />
      <Instancias items={piezas.repisas} geometria={geo.caja} material={mat.roble} />
      <Instancias items={piezas.loza} geometria={geo.cilindroBajo} material={mat.crema} />
      <Instancias items={piezas.inox} geometria={geo.caja} material={mat.inox} />
      <Instancias items={piezas.asientos} geometria={geo.cilindro} material={mat.robleClaro} />
      <Instancias
        items={[...piezas.patas, ...piezas.cables]}
        geometria={geo.cilindroBajo}
        material={mat.acero}
      />
      <Instancias items={piezas.campanas} geometria={geo.campana} material={mat.acero} />
      <Instancias items={piezas.bombillas} geometria={geo.cilindroBajo} material={mat.luzCalida} />
      <Instancias items={piezas.frutas} geometria={geo.hojas} material={mat.terracota} />
    </>
  );
}

/** Sofá o sillón: base, cojín, respaldo hacia `atras` (+x o −x) y brazos. Largo en z. */
function tapizado(x: number, z: number, largo: number, fondo: number, atras: -1 | 1, out: Item[]) {
  out.push({ p: [x, 0.2, z], e: [fondo, 0.3, largo] });
  out.push({ p: [x - atras * 0.06, 0.4, z], e: [fondo - 0.2, 0.12, largo - 0.24] });
  out.push({ p: [x + atras * (fondo / 2 - 0.1), 0.6, z], e: [0.2, 0.5, largo] });
  for (const s of [-1, 1])
    out.push({ p: [x, 0.42, z + s * (largo / 2 - 0.08)], e: [fondo, 0.34, 0.16] });
}

/**
 * Lounge y biblioteca (izquierda): estantería de roble llena de libros contra el ladrillo, alfombra
 * kilim, sofá salvia, dos sillones de cuero terracota, mesa baja redonda y lámpara de pie.
 */
export function Lounge() {
  const { mat, geo, guardar } = useRecursos();
  const alfombra = useLienzo(512, 512, dibujarAlfombra);
  const matAlfombra = useMemo(
    () => guardar(new MeshStandardMaterial({ map: alfombra, roughness: 1 })),
    [alfombra, guardar],
  );
  const piezas = useMemo(() => {
    const e = LOUNGE.estanteria;
    const ex = (e.x0 + e.x1) / 2;
    const marco: Item[] = [];
    for (let z = e.z0; z <= e.z1 + 1e-6; z += (e.z1 - e.z0) / 5)
      marco.push({ p: [ex, e.alto / 2, z], e: [e.x1 - e.x0, e.alto, 0.04] });
    const niveles = [0.08, 0.55, 1.02, 1.49, 1.96, 2.38];
    for (const y of niveles)
      marco.push({ p: [ex, y, (e.z0 + e.z1) / 2], e: [e.x1 - e.x0, 0.04, e.z1 - e.z0] });
    const libros: Item[] = niveles
      .slice(0, -1)
      .flatMap((y, k) => librosEnFila(e.z0 + 0.06, e.z1 - 0.06, y + 0.02, ex + 0.04, 'z', 50 + k));
    const tela: Item[] = [];
    tapizado(LOUNGE.sofa.x, LOUNGE.sofa.z, LOUNGE.sofa.largo, LOUNGE.sofa.fondo, -1, tela);
    const cuero: Item[] = [];
    for (const s of LOUNGE.sillones) tapizado(s.x, s.z, 0.9, 0.9, 1, cuero);
    const mesa: Item[] = [{ p: [LOUNGE.mesa.x, 0.38, LOUNGE.mesa.z], e: [1.2, 0.05, 1.2] }];
    const pie: Item[] = [
      { p: [LOUNGE.mesa.x, 0.18, LOUNGE.mesa.z], e: [0.5, 0.36, 0.5] },
      { p: [-16.0, 0.8, 4.2], e: [0.03, 1.6, 0.03] },
      { p: [-16.0, 0.02, 4.2], e: [0.32, 0.04, 0.32] },
    ];
    const pantalla: Item[] = [{ p: [-16.0, 1.62, 4.2], e: [0.46, 0.34, 0.46] }];
    const encima = librosEnFila(
      LOUNGE.mesa.x - 0.3,
      LOUNGE.mesa.x + 0.1,
      0.405,
      LOUNGE.mesa.z,
      'x',
      77,
    ).slice(0, 4);
    return { marco, libros: [...libros, ...encima], tela, cuero, mesa, pie, pantalla };
  }, []);
  const a = LOUNGE.alfombra;
  return (
    <>
      <mesh position={[a.x, 0.005, a.z]} rotation={[-Math.PI / 2, 0, 0]} material={matAlfombra}>
        <planeGeometry args={[a.ancho, a.fondo]} />
      </mesh>
      <Instancias items={piezas.marco} geometria={geo.caja} material={mat.roble} />
      <Libros items={piezas.libros} />
      <Instancias items={piezas.tela} geometria={geo.caja} material={mat.salvia} />
      <Instancias items={piezas.cuero} geometria={geo.caja} material={mat.terracotaCuero} />
      <Instancias items={piezas.mesa} geometria={geo.cilindro} material={mat.roble} />
      <Instancias items={piezas.pie} geometria={geo.cilindroBajo} material={mat.acero} />
      <Instancias items={piezas.pantalla} geometria={geo.campana} material={mat.crema} />
    </>
  );
}

/** Una bicicleta de pie contra el muro este (a lo largo de x), con cuadro del color dado. */
function Bicicleta({ z, material }: { z: number; material: Material }) {
  const { mat, geo } = useRecursos();
  const r = 0.33;
  const x0 = BICI.x0 + r + 0.02;
  const x1 = BICI.x1 - r - 0.02;
  const y = r + 0.01;
  const tubo = (a: V3, b: V3, grosor = 0.035) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy);
    return (
      <mesh
        position={[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z]}
        rotation={[0, 0, Math.atan2(dy, dx)]}
        scale={[l, grosor, grosor]}
        geometry={geo.caja}
        material={material}
      />
    );
  };
  const sillin: V3 = [x0 + 0.42, 0.9, z];
  const manubrio: V3 = [x1 - 0.12, 0.98, z];
  const pedal: V3 = [(x0 + x1) / 2 - 0.05, y + 0.02, z];
  return (
    <>
      <mesh position={[x0, y, z]} geometry={geo.rueda} material={mat.acero} />
      <mesh position={[x1, y, z]} geometry={geo.rueda} material={mat.acero} />
      {tubo(sillin, manubrio)}
      {tubo(sillin, pedal)}
      {tubo(pedal, manubrio)}
      {tubo([x0, y, z], pedal)}
      {tubo([x0, y, z], sillin)}
      {tubo([x1, y, z], manubrio)}
      <mesh
        position={[sillin[0], sillin[1] + 0.04, z]}
        scale={[0.24, 0.05, 0.1]}
        geometry={geo.caja}
        material={mat.acero}
      />
      <mesh
        position={[manubrio[0], manubrio[1] + 0.02, z]}
        scale={[0.05, 0.04, 0.48]}
        geometry={geo.caja}
        material={mat.acero}
      />
    </>
  );
}

/** Descanso (derecha, al frente): alfombra salvia, sofá crema contra el muro, sillones y bicicletas. */
export function Descanso() {
  const { mat, geo, guardar } = useRecursos();
  const cuadros = useMemo(
    () =>
      ['#c4673f', '#3f7f8f', '#d9a441'].map((c) =>
        guardar(new MeshStandardMaterial({ color: c, roughness: 0.4, metalness: 0.3 })),
      ),
    [guardar],
  );
  const piezas = useMemo(() => {
    const a = DESCANSO.alfombra;
    const alfombra: Item[] = [{ p: [a.x, 0.004, a.z], e: [a.ancho, 1, a.fondo] }];
    const borde: Item[] = [{ p: [a.x, 0.003, a.z], e: [a.ancho + 0.24, 1, a.fondo + 0.24] }];
    const crema: Item[] = [];
    tapizado(DESCANSO.sofa.x, DESCANSO.sofa.z, DESCANSO.sofa.largo, DESCANSO.sofa.fondo, 1, crema);
    const salvia: Item[] = [];
    for (const s of DESCANSO.sillones) tapizado(s.x, s.z, 0.9, 0.9, -1, salvia);
    const mesa: Item[] = [{ p: [DESCANSO.mesa.x, 0.38, DESCANSO.mesa.z], e: [0.9, 0.05, 0.9] }];
    const pie: Item[] = [{ p: [DESCANSO.mesa.x, 0.18, DESCANSO.mesa.z], e: [0.4, 0.36, 0.4] }];
    const soporte: Item[] = [
      {
        p: [SALA.x1 - 0.06, 1.15, (DESCANSO.bicicletas[0]! + DESCANSO.bicicletas.at(-1)!) / 2],
        e: [0.06, 0.06, 2.2],
      },
    ];
    return { alfombra, borde, crema, salvia, mesa, pie, soporte };
  }, []);
  return (
    <>
      <Instancias items={piezas.borde} geometria={geo.plano} material={mat.crema} />
      <Instancias items={piezas.alfombra} geometria={geo.plano} material={mat.salvia} />
      <Instancias items={piezas.crema} geometria={geo.caja} material={mat.crema} />
      <Instancias items={piezas.salvia} geometria={geo.caja} material={mat.salviaLaca} />
      <Instancias items={piezas.mesa} geometria={geo.cilindro} material={mat.roble} />
      <Instancias
        items={[...piezas.pie, ...piezas.soporte]}
        geometria={geo.caja}
        material={mat.acero}
      />
      {DESCANSO.bicicletas.map((z, i) => (
        <ConElMueble key={z} x={(BICI.x0 + BICI.x1) / 2} z={z}>
          <Bicicleta z={z} material={cuadros[i]!} />
        </ConElMueble>
      ))}
    </>
  );
}

/** Mesas altas de roble para trabajar de pie, al frente, con un portátil y una taza. */
export function MesasAltas() {
  const { mat, geo } = useRecursos();
  const piezas = useMemo(() => {
    const cubiertas: Item[] = MESAS_ALTAS.map((t) => ({
      p: [t.x, MESA_ALTA.alto, t.z],
      e: [MESA_ALTA.radio * 2, 0.045, MESA_ALTA.radio * 2],
    }));
    const pies: Item[] = MESAS_ALTAS.flatMap((t): Item[] => [
      { p: [t.x, MESA_ALTA.alto / 2, t.z], e: [0.09, MESA_ALTA.alto, 0.09] },
      { p: [t.x, 0.02, t.z], e: [0.6, 0.04, 0.6] },
    ]);
    const portatiles: Item[] = MESAS_ALTAS.map((t) => ({
      p: [t.x - 0.1, MESA_ALTA.alto + 0.03, t.z - 0.08],
      e: [0.34, 0.02, 0.24],
      r: 0.3,
    }));
    const tazas: Item[] = MESAS_ALTAS.map((t) => ({
      p: [t.x + 0.22, MESA_ALTA.alto + 0.07, t.z + 0.16],
      e: [0.08, 0.1, 0.08],
    }));
    return { cubiertas, pies, portatiles, tazas };
  }, []);
  return (
    <>
      <Instancias items={piezas.cubiertas} geometria={geo.cilindro} material={mat.roble} />
      <Instancias items={piezas.pies} geometria={geo.cilindroBajo} material={mat.acero} />
      <Instancias items={piezas.portatiles} geometria={geo.caja} material={mat.inox} />
      <Instancias items={piezas.tazas} geometria={geo.cilindroBajo} material={mat.terracota} />
    </>
  );
}

/** Plantas grandes en macetas de terracota (y una pequeña al centro de cada mesa larga). */
export function Plantas() {
  const { mat, geo } = useRecursos();
  const piezas = useMemo(() => {
    const rnd = aleatorio(19);
    const macetas: Item[] = [];
    const hojas: Item[] = [];
    const claras: Item[] = [];
    const tallos: Item[] = [];
    PLANTAS.forEach((p, i) => {
      macetas.push({ p: [p.x, 0.3, p.z], e: [0.82, 0.6, 0.82] });
      const arbol = i % 3 === 0;
      if (arbol) tallos.push({ p: [p.x, 1.1, p.z], e: [0.06, 1.2, 0.06] });
      const n = arbol ? 9 : 11;
      for (let k = 0; k < n; k++) {
        const a = k * 2.4 + rnd() * 0.6;
        const r = arbol ? 0.2 + rnd() * 0.35 : 0.15 + (k / n) * 0.45;
        const y = arbol ? 1.5 + rnd() * 0.8 : 0.75 + (k / n) * 1.2;
        (k % 2 ? claras : hojas).push({
          p: [p.x + Math.cos(a) * r, y, p.z + Math.sin(a) * r],
          e: [0.5 + rnd() * 0.25, 0.36 + rnd() * 0.2, 0.5 + rnd() * 0.25],
          r: a,
          rx: (rnd() - 0.5) * 0.8,
        });
      }
    });
    for (const m of MESAS) {
      macetas.push({ p: [m.x + 0.02, MESA.alto + 0.08, m.z], e: [0.18, 0.16, 0.18] });
      for (let k = 0; k < 4; k++)
        claras.push({
          p: [
            m.x + Math.cos(k * 1.6) * 0.08,
            MESA.alto + 0.24 + k * 0.03,
            m.z + Math.sin(k * 1.6) * 0.08,
          ],
          e: [0.16, 0.12, 0.16],
          r: k,
        });
    }
    return { macetas, hojas, claras, tallos };
  }, []);
  return (
    <>
      <Instancias items={piezas.macetas} geometria={geo.maceta} material={mat.terracota} />
      <Instancias items={piezas.tallos} geometria={geo.cilindroBajo} material={mat.aceroMate} />
      <Instancias items={piezas.hojas} geometria={geo.hojas} material={mat.hoja} />
      <Instancias items={piezas.claras} geometria={geo.hojas} material={mat.hojaClara} />
    </>
  );
}
