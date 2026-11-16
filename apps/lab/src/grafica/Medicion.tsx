import { useEffect, useMemo, useRef, useState } from 'react';
import type { OficinaProps } from '@oficina/motor';
import {
  Oficina,
  TECNICAS_POR_NIVEL,
  crearFuenteSimulada,
  definicionAProps,
  ejemploEquipo,
  estadisticasGrafica,
} from '@oficina/motor';
import type { Tecnicas } from '@oficina/motor';
import { resumir, simuladasPara } from './muestreo';
import type { ResumenCuadros } from './muestreo';

/**
 * Página de medición gráfica. Se abre en cualquier equipo: `?n=100&calidad=auto&enfocar=<id>`.
 * Mide con su propio bucle de requestAnimationFrame (no con el del motor), así el número es el
 * mismo que vería la persona. Para automatizar: `window.__grafica.reiniciar()` y `.leer()`.
 */
export interface LecturaGrafica extends ResumenCuadros {
  drawCalls: number;
  triangulos: number;
  texturas: number;
  geometrias: number;
  programas: number;
  n: number;
  calidad: string;
  dpr: number;
  ancho: number;
  alto: number;
  nucleos: number;
  /** Tiempo de `gl.render` en CPU (preparar y enviar el cuadro), p50 / p95 en ms. */
  renderCpuP50: number;
  renderCpuP95: number;
  memoriaJsMb: number | null;
  gpu: string;
  /** Personas dibujadas / descartadas por cámara / con geometría simple en el último cuadro. */
  personas: {
    total: number;
    descartadas: number;
    lodSimple: number;
    contorno: number;
    hablando: number;
  };
  tecnicas: Partial<Tecnicas>;
}

/** Qué hay en la escena y cuánto cuesta dibujarlo: para repartir las llamadas de dibujo. */
export interface Desglose {
  instanciadas: { llamadas: number; instancias: number };
  mallas: { llamadas: number; triangulos: number };
  materiales: number;
  /** Mallas fijas por material (tipo · color · transparente), de más a menos: dónde se van las llamadas. */
  porMaterial: { clave: string; mallas: number; triangulos: number }[];
}

declare global {
  interface Window {
    __grafica?: {
      reiniciar: () => void;
      leer: () => LecturaGrafica;
      desglose: () => Desglose | null;
    };
  }
}

type WebGLRenderer = Parameters<NonNullable<OficinaProps['onRenderer']>>[0];

const NUMEROS = [20, 100, 200];
const CALIDADES = ['auto', 'alta', 'media', 'baja'] as const;
type Calidad = (typeof CALIDADES)[number];

/** `?t=rim=0,lod=0,anisotropia=2`: apaga o enciende técnicas sueltas. */
function parsearTecnicas(texto: string | null): Partial<Tecnicas> {
  const salida: Record<string, boolean | number> = {};
  for (const par of (texto ?? '').split(',')) {
    const [k, v] = par.split('=');
    if (!k || v === undefined || !(k in TECNICAS_POR_NIVEL.alta)) continue;
    salida[k] = k === 'anisotropia' ? Number(v) : v === '1';
  }
  return salida as Partial<Tecnicas>;
}

function parametros() {
  const q = new URLSearchParams(window.location.search);
  const c = q.get('calidad');
  return {
    n: Number(q.get('n') ?? 100),
    calidad: (CALIDADES as readonly string[]).includes(c ?? '') ? (c as Calidad) : 'auto',
    enfocar: q.get('enfocar'),
    panel: q.get('panel') !== '0',
    tecnicas: parsearTecnicas(q.get('t')),
    seleccionado: q.get('sel'),
    habla: q.get('habla') !== '0',
    sinCasa: q.get('sinCasa') === '1',
  };
}

function nombreGpu(gl: WebGLRenderer): string {
  const ctx = gl.getContext();
  const ext = ctx.getExtension('WEBGL_debug_renderer_info');
  return ext ? String(ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : 'desconocida';
}

export function Medicion() {
  const inicial = useMemo(parametros, []);
  const [n, setN] = useState(inicial.n);
  const [calidad, setCalidad] = useState<Calidad>(inicial.calidad);
  const [tecnicas_, setTecnicas] = useState<Partial<Tecnicas>>(inicial.tecnicas);
  const tecnicas = useRef(tecnicas_);
  tecnicas.current = tecnicas_;
  const [lectura, setLectura] = useState<LecturaGrafica | null>(null);
  const props = useMemo(() => definicionAProps(ejemploEquipo), []);
  const yaDefinidas = props.agentes.length + props.personas.length;
  const altas = useMemo(
    () => props.personas.map((p) => ({ id: p.id, nombre: p.nombre, atuendo: p.atuendo })),
    [props.personas],
  );
  const fuente = useMemo(
    () => crearFuenteSimulada({ cantidad: simuladasPara(n, yaDefinidas), semilla: 1, altas }),
    [n, yaDefinidas, altas],
  );
  // Se modifica en el mismo objeto: así hablar no vuelve a renderizar la oficina entera.
  const hablando = useRef(new Set<string>());
  // Simula tres personas hablando que cambian cada 2 s (la voz real llega con LiveKit).
  useEffect(() => {
    if (!inicial.habla) return;
    const sortear = () => {
      const ids = fuente.personas().map((p) => p.id);
      hablando.current.clear();
      for (let i = 0; i < Math.min(3, ids.length); i++) {
        const id = ids[Math.floor(Math.random() * ids.length)];
        if (id) hablando.current.add(id);
      }
    };
    sortear();
    const id = window.setInterval(sortear, 2000);
    return () => window.clearInterval(id);
  }, [fuente, inicial.habla]);
  const gl = useRef<WebGLRenderer | null>(null);
  const cuadros = useRef<number[]>([]);
  const renderCpu = useRef<number[]>([]);
  const escena = useRef<{ children: unknown[] } | null>(null);

  // Avanza la fuente y mide el tiempo entre cuadros reales de pantalla.
  useEffect(() => {
    let id = 0;
    let anterior = performance.now();
    const paso = (t: number) => {
      const dt = t - anterior;
      anterior = t;
      if (dt < 250) cuadros.current.push(dt);
      fuente.avanzar(Math.min(dt / 1000, 0.1));
      id = requestAnimationFrame(paso);
    };
    id = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(id);
  }, [fuente]);

  useEffect(() => {
    const leer = (): LecturaGrafica => {
      const r = gl.current;
      const memoria = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
      return {
        ...resumir(cuadros.current),
        renderCpuP50: resumir(renderCpu.current).p50,
        renderCpuP95: resumir(renderCpu.current).p95,
        drawCalls: r?.info.render.calls ?? 0,
        triangulos: r?.info.render.triangles ?? 0,
        texturas: r?.info.memory.textures ?? 0,
        geometrias: r?.info.memory.geometries ?? 0,
        programas: r?.info.programs?.length ?? 0,
        n,
        calidad,
        dpr: r?.getPixelRatio() ?? 0,
        ancho: window.innerWidth,
        alto: window.innerHeight,
        nucleos: navigator.hardwareConcurrency,
        memoriaJsMb: memoria ? Math.round(memoria.usedJSHeapSize / 1048576) : null,
        gpu: r ? nombreGpu(r) : 'sin renderizador',
        personas: {
          total: estadisticasGrafica.personas,
          descartadas: estadisticasGrafica.descartadas,
          lodSimple: estadisticasGrafica.lodSimple,
          contorno: estadisticasGrafica.contorno,
          hablando: hablando.current.size,
        },
        tecnicas: tecnicas.current,
      };
    };
    const desglose = (): Desglose | null => {
      const raiz = escena.current as unknown as {
        traverseVisible: (f: (o: Record<string, unknown>) => void) => void;
      } | null;
      if (!raiz) return null;
      const d: Desglose = {
        instanciadas: { llamadas: 0, instancias: 0 },
        mallas: { llamadas: 0, triangulos: 0 },
        materiales: 0,
        porMaterial: [],
      };
      const tabla = new Map<string, { mallas: number; triangulos: number }>();
      const mats = new Set<unknown>();
      raiz.traverseVisible((o) => {
        if (!o.isMesh) return;
        const g = o.geometry as {
          index?: { count: number };
          attributes: { position: { count: number } };
        };
        const tri = (g.index?.count ?? g.attributes.position.count) / 3;
        const m = o.material;
        for (const x of Array.isArray(m) ? m : [m]) mats.add(x);
        if (o.isInstancedMesh) {
          if ((o.count as number) === 0) return;
          d.instanciadas.llamadas++;
          d.instanciadas.instancias += o.count as number;
        } else {
          d.mallas.llamadas++;
          d.mallas.triangulos += tri;
          const mat = (Array.isArray(m) ? m[0] : m) as Record<string, unknown>;
          if (mat && mat.visible !== false) {
            const color = (
              mat.color as { getHexString?: () => string } | undefined
            )?.getHexString?.();
            const clave = `${String(mat.type)} ${color ?? '-'}${mat.transparent ? ' transp' : ''}`;
            const e = tabla.get(clave) ?? { mallas: 0, triangulos: 0 };
            e.mallas++;
            e.triangulos += tri;
            tabla.set(clave, e);
          }
        }
      });
      d.materiales = mats.size;
      d.porMaterial = [...tabla]
        .map(([clave, v]) => ({ clave, ...v }))
        .sort((a, b) => b.mallas - a.mallas)
        .slice(0, 25);
      return d;
    };
    window.__grafica = {
      desglose,
      reiniciar: () => {
        cuadros.current = [];
        renderCpu.current = [];
      },
      leer,
    };
  }, [n, calidad]);

  const medir = () => {
    window.__grafica?.reiniciar();
    window.setTimeout(() => setLectura(window.__grafica?.leer() ?? null), 5000);
  };

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Oficina
        key={`${n}:${calidad}`}
        tecnicas={tecnicas_}
        diagnostico={{ sinCasa: inicial.sinCasa }}
        hablandoIds={hablando.current}
        seleccionadoId={inicial.seleccionado}
        agentes={props.agentes}
        departamentos={props.departamentos}
        horaChile={props.horaChile}
        calidad={calidad}
        fuentePresencia={fuente}
        enfocadoId={inicial.enfocar}
        onRenderer={(r) => {
          gl.current = r;
          const original = r.render.bind(r);
          r.render = (...a: Parameters<typeof original>) => {
            escena.current ??= a[0] as unknown as { children: unknown[] };
            const t0 = performance.now();
            original(...a);
            renderCpu.current.push(performance.now() - t0);
          };
        }}
        onProyector={(f) => (window.__proyectar = f)}
      />
      {inicial.panel && (
        <aside
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            padding: 8,
            background: 'rgba(11,13,16,.85)',
            borderRadius: 8,
            font: '12px/1.4 system-ui',
            maxWidth: 260,
          }}
        >
          <div>
            {NUMEROS.map((v) => (
              <button key={v} aria-pressed={v === n} onClick={() => setN(v)}>
                {v}
              </button>
            ))}{' '}
            {CALIDADES.map((c) => (
              <button key={c} aria-pressed={c === calidad} onClick={() => setCalidad(c)}>
                {c}
              </button>
            ))}
          </div>
          <div>
            {(Object.keys(TECNICAS_POR_NIVEL.alta) as (keyof Tecnicas)[])
              .filter((k) => typeof TECNICAS_POR_NIVEL.alta[k] === 'boolean')
              .map((k) => (
                <label key={k} style={{ display: 'block' }}>
                  <input
                    type="checkbox"
                    checked={
                      (tecnicas_[k] ??
                        TECNICAS_POR_NIVEL[calidad === 'auto' ? 'alta' : calidad][k]) as boolean
                    }
                    onChange={(e) => setTecnicas((t) => ({ ...t, [k]: e.target.checked }))}
                  />{' '}
                  {k}
                </label>
              ))}
          </div>
          <button onClick={medir}>Medir 5 s</button>
          {lectura && (
            <pre style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap' }}>
              {`fps ${lectura.fps.toFixed(1)} · p50 ${lectura.p50.toFixed(1)} · p95 ${lectura.p95.toFixed(1)} · p99 ${lectura.p99.toFixed(1)} ms\ndraw ${lectura.drawCalls} · tri ${lectura.triangulos} · tex ${lectura.texturas} · geo ${lectura.geometrias}\n${lectura.ancho}px dpr ${lectura.dpr} · ${lectura.nucleos} núcleos\n${lectura.gpu}`}
            </pre>
          )}
        </aside>
      )}
    </div>
  );
}
