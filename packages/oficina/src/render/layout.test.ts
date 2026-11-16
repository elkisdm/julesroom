import { describe, expect, it } from 'vitest';
import type { AgenteOficina } from '../tipos';
import { DISTANCIA_CONVERSACION } from '../animacion/interacciones';
import { ambienteDe, plano } from '../mansion/plano';
import { escenarioMansion } from '../escenarios/mansion';
import { crearEscenarioPrueba } from '../escenarios/prueba';
import { asignarPuestos, departamentosBase } from './layout';

const agente = (id: string, departamento: string): AgenteOficina => ({
  id,
  nombre: id,
  rol: 'Backend',
  departamento,
  estado: 'trabajando',
});

const delDepartamento = (id: string, cuantos: number) =>
  Array.from({ length: cuantos }, (_, i) => agente(`${id}-${i}`, id));

const llena = (porDepartamento: number) =>
  asignarPuestos(
    departamentosBase.flatMap((d) => delDepartamento(d.id, porDepartamento)),
    departamentosBase,
  );

describe('asignarPuestos', () => {
  it('cada agente recibe un lugar del departamento, en el orden de entrada y con la altura de su piso', () => {
    const puestos = asignarPuestos(
      [agente('a', 'ventas'), agente('b', 'desarrollo')],
      departamentosBase,
    );
    expect(puestos.map((p) => p.agenteId)).toEqual(['a', 'b']);
    expect(puestos.map((p) => p.ambiente)).toEqual(['ventas', 'desarrollo']);
    expect(puestos.map((p) => p.y)).toEqual([3.9, 7.8]);
    expect(puestos.map((p) => plano.ambientes[p.sala]?.id)).toEqual(['ventas', 'desarrollo']);
  });

  it('toma las posiciones del plano: asiento, punto de espera y hacia dónde mira', () => {
    const [puesto] = asignarPuestos([agente('a', 'finanzas')], departamentosBase);
    const lugar = plano.lugares.find((l) => l.departamento === 'finanzas');
    expect(puesto?.asiento).toEqual({ x: lugar?.x, z: lugar?.z });
    expect(puesto?.parado).toEqual(lugar?.salida);
    expect(puesto?.escritorio).toEqual(lugar?.mira);
    expect(puesto?.yawSentado).toBe(lugar?.yaw);
    expect(puesto?.sentado).toBe(true);
  });

  it('con 30 agentes (5 por departamento) no hay dos en el mismo punto', () => {
    const puestos = llena(5);
    const unicos = new Set(puestos.map((p) => `${p.ambiente}|${p.asiento.x}|${p.asiento.z}`));
    expect(puestos).toHaveLength(30);
    expect(unicos.size).toBe(30);
  });

  it('Personal se reparte entre el gimnasio (de pie) y el living (sentados)', () => {
    const puestos = asignarPuestos(delDepartamento('personal', 6), departamentosBase);
    expect(puestos.map((p) => p.ambiente)).toEqual([
      'gimnasio',
      'gimnasio',
      'gimnasio',
      'living',
      'living',
      'living',
    ]);
    expect(puestos.map((p) => p.sentado)).toEqual([false, false, false, true, true, true]);
  });

  it('un departamento desconocido va al atrio, sin pisar a otro desconocido', () => {
    const puestos = asignarPuestos(
      [agente('a', 'inexistente'), agente('b', 'otro-raro')],
      departamentosBase,
    );
    expect(puestos.map((p) => p.ambiente)).toEqual(['atrio', 'atrio']);
    expect(puestos[0]?.asiento).not.toEqual(puestos[1]?.asiento);
  });

  it('del séptimo en adelante van de pie, y pasados los lugares se repiten con desfase sin pisarse', () => {
    const puestos = asignarPuestos(delDepartamento('desarrollo', 45), departamentosBase);
    expect(puestos.slice(6).every((p) => !p.sentado)).toBe(true);
    const unicos = new Set(puestos.map((p) => `${p.asiento.x}|${p.asiento.z}`));
    expect(unicos.size).toBe(45);
    expect(new Set(puestos.map((p) => p.clave)).size).toBe(45);
  });

  it('cada puesto guarda el centro de su ambiente y solo Contenido tiene punto de luz', () => {
    const agentes = departamentosBase.map((d) => agente(d.id, d.id));
    for (const p of asignarPuestos(agentes, departamentosBase)) {
      const a = ambienteDe(p.ambiente);
      expect(p.centro).toEqual({ x: (a.x0 + a.x1) / 2, z: (a.z0 + a.z1) / 2 });
      expect(p.luz !== null).toBe(p.ambiente === 'contenido');
    }
  });

  it('el punto de café es de la barra y los de un departamento quedan lo bastante cerca para conversar', () => {
    const puestos = asignarPuestos(delDepartamento('ventas', 4), departamentosBase);
    const cafes = puestos.map((p) => p.cafe);
    expect(new Set(cafes.map((c) => `${c.x}|${c.z}`)).size).toBe(4);
    for (const a of cafes) {
      expect(plano.cafe).toContainEqual(a);
      for (const b of cafes)
        expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeLessThan(DISTANCIA_CONVERSACION);
    }
  });
});

describe('desde la cámara se ve la cara o el perfil', () => {
  it('ninguna persona queda de espaldas, ni sentada ni de pie', () => {
    for (const p of llena(10)) expect(Math.cos(p.yawSentado)).toBeGreaterThanOrEqual(-1e-9);
  });
});

describe('asignarPuestos con escenario', () => {
  it('con la mansión explícita da lo mismo que por defecto, y trae sus rutas', () => {
    const agentes = departamentosBase.flatMap((d) => delDepartamento(d.id, 8));
    const explicito = asignarPuestos(agentes, departamentosBase, escenarioMansion);
    const sinRutas = (ps: ReturnType<typeof asignarPuestos>) =>
      ps.map((p) => ({ ...p, rutas: undefined }));
    expect(sinRutas(explicito)).toEqual(sinRutas(asignarPuestos(agentes, departamentosBase)));
    for (const p of explicito) expect(p.rutas).toBe(escenarioMansion.rutas);
  });

  describe('escenario de un nivel con asignación por orden', () => {
    const prueba = crearEscenarioPrueba();
    const deptos = [
      { id: 'x', nombre: 'X', lider: '', color: '#111111' },
      { id: 'y', nombre: 'Y', lider: '', color: '#222222' },
      { id: 'z', nombre: 'Z', lider: '', color: '#333333' },
    ];
    const puestos = asignarPuestos(
      [agente('a', 'x'), agente('b', 'y'), agente('c', 'z'), agente('d', 'x')],
      deptos,
      prueba,
    );

    it('el departamento i cae en equipo-(i+1) y el sobrante en el ambiente común', () => {
      expect(puestos.map((p) => p.ambiente)).toEqual(['a', 'b', 'comun', 'a']);
      expect(puestos.map((p) => p.lugar.id)).toEqual(['a-1', 'b-1', 'comun-1', 'a-2']);
    });

    it('altura, sala, ambiente y rutas salen de la planta del escenario', () => {
      expect(puestos.map((p) => p.y)).toEqual([0, 0, 0, 0]);
      expect(puestos.map((p) => p.sala)).toEqual([0, 1, 2, 0]);
      for (const p of puestos) expect(p.rutas).toBe(prueba.rutas);
      expect(puestos[0]?.luz).toBeNull();
    });

    it('el café sale del grupo del índice del departamento', () => {
      expect(puestos[1]?.cafe).toEqual(prueba.planta.cafe[4]);
      expect(puestos[3]?.cafe).toEqual(prueba.planta.cafe[1]);
    });

    it('un departamento que la definición no trae cae en el ambiente común', () => {
      const [p] = asignarPuestos([agente('q', 'otro')], deptos, prueba);
      expect(p?.ambiente).toBe('comun');
    });
  });
});
