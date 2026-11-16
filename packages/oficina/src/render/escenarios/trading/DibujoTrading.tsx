import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { RectAreaLight, SpotLight } from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import {
  AULA,
  BARRA,
  centroEquipo,
  DESCANSO,
  ESPERA,
  EQUIPOS,
  MESAS,
  MURO_LED,
  PASILLO_BANCOS,
  PRIVADO,
  QUIOSCO,
  REPISA,
} from '../../../escenarios/trading/plano';
import type { PaletaVariante } from '../../../escenarios/tipos';
import { luzDe } from '../../../escenarios/variantes';
import { registrarDibujo } from '../registroDibujo';
import type { PropsDibujo } from '../registroDibujo';
import { Arquitectura, COLOR_EQUIPO } from './Arquitectura';
import { Aula, Bancos, Estar, Mesas } from './Mobiliario';
import { LuzQuiosco, MuroLed, PantallasPlanas } from './Pantallas';
import { ContextoRecursos, crearRecursos } from './recursos';

let lucesDeAreaListas = false;

/** Tinta del fondo (variante «Hora azul»): lo que se ve bajo el corte del piso y alrededor de la ciudad. */
const FONDO = '#0f1a2b';

/**
 * La sala de trading: arquitectura, mobiliario, pantallas con datos de ejemplo (o el contenido que
 * llegue por `contenidoPantallas`) y su luz de hora azul. Los ocupantes no se dibujan aquí: son las
 * personas del motor. Clic en el muro, el aula, el quiosco, una mesa o un puesto de agente →
 * `onInteres(id)`.
 */
export function DibujoTrading({
  escenario,
  variante,
  movimiento,
  contenidoPantallas,
  onInteres,
}: PropsDibujo) {
  if (!lucesDeAreaListas) {
    RectAreaLightUniformsLib.init();
    lucesDeAreaListas = true;
  }
  const recursos = useMemo(() => crearRecursos(variante.paleta), [variante]);
  useEffect(() => () => recursos.liberar(), [recursos]);
  const animar = movimiento > 0;
  return (
    <ContextoRecursos.Provider value={recursos}>
      <color attach="background" args={[variante.paleta.fondo ?? FONDO]} />
      <Arquitectura />
      <Bancos alTocarPuesto={(n) => onInteres(`agente:${n}`)} />
      <Aula />
      <Mesas alTocar={(i) => onInteres(`mesa:${MESAS[i]!.mercado}`)} />
      <Estar />
      <MuroLed animar={animar} externos={contenidoPantallas} alTocar={() => onInteres('muro')} />
      <PantallasPlanas
        pantallas={escenario.pantallas}
        animar={animar}
        externos={contenidoPantallas}
        alInteres={onInteres}
      />
      <LuzQuiosco />
      <LucesTrading paleta={variante.paleta} />
    </ContextoRecursos.Provider>
  );
}

/** Luz rectangular que mira hacia `hacia` (las luces de área apuntan con su −z local). */
function LuzArea({
  posicion,
  hacia,
  ancho,
  alto,
  color,
  intensidad,
}: {
  posicion: [number, number, number];
  hacia: [number, number, number];
  ancho: number;
  alto: number;
  color: string;
  intensidad: number;
}) {
  const ref = useRef<RectAreaLight>(null);
  useLayoutEffect(() => ref.current?.lookAt(...hacia), [hacia]);
  return (
    <rectAreaLight
      ref={ref}
      position={posicion}
      width={ancho}
      height={alto}
      color={color}
      intensity={intensidad}
    />
  );
}

const MURO_LUZ: [number, number, number] = [
  0,
  MURO_LED.base + MURO_LED.alto * 0.45,
  MURO_LED.centroZ - MURO_LED.radio + 0.35,
];
const MURO_HACIA: [number, number, number] = [0, 0.6, 2];
const AULA_LUZ: [number, number, number] = [
  AULA.pantalla.x,
  AULA.pantalla.y,
  AULA.pantalla.z + 0.3,
];
const AULA_HACIA: [number, number, number] = [AULA.pantalla.x, 0.5, -6];

/**
 * Hora azul en el piso: el muro de datos es la luz principal (un rectángulo frío que baña los
 * bancos); cada equipo tiene su lámpara cálida; luces prácticas en las mesas, la barra, la sala
 * privada y el escenario del aula; un relleno frío y bajo y una luz desde la cámara para leer las
 * caras. Ninguna proyecta sombra: el volumen lo dan los charcos de luz y las sombras de contacto.
 */
function LucesTrading({ paleta }: { paleta: PaletaVariante }) {
  const foco = useRef<SpotLight>(null);
  useLayoutEffect(() => {
    const s = foco.current;
    if (!s) return;
    s.target.position.set(AULA.atril.x - 2, 0.3, AULA.atril.z);
    s.target.updateMatrixWorld();
  }, []);
  // Cada grupo de luces se puede teñir o subir en la variante (`luces`: hemisferio, frente, contraluz,
  // muro, aula, equipos, practicas, foco).
  const hemisferio = luzDe(paleta, 'hemisferio', { color: '#8ea6d8', intensidad: 0.7 });
  const frente = luzDe(paleta, 'frente', { color: '#ffe6cc', intensidad: 0.9 });
  const contraluz = luzDe(paleta, 'contraluz', { color: '#7f9fd6', intensidad: 0.35 });
  const muro = luzDe(paleta, 'muro', { color: '#b9d4ff', intensidad: 3.2 });
  const aula = luzDe(paleta, 'aula', { color: '#ffe7cf', intensidad: 2 });
  const equipos = luzDe<{ color?: string; intensidad: number }>(paleta, 'equipos', {
    intensidad: 18,
  });
  const practicas = (intensidad: number, color = '#ffb877') =>
    luzDe(paleta, 'practicas', { color, intensidad });
  const mesa = practicas(30);
  const barraA = practicas(22);
  const barraB = practicas(20);
  const mesaAlta = practicas(26);
  const espera = practicas(16, '#ffc48a');
  const repisa = practicas(2.4);
  const privado = practicas(12);
  const quiosco = practicas(8, '#ffcf9a');
  const foc = luzDe(paleta, 'foco', { color: '#fff1dc', intensidad: 60 });
  return (
    <>
      <hemisphereLight args={[hemisferio.color, '#3a2c22', hemisferio.intensidad]} />
      <directionalLight position={[6, 16, 22]} intensity={frente.intensidad} color={frente.color} />
      <directionalLight
        position={[-14, 10, -24]}
        intensity={contraluz.intensidad}
        color={contraluz.color}
      />
      <LuzArea
        posicion={MURO_LUZ}
        hacia={MURO_HACIA}
        ancho={MURO_LED.ancho - 1}
        alto={MURO_LED.alto * 0.8}
        color={muro.color}
        intensidad={muro.intensidad}
      />
      <LuzArea
        posicion={AULA_LUZ}
        hacia={AULA_HACIA}
        ancho={AULA.pantalla.ancho}
        alto={AULA.pantalla.alto}
        color={aula.color}
        intensidad={aula.intensidad}
      />
      {Array.from({ length: EQUIPOS }, (_, i) => (
        <pointLight
          key={i}
          position={[centroEquipo(i + 1), 3.1, PASILLO_BANCOS]}
          color={equipos.color ?? COLOR_EQUIPO[i]}
          intensity={equipos.intensidad}
          distance={10}
          decay={2}
        />
      ))}
      <pointLight
        position={[0, 3.2, MESAS[0]!.z + 0.6]}
        color={mesa.color}
        intensity={mesa.intensidad}
        distance={14}
        decay={2}
      />
      <pointLight
        position={[14.4, 2.6, (BARRA.z0 + BARRA.z1) / 2]}
        color={barraA.color}
        intensity={barraA.intensidad}
        distance={10}
        decay={2}
      />
      <pointLight
        position={[14.6, 2.6, BARRA.z1 - 1]}
        color={barraB.color}
        intensity={barraB.intensidad}
        distance={9}
        decay={2}
      />
      <pointLight
        position={[DESCANSO.mesaAlta.x, 2.8, DESCANSO.mesaAlta.z + 0.4]}
        color={mesaAlta.color}
        intensity={mesaAlta.intensidad}
        distance={10}
        decay={2}
      />
      <pointLight
        position={[ESPERA.mesa.x, 2.8, ESPERA.mesa.z - 0.8]}
        color={espera.color}
        intensity={espera.intensidad}
        distance={8}
        decay={2}
      />
      <LuzArea
        posicion={[REPISA.x0 - 0.1, 1.7, (REPISA.z0 + REPISA.z1) / 2]}
        hacia={[BARRA.x0 - 1.5, 1.2, (REPISA.z0 + REPISA.z1) / 2]}
        ancho={REPISA.z1 - REPISA.z0}
        alto={1.4}
        color={repisa.color}
        intensidad={repisa.intensidad}
      />
      <pointLight
        position={[PRIVADO.mesa.x, 2.6, PRIVADO.mesa.z]}
        color={privado.color}
        intensity={privado.intensidad}
        distance={8}
        decay={2}
      />
      <pointLight
        position={[QUIOSCO.x, 2.4, QUIOSCO.z + 1.8]}
        color={quiosco.color}
        intensity={quiosco.intensidad}
        distance={7}
        decay={2}
      />
      <spotLight
        ref={foco}
        position={[AULA.atril.x - 2, 5.2, -9]}
        angle={0.36}
        penumbra={0.7}
        intensity={foc.intensidad}
        distance={14}
        color={foc.color}
      />
    </>
  );
}

registrarDibujo('trading', DibujoTrading);
