/**
 * Cuadro de estilo de un escenario: la sala con ~24 agentes, 25 personas simuladas paseando y la vista
 * general, sin interfaz. Sirve para capturar (Playwright con GPU) y para medir el costo del cuadro.
 *
 * Parámetros: `?escenario=trading` · `?n=49` ocupantes en total (agentes = n − sim) · `?sim=25` ·
 * `?variante=<id>` (por defecto la primera del escenario) · `?calidad=auto|alta|media|baja` · `?vista=general|seguir` · `?avatar=1` monta el avatar propio
 * (con `vista=seguir` siempre está).
 * Para automatizar: `window.__cuadro.leer()` (p95 de los cuadros) y `window.__cuadro.reiniciar()`.
 */
import { StrictMode, useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Oficina,
  crearFuenteSimulada,
  crearMando,
  definicionAProps,
  ejemploEquipo,
  escenarioPorId,
  puntoDeReunion,
} from '@oficina/motor';
import { agregarAgente } from '../../editor';
import { resumir } from '../../grafica/muestreo';
import type { ResumenCuadros } from '../../grafica/muestreo';

const param = (nombre: string, defecto: string) =>
  new URLSearchParams(window.location.search).get(nombre) ?? defecto;

declare global {
  interface Window {
    __cuadro?: {
      leer: () => ResumenCuadros & { ocupantes: number; ancho: number; alto: number };
      reiniciar: () => void;
      /** Intereses avisados por `onInteres`, en orden. */
      intereses: (string | null)[];
    };
  }
}

/** La definición de ejemplo más agentes hasta `total`, repartidos entre sus departamentos. */
function agentesDeEjemplo(total: number) {
  let definicion = ejemploEquipo;
  const agentes = () => definicion.ocupantes.filter((o) => o.tipo === 'agente').length;
  for (let i = 0; agentes() < total; i++) {
    definicion = agregarAgente(definicion);
    const nuevo = definicion.ocupantes[definicion.ocupantes.length - 1];
    const deptos = definicion.departamentos;
    if (nuevo?.tipo === 'agente' && deptos.length > 0) {
      nuevo.departamento = deptos[i % deptos.length]?.id ?? nuevo.departamento;
      nuevo.estado = i % 3 === 0 ? 'libre' : 'trabajando';
    }
  }
  const props = definicionAProps(definicion);
  return { ...props, agentes: props.agentes.slice(0, total) };
}

function Cuadro() {
  const escenario = useMemo(() => escenarioPorId(param('escenario', 'trading')), []);
  const simuladas = Number(param('sim', '25'));
  const total = Number(param('n', String(24 + simuladas)));
  const calidad = param('calidad', 'auto') as 'auto' | 'alta' | 'media' | 'baja';
  const seguir = param('vista', 'general') === 'seguir';
  const conAvatar = seguir || param('avatar', '0') === '1';
  const props = useMemo(() => agentesDeEjemplo(Math.max(0, total - simuladas)), [total, simuladas]);
  // `?variante=<id>`: sin ella, la primera del escenario; la hora de la luz la pone la variante.
  const variante = param('variante', '') || undefined;

  const entrada = escenario.entradas[0];
  const fuente = useMemo(
    () =>
      crearFuenteSimulada({
        cantidad: simuladas,
        semilla: 3,
        puntoLibre: (azar, i) => puntoDeReunion(escenario, i, azar),
        y: entrada?.y ?? 0,
      }),
    [simuladas, escenario, entrada],
  );
  useEffect(() => {
    let id = 0;
    let anterior = performance.now();
    const paso = (t: number) => {
      fuente.avanzar(Math.min((t - anterior) / 1000, 0.1));
      anterior = t;
      id = requestAnimationFrame(paso);
    };
    id = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(id);
  }, [fuente]);

  const mando = useMemo(() => crearMando(), []);
  const avatar = useMemo(
    () => ({ id: 'avatar-propio', nombre: 'Tú', x: entrada?.x ?? 0, z: entrada?.z ?? 0, mando }),
    [entrada, mando],
  );

  const cuadros = useRef<number[]>([]);
  const intereses = useRef<(string | null)[]>([]);
  // `?externo=muro` alimenta esa pantalla con un lienzo de prueba (contenido de fuera).
  const externo = param('externo', '');
  const contenido = useMemo(() => {
    if (!externo) return undefined;
    const lienzo = document.createElement('canvas');
    lienzo.width = 512;
    lienzo.height = 256;
    const ctx = lienzo.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ff00aa';
      ctx.fillRect(0, 0, 512, 256);
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 64px system-ui';
      ctx.fillText('Contenido externo', 20, 150);
    }
    return { [externo]: lienzo };
  }, [externo]);
  useEffect(() => {
    let id = 0;
    let anterior = 0;
    const paso = (t: number) => {
      if (anterior) cuadros.current.push(t - anterior);
      if (cuadros.current.length > 20_000) cuadros.current.shift();
      anterior = t;
      id = requestAnimationFrame(paso);
    };
    id = requestAnimationFrame(paso);
    window.__cuadro = {
      leer: () => ({
        ...resumir(cuadros.current),
        ocupantes: props.agentes.length + simuladas + 1,
        ancho: window.innerWidth,
        alto: window.innerHeight,
      }),
      reiniciar: () => {
        cuadros.current = [];
      },
      intereses: intereses.current,
    };
    return () => cancelAnimationFrame(id);
  }, [props, simuladas]);

  return (
    <Oficina
      agentes={props.agentes}
      departamentos={props.departamentos}
      escenario={escenario.id}
      variante={variante}
      calidad={calidad}
      fuentePresencia={fuente}
      avatarPropio={conAvatar ? avatar : undefined}
      vista={seguir ? 'seguir' : 'general'}
      contenidoPantallas={contenido}
      onInteres={(id) => intereses.current.push(id)}
    />
  );
}

const raiz = document.getElementById('raiz');
if (raiz) {
  createRoot(raiz).render(
    <StrictMode>
      <Cuadro />
    </StrictMode>,
  );
}
