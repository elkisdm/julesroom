import { Color } from 'three';
import type { Texture } from 'three';
import type { Pantalla } from '../../../escenarios/tipos';
import { tocable } from '../trading/Instancias';
import { useLienzo, useSuperficie } from '../trading/lienzo';
import type { ContenidoExterno } from '../trading/lienzo';
import { useRecursos } from './recursos';
import {
  ATLAS_MONITOR,
  dibujarAtlasMonitores,
  dibujarPresentacion,
  dibujarTablero,
} from './texturas';

/** Brillo de las pantallas: de día, apenas sobre 1 para que se lean como luz sin quemarse. */
const BRILLO = new Color('#ffffff').multiplyScalar(0.98);

type Externos = Readonly<Record<string, ContenidoExterno>>;

/** Pantalla plana con marco de acero, según los datos de su `Pantalla`. */
function Panel({
  pantalla,
  textura,
  marco = 0.08,
  alTocar,
}: {
  pantalla: Pantalla;
  textura: Texture;
  marco?: number;
  alTocar?: () => void;
}) {
  const { mat } = useRecursos();
  return (
    <group position={[pantalla.x, pantalla.y, pantalla.z]} rotation={[0, pantalla.giro, 0]}>
      <mesh position={[0, 0, -0.03]} material={mat.acero}>
        <boxGeometry args={[pantalla.ancho + marco * 2, pantalla.alto + marco * 2, 0.06]} />
      </mesh>
      <mesh position={[0, 0, 0.002]} {...(alTocar ? tocable(alTocar) : {})}>
        <planeGeometry args={[pantalla.ancho, pantalla.alto]} />
        <meshBasicMaterial map={textura} color={BRILLO} toneMapped={false} />
      </mesh>
    </group>
  );
}

/**
 * Las pantallas de la oficina: el tablero del equipo al fondo, la presentación de la sala de reunión y
 * un monitor por mesa larga que puede recibir contenido de fuera (`contenidoPantallas['monitor:k']`).
 */
export function Pantallas({
  pantallas,
  externos,
  alInteres,
}: {
  pantallas: readonly Pantalla[];
  externos: Externos;
  alInteres: (id: string) => void;
}) {
  const de = (id: string) => {
    const p = pantallas.find((x) => x.id === id);
    if (!p) throw new Error(`Pantalla desconocida en la oficina: ${id}`);
    return p;
  };
  const tablero = useSuperficie(externos.tablero, useLienzo(1920, 720, dibujarTablero));
  const reunion = useSuperficie(externos.reunion, useLienzo(1280, 720, dibujarPresentacion));
  // La primera celda del atlas (la de código): el resto cae fuera del lienzo.
  const codigo = useLienzo(ATLAS_MONITOR.celda.w, ATLAS_MONITOR.celda.h, dibujarAtlasMonitores);
  return (
    <>
      <Panel
        pantalla={de('tablero')}
        textura={tablero}
        marco={0.1}
        alTocar={() => alInteres('tablero')}
      />
      <Panel pantalla={de('reunion')} textura={reunion} alTocar={() => alInteres('reunion')} />
      {pantallas
        .filter((p) => p.id.startsWith('monitor:'))
        .map((p) => (
          <Monitor key={p.id} pantalla={p} externo={externos[p.id]} propia={codigo} />
        ))}
    </>
  );
}

/** Monitor de una mesa: muestra lo que llegue de fuera o su pantalla de código. */
function Monitor({
  pantalla,
  externo,
  propia,
}: {
  pantalla: Pantalla;
  externo: ContenidoExterno | undefined;
  propia: Texture;
}) {
  const textura = useSuperficie(externo, propia);
  return (
    <mesh
      position={[pantalla.x, pantalla.y, pantalla.z + 0.001]}
      rotation={[-0.05, pantalla.giro, 0, 'YXZ']}
    >
      <planeGeometry args={[pantalla.ancho, pantalla.alto]} />
      <meshBasicMaterial map={textura} color={BRILLO} toneMapped={false} />
    </mesh>
  );
}
