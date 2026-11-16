import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  Oficina,
  accionesDe,
  crearMando,
  escenarioPorId,
  fijarDestino,
  ETIQUETA_ACCION,
} from '@oficina/motor';
import type { Accion } from '@oficina/motor';
import { crearFuenteLiveKit, leerDegradacion } from '@oficina/presencia';
import type { EstadoPropio, FuenteLiveKit } from '@oficina/presencia';
import type { Entrada } from './App';
import { enlaceDeSala, nombreDeSala, urlLiveKit } from './identidad';

declare global {
  interface Window {
    /** Para pruebas automáticas (e2e): estado propio, la fuente y atajos para mover al avatar. */
    __sala?: {
      id: string;
      yo: EstadoPropio;
      fuente: FuenteLiveKit;
      /** Como un clic al piso (`y`: la planta, si es otra); con `corriendo`, va corriendo. */
      ir: (x: number, z: number, y?: number, corriendo?: boolean) => void;
      /** Pulsa el salto una vez. */
      saltar: () => void;
      /** Punto de entrada, límites, escaleras y acciones del escenario (para elegir destinos en pruebas). */
      escenario: {
        entrada: { x: number; z: number; y: number } | undefined;
        limites: { x0: number; x1: number; z0: number; z1: number };
        escaleras: ReadonlyArray<{
          id: string;
          tramos: ReadonlyArray<{
            desde: { x: number; y: number; z: number };
            hasta: { x: number; y: number; z: number };
          }>;
        }>;
        acciones: ReadonlyArray<{
          id: string;
          tipo: string;
          x: number;
          z: number;
          y?: number;
          /** Solo asientos: el punto libre desde el que se sienta. */
          aproximacion?: { x: number; y: number; z: number };
        }>;
      };
    };
  }
}

const params = new URLSearchParams(window.location.search);
const DEPURAR = params.get('debug') === '1';
const MEDIR = params.get('medir') === '1';
const CALIDAD = (['alta', 'media', 'baja'] as const).find((c) => c === params.get('calidad'));

async function pedirToken(sala: string, identidad: string, nombre: string) {
  const q = new URLSearchParams({ sala, identidad, nombre });
  const res = await fetch(`/api/token?${q}`);
  const cuerpo = (await res.json()) as { token?: string; puerto?: number; error?: string };
  if (!res.ok || !cuerpo.token)
    throw new Error(cuerpo.error ?? 'No se pudo pedir el acceso a la sala.');
  return { token: cuerpo.token, puerto: cuerpo.puerto ?? 7880 };
}

const MENSAJES_CONEXION = {
  desconectado: 'Sin conexión',
  conectando: 'Conectando…',
  conectado: 'En vivo',
  reconectando: 'Reconectando…',
  suspendido: 'Pausada: pestaña oculta mucho tiempo',
} as const;

export function Sala({
  entrada,
  sala,
  escenario,
}: {
  entrada: Entrada;
  sala: string;
  escenario: string;
}) {
  const esc = useMemo(() => escenarioPorId(escenario), [escenario]);
  const entradaEsc = esc.entradas[0];
  const nombreSala = useMemo(() => nombreDeSala(sala), [sala]);

  // El token se pide al conectar y en cada reconexión; el puerto de LiveKit lo informa el servidor.
  const puerto = useRef(7880);
  const fuente = useMemo(
    () =>
      crearFuenteLiveKit({
        // Mismo equipo que la página; el puerto lo informa el servidor junto con el token.
        url: () => urlLiveKit(window.location, puerto.current),
        obtenerToken: async () => {
          const r = await pedirToken(nombreSala, entrada.id, entrada.nombre);
          puerto.current = r.puerto;
          return r.token;
        },
        yo: { id: entrada.id, nombre: entrada.nombre, atuendo: entrada.atuendo, escenario },
        medicion: MEDIR,
        parametros: { fuente: { desconexionMin: Number(params.get('ocultoMin') ?? 5) } },
        degradacion: leerDegradacion(params.get('red')) ?? undefined,
      }),
    [entrada, escenario, nombreSala],
  );

  useEffect(() => {
    fuente.conectar().catch((e: unknown) => console.warn('[sala] no se pudo conectar', e));
    return () => void fuente.desconectar();
  }, [fuente]);

  const foto = useSyncExternalStore(fuente.suscribirInstantanea, fuente.instantanea);

  const mando = useMemo(() => crearMando(), []);
  const yo = useRef<EstadoPropio>({
    x: 0,
    y: 0,
    z: 0,
    rumbo: 0,
    saltos: 0,
    estado: 'de-pie',
    asiento: null,
  });
  // Cada cuadro el motor entrega el estado del avatar: se guarda y se ofrece a la fuente, que decide si envía.
  const avatar = useMemo(() => {
    // Un pequeño desfase al aparecer evita que dos pestañas nazcan en el mismo punto.
    const desfase = () => (Math.random() - 0.5) * 1.6;
    return {
      id: entrada.id,
      nombre: entrada.nombre,
      atuendo: entrada.atuendo,
      x: (entradaEsc?.x ?? 0) + desfase(),
      z: (entradaEsc?.z ?? 0) + desfase(),
      mando,
      alCambiar: (e: Omit<EstadoPropio, 'saltos'> & { velocidad: number }) => {
        const p = yo.current;
        p.x = e.x;
        p.y = e.y;
        p.z = e.z;
        p.rumbo = e.rumbo;
        p.estado = e.estado;
        p.asiento = e.asiento;
        p.saltos = mando.saltos;
        fuente.publicarPropio(p);
      },
    };
  }, [entrada, entradaEsc, mando, fuente]);

  useEffect(() => {
    window.__sala = {
      id: entrada.id,
      yo: yo.current,
      fuente,
      ir: (x, z, y, corriendo = false) => fijarDestino(mando, x, z, corriendo, y),
      saltar: () => {
        mando.saltos++;
      },
      escenario: {
        entrada: entradaEsc,
        limites: esc.colision(entradaEsc?.y ?? 0).limites,
        escaleras: esc.planta.escaleras,
        acciones: accionesDe(esc).map((a) => ({
          id: a.id,
          tipo: a.tipo,
          x: a.x,
          z: a.z,
          y: a.y,
          aproximacion: a.tipo === 'sentarse' ? a.asiento.aproximacion : undefined,
        })),
      },
    };
  }, [entrada.id, fuente, mando, esc, entradaEsc]);

  const [accion, setAccion] = useState<Accion | null>(null);
  const alAccion = useCallback((a: Accion | null) => setAccion(a), []);

  const [ipLocal, setIpLocal] = useState<string>();
  useEffect(() => {
    fetch('/api/red')
      .then((r) => r.json() as Promise<{ ips: string[] }>)
      .then((r) => setIpLocal(r.ips[0]))
      .catch(() => undefined); // Sin la IP local, el enlace usa la dirección actual de la página.
  }, []);
  const enlace = enlaceDeSala(window.location, ipLocal, sala, escenario);

  const [errorMic, setErrorMic] = useState<string | null>(null);
  const alternarMicrofono = async () => {
    setErrorMic(null);
    try {
      if (!foto.microfono) {
        if (!window.isSecureContext || !navigator.mediaDevices) {
          throw new Error(
            'El micrófono necesita https o localhost: en esta dirección el navegador no lo permite.',
          );
        }
        await fuente.activarMicrofono();
      } else {
        await fuente.silenciarPropio(!foto.silenciadoPropio);
      }
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      setErrorMic(
        /Permission|NotAllowed/i.test(m)
          ? 'El navegador bloqueó el micrófono. Permítelo en el candado de la barra.'
          : m,
      );
    }
  };

  return (
    <div className="sala">
      <div className="sala-escena">
        <Oficina
          agentes={[]}
          departamentos={[]}
          escenario={escenario}
          fuentePresencia={fuente}
          avatarPropio={avatar}
          hablandoIds={fuente.hablandoIds}
          seguirAvatar
          {...(CALIDAD ? { calidad: CALIDAD } : {})}
          onAccionCercana={alAccion}
        />
      </div>

      <div className="sala-estado" data-conexion={foto.conexion}>
        <span className="punto" />
        {MENSAJES_CONEXION[foto.conexion]} · {foto.personas + 1}{' '}
        {foto.personas === 0 ? 'persona' : 'personas'}
        {foto.error && <span className="error"> · {foto.error}</span>}
      </div>

      <div className="sala-voz">
        <button
          type="button"
          className={`mic ${foto.microfono && !foto.silenciadoPropio ? 'activo' : ''}`}
          onClick={alternarMicrofono}
          disabled={foto.conexion !== 'conectado'}
          aria-pressed={foto.microfono && !foto.silenciadoPropio}
        >
          {!foto.microfono
            ? 'Activar micrófono'
            : foto.silenciadoPropio
              ? 'Micrófono silenciado'
              : 'Micrófono activo'}
        </button>
        {errorMic && (
          <p className="error" role="alert">
            {errorMic}
          </p>
        )}
        {foto.cercanos.length > 0 && (
          <ul className="cercanos" aria-label="Personas cerca de ti">
            {foto.cercanos.map((c) => (
              <li key={c.id} className={c.habla ? 'habla' : ''}>
                <span className="cerc-nombre">{c.nombre}</span>
                <span className="cerc-dato">
                  {c.silenciado
                    ? 'silenciado'
                    : c.oyendo
                      ? 'se oye'
                      : `${c.distancia.toFixed(1)} m`}
                </span>
                <button type="button" onClick={() => fuente.silenciar(c.id, !c.silenciado)}>
                  {c.silenciado ? 'Oír' : 'Silenciar'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="sala-enlace">
        <label>
          Enlace de la sala
          <input readOnly value={enlace} onFocus={(e) => e.currentTarget.select()} />
        </label>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(enlace).catch(() => undefined); // Sin permiso o sin https, queda seleccionable arriba.
          }}
        >
          Copiar
        </button>
      </div>

      {accion && (
        <div className="sala-aviso" role="status">
          <kbd>E</kbd> {ETIQUETA_ACCION[accion.tipo]} {accion.nombre}
        </div>
      )}
      <p className="sala-ayuda">
        <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> mover · <kbd>Shift</kbd> correr ·{' '}
        <kbd>Espacio</kbd> saltar · <kbd>E</kbd> sentarse
      </p>
      {DEPURAR && <Depuracion fuente={fuente} />}
    </div>
  );
}

function Depuracion({ fuente }: { fuente: FuenteLiveKit }) {
  const [m, setM] = useState(fuente.metricas());
  useEffect(() => {
    const t = setInterval(() => setM({ ...fuente.metricas(), envios: [], llegadas: [] }), 500);
    return () => clearInterval(t);
  }, [fuente]);
  return (
    <pre className="sala-depura">
      {`env ${m.paquetesEnviados}  rec ${m.paquetesRecibidos}  viejos ${m.paquetesViejos}  inválidos ${m.paquetesInvalidos}  errores ${m.erroresEnvio}`}
    </pre>
  );
}
