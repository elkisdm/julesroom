import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';
import { Group, Vector3 } from 'three';
import type { AtencionPersona } from '../animacion/atencion';
import type { Interaccion } from '../animacion/interacciones';
import { crearCandidatos } from '../animacion/interes';
import { PARAMETROS_LOCOMOCION } from '../animacion/locomocion';
import { fijarOpciones } from '../animacion/opciones';
import type { OpcionesMovimiento } from '../animacion/opciones';
import { NODO_PASILLO, NODO_VISITA } from '../animacion/ruta';
import { PARAMETROS_ZANCADA } from '../animacion/zancada';
import { fraccionApoyo, largoZancada } from '../animacion/caminata';
import { puestoDeVisita } from '../mansion/rutas';
import type { BufferGeometry } from 'three';
import { azarSemilla } from '../test-utils';
import type { AgenteOficina } from '../tipos';
import { apagarTodo, encenderTodo } from '../animacion/opciones';
import { actualizarPersona, crearSim, VELOCIDAD_PASEO } from './animador';
import type { ContextoFrame, Relacion, Rig, Sim } from './animador';
import type { Estilo } from './flota';
import { asignarPuestos, departamentosBase } from './layout';
import type { Parte } from './Pieza';

// Las celdas del atlas se dibujan en un <canvas>; aquí solo importa el movimiento.
vi.mock('./texturas', () => ({ celdasCara: () => [0, 1], celdaIcono: () => 0 }));

const parte = (): Parte => ({
  ancla: new Group(),
  geometria: {} as BufferGeometry,
  estilo: {} as Estilo,
  celda: 0,
  cartel: false,
});

/** Esqueleto de mentira: solo los grupos que el animador mueve. */
function rigDeMentira(accesorios = 0): Rig {
  const par = () => [new Group(), new Group()] as const;
  const [c0, c1] = par();
  const [r0, r1] = par();
  const [h0, h1] = par();
  const [k0, k1] = par();
  return {
    raiz: new Group(),
    pelvis: new Group(),
    columna: new Group(),
    torso: new Group(),
    cabeza: new Group(),
    piernas: [
      { cadera: c0, rodilla: c1 },
      { cadera: r0, rodilla: r1 },
    ],
    brazos: [
      { hombro: h0, codo: h1 },
      { hombro: k0, codo: k1 },
    ],
    taza: parte(),
    hoja: parte(),
    telefono: parte(),
    cara: parte(),
    icono: parte(),
    anillo: new Group(),
    partes: [],
    caraFija: null,
    tazaEquipada: false,
    alturaIcono: 1.9,
    secundarios: Array.from({ length: accesorios }, () => new Group()),
  };
}

const RELACION: Relacion = {
  interaccion: null,
  socio: null,
  puestoSocio: null,
  atencion: null,
  foco: null,
};

/** Simula `segundos` a 30 cuadros por segundo; devuelve la traza de (x, y, z) de la raíz y de la sim. */
function simular(
  departamento: string,
  estado: AgenteOficina['estado'],
  segundos: number,
  paseos = true,
) {
  const agente: AgenteOficina = {
    id: 'p',
    nombre: 'P',
    rol: 'Backend',
    departamento,
    estado,
  };
  const [puesto] = asignarPuestos([agente], departamentosBase);
  if (!puesto) throw new Error('sin puesto');
  const azar = azarSemilla(7);
  const sim = crearSim(agente, puesto, 0, azar);
  const rig = rigDeMentira();
  const contexto: ContextoFrame = {
    t: 0,
    dt: 1 / 30,
    movimiento: paseos ? 1 : 0.35,
    paseos,
    azar,
    asistente: new Vector3(0, 3.2, 0),
    camara: new Vector3(30, 27, 30),
  };
  const traza: { x: number; y: number; z: number; sit: number }[] = [];
  for (let i = 0; i < segundos * 30; i++) {
    contexto.t = i / 30;
    actualizarPersona(sim, rig, agente, puesto, false, false, contexto, RELACION);
    traza.push({ x: sim.x, y: sim.y, z: sim.z, sit: sim.sit });
  }
  return { puesto, sim, rig, traza };
}

describe('actualizarPersona por pisos', () => {
  it('quien trabaja en el piso 2 se sienta a la altura de su piso', () => {
    const { puesto, sim, rig } = simular('finanzas', 'trabajando', 10);
    expect(sim.y).toBe(3.9);
    expect(sim.sit).toBeGreaterThan(0.95);
    expect(rig.raiz.position.x).toBeCloseTo(puesto.asiento.x, 3);
    expect(rig.raiz.position.y).toBeCloseTo(3.9 - 0.17, 2);
  });

  it('quien está libre baja por la escalera hasta la barra de café, toma su pausa y vuelve a su lugar', () => {
    const { puesto, traza } = simular('finanzas', 'libre', 400);
    const cafe = puesto.cafe;
    const enBarra = traza.filter((p) => Math.hypot(p.x - cafe.x, p.z - cafe.z) < 0.05);
    expect(enBarra.length).toBeGreaterThan(30);
    expect(enBarra.every((p) => Math.abs(p.y) < 1e-6)).toBe(true);
    expect(Math.min(...traza.map((p) => p.y))).toBeGreaterThanOrEqual(0);
    expect(Math.max(...traza.map((p) => p.y))).toBeLessThanOrEqual(3.9 + 1e-6);
    // la altura cambia de forma continua: nunca salta de un piso a otro (a 30 Hz y paso de juego,
    // subir la escalera mueve unos 10 cm por cuadro; un piso son 3,9 m)
    for (let i = 1; i < traza.length; i++) {
      expect(Math.abs((traza[i]?.y ?? 0) - (traza[i - 1]?.y ?? 0))).toBeLessThan(0.15);
    }
    // después de la pausa vuelve a su silla, en el piso 2
    const alCafe = traza.indexOf(enBarra[0] as (typeof traza)[number]);
    const sentadoDeNuevo = traza
      .slice(alCafe)
      .find(
        (p) =>
          p.sit > 0.95 &&
          Math.hypot(p.x - puesto.asiento.x, p.z - puesto.asiento.z) < 0.05 &&
          Math.abs(p.y - 3.9) < 1e-6,
      );
    expect(sentadoDeNuevo).toBeDefined();
  });

  it('desde la torre baja por el caracol y las dos escaleras escultóricas', () => {
    const { traza } = simular('investigacion', 'libre', 600);
    expect(traza.some((p) => Math.abs(p.y - 7.8) < 0.05)).toBe(true);
    expect(traza.some((p) => Math.abs(p.y - 3.9) < 0.05 && p.z < -3)).toBe(true);
    expect(traza.some((p) => Math.abs(p.y) < 0.05 && p.x > 13)).toBe(true);
  });

  it('con prefers-reduced-motion nadie pasea ni usa las escaleras', () => {
    const { traza } = simular('contenido', 'libre', 120, false);
    expect(traza.every((p) => p.y === 7.8)).toBe(true);
    expect(new Set(traza.map((p) => `${p.x}|${p.z}`)).size).toBe(1);
  });

  it('quien trabaja de pie en el gimnasio no se sienta', () => {
    const { puesto, sim } = simular('personal', 'trabajando', 10);
    expect(puesto.sentado).toBe(false);
    expect(sim.sit).toBe(0);
  });

  it('la visita llega a la salida del colega por el pasillo y vuelve a sentarse', () => {
    const agentes: AgenteOficina[] = ['visitante', 'colega'].map((id) => ({
      id,
      nombre: id,
      rol: 'Backend',
      departamento: 'desarrollo',
      estado: id === 'colega' ? 'trabajando' : 'libre',
    }));
    const [yo, otro] = asignarPuestos(agentes, departamentosBase);
    const [agenteYo, agenteOtro] = agentes;
    if (!yo || !otro || !agenteYo || !agenteOtro) throw new Error('sin puestos');
    const azar = azarSemilla(3);
    const sim = crearSim(agenteYo, yo, 0, azar);
    const simOtro = crearSim(agenteOtro, otro, 0, azar);
    const rig = rigDeMentira();
    const visita: Interaccion = {
      tipo: 'visita',
      socio: 1,
      fase: 'ir',
      inicio: 0,
      fin: 0,
      primerTurno: false,
      x: 0,
      z: 0,
      descansaHasta: 0,
    };
    const relacion: Relacion = {
      interaccion: visita,
      socio: simOtro,
      puestoSocio: otro,
      atencion: null,
      foco: null,
    };
    const contexto: ContextoFrame = {
      t: 0,
      dt: 1 / 30,
      movimiento: 1,
      paseos: true,
      azar,
      asistente: new Vector3(0, 3.2, 0),
      camara: new Vector3(30, 27, 30),
    };
    const meta = puestoDeVisita(otro.lugar);
    let llego = false;
    for (let i = 0; i < 30 * 60 && !llego; i++) {
      contexto.t = i / 30;
      actualizarPersona(sim, rig, agenteYo, yo, false, false, contexto, relacion);
      llego =
        sim.nav.hacia < 0 &&
        sim.nav.nodo === NODO_VISITA &&
        Math.hypot(sim.x - meta.x, sim.z - meta.z) < 0.05;
    }
    expect(llego).toBe(true);
    expect(sim.tramoVisita).toBe(true);
    // la visita termina: vuelve por el mismo camino, se sienta y los nodos vuelven al pasillo
    visita.fase = 'volver';
    let t = 60;
    while (sim.sit < 0.95 && t < 120) {
      t += 1 / 30;
      contexto.t = t;
      actualizarPersona(sim, rig, agenteYo, yo, false, false, contexto, relacion);
    }
    expect(sim.sit).toBeGreaterThan(0.95);
    // sentada de nuevo, el coordinador libera la interacción y los nodos vuelven al pasillo
    relacion.interaccion = null;
    contexto.t = t + 1 / 30;
    actualizarPersona(sim, rig, agenteYo, yo, false, false, contexto, relacion);
    expect(sim.tramoVisita).toBe(false);
    expect(sim.cadena[NODO_VISITA]).toEqual(sim.cadena[NODO_PASILLO]);
  });
});

describe('actualizarPersona atento al enfoque', () => {
  const agente: AgenteOficina = {
    id: 'p',
    nombre: 'P',
    rol: 'Backend',
    departamento: 'desarrollo',
    estado: 'libre',
  };
  const contexto = (azar: () => number, paseos = true): ContextoFrame => ({
    t: 0,
    dt: 1 / 30,
    movimiento: paseos ? 1 : 0.35,
    paseos,
    azar,
    asistente: new Vector3(0, 3.2, 0),
    camara: new Vector3(30, 27, 30),
  });

  function atender(rol: AtencionPersona['rol'], segundos: number, paseos = true) {
    const [puesto] = asignarPuestos([agente], departamentosBase);
    if (!puesto) throw new Error('sin puesto');
    const azar = azarSemilla(3);
    const sim = crearSim(agente, puesto, 0, azar);
    // Libre y a punto de salir a pasear: sin atención se levantaría.
    sim.maquina.faltaPaseo = 0.1;
    const rig = rigDeMentira();
    const c = contexto(azar, paseos);
    // Cámara a 30° de la silla: gira el torso sin pararse.
    c.camara.set(
      puesto.asiento.x + Math.sin(puesto.yawSentado + 0.5) * 20,
      10,
      puesto.asiento.z + Math.cos(puesto.yawSentado + 0.5) * 20,
    );
    const atencion: AtencionPersona = { rol, objetivo: -1, gesto: 'ninguno', gestoDesde: 0 };
    const relacion: Relacion = { ...RELACION, atencion };
    const inicio = { x: sim.x, z: sim.z };
    for (let i = 0; i < segundos * 30; i++) {
      c.t = i / 30;
      actualizarPersona(sim, rig, agente, puesto, false, false, c, relacion);
    }
    return { sim, puesto, inicio, rig, c };
  }

  it('el enfocado cancela el paseo, sigue sentado y gira la silla hacia la cámara en 2 s', () => {
    const { sim, puesto, inicio } = atender('enfocado', 2);
    expect(sim.maquina.paseo).toBeNull();
    expect(sim.sit).toBeGreaterThan(0.95);
    expect(Math.hypot(sim.x - inicio.x, sim.z - inicio.z)).toBeLessThan(0.01);
    // Se acercó al ángulo hacia la cámara (dentro del límite de la silla).
    expect(Math.abs(sim.yaw - puesto.yawSentado)).toBeGreaterThan(0.1);
  });

  it('si la cámara le queda a más de 45° de la silla, se para y da un paso al costado', () => {
    const [puesto] = asignarPuestos([agente], departamentosBase);
    if (!puesto) throw new Error('sin puesto');
    const azar = azarSemilla(3);
    const sim = crearSim(agente, puesto, 0, azar);
    const rig = rigDeMentira();
    const c = contexto(azar);
    // Cámara justo detrás de la silla.
    c.camara.set(
      puesto.asiento.x - Math.sin(puesto.yawSentado) * 20,
      10,
      puesto.asiento.z - Math.cos(puesto.yawSentado) * 20,
    );
    const atencion: AtencionPersona = {
      rol: 'enfocado',
      objetivo: -1,
      gesto: 'ninguno',
      gestoDesde: 0,
    };
    for (let i = 0; i < 30 * 8; i++) {
      c.t = i / 30;
      actualizarPersona(sim, rig, agente, puesto, false, false, c, { ...RELACION, atencion });
    }
    expect(sim.modoAtento).toBe('costado');
    expect(sim.sit).toBeLessThan(0.05);
    expect(sim.atentoListo).toBe(true);
    expect(Math.hypot(sim.x - sim.costado.x, sim.z - sim.costado.z)).toBeLessThan(0.05);
    // Al soltar el enfoque vuelve a su silla y se sienta.
    for (let i = 0; i < 30 * 12; i++) {
      c.t = 8 + i / 30;
      actualizarPersona(sim, rig, agente, puesto, false, false, c, RELACION);
    }
    expect(sim.sit).toBeGreaterThan(0.95);
    expect(Math.hypot(sim.x - puesto.asiento.x, sim.z - puesto.asiento.z)).toBeLessThan(0.05);
  });

  it('si la cámara le queda a menos de 45°, sigue sentado', () => {
    const [puesto] = asignarPuestos([agente], departamentosBase);
    if (!puesto) throw new Error('sin puesto');
    const azar = azarSemilla(3);
    const sim = crearSim(agente, puesto, 0, azar);
    const c = contexto(azar);
    c.camara.set(
      puesto.asiento.x + Math.sin(puesto.yawSentado) * 20,
      10,
      puesto.asiento.z + Math.cos(puesto.yawSentado) * 20,
    );
    const atencion: AtencionPersona = {
      rol: 'enfocado',
      objetivo: -1,
      gesto: 'ninguno',
      gestoDesde: 0,
    };
    for (let i = 0; i < 60; i++) {
      c.t = i / 30;
      actualizarPersona(sim, rigDeMentira(), agente, puesto, false, false, c, {
        ...RELACION,
        atencion,
      });
    }
    expect(sim.modoAtento).toBe('aqui');
    expect(sim.sit).toBeGreaterThan(0.95);
  });

  it('sin atención el mismo agente sí sale a pasear', () => {
    const { sim } = atender('ninguno', 2);
    expect(sim.maquina.paseo).not.toBeNull();
  });

  it('con reduced-motion no gesticula pero igual gira hacia la cámara', () => {
    const correr = (gesto: AtencionPersona['gesto']) => {
      const [puesto] = asignarPuestos([agente], departamentosBase);
      if (!puesto) throw new Error('sin puesto');
      const azar = azarSemilla(3);
      const sim = crearSim(agente, puesto, 0, azar);
      const rig = rigDeMentira();
      const c = contexto(azar, false);
      const atencion: AtencionPersona = { rol: 'enfocado', objetivo: -1, gesto, gestoDesde: 0 };
      for (let i = 0; i < 60; i++) {
        c.t = i / 30;
        actualizarPersona(sim, rig, agente, puesto, false, false, c, { ...RELACION, atencion });
      }
      return { sim, rig, puesto };
    };
    const { sim, rig, puesto } = correr('saludo');
    expect(rig.brazos[1].codo.rotation.x).toBeCloseTo(
      correr('ninguno').rig.brazos[1].codo.rotation.x,
    );
    expect(Math.abs(sim.yaw - puesto.yawSentado)).toBeGreaterThan(0.1);
  });
});

describe('retenerEnSala', () => {
  const agente: AgenteOficina = {
    id: 'p',
    nombre: 'P',
    rol: 'Backend',
    departamento: 'desarrollo',
    estado: 'libre',
  };

  it('quien está en el café vuelve a su lugar y no sale de nuevo', () => {
    const [puesto] = asignarPuestos([agente], departamentosBase);
    if (!puesto) throw new Error('sin puesto');
    const azar = azarSemilla(5);
    const sim = crearSim(agente, puesto, 0, azar);
    sim.maquina.faltaPaseo = 0.1;
    const rig = rigDeMentira();
    const c: ContextoFrame = {
      t: 0,
      dt: 1 / 30,
      movimiento: 1,
      paseos: true,
      azar,
      asistente: new Vector3(0, 3.2, 0),
      camara: new Vector3(30, 27, 30),
    };
    // Sale a pasear y, ya lejos del asiento, lo retienen en su sala.
    let fuera = false;
    for (let i = 0; i < 30 * 60 && !fuera; i++) {
      c.t = i / 30;
      actualizarPersona(sim, rig, agente, puesto, false, false, c, RELACION);
      fuera = Math.hypot(sim.x - puesto.asiento.x, sim.z - puesto.asiento.z) > 3;
    }
    expect(fuera).toBe(true);
    c.retenerEnSala = true;
    for (let i = 0; i < 30 * 60; i++) {
      c.t = 60 + i / 30;
      actualizarPersona(sim, rig, agente, puesto, false, false, c, RELACION);
    }
    expect(sim.maquina.paseo).toBeNull();
    expect(sim.sit).toBeGreaterThan(0.95);
    expect(Math.hypot(sim.x - puesto.asiento.x, sim.z - puesto.asiento.z)).toBeLessThan(0.05);
  });
});

// ---------------------------------------------------------------------------------------------
// Movimiento: las técnicas de `OPCIONES` (ver `animacion/opciones.ts`).
// ---------------------------------------------------------------------------------------------

/**
 * Resume lo que el animador deja en el rig durante un escenario: una suma ponderada de las
 * transformaciones de cada cuadro (cambia si cualquier ángulo cambia en cualquier cuadro).
 */
function huella(
  agente: AgenteOficina,
  relacion: (sim: Sim, otro: Sim) => Relacion,
  segundos: number,
  preparar?: (sim: Sim) => void,
): number {
  const [puesto, puestoOtro] = asignarPuestos(
    [agente, { ...agente, id: 'otro' }],
    departamentosBase,
  );
  if (!puesto || !puestoOtro) throw new Error('sin puesto');
  const azar = azarSemilla(11);
  const sim = crearSim(agente, puesto, 0, azar);
  const otro = crearSim({ ...agente, id: 'otro' }, puestoOtro, 0, azar);
  preparar?.(sim);
  const rig = rigDeMentira();
  const c: ContextoFrame = {
    t: 0,
    dt: 1 / 30,
    movimiento: 1,
    paseos: true,
    azar,
    asistente: new Vector3(0, 3.2, 0),
    camara: new Vector3(30, 27, 30),
  };
  const rel = relacion(sim, otro);
  let suma = 0;
  for (let i = 0; i < segundos * 30; i++) {
    c.t = i / 30;
    actualizarPersona(sim, rig, agente, puesto, false, false, c, rel);
    const w = 1 + (i % 7);
    suma +=
      w *
      (rig.raiz.position.x +
        2 * rig.raiz.position.z +
        3 * rig.raiz.rotation.y +
        4 * rig.pelvis.position.y +
        5 * rig.columna.rotation.x +
        6 * rig.cabeza.rotation.x +
        7 * rig.cabeza.rotation.y +
        8 * rig.torso.scale.y +
        9 * rig.piernas[0].cadera.rotation.x +
        10 * rig.piernas[0].rodilla.rotation.x +
        11 * rig.piernas[1].cadera.rotation.x +
        12 * rig.piernas[1].rodilla.rotation.x +
        13 * rig.brazos[0].hombro.rotation.x +
        14 * rig.brazos[1].hombro.rotation.x +
        15 * rig.brazos[1].hombro.rotation.z +
        16 * rig.brazos[1].codo.rotation.x);
  }
  return suma;
}

const AGENTE_BASE: AgenteOficina = {
  id: 'p',
  nombre: 'P',
  rol: 'Backend',
  departamento: 'desarrollo',
  estado: 'libre',
};
const SIN_RELACION = () => RELACION;
const paseoRapido = (sim: Sim) => {
  sim.maquina.faltaPaseo = 0.1;
};

/** Huellas de la versión anterior al motor de movimiento (capturadas antes de integrarlo). */
const HUELLAS_LINEA_BASE = [
  66008.50603381783, -125990.62867208349, 61590.50186273869, -66242.72812270324,
  -61178.957802459016,
];

const ESCENARIOS: readonly (() => number)[] = [
  () => huella(AGENTE_BASE, SIN_RELACION, 60, paseoRapido),
  () => huella({ ...AGENTE_BASE, estado: 'trabajando' }, SIN_RELACION, 20),
  () => huella({ ...AGENTE_BASE, estado: 'esperando_decision' }, SIN_RELACION, 20),
  () =>
    huella(
      AGENTE_BASE,
      (_s, otro) => ({
        ...RELACION,
        interaccion: {
          tipo: 'conversa',
          socio: 1,
          fase: 'ir',
          inicio: 0,
          fin: 0,
          primerTurno: true,
          x: 0,
          z: 0,
          descansaHasta: 0,
        },
        socio: otro,
      }),
      20,
      paseoRapido,
    ),
  () =>
    huella(
      AGENTE_BASE,
      () => ({
        ...RELACION,
        atencion: { rol: 'enfocado', objetivo: -1, gesto: 'saludo', gestoDesde: 1 },
      }),
      20,
    ),
];

describe('con todas las técnicas apagadas', () => {
  beforeEach(apagarTodo);
  afterEach(encenderTodo);

  it.each(HUELLAS_LINEA_BASE.map((h, i) => [i, h] as const))(
    'el escenario %i coincide con la versión anterior',
    (i, esperada) => {
      expect(ESCENARIOS[i]?.()).toBeCloseTo(esperada, 7);
    },
  );
});

/** Un escenario con el rig a mano: devuelve lo necesario para mirar cuadro a cuadro. */
function escenario(
  agente: AgenteOficina,
  opciones: { accesorios?: number; semilla?: number } = {},
) {
  const [puesto] = asignarPuestos([agente], departamentosBase);
  if (!puesto) throw new Error('sin puesto');
  const azar = azarSemilla(opciones.semilla ?? 11);
  const sim = crearSim(agente, puesto, 0, azar);
  const rig = rigDeMentira(opciones.accesorios ?? 0);
  const c: ContextoFrame = {
    t: 0,
    dt: 1 / 30,
    movimiento: 1,
    paseos: true,
    azar,
    asistente: new Vector3(0, 3.2, 0),
    camara: new Vector3(30, 27, 30),
  };
  let cuadro = 0;
  const paso = (relacion: Relacion = RELACION) => {
    c.t = cuadro++ / 30;
    actualizarPersona(sim, rig, agente, puesto, false, false, c, relacion);
  };
  return { sim, rig, c, puesto, paso };
}

const DT = 1 / 30;

describe('marcha por distancia: los pies no patinan', () => {
  it('la fase avanza lo que dice la longitud de zancada y el pie en el suelo no se desliza', () => {
    const { sim, rig, paso } = escenario(AGENTE_BASE);
    paseoRapido(sim);
    const { muslo, pantorrilla } = PARAMETROS_ZANCADA;
    let previo: {
      s: number;
      pie: [number, number];
      apoyo: [boolean, boolean];
      yaw: number;
      v: number;
    } | null = null;
    let cuadrosApoyo = 0;
    let peorPie = 0;
    let peorFase = 0;
    let caminados = 0;
    let caminoTotal = 0;
    for (let i = 0; i < 30 * 60; i++) {
      const cicloAntes = sim.ciclo;
      const x0 = sim.x;
      const z0 = sim.z;
      paso();
      const recorrido = Math.hypot(sim.x - x0, sim.z - z0);
      const v = recorrido / DT;
      if (v > 0.3) {
        // distancia = Δfase · longitud(velocidad)
        let dFase = sim.ciclo - cicloAntes;
        if (dFase < 0) dFase += 1;
        peorFase = Math.max(peorFase, Math.abs(dFase * largoZancada(v) - recorrido));
        caminados++;
      }
      // Cinemática directa del pie respecto de la cadera (x hacia delante, y hacia abajo).
      const pie: [number, number] = [0, 0];
      const apoyo: [boolean, boolean] = [false, false];
      for (let lado = 0; lado < 2; lado++) {
        const a = -rig.piernas[lado as 0 | 1].cadera.rotation.x;
        const b = a - rig.piernas[lado as 0 | 1].rodilla.rotation.x;
        const adelante = muslo * Math.sin(a) + pantorrilla * Math.sin(b);
        const abajo = muslo * Math.cos(a) + pantorrilla * Math.cos(b);
        // El giro de la pelvis adelanta una cadera y atrasa la otra; el ladeo sube o baja cada una.
        const signo = lado === 0 ? 1 : -1;
        pie[lado] = adelante + signo * 0.135 * Math.sin(rig.pelvis.rotation.y);
        const altoCadera = rig.pelvis.position.y - signo * 0.135 * Math.sin(rig.pelvis.rotation.z);
        // En apoyo según la fase propia de la pierna (sin los bordes del despegue y el aterrizaje)
        // y con el pie realmente en el suelo.
        const u = (sim.ciclo + 0.5 * lado) % 1;
        const fin = fraccionApoyo(v) - 0.04;
        apoyo[lado] = u > 0.04 && u < fin && altoCadera - abajo < 0.006;
      }
      // Distancia recorrida acumulada: la coordenada del suelo a lo largo de la marcha.
      caminoTotal += recorrido;
      const s = caminoTotal;
      // En régimen (sin girar ni acelerar): al acelerar a 22 m/s² la zancada cambia de largo en ~0,1 s
      // y el pie apoyado se corre unos centímetros, como en cualquier ciclo procedural.
      const estable = previo !== null && Math.abs(v - previo.v) / DT < 1;
      if (
        previo &&
        estable &&
        v > 0.9 &&
        Math.abs(envolverDiferencia(sim.yaw, previo.yaw)) / DT < 0.2
      ) {
        for (let lado = 0; lado < 2; lado++) {
          if (apoyo[lado as 0 | 1] && previo.apoyo[lado as 0 | 1]) {
            const velocidadPie =
              (s + pie[lado as 0 | 1] - (previo.s + previo.pie[lado as 0 | 1])) / DT;
            peorPie = Math.max(peorPie, Math.abs(velocidadPie));
            cuadrosApoyo++;
          }
        }
      }
      previo = { s, pie, apoyo, yaw: sim.yaw, v };
    }
    expect(caminados).toBeGreaterThan(300);
    expect(peorFase).toBeLessThan(1e-3);
    expect(cuadrosApoyo).toBeGreaterThan(100);
    // El pie apoyado respecto del suelo: error de pocos cm/s frente a ~2,6 m/s del cuerpo.
    expect(peorPie).toBeLessThan(0.25);
  });
});

function envolverDiferencia(a: number, b: number): number {
  return ((((a - b + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
}

describe('locomoción con peso', () => {
  it('la velocidad nunca pasa del límite de aceleración y el yaw nunca gira más que giroMax', () => {
    const { sim, paso } = escenario(AGENTE_BASE);
    paseoRapido(sim);
    const { aceleracion, frenado, giroMax } = PARAMETROS_LOCOMOCION;
    let velAntes = 0;
    let yawAntes = sim.yaw;
    let maxAcel = 0;
    let maxFrenada = 0;
    let maxGiro = 0;
    let camino = 0;
    for (let i = 0; i < 30 * 120; i++) {
      const x0 = sim.x;
      const z0 = sim.z;
      paso();
      const v = Math.hypot(sim.x - x0, sim.z - z0) / DT;
      const a = (v - velAntes) / DT;
      maxAcel = Math.max(maxAcel, a);
      maxFrenada = Math.max(maxFrenada, -a);
      maxGiro = Math.max(maxGiro, Math.abs(envolverDiferencia(sim.yaw, yawAntes)) / DT);
      expect(sim.loco.aceleracionLong).toBeLessThanOrEqual(aceleracion + 1e-9);
      expect(sim.loco.aceleracionLong).toBeGreaterThanOrEqual(-frenado - 1e-9);
      velAntes = v;
      yawAntes = sim.yaw;
      camino += v * DT;
    }
    expect(camino).toBeGreaterThan(20);
    // Velocidad media del cuadro: el trapecio puede promediar dos cuadros, nunca excederlos.
    expect(maxAcel).toBeLessThanOrEqual(aceleracion + 1e-6);
    expect(maxFrenada).toBeLessThanOrEqual(frenado + 1e-6);
    expect(maxGiro).toBeLessThanOrEqual(giroMax + 1e-6);
  });

  it('arranca con una anticipación: se inclina hacia atrás antes de moverse y luego hacia delante', () => {
    const { sim, rig, paso } = escenario(AGENTE_BASE);
    paseoRapido(sim);
    let minInclinacion = 0;
    let maxInclinacion = 0;
    for (let i = 0; i < 30 * 40; i++) {
      paso();
      minInclinacion = Math.min(minInclinacion, sim.loco.inclinacion.x);
      maxInclinacion = Math.max(maxInclinacion, sim.loco.inclinacion.x);
    }
    expect(minInclinacion).toBeLessThan(-0.02);
    expect(maxInclinacion).toBeGreaterThan(0.04);
    expect(Math.abs(rig.columna.rotation.x)).toBeLessThan(0.6);
  });
});

describe('vida en reposo', () => {
  it('dos agentes con ids distintos jamás respiran en fase', () => {
    const ids = ['ana', 'beto', 'carla', 'dario', 'eva', 'fito', 'gina', 'hugo'];
    const frames = 30 * 120;
    const series = ids.map((id) => {
      const e = escenario({ ...AGENTE_BASE, id, estado: 'trabajando' }, { semilla: 5 });
      const v = new Float64Array(frames);
      for (let i = 0; i < frames; i++) {
        e.paso();
        v[i] = e.rig.torso.scale.y;
      }
      return v;
    });
    const correlacion = (a: Float64Array, b: Float64Array) => {
      let ma = 0;
      let mb = 0;
      for (let i = 0; i < frames; i++) {
        ma += a[i] as number;
        mb += b[i] as number;
      }
      ma /= frames;
      mb /= frames;
      let ab = 0;
      let aa = 0;
      let bb = 0;
      for (let i = 0; i < frames; i++) {
        const x = (a[i] as number) - ma;
        const y = (b[i] as number) - mb;
        ab += x * y;
        aa += x * x;
        bb += y * y;
      }
      return ab / Math.sqrt(aa * bb);
    };
    let peor = 0;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        peor = Math.max(peor, correlacion(series[i] as Float64Array, series[j] as Float64Array));
        // En el primer cuadro ya difieren: no arrancan alineados.
        expect(
          Math.abs((series[i] as Float64Array)[0]! - (series[j] as Float64Array)[0]!),
        ).toBeGreaterThan(1e-6);
      }
    }
    expect(peor).toBeLessThan(0.9);
  });

  it('el mismo id respira igual: es determinista', () => {
    const a = escenario({ ...AGENTE_BASE, id: 'ana', estado: 'trabajando' });
    const b = escenario({ ...AGENTE_BASE, id: 'ana', estado: 'trabajando' });
    for (let i = 0; i < 300; i++) {
      a.paso();
      b.paso();
      expect(a.rig.torso.scale.y).toBe(b.rig.torso.scale.y);
    }
  });

  it('quieto y libre hace gestos de vida y, al empezar a trabajar, el gesto se desvanece sin corte', () => {
    const agente: AgenteOficina = { ...AGENTE_BASE, id: 'gestos' };
    const e = escenario(agente);
    // Fuerza un gesto en curso para no esperar al azar.
    e.sim.vida.esperaGesto = 0;
    e.sim.pesoVida.valor = 1;
    let hubo = false;
    for (let i = 0; i < 30 * 8; i++) {
      e.paso();
      if (e.sim.vida.gestoActual >= 0) hubo = true;
    }
    expect(hubo).toBe(true);
    // Corte brusco de la vida (quien trabaja deja de estar quieto): el brazo no salta de un cuadro a otro.
    agente.estado = 'trabajando';
    e.sim.vida.gestoActual = 2;
    e.sim.vida.gestoT = 0.5;
    e.sim.vida.gestoDur = 3;
    e.sim.pesoGestoVida.valor = 1;
    e.sim.gestoVida = 2;
    e.sim.gestoVidaProgreso = 0.5;
    let maxSalto = 0;
    let previo = e.rig.brazos[1].hombro.rotation.x;
    for (let i = 0; i < 30; i++) {
      e.paso();
      maxSalto = Math.max(maxSalto, Math.abs(e.rig.brazos[1].hombro.rotation.x - previo));
      previo = e.rig.brazos[1].hombro.rotation.x;
    }
    expect(maxSalto).toBeLessThan(0.5);
  });
});

describe('transiciones', () => {
  it('al levantarse y sentarse se mueven el torso y los brazos, no solo las piernas', () => {
    const e = escenario(AGENTE_BASE);
    paseoRapido(e.sim);
    let columnaEnTransicion = 0;
    let brazosEnTransicion = 0;
    let transiciones = 0;
    for (let i = 0; i < 30 * 400; i++) {
      e.paso();
      if (e.sim.sit > 0.1 && e.sim.sit < 0.9) {
        transiciones++;
        columnaEnTransicion = Math.max(columnaEnTransicion, Math.abs(e.rig.columna.rotation.x));
        brazosEnTransicion = Math.max(
          brazosEnTransicion,
          Math.abs(e.rig.brazos[0].hombro.rotation.x),
        );
      }
    }
    expect(transiciones).toBeGreaterThan(10);
    expect(columnaEnTransicion).toBeGreaterThan(0.1);
    expect(brazosEnTransicion).toBeGreaterThan(0.05);
  });

  it('sentado de nuevo, la altura asienta en 1 sin pasarse', () => {
    const e = escenario(AGENTE_BASE);
    paseoRapido(e.sim);
    let max = 0;
    // Hasta que vuelve a sentarse tras su pausa (con paso de juego el recorrido dura menos y el reloj
    // de la máquina cae en otro momento del paseo: se espera a que vuelva en vez de cortar a 400 s).
    let sentadoDeNuevo = false;
    let levantado = false;
    for (let i = 0; i < 30 * 600 && !sentadoDeNuevo; i++) {
      e.paso();
      max = Math.max(max, e.sim.sit);
      if (e.sim.sit < 0.5) levantado = true;
      if (levantado && i > 30 * 400 && e.sim.sit > 0.995) sentadoDeNuevo = true;
    }
    expect(max).toBeLessThanOrEqual(1);
    expect(e.sim.sit).toBeGreaterThan(0.99);
  });

  it('quien espera una decisión levanta el brazo del saludo y lo mantiene', () => {
    const e = escenario({ ...AGENTE_BASE, estado: 'esperando_decision' });
    for (let i = 0; i < 30 * 4; i++) e.paso();
    expect(e.rig.brazos[1].hombro.rotation.z).toBeGreaterThan(2.2);
  });
});

describe('mirada por interés', () => {
  const miradaHacia = (conCandidato: boolean) => {
    const e = escenario({ ...AGENTE_BASE, estado: 'trabajando' });
    const candidatos = crearCandidatos(2);
    const ang = e.puesto.yawSentado + 0.7;
    candidatos.x[0] = e.sim.x + Math.sin(ang) * 3;
    candidatos.z[0] = e.sim.z + Math.cos(ang) * 3;
    candidatos.habla[0] = 1;
    candidatos.id[0] = 12345;
    const relacion: Relacion = {
      ...RELACION,
      candidatos: conCandidato ? { c: candidatos, n: 1 } : null,
    };
    for (let i = 0; i < 30 * 6; i++) e.paso(relacion);
    return e.rig.cabeza.rotation.y;
  };

  it('quien habla cerca le gira la cabeza; sin candidatos no cambia nada', () => {
    expect(Math.abs(miradaHacia(true) - miradaHacia(false))).toBeGreaterThan(0.03);
  });
});

describe('cuadros saltados (LOD)', () => {
  it('un c.dt acumulado se limita a 0,25 s y deja el contexto como estaba', () => {
    const avance = (dt: number) => {
      const e = escenario(AGENTE_BASE);
      paseoRapido(e.sim);
      // Hasta que esté caminando por el pasillo.
      for (let i = 0; i < 30 * 12 && e.sim.vel < 1; i++) e.paso();
      const x0 = e.sim.x;
      const z0 = e.sim.z;
      e.c.dt = dt;
      actualizarPersona(e.sim, e.rig, AGENTE_BASE, e.puesto, false, false, e.c, RELACION);
      expect(e.c.dt).toBe(dt);
      return Math.hypot(e.sim.x - x0, e.sim.z - z0);
    };
    expect(avance(2)).toBeLessThan(0.25 * VELOCIDAD_PASEO + 0.02);
    expect(avance(2)).toBeGreaterThan(0.1);
  });

  it('con el presupuesto apagado un c.dt grande avanza sin límite (comportamiento anterior)', () => {
    fijarOpciones({ presupuestoLod: false });
    try {
      const e = escenario(AGENTE_BASE);
      paseoRapido(e.sim);
      for (let i = 0; i < 30 * 12 && e.sim.vel < 1; i++) e.paso();
      const x0 = e.sim.x;
      const z0 = e.sim.z;
      e.c.dt = 0.25;
      actualizarPersona(e.sim, e.rig, AGENTE_BASE, e.puesto, false, false, e.c, RELACION);
      expect(Math.hypot(e.sim.x - x0, e.sim.z - z0)).toBeGreaterThan(0.2);
    } finally {
      encenderTodo();
    }
  });
});

describe('cada interruptor cambia algo', () => {
  const claves: (keyof OpcionesMovimiento)[] = [
    'suavizadoExp',
    'marchaPorDistancia',
    'resorteCritico',
    'resorteRebase',
    'aplastarEstirar',
    'vida',
    'transiciones',
  ];
  it.each(claves)('apagar %s cambia la salida del rig', (clave) => {
    encenderTodo();
    const todo = ESCENARIOS[0]?.() ?? 0;
    fijarOpciones({ [clave]: false });
    try {
      expect(Math.abs((ESCENARIOS[0]?.() ?? 0) - todo)).toBeGreaterThan(1e-3);
    } finally {
      encenderTodo();
    }
  });

  it('encender solo una técnica ya no da la línea base', () => {
    apagarTodo();
    fijarOpciones({ vida: true });
    try {
      expect(Math.abs((ESCENARIOS[1]?.() ?? 0) - (HUELLAS_LINEA_BASE[1] ?? 0))).toBeGreaterThan(
        1e-3,
      );
    } finally {
      encenderTodo();
    }
  });
});

describe('memoria y costo', () => {
  it('20 000 cuadros con todo encendido no hacen crecer el heap más de 2 MB', () => {
    setFlagsFromString('--expose-gc');
    const gc = runInNewContext('gc') as () => void;
    const e = escenario(AGENTE_BASE, { accesorios: 3 });
    paseoRapido(e.sim);
    const candidatos = crearCandidatos(4);
    for (let i = 0; i < 4; i++) {
      candidatos.x[i] = e.sim.x + i;
      candidatos.z[i] = e.sim.z + 2;
      candidatos.habla[i] = i % 2;
      candidatos.id[i] = 100 + i;
    }
    const relacion: Relacion = { ...RELACION, candidatos: { c: candidatos, n: 4 } };
    // Calienta (crea los resortes de accesorios, compila las rutas calientes).
    for (let i = 0; i < 2000; i++) e.paso(relacion);
    gc();
    const antes = process.memoryUsage().heapUsed;
    for (let i = 0; i < 20000; i++) e.paso(relacion);
    gc();
    const crecimiento = process.memoryUsage().heapUsed - antes;
    expect(crecimiento).toBeLessThan(2 * 1024 * 1024);
  });

  it('mide el costo por cuadro con 100 agentes (todo encendido y todo apagado)', () => {
    const agentes: AgenteOficina[] = Array.from({ length: 100 }, (_, i) => ({
      ...AGENTE_BASE,
      id: `agente-${i}`,
      estado: i % 3 === 0 ? 'trabajando' : 'libre',
    }));
    const puestos = asignarPuestos(agentes, departamentosBase);
    const azar = azarSemilla(1);
    const sims = agentes.map((a, i) =>
      crearSim(a, puestos[i] as (typeof puestos)[number], 0, azar),
    );
    sims.forEach((s, i) => {
      if (i % 2 === 0) s.maquina.faltaPaseo = 0.1;
    });
    const rigs = agentes.map(() => rigDeMentira(2));
    const c: ContextoFrame = {
      t: 0,
      dt: DT,
      movimiento: 1,
      paseos: true,
      azar,
      asistente: new Vector3(0, 3.2, 0),
      camara: new Vector3(30, 27, 30),
    };
    const medir = () => {
      const cuadros = 600;
      let mejor = Infinity;
      for (let ronda = 0; ronda < 3; ronda++) {
        const t0 = performance.now();
        for (let f = 0; f < cuadros; f++) {
          c.t = (ronda * cuadros + f) / 30;
          for (let i = 0; i < agentes.length; i++) {
            actualizarPersona(
              sims[i] as Sim,
              rigs[i] as Rig,
              agentes[i] as AgenteOficina,
              puestos[i] as (typeof puestos)[number],
              false,
              false,
              c,
              RELACION,
            );
          }
        }
        mejor = Math.min(mejor, (performance.now() - t0) / (cuadros * agentes.length));
      }
      return mejor * 1000;
    };
    encenderTodo();
    const conTodo = medir();
    apagarTodo();
    const sinNada = medir();
    encenderTodo();
    console.log(
      `COSTO por actualizarPersona (100 agentes): todo encendido ${conTodo.toFixed(2)} us, todo apagado ${sinNada.toFixed(2)} us`,
    );
    expect(conTodo).toBeLessThan(500);
  });
});

describe('órdenes externas de los agentes', () => {
  function animar(
    mirada?: { x: number; y: number; z: number },
    gesto?: 'saludo' | 'asentir' | 'explicar',
  ) {
    const agente: AgenteOficina = {
      id: 'a',
      nombre: 'A',
      rol: 'Backend',
      departamento: 'ingenieria',
      estado: 'libre',
    };
    const [puesto] = asignarPuestos([agente], departamentosBase);
    if (!puesto) throw new Error('sin puesto');
    const azar = azarSemilla(7);
    const sim = crearSim(agente, puesto, 0, azar);
    const rig = rigDeMentira();
    const objetivo = mirada && { x: sim.x + mirada.x, y: sim.y + mirada.y, z: sim.z + mirada.z };
    const relacion: Relacion = { ...RELACION, mirada: objetivo, gesto };
    for (let i = 0; i < 180; i++) {
      actualizarPersona(
        sim,
        rig,
        agente,
        puesto,
        false,
        false,
        {
          t: i / 30,
          dt: 1 / 30,
          movimiento: 1,
          paseos: false,
          azar,
          asistente: new Vector3(30, 3, 30),
          camara: new Vector3(30, 20, 30),
        },
        relacion,
      );
    }
    return { sim, rig, objetivo };
  }

  it('el cuerpo y la cabeza convergen hacia el punto solicitado', () => {
    const { sim, rig, objetivo } = animar({ x: 8, y: 1.7, z: 0 });
    const rumbo = Math.atan2(objetivo!.x - sim.x, objetivo!.z - sim.z);
    expect(Math.cos(rig.raiz.rotation.y + rig.cabeza.rotation.y - rumbo)).toBeGreaterThan(0.99);
  });

  it('sin orden conserva la animación previa y al cambiar el objetivo cambia el rumbo', () => {
    const previa = animar();
    const otra = animar();
    expect(previa.rig.cabeza.rotation.y).toBe(otra.rig.cabeza.rotation.y);
    const derecha = animar({ x: 8, y: 1.7, z: 0 });
    const izquierda = animar({ x: -8, y: 1.7, z: 0 });
    expect(Math.sin(derecha.sim.yaw)).toBeGreaterThan(0.9);
    expect(Math.sin(izquierda.sim.yaw)).toBeLessThan(-0.9);
  });

  it.each(['saludo', 'asentir', 'explicar'] as const)(
    'reutiliza la pose existente para %s',
    (gesto) => {
      const normal = animar();
      const externa = animar(undefined, gesto);
      const angulos = (rig: Rig) => [
        rig.cabeza.rotation.x,
        rig.brazos[0].hombro.rotation.x,
        rig.brazos[1].hombro.rotation.x,
        rig.brazos[0].hombro.rotation.z,
        rig.brazos[1].hombro.rotation.z,
      ];
      expect(angulos(externa.rig)).not.toEqual(angulos(normal.rig));
    },
  );
});
