import {
  crearBufferRemoto,
  muestrearRemoto,
  PARAMETROS_RED,
  recibirInstantanea,
} from '../animacion/instantaneas';
import type { BufferRemoto, SalidaRemota } from '../animacion/instantaneas';
import { despegar, PARAMETROS_SALTO } from '../animacion/salto';
import { crearCandidatos, type Candidatos } from '../animacion/interes';
import { decidirLod, iniciarCuadroLod, registrarCuadro } from '../animacion/lod';
import type { EntradaLod, EstadoLod, PlanLod } from '../animacion/lod';
import { registrar } from '../animacion/medicion';
import type { Medidor } from '../animacion/medicion';
import { OPCIONES } from '../animacion/opciones';
import { suavizarExp } from '../animacion/resorte';
import type { Suelo } from '../escenarios/suelo';
import type { Pose } from '../animacion/articulaciones';
import type { MarchaRemota } from '../presencia/marcha-remota';
import type { PersonaPresente } from '../presencia/tipos';
import type { Rig } from './animador';
import {
  alimentarLocomocion,
  aplicarCuerpo,
  crearEstadoCuerpo,
  elegirMirada,
  type EstadoCuerpo,
} from './cuerpo';

export interface EntradaRemota {
  fase: number;
  postura: 'de_pie' | 'caminando';
  velocidad: number;
  t: number;
}

export interface ContextoRemotas {
  presentes: readonly PersonaPresente[];
  rigs: Map<string, Rig>;
  /** Sin uso desde que la marcha vive en `cuerpo.ts`; se conserva para quien aún lo pasa. */
  marchas?: Map<string, MarchaRemota>;
  /** Sin uso (ver `marchas`). */
  pose?: Pose;
  /** Sin uso (ver `marchas`). */
  entrada?: EntradaRemota;
  dt: number;
  t: number;
  /** Sin uso (ver `marchas`). */
  movimiento?: number;
  /** Escribe las piezas del rig ya posado en la flota (lo pone `Personas`). */
  dibujar: (rig: Rig, x: number, y: number, z: number) => void;
  /** Reloj (s) de las instantáneas y del muestreo; si falta, `t`. */
  tAhora?: number;
  /** Posición de la cámara, para la distancia del LOD. */
  camara?: { x: number; y: number; z: number };
  /** ¿Está ese punto dentro del encuadre? Fuera de pantalla la animación se pausa. */
  enVista?: (x: number, y: number, z: number) => boolean;
  /** Estado del LOD: sin él, todas se animan en cada cuadro. */
  lod?: EstadoLod;
  /** Número de cuadro; si falta, un contador propio. */
  cuadro?: number;
  /** Recibe el costo (ms) de todo el bucle. */
  medidor?: Medidor;
  /** Suelo con altura del escenario: con él los pies de quien sube una escalera se apoyan en su peldaño. */
  suelo?: Suelo | null;
}

/** Valores iniciales parametrizables. */
export const PARAMETROS_REMOTAS = {
  /** Cuánto del error de cada intervalo estimado se corrige por instantánea (0..1). */
  gananciaIntervalo: 0.1,
  /** Cuánto del desvío entre el reloj estimado del emisor y la llegada se corrige por instantánea. */
  gananciaDeriva: 0.1,
  /** Cotas (s) del intervalo estimado entre envíos. */
  /** Intervalo (s) con que se supone que envía la fuente hasta medirlo (~10 Hz). */
  intervaloNominal: 0.1,
  intervaloMin: 0.01,
  intervaloMax: 0.5,
  /**
   * Media vida (s) de la altura dibujada: la `y` que llega sube de a un peldaño por vez y a 10 Hz; así
   * la raíz sube con el piso sin trepidar (los pies sí van peldaño a peldaño, ver `pisada.ts`).
   */
  mediaVidaAltura: 0.1,
  /** Diferencia de altura (m) desde la que el cambio se toma por teletransporte (otra planta): no se suaviza. */
  saltoAltura: 1.5,
  /** Rapidez horizontal (m/s) bajo la cual no se estima pendiente (parada o girando en sitio). */
  rapidezPendiente: 0.3,
  /** Media vida (s) de la velocidad vertical estimada. */
  mediaVidaVertical: 0.1,
};

interface EstadoRemota {
  cuerpo: EstadoCuerpo;
  buffer: BufferRemoto;
  muestra: SalidaRemota;
  /** Índice estable en el LOD. */
  indice: number;
  generacion: number;
  /** Reloj estimado del emisor en la última instantánea, su llegada y el intervalo entre envíos. */
  tEmisor: number;
  tLlegada: number;
  intervalo: number;
  recibidas: number;
  /** Última posición y rumbo vistos en la fuente. */
  fx: number;
  fy: number;
  fz: number;
  frumbo: number;
  /** Última posición y rumbo dibujados. */
  x: number;
  y: number;
  z: number;
  rumbo: number;
  /** Altura de la raíz (`y` suavizada) y velocidad vertical estimada (m/s). */
  yRaiz: number;
  vy: number;
  /** Segundos sin animar el esqueleto (se integran de una vez al volver a tocarle). */
  acumulado: number;
  actualizar: boolean;
  /** Último contador de saltos visto y cuándo despegar (reloj local; NaN = nada pendiente). */
  saltosVistos: number;
  despegueEn: number;
}

interface Registro {
  estados: Map<string, EstadoRemota>;
  orden: EstadoRemota[];
  libres: number[];
  siguiente: number;
  generacion: number;
  cuadro: number;
  candidatos: Candidatos;
  entradaLod: EntradaLod;
  plan: PlanLod;
}

/** Un registro por tabla de rigs: dos escenas (o dos pruebas) no comparten estados. */
const registros = new WeakMap<object, Registro>();

function registroDe(rigs: object): Registro {
  let r = registros.get(rigs);
  if (!r) {
    r = {
      estados: new Map(),
      orden: [],
      libres: [],
      siguiente: 0,
      generacion: 0,
      cuadro: 0,
      candidatos: crearCandidatos(128),
      entradaLod: { distancia: 0, enPantalla: true, seleccionado: false, habla: false },
      plan: { intervalo: 1, pausada: false, actualizar: true, dt: 0 },
    };
    registros.set(rigs, r);
  }
  return r;
}

/**
 * Estampa de tiempo de una instantánea. La fuente no trae reloj del emisor y la red agrega
 * retardo variable: estampar con la hora de llegada hace que el intervalo (y la velocidad que de
 * él sale) fluctúe. Aquí se reconstruye un reloj regular: cada llegada avanza el reloj estimado
 * en un número entero de intervalos (cubre las pérdidas) y la deriva con respecto a las llegadas
 * se corrige poco a poco. Siempre creciente. No asigna memoria.
 */
function relojEmisor(e: EstadoRemota, llegada: number): number {
  const p = PARAMETROS_REMOTAS;
  if (e.recibidas === 0) {
    e.tEmisor = llegada;
  } else {
    const hueco = llegada - e.tLlegada;
    if (e.recibidas === 1) {
      // Primer intervalo: el nominal, salvo que el hueco indique una fuente más rápida.
      e.intervalo = Math.min(p.intervaloNominal, Math.max(p.intervaloMin, hueco));
    }
    const k = Math.max(1, Math.round(hueco / e.intervalo));
    if (k === 1) {
      const medido = Math.min(p.intervaloMax, Math.max(p.intervaloMin, hueco));
      e.intervalo += p.gananciaIntervalo * (medido - e.intervalo);
    }
    const previo = e.tEmisor;
    e.tEmisor += k * e.intervalo;
    e.tEmisor += p.gananciaDeriva * (llegada - e.tEmisor);
    if (!(e.tEmisor > previo)) e.tEmisor = previo + p.intervaloMin;
  }
  e.recibidas++;
  e.tLlegada = llegada;
  return e.tEmisor;
}

/** Estado del cuerpo de una persona remota (pruebas y página del laboratorio). */
export function cuerpoRemoto(rigs: object, id: string): EstadoCuerpo | undefined {
  return registros.get(rigs)?.estados.get(id)?.cuerpo;
}

function crearEstado(persona: PersonaPresente, indice: number): EstadoRemota {
  const cuerpo = crearEstadoCuerpo(persona.id);
  cuerpo.estiloCara = persona.atuendo.face;
  cuerpo.loc.x = persona.x;
  cuerpo.loc.z = persona.z;
  cuerpo.loc.rumbo = persona.rumbo;
  return {
    cuerpo,
    buffer: crearBufferRemoto(),
    muestra: {
      x: persona.x,
      y: persona.y,
      z: persona.z,
      rumbo: persona.rumbo,
      velX: 0,
      velZ: 0,
      velocidad: 0,
      extrapolando: false,
    },
    indice,
    generacion: 0,
    tEmisor: 0,
    tLlegada: 0,
    intervalo: 0,
    recibidas: 0,
    fx: Number.NaN,
    fy: Number.NaN,
    fz: Number.NaN,
    frumbo: Number.NaN,
    saltosVistos: persona.saltos ?? 0,
    despegueEn: Number.NaN,
    x: persona.x,
    y: persona.y,
    z: persona.z,
    rumbo: persona.rumbo,
    yRaiz: persona.y,
    vy: 0,
    acumulado: 0,
    actualizar: true,
  };
}

/**
 * Personas humanas: la posición y el rumbo llegan de fuera (fuente de presencia a ~10 Hz).
 * Aquí se dibujan en el pasado entre instantáneas (`OPCIONES.snapshots`), se les da la pose del
 * cuerpo (`aplicarCuerpo`) con el nivel de detalle que indique el LOD y se entregan a `dibujar`
 * (todas, también las que saltan la animación este cuadro).
 *
 * No asigna memoria por cuadro salvo al ver a una persona por primera vez.
 */
export function animarRemotas(ctx: ContextoRemotas): void {
  const { presentes, rigs, dt, dibujar, lod, camara, enVista } = ctx;
  const reg = registroDe(rigs);
  const presupuesto = lod && OPCIONES.presupuestoLod ? lod.presupuesto : null;
  const medir = ctx.medidor !== undefined || presupuesto !== null;
  const inicio = medir ? performance.now() : 0;
  const tAhora = ctx.tAhora ?? ctx.t;
  const cuadro = ctx.cuadro ?? reg.cuadro++;
  const usaLod = lod !== undefined && (OPCIONES.presupuestoLod || OPCIONES.pausaFueraDePantalla);
  if (lod) iniciarCuadroLod(lod, dt);
  reg.generacion++;
  const orden = reg.orden;
  orden.length = 0;

  // Pasada 1: estados, instantáneas, plan del LOD, posición dibujada y candidatos de mirada.
  let n = 0;
  for (let i = 0; i < presentes.length; i++) {
    const persona = presentes[i] as PersonaPresente;
    const rig = rigs.get(persona.id);
    if (!rig) continue;
    let e = reg.estados.get(persona.id);
    if (!e) {
      const indice = reg.libres.length > 0 ? (reg.libres.pop() as number) : reg.siguiente++;
      if (lod && indice < lod.capacidad) lod.visto[indice] = 0;
      e = crearEstado(persona, indice);
      reg.estados.set(persona.id, e);
    }
    e.generacion = reg.generacion;
    e.acumulado += dt > 0 ? dt : 0;

    if (
      persona.x !== e.fx ||
      persona.y !== e.fy ||
      persona.z !== e.fz ||
      persona.rumbo !== e.frumbo
    ) {
      e.fx = persona.x;
      e.fy = persona.y;
      e.fz = persona.z;
      e.frumbo = persona.rumbo;
      recibirInstantanea(
        e.buffer,
        relojEmisor(e, tAhora),
        persona.x,
        persona.y,
        persona.z,
        persona.rumbo,
      );
    }

    // Salto: un contador nuevo despega al mostrarse el instante en que saltó (con el mismo retraso
    // que las instantáneas); lo que falte del arco lo simula el cuerpo en local.
    const saltos = persona.saltos ?? 0;
    if (saltos !== e.saltosVistos) {
      e.saltosVistos = saltos;
      const retraso = OPCIONES.snapshots
        ? Math.min(
            PARAMETROS_RED.retardoMax,
            Math.max(PARAMETROS_RED.retardoMin, PARAMETROS_RED.retardoIntervalos * e.intervalo),
          )
        : 0;
      e.despegueEn = tAhora + retraso;
    }
    if (e.despegueEn === e.despegueEn && tAhora >= e.despegueEn) {
      e.despegueEn = Number.NaN;
      if (OPCIONES.caminataPoses) despegar(e.cuerpo.loc.salto, PARAMETROS_SALTO);
    }

    let pausada = false;
    e.actualizar = true;
    if (usaLod && lod) {
      const q = reg.entradaLod;
      if (camara) {
        const dx = camara.x - e.x;
        const dy = camara.y - (e.y + 0.9);
        const dz = camara.z - e.z;
        q.distancia = Math.sqrt(dx * dx + dy * dy + dz * dz);
      } else {
        q.distancia = 0;
      }
      q.enPantalla = OPCIONES.pausaFueraDePantalla && enVista ? enVista(e.x, e.y + 0.9, e.z) : true;
      decidirLod(lod, e.indice, q, cuadro, reg.plan);
      pausada = reg.plan.pausada;
      // Sin presupuesto, lo visible se anima siempre (solo se pausa lo de fuera).
      e.actualizar = OPCIONES.presupuestoLod || !q.enPantalla ? reg.plan.actualizar : true;
    }

    if (!pausada) {
      if (OPCIONES.snapshots) {
        const m = e.muestra;
        muestrearRemoto(e.buffer, tAhora, PARAMETROS_RED, m);
        e.x = m.x;
        e.y = m.y;
        e.z = m.z;
        // Sentándose se desliza hacia el asiento de espaldas a él: la mezcla del rumbo con la dirección del
        // movimiento la volcaría 90°; con el yaw del asiento (el rumbo que llega) queda derecha.
        e.rumbo = persona.estado === 'sentado' ? persona.rumbo : m.rumbo;
      } else {
        e.x = persona.x;
        e.y = persona.y;
        e.z = persona.z;
        e.rumbo = persona.rumbo;
      }
    }

    orden.push(e);
    if (n < reg.candidatos.id.length) {
      const c = reg.candidatos;
      c.x[n] = e.x;
      c.z[n] = e.z;
      c.velocidad[n] = e.cuerpo.loc.velocidad;
      c.habla[n] = 0;
      c.id[n] = e.cuerpo.idNum;
      n++;
    }
  }
  // Más personas que candidatos: se amplía (una vez) para el siguiente cuadro.
  if (orden.length > reg.candidatos.id.length) {
    reg.candidatos = crearCandidatos(Math.max(orden.length, reg.candidatos.id.length * 2));
  }

  // Pasada 2: animar (según el plan) y dibujar a todas.
  let k = 0;
  for (let i = 0; i < presentes.length; i++) {
    const rig = rigs.get((presentes[i] as PersonaPresente).id);
    if (!rig) continue;
    const e = orden[k++] as EstadoRemota;
    // La raíz sube con el piso: la altura que llega (peldaño a peldaño) se suaviza; otra planta de golpe, no.
    const yAntes = e.yRaiz;
    const teletransporte = Math.abs(e.y - yAntes) > PARAMETROS_REMOTAS.saltoAltura;
    e.yRaiz = teletransporte
      ? e.y
      : suavizarExp(yAntes, e.y, PARAMETROS_REMOTAS.mediaVidaAltura, dt > 0 ? dt : 0);
    rig.raiz.position.set(e.x, e.yRaiz, e.z);
    if (teletransporte) {
      e.vy = 0;
    } else if (dt > 0) {
      e.vy = suavizarExp(e.vy, (e.yRaiz - yAntes) / dt, PARAMETROS_REMOTAS.mediaVidaVertical, dt);
    }
    if (e.actualizar) {
      const c = e.cuerpo;
      alimentarLocomocion(c.loc, e.x, e.z, e.rumbo, e.acumulado);
      // Pendiente por la velocidad vertical (la inclinación del torso); los pies, con el suelo si lo hay.
      const rapidez = c.loc.velocidad;
      c.pendiente = rapidez > PARAMETROS_REMOTAS.rapidezPendiente ? e.vy / rapidez : 0;
      c.suelo = ctx.suelo ?? null;
      c.ySuelo = e.yRaiz;
      if (OPCIONES.interes) elegirMirada(c, reg.candidatos, n, tAhora, e.acumulado);
      aplicarCuerpo(rig, c, tAhora, e.acumulado);
      e.acumulado = 0;
    } else {
      rig.raiz.rotation.y = e.rumbo;
    }
    dibujar(rig, e.x, e.yRaiz, e.z);
  }

  // Quien ya no está presente libera su estado y su lugar en el LOD.
  if (reg.estados.size !== orden.length) {
    for (const [id, e] of reg.estados) {
      if (e.generacion === reg.generacion) continue;
      reg.estados.delete(id);
      reg.libres.push(e.indice);
    }
  }

  if (medir) {
    const ms = performance.now() - inicio;
    if (ctx.medidor) registrar(ctx.medidor, ms);
    if (presupuesto) registrarCuadro(presupuesto, ms);
  }
}
