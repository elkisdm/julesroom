import { Casa } from '../casa/Casa';
import { Cielo } from '../casa/Cielo';
import { CorteCasa } from '../casa/CorteCasa';
import { EspejoAgua } from '../casa/EspejoAgua';
import { registrarDibujo } from './registroDibujo';
import type { PropsDibujo } from './registroDibujo';

/** Cielo, casa, espejo de agua y corte de casa de muñecas: la mansión de siempre. */
export function DibujoMansion({
  paleta,
  sombras,
  movimiento,
  rigs,
  ambiente,
  asistente,
  escalaAsistente,
  sinCasa,
  seguirId,
}: PropsDibujo) {
  return (
    <>
      <Cielo paleta={paleta} movimiento={movimiento} />
      {!sinCasa && <Casa paleta={paleta} sombras={sombras} movimiento={movimiento} />}
      <EspejoAgua
        paleta={paleta}
        asistente={asistente}
        escalaAsistente={escalaAsistente}
        movimiento={movimiento}
      />
      <CorteCasa ambiente={ambiente} rigs={rigs} seguirId={seguirId ?? null} />
    </>
  );
}

registrarDibujo('mansion', DibujoMansion);
