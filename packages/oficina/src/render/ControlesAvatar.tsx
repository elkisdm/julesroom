import { useEffect, useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Raycaster, Vector2 } from 'three';
import type { Mesh, MeshBasicMaterial, RingGeometry } from 'three';
import { cancelar, fijarDestino, saltar, sentarEn } from '../animacion/avatar';
import type { Mando } from '../animacion/avatar';
import { accionBajoRayo, accionesDe } from '../escenarios/acciones';
import { puntoEnSuelo, sueloDe } from '../escenarios/suelo';
import type { AccionSentarse } from '../escenarios/tipos';
import { planoCorte } from './casa/planoCorte';
import { useEscenario } from './escenarios/contexto';
import {
  crearTeclas,
  enCampoDeTexto,
  esDobleClic,
  escribirEjes,
  esClic,
  puntoEnPlano,
  opacidadMarcaDestino,
  PARAMETROS_DESTINO,
  registrarTecla,
  soltarTeclas,
} from './entradaAvatar';

interface Props {
  mando: Mando;
  /**
   * Altura (m) de la planta del avatar: si el rayo no toca ninguna superficie del suelo del escenario
   * (bajo el corte de la casa), el clic se cruza con el plano horizontal a esa altura.
   */
  altura: number;
  /**
   * Lo pone en `true` quien atiende un clic sobre un punto de interés (el dibujo del escenario): ese
   * clic abre el panel y no mueve al avatar.
   */
  interesAtendido: MutableRefObject<boolean>;
  /** La tecla E: ejecuta la acción a mano (sentarse, abrir) o, sentado, se levanta. */
  alAccion: () => void;
}

/**
 * Entrada del avatar propio: WASD y flechas escriben los ejes del `Mando` y un clic al piso fija
 * su destino («ir allí», también en otra planta: el rayo cae en la superficie visible del suelo del
 * escenario, bajo el corte de la casa), salvo que el clic lo haya atendido un punto de interés; un clic sobre
 * un asiento (silla, sofá, butaca) va a sentarse en él. E ejecuta la acción a mano (`alAccion`). Un gesto de
 * más de 5 px es una órbita de `OrbitControls` y no cuenta.
 * Escucha el lienzo y la ventana directamente, así que no depende de qué malla toque el rayo.
 */
export function ControlesAvatar({ mando, altura, interesAtendido, alAccion }: Props) {
  const dom = useThree((estado) => estado.gl.domElement);
  const camara = useThree((estado) => estado.camera);
  const escenario = useEscenario();
  const marca = useRef<Mesh<RingGeometry, MeshBasicMaterial>>(null);
  const marcaId = useRef(mando.idDestino);
  const marcaTiempo = useRef(PARAMETROS_DESTINO.duracion);
  useFrame((_, dt) => {
    const m = marca.current;
    if (!m) return;
    if (marcaId.current !== mando.idDestino) {
      marcaId.current = mando.idDestino;
      marcaTiempo.current = 0;
    }
    marcaTiempo.current += dt;
    const opacidad = opacidadMarcaDestino(mando, marcaTiempo.current);
    m.visible = opacidad > 0;
    if (!m.visible || !mando.destino) {
      marcaTiempo.current = PARAMETROS_DESTINO.duracion;
      return;
    }
    m.position.set(
      mando.destino.x,
      (mando.destino.y ?? altura) + PARAMETROS_DESTINO.altura,
      mando.destino.z,
    );
    m.scale.setScalar(
      1 + (PARAMETROS_DESTINO.expansion * marcaTiempo.current) / PARAMETROS_DESTINO.duracion,
    );
    m.material.opacity = opacidad;
  });
  const trabajo = useMemo(
    () => ({
      rayo: new Raycaster(),
      ndc: new Vector2(),
      punto: { x: 0, z: 0 },
      punto3: { x: 0, y: 0, z: 0 },
    }),
    [],
  );

  useEffect(() => {
    const acciones = accionesDe(escenario);
    const teclas = crearTeclas();
    const alBajarTecla = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || enCampoDeTexto(e.target as HTMLElement | null))
        return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat) saltar(mando);
        return;
      }
      if (e.code === 'KeyE') {
        e.preventDefault();
        if (!e.repeat) alAccion();
        return;
      }
      if (!registrarTecla(teclas, e.code, true)) return;
      e.preventDefault();
      escribirEjes(teclas, mando);
    };
    const alSoltarTecla = (e: KeyboardEvent) => {
      if (!registrarTecla(teclas, e.code, false)) return;
      escribirEjes(teclas, mando);
    };
    const alPerderFoco = () => {
      soltarTeclas(teclas);
      escribirEjes(teclas, mando);
    };

    let inicio: { x: number; y: number } | null = null;
    let destino: { x: number; y: number; z: number; doble: boolean } | null | undefined;
    let clicAnterior: { t: number; x: number; y: number } | null = null;
    let asiento: AccionSentarse | null = null;
    const alBajar = (e: PointerEvent) => {
      interesAtendido.current = false;
      destino = undefined;
      asiento = null;
      inicio = e.isPrimary && e.button === 0 ? { x: e.clientX, y: e.clientY } : null;
    };
    const alSoltar = (e: PointerEvent) => {
      const desde = inicio;
      inicio = null;
      if (!desde || !esClic(desde.x, desde.y, e.clientX, e.clientY)) return;
      const caja = dom.getBoundingClientRect();
      trabajo.ndc.set(
        ((e.clientX - caja.left) / caja.width) * 2 - 1,
        -((e.clientY - caja.top) / caja.height) * 2 + 1,
      );
      trabajo.rayo.setFromCamera(trabajo.ndc, camara);
      const { origin: o, direction: d } = trabajo.rayo.ray;
      // Se decide en el `click` que sigue: antes ya habló el dibujo del escenario (R3F escucha más arriba).
      asiento = accionBajoRayo(acciones, o.x, o.y, o.z, d.x, d.y, d.z);
      const p3 = trabajo.punto3;
      const enSuelo = puntoEnSuelo(
        sueloDe(escenario),
        o.x,
        o.y,
        o.z,
        d.x,
        d.y,
        d.z,
        planoCorte.constant,
        p3,
      );
      if (!enSuelo) {
        if (!puntoEnPlano(o.y, d.y, o.x, o.z, d.x, d.z, altura, trabajo.punto)) {
          destino = null;
          return;
        }
        p3.x = trabajo.punto.x;
        p3.y = Number.NaN;
        p3.z = trabajo.punto.z;
      }
      const doble = esDobleClic(clicAnterior, e.timeStamp, e.clientX, e.clientY);
      clicAnterior = doble ? null : { t: e.timeStamp, x: e.clientX, y: e.clientY };
      destino = { x: p3.x, y: p3.y, z: p3.z, doble };
    };
    const alHacerClic = () => {
      const meta = destino;
      destino = undefined;
      const sentarEnClic = asiento;
      asiento = null;
      if (meta === undefined || interesAtendido.current) return;
      if (sentarEnClic) sentarEn(mando, sentarEnClic);
      else if (meta === null) cancelar(mando);
      else fijarDestino(mando, meta.x, meta.z, meta.doble, meta.y);
    };

    window.addEventListener('keydown', alBajarTecla);
    window.addEventListener('keyup', alSoltarTecla);
    window.addEventListener('blur', alPerderFoco);
    dom.addEventListener('pointerdown', alBajar);
    dom.addEventListener('pointerup', alSoltar);
    window.addEventListener('click', alHacerClic);
    return () => {
      window.removeEventListener('keydown', alBajarTecla);
      window.removeEventListener('keyup', alSoltarTecla);
      window.removeEventListener('blur', alPerderFoco);
      dom.removeEventListener('pointerdown', alBajar);
      dom.removeEventListener('pointerup', alSoltar);
      window.removeEventListener('click', alHacerClic);
      alPerderFoco();
    };
  }, [dom, camara, mando, altura, trabajo, interesAtendido, escenario, alAccion]);

  return (
    <mesh ref={marca} name="marca-destino-avatar" rotation-x={-Math.PI / 2} visible={false}>
      <ringGeometry
        args={[
          PARAMETROS_DESTINO.radioInterior,
          PARAMETROS_DESTINO.radioExterior,
          PARAMETROS_DESTINO.segmentos,
        ]}
      />
      <meshBasicMaterial color={PARAMETROS_DESTINO.color} transparent depthWrite={false} />
    </mesh>
  );
}
