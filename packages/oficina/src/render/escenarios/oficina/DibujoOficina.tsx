import { useEffect, useMemo } from 'react';
import { COCINA, LOUNGE, MESAS, SALA } from '../../../escenarios/oficina/plano';
import type { PaletaVariante } from '../../../escenarios/tipos';
import { luzDe } from '../../../escenarios/variantes';
import { registrarDibujo } from '../registroDibujo';
import type { PropsDibujo } from '../registroDibujo';
import { Arquitectura } from './Arquitectura';
import { ALTO_LAMPARA } from './Mobiliario';
import {
  Cocina,
  Credenza,
  Descanso,
  Lounge,
  MesasAltas,
  MesasLargas,
  Plantas,
  SalaReunion,
} from './Mobiliario';
import { Pantallas } from './Pantallas';
import { ContextoRecursos, crearRecursos } from './recursos';

/** Lo que se ve más allá del patio (variante «Mañana»): el cielo claro de media mañana. */
const FONDO = '#dfe9ee';

/**
 * La oficina «Nave de la mañana»: arquitectura de nave con diente de sierra, mobiliario, pantallas con
 * contenido de ejemplo (o el que llegue por `contenidoPantallas`) y la luz de las 10. Los ocupantes son
 * las personas del motor. Clic en la sala de reunión, el tablero o la cocina → `onInteres(id)`.
 */
export function DibujoOficina({ escenario, variante, contenidoPantallas, onInteres }: PropsDibujo) {
  const recursos = useMemo(() => crearRecursos(variante.paleta), [variante]);
  useEffect(() => () => recursos.liberar(), [recursos]);
  return (
    <ContextoRecursos.Provider value={recursos}>
      <color attach="background" args={[variante.paleta.fondo ?? FONDO]} />
      <Arquitectura />
      <MesasLargas />
      <SalaReunion alTocar={() => onInteres('reunion')} />
      <Credenza />
      <Cocina alTocar={() => onInteres('cocina')} />
      <Lounge />
      <Descanso />
      <MesasAltas />
      <Plantas />
      <Pantallas
        pantallas={escenario.pantallas}
        externos={contenidoPantallas}
        alInteres={onInteres}
      />
      <LucesOficina paleta={variante.paleta} />
    </ContextoRecursos.Provider>
  );
}

/**
 * Luz de la sala: el sol y el cielo los pone `Luces` (hora de la variante); las franjas que dibujan las
 * vidrieras van en `Arquitectura`. Aquí, un relleno frío y suave desde la cámara para leer las caras, el
 * rebote cálido del piso y las lámparas prácticas encendidas (bajas de día). La variante puede teñir o
 * subir dos grupos: `relleno` y `lamparas`.
 */
function LucesOficina({ paleta }: { paleta: PaletaVariante }) {
  const relleno = luzDe(paleta, 'relleno', { color: '#e4ecff', intensidad: 0.55 });
  const lampara = (intensidad: number, color = '#ffcf98') =>
    luzDe(paleta, 'lamparas', { color, intensidad });
  const mesa = lampara(7);
  const isla = lampara(9);
  const lectura = lampara(5, '#ffc98a');
  const lounge = lampara(6, '#ffe3c0');
  return (
    <>
      <directionalLight position={[-6, 14, 30]} intensity={relleno.intensidad} color={relleno.color} />
      {MESAS.map((m) => (
        <pointLight
          key={m.equipo}
          position={[m.x, ALTO_LAMPARA - 0.3, m.z]}
          color={mesa.color}
          intensity={mesa.intensidad}
          distance={5.5}
          decay={2}
        />
      ))}
      <pointLight
        position={[
          (COCINA.isla.x0 + COCINA.isla.x1) / 2,
          2.2,
          (COCINA.isla.z0 + COCINA.isla.z1) / 2,
        ]}
        color={isla.color}
        intensity={isla.intensidad}
        distance={7}
        decay={2}
      />
      <pointLight
        position={[-16, 1.6, 4.2]}
        color={lectura.color}
        intensity={lectura.intensidad}
        distance={5}
        decay={2}
      />
      <pointLight
        position={[LOUNGE.mesa.x, 2.6, SALA.z0 + 3]}
        color={lounge.color}
        intensity={lounge.intensidad}
        distance={8}
        decay={2}
      />
    </>
  );
}

registrarDibujo('oficina', DibujoOficina);
