import type { AtuendoResuelto } from '../tipos';
import { Pieza } from './Pieza';
import { caja, cajaRedonda } from './recursos';
import { pintura } from './estilos';
import { oscurecer } from './caras';
/** Capas cortas sobre la columna: las mangas conservan las articulaciones del motor. */
export function RopaColecciones({ a }: { a: AtuendoResuelto }) {
  const tela = pintura(a.topColor, 0.85);
  const sombra = pintura(oscurecer(a.topColor, 0.67), 0.9);
  const claro = pintura(oscurecer(a.topColor, 1.2), 0.7);
  switch (a.top) {
    case 'cuello-alto':
      return <Pieza g={cajaRedonda(0.3, 0.15, 0.28, 2, 0.025)} e={tela} p={[0, 0.61, 0]} />;
    case 'chaleco':
      return (
        <>
          <Pieza g={caja(0.32, 0.42, 0.025)} e={pintura('#e9e2d2', 0.8)} p={[0, 0.32, 0.163]} />
          {[-1, 1].map((s) => (
            <Pieza key={s} g={caja(0.17, 0.52, 0.04)} e={tela} p={[s * 0.195, 0.3, 0.19]} />
          ))}
          <Pieza g={caja(0.09, 0.08, 0.018)} e={sombra} p={[0.19, 0.21, 0.22]} />
        </>
      );
    case 'cardigan':
      return (
        <>
          <Pieza g={caja(0.17, 0.55, 0.025)} e={pintura('#e9e2d2', 0.8)} p={[0, 0.3, 0.165]} />
          {[-1, 1].map((s) => (
            <Pieza key={s} g={caja(0.035, 0.57, 0.04)} e={sombra} p={[s * 0.1, 0.3, 0.18]} />
          ))}
          {[-1, 1].map((s) => (
            <Pieza key={s} g={caja(0.13, 0.12, 0.035)} e={claro} p={[s * 0.2, 0.17, 0.18]} />
          ))}
        </>
      );
    case 'peto':
      return (
        <>
          <Pieza g={caja(0.36, 0.32, 0.035)} e={sombra} p={[0, 0.25, 0.18]} />
          {[-1, 1].map((s) => (
            <Pieza key={s} g={caja(0.065, 0.59, 0.035)} e={sombra} p={[s * 0.17, 0.3, 0.18]} />
          ))}
          <Pieza g={caja(0.18, 0.12, 0.018)} e={claro} p={[0, 0.29, 0.205]} />
        </>
      );
    case 'kimono':
      return (
        <>
          <Pieza g={caja(0.07, 0.59, 0.035)} e={sombra} p={[-0.04, 0.32, 0.19]} r={[0, 0, -0.4]} />
          <Pieza g={caja(0.59, 0.095, 0.34)} e={sombra} p={[0, 0.08, 0]} />
          <Pieza g={caja(0.13, 0.1, 0.05)} e={claro} p={[0.13, 0.08, 0.19]} />
        </>
      );
    case 'bomber':
      return (
        <>
          <Pieza g={cajaRedonda(0.6, 0.13, 0.34, 2, 0.03)} e={sombra} p={[0, 0.06, 0]} />
          <Pieza g={caja(0.025, 0.49, 0.018)} e={claro} p={[0, 0.32, 0.17]} />
          <Pieza g={cajaRedonda(0.36, 0.1, 0.32, 2, 0.03)} e={sombra} p={[0, 0.59, 0]} />
        </>
      );
    case 'cortaviento':
      return (
        <>
          <Pieza g={caja(0.56, 0.14, 0.035)} e={pintura('#dfe3df', 0.6)} p={[0, 0.44, 0.17]} />
          <Pieza g={caja(0.025, 0.58, 0.02)} e={sombra} p={[0, 0.3, 0.2]} />
          <Pieza g={cajaRedonda(0.38, 0.19, 0.16, 2, 0.04)} e={tela} p={[0, 0.58, -0.17]} />
        </>
      );
    case 'polar':
      return (
        <>
          <Pieza g={cajaRedonda(0.38, 0.14, 0.33, 2, 0.04)} e={sombra} p={[0, 0.59, 0]} />
          <Pieza g={caja(0.19, 0.2, 0.04)} e={sombra} p={[-0.13, 0.39, 0.18]} />
          <Pieza g={caja(0.025, 0.25, 0.025)} e={claro} p={[0, 0.45, 0.19]} />
        </>
      );
    case 'gabardina':
      return (
        <>
          {[-1, 1].map((s) => (
            <Pieza
              key={s}
              g={caja(0.11, 0.31, 0.035)}
              e={claro}
              p={[s * 0.12, 0.45, 0.18]}
              r={[0, 0, s * 0.35]}
            />
          ))}
          <Pieza g={caja(0.59, 0.06, 0.33)} e={sombra} p={[0, 0.06, 0]} />
        </>
      );
    case 'parka':
      return (
        <>
          <Pieza g={cajaRedonda(0.48, 0.24, 0.18, 2, 0.04)} e={sombra} p={[0, 0.61, -0.16]} />
          {[-1, 1].map((s) => (
            <Pieza key={s} g={caja(0.18, 0.18, 0.035)} e={claro} p={[s * 0.16, 0.16, 0.18]} />
          ))}
          <Pieza g={caja(0.035, 0.57, 0.025)} e={sombra} p={[0, 0.3, 0.18]} />
        </>
      );
    default:
      return null;
  }
}
/** Dos faldones independientes siguen cada muslo para no cruzar las piernas al sentarse. */
export function FaldonAbrigo({ color }: { color: string }) {
  return <Pieza g={caja(0.27, 0.23, 0.065)} e={pintura(color, 0.85)} p={[0, -0.085, -0.15]} />;
}
