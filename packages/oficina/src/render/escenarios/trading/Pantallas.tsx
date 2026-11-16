import { useEffect, useLayoutEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { BackSide, Color, CylinderGeometry, MeshBasicMaterial } from 'three';
import type { Texture } from 'three';
import { MESAS, MURO_LED, NOMBRE_MERCADO, QUIOSCO } from '../../../escenarios/trading/plano';
import type { Pantalla } from '../../../escenarios/tipos';
import { tocable } from './Instancias';
import { nuevaTextura, useLienzo, useLienzoVivo, useSuperficie } from './lienzo';
import type { ContenidoExterno } from './lienzo';
import { celdaAtlas, geometriaQuads } from './quads';
import { useRecursos } from './recursos';
import {
  ATLAS_CARTEL,
  dibujarAtlasCarteles,
  dibujarAula,
  dibujarMesa,
  dibujarMuro,
  dibujarPrivado,
  dibujarQuiosco,
  medirCinta,
} from './texturas';

/** Brillo de las pantallas: algo más de 1 para que se lean como luz. */
const BRILLO = new Color('#ffffff').multiplyScalar(1.15);

type Externos = Readonly<Record<string, ContenidoExterno>>;

/** Medio ángulo del arco del muro de datos. */
const MEDIO = Math.asin(MURO_LED.ancho / 2 / MURO_LED.radio);

/**
 * Un tramo de cilindro abierto, visto por dentro, con el texto al derecho: el cilindro de three
 * recorre el ángulo de derecha a izquierda, así que se invierte la u.
 */
function arco(radio: number, alto: number, extra = 0) {
  const g = new CylinderGeometry(
    radio,
    radio,
    alto,
    96,
    1,
    true,
    Math.PI - MEDIO - extra,
    2 * (MEDIO + extra),
  );
  const uv = g.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
  uv.needsUpdate = true;
  return g;
}

/**
 * El muro de datos: pantalla curva con el gráfico grande, el mapa de activos y la agenda (se mueve
 * cada 1,2 s), su marco de latón, la cinta de cotizaciones que corre debajo y el zócalo. Tocarlo
 * avisa el interés `muro`. Si llega `contenido.muro`, la pantalla muestra eso.
 */
export function MuroLed({
  animar,
  externos,
  alTocar,
}: {
  animar: boolean;
  externos: Externos;
  alTocar: () => void;
}) {
  const { mat, guardar } = useRecursos();
  const propia = useLienzoVivo(2048, 480, dibujarMuro, 1.2, animar);
  const textura = useSuperficie(externos.muro, propia);
  const cinta = useMemo(() => {
    const medida = medirCinta();
    const { ctx, textura: t } = nuevaTextura(medida.ancho, 80, true);
    medida.dibujar(ctx, medida.ancho, 80);
    t.needsUpdate = true;
    t.repeat.set((2 * MEDIO * MURO_LED.radio) / ((medida.ancho * 0.36) / 80), 1);
    return t;
  }, []);
  useEffect(() => () => cinta.dispose(), [cinta]);
  useFrame((_, dt) => {
    if (animar) cinta.offset.x = (cinta.offset.x + dt * 0.012) % 1;
  });
  const piezas = useMemo(
    () => ({
      pantalla: guardar(arco(MURO_LED.radio, MURO_LED.alto)),
      marco: guardar(arco(MURO_LED.radio + 0.1, MURO_LED.alto + 0.28, 0.012)),
      cinta: guardar(arco(MURO_LED.radio - 0.02, 0.36)),
      zocalo: guardar(arco(MURO_LED.radio + 0.04, MURO_LED.base - 0.4, 0.012)),
      matPantalla: guardar(
        new MeshBasicMaterial({ color: BRILLO, toneMapped: false, side: BackSide }),
      ),
      matCinta: guardar(
        new MeshBasicMaterial({ map: cinta, color: BRILLO, toneMapped: false, side: BackSide }),
      ),
      matMarco: guardar(Object.assign(mat.laton.clone(), { side: BackSide })),
    }),
    [cinta, guardar, mat],
  );
  useLayoutEffect(() => {
    piezas.matPantalla.map = textura;
    piezas.matPantalla.needsUpdate = true;
  }, [piezas, textura]);
  const y = MURO_LED.base + MURO_LED.alto / 2;
  return (
    <group position={[0, 0, MURO_LED.centroZ]}>
      <mesh
        geometry={piezas.pantalla}
        material={piezas.matPantalla}
        position={[0, y, 0]}
        {...tocable(alTocar)}
      />
      <mesh geometry={piezas.marco} material={piezas.matMarco} position={[0, y, 0.001]} />
      <mesh
        geometry={piezas.cinta}
        material={piezas.matCinta}
        position={[0, MURO_LED.base - 0.22, 0]}
      />
      <mesh
        geometry={piezas.zocalo}
        material={mat.tinta}
        position={[0, (MURO_LED.base - 0.4) / 2, 0]}
      />
    </group>
  );
}

/** Pantalla plana con bisel, según los datos de su `Pantalla`. */
function Panel({
  pantalla,
  textura,
  inclinacion = 0,
  alTocar,
}: {
  pantalla: Pantalla;
  textura: Texture;
  inclinacion?: number;
  alTocar?: () => void;
}) {
  const { mat } = useRecursos();
  return (
    <group
      position={[pantalla.x, pantalla.y, pantalla.z]}
      rotation={[inclinacion, pantalla.giro, 0, 'YXZ']}
    >
      <mesh position={[0, 0, -0.04]} material={mat.bisel}>
        <boxGeometry args={[pantalla.ancho + 0.1, pantalla.alto + 0.1, 0.07]} />
      </mesh>
      <mesh {...(alTocar ? tocable(alTocar) : {})}>
        <planeGeometry args={[pantalla.ancho, pantalla.alto]} />
        <meshBasicMaterial map={textura} color={BRILLO} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Pantallas planas: aula (lección que avanza), sala privada, quiosco de videos y las de las mesas. */
export function PantallasPlanas({
  pantallas,
  animar,
  externos,
  alInteres,
}: {
  pantallas: readonly Pantalla[];
  animar: boolean;
  externos: Externos;
  alInteres: (id: string) => void;
}) {
  const de = (id: string) => {
    const p = pantallas.find((x) => x.id === id);
    if (!p) throw new Error(`Pantalla desconocida en la sala de trading: ${id}`);
    return p;
  };
  const aula = useSuperficie(externos.aula, useLienzoVivo(1600, 900, dibujarAula, 3, animar));
  const privado = useSuperficie(externos.privado, useLienzo(1024, 576, dibujarPrivado));
  const quiosco = useSuperficie(externos.videos, useLienzo(1280, 720, dibujarQuiosco));
  return (
    <>
      <Panel pantalla={de('aula')} textura={aula} alTocar={() => alInteres('aula')} />
      <Panel pantalla={de('privado')} textura={privado} alTocar={() => alInteres('privado')} />
      <Panel pantalla={de('videos')} textura={quiosco} alTocar={() => alInteres('videos')} />
      {MESAS.map((m) => (
        <PantallaMesa
          key={m.mercado}
          pantalla={de(`mesa:${m.mercado}`)}
          externo={externos[`mesa:${m.mercado}`]}
          activo={m.activo}
          alTocar={() => alInteres(`mesa:${m.mercado}`)}
        />
      ))}
      <Carteles alInteres={alInteres} />
    </>
  );
}

function PantallaMesa({
  pantalla,
  externo,
  activo,
  alTocar,
}: {
  pantalla: Pantalla;
  externo: ContenidoExterno | undefined;
  activo: (typeof MESAS)[number]['activo'];
  alTocar: () => void;
}) {
  const propia = useLienzo(768, 432, (ctx, w, h) => dibujarMesa(ctx, w, h, activo), activo);
  const textura = useSuperficie(externo, propia);
  return <Panel pantalla={pantalla} textura={textura} inclinacion={-0.42} alTocar={alTocar} />;
}

/** Carteles colgantes de las mesas, en una sola malla con su atlas. */
function Carteles({ alInteres }: { alInteres: (id: string) => void }) {
  const { mat, geo, guardar } = useRecursos();
  const atlas = useLienzo(
    ATLAS_CARTEL.celda.w,
    ATLAS_CARTEL.celda.h * ATLAS_CARTEL.filas,
    (ctx, w, h) =>
      dibujarAtlasCarteles(
        ctx,
        w,
        h,
        MESAS.map((m) => ({ nombre: NOMBRE_MERCADO[m.mercado], activo: m.activo })),
      ),
  );
  const malla = useMemo(
    () => ({
      geometria: guardar(
        geometriaQuads(
          MESAS.map((m, i) => ({
            x: m.x,
            y: 2.5,
            z: m.z - 0.45,
            ancho: 1.9,
            alto: 0.37,
            giro: 0,
            inclinacion: -0.25,
            uv: celdaAtlas(i, 1, ATLAS_CARTEL.filas),
          })),
        ),
      ),
      material: guardar(
        new MeshBasicMaterial({ map: atlas, color: BRILLO, toneMapped: false, transparent: true }),
      ),
    }),
    [atlas, guardar],
  );
  const cables = useMemo(
    () =>
      MESAS.flatMap((m) =>
        [-0.85, 0.85].map((dx) => ({
          p: [m.x + dx, (2.68 + 5.4) / 2, m.z - 0.45] as [number, number, number],
          e: [0.01, 5.4 - 2.68, 0.01] as [number, number, number],
        })),
      ),
    [],
  );
  return (
    <>
      <mesh
        geometry={malla.geometria}
        material={malla.material}
        onClick={(e) => {
          if (e.delta > 6 || e.faceIndex === undefined || e.faceIndex === null) return;
          e.stopPropagation();
          const m = MESAS[Math.floor(e.faceIndex / 2)];
          if (m) alInteres(`mesa:${m.mercado}`);
        }}
      />
      {cables.map((c, i) => (
        <mesh key={i} position={c.p} scale={c.e} geometry={geo.caja} material={mat.metal} />
      ))}
    </>
  );
}

/** El tótem de la videoteca con su tira de luz al pie (la pantalla la pone `PantallasPlanas`). */
export function LuzQuiosco() {
  const { mat } = useRecursos();
  return (
    <mesh
      position={[QUIOSCO.x, 0.05, QUIOSCO.z + QUIOSCO.fondo / 2 + 0.02]}
      material={mat.luzCalida}
    >
      <boxGeometry args={[QUIOSCO.ancho - 0.2, 0.03, 0.03]} />
    </mesh>
  );
}
