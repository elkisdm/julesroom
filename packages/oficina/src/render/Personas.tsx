import { posarSaludoD2 } from './reaccionD2';
import { consumirTrasladoD2 } from './trasladoD2';
import { useEffect, useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, Euler, Frustum, Matrix4, PlaneGeometry, Quaternion, Sphere, Vector3 } from 'three';
import type { Vector3 as Vec3Three } from 'three';
import type { AgenteOficina, Atuendo, AtuendoResuelto } from '../tipos';
import { crearPose } from '../animacion/articulaciones';
import type { MarchaRemota } from '../presencia/marcha-remota';
import type { FuentePresencia } from '../presencia/tipos';
import { actualizarAtencion, crearAtencion } from '../animacion/atencion';
import type { Atencion } from '../animacion/atencion';
import { avanzarInteracciones, crearCoordinador } from '../animacion/interacciones';
import type { Coordinador } from '../animacion/interacciones';
import { NODO_ASIENTO, NODO_VISITA } from '../animacion/ruta';
import { avanzarAvatar, crearAvatar, PARAMETROS_AVATAR, RADIO_AVATAR } from '../animacion/avatar';
import type { Avatar, Mando } from '../animacion/avatar';
import { crearMapaDeSuelo } from '../animacion/colision';
import type { MapaColision } from '../animacion/colision';
import { crearCandidatos } from '../animacion/interes';
import {
  alturaParaPresencia,
  crearSentadasRemotas,
  posarRemota,
  posarSentado,
} from './poseSentada';
import type { Candidatos } from '../animacion/interes';
import {
  crearLod,
  crearPresupuesto,
  decidirLod,
  iniciarCuadroLod,
  PARAMETROS_LOD,
  registrarCuadro,
} from '../animacion/lod';
import type { EntradaLod, PlanLod } from '../animacion/lod';
import { medidoresAnimacion, registrar } from '../animacion/medicion';
import { crearNavegacion } from '../animacion/navegacion';
import { pendienteSuelo, topeVelocidadEscalera } from '../animacion/pisada';
import { crearOtros } from '../animacion/separacion';
import type { Navegacion } from '../animacion/navegacion';
import { OPCIONES } from '../animacion/opciones';
import { alturaEn, sueloDe } from '../escenarios/suelo';
import type { Escenario } from '../escenarios/tipos';
import { actualizarPersona, crearSim, VELOCIDAD_PASEO } from './animador';
import type { GestoAgente, Relacion, Rig, Sim } from './animador';
import { alturaBajoAsiento, alturaPies } from './apoyoVisual';
import { planoCorte } from './casa/planoCorte';
import { useEscenario } from './escenarios/contexto';
import { ORDEN, propio } from './estilos';
import { aplicarCuerpo, crearEstadoCuerpo } from './cuerpo';
import { orientarMiradaAccion } from './miradaAccion';
import type { EstadoCuerpo } from './cuerpo';
import { actualizarFrustum, personaVisible } from '../rendimiento/visibilidad';
import { useGrafica } from './contextoGrafica';
import { estadisticasGrafica } from './estadisticas';
import {
  familiaContorno,
  familiaRelleno,
  materialAroHumano,
  puenteBrazo,
  puentePiernas,
} from './contorno';
import { Flota } from './flota';
import { elegirLod, geometriaSimple } from './lod';
import type { NivelLod } from './lod';
import type { Puesto } from './layout';
import {
  geometriaAnillo,
  geometriaMarcaPropia,
  materialAnillo,
  materialMarcaPropia,
  Persona,
} from './Persona';
import { fuerzaAro } from './visual';
import { crearMemoriaOclusion, ocluye } from './oclusion';
import { animarRemotas } from './remotas';
import { geometria } from './recursos';
import { materialBlob } from './texturas';
import type { Punto3 } from './camara';

interface Props {
  miradaAgentes?: Record<string, string | Punto3>;
  gestoAgentes?: Record<string, GestoAgente>;
  agentes: readonly AgenteOficina[];
  atuendos: readonly AtuendoResuelto[];
  puestos: readonly Puesto[];
  seleccionadoId: string | null;
  onSeleccionar: (id: string) => void;
  /** 1 normal, 0,35 con `prefers-reduced-motion`. */
  movimiento: number;
  paseos: boolean;
  /** Sombras reales del sol; si no, cada persona lleva una sombra de contacto. */
  sombras: boolean;
  asistente: Vec3Three;
  /** Agente que encuadra la cámara: se detiene, mira a cámara y gesticula; su sala lo mira. */
  enfocadoId?: string | null;
  /** Ambiente donde está la cámara (sin enfoque): su gente pasea la mitad y mira su trabajo. */
  ambienteId?: string | null;
  /** Nadie sale de la sala de su departamento (sin café ni visitas fuera de ella). */
  retenerEnSala?: boolean;
  /** Esqueletos de las personas, por id de agente (también los lee la cámara de enfoque). */
  rigs: MutableRefObject<Map<string, Rig>>;
  /** Personas humanas presentes (id, nombre y atuendo ya resuelto); su posición viene de `fuente`. */
  remotas?: readonly RemotaDibujable[];
  /** De aquí se lee, en cada cuadro, dónde está cada persona remota y hacia dónde mira. */
  fuente?: FuentePresencia | null;
  /** Avatar propio controlable (`mando`): se anima con `avanzarAvatar`, sin pasar por la fuente de presencia. */
  avatarPropio?: AvatarPropio | null;
  /** Quién habla ahora (se resalta con contorno y su nombre se tiñe). */
  hablandoIds?: ReadonlySet<string>;
  /** La cámara sigue al avatar propio: quien se interpone entre ella y él se oculta (oclusión). */
  seguir?: boolean;
}

/**
 * El avatar del usuario. `x`, `z` son la posición inicial; si faltan, parte en `escenario.entradas[0]`
 * mirando hacia donde mira esa entrada (fuera del grupo). El movimiento lo lleva `mando`. `alCambiar` se llama en cada cuadro con un objeto que se reutiliza (no lo guardes).
 */
export interface AvatarPropio {
  id: string;
  nombre: string;
  atuendo?: Atuendo;
  x?: number;
  z?: number;
  mando: Mando;
  /** `y`: altura de los pies (sube escaleras, salta). */
  alCambiar?: (estado: {
    x: number;
    y: number;
    z: number;
    rumbo: number;
    velocidad: number;
    /** Postura y asiento (`Accion.id`) para la presencia; sentado, `y` es el asiento (la pelvis). */
    estado: 'de-pie' | 'sentado';
    asiento: string | null;
  }) => void;
}

/** Una persona remota lista para montar su esqueleto. */
export interface RemotaDibujable {
  agente: AgenteOficina;
  atuendo: AtuendoResuelto;
}

const SIN_HABLANTES: ReadonlySet<string> = new Set();
const colorAro = new Color();
const COLOR_SELECCION = new Color('#f0a848');
const COLOR_HABLA = new Color('#7fe0ff');
const ESCALA_UNO = new Vector3(1, 1, 1);
/** Orden YXZ: primero el rumbo, luego la inclinación hacia delante (marca y sombra sobre una escalera). */
const INCLINACION = new Euler(0, 0, 0, 'YXZ');
const ORIENTACION = new Quaternion();
/** Radio de la esfera que envuelve a una persona de pie (para descartar las que no se ven). */
const RADIO_PERSONA = 1.3;
/** Oclusión en «seguirme»: cuerpo de cada persona (m), holgura (m) y segundos que sigue oculta tras dejar de tapar. */
const RADIO_OCLUSION = 0.3;
const ALTO_OCLUSION = 1.8;
const MARGEN_OCLUSION = 0.25;
const RETARDO_OCLUSION = 0.25;
/** Altura sobre los pies del avatar a la que la cámara debe verlo (el pecho-cabeza). */
const ALTURA_VISTA_AVATAR = 1.2;

/** Presupuesto inicial de animación (ms por cuadro) de agentes y de personas remotas, cada uno. */
const PRESUPUESTO_ANIMACION_MS = 2;
/** Esfera (m) alrededor de una persona que se prueba contra el encuadre: así no se pausa al asomarse. */
const RADIO_ENCUADRE = 1.2;
const ALTURA_CENTRO_PERSONA = 0.9;
/** Tope (s) del tiempo que se integra de una vez al volver a animar a alguien (LOD). */
const DT_MAX_LOD = 0.25;
/** Personas que se ofrecen como candidatas de la mirada al crear (crece si hace falta). */
const CANDIDATOS_INICIALES = 64;

/**
 * Mundo del avatar propio: el suelo con alturas del escenario (`sueloDe`: losas, escaleras, tarimas,
 * muebles pisables; uno plano si el escenario no trae), su mapa de colisión por altura y la navegación
 * por capas (un clic en otra planta va por la escalera). Se calcula una vez por escenario, la primera
 * vez que hay avatar.
 */
const mundosAvatar = new WeakMap<Escenario, { mapa: MapaColision; nav: Navegacion }>();
function mundoDelAvatar(escenario: Escenario) {
  let mundo = mundosAvatar.get(escenario);
  if (!mundo) {
    const mapa = crearMapaDeSuelo(sueloDe(escenario));
    mundo = { mapa, nav: crearNavegacion(mapa, 0.25, RADIO_AVATAR) };
    mundosAvatar.set(escenario, mundo);
  }
  return mundo;
}

interface AvatarVivo {
  id: string;
  avatar: Avatar;
  cuerpo: EstadoCuerpo;
}

/**
 * Todas las personas. Un único `useFrame` actualiza a las N: avanza la simulación de cada
 * una, calcula las matrices de mundo de su esqueleto y escribe cada pieza como una
 * instancia de la `Flota` (un draw call por tipo de pieza, no por persona). Medido con 30
 * agentes: de 934 draw calls con una malla por pieza a unas decenas.
 *
 * Alternativas descartadas: `SkinnedMesh` por persona (un draw call por persona y más
 * costo de huesos) y fusionar cada persona (pierde la articulación por piezas).
 */
export function Personas({
  agentes,
  miradaAgentes,
  gestoAgentes,
  atuendos,
  puestos,
  seleccionadoId,
  onSeleccionar,
  movimiento,
  paseos,
  sombras,
  asistente,
  enfocadoId = null,
  ambienteId = null,
  retenerEnSala = false,
  rigs,
  remotas = [],
  fuente = null,
  avatarPropio = null,
  hablandoIds = SIN_HABLANTES,
  seguir = false,
}: Props) {
  const escenario = useEscenario();
  const sims = useRef(new Map<string, Sim>());
  // Quién está en el mismo ambiente y cómo se agrupan: si cambia, el coordinador empieza de cero.
  const claveGrupo = useMemo(
    () => agentes.map((a, i) => `${a.id}@${puestos[i]?.sala ?? 0}`).join('|'),
    [agentes, puestos],
  );
  const coordinador = useRef<{ clave: string; c: Coordinador; atencion: Atencion } | null>(null);
  const ordenes = useRef({ miradaAgentes, gestoAgentes });
  ordenes.current = { miradaAgentes, gestoAgentes };
  const datos = useRef({
    agentes,
    puestos,
    seleccionadoId,
    movimiento,
    paseos,
    sombras,
    enfocadoId,
    ambienteId,
    retenerEnSala,
  });
  datos.current = {
    agentes,
    puestos,
    seleccionadoId,
    movimiento,
    paseos,
    sombras,
    enfocadoId,
    ambienteId,
    retenerEnSala,
  };
  const resaltados = useRef({ seleccionadoId, hablandoIds });
  resaltados.current = { seleccionadoId, hablandoIds };
  const grafica = useGrafica();
  const graficaVigente = useRef(grafica);
  graficaVigente.current = grafica;
  const flota = useMemo(() => new Flota(), []);
  const lodDe = useRef(new WeakMap<Rig, NivelLod>());
  const idDeRig = useRef(new WeakMap<Rig, string>());
  const rigsConocidos = useRef(-1);
  const contorno = useMemo(() => familiaContorno(), []);
  const relleno = useMemo(() => familiaRelleno(), []);
  const marchas = useRef(new Map<string, MarchaRemota>());
  const poseRemota = useMemo(() => crearPose(), []);
  const entradaRemota = useMemo(
    () => ({ fase: 0, postura: 'de_pie' as 'de_pie' | 'caminando', velocidad: 0, t: 0 }),
    [],
  );
  const vivas = useRef({ fuente, remotas, avatarPropio, seguir });
  vivas.current = { fuente, remotas, avatarPropio, seguir };
  const oclusion = useMemo(
    () => ({
      memoria: crearMemoriaOclusion(RETARDO_OCLUSION),
      ocultas: new Set<string>(),
      cabeza: { x: 0, y: 0, z: 0 },
    }),
    [],
  );
  const avatarVivo = useRef<AvatarVivo | null>(null);
  const salidaAvatar = useMemo(
    () => ({
      x: 0,
      y: 0,
      z: 0,
      rumbo: 0,
      velocidad: 0,
      estado: 'de-pie' as 'de-pie' | 'sentado',
      asiento: null as string | null,
    }),
    [],
  );
  // Personas remotas sentadas: transición por persona y quién está sentado este cuadro.
  const sentadasRemotas = useMemo(() => crearSentadasRemotas(), []);
  const sentadasAhora = useMemo(() => new Set<string>(), []);
  // LOD y medición: uno para los agentes y otro para las personas remotas (cada bucle abre su cuadro).
  const lodAgentes = useRef(
    crearLod(PARAMETROS_LOD, 128, crearPresupuesto(PRESUPUESTO_ANIMACION_MS)),
  );
  const lodRemotas = useMemo(
    () => crearLod(PARAMETROS_LOD, 128, crearPresupuesto(PRESUPUESTO_ANIMACION_MS)),
    [],
  );
  // Posiciones de los demás para que el avatar propio se separe de ellos (no se empujan entre sí).
  const otrosAvatar = useMemo(() => crearOtros(512), []);
  const medidorAgentes = medidoresAnimacion.agentes;
  const medidorRemotas = medidoresAnimacion.remotas;
  const cuadro = useRef(0);
  const vista = useMemo(() => {
    const frustum = new Frustum();
    const esfera = new Sphere(new Vector3(), RADIO_ENCUADRE);
    return {
      proyeccion: new Matrix4(),
      frustum,
      plan: { intervalo: 1, pausada: false, actualizar: true, dt: 0 } as PlanLod,
      entrada: { distancia: 0, enPantalla: true, seleccionado: false, habla: false } as EntradaLod,
      /** Se reutiliza en `relacion.candidatos`: así no se asigna un objeto por persona y cuadro. */
      candidatosRel: { c: crearCandidatos(0), n: 0 } as { c: Candidatos; n: number },
      enVista: (x: number, y: number, z: number) => {
        esfera.center.set(x, y + ALTURA_CENTRO_PERSONA, z);
        return frustum.intersectsSphere(esfera);
      },
    };
  }, []);
  const candidatos = useRef(crearCandidatos(CANDIDATOS_INICIALES));
  // Objetos del bucle: se crean una vez y se reutilizan en cada cuadro.
  const reutilizables = useMemo(
    () => ({
      matriz: new Matrix4(),
      frustum: new Frustum(),
      esfera: new Sphere(),
      proyeccion: new Matrix4(),
      posicion: new Vector3(),
      geometriaBlob: geometria('plano-blob', () =>
        new PlaneGeometry(1.1, 1.1).rotateX(-Math.PI / 2),
      ),
      cartel: new Quaternion(),
      blob: propio(materialBlob()),
      aro: propio(materialAnillo(), ORDEN.anillo),
      marcaPropia: propio(materialMarcaPropia(), ORDEN.anillo),
      relacion: {
        interaccion: null,
        socio: null,
        puestoSocio: null,
        atencion: null,
        foco: null,
      } as Relacion,
    }),
    [],
  );

  useEffect(() => {
    const vigentes = new Set(agentes.map((a) => a.id));
    for (const id of sims.current.keys()) if (!vigentes.has(id)) sims.current.delete(id);
  }, [agentes]);

  useEffect(() => {
    flota.fijarSombras(sombras);
  }, [flota, sombras]);

  useEffect(() => {
    flota.fijarRangosParciales(grafica.tecnicas.rangosParciales);
  }, [flota, grafica.tecnicas.rangosParciales]);

  useEffect(() => {
    const vigentes = new Set(remotas.map((r) => r.agente.id));
    for (const id of marchas.current.keys()) if (!vigentes.has(id)) marchas.current.delete(id);
  }, [remotas]);

  useEffect(() => () => flota.liberar(), [flota]);

  useFrame((estado, delta) => {
    const {
      agentes: lista,
      puestos: lugares,
      seleccionadoId: elegido,
      movimiento: mov,
      paseos: pasea,
      sombras: conSombras,
      enfocadoId: idEnfocado,
      ambienteId: idAmbiente,
    } = datos.current;
    const contexto = {
      t: estado.clock.elapsedTime,
      dt: Math.min(delta, 0.1),
      movimiento: mov,
      paseos: pasea,
      azar: Math.random,
      asistente,
      camara: estado.camera.position,
      retenerEnSala: datos.current.retenerEnSala,
      suelo: sueloDe(escenario),
    };
    const dtGlobal = contexto.dt;
    const {
      matriz,
      posicion,
      geometriaBlob,
      cartel,
      blob,
      aro,
      marcaPropia,
      relacion,
      frustum,
      esfera,
      proyeccion,
    } = reutilizables;
    if (rigs.current.size !== rigsConocidos.current) {
      rigsConocidos.current = rigs.current.size;
      for (const [id, rig] of rigs.current) idDeRig.current.set(rig, id);
      oclusion.memoria.olvidar(new Set(rigs.current.keys()));
    }
    const { tecnicas, lod: lodGeometria, distanciaEtiquetas } = graficaVigente.current;
    const descartar = tecnicas.descarte && !conSombras;
    if (descartar) actualizarFrustum(estado.camera, frustum, proyeccion);
    const camara = estado.camera.position;
    // Oclusión (solo «seguirme»): quién está entre la cámara y el avatar se oculta; la posición del avatar es la del cuadro anterior.
    const { ocultas, memoria, cabeza } = oclusion;
    ocultas.clear();
    const conAvatar = vivas.current.seguir ? avatarVivo.current : null;
    if (conAvatar) {
      cabeza.x = conAvatar.avatar.x;
      cabeza.y = conAvatar.avatar.ySuelo + ALTURA_VISTA_AVATAR;
      cabeza.z = conAvatar.avatar.z;
      for (const [id, rig] of rigs.current) {
        if (id === conAvatar.id) continue;
        const p = rig.raiz.position;
        if (ocluye(camara, cabeza, p.x, p.y, p.z, RADIO_OCLUSION, ALTO_OCLUSION, MARGEN_OCLUSION)) {
          memoria.marcar(id, contexto.t);
        }
        if (memoria.oculta(id, contexto.t)) ocultas.add(id);
      }
    }
    estadisticasGrafica.personas = 0;
    estadisticasGrafica.descartadas = 0;
    estadisticasGrafica.lodSimple = 0;
    estadisticasGrafica.contorno = 0;
    if (coordinador.current?.clave !== claveGrupo) {
      const salas = lugares.reduce((mayor, p) => Math.max(mayor, p.sala + 1), 1);
      coordinador.current = {
        clave: claveGrupo,
        c: crearCoordinador(lista.length, salas, contexto.t, contexto.azar),
        atencion: crearAtencion(lista.length),
      };
    }
    const coord = coordinador.current.c;
    const atencion = coordinador.current.atencion;
    if (contexto.t >= coord.proximaEvaluacion) {
      // A 4 Hz: lo que cada persona está haciendo → conversaciones y visitas.
      for (let i = 0; i < lista.length; i++) {
        const agente = lista[i];
        const puesto = lugares[i];
        const sim = agente && sims.current.get(agente.id);
        const vista = coord.vistas[i];
        if (!agente || !puesto || !sim || !vista) continue;
        const quieta = sim.nav.hacia < 0;
        vista.sala = puesto.sala;
        vista.estado = agente.estado;
        // En su lugar de trabajo: sentada en su silla, o parada junto a su mueble.
        vista.sentado =
          quieta &&
          sim.nav.nodo === NODO_ASIENTO &&
          (sim.sit > 0.9 || !puesto.sentado) &&
          sim.maquina.paseo === null;
        vista.enPausa =
          quieta && sim.nav.nodo === sim.cadena.length - 1 && sim.maquina.paseo?.fase === 'pausa';
        vista.llego = quieta && sim.tramoVisita && sim.nav.nodo === NODO_VISITA;
        vista.quieta = quieta && sim.atentoListo;
        vista.x = sim.x;
        vista.z = sim.z;
      }
      // Atención al enfoque; quien lo atiende no inicia ni sigue conversaciones ni visitas.
      let enfocado = -1;
      let salaAmbiente = -1;
      for (let i = 0; i < lista.length; i++) {
        if (lista[i]?.id === idEnfocado) enfocado = i;
        if (salaAmbiente < 0 && idAmbiente !== null && lugares[i]?.ambiente === idAmbiente) {
          salaAmbiente = lugares[i]?.sala ?? -1;
        }
      }
      actualizarAtencion(
        atencion,
        lista.length,
        coord.vistas,
        {
          enfocado,
          salaAmbiente,
          asistenteX: asistente.x,
          asistenteZ: asistente.z,
          permitido: pasea,
        },
        contexto.t,
      );
      for (let i = 0; i < lista.length; i++) {
        const vista = coord.vistas[i];
        const rol = atencion.personas[i]?.rol;
        if (vista) {
          vista.disponible = lista[i]?.id !== elegido && rol !== 'enfocado' && rol !== 'sala';
        }
      }
      avanzarInteracciones(coord, lista.length, contexto.t, contexto.azar, pasea);
    }
    cartel.copy(estado.camera.quaternion);
    const usaLod = OPCIONES.presupuestoLod || OPCIONES.pausaFueraDePantalla;
    if (usaLod) {
      estado.camera.updateMatrixWorld();
      vista.proyeccion.multiplyMatrices(
        estado.camera.projectionMatrix,
        estado.camera.matrixWorldInverse,
      );
      vista.frustum.setFromProjectionMatrix(vista.proyeccion);
    }
    if (lodAgentes.current.capacidad < lista.length) {
      lodAgentes.current = crearLod(
        PARAMETROS_LOD,
        lista.length * 2,
        lodAgentes.current.presupuesto,
      );
    }
    const lod = lodAgentes.current;
    iniciarCuadroLod(lod, contexto.dt);
    cuadro.current++;
    materialAnillo().opacity = 0.55 + Math.sin(contexto.t * 4) * 0.25;
    // Esqueleto → matrices de mundo → una instancia por pieza visible (agentes y personas).
    // `yPie` es la altura del piso bajo la persona (marca y sombra); `pendiente` y `rumbo` apoyan esas
    // formas planas sobre una escalera en vez de dejarlas horizontales, medio enterradas en los peldaños.
    const dibujarRig = (
      rig: Rig,
      x: number,
      y: number,
      z: number,
      actualizarMatrices = true,
      yPie = y,
      pendiente = 0,
      rumbo = 0,
    ) => {
      const apoyar = (alto: number) => {
        posicion.set(x, yPie + alto, z);
        INCLINACION.set(-Math.atan(pendiente), rumbo, 0);
        matriz.compose(posicion, ORIENTACION.setFromEuler(INCLINACION), ESCALA_UNO);
      };
      // Quien está en un piso sobre el corte de casa de muñecas (dentro de un ambiente) no se dibuja.
      if (y >= planoCorte.constant) return;
      estadisticasGrafica.personas++;
      if (descartar && !personaVisible(frustum, x, y + 0.9, z, RADIO_PERSONA, esfera)) {
        estadisticasGrafica.descartadas++;
        return;
      }
      // Sin turno de animación este cuadro se reutiliza la matrixWorld del anterior.
      if (actualizarMatrices) rig.raiz.updateMatrixWorld(true);
      // El avatar propio lleva una marca verde en el piso: se distingue de lejos entre todas las personas.
      if (avatarVivo.current && idDeRig.current.get(rig) === avatarVivo.current.id) {
        apoyar(0.014);
        flota.agregar(geometriaMarcaPropia(), marcaPropia.familia, matriz, null, 0);
      }
      // Tapa al avatar en «seguirme»: no se dibuja (solo su sombra de contacto, que marca dónde está).
      if (ocultas.size > 0) {
        const idOculta = idDeRig.current.get(rig);
        if (idOculta !== undefined && ocultas.has(idOculta)) {
          if (!conSombras && tecnicas.blob) {
            apoyar(0.012);
            flota.agregar(geometriaBlob, blob.familia, matriz, null, 0);
          }
          return;
        }
      }
      let nivelLod: NivelLod = 0;
      const dx = camara.x - x;
      const dy = camara.y - y;
      const dz = camara.z - z;
      const distancia = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (tecnicas.lod) {
        nivelLod = elegirLod(distancia, lodDe.current.get(rig) ?? 0, lodGeometria);
        lodDe.current.set(rig, nivelLod);
        if (nivelLod === 1) estadisticasGrafica.lodSimple++;
      }
      // El aro de las personas humanas se atenúa con la distancia: a lo lejos se funden en una mancha.
      colorAro.setScalar(fuerzaAro(distancia, distanciaEtiquetas));
      for (const parte of rig.partes) {
        if (!parte.ancla.visible) continue;
        if (parte.cartel) {
          posicion.setFromMatrixPosition(parte.ancla.matrixWorld);
          matriz.compose(posicion, cartel, ESCALA_UNO);
          flota.agregar(parte.geometria, parte.estilo.familia, matriz, null, parte.celda);
        } else {
          flota.agregar(
            nivelLod === 1 ? geometriaSimple(parte.geometria) : parte.geometria,
            parte.estilo.familia,
            parte.ancla.matrixWorld,
            parte.estilo.familia.material === materialAroHumano() ? colorAro : parte.estilo.color,
            parte.celda,
          );
        }
      }
      if (tecnicas.contorno) {
        const { seleccionadoId: elegidoId, hablandoIds: hablan } = resaltados.current;
        const id = idDeRig.current.get(rig);
        const habla = id !== undefined && hablan.has(id);
        if (habla || (id !== undefined && id === elegidoId)) {
          for (const parte of rig.partes) {
            const f = parte.estilo.familia;
            if (!parte.ancla.visible || parte.cartel || f.atlas || !f.clave.startsWith('std:'))
              continue;
            estadisticasGrafica.contorno++;
            const forma = nivelLod === 1 ? geometriaSimple(parte.geometria) : parte.geometria;
            flota.agregar(forma, relleno, parte.ancla.matrixWorld, null, 0);
            flota.agregar(
              forma,
              contorno,
              parte.ancla.matrixWorld,
              habla ? COLOR_HABLA : COLOR_SELECCION,
              0,
            );
          }
          flota.agregar(puentePiernas(), relleno, rig.pelvis.matrixWorld, null, 0);
          flota.agregar(puenteBrazo(), relleno, rig.brazos[0].hombro.matrixWorld, null, 0);
          flota.agregar(puenteBrazo(), relleno, rig.brazos[1].hombro.matrixWorld, null, 0);
        }
      }
      if (rig.anillo.visible) {
        rig.anillo.updateMatrixWorld();
        flota.agregar(geometriaAnillo(), aro.familia, rig.anillo.matrixWorld, null, 0);
      }
      if (!conSombras && tecnicas.blob) {
        apoyar(0.012);
        flota.agregar(geometriaBlob, blob.familia, matriz, null, 0);
      }
    };
    flota.inicio();

    // Candidatos de la mirada: el avatar y los agentes, con la posición del cuadro anterior.
    const avatarActual = avatarVivo.current;
    if (candidatos.current.id.length < lista.length + 1) {
      candidatos.current = crearCandidatos((lista.length + 1) * 2);
    }
    const cand = candidatos.current;
    let nCand = 0;
    if (avatarActual) {
      cand.x[nCand] = avatarActual.avatar.x;
      cand.z[nCand] = avatarActual.avatar.z;
      cand.velocidad[nCand] = avatarActual.avatar.velocidad;
      cand.habla[nCand] = 0;
      cand.id[nCand] = avatarActual.cuerpo.idNum;
      nCand++;
    }
    for (let i = 0; i < lista.length; i++) {
      const agente = lista[i];
      const otro = agente && sims.current.get(agente.id);
      if (!agente || !otro) continue;
      cand.x[nCand] = otro.x;
      cand.z[nCand] = otro.z;
      cand.velocidad[nCand] = otro.marcha * VELOCIDAD_PASEO;
      cand.habla[nCand] = agente.actividad === 'hablando' ? 1 : 0;
      cand.id[nCand] = otro.idNum;
      nCand++;
    }
    const camaraPos = estado.camera.position;
    const inicioAgentes = performance.now();
    for (let i = 0; i < lista.length; i++) {
      const agente = lista[i];
      const puesto = lugares[i];
      const rig = agente && rigs.current.get(agente.id);
      if (!agente || !puesto || !rig) continue;
      let sim = sims.current.get(agente.id);
      const nueva = !sim;
      if (!sim) {
        sim = crearSim(agente, puesto, contexto.t, contexto.azar);
        sims.current.set(agente.id, sim);
      }
      // LOD: quién toca animarse este cuadro y cuánto tiempo integra. La persona nueva se anima ya.
      let toca = true;
      let dtPersona = contexto.dt;
      if (usaLod && !nueva) {
        const entrada = vista.entrada;
        entrada.distancia = Math.hypot(
          camaraPos.x - sim.x,
          camaraPos.y - sim.y,
          camaraPos.z - sim.z,
        );
        entrada.enPantalla = !OPCIONES.pausaFueraDePantalla || vista.enVista(sim.x, sim.y, sim.z);
        entrada.seleccionado =
          agente.id === elegido ||
          agente.id === idEnfocado ||
          ordenes.current.miradaAgentes?.[agente.id] !== undefined ||
          ordenes.current.gestoAgentes?.[agente.id] !== undefined;
        entrada.habla = agente.actividad === 'hablando';
        decidirLod(lod, i, entrada, cuadro.current, vista.plan);
        // Sin presupuesto, lo visible se anima siempre (solo se pausa lo de fuera).
        toca = OPCIONES.presupuestoLod || !entrada.enPantalla ? vista.plan.actualizar : true;
        if (toca && (OPCIONES.presupuestoLod || !entrada.enPantalla)) {
          dtPersona = Math.min(vista.plan.dt, DT_MAX_LOD);
        }
      }
      if (!toca) {
        dibujarRig(rig, sim.x, sim.y, sim.z, false);
        continue;
      }
      const seleccionado = agente.id === elegido;
      const interaccion = coord.interacciones[i] ?? null;
      const idSocio = interaccion && interaccion.socio >= 0 ? lista[interaccion.socio]?.id : null;
      relacion.interaccion = interaccion;
      relacion.socio = (idSocio && sims.current.get(idSocio)) || null;
      relacion.puestoSocio = (interaccion && lugares[interaccion.socio]) || null;
      relacion.atencion = atencion.personas[i] ?? null;
      const idFoco = atencion.enfocado >= 0 ? lista[atencion.enfocado]?.id : undefined;
      relacion.foco = (idFoco && sims.current.get(idFoco)) || null;
      vista.candidatosRel.c = cand;
      vista.candidatosRel.n = nCand;
      relacion.candidatos = vista.candidatosRel;
      const objetivoPedido = ordenes.current.miradaAgentes?.[agente.id];
      const objetivo =
        typeof objetivoPedido === 'string'
          ? rigs.current.get(objetivoPedido)?.cabeza.getWorldPosition(reutilizables.posicion)
          : objetivoPedido;
      relacion.mirada = objetivo;
      relacion.gesto = ordenes.current.gestoAgentes?.[agente.id];
      contexto.dt = dtPersona;
      actualizarPersona(
        sim,
        rig,
        agente,
        puesto,
        seleccionado && agente.estado === 'libre',
        seleccionado,
        contexto,
        relacion,
      );
      contexto.dt = dtGlobal;

      dibujarRig(rig, sim.x, sim.y, sim.z);
    }
    const msAgentes = performance.now() - inicioAgentes;
    registrar(medidorAgentes, msAgentes);
    if (OPCIONES.presupuestoLod && lod.presupuesto) registrarCuadro(lod.presupuesto, msAgentes);

    // Avatar propio: responde al mando en este mismo cuadro y se dibuja como una persona más.
    const propio = vivas.current.avatarPropio;
    const rigPropio = propio ? rigs.current.get(propio.id) : undefined;
    if (propio && rigPropio) {
      if (avatarVivo.current?.id !== propio.id) {
        // Sin posición propia parte en la primera entrada del escenario (fuera del grupo), mirando hacia donde ella.
        const entrada = escenario.entradas[0];
        const propia = propio.x !== undefined || propio.z !== undefined;
        const avatar = crearAvatar(
          propio.x ?? entrada?.x ?? 0,
          propio.z ?? entrada?.z ?? 0,
          propia ? 0 : (entrada?.yaw ?? 0),
          entrada?.y ?? 0,
        );
        const cuerpo = crearEstadoCuerpo(propio.id);
        if (propio.atuendo) cuerpo.estiloCara = propio.atuendo.face;
        cuerpo.loc = avatar.loc;
        avatarVivo.current = { id: propio.id, avatar, cuerpo };
      }
      const { avatar, cuerpo } = avatarVivo.current;
      const mundo = mundoDelAvatar(escenario);
      if (consumirTrasladoD2(propio.mando, avatar, mundo.mapa)) cuerpo.loc = avatar.loc;
      // Quién está cerca en su planta: agentes (su simulación) y personas remotas (la fuente).
      let nOtros = 0;
      for (const ag of lista) {
        const sm = sims.current.get(ag.id);
        if (!sm || Math.abs(sm.y - avatar.y) > 1 || nOtros >= otrosAvatar.x.length) continue;
        otrosAvatar.x[nOtros] = sm.x;
        otrosAvatar.z[nOtros++] = sm.z;
      }
      for (const pr of vivas.current.fuente?.personas() ?? []) {
        if (pr.id === propio.id || Math.abs(pr.y - avatar.y) > 1 || nOtros >= otrosAvatar.x.length)
          continue;
        otrosAvatar.x[nOtros] = pr.x;
        otrosAvatar.z[nOtros++] = pr.z;
      }
      otrosAvatar.n = nOtros;
      // Azimut de la cámara: de su punto de mira (OrbitControls) hacia ella.
      const mira = (estado.controls as unknown as { target?: Vec3Three } | null)?.target;
      const azimut = Math.atan2(
        camaraPos.x - (mira ? mira.x : avatar.x),
        camaraPos.z - (mira ? mira.z : avatar.z),
      );
      // Escalera o tarima bajo sus pies: velocidad máxima menor (más lenta al subir).
      avatar.loc.topeVelocidad = mundo.mapa.suelo
        ? topeVelocidadEscalera(
            pendienteSuelo(mundo.mapa.suelo, avatar.x, avatar.z, avatar.rumbo, avatar.ySuelo),
            avatar.loc.correr,
          )
        : Number.POSITIVE_INFINITY;
      avanzarAvatar(
        avatar,
        propio.mando,
        azimut,
        mundo.mapa,
        mundo.nav,
        PARAMETROS_AVATAR,
        contexto.dt,
        otrosAvatar,
      );
      // La raíz va en el apoyo suavizado; el arco del salto lo sube la pelvis (`loc.salto.y`).
      rigPropio.raiz.position.set(avatar.x, avatar.yRaiz, avatar.z);
      cuerpo.suelo = mundo.mapa.suelo ?? null;
      cuerpo.ySuelo = avatar.ySuelo;
      orientarMiradaAccion(cuerpo, propio.mando.mirar);
      aplicarCuerpo(rigPropio, cuerpo, contexto.t, contexto.dt);
      const bajada = avatar.sentarse.salida;
      posarSentado(rigPropio, bajada.altura, bajada.inclinacionTorso);
      posarSaludoD2(propio.id, rigPropio, Date.now(), movimiento === 0);
      // La marca y la sombra van en el piso bajo sus pies (y sobre la cara que aterriza si salta), no en la raíz.
      const sueloAvatar = mundo.mapa.suelo ?? null;
      dibujarRig(
        rigPropio,
        avatar.x,
        avatar.yRaiz,
        avatar.z,
        true,
        alturaPies(avatar, sueloAvatar),
        sueloAvatar && avatar.enSuelo && avatar.estado !== 'sentado'
          ? pendienteSuelo(sueloAvatar, avatar.x, avatar.z, avatar.rumbo, avatar.ySuelo)
          : 0,
        avatar.rumbo,
      );
      if (propio.alCambiar) {
        salidaAvatar.x = avatar.x;
        salidaAvatar.y = alturaParaPresencia(
          avatar,
          sueloAvatar && !avatar.enSuelo && avatar.vy < 0
            ? alturaEn(sueloAvatar, avatar.x, avatar.z, avatar.y)
            : undefined,
        );
        salidaAvatar.z = avatar.z;
        salidaAvatar.rumbo = avatar.rumbo;
        salidaAvatar.velocidad = avatar.velocidad;
        salidaAvatar.estado = avatar.estado;
        salidaAvatar.asiento = avatar.asiento;
        propio.alCambiar(salidaAvatar);
      }
    }

    // Personas humanas: la posición y el rumbo llegan de fuera; `animarRemotas` les da la pose de marcha.
    // Las sentadas (`estado`) se posan al dibujarlas: la raíz baja al asiento y las piernas se doblan.
    const presentes = vivas.current.fuente?.personas() ?? [];
    sentadasAhora.clear();
    for (const q of presentes) if (q.estado === 'sentado') sentadasAhora.add(q.id);
    const sueloEscenario = sueloDe(escenario);
    const dibujarRemota = (rig: Rig, x: number, y: number, z: number) => {
      const id = idDeRig.current.get(rig);
      if (
        id !== undefined &&
        posarRemota(rig, sentadasAhora.has(id), y, contexto.dt, sentadasRemotas)
      ) {
        // Sentada, la raíz baja al asiento: la sombra va en el piso bajo ella.
        dibujarRig(
          rig,
          x,
          rig.raiz.position.y,
          z,
          true,
          alturaBajoAsiento(sueloEscenario, x, z, y, rig.raiz.position.y),
        );
      } else {
        if (id !== undefined) posarSaludoD2(id, rig, Date.now(), movimiento === 0);
        dibujarRig(rig, x, y, z);
      }
    };
    animarRemotas({
      presentes,
      rigs: rigs.current,
      marchas: marchas.current,
      pose: poseRemota,
      entrada: entradaRemota,
      dt: contexto.dt,
      t: contexto.t,
      movimiento: mov,
      dibujar: dibujarRemota,
      tAhora: contexto.t,
      camara: camaraPos,
      enVista: vista.enVista,
      lod: lodRemotas,
      cuadro: cuadro.current,
      medidor: medidorRemotas,
      suelo: contexto.suelo,
    });
    flota.fin();
  });

  return (
    <>
      {agentes.map((agente, i) => {
        const atuendo = atuendos[i];
        return atuendo ? (
          <Persona
            key={agente.id}
            agente={agente}
            atuendo={atuendo}
            seleccionado={agente.id === seleccionadoId}
            rigs={rigs}
            onSeleccionar={onSeleccionar}
          />
        ) : null;
      })}
      {remotas.map(({ agente, atuendo }) => (
        <Persona
          humano
          key={agente.id}
          agente={agente}
          atuendo={atuendo}
          seleccionado={agente.id === seleccionadoId}
          rigs={rigs}
          onSeleccionar={onSeleccionar}
        />
      ))}
      <primitive object={flota.raiz} dispose={null} />
    </>
  );
}
