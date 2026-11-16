import { acabadoPisoCatalogo } from '../../acabadoPisoCatalogo';
import { useMemo } from 'react';
import { Color, MeshBasicMaterial, RepeatWrapping } from 'three';
import {
  AULA,
  BARRA,
  centroEquipo,
  COLUMNAS,
  DESCANSO,
  EQUIPOS,
  ESPERA,
  FILA_AGENTES,
  FILA_FRENTE,
  JARDINERAS,
  MESA_RADIO,
  MESAS,
  MURO_LED,
  PRIVADO,
  PUFS,
  QUIOSCO,
  SALA,
} from '../../../escenarios/trading/plano';
import { emisivoDe } from '../../../escenarios/variantes';
import { Instancias } from './Instancias';
import type { Item } from './Instancias';
import { useLienzo } from './lienzo';
import { useRecursos } from './recursos';
import { dibujarCiudad, dibujarFachada, dibujarPiso } from './texturas';

const ANCHO = SALA.x1 - SALA.x0;
const FONDO = SALA.z1 - SALA.z0;
const CENTRO_X = (SALA.x0 + SALA.x1) / 2;
const CENTRO_Z = (SALA.z0 + SALA.z1) / 2;
/** Separación de los montantes de los ventanales (m). */
const MODULO = 2.4;
/** Color de la luz de cada equipo (lámpara de su isla y su charco en el piso). */
export const COLOR_EQUIPO = ['#ffc58a', '#a8ecc8', '#ffab96'] as const;

/**
 * El salón: piso de pizarra cálida, ventanales de piso a cielo con la ciudad a la hora azul, el
 * aula con paneles de listones, columnas, cielo raso con baffles sobre el fondo, jardineras,
 * alfombras por zona, sombras de contacto y charcos de luz bajo cada lámpara.
 */
export function Arquitectura() {
  const { mat, geo, paleta } = useRecursos();
  const piso = useLienzo(1024, 1024, dibujarPiso);
  useMemo(() => {
    piso.wrapS = piso.wrapT = RepeatWrapping;
    piso.repeat.set(ANCHO / 3, FONDO / 3);
  }, [piso]);

  const piezas = useMemo(() => {
    const montantes: Item[] = [];
    const travesanos: Item[] = [];
    // Ventanales: fondo (salvo el aula), costado oeste de la videoteca y costado este entero.
    for (let x = AULA.zona.x1; x <= SALA.x1 + 0.01; x += MODULO)
      montantes.push({ p: [x, SALA.alto / 2, SALA.z0], e: [0.1, SALA.alto, 0.16] });
    for (let z = SALA.z0 + MODULO; z <= SALA.z1 + 0.01; z += MODULO)
      montantes.push({ p: [SALA.x1, SALA.alto / 2, z], e: [0.16, SALA.alto, 0.1] });
    for (let z = AULA.zona.z1; z <= SALA.z1 + 0.01; z += MODULO)
      montantes.push({ p: [SALA.x0, SALA.alto / 2, z], e: [0.16, SALA.alto, 0.1] });
    for (const y of [0.06, SALA.alto - 0.08]) {
      travesanos.push({
        p: [(AULA.zona.x1 + SALA.x1) / 2, y, SALA.z0],
        e: [SALA.x1 - AULA.zona.x1, 0.14, 0.2],
      });
      travesanos.push({ p: [SALA.x1, y, CENTRO_Z], e: [0.2, 0.14, FONDO] });
      travesanos.push({
        p: [SALA.x0, y, (AULA.zona.z1 + SALA.z1) / 2],
        e: [0.2, 0.14, SALA.z1 - AULA.zona.z1],
      });
    }
    const vidrios: Item[] = [
      {
        p: [(AULA.zona.x1 + SALA.x1) / 2, SALA.alto / 2, SALA.z0],
        e: [SALA.x1 - AULA.zona.x1, SALA.alto, 0.03],
      },
      { p: [SALA.x1, SALA.alto / 2, CENTRO_Z], e: [0.03, SALA.alto, FONDO] },
      {
        p: [SALA.x0, SALA.alto / 2, (AULA.zona.z1 + SALA.z1) / 2],
        e: [0.03, SALA.alto, SALA.z1 - AULA.zona.z1],
      },
      // Tabiques de vidrio del aula y de la sala privada (a 3,2 m, con su marco de latón).
      {
        p: [AULA.tabiqueX, 1.6, (SALA.z0 + AULA.tabiqueHastaZ) / 2],
        e: [0.03, 3.2, AULA.tabiqueHastaZ - SALA.z0],
      },
      {
        p: [PRIVADO.zona.x0, 1.6, (SALA.z0 + PRIVADO.zona.z1) / 2],
        e: [0.03, 3.2, PRIVADO.zona.z1 - SALA.z0],
      },
      {
        p: [(PRIVADO.zona.x0 + PRIVADO.puerta.x0) / 2, 1.6, PRIVADO.zona.z1],
        e: [PRIVADO.puerta.x0 - PRIVADO.zona.x0, 3.2, 0.03],
      },
      {
        p: [(PRIVADO.puerta.x1 + SALA.x1) / 2, 1.6, PRIVADO.zona.z1],
        e: [SALA.x1 - PRIVADO.puerta.x1, 3.2, 0.03],
      },
    ];
    const marcos: Item[] = [
      {
        p: [AULA.tabiqueX, 3.22, (SALA.z0 + AULA.tabiqueHastaZ) / 2],
        e: [0.08, 0.06, AULA.tabiqueHastaZ - SALA.z0],
      },
      { p: [AULA.tabiqueX, 1.6, AULA.tabiqueHastaZ], e: [0.08, 3.2, 0.08] },
      {
        p: [PRIVADO.zona.x0, 3.22, (SALA.z0 + PRIVADO.zona.z1) / 2],
        e: [0.08, 0.06, PRIVADO.zona.z1 - SALA.z0],
      },
      {
        p: [(PRIVADO.zona.x0 + SALA.x1) / 2, 3.22, PRIVADO.zona.z1],
        e: [SALA.x1 - PRIVADO.zona.x0, 0.06, 0.08],
      },
      ...[PRIVADO.zona.x0, PRIVADO.puerta.x0, PRIVADO.puerta.x1].map((x): Item => ({
        p: [x, 1.6, PRIVADO.zona.z1],
        e: [0.08, 3.2, 0.08],
      })),
    ];

    // Aula: muros macizos al fondo y a la izquierda, con listones de nogal.
    const murosAula: Item[] = [
      {
        p: [(SALA.x0 + AULA.zona.x1) / 2, SALA.alto / 2, SALA.z0 - 0.04],
        e: [AULA.zona.x1 - SALA.x0, SALA.alto, 0.12],
      },
      {
        p: [SALA.x0 - 0.04, SALA.alto / 2, (SALA.z0 + AULA.zona.z1) / 2],
        e: [0.12, SALA.alto, AULA.zona.z1 - SALA.z0],
      },
    ];
    const listones: Item[] = [];
    for (let x = SALA.x0 + 0.2; x < AULA.zona.x1 - 0.1; x += 0.3)
      listones.push({ p: [x, SALA.alto / 2, SALA.z0 + 0.06], e: [0.12, SALA.alto, 0.08] });
    for (let z = SALA.z0 + 0.2; z < AULA.zona.z1; z += 0.3)
      listones.push({ p: [SALA.x0 + 0.06, SALA.alto / 2, z], e: [0.08, SALA.alto, 0.12] });

    const columnas: Item[] = COLUMNAS.map((c) => ({
      p: [c.x, SALA.alto / 2, c.z],
      e: [0.7, SALA.alto, 0.7],
    }));
    const capiteles: Item[] = COLUMNAS.flatMap((c): Item[] => [
      { p: [c.x, 0.06, c.z], e: [0.78, 0.12, 0.78] },
      { p: [c.x, SALA.alto - 0.3, c.z], e: [0.76, 0.05, 0.76] },
    ]);

    // Cielo raso en el fondo: losa y baffles lineales de nogal (no tapan a nadie desde la cámara).
    const baffles: Item[] = [];
    for (let z = SALA.z0 + 0.2; z < SALA.z0 + 0.95; z += 0.24)
      baffles.push({ p: [CENTRO_X, SALA.alto - 0.22, z], e: [ANCHO, 0.32, 0.07] });

    // Jardineras con follaje.
    const macetas: Item[] = JARDINERAS.map((j) => ({ p: [j.x, 0.36, j.z], e: [1.0, 0.72, 1.0] }));
    const cantos: Item[] = JARDINERAS.map((j) => ({ p: [j.x, 0.73, j.z], e: [1.06, 0.04, 1.06] }));
    const hojas: Item[] = [];
    const hojasClaras: Item[] = [];
    JARDINERAS.forEach((j, i) => {
      for (let k = 0; k < 8; k++) {
        const a = k * 2.4 + i;
        const r = 0.12 + (k % 3) * 0.12;
        (k % 2 ? hojasClaras : hojas).push({
          p: [j.x + Math.cos(a) * r, 0.95 + (k % 4) * 0.24, j.z + Math.sin(a) * r],
          e: [0.6 - (k % 3) * 0.08, 0.66, 0.6 - (k % 2) * 0.1],
          r: a,
        });
      }
    });

    // Sombras de contacto bajo los muebles grandes (oclusión barata).
    const sombras: Item[] = [
      { p: [0, 0.006, FILA_AGENTES.mesaZ + 0.35], e: [19.5, 1, 2.6] },
      { p: [0, 0.006, FILA_FRENTE.mesaZ - 0.35], e: [19.5, 1, 2.6] },
      ...MESAS.map((m): Item => ({ p: [m.x, 0.006, m.z], e: [MESA_RADIO * 3, 1, MESA_RADIO * 3] })),
      ...COLUMNAS.map((c): Item => ({ p: [c.x, 0.006, c.z], e: [1.6, 1, 1.6] })),
      { p: [QUIOSCO.x, 0.006, QUIOSCO.z], e: [QUIOSCO.ancho + 0.8, 1, 1.4] },
      {
        p: [(BARRA.x0 + BARRA.x1) / 2, 0.006, (BARRA.z0 + BARRA.z1) / 2],
        e: [1.8, 1, BARRA.z1 - BARRA.z0 + 0.8],
      },
      { p: [DESCANSO.sofa.x, 0.006, DESCANSO.sofa.z], e: [1.8, 1, 3.4] },
      { p: [ESPERA.mesa.x, 0.006, ESPERA.mesa.z], e: [4, 1, 2] },
      { p: [PRIVADO.mesa.x, 0.006, PRIVADO.mesa.z], e: [6, 1, 2] },
      {
        p: [(AULA.gradas.x0 + AULA.gradas.x1) / 2, 0.006, (AULA.gradas.z0 + AULA.gradas.z1) / 2],
        e: [6.4, 1, 5.4],
      },
      ...JARDINERAS.map((j): Item => ({ p: [j.x, 0.006, j.z], e: [1.7, 1, 1.7] })),
    ];

    // Alfombras: definen cada lugar sin pintar el piso.
    const alfombras: Item[] = [
      { p: [-14, 0.004, -8.2], e: [7.4, 1, 9] },
      { p: [PRIVADO.mesa.x, 0.004, PRIVADO.mesa.z], e: [5.6, 1, 3.6] },
      { p: [16.4, 0.004, -4.6], e: [3.2, 1, 4] },
      { p: [QUIOSCO.x, 0.004, (QUIOSCO.z + PUFS.z) / 2 + 0.4], e: [5, 1, 3.6] },
      { p: [ESPERA.mesa.x, 0.004, ESPERA.mesa.z], e: [4.2, 1, 2.8] },
    ];
    return {
      montantes,
      travesanos,
      vidrios,
      marcos,
      murosAula,
      listones,
      columnas,
      capiteles,
      baffles,
      macetas,
      cantos,
      hojas,
      hojasClaras,
      sombras,
      alfombras,
    };
  }, []);

  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[CENTRO_X, 0, CENTRO_Z]} receiveShadow>
        <planeGeometry args={[ANCHO, FONDO]} />
        <meshStandardMaterial
          {...acabadoPisoCatalogo(paleta, piso, '#ffffff', 0.42)}
          metalness={0.06}
          envMapIntensity={1.4}
        />
      </mesh>
      {/* Canto de la losa: el corte del piso hacia la cámara. */}
      <mesh position={[CENTRO_X, -0.3, SALA.z1 + 0.02]} material={mat.tinta}>
        <boxGeometry args={[ANCHO + 0.4, 0.6, 0.04]} />
      </mesh>
      <mesh position={[CENTRO_X, 0.015, SALA.z1 - 0.03]} material={mat.laton}>
        <boxGeometry args={[ANCHO, 0.03, 0.06]} />
      </mesh>
      {/* Losa del cielo raso sobre el fondo, para que el corte se lea como un piso de edificio. */}
      <mesh position={[CENTRO_X, SALA.alto + 0.12, SALA.z0 + 0.5]} material={mat.tinta}>
        <boxGeometry args={[ANCHO + 0.4, 0.24, 1]} />
      </mesh>
      <Ciudad />
      <Fachada />
      <Instancias items={piezas.vidrios} geometria={geo.caja} material={mat.vidrio} />
      <Instancias items={piezas.montantes} geometria={geo.caja} material={mat.metal} />
      <Instancias items={piezas.travesanos} geometria={geo.caja} material={mat.metal} />
      <Instancias items={piezas.marcos} geometria={geo.caja} material={mat.laton} />
      <Instancias items={piezas.murosAula} geometria={geo.caja} material={mat.tinta} />
      <Instancias items={piezas.listones} geometria={geo.caja} material={mat.nogalPanel} />
      <Instancias items={piezas.columnas} geometria={geo.caja} material={mat.hormigon} />
      <Instancias items={piezas.capiteles} geometria={geo.caja} material={mat.laton} />
      <Instancias items={piezas.baffles} geometria={geo.caja} material={mat.nogalPanel} />
      <Instancias items={piezas.macetas} geometria={geo.caja} material={mat.maceta} />
      <Instancias items={piezas.cantos} geometria={geo.caja} material={mat.laton} />
      <Instancias items={piezas.hojas} geometria={geo.hojas} material={mat.hoja} />
      <Instancias items={piezas.hojasClaras} geometria={geo.hojas} material={mat.hojaClara} />
      <Instancias items={piezas.alfombras} geometria={geo.plano} material={mat.alfombra} />
      <Instancias items={piezas.sombras} geometria={geo.plano} material={mat.sombra} />
      <Charcos />
    </>
  );
}

/** La ciudad a la hora azul detrás de los ventanales: tres planos lejanos, sin niebla. */
function Ciudad() {
  const { guardar, paleta } = useRecursos();
  const ciudad = useLienzo(2048, 640, dibujarCiudad);
  const tinte = emisivoDe(paleta, 'ciudad', { color: '#ffffff', fuerza: 0.85 });
  const material = useMemo(() => {
    ciudad.wrapS = RepeatWrapping;
    ciudad.repeat.set(1.4, 1);
    return guardar(
      new MeshBasicMaterial({
        map: ciudad,
        toneMapped: false,
        fog: false,
        color: new Color(tinte.color).multiplyScalar(tinte.fuerza),
      }),
    );
  }, [ciudad, tinte.color, tinte.fuerza, guardar]);
  return (
    <>
      <mesh position={[0, 4, -42]} material={material}>
        <planeGeometry args={[150, 44]} />
      </mesh>
      <mesh position={[-48, 4, -6]} rotation={[0, Math.PI / 2, 0]} material={material}>
        <planeGeometry args={[100, 44]} />
      </mesh>
      <mesh position={[48, 4, -6]} rotation={[0, -Math.PI / 2, 0]} material={material}>
        <planeGeometry args={[100, 44]} />
      </mesh>
    </>
  );
}

/** Los pisos de abajo, bajo el corte: la sala queda en lo alto de una torre de vidrio. */
function Fachada() {
  const { guardar, paleta } = useRecursos();
  const fachada = useLienzo(1024, 512, dibujarFachada);
  const tinte = emisivoDe(paleta, 'fachada', { color: '#ffffff', fuerza: 0.8 });
  const material = useMemo(() => {
    fachada.wrapS = fachada.wrapT = RepeatWrapping;
    fachada.repeat.set(1, 1.25);
    return guardar(
      new MeshBasicMaterial({
        map: fachada,
        toneMapped: false,
        fog: false,
        color: new Color(tinte.color).multiplyScalar(tinte.fuerza),
      }),
    );
  }, [fachada, tinte.color, tinte.fuerza, guardar]);
  return (
    <mesh position={[CENTRO_X, -0.6 - 9, SALA.z1 + 0.05]} material={material}>
      <planeGeometry args={[ANCHO + 0.4, 18]} />
    </mesh>
  );
}

/**
 * Charcos de luz en el piso (suma, sin luz real): el muro de datos baña el frente de los bancos y
 * cada lámpara deja su mancha cálida. Es lo que da volumen a la luz sin pagar sombras ni reflejos.
 */
function Charcos() {
  const { mat, geo, paleta, guardar } = useRecursos();
  const materiales = useMemo(() => {
    const de = (hex: string, fuerza: number, clave?: string) => {
      const e = clave ? emisivoDe(paleta, clave, { color: hex, fuerza }) : { color: hex, fuerza };
      const m = guardar(mat.charco.clone());
      m.color = new Color(e.color).multiplyScalar(e.fuerza);
      return m;
    };
    return {
      muro: de('#5aa9ff', 0.32, 'charcoMuro'),
      muroCalido: de('#ffb36b', 0.18, 'charcoMuroCalido'),
      equipos: COLOR_EQUIPO.map((c) => de(c, 0.22)),
      ambar: de('#ffb36b', 0.24, 'charcoAmbar'),
    };
  }, [mat, paleta, guardar]);
  const items = useMemo(() => {
    const muro: Item[] = [{ p: [0, 0.012, -9.6], e: [MURO_LED.ancho + 4, 1, 7] }];
    const muroCalido: Item[] = [{ p: [0, 0.013, -11.2], e: [MURO_LED.ancho * 0.7, 1, 3] }];
    const equipos: Item[][] = Array.from({ length: EQUIPOS }, (_, i) => [
      { p: [centroEquipo(i + 1), 0.014, -6.5], e: [7.5, 1, 6.5] },
    ]);
    const ambar: Item[] = [
      ...MESAS.map((m): Item => ({ p: [m.x, 0.015, m.z + 0.4], e: [5, 1, 4.4] })),
      { p: [14.6, 0.015, (BARRA.z0 + BARRA.z1) / 2], e: [4, 1, BARRA.z1 - BARRA.z0 + 2] },
      { p: [PRIVADO.mesa.x, 0.015, PRIVADO.mesa.z], e: [6, 1, 4] },
      { p: [QUIOSCO.x, 0.015, QUIOSCO.z + 1.6], e: [5.5, 1, 3.6] },
      { p: [-14, 0.015, -10.4], e: [8, 1, 5] },
    ];
    return { muro, muroCalido, equipos, ambar };
  }, []);
  return (
    <>
      <Instancias items={items.muro} geometria={geo.plano} material={materiales.muro} />
      <Instancias items={items.muroCalido} geometria={geo.plano} material={materiales.muroCalido} />
      {items.equipos.map((it, i) => (
        <Instancias key={i} items={it} geometria={geo.plano} material={materiales.equipos[i]!} />
      ))}
      <Instancias items={items.ambar} geometria={geo.plano} material={materiales.ambar} />
    </>
  );
}
