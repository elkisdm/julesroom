import type { Azar } from '../azar';
import type { Caja } from '../mansion/plano';
import { atuendoPorRol } from '../vestuario/roles';
import { PARAMETROS_LOCOMOCION } from '../animacion/locomocion';
import { DISTANCIA_CORRER_RUTA } from '../animacion/avatar';
import {
  avanzarSentarse,
  crearSentarse,
  levantar,
  llegar,
  ocupado,
  pedirSentarse,
  posturaDe,
} from '../animacion/sentarse';
import type { Sentarse } from '../animacion/sentarse';
import type { AccionSentarse } from '../escenarios/tipos';
import type { FuentePresencia, PersonaPresente } from './tipos';

/** Zona de paseo simulada: el atrio de la casa (piso 1), esquivando el espejo de agua del centro. */
export const LIMITES_SIMULADOS = { semilado: 3.6, radioEspejo: 1.9 } as const;

/** Alta de una persona: lo que el transporte sabría al conectarse. */
export interface AltaPersona {
  id: string;
  nombre: string;
  atuendo?: PersonaPresente['atuendo'];
}

export interface OpcionesSimulada {
  cantidad: number;
  semilla: number;
  /** Identidades conocidas (p. ej. las personas de la definición), antes de las generadas. */
  altas?: AltaPersona[];
  /**
   * Punto por donde pasean (origen y destinos) para la persona de índice `indice`; sin él, el atrio
   * esquivando el espejo de agua. Con `mirar` es un corro: al llegar se queda largo rato conversando de
   * cara a ese centro.
   */
  puntoLibre?: (
    azar: Azar,
    indice: number,
  ) => { x: number; z: number; mirar?: { x: number; z: number } };
  /** Altura del piso por donde pasean; sin ella, 0 (piso 1). */
  y?: number;
  /**
   * Asientos del escenario (`accionesDe` → tipo `sentarse`): de vez en cuando alguien va a uno libre, se
   * sienta un rato (`estado: 'sentado'`, `asiento`, `y` del asiento) y se levanta. Solo se usan los de su
   * piso (el punto de aproximación a menos de `alturaPiso` de `y`, sea cual sea la altura del asiento);
   * sin ellos, nadie se sienta.
   */
  asientos?: readonly AccionSentarse[];
  /** Probabilidad (0–1) de ir a sentarse al llegar a un destino, habiendo un asiento libre. */
  probabilidadSentarse?: number;
}

/** Valores iniciales parametrizables de las personas simuladas que se sientan. */
export const PARAMETROS_SENTADAS = {
  /** Segundos sentadas: mínimo y variación. */
  duracion: 14,
  duracionExtra: 28,
  /** Un asiento solo se ofrece si el piso por donde se llega a él queda a menos de esto (m) del de paseo. */
  alturaPiso: 0.2,
  probabilidad: 0.15,
};

/** Nombres de ejemplo para personas generadas (sin personas reales ni clientes). */
export const NOMBRES_EJEMPLO = [
  'Lucía',
  'Mateo',
  'Valentina',
  'Santiago',
  'Camila',
  'Diego',
  'Isabella',
  'Andrés',
  'Mariana',
  'Tomás',
  'Sofía',
  'Nicolás',
  'Daniela',
  'Sebastián',
  'Paula',
  'Felipe',
  'Carolina',
  'Joaquín',
  'Renata',
  'Emilio',
  'Antonia',
  'Ignacio',
  'Javiera',
  'Martín',
  'Constanza',
  'Bruno',
  'Fernanda',
  'Rafael',
  'Catalina',
  'Hugo',
] as const;

/** Valores iniciales parametrizables. */
export const PARAMETROS_SEPARACION_AVATAR = {
  /** Distancia (m) mínima al avatar propio: dos cuerpos de radio 0,3 y un margen. */
  radio: 0.75,
  /** Rapidez (m/s) con que se aparta quien lo pisa: suave, sin teletransportes. */
  velocidadMax: 2.2,
  /** Diferencia de altura (m) a partir de la cual están en pisos distintos y no se estorban. */
  alturaPiso: 1.2,
};

/** Separación mínima entre personas simuladas (radio personal de cada una). */
export const PARAMETROS_SEPARACION_ENTRE = {
  radio: 0.55,
  velocidadMax: 1.8,
  alturaPiso: 1.2,
} as const;

/** Dónde está el avatar propio, para que las simuladas lo esquiven. */
export interface PuntoAvatar {
  x: number;
  z: number;
  /** Altura de sus pies. */
  y: number;
}

type PuntoLibreFn = (
  azar: Azar,
  indice: number,
) => { x: number; z: number; mirar?: { x: number; z: number } };

/** Punto al azar dentro de una caja (la zona de paseo de un escenario) para `puntoLibre`. */
export function puntoLibreEn(caja: Caja): PuntoLibreFn & { limites: Caja } {
  const fn = ((azar: Azar, indice: number) => {
    void indice;
    return {
      x: caja.x0 + azar() * (caja.x1 - caja.x0),
      z: caja.z0 + azar() * (caja.z1 - caja.z0),
    };
  }) as PuntoLibreFn & { limites: Caja };
  fn.limites = caja;
  return fn;
}

export interface FuenteSimulada extends FuentePresencia {
  /** Hace caminar a todos `dt` segundos. No avisa: las posiciones se leen cada cuadro. */
  avanzar(dt: number): void;
  agregar(alta: AltaPersona): void;
  quitar(id: string): void;
  /** El asiento (`AccionSentarse.id`) que ocupa quien usa la sala (el avatar propio): las simuladas no lo toman. */
  ocupar(asiento: string | null): void;
  /**
   * Dónde está el avatar propio (cada cuadro, o `null` si no hay): las simuladas que estarían dentro de su
   * radio personal se apartan de él, sin teletransportes. Las sentadas y las de otro piso no.
   */
  evitar(avatar: PuntoAvatar | null): void;
}

interface Caminante {
  persona: PersonaPresente;
  destinoX: number;
  destinoZ: number;
  /** Centro del corro al que mira al llegar; sin él, sigue de largo. */
  mirar?: { x: number; z: number };
  /** Segundos de pausa restantes en el destino. */
  pausa: number;
  /** Sentarse (solo con `asientos`), asiento al que va, y segundos que le quedan sentada. */
  sentar: Sentarse | null;
  hacia: AccionSentarse | null;
  sentadaRestante: number;
  /** ¿Estaba fuera del radio personal del avatar en el cuadro anterior? Si sí, lo que lo pisa lo hizo andando. */
  fueraDelAvatar: boolean;
}

function mulberry32(semilla: number): Azar {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Segundos de pausa en un corro: mínimo y variación (valores iniciales). */
const PAUSA_CORRO = 5;
const PAUSA_CORRO_EXTRA = 9;

const ROLES = ['Backend', 'QA', 'Redactor', 'Contador', 'Coach', 'Científico', 'Community'];

/**
 * Implementación de prueba de `FuentePresencia`: personas que caminan sin parar por el atrio.
 * Determinista con la misma semilla. Sirve para el laboratorio y para medir con 100 ocupantes.
 */
/** Probabilidad de saltar al llegar a un destino (personas simuladas). */
const PROBABILIDAD_SALTO = 0.2;

export function crearFuenteSimulada({
  cantidad,
  semilla,
  altas = [],
  puntoLibre: elegirPunto,
  y = 0,
  asientos = [],
  probabilidadSentarse = PARAMETROS_SENTADAS.probabilidad,
}: OpcionesSimulada): FuenteSimulada {
  const azar = mulberry32(semilla);
  const limitesPaseo: Caja | null =
    elegirPunto && 'limites' in elegirPunto
      ? (elegirPunto as PuntoLibreFn & { limites: Caja }).limites
      : elegirPunto
        ? null
        : (() => {
            const { semilado } = LIMITES_SIMULADOS;
            return { x0: -semilado, x1: semilado, z0: -semilado, z1: semilado };
          })();
  const acotarPaseo = (p: PersonaPresente): void => {
    if (!limitesPaseo) return;
    p.x = Math.min(limitesPaseo.x1, Math.max(limitesPaseo.x0, p.x));
    p.z = Math.min(limitesPaseo.z1, Math.max(limitesPaseo.z0, p.z));
  };
  const caminantes: Caminante[] = [];
  const lista: PersonaPresente[] = [];
  const oyentes = new Set<() => void>();
  const { semilado, radioEspejo } = LIMITES_SIMULADOS;
  const sentables = asientos.filter(
    (a) => Math.abs(a.asiento.aproximacion.y - y) < PARAMETROS_SENTADAS.alturaPiso,
  );
  const ocupados = new Set<string>();
  let ocupadoPorUsuario: string | null = null;
  let avatarAEvitar: PuntoAvatar | null = null;

  /** Con probabilidad `probabilidadSentarse`, manda a `c` a un asiento libre (su aproximación pasa a ser su destino). */
  function intentarSentarse(c: Caminante): boolean {
    if (!c.sentar || sentables.length === 0 || azar() >= probabilidadSentarse) return false;
    const inicio = Math.floor(azar() * sentables.length);
    for (let k = 0; k < sentables.length; k++) {
      const a = sentables[(inicio + k) % sentables.length] as AccionSentarse;
      if (ocupados.has(a.id) || a.id === ocupadoPorUsuario) continue;
      ocupados.add(a.id);
      c.hacia = a;
      c.destinoX = a.asiento.aproximacion.x;
      c.destinoZ = a.asiento.aproximacion.z;
      c.mirar = undefined;
      c.pausa = 0;
      return true;
    }
    return false;
  }

  /** Lo que viaja en la presencia mientras se sienta, está sentada y se levanta. */
  function reflejarSentada(c: Caminante): void {
    const s = c.sentar as Sentarse;
    const p = c.persona;
    p.estado = posturaDe(s);
    p.asiento = p.estado === 'sentado' ? (s.id ?? undefined) : undefined;
    p.y = p.estado === 'sentado' && s.asiento ? s.asiento.y : y;
  }

  function puntoLibre(indice: number): {
    x: number;
    z: number;
    mirar?: { x: number; z: number };
  } {
    if (elegirPunto) return elegirPunto(azar, indice);
    for (;;) {
      const x = (azar() * 2 - 1) * semilado;
      const z = (azar() * 2 - 1) * semilado;
      if (Math.abs(x) > radioEspejo || Math.abs(z) > radioEspejo) return { x, z };
    }
  }

  function agregarInterno(alta: AltaPersona): void {
    if (lista.some((p) => p.id === alta.id)) throw new Error(`La persona ya existe: «${alta.id}»`);
    const indice = lista.length;
    const origen = puntoLibre(indice);
    const destino = puntoLibre(indice);
    const persona: PersonaPresente = {
      id: alta.id,
      nombre: alta.nombre,
      atuendo:
        alta.atuendo ?? atuendoPorRol(ROLES[lista.length % ROLES.length] ?? '', lista.length),
      x: origen.x,
      y,
      z: origen.z,
      rumbo: Math.atan2(destino.x - origen.x, destino.z - origen.z),
    };
    lista.push(persona);
    caminantes.push({
      persona,
      destinoX: destino.x,
      destinoZ: destino.z,
      mirar: destino.mirar,
      pausa: 0,
      sentar: sentables.length > 0 ? crearSentarse() : null,
      hacia: null,
      sentadaRestante: 0,
      fueraDelAvatar: true,
    });
  }

  altas.forEach(agregarInterno);
  for (let i = 0; i < cantidad; i++) {
    const nombre = NOMBRES_EJEMPLO[(lista.length + i) % NOMBRES_EJEMPLO.length] ?? 'Visitante';
    agregarInterno({ id: `sim-${i + 1}`, nombre: `${nombre}` });
  }

  const avisar = () => oyentes.forEach((f) => f());

  return {
    personas: () => lista,
    suscribir(alCambiar) {
      oyentes.add(alCambiar);
      return () => void oyentes.delete(alCambiar);
    },
    ocupar(asiento) {
      ocupadoPorUsuario = asiento;
    },
    evitar(avatar) {
      avatarAEvitar = avatar;
      // Quien ya está dentro de su radio porque el avatar lo alcanzó se aparta de a poco.
      for (const c of caminantes)
        c.fueraDelAvatar =
          !avatar || distanciaAlAvatar(c.persona, avatar) >= PARAMETROS_SEPARACION_AVATAR.radio;
    },
    agregar(alta) {
      agregarInterno(alta);
      avisar();
    },
    quitar(id) {
      const i = lista.findIndex((p) => p.id === id);
      if (i < 0) return;
      const id_ = caminantes[i]?.hacia?.id ?? caminantes[i]?.sentar?.id;
      if (id_) ocupados.delete(id_);
      lista.splice(i, 1);
      caminantes.splice(i, 1);
      avisar();
    },
    avanzar(dt) {
      for (const c of caminantes) {
        const sentar = c.sentar;
        if (sentar && ocupado(sentar)) {
          avanzarSentarse(sentar, c.persona, dt);
          if (sentar.fase === 'sentado' && (c.sentadaRestante -= dt) <= 0) levantar(sentar);
          reflejarSentada(c);
          if (sentar.fase === 'libre') {
            ocupados.delete(c.hacia?.id ?? '');
            c.hacia = null;
            const nuevo = puntoLibre(caminantes.indexOf(c));
            c.destinoX = nuevo.x;
            c.destinoZ = nuevo.z;
            c.mirar = nuevo.mirar;
          }
          continue;
        }
        if (c.pausa > 0) {
          c.pausa -= dt;
          continue;
        }
        const p = c.persona;
        const dx = c.destinoX - p.x;
        const dz = c.destinoZ - p.z;
        const falta = Math.hypot(dx, dz);
        // Como el avatar: camina a paso de juego y los tramos largos los corre.
        const corre = falta > DISTANCIA_CORRER_RUTA.metros;
        const paso = (corre ? PARAMETROS_LOCOMOCION.velCorrer : PARAMETROS_LOCOMOCION.velMax) * dt;
        if (falta <= paso) {
          p.x = c.destinoX;
          p.z = c.destinoZ;
          if (c.hacia && sentar) {
            // Llegó a la aproximación del asiento: gira, se sienta y se queda un rato.
            pedirSentarse(sentar, c.hacia.id, c.hacia.asiento);
            llegar(sentar);
            c.sentadaRestante =
              PARAMETROS_SENTADAS.duracion + azar() * PARAMETROS_SENTADAS.duracionExtra;
            continue;
          }
          if (c.mirar) p.rumbo = Math.atan2(c.mirar.x - p.x, c.mirar.z - p.z);
          const nuevo = puntoLibre(caminantes.indexOf(c));
          c.destinoX = nuevo.x;
          c.destinoZ = nuevo.z;
          c.mirar = nuevo.mirar;
          // En un corro se conversa un buen rato; paseando, apenas se detiene.
          c.pausa = nuevo.mirar ? PAUSA_CORRO + azar() * PAUSA_CORRO_EXTRA : azar() * 2.5;
          // De vez en cuando celebra la llegada con un salto (se ve en todos los clientes).
          if (azar() < PROBABILIDAD_SALTO) p.saltos = (p.saltos ?? 0) + 1;
          intentarSentarse(c);
          continue;
        }
        p.x += (dx / falta) * paso;
        p.z += (dz / falta) * paso;
        p.rumbo = Math.atan2(dx, dz);
      }
      separarEntreSimuladas(caminantes, dt, acotarPaseo);
      const evitado = avatarAEvitar;
      if (evitado)
        for (const c of caminantes) if (!(c.sentar && ocupado(c.sentar))) apartar(c, evitado, dt);
    },
  };
}

/** Distancia en planta al avatar; infinita si están en pisos distintos. */
function distanciaAlAvatar(p: PersonaPresente, avatar: PuntoAvatar): number {
  if (Math.abs(p.y - avatar.y) > PARAMETROS_SEPARACION_AVATAR.alturaPiso) return Infinity;
  return Math.hypot(p.x - avatar.x, p.z - avatar.z);
}

/**
 * Aparta a quien camina del avatar hasta su radio personal. Si entró andando (estaba fuera hace un cuadro),
 * se desliza por el borde: el paso ya es suave. Si es el avatar quien lo alcanzó, se aparta a lo más
 * `velocidadMax · dt` por cuadro.
 */
/** Aparta pares de simuladas que quedaron más cerca que el radio mínimo. */
function separarEntreSimuladas(
  caminantes: Caminante[],
  dt: number,
  acotar: (p: PersonaPresente) => void,
): void {
  const { radio, velocidadMax, alturaPiso } = PARAMETROS_SEPARACION_ENTRE;
  const paso = Math.max(velocidadMax * dt, 1e-4);
  for (let rep = 0; rep < 4; rep++) {
    for (let a = 0; a < caminantes.length; a++) {
      const ca = caminantes[a]!;
      if (ca.sentar && ocupado(ca.sentar)) continue;
      const pa = ca.persona;
      for (let b = a + 1; b < caminantes.length; b++) {
        const cb = caminantes[b]!;
        if (cb.sentar && ocupado(cb.sentar)) continue;
        const pb = cb.persona;
        if (Math.abs(pa.y - pb.y) > alturaPiso) continue;
        const dx = pb.x - pa.x;
        const dz = pb.z - pa.z;
        const d = Math.hypot(dx, dz);
        if (d >= radio || d < 1e-6) continue;
        if (ca.pausa <= 0 || cb.pausa <= 0) continue;
        const falta = radio - d;
        const empuje = Math.min(falta / 2, paso);
        const ux = dx / d;
        const uz = dz / d;
        pa.x -= ux * empuje;
        pa.z -= uz * empuje;
        pb.x += ux * empuje;
        pb.z += uz * empuje;
      }
    }
  }
  for (const c of caminantes) if (!(c.sentar && ocupado(c.sentar))) acotar(c.persona);
}

function apartar(c: Caminante, avatar: PuntoAvatar, dt: number): void {
  const p = c.persona;
  const { radio, velocidadMax } = PARAMETROS_SEPARACION_AVATAR;
  const d = distanciaAlAvatar(p, avatar);
  if (d >= radio) {
    c.fueraDelAvatar = true;
    return;
  }
  const dx = p.x - avatar.x;
  const dz = p.z - avatar.z;
  const falta = radio - d;
  const empuje = c.fueraDelAvatar ? falta : Math.min(falta, velocidadMax * dt);
  c.fueraDelAvatar = empuje >= falta;
  // Justo encima del avatar no hay dirección: hacia donde mira, que es de donde viene.
  const ux = d > 1e-6 ? dx / d : Math.sin(p.rumbo + Math.PI);
  const uz = d > 1e-6 ? dz / d : Math.cos(p.rumbo + Math.PI);
  p.x += ux * empuje;
  p.z += uz * empuje;
}
