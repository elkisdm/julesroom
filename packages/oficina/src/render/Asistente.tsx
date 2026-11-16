import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  AdditiveBlending,
  CircleGeometry,
  Color,
  Group,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
} from 'three';
import type { InstancedMesh, Mesh, PerspectiveCamera, Sprite } from 'three';
import { avanzarPresencia, crearPresencia } from '../animacion/presencia';
import type { PresenciaAsistente } from '../animacion/presencia';
import type { Rig } from './animador';
import { plano } from '../mansion/plano';
import { crearMapaDeSuelo } from '../animacion/colision';
import { crearNavegacion } from '../animacion/navegacion';
import { sueloDe } from '../escenarios/suelo';
import { useEscenario } from './escenarios/contexto';
import type { EstadoAvatar } from './Acciones';
import {
  avanzarSeguimiento,
  crearSeguimiento,
  PARAMETROS_ASISTENTE,
} from './asistente/seguimiento';
import { crearOtros } from '../animacion/separacion';
import { suavizarAnguloExp } from '../animacion/resorte';
import { gestoAsistente, crearPose, nivelSintetico, suavizarPose } from './asistente/gesto';
import { avanzarAcompanamiento, crearAcompanamiento } from './asistente/acompanamiento';
import { aplicarLocomocion, crearMarchaAsistente, PARAMETROS_MODELO } from './asistente/locomocion';
import type { RigAsistente } from './asistente/locomocion';
import {
  CODO_Y,
  COLORES,
  CUELLO_Y,
  HOMBRO_X,
  HOMBRO_Y,
  geometriasAsistente,
} from './asistente/modelo';
import { CENTRO_CUERPO, yawHaciaCamara } from './asistente/posicion';
import { geometria, material, materialBasico } from './recursos';
import { materialHaloAsistente } from './texturas';

const AMBAR = '#f0a848';
const SATELITES = 7;
const ONDAS = 3;
/** Ámbar del anillo en reposo (0..1); con tonos fríos el anillo toma el color del núcleo. */
const ANILLO_AMBAR = { r: 0.94, g: 0.66, b: 0.28 };

/** Contrato local opcional para una interfaz de compañía; no es un mensaje de red. */
export interface ControlAsistenteLocal {
  posicion: { x: number; y: number; z: number };
  usuario: { x: number; y: number; z: number; estado: 'de-pie' | 'sentado' };
  puesto: { x: number; y: number; z: number };
  destino: { x: number; y: number; z: number } | null;
  seguir: boolean;
  marca?: { x: number; y: number; z: number } | null;
  mirar?: { x: number; y: number; z: number } | null;
  aplaudirHasta?: number;
  pantalla?: { x: number; y: number; z: number; giro: number } | null;
  escenario?: ReturnType<typeof useEscenario>;
  disponible: boolean;
  version: number;
  alTocar: () => void;
}

interface Props {
  /** Posición actual del asistente; la comparten las personas para mirarlo. */
  posicion: Vector3;
  acompanado?: MutableRefObject<EstadoAvatar>;
  /** Persona enfocada o seleccionada: Asistente se aparta a un costado para no taparla. */
  apartarDeId: string | null;
  /** La cámara está dentro de un ambiente: sin nadie enfocado, Asistente acompaña a un costado del plano. */
  enAmbiente?: boolean;
  /** Mira directo a cámara (por defecto, en tres cuartos). */
  deFrente?: boolean;
  /** Se queda de pie en su sitio de reposo, siempre como personaje (nunca orbe ni aparte). */
  presente?: boolean;
  /** Esqueletos de las personas, por id de agente. */
  rigs: MutableRefObject<Map<string, Rig>>;
  movimiento: number;
  /** Qué está haciendo Asistente; cambia el orbe sin recrearlo. */
  presencia: PresenciaAsistente;
  /** Volumen de la voz del asistente (0..1) mientras `hablando`; sin él se usa un ritmo sintético. */
  nivelVoz?: number;
  /** Dónde espera cuando nadie está enfocado; por defecto, sobre el espejo de agua del atrio. */
  reposo?: { x: number; y: number; z: number };
  /** Tamaño del orbe de viaje (1 = núcleo de 0,42 m); el personaje mide siempre `ESCALA_PERSONAJE`. */
  escala?: number;
}

/** Radio del núcleo de luz (m) a escala 1. */
export const RADIO_NUCLEO = 0.42;
/** Cuánto sube y baja el núcleo al flotar (m, a escala 1), con el reloj de la escena. */
export const flotacionAsistente = (segundos: number, movimiento: number) =>
  Math.sin(segundos * PARAMETROS_ASISTENTE.frecuenciaFlotacion * movimiento) *
  PARAMETROS_ASISTENTE.flotacion;
/** Cuánto se achica el orbe (fracción) mientras acompaña a un costado del encuadre. */
const ACHICA_APARTE = 0.4;
/** Medida del personaje respecto del modelo (1,8 m con pelo): un poco más alta que su equipo. */
const ESCALA_PERSONAJE = PARAMETROS_MODELO.escala;
/** Cuánto se desvía su mirada de la cámara hacia el enfocado (tres cuartos). */
const DESVIO_TRES_CUARTOS = -0.5;
/** Radio del anillo de cintura y fracción de brillo del halo cuando es personaje. */
const ANILLO_PERSONAJE = 0.78;
const HALO_PERSONAJE = 0.2;
/** Satélites que la acompañan de pie (los 7 restantes son del orbe). */
const SATELITES_PERSONAJE = 3;
/** Amplitud con la que `prefers-reduced-motion` deja de animar el viaje. */
const MOVIMIENTO_REDUCIDO = 0.5;

const suave = (x: number) => x * x * (3 - 2 * x);

/**
 * Asistente: jefa de gabinete. De pie es un personaje (melena bob, lentes, blazer terracota,
 * tableta) con un anillo ámbar en la cintura y satélites; viaja entre salas como el orbe de
 * siempre y se rematerializa en su sitio.
 */
export function Asistente({
  posicion,
  acompanado,
  apartarDeId,
  enAmbiente = false,
  deFrente = false,
  presente = false,
  rigs,
  movimiento,
  presencia,
  nivelVoz,
  reposo = plano.asistente,
  escala = 1,
}: Props) {
  const controlLocal = useRef<ControlAsistenteLocal | null>(null);
  const versionLocal = useRef(-1);
  useEffect(() => {
    const recibir = (e: Event) => {
      controlLocal.current = (e as CustomEvent<ControlAsistenteLocal | null>).detail;
      versionLocal.current = -1;
    };
    window.addEventListener('ak-jules-control', recibir);
    window.dispatchEvent(new Event('ak-jules-lista'));
    return () => window.removeEventListener('ak-jules-control', recibir);
  }, []);
  const marcaGuia = useRef<Mesh>(null);
  const pantallaVisible = useRef<Object3D | null>(null);
  const revisarPantalla = useRef(0);
  const puntoPantalla = useMemo(() => new Vector3(), []);
  const grupo = useRef<Group>(null);
  const orbe = useRef<Group>(null);
  const cuerpo = useRef<Group>(null);
  const cabezaRef = useRef<Group>(null);
  const bocaRef = useRef<Mesh>(null);
  const hombroTableta = useRef<Group>(null);
  const hombroLibre = useRef<Group>(null);
  const codoLibre = useRef<Group>(null);
  const rig = useMemo<RigAsistente>(
    () => ({
      raiz: new Group(),
      pelvis: new Group(),
      columna: new Group(),
      piernas: [
        { cadera: new Group(), rodilla: new Group() },
        { cadera: new Group(), rodilla: new Group() },
      ],
    }),
    [],
  );
  const marcha = useMemo(crearMarchaAsistente, []);
  const achicado = useRef(0);
  const nucleo = useRef<Mesh>(null);
  const halo = useRef<Sprite>(null);
  const anillo = useRef<Mesh>(null);
  const satelites = useRef<InstancedMesh>(null);
  const ondas = useRef<InstancedMesh>(null);
  const mancha = useRef<Mesh>(null);
  const ayudante = useMemo(() => new Object3D(), []);
  const cabeza = useMemo(() => new Vector3(), []);
  const escenario = useEscenario();
  const camaraInicial = useThree((estado) => estado.camera);
  const seguimiento = useMemo(() => {
    const mapa = crearMapaDeSuelo(sueloDe(escenario));
    const inicio = acompanado && !presente ? (escenario.entradas[0] ?? reposo) : reposo;
    return crearSeguimiento(
      crearNavegacion(mapa, PARAMETROS_ASISTENTE.celda, PARAMETROS_ASISTENTE.radioRuta),
      inicio,
      acompanado && !presente ? camaraInicial.position : undefined,
    );
  }, [escenario, reposo, acompanado, camaraInicial, presente]);
  const otros = useMemo(() => crearOtros(PARAMETROS_ASISTENTE.capacidadOtros), []);
  const estadoPresencia = useMemo(crearPresencia, []);
  const acompanamiento = useMemo(crearAcompanamiento, []);
  const forma = acompanamiento.forma;
  const poseObjetivo = useMemo(crearPose, []);
  const pose = useMemo(crearPose, []);
  const tinte = useMemo(() => new Color(), []);
  const g = useMemo(geometriasAsistente, []);

  useLayoutEffect(() => {
    const instancias = satelites.current;
    if (!instancias) return;
    for (let i = 0; i < SATELITES; i++) {
      instancias.setColorAt(i, new Color(i % 2 ? '#62c9c0' : '#fff1d6'));
    }
    if (instancias.instanceColor) instancias.instanceColor.needsUpdate = true;
  }, []);

  useFrame((estado, delta) => {
    const raizGrupo = grupo.current;
    const cuerpoG = cuerpo.current;
    if (!raizGrupo || !cuerpoG) return;
    const t = estado.clock.elapsedTime;
    const dt = Math.min(delta, 0.1);
    const camara = estado.camera as PerspectiveCamera;
    const raiz = apartarDeId ? rigs.current.get(apartarDeId)?.raiz : undefined;
    const mira = estado.controls as { target?: Vector3 } | null;
    const usuario = acompanado?.current;
    const control = usuario ? controlLocal.current : null;
    if (marcaGuia.current) {
      marcaGuia.current.visible = Boolean(control?.marca);
      if (control?.marca)
        marcaGuia.current.position.set(control.marca.x, control.marca.y + 0.04, control.marca.z);
    }
    if (control) {
      revisarPantalla.current -= dt;
      if (revisarPantalla.current <= 0) {
        revisarPantalla.current = 1;
        if (!pantallaVisible.current?.parent)
          pantallaVisible.current = estado.scene.getObjectByName('pantalla-presentacion') ?? null;
        const pantalla = pantallaVisible.current;
        if (pantalla) pantalla.getWorldPosition(puntoPantalla);
        control.pantalla = pantalla
          ? {
              x: puntoPantalla.x,
              y: puntoPantalla.y,
              z: puntoPantalla.z,
              giro: pantalla.rotation.y,
            }
          : null;
      }
      control.escenario = escenario;
      const a = seguimiento.avatar;
      Object.assign(control.posicion, { x: a.x, y: a.y, z: a.z });
      Object.assign(control.usuario, usuario);
      Object.assign(control.puesto, seguimiento.origen);
      if (!control.disponible) {
        control.destino = { ...control.posicion };
        control.disponible = true;
      }
      if (versionLocal.current !== control.version) {
        seguimiento.mando.destino = null;
        seguimiento.mando.idDestino++;
        seguimiento.avatar.nRuta = 0;
        Object.assign(seguimiento.destino, control.posicion);
        seguimiento.espera = 0;
        versionLocal.current = control.version;
      }
      // Las órdenes caminan: nunca usan la recuperación por desaparición del orbe.
      seguimiento.recuperacion = 'normal';
      seguimiento.visibilidad = 1;
    }
    const aparte = !presente && Boolean(usuario || raiz || (enAmbiente && mira?.target));
    if (usuario && !presente) cabeza.set(usuario.x, usuario.y, usuario.z);
    else if (raiz && !presente) cabeza.copy(raiz.position);
    else if (enAmbiente && mira?.target && !presente) cabeza.copy(mira.target);
    else cabeza.copy(seguimiento.origen);
    otros.n = 0;
    for (const rig of rigs.current.values()) {
      const r = rig.raiz.position;
      if (otros.n >= otros.x.length) break;
      if (Math.abs(r.y - seguimiento.avatar.y) > PARAMETROS_ASISTENTE.toleranciaPiso) continue;
      otros.x[otros.n] = r.x;
      otros.z[otros.n++] = r.z;
    }
    const reducido = movimiento < MOVIMIENTO_REDUCIDO;
    avanzarSeguimiento(
      seguimiento,
      control && !control.seguir
        ? (control.destino ?? control.posicion)
        : usuario && !presente
          ? usuario
          : cabeza,
      camara.position,
      dt,
      // Una guía debe poder adelantar al usuario detenido en un pasillo estrecho.
      control && !control.seguir ? undefined : otros,
      true,
      control ? control.seguir : aparte,
      control ? false : acompanamiento.orbe,
    );
    const a = seguimiento.avatar;
    if (control?.mirar && a.velocidad < PARAMETROS_ASISTENTE.velocidadMin) {
      a.rumbo = a.loc.rumbo = suavizarAnguloExp(
        a.rumbo,
        Math.atan2(control.mirar.x - a.x, control.mirar.z - a.z),
        PARAMETROS_ASISTENTE.mediaVidaGiro,
        dt,
      );
    }
    posicion.set(a.x, a.yCuerpo + CENTRO_CUERPO, a.z);
    avanzarAcompanamiento(
      acompanamiento,
      {
        distancia:
          presente || control ? 0 : Math.hypot(a.x - cabeza.x, a.y - cabeza.y, a.z - cabeza.z),
        velocidadUsuario: seguimiento.velocidadUsuario,
        sinRuta: !presente && !control && seguimiento.sinRuta,
        razonRuta: presente || control ? 1 : seguimiento.razonRuta,
      },
      dt,
      reducido || presente || Boolean(control),
    );
    raizGrupo.position.copy(posicion);
    raizGrupo.scale.setScalar(seguimiento.visibilidad);
    achicado.current += ((aparte ? 1 : 0) - achicado.current) * Math.min(1, dt * 4);
    const escOrbe = escala * (1 - ACHICA_APARTE * achicado.current);
    const f = suave(forma.forma);
    const enTransicion = forma.forma > 0 && forma.forma < 1;

    const flota = flotacionAsistente(t, movimiento) * escOrbe * (1 - f);
    const e = estadoPresencia;
    avanzarPresencia(e, presencia, nivelVoz, dt, Math.min(1, movimiento));
    const yawAnterior = rig.raiz.rotation.y;
    // También durante el vuelo: el apoyo conserva la planta y la fase al reaparecer.
    aplicarLocomocion(rig, marcha, a.loc, dt, seguimiento.nav.suelo, a.ySuelo);

    // --- Personaje: pose, mirada y gestos ---
    cuerpoG.visible = f > 0.01;
    if (cuerpoG.visible) {
      cuerpoG.scale.setScalar(0.2 + 0.8 * f);
      const nivel = nivelVoz === undefined ? nivelSintetico(t) : e.nivel;
      gestoAsistente(poseObjetivo, presencia, nivel, t, Math.min(1, movimiento));
      if ((control?.aplaudirHasta ?? 0) > Date.now()) {
        const aplauso = (0.5 + 0.5 * Math.sin(t * 16)) * Math.min(1, movimiento);
        poseObjetivo.hombroX = -0.9;
        poseObjetivo.abduccion = 0.2 + aplauso * 0.3;
        poseObjetivo.codo = -1.2;
        poseObjetivo.tableta = 0.8;
      }
      suavizarPose(pose, poseObjetivo, 1 - Math.exp(-dt / 0.12));
      if (!usuario && a.velocidad <= PARAMETROS_ASISTENTE.velocidadMin) {
        rig.raiz.rotation.y = suavizarAnguloExp(
          yawAnterior,
          yawHaciaCamara(
            posicion,
            usuario && !deFrente ? cabeza : camara.position,
            deFrente ? 0 : aparte ? DESVIO_TRES_CUARTOS : DESVIO_TRES_CUARTOS * 0.5,
          ),
          PARAMETROS_ASISTENTE.mediaVidaGiro,
          dt,
        );
      }
      cabezaRef.current?.rotation.set(
        pose.cabezaPitch + marcha.pose.cabezaPitch,
        pose.cabezaYaw + marcha.pose.cabezaYaw,
        pose.cabezaRoll,
      );
      if (bocaRef.current) bocaRef.current.scale.y = 0.35 + pose.boca * 2.6;
      const quietud = Math.exp(-a.velocidad / PARAMETROS_MODELO.velocidadGesto);
      hombroTableta.current?.rotation.set(
        -0.5 * pose.tableta * quietud + marcha.pose.hombro[0] * (1 - quietud),
        -0.35 * pose.tableta * quietud,
        0,
      );
      hombroLibre.current?.rotation.set(
        pose.hombroX * quietud + marcha.pose.hombro[1] * (1 - quietud),
        (control?.aplaudirHasta ?? 0) > Date.now() ? -1.1 + Math.sin(t * 16) * 0.18 : 0,
        -pose.abduccion * quietud + marcha.pose.abduccion[1] * (1 - quietud),
      );
      codoLibre.current?.rotation.set(
        pose.codo * quietud - marcha.pose.codo[1] * (1 - quietud),
        0,
        0,
      );
    }

    // --- Orbe (forma de viaje) y firma de personaje: anillo y satélites ---
    if (orbe.current) {
      const incl = e.inclinacion * 0.7 * (1 - f);
      orbe.current.rotation.set(incl, 0, -incl);
    }
    const frio = Math.min(1, Math.max(0, (e.b - e.r) * 2));
    if (nucleo.current) {
      nucleo.current.visible = f < 0.99;
      nucleo.current.position.y = flota;
      nucleo.current.scale.setScalar(e.escala * escOrbe * (1 - f));
      (nucleo.current.material as MeshBasicMaterial).color.setRGB(e.r, e.g, e.b, SRGBColorSpace);
    }
    if (halo.current) {
      halo.current.position.y = flota;
      const lado3 = 3.6 * e.escala * e.haloEscala * escOrbe * (1 - f) + 1.8 * f;
      halo.current.scale.set(lado3, lado3, 1);
      const destello = enTransicion ? Math.sin(Math.PI * forma.forma) * 0.5 : 0;
      halo.current.material.opacity = Math.min(
        1,
        Math.max(0, e.brillo * (1 - f) + (HALO_PERSONAJE + 0.1 * e.nivel) * f + destello),
      );
      halo.current.material.color.setRGB(
        e.r * 0.5 + 0.5,
        e.g * 0.5 + 0.5,
        e.b * 0.5 + 0.5,
        SRGBColorSpace,
      );
    }
    if (anillo.current) {
      anillo.current.position.y = flota;
      anillo.current.scale.setScalar(escOrbe * (1 - f) + ANILLO_PERSONAJE * f);
      anillo.current.rotation.x = (1.2 + Math.sin(t * 0.6) * 0.2) * (1 - f) + (Math.PI / 2) * f;
      anillo.current.rotation.y = t * 0.5 * movimiento;
      (anillo.current.material as MeshBasicMaterial).color.setRGB(
        ANILLO_AMBAR.r + (e.r - ANILLO_AMBAR.r) * frio,
        ANILLO_AMBAR.g + (e.g - ANILLO_AMBAR.g) * frio,
        ANILLO_AMBAR.b + (e.b - ANILLO_AMBAR.b) * frio,
        SRGBColorSpace,
      );
    }
    const orbita = satelites.current;
    if (orbita) {
      orbita.count = f > 0.5 ? SATELITES_PERSONAJE : SATELITES;
      for (let i = 0; i < orbita.count; i++) {
        const radio = (0.95 + (i % 3) * 0.18) * e.radSat;
        const angulo = e.faseSat * (0.6 + i * 0.13) + i * 0.9;
        const radioP = 0.72 + i * 0.1;
        const anguloP = e.faseSat * (0.5 + i * 0.12) + i * 2.1;
        ayudante.position.set(
          Math.cos(angulo) * radio * escOrbe * (1 - f) + Math.cos(anguloP) * radioP * f,
          flota +
            Math.sin(angulo * 1.3 + i) * 0.35 * e.radSat * escOrbe * (1 - f) +
            Math.sin(anguloP * 1.3 + i) * (0.18 + i * 0.12) * f,
          Math.sin(angulo) * radio * escOrbe * (1 - f) + Math.sin(anguloP) * radioP * f,
        );
        ayudante.scale.setScalar((1 + (i % 3) * 0.3) * (escOrbe * (1 - f) + f));
        ayudante.updateMatrix();
        orbita.setMatrixAt(i, ayudante.matrix);
      }
      orbita.instanceMatrix.needsUpdate = true;
    }
    const aros = ondas.current;
    if (aros) {
      aros.visible = e.ondasAmp > 0.01 && f < 0.5;
      if (aros.visible) {
        for (let i = 0; i < ONDAS; i++) {
          const fase = (e.faseOnda + i / ONDAS) % 1;
          const radio = (1.3 + e.ondasDir * (fase - 0.5) * 1.5) * escOrbe;
          ayudante.position.set(0, flota, 0);
          ayudante.scale.setScalar(radio);
          ayudante.updateMatrix();
          aros.setMatrixAt(i, ayudante.matrix);
          const alfa = Math.sin(Math.PI * fase) * e.ondasAmp;
          aros.setColorAt(i, tinte.setRGB(e.r * alfa, e.g * alfa, e.b * alfa, SRGBColorSpace));
        }
        aros.instanceMatrix.needsUpdate = true;
        if (aros.instanceColor) aros.instanceColor.needsUpdate = true;
      }
    }
    if (mancha.current) {
      mancha.current.position.set(posicion.x, a.ySuelo + 0.02, posicion.z);
      mancha.current.scale.setScalar(0.45 + 0.55 * (1 - f));
      (mancha.current.material as MeshBasicMaterial).opacity =
        (0.07 + Math.sin(t * 2.1) * 0.02) * seguimiento.visibilidad;
    }
  });

  const cuerpoMat = material(
    'asistente-cuerpo',
    () => new MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }),
  );

  return (
    <>
      <mesh ref={marcaGuia} visible={false} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.42, 0.52, 32]} />
        <meshBasicMaterial color={AMBAR} transparent opacity={0.85} depthWrite={false} />
      </mesh>
      <group
        ref={grupo}
        dispose={null}
        onClick={(e) => {
          if (!controlLocal.current) return;
          e.stopPropagation();
          e.nativeEvent.stopImmediatePropagation();
          controlLocal.current.alTocar();
        }}
        onPointerDown={(e) => {
          if (controlLocal.current) e.stopPropagation();
        }}
      >
        <group ref={cuerpo} visible={false}>
          <primitive object={rig.raiz} position={[0, -CENTRO_CUERPO, 0]} scale={ESCALA_PERSONAJE}>
            <primitive object={rig.pelvis}>
              {rig.piernas.map((pierna, i) => (
                <primitive
                  key={i}
                  object={pierna.cadera}
                  position={[(i ? 1 : -1) * PARAMETROS_MODELO.caderaX, 0, 0]}
                >
                  <mesh geometry={g.muslo} material={cuerpoMat} />
                  <primitive object={pierna.rodilla} position={[0, -PARAMETROS_MODELO.muslo, 0]}>
                    <mesh geometry={g.pantorrilla} material={cuerpoMat} />
                  </primitive>
                </primitive>
              ))}
              <primitive object={rig.columna}>
                <group position={[0, -PARAMETROS_MODELO.caderaY, 0]}>
                  <mesh geometry={g.cuerpo} material={cuerpoMat} />
                  <group ref={cabezaRef} position={[0, CUELLO_Y, 0]}>
                    <mesh geometry={g.cabeza} material={cuerpoMat} />
                    <mesh
                      ref={bocaRef}
                      geometry={g.boca}
                      material={material(
                        'asistente-boca',
                        () => new MeshStandardMaterial({ color: COLORES.labio, roughness: 0.6 }),
                      )}
                      position={[0, 0.095, 0.192]}
                    />
                  </group>
                  <group ref={hombroTableta} position={[-HOMBRO_X, HOMBRO_Y, 0]}>
                    <mesh geometry={g.brazoTableta} material={cuerpoMat} />
                    <mesh
                      geometry={g.pantalla}
                      material={material(
                        'asistente-pantalla',
                        () => new MeshBasicMaterial({ color: '#ffd9a0', toneMapped: false }),
                      )}
                    />
                  </group>
                  <group ref={hombroLibre} position={[HOMBRO_X, HOMBRO_Y, 0]}>
                    <mesh geometry={g.brazoSuperior} material={cuerpoMat} />
                    <group ref={codoLibre} position={[0, CODO_Y, 0]}>
                      <mesh geometry={g.brazoInferior} material={cuerpoMat} />
                    </group>
                  </group>
                </group>
              </primitive>
            </primitive>
          </primitive>
        </group>
        <group ref={orbe}>
          <mesh
            ref={nucleo}
            geometry={geometria('asistente-nucleo', () => new SphereGeometry(RADIO_NUCLEO, 28, 20))}
            material={material(
              'asistente-nucleo',
              () => new MeshBasicMaterial({ color: '#ffe4b5', toneMapped: false }),
            )}
          />
          <sprite ref={halo} material={materialHaloAsistente()} scale={[3.6, 3.6, 1]} />
          <mesh
            ref={anillo}
            geometry={geometria('asistente-anillo', () => new TorusGeometry(0.75, 0.012, 8, 64))}
            material={material(
              'asistente-anillo',
              () =>
                new MeshBasicMaterial({
                  color: AMBAR,
                  toneMapped: false,
                  transparent: true,
                  opacity: 0.7,
                }),
            )}
          />
          <instancedMesh
            ref={satelites}
            args={[
              geometria('asistente-satelite', () => new SphereGeometry(0.05, 10, 8)),
              materialBasico('#ffffff'),
              SATELITES,
            ]}
            frustumCulled={false}
          />
          <instancedMesh
            ref={ondas}
            args={[
              geometria('asistente-onda', () =>
                new TorusGeometry(1, 0.014, 6, 56).rotateX(Math.PI / 2),
              ),
              material(
                'asistente-onda',
                () =>
                  new MeshBasicMaterial({
                    blending: AdditiveBlending,
                    transparent: true,
                    depthWrite: false,
                    toneMapped: false,
                  }),
              ),
              ONDAS,
            ]}
            frustumCulled={false}
            visible={false}
          />
        </group>
      </group>
      <mesh
        ref={mancha}
        geometry={geometria('asistente-mancha', () =>
          new CircleGeometry(1.6, 40).rotateX(-Math.PI / 2),
        )}
        material={material(
          'asistente-mancha',
          () =>
            new MeshBasicMaterial({
              color: AMBAR,
              transparent: true,
              opacity: 0.08,
              depthWrite: false,
              toneMapped: false,
            }),
        )}
      />
    </>
  );
}
