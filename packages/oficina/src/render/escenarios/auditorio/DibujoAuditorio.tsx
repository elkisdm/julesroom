import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Object3D } from 'three';
import type { Group } from 'three';
import {
  BUTACAS,
  ESCALON,
  FONDO_Z,
  PLANTAS,
  SALA,
  TARIMA,
} from '../../../escenarios/auditorio/plano';
import { registrarDibujo } from '../registroDibujo';
import type { PropsDibujo } from '../registroDibujo';
import { Instancias } from '../trading/Instancias';
import type { Item } from '../trading/Instancias';
import { crearRecursos } from '../trading/recursos';
import { useLienzo } from '../trading/lienzo';

const PARAMETROS = { focoAltura: 6, focoVelocidad: 0.22, focoAmplitud: 0.5 };
const ANCHO = SALA.x1 - SALA.x0;
const FONDO = SALA.z1 - SALA.z0;
const MEDIO_ALTO = SALA.alto / 2;
const caja = (
  x: number,
  y: number,
  z: number,
  ancho: number,
  alto: number,
  fondo: number,
): Item => ({ p: [x, y, z], e: [ancho, alto, fondo] });
const plataforma = (c: typeof TARIMA | typeof ESCALON): Item =>
  caja((c.x0 + c.x1) / 2, c.y / 2, (c.z0 + c.z1) / 2, c.x1 - c.x0, c.y, c.z1 - c.z0);

/** Un único recurso por material y una llamada por grupo de piezas, independientemente del público. */
export function DibujoAuditorio({ variante, movimiento }: PropsDibujo) {
  const r = useMemo(() => crearRecursos(variante.paleta), [variante]);
  useEffect(() => () => r.liberar(), [r]);
  const rotulos = useLienzo(1024, 512, (ctx, w, h) => {
    ctx.fillStyle = '#101a2a';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#c9a15a';
    ctx.fillRect(75, 90, 72, 8);
    ctx.fillStyle = '#fff0da';
    ctx.font = '600 80px sans-serif';
    ctx.fillText('Sala', 75, 225);
    ctx.fillText('Encuentro', 75, 325);
    ctx.fillStyle = '#c9a15a';
    ctx.font = '30px sans-serif';
    ctx.fillText('Ideas que nos reúnen', 78, 415);
  });
  const piezas = useMemo(() => {
    const asiento: Item[] = [],
      respaldo: Item[] = [],
      metal: Item[] = [];
    for (const b of BUTACAS) {
      const local = (x: number, y: number, z: number, e: Item['e']): Item => ({
        p: [
          b.x + Math.cos(b.giro) * x + Math.sin(b.giro) * z,
          y,
          b.z - Math.sin(b.giro) * x + Math.cos(b.giro) * z,
        ],
        e,
        r: b.giro,
      });
      asiento.push(local(0, 0.4, 0, [0.64, 0.12, 0.62]));
      respaldo.push(local(0, 0.73, -0.29, [0.68, 0.46, 0.12]));
      for (const x of [-0.28, 0.28]) {
        metal.push(local(x, 0.2, 0, [0.055, 0.4, 0.52]));
        metal.push(local(x, 0.59, 0, [0.065, 0.065, 0.58]));
      }
    }
    return { asiento, respaldo, metal };
  }, []);
  const focos = useRef<Group>(null);
  const objetivos = useMemo(
    () =>
      [-1, 1].map((x) => {
        const o = new Object3D();
        o.position.set(x * 4, 0.4, -12);
        return o;
      }),
    [],
  );
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * PARAMETROS.focoVelocidad;
    objetivos.forEach((o, i) => {
      o.position.x =
        (i === 0 ? -4 : 4) + Math.sin(t + i * Math.PI) * PARAMETROS.focoAmplitud * movimiento;
      o.updateMatrixWorld();
    });
    if (focos.current) focos.current.rotation.z = Math.sin(t) * 0.025 * movimiento;
  });
  const dibujar = (
    items: Item[],
    material: keyof typeof r.mat,
    geometria: keyof typeof r.geo = 'caja',
  ) => <Instancias items={items} geometria={r.geo[geometria]} material={r.mat[material]} />;
  return (
    <>
      <color attach="background" args={[variante.paleta.fondo ?? '#101a2a']} />
      {dibujar([caja(0, -0.16, 0, ANCHO, 0.32, FONDO)], 'hormigon')}
      {dibujar([plataforma(TARIMA), plataforma(ESCALON)], 'nogal')}
      {dibujar([caja(0, MEDIO_ALTO, FONDO_Z - 0.13, ANCHO, SALA.alto, 0.25)], 'tinta')}
      {dibujar([caja(0, MEDIO_ALTO, FONDO_Z + 0.03, 20, SALA.alto, 0.04)], 'piedra')}
      {dibujar(
        [-1, 1].flatMap((lado) =>
          Array.from({ length: 24 }, (_, i) =>
            caja(lado * (10.5 + i * 0.45), MEDIO_ALTO, FONDO_Z + 0.1, 0.08, SALA.alto, 0.12),
          ),
        ),
        'nogalPanel',
      )}
      {dibujar(
        [
          caja(0, 0.41, TARIMA.z1 - 0.06, 19.8, 0.025, 0.045),
          caja(0, 0.21, ESCALON.z1 - 0.06, 19.8, 0.025, 0.045),
        ],
        'luzTenue',
      )}
      {dibujar(piezas.asiento, 'butaca')}
      {dibujar(piezas.respaldo, 'butaca')}
      {dibujar(piezas.metal, 'metal')}
      {dibujar(
        [-1, 1].flatMap((lado) => [
          caja(lado * 15, 0.015, 2, 0.035, 0.025, 24),
          caja(lado * 1.4, 0.015, 9.5, 0.035, 0.025, 7),
        ]),
        'luzTenue',
      )}
      {dibujar(
        PLANTAS.map((p) => caja(p.x, 0.35, p.z, 0.85, 0.7, 0.85)),
        'maceta',
        'cilindroBajo',
      )}
      {dibujar(
        PLANTAS.flatMap((p) =>
          [-1, 0, 1].map((i) => ({
            p: [p.x + i * 0.3, 1.35 + Math.abs(i) * 0.25, p.z] as [number, number, number],
            e: [0.95, 1.35, 0.9] as [number, number, number],
            rz: i * 0.4,
          })),
        ),
        'hoja',
        'hojas',
      )}
      {[-14, 14].map((x) => (
        <group key={x} position={[x, 3.6, FONDO_Z + 0.18]}>
          <mesh geometry={r.geo.caja} material={r.mat.metal} scale={[3.15, 1.85, 0.12]} />
          <mesh position={[0, 0, 0.07]}>
            <planeGeometry args={[3, 1.7]} />
            <meshBasicMaterial map={rotulos} toneMapped={false} />
          </mesh>
        </group>
      ))}
      <group ref={focos} position={[0, PARAMETROS.focoAltura, FONDO_Z + 0.3]}>
        {dibujar([...[-10, 10].map((x) => caja(x, -0.16, 0, 0.3, 0.24, 0.4))], 'metal')}
      </group>
      {/* Público legible de noche: relleno de cielo y luz frontal algo más fuertes. */}
      <hemisphereLight args={['#c4dbff', '#5c4a3e', 1.25]} />
      <directionalLight position={[0, 12, 16]} intensity={1.9} color="#ffe6cc" />
      {objetivos.map((objetivo, i) => (
        <group key={i}>
          <primitive object={objetivo} />
          <spotLight
            position={[i === 0 ? -10 : 10, PARAMETROS.focoAltura, FONDO_Z + 0.4]}
            target={objetivo}
            color="#ffe5c1"
            intensity={150}
            distance={22}
            angle={0.65}
            penumbra={0.75}
          />
        </group>
      ))}
    </>
  );
}
registrarDibujo('auditorio', DibujoAuditorio);
