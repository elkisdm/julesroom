import { describe, expect, it } from 'vitest';
import { azarSecuencia } from '../test-utils';
import type { Actividad, EstadoAgente } from '../tipos';
import { avanzarMaquina, crearMaquina } from './maquina';
import type { EntradaMaquina, Maquina, Postura } from './maquina';

const libre: EntradaMaquina = {
  t: 0,
  estado: 'libre',
  reduceMotion: false,
  enfocado: false,
  enDestino: false,
};
const POSTURAS: Postura[] = ['sentado', 'de_pie', 'caminando_cafe', 'volviendo'];

describe('estado -> postura', () => {
  it('trabajando se sienta con actividad por defecto escribiendo', () => {
    const { salida } = avanzarMaquina(
      crearMaquina(0, azarSecuencia(0.5)),
      { ...libre, estado: 'trabajando' },
      azarSecuencia(0.5),
    );
    expect(salida).toMatchObject({
      postura: 'sentado',
      objetivo: 'asiento',
      sentarse: true,
      actividad: 'escribiendo',
    });
  });

  it('trabajando respeta la actividad dada', () => {
    const { salida } = avanzarMaquina(
      crearMaquina(0, azarSecuencia(0.5)),
      { ...libre, estado: 'trabajando', actividad: 'pensando' },
      azarSecuencia(0.5),
    );
    expect(salida.actividad).toBe('pensando');
  });

  it('esperando_decision se pone de pie y no pasea', () => {
    const { salida } = avanzarMaquina(
      crearMaquina(0, azarSecuencia(0)),
      { ...libre, estado: 'esperando_decision', t: 500 },
      azarSecuencia(0),
    );
    expect(salida).toMatchObject({
      postura: 'de_pie',
      objetivo: 'de_pie',
      sentarse: false,
      paseando: false,
    });
  });

  it('libre sentado se queda sentado hasta que toque pasear', () => {
    const { salida } = avanzarMaquina(
      crearMaquina(0, azarSecuencia(0.5)),
      libre,
      azarSecuencia(0.5),
    );
    expect(salida).toMatchObject({ postura: 'sentado', paseando: false });
  });

  it('enfocado (seleccionado) y sin paseo: de pie', () => {
    const { salida } = avanzarMaquina(
      crearMaquina(0, azarSecuencia(0.5)),
      { ...libre, enfocado: true },
      azarSecuencia(0.5),
    );
    expect(salida).toMatchObject({ postura: 'de_pie', sentarse: false });
  });

  it('invariante: ningún estado ni actividad produce una postura indefinida', () => {
    const estados: EstadoAgente[] = ['trabajando', 'esperando_decision', 'libre'];
    const actividades: (Actividad | undefined)[] = [
      undefined,
      'leyendo',
      'escribiendo',
      'pensando',
      'hablando',
    ];
    for (const estado of estados)
      for (const actividad of actividades)
        for (const enfocado of [false, true])
          for (const reduceMotion of [false, true]) {
            let m = crearMaquina(0, azarSecuencia(0));
            for (let t = 0; t <= 300; t += 0.5) {
              const r = avanzarMaquina(
                m,
                { t, estado, actividad, enfocado, reduceMotion, enDestino: t % 7 === 0 },
                azarSecuencia(0.3),
              );
              m = r.maquina;
              expect(POSTURAS).toContain(r.salida.postura);
            }
          }
  });
});

describe('paseo al café', () => {
  /** Recorre el ciclo completo marcando enDestino cuando el agente "llega". */
  function simular(reduceMotion: boolean) {
    const azar = azarSecuencia(0); // primer paseo a los 15 s, pausa de 3 s
    let m: Maquina = crearMaquina(0, azar);
    const log: { t: number; postura: Postura; objetivo: string }[] = [];
    let ultimaLlegada: string | null = null;
    for (let t = 0; t <= 30; t += 0.25) {
      const objetivoPrevio = log.at(-1)?.objetivo ?? 'asiento';
      // el agente llega en cuanto el objetivo cambia de sitio (modelo simple)
      const enDestino = ultimaLlegada === objetivoPrevio;
      const r = avanzarMaquina(
        m,
        { t, estado: 'libre', reduceMotion, enfocado: false, enDestino },
        azar,
      );
      m = r.maquina;
      log.push({ t, postura: r.salida.postura, objetivo: r.salida.objetivo });
      ultimaLlegada = r.salida.objetivo;
    }
    return log;
  }

  it('cuando libre y sin reduceMotion va al café, hace una pausa y vuelve al asiento', () => {
    const fases = simular(false).map((l) => l.postura);
    const resumido = fases.filter((p, i) => p !== fases[i - 1]);
    expect(resumido).toEqual(['sentado', 'caminando_cafe', 'de_pie', 'volviendo', 'sentado']);
  });

  it('con prefers-reduced-motion nunca pasea', () => {
    expect(new Set(simular(true).map((l) => l.postura))).toEqual(new Set(['sentado']));
  });

  it('la pausa en el café dura 3 + azar*3 s', () => {
    const azar = azarSecuencia(0.5); // pausa = 3 + 0.5 * 3 = 4.5 s
    let m = crearMaquina(0, azarSecuencia(0));
    let t = 0;
    // forzar inicio de paseo
    for (; t < 100; t += 0.1) {
      const r = avanzarMaquina(m, { ...libre, t }, azar);
      m = r.maquina;
      if (r.salida.postura === 'caminando_cafe') break;
    }
    const llegada = avanzarMaquina(m, { ...libre, t: t + 0.1, enDestino: true }, azar);
    expect(llegada.salida.postura).toBe('de_pie');
    const casi = avanzarMaquina(
      llegada.maquina,
      { ...libre, t: t + 0.1 + 4.4, enDestino: true },
      azar,
    );
    expect(casi.salida.postura).toBe('de_pie');
    const fin = avanzarMaquina(casi.maquina, { ...libre, t: t + 0.1 + 4.6, enDestino: true }, azar);
    expect(fin.salida.postura).toBe('volviendo');
  });

  it('si deja de estar libre a mitad de paseo, lo cancela y vuelve a la postura del estado', () => {
    let m = crearMaquina(0, azarSecuencia(0));
    const azar = azarSecuencia(0);
    let r = avanzarMaquina(m, { ...libre, t: 20 }, azar);
    m = r.maquina;
    expect(r.salida.paseando).toBe(true);
    r = avanzarMaquina(m, { ...libre, t: 20.1, estado: 'trabajando' }, azar);
    expect(r.salida).toMatchObject({ paseando: false, postura: 'sentado' });
  });

  it('no inicia paseo estando enfocado', () => {
    const azar = azarSecuencia(0);
    const r = avanzarMaquina(crearMaquina(0, azar), { ...libre, t: 100, enfocado: true }, azar);
    expect(r.salida.paseando).toBe(false);
  });

  it('no muta la máquina de entrada', () => {
    const azar = azarSecuencia(0);
    const m = crearMaquina(0, azar);
    const copia = structuredClone(m);
    avanzarMaquina(m, { ...libre, t: 50 }, azar);
    expect(m).toEqual(copia);
  });

  it('retener alarga la pausa (conversación en el café) y retoma el resto al soltar', () => {
    const azar = azarSecuencia(0); // pausa de 3 s
    let m = crearMaquina(0, azar);
    m = avanzarMaquina(m, { ...libre, t: 20 }, azar).maquina; // sale a pasear
    m = avanzarMaquina(m, { ...libre, t: 21, enDestino: true }, azar).maquina; // llega: pausa 3 s
    m = avanzarMaquina(m, { ...libre, t: 22, retener: true }, azar).maquina; // 1 s de pausa gastado
    const retenida = avanzarMaquina(m, { ...libre, t: 40, retener: true }, azar);
    expect(retenida.salida.postura).toBe('de_pie');
    const suelta = avanzarMaquina(retenida.maquina, { ...libre, t: 40.5 }, azar);
    expect(suelta.salida.postura).toBe('de_pie'); // le quedaban 2 s
    const fin = avanzarMaquina(suelta.maquina, { ...libre, t: 43 }, azar);
    expect(fin.salida.postura).toBe('volviendo');
  });

  it('retener impide iniciar un paseo (p. ej. mientras visita a un colega)', () => {
    const azar = azarSecuencia(0);
    const r = avanzarMaquina(crearMaquina(0, azar), { ...libre, t: 100, retener: true }, azar);
    expect(r.salida.paseando).toBe(false);
  });
});

describe('ritmo de paseo y atención', () => {
  const base = {
    estado: 'libre' as const,
    reduceMotion: false,
    enfocado: false,
    enDestino: false,
  };

  it('con ritmo 0,5 el paseo tarda el doble en llegar', () => {
    const azar = () => 0;
    const normal = avanzarMaquina(
      { t: 0, faltaPaseo: 10, paseo: null },
      { ...base, t: 5 },
      azar,
    ).maquina;
    const lento = avanzarMaquina(
      { t: 0, faltaPaseo: 10, paseo: null },
      { ...base, t: 5, ritmo: 0.5 },
      azar,
    ).maquina;
    expect(normal.faltaPaseo).toBe(5);
    expect(lento.faltaPaseo).toBe(7.5);
  });
});

describe('retenido en su sala', () => {
  const base = { estado: 'libre' as const, reduceMotion: false, enfocado: false, enDestino: false };

  it('nadie inicia un paseo al café, pase el tiempo que pase', () => {
    let m = { t: 0, faltaPaseo: 1, paseo: null } as Maquina;
    for (let t = 1; t <= 200; t++) {
      const r = avanzarMaquina(m, { ...base, t, sinPaseo: true }, () => 0);
      m = r.maquina;
      expect(r.salida.paseando).toBe(false);
      expect(r.salida.objetivo).toBe('asiento');
    }
  });

  it('quien está fuera suelta el paseo y vuelve a su asiento', () => {
    const fuera: Maquina = { t: 0, faltaPaseo: 20, paseo: { fase: 'ir', espera: 0 } };
    const r = avanzarMaquina(fuera, { ...base, t: 1, sinPaseo: true }, () => 0);
    expect(r.maquina.paseo).toBeNull();
    expect(r.salida.objetivo).toBe('asiento');
  });
});
