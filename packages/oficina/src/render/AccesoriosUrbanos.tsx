import type { Accesorio } from './accesorios';
import { Pieza } from './Pieza';
import { caja, cajaRedonda } from './recursos';
import { pintura } from './estilos';
/** Extras sin texturas: se instancian con las piezas del personaje y siguen sus anclas. */
export const ACCESORIOS_URBANOS: Readonly<Record<string, Accesorio>> = {
  'lentes-oscuros': {
    ancla: 'cabeza',
    dibujar: () => (
      <>
        {[-1, 1].map((s) => (
          <Pieza
            key={s}
            g={cajaRedonda(0.17, 0.09, 0.035, 1, 0.015)}
            e={pintura('#151b24', 0.18)}
            p={[s * 0.105, 0.02, 0.23]}
          />
        ))}
        <Pieza g={caja(0.08, 0.018, 0.025)} e={pintura('#414956', 0.3)} p={[0, 0.035, 0.23]} />
      </>
    ),
  },
  reloj: {
    ancla: 'mano',
    dibujar: () => (
      <>
        <Pieza g={caja(0.222, 0.05, 0.262)} e={pintura('#252932', 0.65)} p={[0, -0.245, 0]} />
        <Pieza g={caja(0.08, 0.06, 0.018)} e={pintura('#87929d', 0.25)} p={[0, -0.245, 0.14]} />
        <Pieza g={caja(0.05, 0.04, 0.02)} e={pintura('#11151c', 0.35)} p={[0, -0.245, 0.15]} />
      </>
    ),
  },
  'bufanda-lana': {
    ancla: 'columna',
    dibujar: () => (
      <>
        <Pieza
          g={cajaRedonda(0.48, 0.1, 0.36, 2, 0.03)}
          e={pintura('#c5b69b', 0.95)}
          p={[0, 0.61, 0]}
        />
        <Pieza g={caja(0.12, 0.3, 0.04)} e={pintura('#b09c7b', 0.95)} p={[0.12, 0.43, 0.19]} />
      </>
    ),
  },
  'gorro-urbano': {
    ancla: 'cabeza',
    sombrero: true,
    dibujar: () => (
      <>
        <Pieza
          g={cajaRedonda(0.53, 0.18, 0.51, 2, 0.06)}
          e={pintura('#61756f', 0.95)}
          p={[0, 0.28, 0]}
        />
        <Pieza
          g={cajaRedonda(0.55, 0.06, 0.53, 2, 0.025)}
          e={pintura('#42564f', 0.95)}
          p={[0, 0.23, 0]}
        />
        {[-0.16, 0, 0.16].map((x) => (
          <Pieza
            key={x}
            g={caja(0.018, 0.11, 0.018)}
            e={pintura('#82968e', 0.95)}
            p={[x, 0.29, 0.254]}
          />
        ))}
      </>
    ),
  },
  'audifonos-estudio': {
    ancla: 'cabeza',
    dibujar: () => (
      <>
        <Pieza
          g={cajaRedonda(0.66, 0.065, 0.14, 2, 0.025)}
          e={pintura('#b9c1c7', 0.45)}
          p={[0, 0.32, 0]}
        />
        {[-1, 1].map((s) => (
          <group key={s}>
            <Pieza g={caja(0.04, 0.3, 0.1)} e={pintura('#65717e', 0.5)} p={[s * 0.3, 0.17, 0]} />
            <Pieza
              g={cajaRedonda(0.12, 0.23, 0.18, 2, 0.04)}
              e={pintura('#27313e', 0.6)}
              p={[s * 0.3, 0, 0]}
            />
            <Pieza g={caja(0.02, 0.1, 0.09)} e={pintura('#b9c1c7', 0.45)} p={[s * 0.365, 0, 0]} />
          </group>
        ))}
      </>
    ),
  },
  'mochila-urbana': {
    ancla: 'columna',
    dibujar: () => (
      <>
        <Pieza
          g={cajaRedonda(0.47, 0.51, 0.2, 2, 0.045)}
          e={pintura('#526774', 0.9)}
          p={[0, 0.32, -0.25]}
        />
        <Pieza
          g={cajaRedonda(0.49, 0.13, 0.22, 2, 0.025)}
          e={pintura('#354a58', 0.9)}
          p={[0, 0.51, -0.26]}
        />
        <Pieza
          g={cajaRedonda(0.3, 0.18, 0.06, 2, 0.02)}
          e={pintura('#81939c', 0.9)}
          p={[0, 0.22, -0.37]}
        />
        {[-1, 1].map((s) => (
          <Pieza
            key={s}
            g={caja(0.055, 0.4, 0.025)}
            e={pintura('#354a58', 0.9)}
            p={[s * 0.18, 0.33, 0.17]}
          />
        ))}
      </>
    ),
  },
};
