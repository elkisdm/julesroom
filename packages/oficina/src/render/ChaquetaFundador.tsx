import { ExtrudeGeometry, Shape } from 'three';
import { Pieza } from './Pieza';
import { caja, cajaRedonda, geometria } from './recursos';
import { pintura } from './estilos';
const solapa = (lado: number) =>
  geometria(`solapa-fundador:${lado}`, () => {
    const forma = new Shape();
    forma.moveTo(lado * 0.04, 0.57);
    forma.lineTo(lado * 0.22, 0.6);
    forma.lineTo(lado * 0.18, 0.42);
    forma.lineTo(lado * 0.23, 0.39);
    forma.lineTo(lado * 0.065, 0.16);
    forma.closePath();
    return new ExtrudeGeometry(forma, { depth: 0.025, bevelEnabled: false });
  });
/** Chaqueta de sastrería: sin faldón rígido sobre las caderas; usa el esqueleto existente. */
export function ChaquetaFundador() {
  const mate = pintura('#242830', 0.85);
  const saten = pintura('#3c424d', 0.28);
  const tejido = pintura('#11151c', 0.65);
  return (
    <>
      <Pieza g={cajaRedonda(0.29, 0.15, 0.29, 2, 0.025)} e={tejido} p={[0, 0.615, 0]} />
      <Pieza g={caja(0.19, 0.53, 0.024)} e={tejido} p={[0, 0.3, 0.168]} />
      {([-1, 1] as const).map((s) => (
        <Pieza key={s} g={solapa(s)} e={saten} p={[0, 0, 0.18]} />
      ))}
      <Pieza g={caja(0.6, 0.075, 0.34)} e={mate} p={[0, 0.035, 0]} />
      <Pieza g={caja(0.065, 0.025, 0.022)} e={pintura('#b8c5d2', 0.2)} p={[-0.185, 0.46, 0.211]} />
      <Pieza g={caja(0.025, 0.46, 0.018)} e={saten} p={[0, 0.3, -0.16]} />
    </>
  );
}
