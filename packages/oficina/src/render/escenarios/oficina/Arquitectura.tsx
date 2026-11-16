import { acabadoPisoCatalogo } from '../../acabadoPisoCatalogo';
import { useEffect, useMemo } from 'react';
import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  Color,
  ExtrudeGeometry,
  Float32BufferAttribute,
  LinearFilter,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Path,
  RepeatWrapping,
  Shape,
  SRGBColorSpace,
} from 'three';
import {
  COCINA,
  COLUMNAS,
  DIENTES,
  MESA,
  MESA_ALTA,
  MESAS,
  MESAS_ALTAS,
  PROFUNDIDAD_DIENTE,
  REUNION,
  SALA,
  SOL_FRANJAS,
  TABLERO,
  VENTANA_Y,
  VENTANAS_ESTE,
  VENTANAS_FONDO,
  VENTANAS_OESTE,
} from '../../../escenarios/oficina/plano';
import { colorDe, emisivoDe } from '../../../escenarios/variantes';
import { Instancias } from '../trading/Instancias';
import type { Item } from '../trading/Instancias';
import { useLienzo } from '../trading/lienzo';
import { aleatorio } from '../trading/mercado';
import { CAJA_FRANJAS, PARTELUZ, poligonosDeSol, uvFranja } from './franjas';
import { useRecursos } from './recursos';
import { dibujarCemento, dibujarFranjas } from './texturas';

const ANCHO = SALA.x1 - SALA.x0;
const FONDO = SALA.z1 - SALA.z0;
const CENTRO_X = (SALA.x0 + SALA.x1) / 2;
const CENTRO_Z = (SALA.z0 + SALA.z1) / 2;
/** Grosor de los muros de ladrillo. */
const GROSOR = 0.3;
/** Altura del zócalo de la losa: el piso de la nave está sobre el patio. */
const ZOCALO = 0.32;
/** Lado de los vidrios de los ventanales de taller (m). */
const VIDRIO = { ancho: 0.5, alto: 0.45 } as const;
const BARRA = 0.045;

/** Perfil del hastial (u = z, v = y): sube por el faldón de cada diente y cae por su vidriera. */
function perfilHastial(): [number, number][] {
  const puntos: [number, number][] = [
    [SALA.z0 - GROSOR, 0],
    [SALA.z1, 0],
    [SALA.z1, SALA.alto],
  ];
  for (const z of [...DIENTES].reverse()) {
    puntos.push([z, SALA.cumbrera]);
    if (z !== SALA.z0) puntos.push([z, SALA.alto]);
  }
  puntos.push([SALA.z0 - GROSOR, SALA.cumbrera]);
  return puntos;
}

/** Muro de ladrillo extruido (UV en metros) con los vanos de sus ventanas. */
function muroConVanos(
  contorno: readonly [number, number][],
  vanos: readonly { u0: number; u1: number; v0: number; v1: number }[],
): ExtrudeGeometry {
  const forma = new Shape();
  forma.moveTo(contorno[0]![0], contorno[0]![1]);
  for (const [u, v] of contorno.slice(1)) forma.lineTo(u, v);
  forma.closePath();
  for (const w of vanos) {
    const h = new Path();
    h.moveTo(w.u0, w.v0);
    h.lineTo(w.u0, w.v1);
    h.lineTo(w.u1, w.v1);
    h.lineTo(w.u1, w.v0);
    h.closePath();
    forma.holes.push(h);
  }
  return new ExtrudeGeometry(forma, { depth: GROSOR, bevelEnabled: false });
}

/**
 * Bastidor de un ventanal de taller: marco, montantes y travesaños de acero negro que dejan vidrios de
 * `VIDRIO`, en un plano vertical. `eje` dice hacia dónde corre el ancho (x en el fondo, z en los costados).
 */
function bastidor(
  eje: 'x' | 'z',
  fijo: number,
  u0: number,
  u1: number,
  v0: number,
  v1: number,
  barras: Item[],
  vidrios: Item[],
) {
  const pon = (u: number, v: number, du: number, dv: number, prof: number) =>
    eje === 'x'
      ? {
          p: [u, v, fijo] as [number, number, number],
          e: [du, dv, prof] as [number, number, number],
        }
      : {
          p: [fijo, v, u] as [number, number, number],
          e: [prof, dv, du] as [number, number, number],
        };
  const nu = Math.max(1, Math.round((u1 - u0) / VIDRIO.ancho));
  const nv = Math.max(1, Math.round((v1 - v0) / VIDRIO.alto));
  for (let i = 0; i <= nu; i++) {
    const u = u0 + ((u1 - u0) * i) / nu;
    const grueso = i === 0 || i === nu || i % 4 === 0;
    barras.push(pon(u, (v0 + v1) / 2, grueso ? 0.09 : BARRA, v1 - v0, grueso ? 0.14 : 0.06));
  }
  for (let j = 0; j <= nv; j++) {
    const v = v0 + ((v1 - v0) * j) / nv;
    const grueso = j === 0 || j === nv;
    barras.push(pon((u0 + u1) / 2, v, u1 - u0, grueso ? 0.09 : BARRA, grueso ? 0.14 : 0.06));
  }
  vidrios.push(pon((u0 + u1) / 2, (v0 + v1) / 2, u1 - u0, v1 - v0, 0.02));
}

/**
 * La nave: piso de cemento pulido sobre su zócalo, muros de ladrillo encalado con ventanales de taller
 * de acero negro, hastiales en diente de sierra (se leen en el corte) con su albardilla, la banda de
 * vidrio alta del fondo (la vidriera del primer diente), columnas de acero, las franjas de sol de la
 * mañana sobre el piso y las mesas, sombras de contacto y el patio con árboles alrededor.
 */
export function Arquitectura() {
  const { mat, geo, guardar, paleta } = useRecursos();
  const piso = useLienzo(1024, 1024, dibujarCemento);
  useMemo(() => {
    piso.wrapS = piso.wrapT = RepeatWrapping;
    piso.repeat.set(ANCHO / 4, FONDO / 4);
  }, [piso]);

  const muros = useMemo(() => {
    const fondo = guardar(
      muroConVanos(
        [
          [SALA.x0 - GROSOR, 0],
          [SALA.x1 + GROSOR, 0],
          [SALA.x1 + GROSOR, SALA.alto],
          [SALA.x0 - GROSOR, SALA.alto],
        ],
        VENTANAS_FONDO.map((v) => ({ u0: v.x0, u1: v.x1, v0: VENTANA_Y.y0, v1: VENTANA_Y.y1 })),
      ),
    );
    const vanos = (lista: readonly { z0: number; z1: number }[]) =>
      lista.map((v) => ({ u0: v.z0, u1: v.z1, v0: VENTANA_Y.y0, v1: VENTANA_Y.y1 }));
    const oeste = guardar(muroConVanos(perfilHastial(), vanos(VENTANAS_OESTE)));
    const este = guardar(muroConVanos(perfilHastial(), vanos(VENTANAS_ESTE)));
    return { fondo, oeste, este };
  }, [guardar]);

  const piezas = useMemo(() => {
    const barras: Item[] = [];
    const vidrios: Item[] = [];
    for (const v of VENTANAS_FONDO)
      bastidor('x', SALA.z0 - GROSOR / 2, v.x0, v.x1, VENTANA_Y.y0, VENTANA_Y.y1, barras, vidrios);
    for (const v of VENTANAS_ESTE)
      bastidor('z', SALA.x1 + GROSOR / 2, v.z0, v.z1, VENTANA_Y.y0, VENTANA_Y.y1, barras, vidrios);
    for (const v of VENTANAS_OESTE)
      bastidor('z', SALA.x0 - GROSOR / 2, v.z0, v.z1, VENTANA_Y.y0, VENTANA_Y.y1, barras, vidrios);
    // Vidriera alta del fondo (el primer diente), de un muro a otro, con paños de 1,5 × 0,6 m.
    const alta: Item[] = [];
    for (let x = SALA.x0; x <= SALA.x1 + 1e-6; x += PARTELUZ.paso)
      alta.push({
        p: [x, (SALA.alto + SALA.cumbrera) / 2, SALA.z0 - 0.15],
        e: [0.08, SALA.cumbrera - SALA.alto, 0.16],
      });
    for (const y of [SALA.alto + 0.04, SALA.alto + 0.62, SALA.alto + 1.22, SALA.cumbrera - 0.05])
      alta.push({ p: [CENTRO_X, y, SALA.z0 - 0.15], e: [ANCHO + 2 * GROSOR, 0.08, 0.18] });
    vidrios.push({
      p: [CENTRO_X, (SALA.alto + SALA.cumbrera) / 2, SALA.z0 - 0.15],
      e: [ANCHO, SALA.cumbrera - SALA.alto, 0.02],
    });

    // Albardilla de acero sobre los hastiales: sigue faldones y vidrieras del diente de sierra.
    const albardilla: Item[] = [];
    const alto = SALA.cumbrera - SALA.alto;
    const largo = Math.hypot(PROFUNDIDAD_DIENTE, alto);
    const angulo = Math.atan2(alto, PROFUNDIDAD_DIENTE);
    for (const x of [SALA.x0 - GROSOR / 2, SALA.x1 + GROSOR / 2])
      for (const z of DIENTES) {
        albardilla.push({
          p: [x, (SALA.alto + SALA.cumbrera) / 2 + 0.04, z + PROFUNDIDAD_DIENTE / 2],
          e: [GROSOR + 0.08, 0.1, largo],
          rx: angulo,
        });
        albardilla.push({
          p: [x, (SALA.alto + SALA.cumbrera) / 2, z],
          e: [GROSOR + 0.08, alto, 0.1],
        });
      }
    albardilla.push({
      p: [CENTRO_X, SALA.cumbrera + 0.05, SALA.z0 - 0.15],
      e: [ANCHO + 0.7, 0.1, GROSOR + 0.08],
    });

    // Columnas de acero (perfil doble T) con su placa base.
    const columnas: Item[] = COLUMNAS.flatMap((c): Item[] => [
      { p: [c.x, SALA.alto / 2, c.z], e: [0.2, SALA.alto, 0.2] },
      { p: [c.x, 0.02, c.z], e: [0.4, 0.04, 0.4] },
      { p: [c.x, SALA.alto - 0.1, c.z], e: [0.32, 0.06, 0.32] },
    ]);

    // Sombras de contacto bajo lo grande (oclusión barata).
    const sombras: Item[] = [
      ...MESAS.map((m): Item => ({
        p: [m.x, 0.006, m.z],
        e: [MESA.largo + 0.8, 1, MESA.fondo + 1.4],
      })),
      ...MESAS_ALTAS.map((t): Item => ({
        p: [t.x, 0.006, t.z],
        e: [MESA_ALTA.radio * 4, 1, MESA_ALTA.radio * 4],
      })),
      { p: [REUNION.mesa.x, 0.006, REUNION.mesa.z], e: [REUNION.mesa.ancho + 0.8, 1, 2.4] },
      {
        p: [(COCINA.isla.x0 + COCINA.isla.x1) / 2, 0.006, (COCINA.isla.z0 + COCINA.isla.z1) / 2],
        e: [2.6, 1, COCINA.isla.z1 - COCINA.isla.z0 + 1],
      },
      {
        p: [(COCINA.encimera.x0 + COCINA.encimera.x1) / 2, 0.006, SALA.z0 + 0.5],
        e: [7.4, 1, 1.6],
      },
      {
        p: [TABLERO.credenza.x, 0.006, TABLERO.credenza.z],
        e: [TABLERO.credenza.ancho + 1, 1, 1.2],
      },
      // Pie de los muros: un poco de oscuridad donde el piso se encuentra con el ladrillo.
      { p: [CENTRO_X, 0.005, SALA.z0 + 0.3], e: [ANCHO, 1, 1.2] },
      { p: [SALA.x0 + 0.3, 0.005, CENTRO_Z], e: [1.2, 1, FONDO] },
      { p: [SALA.x1 - 0.3, 0.005, CENTRO_Z], e: [1.2, 1, FONDO] },
    ];
    // Zócalo de acero al pie de los muros: asienta el ladrillo sobre el cemento.
    const zocalos: Item[] = [
      { p: [CENTRO_X, 0.06, SALA.z0 + 0.01], e: [ANCHO, 0.12, 0.03] },
      { p: [SALA.x0 + 0.01, 0.06, CENTRO_Z], e: [0.03, 0.12, FONDO] },
      { p: [SALA.x1 - 0.01, 0.06, CENTRO_Z], e: [0.03, 0.12, FONDO] },
    ];
    return { barras, vidrios, alta, albardilla, columnas, sombras, zocalos };
  }, []);

  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[CENTRO_X, 0, CENTRO_Z]} receiveShadow>
        <planeGeometry args={[ANCHO, FONDO]} />
        <meshStandardMaterial
          {...acabadoPisoCatalogo(paleta, piso, '#d6cdc0', 0.5)}
          metalness={0}
          envMapIntensity={0.7}
        />
      </mesh>
      {/* Zócalo de la losa en el corte. */}
      <mesh position={[CENTRO_X, -ZOCALO / 2, SALA.z1 + 0.15]} material={mat.cemento}>
        <boxGeometry args={[ANCHO + 2 * GROSOR, ZOCALO, 0.3]} />
      </mesh>
      <mesh position={[CENTRO_X, 0.012, SALA.z1 - 0.02]} material={mat.acero}>
        <boxGeometry args={[ANCHO, 0.024, 0.05]} />
      </mesh>
      <mesh
        geometry={muros.fondo}
        material={mat.ladrillo}
        position={[0, 0, SALA.z0 - GROSOR]}
        castShadow
        receiveShadow
      />
      <mesh
        geometry={muros.oeste}
        material={mat.ladrillo}
        position={[SALA.x0, 0, 0]}
        rotation={[0, -Math.PI / 2, 0]}
        castShadow
        receiveShadow
      />
      <mesh
        geometry={muros.este}
        material={mat.ladrillo}
        position={[SALA.x1 + GROSOR, 0, 0]}
        rotation={[0, -Math.PI / 2, 0]}
        castShadow
        receiveShadow
      />
      <Instancias items={piezas.vidrios} geometria={geo.caja} material={mat.vidrio} />
      <Instancias items={piezas.barras} geometria={geo.caja} material={mat.acero} />
      <Instancias items={piezas.alta} geometria={geo.caja} material={mat.acero} />
      <Instancias items={piezas.albardilla} geometria={geo.caja} material={mat.acero} />
      <Instancias
        items={[...piezas.columnas, ...piezas.zocalos]}
        geometria={geo.caja}
        material={mat.acero}
      />
      <Instancias items={piezas.sombras} geometria={geo.plano} material={mat.sombra} />
      <SolDeLaManana />
      <Patio />
    </>
  );
}

/** Superficies horizontales donde también cae la franja: cubiertas de mesas, isla, encimera, credenza. */
function superficies(): { x0: number; x1: number; z0: number; z1: number; y: number }[] {
  const s: { x0: number; x1: number; z0: number; z1: number; y: number }[] = [];
  for (const m of MESAS)
    s.push({
      x0: m.x - MESA.largo / 2,
      x1: m.x + MESA.largo / 2,
      z0: m.z - MESA.fondo / 2,
      z1: m.z + MESA.fondo / 2,
      y: MESA.alto + 0.031,
    });
  for (const t of MESAS_ALTAS)
    s.push({
      x0: t.x - 0.4,
      x1: t.x + 0.4,
      z0: t.z - 0.4,
      z1: t.z + 0.4,
      y: MESA_ALTA.alto + 0.031,
    });
  s.push({ ...COCINA.isla, y: COCINA.isla.alto + 0.041 });
  s.push({ ...COCINA.encimera, y: COCINA.encimera.alto + 0.031 });
  s.push({
    x0: REUNION.mesa.x - REUNION.mesa.ancho / 2,
    x1: REUNION.mesa.x + REUNION.mesa.ancho / 2,
    z0: REUNION.mesa.z - REUNION.mesa.fondo / 2,
    z1: REUNION.mesa.z + REUNION.mesa.fondo / 2,
    y: 0.781,
  });
  const c = TABLERO.credenza;
  s.push({
    x0: c.x - c.ancho / 2,
    x1: c.x + c.ancho / 2,
    z0: c.z - c.fondo / 2,
    z1: c.z + c.fondo / 2,
    y: c.alto + 0.006,
  });
  return s;
}

/**
 * Las franjas de sol que entran por las vidrieras del diente de sierra y los ventanales: un lienzo con
 * los paños proyectados, sumado sobre el piso y sobre las cubiertas (que leen el lienzo donde cae su rayo).
 */
function SolDeLaManana() {
  const { guardar, paleta } = useRecursos();
  const recursos = useMemo(() => {
    const sol = paleta.sol ?? SOL_FRANJAS;
    const franjas = emisivoDe(paleta, 'franjas', { color: '#ffc277', fuerza: 0.27 });
    const lienzo = document.createElement('canvas');
    lienzo.width = 2048;
    lienzo.height = Math.round((2048 * FONDO) / ANCHO);
    const ctx = lienzo.getContext('2d');
    if (!ctx) throw new Error('No se pudo crear el lienzo de las franjas de sol');
    dibujarFranjas(ctx, lienzo.width, lienzo.height, poligonosDeSol(sol));
    const textura = new CanvasTexture(lienzo);
    textura.colorSpace = SRGBColorSpace;
    textura.minFilter = LinearFilter;
    textura.generateMipmaps = false;
    const material = guardar(
      new MeshBasicMaterial({
        map: textura,
        color: new Color(franjas.color).multiplyScalar(franjas.fuerza),
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    );
    // Piso + cubiertas en una sola geometría (un draw call).
    const rects = [
      {
        x0: CAJA_FRANJAS.x0,
        x1: CAJA_FRANJAS.x1,
        z0: CAJA_FRANJAS.z0,
        z1: CAJA_FRANJAS.z1,
        y: 0.01,
      },
      ...superficies(),
    ];
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    rects.forEach((r, i) => {
      const esquinas: [number, number][] = [
        [r.x0, r.z1],
        [r.x1, r.z1],
        [r.x1, r.z0],
        [r.x0, r.z0],
      ];
      for (const [x, z] of esquinas) {
        pos.push(x, r.y, z);
        uv.push(...uvFranja(x, z, r.y, sol));
      }
      const b = i * 4;
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    });
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeBoundingSphere();
    guardar(g);
    return { g, material, textura };
  }, [guardar, paleta]);
  useEffect(() => () => recursos.textura.dispose(), [recursos]);
  return <mesh geometry={recursos.g} material={recursos.material} renderOrder={2} />;
}

/** El patio alrededor de la nave: pavimento junto a los muros, pasto, árboles con su sombra al oeste. */
function Patio() {
  const { mat, geo, paleta, guardar } = useRecursos();
  const pavimento = useMemo(
    () =>
      guardar(
        new MeshStandardMaterial({
          color: colorDe(paleta, 'pavimento', '#cbc3b5'),
          roughness: 0.95,
        }),
      ),
    [guardar, paleta],
  );
  const ladrilloVecino = useMemo(
    () =>
      guardar(
        new MeshStandardMaterial({
          color: colorDe(paleta, 'ladrilloVecino', '#c99a7c'),
          roughness: 0.95,
        }),
      ),
    [guardar, paleta],
  );
  const vidrioVecino = useMemo(
    () => guardar(new MeshBasicMaterial({ color: colorDe(paleta, 'vidrioVecino', '#eaf3f5') })),
    [guardar, paleta],
  );
  const ventanaVecina = useMemo(
    () =>
      guardar(
        new MeshStandardMaterial({
          color: colorDe(paleta, 'ventanaVecina', '#56656e'),
          roughness: 0.35,
          metalness: 0.2,
        }),
      ),
    [guardar, paleta],
  );
  const zinc = useMemo(
    () =>
      guardar(
        new MeshStandardMaterial({
          color: colorDe(paleta, 'zinc', '#7f898f'),
          roughness: 0.6,
          metalness: 0.3,
        }),
      ),
    [guardar, paleta],
  );
  const tronco = useMemo(
    () => guardar(new MeshStandardMaterial({ color: '#6b5240', roughness: 0.9 })),
    [guardar],
  );
  const arboles = useMemo(() => {
    const rnd = aleatorio(23);
    const puntos: [number, number][] = [
      [-21, -15.5],
      [-12, -16.5],
      [-3, -17],
      [6, -16],
      [14, -17.5],
      [22, -15],
      [-27, -19.4],
      [-16.5, -19.6],
      [-7.5, -19.3],
      [1.5, -19.6],
      [10, -19.4],
      [19, -19.6],
      [28, -19.3],
      [-23, -6],
      [23.5, -5],
      [-22.5, 4.5],
      [23, 6],
      [-20, 12],
      [21, 12.5],
    ];
    const troncos: Item[] = [];
    const copas: Item[] = [];
    const copasClaras: Item[] = [];
    const sombras: Item[] = [];
    for (const [x, z] of puntos) {
      const alto = 4.2 + rnd() * 2.4;
      troncos.push({ p: [x, alto / 2 - ZOCALO, z], e: [0.28, alto, 0.28] });
      for (let k = 0; k < 11; k++) {
        const a = k * 1.9 + rnd();
        const r = 0.4 + rnd() * 1.1;
        (k % 2 ? copasClaras : copas).push({
          p: [x + Math.cos(a) * r, alto - 0.4 + rnd() * 1.6 - ZOCALO, z + Math.sin(a) * r],
          e: [1.3 + rnd() * 0.7, 1.1 + rnd() * 0.6, 1.3 + rnd() * 0.7],
          r: a,
        });
      }
      sombras.push({ p: [x - 2.6, -ZOCALO + 0.01, z + 0.6], e: [5.5, 1, 4.2] });
    }
    // Banda de pavimento alrededor de la nave.
    const losas: Item[] = [
      { p: [CENTRO_X, -ZOCALO + 0.005, SALA.z1 + 2.2], e: [ANCHO + 6, 1, 4.4] },
      { p: [CENTRO_X, -ZOCALO + 0.005, SALA.z0 - 2], e: [ANCHO + 6, 1, 4] },
      { p: [SALA.x0 - 1.7, -ZOCALO + 0.005, CENTRO_Z], e: [3.4, 1, FONDO + 8] },
      { p: [SALA.x1 + 1.7, -ZOCALO + 0.005, CENTRO_Z], e: [3.4, 1, FONDO + 8] },
    ];
    // Jardineras bajas al frente, fuera de la nave: el borde inferior del cuadro no queda vacío.
    const jardineras: Item[] = [];
    for (let x = SALA.x0 + 1.5; x < SALA.x1 - 1; x += 4.2) {
      jardineras.push({ p: [x + 1.2, -ZOCALO + 0.2, SALA.z1 + 5.6], e: [3, 0.4, 0.9] });
      for (let k = 0; k < 6; k++)
        (k % 2 ? copasClaras : copas).push({
          p: [
            x + 0.1 + k * 0.45,
            -ZOCALO + 0.55 + rnd() * 0.15,
            SALA.z1 + 5.6 + (rnd() - 0.5) * 0.3,
          ],
          e: [0.6 + rnd() * 0.2, 0.45 + rnd() * 0.15, 0.6],
          r: k,
        });
    }
    // Naves vecinas al fondo, de ladrillo sin encalar, con su propio diente de sierra (se ven desde arriba).
    const naves: Item[] = [];
    const faldones: Item[] = [];
    const vidrieras: Item[] = [];
    const pilastras: Item[] = [];
    const ventanas: Item[] = [];
    const alto = 1.6;
    const largo = Math.hypot(PROFUNDIDAD_DIENTE, alto);
    const angulo = Math.atan2(alto, PROFUNDIDAD_DIENTE);
    for (const [x0, x1] of [
      [-36, -3.5],
      [3.5, 36],
    ] as const) {
      const z0 = -45;
      const z1 = -20;
      const cx = (x0 + x1) / 2;
      naves.push({
        p: [cx, (SALA.alto - ZOCALO) / 2 - ZOCALO / 2, (z0 + z1) / 2],
        e: [x1 - x0, SALA.alto + ZOCALO, z1 - z0],
      });
      // Fachada que ve la cámara: cornisa, pilastras y una hilera de ventanas oscuras, para que no sea un plano liso.
      naves.push({ p: [cx, SALA.alto + 0.12, z1 + 0.12], e: [x1 - x0 + 0.4, 0.3, 0.5] });
      for (let x = x0 + 3; x < x1 - 1; x += 6)
        pilastras.push({
          p: [x, (SALA.alto - ZOCALO) / 2 - ZOCALO / 2, z1 + 0.1],
          e: [0.55, SALA.alto + ZOCALO, 0.2],
        });
      for (let x = x0 + 4.5; x < x1 - 2; x += 3) {
        ventanas.push({ p: [x, 2.7, z1 + 0.04], e: [1.7, 1.7, 0.08] });
        ventanas.push({ p: [x, 0.9, z1 + 0.04], e: [1.7, 0.7, 0.08] });
      }
      for (let z = z0; z < z1 - 1e-6; z += PROFUNDIDAD_DIENTE) {
        // Al revés que la nave propia: la vidriera mira a la cámara y se lee como una franja clara.
        faldones.push({
          p: [cx, SALA.alto + alto / 2 + 0.05, z + PROFUNDIDAD_DIENTE / 2],
          e: [x1 - x0, 0.12, largo],
          rx: -angulo,
        });
        vidrieras.push({
          p: [cx, SALA.alto + alto / 2, z + PROFUNDIDAD_DIENTE - 0.02],
          e: [x1 - x0 - 0.4, alto, 0.06],
        });
      }
    }
    // Terraza al frente: mesas con quitasoles terracota y salvia (desde arriba, círculos de color).
    const quitasoles: Item[][] = [[], []];
    const mesitas: Item[] = [];
    [-12, -4, 4, 12].forEach((x, i) => {
      const z = SALA.z1 + 2.6;
      quitasoles[i % 2]!.push({ p: [x, 2.1 - ZOCALO, z], e: [2.4, 0.35, 2.4] });
      mesitas.push({ p: [x, 1.1 - ZOCALO, z], e: [0.05, 2.2, 0.05] });
      mesitas.push({ p: [x, 0.72 - ZOCALO, z], e: [0.8, 0.04, 0.8] });
      for (const a of [0.4, 2.4, 4.4])
        mesitas.push({
          p: [x + Math.cos(a) * 0.75, 0.45 - ZOCALO, z + Math.sin(a) * 0.75],
          e: [0.4, 0.04, 0.4],
        });
      sombras.push({ p: [x - 0.9, -ZOCALO + 0.01, z + 0.7], e: [3.2, 1, 3] });
    });
    losas.push({ p: [CENTRO_X, -ZOCALO + 0.004, SALA.z1 + 3.2], e: [ANCHO + 6, 1, 6.4] });
    // Patio del fondo: pavimento hasta las naves vecinas.
    losas.push({ p: [CENTRO_X, -ZOCALO + 0.004, -17], e: [80, 1, 6] });
    return {
      troncos,
      copas,
      copasClaras,
      sombras,
      losas,
      jardineras,
      naves,
      faldones,
      vidrieras,
      pilastras,
      ventanas,
      quitasoles,
      mesitas,
    };
  }, []);
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -ZOCALO, 0]} material={mat.pasto}>
        <planeGeometry args={[240, 240]} />
      </mesh>
      <Instancias items={arboles.losas} geometria={geo.plano} material={pavimento} />
      <Instancias items={arboles.sombras} geometria={geo.plano} material={mat.sombra} />
      <Instancias items={arboles.jardineras} geometria={geo.caja} material={mat.cemento} />
      <Instancias items={arboles.naves} geometria={geo.caja} material={ladrilloVecino} />
      <Instancias items={arboles.pilastras} geometria={geo.caja} material={mat.cemento} />
      <Instancias items={arboles.ventanas} geometria={geo.caja} material={ventanaVecina} />
      <Instancias items={arboles.faldones} geometria={geo.caja} material={zinc} />
      <Instancias items={arboles.quitasoles[0]!} geometria={geo.campana} material={mat.terracota} />
      <Instancias items={arboles.quitasoles[1]!} geometria={geo.campana} material={mat.salvia} />
      <Instancias items={arboles.mesitas} geometria={geo.cilindroBajo} material={mat.acero} />
      <Instancias items={arboles.vidrieras} geometria={geo.caja} material={vidrioVecino} />
      <Instancias items={arboles.troncos} geometria={geo.cilindroBajo} material={tronco} />
      <Instancias items={arboles.copas} geometria={geo.hojas} material={mat.hoja} />
      <Instancias items={arboles.copasClaras} geometria={geo.hojas} material={mat.hojaClara} />
    </>
  );
}
