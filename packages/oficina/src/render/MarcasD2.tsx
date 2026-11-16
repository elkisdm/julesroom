import { useSyncExternalStore } from 'react';
interface MarcaD2 {
  x: number;
  y: number;
  z: number;
  radio: number;
  ganadora: boolean;
}
let marcas: readonly MarcaD2[] = [];
const oyentes = new Set<() => void>();
export const COLORES_D2 = ['#d5ad56', '#5faeab', '#a18bc9', '#dc8a70'] as const;
/** Puente de datos de la dinámica a marcas del suelo dentro del Canvas existente. */
export function fijarMarcasD2(nuevas: readonly MarcaD2[]) {
  marcas = nuevas;
  for (const f of oyentes) f();
}
export function MarcasD2() {
  const lista = useSyncExternalStore(
    (fn) => {
      oyentes.add(fn);
      return () => {
        oyentes.delete(fn);
      };
    },
    () => marcas,
  );
  return (
    <group name="zonas-voto-d2">
      {lista.map((p, i) => (
        <group key={i} position={[p.x, p.y + 0.035, p.z]} rotation-x={-Math.PI / 2}>
          <mesh renderOrder={2}>
            <circleGeometry args={[p.radio, 48]} />
            <meshBasicMaterial
              color={COLORES_D2[i]}
              transparent
              opacity={p.ganadora ? 0.38 : 0.16}
              depthWrite={false}
            />
          </mesh>
          <mesh renderOrder={3}>
            <ringGeometry args={[p.radio - 0.045, p.radio, 48]} />
            <meshBasicMaterial
              color={COLORES_D2[i]}
              transparent
              opacity={0.85}
              depthWrite={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}
