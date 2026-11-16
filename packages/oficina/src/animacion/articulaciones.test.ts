import { describe, expect, it } from 'vitest';
import {
  calcularPose as calcularPoseEn,
  crearPose,
  LIMITE_CODO,
  LIMITE_RODILLA,
} from './articulaciones';
import type { Actividad } from '../tipos';
import type { EntradaPose, PosturaCuerpo } from './articulaciones';

const POSTURAS: PosturaCuerpo[] = ['sentado', 'de_pie', 'caminando'];
const ACTIVIDADES: (Actividad | undefined)[] = [
  undefined,
  'leyendo',
  'escribiendo',
  'pensando',
  'hablando',
];
const VELOCIDADES = [0, 0.5, 1, 3, -2];
const base = { velocidad: 1, t: 0 } as const;
/** Pose recién calculada en un objeto propio (el cálculo real escribe en uno reutilizable). */
const calcularPose = (entrada: EntradaPose) => calcularPoseEn(entrada, crearPose());

describe('invariantes de articulaciones', () => {
  it('la rodilla nunca es negativa ni pasa de 2.4 en 1000 fases, todas las posturas y velocidades', () => {
    for (const postura of POSTURAS)
      for (const velocidad of VELOCIDADES)
        for (let i = 0; i < 1000; i++) {
          const pose = calcularPose({
            ...base,
            velocidad,
            postura,
            fase: (i / 1000) * Math.PI * 2 * 7 - 5,
          });
          for (const pierna of pose.piernas) {
            expect(pierna.rodilla).toBeGreaterThanOrEqual(0);
            expect(pierna.rodilla).toBeLessThanOrEqual(LIMITE_RODILLA);
          }
        }
    expect(LIMITE_RODILLA).toBe(2.4);
  });

  it('el codo queda en [0, 2.5] para toda actividad, postura y gesto', () => {
    for (const postura of POSTURAS)
      for (const actividad of ACTIVIDADES)
        for (const llevaTaza of [false, true])
          for (let i = 0; i < 200; i++) {
            const pose = calcularPose({
              ...base,
              postura,
              actividad,
              llevaTaza,
              saludando: i % 2 === 0,
              fase: i,
              t: i * 0.37,
            });
            for (const brazo of pose.brazos) {
              expect(brazo.codo).toBeGreaterThanOrEqual(0);
              expect(brazo.codo).toBeLessThanOrEqual(LIMITE_CODO);
            }
          }
    expect(LIMITE_CODO).toBe(2.5);
  });
});

describe('marcha', () => {
  it('brazo y pierna del mismo lado van en contrafase', () => {
    for (let i = 1; i < 200; i++) {
      const fase = (i / 200) * Math.PI * 2;
      const { piernas, brazos } = calcularPose({ ...base, postura: 'caminando', fase });
      for (const lado of [0, 1] as const) {
        const cadera = piernas[lado].cadera;
        const hombro = brazos[lado].hombro;
        if (Math.abs(cadera) < 1e-6) continue;
        expect(Math.sign(hombro) * Math.sign(cadera)).toBe(-1);
      }
    }
  });

  it('una pierna está en balanceo mientras la otra está en apoyo', () => {
    const { piernas } = calcularPose({ ...base, postura: 'caminando', fase: 0 });
    expect(piernas[0].rodilla).toBeGreaterThan(0.3);
    expect(piernas[1].rodilla).toBeCloseTo(0, 6);
  });

  it('la pelvis rebota solo al caminar y dentro de un rango pequeño', () => {
    const reposo = calcularPose({ ...base, postura: 'de_pie', fase: 1 });
    expect(reposo.pelvisY).toBe(0);
    for (let i = 0; i < 100; i++) {
      const caminando = calcularPose({ ...base, postura: 'caminando', fase: i / 10 });
      expect(caminando.pelvisY).toBeGreaterThanOrEqual(0);
      expect(caminando.pelvisY).toBeLessThanOrEqual(0.035 + 1e-9);
    }
  });
});

describe('posturas estáticas', () => {
  it('sentado: cadera ~ -pi/2 y rodilla ~ pi/2', () => {
    const { piernas } = calcularPose({ ...base, postura: 'sentado', fase: 2 });
    for (const pierna of piernas) {
      expect(pierna.cadera).toBeCloseTo(-Math.PI / 2, 6);
      expect(pierna.rodilla).toBeCloseTo(Math.PI / 2, 6);
    }
  });

  it('de pie: piernas rectas', () => {
    const { piernas } = calcularPose({ ...base, postura: 'de_pie', fase: 2 });
    for (const pierna of piernas) expect(pierna).toEqual({ cadera: 0, rodilla: 0 });
  });
});

describe('brazos por actividad', () => {
  it('teclear flexiona los codos y la muñeca vibra con el tiempo', () => {
    const a = calcularPose({
      ...base,
      postura: 'sentado',
      actividad: 'escribiendo',
      fase: 0,
      t: 0,
    });
    const b = calcularPose({
      ...base,
      postura: 'sentado',
      actividad: 'escribiendo',
      fase: 0,
      t: 0.03,
    });
    for (const brazo of a.brazos) expect(brazo.codo).toBeGreaterThan(1);
    expect(a.brazos[0].muneca).not.toBeCloseTo(b.brazos[0].muneca, 4);
  });

  it('sin teclear la muñeca no vibra', () => {
    const a = calcularPose({ ...base, postura: 'sentado', actividad: 'leyendo', fase: 0, t: 0 });
    const b = calcularPose({ ...base, postura: 'sentado', actividad: 'leyendo', fase: 0, t: 0.03 });
    expect(a.brazos[1].muneca).toBe(b.brazos[1].muneca);
  });

  it('llevar la taza flexiona el codo derecho', () => {
    const sin = calcularPose({ ...base, postura: 'de_pie', fase: 0 });
    const con = calcularPose({ ...base, postura: 'de_pie', fase: 0, llevaTaza: true });
    expect(con.brazos[1].codo).toBeGreaterThan(sin.brazos[1].codo + 0.8);
  });

  it('saludar levanta el brazo derecho', () => {
    const pose = calcularPose({ ...base, postura: 'de_pie', fase: 0, saludando: true, t: 1 });
    expect(pose.brazos[1].abduccion).toBeGreaterThan(2);
  });

  it('teclear inclina la columna hacia delante', () => {
    expect(
      calcularPose({ ...base, postura: 'sentado', actividad: 'escribiendo', fase: 0 }).columna,
    ).toBeGreaterThan(0);
  });
});

describe('gestos por actividad', () => {
  const sentado = (actividad: Actividad, t = 0) =>
    calcularPose({ ...base, postura: 'sentado', actividad, fase: 0, t });

  it('hablando: ambos brazos gesticulan, con rango amplio y fuera de fase', () => {
    const hombros: number[][] = [[], []];
    const abducciones: number[] = [];
    for (let i = 0; i < 200; i++) {
      const pose = sentado('hablando', i * 0.05);
      pose.brazos.forEach((b, lado) => hombros[lado]?.push(b.hombro));
      abducciones.push(pose.brazos[0].abduccion, pose.brazos[1].abduccion);
    }
    for (const serie of hombros)
      expect(Math.max(...serie) - Math.min(...serie)).toBeGreaterThan(0.6);
    expect(Math.max(...abducciones) - Math.min(...abducciones)).toBeGreaterThan(0.2);
    const a = sentado('hablando', 0.4);
    expect(a.brazos[0].hombro - sentado('hablando', 0.4).brazos[1].hombro).not.toBeCloseTo(0, 2);
  });

  it('hablando: la cabeza asiente y gira un poco', () => {
    const cabezas = Array.from({ length: 100 }, (_, i) => sentado('hablando', i * 0.05));
    const pitch = cabezas.map((p) => p.cabezaPitch);
    expect(Math.max(...pitch) - Math.min(...pitch)).toBeGreaterThan(0.05);
    expect(Math.max(...cabezas.map((p) => Math.abs(p.cabezaYaw)))).toBeGreaterThan(0.05);
  });

  it('pensando: la mano derecha sube hasta el mentón y la cabeza se ladea hacia arriba', () => {
    const pose = sentado('pensando');
    // La mano queda por encima del codo (antebrazo hacia arriba) y cerca de la cara.
    expect(pose.brazos[1].hombro).toBeLessThan(-1);
    expect(pose.brazos[1].codo).toBeGreaterThan(2);
    expect(pose.cabezaPitch).toBeGreaterThan(0);
    expect(Math.abs(pose.cabezaYaw)).toBeGreaterThan(0.1);
  });

  it('leyendo: la cabeza se inclina hacia la pantalla', () => {
    const pose = sentado('leyendo');
    expect(pose.cabezaPitch).toBeLessThan(-0.2);
    expect(pose.columna).toBeGreaterThan(0);
  });

  it('escribiendo no mueve la cabeza por su cuenta y sin actividad tampoco', () => {
    expect(sentado('escribiendo').cabezaPitch).toBe(0);
    const sin = calcularPose({ ...base, postura: 'sentado', fase: 0 });
    expect(sin.cabezaPitch).toBe(0);
    expect(sin.cabezaYaw).toBe(0);
  });

  it('caminando no aplica el gesto de la actividad', () => {
    const pose = calcularPose({ ...base, postura: 'caminando', actividad: 'leyendo', fase: 1 });
    expect(pose.cabezaPitch).toBe(0);
    expect(pose.cabezaYaw).toBe(0);
  });
});

describe('sin asignaciones por cuadro', () => {
  it('escribe en el objeto de salida y reutiliza sus piernas y brazos', () => {
    const salida = crearPose();
    const piernas = salida.piernas;
    const brazos = salida.brazos;
    const brazoIzquierdo = salida.brazos[0];
    const resultado = calcularPoseEn({ ...base, postura: 'caminando', fase: 1 }, salida);
    expect(resultado).toBe(salida);
    expect(salida.piernas).toBe(piernas);
    expect(salida.brazos).toBe(brazos);
    expect(salida.brazos[0]).toBe(brazoIzquierdo);
  });

  it('no arrastra valores de la llamada anterior', () => {
    const salida = crearPose();
    calcularPoseEn({ ...base, postura: 'sentado', actividad: 'hablando', fase: 0, t: 1 }, salida);
    calcularPoseEn({ ...base, postura: 'de_pie', fase: 0 }, salida);
    expect(salida).toEqual(calcularPose({ ...base, postura: 'de_pie', fase: 0 }));
  });
});
