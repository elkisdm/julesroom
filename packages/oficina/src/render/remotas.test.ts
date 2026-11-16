import * as v8 from 'node:v8';
import * as vm from 'node:vm';
import { Group } from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BufferGeometry } from 'three';
import { crearLod, crearPresupuesto, PARAMETROS_LOD } from '../animacion/lod';
import { crearMedidor, estadisticas } from '../animacion/medicion';
import type { EstadisticasMedidor } from '../animacion/medicion';
import { apagarTodo, encenderTodo, fijarOpciones } from '../animacion/opciones';
import { largoZancada } from '../animacion/caminata';
import type { PersonaPresente } from '../presencia/tipos';
import { azarSemilla } from '../test-utils';
import type { Rig } from './animador';
import type { Estilo } from './flota';
import type { Parte } from './Pieza';
import { animarRemotas, cuerpoRemoto } from './remotas';
import type { ContextoRemotas } from './remotas';

vi.mock('./texturas', () => ({ celdasCara: () => [0, 1], celdaIcono: () => 0 }));

const parte = (): Parte => ({
  ancla: new Group(),
  geometria: {} as BufferGeometry,
  estilo: {} as Estilo,
  celda: 0,
  cartel: false,
});

function crearRig(): Rig {
  const g = () => new Group();
  return {
    raiz: g(),
    pelvis: g(),
    columna: g(),
    torso: g(),
    cabeza: g(),
    piernas: [
      { cadera: g(), rodilla: g() },
      { cadera: g(), rodilla: g() },
    ],
    brazos: [
      { hombro: g(), codo: g() },
      { hombro: g(), codo: g() },
    ],
    taza: parte(),
    hoja: parte(),
    telefono: parte(),
    cara: parte(),
    icono: parte(),
    anillo: g(),
    partes: [],
    caraFija: null,
    tazaEquipada: false,
    alturaIcono: 1.9,
  };
}

const DT = 1 / 60;
const ATUENDO = { face: 'feliz' } as unknown as PersonaPresente['atuendo'];

/** Verdad de cada persona: camina a 1,15 m/s con un rumbo que ondula (calculada cuadro a cuadro). */
function verdad(cantidad: number, cuadros: number) {
  const x = new Float64Array(cantidad * cuadros);
  const z = new Float64Array(cantidad * cuadros);
  const rumbo = new Float64Array(cantidad * cuadros);
  for (let i = 0; i < cantidad; i++) {
    let px = (i % 10) * 3 - 15;
    let pz = Math.floor(i / 10) * 3 - 15;
    const h0 = i * 0.7;
    for (let f = 0; f < cuadros; f++) {
      const t = f * DT;
      const h = h0 + 0.5 * Math.sin(0.35 * t + i);
      x[i * cuadros + f] = px;
      z[i * cuadros + f] = pz;
      rumbo[i * cuadros + f] = h;
      px += Math.sin(h) * 1.15 * DT;
      pz += Math.cos(h) * 1.15 * DT;
    }
  }
  return { x, z, rumbo };
}

interface Paquete {
  llegada: number;
  persona: number;
  frame: number;
}

/**
 * Fuente simulada: cada persona envía su verdad a 10 Hz; el 10 % se pierde y el retardo varía
 * entre 50 ms y 50 ms + `jitter` (puede llegar desordenado: se ignora lo más viejo que lo ya aplicado).
 */
function crearEscenario(cantidad: number, cuadros: number, semilla = 5, jitter = 0.06) {
  const azar = azarSemilla(semilla);
  const v = verdad(cantidad, cuadros);
  const presentes: PersonaPresente[] = [];
  const rigs = new Map<string, Rig>();
  for (let i = 0; i < cantidad; i++) {
    presentes.push({
      id: `p${i}`,
      nombre: `P${i}`,
      atuendo: ATUENDO,
      x: v.x[i * cuadros] as number,
      y: 0,
      z: v.z[i * cuadros] as number,
      rumbo: v.rumbo[i * cuadros] as number,
    });
    rigs.set(`p${i}`, crearRig());
  }
  const paquetes: Paquete[] = [];
  for (let i = 0; i < cantidad; i++) {
    for (let f = 6; f < cuadros; f += 6) {
      if (azar() < 0.1) continue;
      paquetes.push({ llegada: f * DT + 0.05 + jitter * azar(), persona: i, frame: f });
    }
  }
  paquetes.sort((a, b) => a.llegada - b.llegada);
  const aplicado = new Int32Array(cantidad).fill(-1);
  let siguiente = 0;
  /** Entrega los paquetes que llegaron hasta `t`. */
  const entregar = (t: number) => {
    while (siguiente < paquetes.length && (paquetes[siguiente] as Paquete).llegada <= t) {
      const q = paquetes[siguiente++] as Paquete;
      if (q.frame <= (aplicado[q.persona] as number)) continue;
      aplicado[q.persona] = q.frame;
      const p = presentes[q.persona] as PersonaPresente;
      p.x = v.x[q.persona * cuadros + q.frame] as number;
      p.z = v.z[q.persona * cuadros + q.frame] as number;
      p.rumbo = v.rumbo[q.persona * cuadros + q.frame] as number;
    }
  };
  return { presentes, rigs, entregar };
}

beforeEach(() => encenderTodo());
afterEach(() => encenderTodo());

interface Traza {
  x: Float64Array;
  z: Float64Array;
}

/** Corre `cuadros` cuadros a 60 Hz y guarda la posición dibujada de cada persona. */
function correr(
  esc: ReturnType<typeof crearEscenario>,
  cuadros: number,
  extra: (f: number) => Partial<ContextoRemotas> = () => ({}),
): Traza {
  const n = esc.presentes.length;
  const traza: Traza = { x: new Float64Array(n * cuadros), z: new Float64Array(n * cuadros) };
  const indice = new Map<Group, number>();
  esc.presentes.forEach((p, i) => indice.set((esc.rigs.get(p.id) as Rig).raiz, i));
  let f = 0;
  const dibujar = (rig: Rig, x: number, _y: number, z: number) => {
    const i = indice.get(rig.raiz) as number;
    traza.x[i * cuadros + f] = x;
    traza.z[i * cuadros + f] = z;
  };
  for (f = 0; f < cuadros; f++) {
    const t = f * DT;
    esc.entregar(t);
    animarRemotas({
      presentes: esc.presentes,
      rigs: esc.rigs,
      dt: DT,
      t,
      tAhora: t,
      dibujar,
      cuadro: f,
      ...extra(f),
    });
  }
  return traza;
}

describe('animarRemotas', () => {
  it('con 100 personas a 10 Hz, 10 % de pérdida y retardo variable no salta más de 5 cm por cuadro', () => {
    const CUADROS = 720;
    const esc = crearEscenario(100, CUADROS);
    const traza = correr(esc, CUADROS);
    let maximo = 0;
    for (let i = 0; i < 100; i++) {
      for (let f = 121; f < CUADROS; f++) {
        const a = i * CUADROS + f;
        maximo = Math.max(
          maximo,
          Math.hypot(traza.x[a]! - traza.x[a - 1]!, traza.z[a]! - traza.z[a - 1]!),
        );
      }
    }
    expect(maximo).toBeLessThan(0.05);
  });

  it('con un retardo que varía más que el intervalo de envío casi nunca pasa de 5 cm por cuadro', () => {
    const CUADROS = 720;
    const esc = crearEscenario(100, CUADROS, 5, 0.12);
    const traza = correr(esc, CUADROS);
    let maximo = 0;
    let sobre = 0;
    let total = 0;
    for (let i = 0; i < 100; i++) {
      for (let f = 121; f < CUADROS; f++) {
        const a = i * CUADROS + f;
        const d = Math.hypot(traza.x[a]! - traza.x[a - 1]!, traza.z[a]! - traza.z[a - 1]!);
        maximo = Math.max(maximo, d);
        if (d > 0.05) sobre++;
        total++;
      }
    }
    expect(sobre / total).toBeLessThan(0.01);
    expect(maximo).toBeLessThan(0.15);
  });

  it('sin snapshots dibuja la posición cruda (con escalones de red)', () => {
    fijarOpciones({ snapshots: false });
    const CUADROS = 300;
    const esc = crearEscenario(10, CUADROS);
    const traza = correr(esc, CUADROS);
    let maximo = 0;
    for (let f = 61; f < CUADROS; f++) {
      const a = f;
      maximo = Math.max(
        maximo,
        Math.hypot(traza.x[a]! - traza.x[a - 1]!, traza.z[a]! - traza.z[a - 1]!),
      );
    }
    expect(maximo).toBeGreaterThan(0.05);
  });

  it('los pies no patinan: la velocidad de fase por longitud de zancada sigue a la dibujada', () => {
    const CUADROS = 600;
    const esc = crearEscenario(20, CUADROS);
    const dist = new Float64Array(20);
    const porFase = new Float64Array(20);
    const faseAntes = new Float64Array(20);
    const xAntes = new Float64Array(20);
    const zAntes = new Float64Array(20);
    const indice = new Map<Group, number>();
    esc.presentes.forEach((p, i) => indice.set((esc.rigs.get(p.id) as Rig).raiz, i));
    let f = 0;
    const dibujar = (rig: Rig, x: number, _y: number, z: number) => {
      const i = indice.get(rig.raiz) as number;
      const c = cuerpoRemoto(esc.rigs, `p${i}`)!;
      if (f > 150) {
        dist[i] =
          (dist[i] as number) + Math.hypot(x - (xAntes[i] as number), z - (zAntes[i] as number));
        let dfase = c.loc.fase - (faseAntes[i] as number);
        if (dfase < 0) dfase += 1;
        porFase[i] = (porFase[i] as number) + dfase * largoZancada(c.loc.velocidad);
      }
      xAntes[i] = x;
      zAntes[i] = z;
      faseAntes[i] = c.loc.fase;
    };
    for (f = 0; f < CUADROS; f++) {
      esc.entregar(f * DT);
      animarRemotas({ presentes: esc.presentes, rigs: esc.rigs, dt: DT, t: f * DT, dibujar });
    }
    for (let i = 0; i < 20; i++) {
      expect(dist[i]).toBeGreaterThan(8);
      expect(Math.abs((porFase[i] as number) / (dist[i] as number) - 1)).toBeLessThan(0.1);
    }
  });

  it('fuera de pantalla no anima; al volver, la fase salta a la correcta por la distancia recorrida', () => {
    const CUADROS = 420;
    const faseFinal = (pausar: boolean) => {
      fijarOpciones({ pausaFueraDePantalla: pausar, presupuestoLod: false });
      const esc = crearEscenario(3, CUADROS, 2);
      const lod = crearLod(PARAMETROS_LOD, 8);
      let visible = true;
      let cadera = Number.NaN;
      let cambios = 0;
      const rig = esc.rigs.get('p0') as Rig;
      for (let f = 0; f < CUADROS; f++) {
        visible = f < 120 || f >= 300;
        esc.entregar(f * DT);
        animarRemotas({
          presentes: esc.presentes,
          rigs: esc.rigs,
          dt: DT,
          t: f * DT,
          tAhora: f * DT,
          dibujar: () => {},
          cuadro: f,
          lod,
          camara: { x: 0, y: 3, z: 0 },
          enVista: () => visible,
        });
        if (f >= 140 && f < 280) {
          if (rig.piernas[0].cadera.rotation.x !== cadera) cambios++;
          cadera = rig.piernas[0].cadera.rotation.x;
        }
      }
      return {
        fase: (cuerpoRemoto(esc.rigs, 'p0') as { loc: { fase: number } }).loc.fase,
        cambios,
      };
    };
    const conPausa = faseFinal(true);
    const sinPausa = faseFinal(false);
    // Pausada, casi no recalcula (≤ 1 de cada 8 cuadros); sin pausa lo hace en todos.
    expect(conPausa.cambios).toBeLessThan(40);
    expect(sinPausa.cambios).toBeGreaterThan(130);
    const diferencia = Math.abs(((conPausa.fase - sinPausa.fase + 1.5) % 1) - 0.5);
    expect(diferencia).toBeLessThan(0.2);
  });

  it('quien deja de estar presente libera su estado', () => {
    const esc = crearEscenario(4, 30);
    correr(esc, 10);
    expect(cuerpoRemoto(esc.rigs, 'p3')).toBeDefined();
    esc.presentes.pop();
    animarRemotas({
      presentes: esc.presentes,
      rigs: esc.rigs,
      dt: DT,
      t: 1,
      dibujar: () => {},
    });
    expect(cuerpoRemoto(esc.rigs, 'p3')).toBeUndefined();
    expect(cuerpoRemoto(esc.rigs, 'p2')).toBeDefined();
  });

  it('todo apagado equivale a la posición cruda y al cuerpo anterior', () => {
    apagarTodo();
    const esc = crearEscenario(2, 60);
    const traza = correr(esc, 60);
    // Posición cruda: el último valor dibujado es exactamente el de la fuente.
    expect(traza.x[59]).toBe((esc.presentes[0] as PersonaPresente).x);
  });

  it('no asigna memoria en el bucle por cuadro (100 personas)', () => {
    v8.setFlagsFromString('--expose-gc');
    const gc = vm.runInNewContext('gc') as () => void;
    const esc = crearEscenario(100, 3000);
    const lod = crearLod(PARAMETROS_LOD, 128, crearPresupuesto(1));
    const medidor = crearMedidor(600);
    let f = 0;
    const paso = () => {
      const t = f * DT;
      esc.entregar(t);
      animarRemotas({
        presentes: esc.presentes,
        rigs: esc.rigs,
        dt: DT,
        t,
        tAhora: t,
        dibujar: () => {},
        cuadro: f,
        lod,
        medidor,
        camara: { x: 0, y: 3, z: 0 },
        enVista: (x) => Math.abs(x) < 10,
      });
      f++;
    };
    for (let i = 0; i < 600; i++) paso();
    gc();
    const antes = process.memoryUsage().heapUsed;
    for (let i = 0; i < 1500; i++) paso();
    gc();
    expect(process.memoryUsage().heapUsed - antes).toBeLessThan(2 * 1024 * 1024);
  });

  it('mide el costo por cuadro con 100 remotas, todo encendido y todo apagado', () => {
    const CUADROS = 900;
    const medir = (encendido: boolean) => {
      if (encendido) encenderTodo();
      else apagarTodo();
      const esc = crearEscenario(100, CUADROS);
      const medidor = crearMedidor(CUADROS);
      const lod = crearLod(PARAMETROS_LOD, 128, crearPresupuesto(1));
      const dibujar = () => {};
      // Calentamiento: el JIT y las estructuras se crean.
      for (let f = 0; f < 300; f++) {
        esc.entregar(f * DT);
        animarRemotas({
          presentes: esc.presentes,
          rigs: esc.rigs,
          dt: DT,
          t: f * DT,
          dibujar,
          lod,
        });
      }
      for (let f = 300; f < CUADROS; f++) {
        const t = f * DT;
        esc.entregar(t);
        animarRemotas({
          presentes: esc.presentes,
          rigs: esc.rigs,
          dt: DT,
          t,
          tAhora: t,
          dibujar,
          cuadro: f,
          lod,
          medidor,
          camara: { x: 0, y: 3, z: 0 },
          enVista: (x) => Math.abs(x) < 12,
        });
      }
      const s: EstadisticasMedidor = { media: 0, p50: 0, p95: 0, max: 0, n: 0 };
      estadisticas(medidor, s);
      return s;
    };
    const encendido = medir(true);
    const apagado = medir(false);
    console.log(
      `costo por cuadro con 100 remotas (ms): todo encendido media ${encendido.media.toFixed(3)} ` +
        `p95 ${encendido.p95.toFixed(3)} | todo apagado media ${apagado.media.toFixed(3)} p95 ${apagado.p95.toFixed(3)}`,
    );
    expect(encendido.n).toBeGreaterThan(500);
    expect(encendido.media).toBeLessThan(3);
    expect(apagado.media).toBeLessThan(3);
  });
});

describe('salto de personas remotas', () => {
  it('un contador de saltos nuevo despega tras el retraso de las instantáneas y aterriza; al entrar no salta', () => {
    const esc = crearEscenario(1, 240);
    const p = esc.presentes[0] as PersonaPresente;
    p.saltos = 4; // ya traía saltos de antes: no debe saltar al aparecer
    const rig = esc.rigs.get('p0') as Rig;
    const alturas: number[] = [];
    for (let f = 0; f < 240; f++) {
      esc.entregar(f * DT);
      if (f === 60) p.saltos = 5;
      animarRemotas({
        presentes: esc.presentes,
        rigs: esc.rigs,
        dt: DT,
        t: f * DT,
        dibujar: () => undefined,
      });
      alturas.push(rig.pelvis.position.y);
    }
    const antes = Math.max(...alturas.slice(0, 60));
    const durante = Math.max(...alturas.slice(60, 180));
    expect(antes).toBeLessThan(0.75);
    expect(durante).toBeGreaterThan(1.3);
    // el despegue llega con retraso (las instantáneas se dibujan en el pasado), no en el mismo cuadro
    expect(alturas[61] as number).toBeLessThan(0.75);
    expect(alturas[239] as number).toBeLessThan(0.75);
    expect(cuerpoRemoto(esc.rigs, 'p0')?.loc.salto.saltos).toBe(1);
  });
});

describe('remotas sentándose', () => {
  /**
   * Quien se sienta de espaldas al asiento gira hasta su yaw y se desliza hacia atrás (rumbo 0, mueve −z).
   * La mezcla del rumbo con la dirección del movimiento lo volcaba 90° mientras bajaba.
   */
  function sentar(estado: 'de-pie' | 'sentado') {
    const p: PersonaPresente = {
      id: 'p0',
      nombre: 'P0',
      atuendo: ATUENDO,
      x: 0,
      y: 0,
      z: 0,
      rumbo: 0,
      estado,
    };
    const rig = crearRig();
    const rigs = new Map([['p0', rig]]);
    let maxDesvio = 0;
    for (let f = 0; f < 90; f++) {
      if (f % 6 === 0) p.z -= 1 * 6 * DT; // 1 m/s hacia atrás
      animarRemotas({
        presentes: [p],
        rigs,
        dt: DT,
        t: f * DT,
        tAhora: f * DT,
        dibujar: () => undefined,
      });
      if (f > 40) maxDesvio = Math.max(maxDesvio, Math.abs(rig.raiz.rotation.y));
    }
    return maxDesvio;
  }

  it('sentada, el cuerpo queda en el yaw del asiento aunque se deslice hacia atrás', () => {
    expect(sentar('sentado')).toBeLessThan(0.05);
  });

  it('de pie, el mismo desplazamiento sí lo gira hacia donde se mueve (la prueba es válida)', () => {
    expect(sentar('de-pie')).toBeGreaterThan(0.5);
  });
});
