import { useEffect, useRef, useState } from 'react';
import { comandoPuente, salud } from './cliente';
import { iniciarDictado } from './dictado';
import { LIMITES } from './modelo';
import type { FotoPizarra } from './mensajes';
import './pizarra.css';
export interface PanelProps {
  anfitrion: boolean;
  foto: FotoPizarra;
  lienzo: HTMLCanvasElement;
  aviso: string;
  mirando: boolean;
  alMirar: (valor: boolean) => void;
  indice: number;
  total: number;
  expandida: boolean;
  alExpandir: (valor: boolean) => void;
  alColocar: () => void;
  alIdea: (
    idea: string,
    intencion: 'explicar' | 'investigar',
    ampliar: boolean,
    codigo: string,
    manual: boolean,
  ) => Promise<void>;
  alMover: (delta: number) => void;
  alBorrar: () => void;
}
function Vista({ lienzo, grande = false }: { lienzo: HTMLCanvasElement; grande?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const pintar = () => ref.current?.getContext('2d')?.drawImage(lienzo, 0, 0);
    lienzo.addEventListener('d8:dibujo', pintar);
    pintar();
    return () => lienzo.removeEventListener('d8:dibujo', pintar);
  }, [lienzo]);
  return (
    <canvas
      className={grande ? 'd8-lamina d8-lamina--grande' : 'd8-lamina'}
      ref={ref}
      width={1920}
      height={1080}
      aria-label="Contenido de la pizarra"
    />
  );
}
export function PanelPizarra(p: PanelProps) {
  const [abierto, setAbierto] = useState(false),
    [idea, setIdea] = useState('');
  const [codigo, setCodigo] = useState(() => sessionStorage.getItem('d8:codigo') ?? '');
  const [conexion, setConexion] = useState<'sin' | 'conectando' | 'real' | 'simulada'>('sin');
  const [configuracion, setConfiguracion] = useState(true);
  const [zoom, setZoom] = useState(false);
  const [aviso, setAviso] = useState(''),
    [intencion, setIntencion] = useState<'explicar' | 'investigar'>('explicar');
  const [ampliacion, setAmpliacion] = useState(false),
    [escuchando, setEscuchando] = useState(false),
    [parcial, setParcial] = useState('');
  const voz = useRef<ReturnType<typeof iniciarDictado>>(null);
  const ocupado = p.foto.estado === 'pensando';
  const reciente = useRef({ p, intencion, ampliacion, codigo, conexion, ocupado });
  reciente.current = { p, intencion, ampliacion, codigo, conexion, ocupado };
  const conectar = async () => {
    setConexion('conectando');
    setAviso('');
    try {
      const r = await salud(codigo);
      sessionStorage.setItem('d8:codigo', codigo);
      setConexion(r.simulada ? 'simulada' : 'real');
      setConfiguracion(false);
    } catch (e) {
      setConexion('sin');
      setAviso(
        e instanceof TypeError
          ? 'No encuentro el puente. Enciéndelo con el comando de abajo y pega su código.'
          : e instanceof Error
            ? e.message
            : 'No pude conectar.',
      );
    }
  };
  const enviar = (texto: string, manual = false) => {
    const r = reciente.current;
    if (!texto.trim() || r.ocupado) return;
    void r.p.alIdea(
      texto.trim(),
      r.intencion,
      r.ampliacion,
      r.codigo,
      manual || r.conexion === 'sin',
    );
    setIdea(texto);
    setParcial('');
  };
  const dictar = () => {
    if (voz.current) {
      voz.current.parar();
      return;
    }
    if (reciente.current.ocupado) return;
    setAbierto(true);
    setAviso('');
    setParcial('');
    setEscuchando(true);
    voz.current = iniciarDictado(
      setParcial,
      (texto) => {
        voz.current = null;
        setEscuchando(false);
        if (texto) enviar(texto);
      },
      (texto) => {
        setAviso(texto);
        setEscuchando(false);
      },
    );
    if (!voz.current) setEscuchando(false);
  };
  const dictarRef = useRef(dictar);
  dictarRef.current = dictar;
  useEffect(() => {
    if (!p.anfitrion) return;
    const editable = (target: EventTarget | null) =>
      target instanceof HTMLElement && !!target.closest('input,textarea,[contenteditable="true"]');
    const bajar = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() !== 'v' ||
        e.repeat ||
        editable(e.target) ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey
      )
        return;
      e.preventDefault();
      dictarRef.current();
    };
    const subir = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'v') voz.current?.parar();
    };
    const salir = () => voz.current?.parar();
    window.addEventListener('keydown', bajar);
    window.addEventListener('keyup', subir);
    window.addEventListener('blur', salir);
    return () => {
      window.removeEventListener('keydown', bajar);
      window.removeEventListener('keyup', subir);
      window.removeEventListener('blur', salir);
      voz.current?.cancelar();
    };
  }, [p.anfitrion]);
  useEffect(() => {
    if (!p.expandida) return;
    const salir = (e: KeyboardEvent) => {
      if (e.key === 'Escape') p.alExpandir(false);
    };
    window.addEventListener('keydown', salir);
    return () => window.removeEventListener('keydown', salir);
  }, [p.expandida, p.alExpandir]);
  if (!p.anfitrion && !p.foto.posicion) return null;
  return (
    <>
      <div className={p.mirando ? 'd8-controles d8-controles--mirando' : 'd8-controles'}>
        <button
          className="cr-boton d8-abrir"
          aria-expanded={abierto}
          onClick={() => (p.anfitrion ? setAbierto(!abierto) : p.alExpandir(true))}
        >
          {p.anfitrion ? 'Pizarra' : 'Ver pizarra'} <span aria-hidden>↗</span>
        </button>
        {p.foto.posicion && (
          <button
            className="cr-boton d8-mirar"
            onClick={() => {
              p.alMirar(!p.mirando);
              setAbierto(false);
            }}
          >
            {p.mirando ? 'Volver a caminar' : 'Mirar en el mundo'}
          </button>
        )}
        {abierto && p.anfitrion && (
          <section
            className="d8-panel"
            aria-label="Pizarra del anfitrión"
            onKeyDown={(e) => {
              if (e.key === 'Escape') setAbierto(false);
              if (e.target instanceof HTMLElement && e.target.closest('input,textarea')) return;
              if (e.key === 'ArrowLeft') {
                e.preventDefault();
                p.alMover(-1);
              }
              if (e.key === 'ArrowRight') {
                e.preventDefault();
                p.alMover(1);
              }
            }}
          >
            <header>
              <div>
                <h2>Explica con una imagen</h2>
                <p>Tu idea, visible para todos.</p>
              </div>
              <button
                className="d8-icono"
                aria-label="Cerrar panel de pizarra"
                onClick={() => setAbierto(false)}
              >
                ×
              </button>
            </header>
            <div className="d8-fila">
              <button className="cr-boton" onClick={p.alColocar}>
                Poner pizarra aquí
              </button>
              <button className="d8-enlace" onClick={() => p.alExpandir(true)}>
                Ver grande
              </button>
            </div>
            <Vista lienzo={p.lienzo} />
            <div className="d8-intenciones" aria-label="Intención">
              <button
                aria-pressed={intencion === 'explicar'}
                onClick={() => setIntencion('explicar')}
              >
                Explicar
              </button>
              <button
                aria-pressed={intencion === 'investigar'}
                onClick={() => setIntencion('investigar')}
              >
                Investigar <small>con fuentes</small>
              </button>
            </div>
            <label className="d8-etiqueta" htmlFor="d8-idea">
              ¿Qué quieres explicar?
            </label>
            <textarea
              id="d8-idea"
              value={idea}
              maxLength={LIMITES.idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="Por ejemplo: cómo se conecta una idea con otra…"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  enviar(idea);
                }
              }}
            />
            {escuchando && (
              <p className="d8-subtitulo" aria-live="polite">
                {parcial || 'Te escucho… suelta V o pulsa Terminar.'}
              </p>
            )}
            <div className="d8-fila">
              <button
                className="cr-boton"
                aria-pressed={ampliacion}
                disabled={!p.foto.pizarra}
                onClick={() => setAmpliacion(!ampliacion)}
              >
                Ampliar {ampliacion ? '✓' : ''}
              </button>
              <button className="cr-boton" onClick={dictar} disabled={ocupado}>
                {escuchando ? 'Terminar' : 'Dictar · V'}
              </button>
              <button
                className="cr-boton cr-boton--prim"
                disabled={ocupado || !idea.trim()}
                onClick={() => enviar(idea)}
              >
                {ocupado ? 'Pensando…' : conexion === 'sin' ? 'Mostrar texto' : 'Mostrar'}
              </button>
            </div>
            <div className="d8-fila d8-historial">
              <button
                className="d8-icono"
                aria-label="Pizarra anterior"
                disabled={p.indice <= 0 || ocupado}
                onClick={() => p.alMover(-1)}
              >
                ←
              </button>
              <span>{p.total ? `${p.indice + 1} de ${p.total}` : 'Tu primera pizarra'}</span>
              <button
                className="d8-icono"
                aria-label="Pizarra siguiente"
                disabled={p.indice >= p.total - 1 || ocupado}
                onClick={() => p.alMover(1)}
              >
                →
              </button>
              <button className="d8-enlace" disabled={ocupado} onClick={p.alBorrar}>
                Borrar
              </button>
            </div>
            <div className="d8-puente">
              <button
                className="d8-configuracion"
                aria-expanded={configuracion}
                onClick={() => setConfiguracion(!configuracion)}
              >
                {conexion === 'real'
                  ? 'Puente conectado · Claude'
                  : conexion === 'simulada'
                    ? 'Modo simulado · ejemplos de demostración'
                    : 'Conectar tu puente local'}
              </button>
              {configuracion && (
                <>
                  <p>En tu terminal, desde el proyecto:</p>
                  <code>{comandoPuente(location.origin)}</code>
                  <label className="d8-etiqueta" htmlFor="d8-codigo">
                    Código que muestra la terminal
                  </label>
                  <div className="d8-fila">
                    <input
                      id="d8-codigo"
                      type="password"
                      autoComplete="off"
                      value={codigo}
                      onChange={(e) => setCodigo(e.target.value)}
                    />
                    <button
                      className="cr-boton"
                      disabled={!codigo || conexion === 'conectando'}
                      onClick={() => void conectar()}
                    >
                      {conexion === 'conectando' ? 'Conectando…' : 'Conectar'}
                    </button>
                  </div>
                  <p>Sin puente, puedes escribir y mostrar la idea a mano.</p>
                </>
              )}
            </div>
            {(aviso || p.aviso) && (
              <p className="d8-aviso" role="status">
                {aviso || p.aviso}
              </p>
            )}
            {idea && conexion !== 'sin' && (
              <button className="d8-enlace" onClick={() => enviar(idea, true)}>
                Mostrar a mano
              </button>
            )}
          </section>
        )}
      </div>
      {p.expandida && (
        <div className="d8-grande" role="dialog" aria-modal="true" aria-label="Pizarra ampliada">
          <header>
            <span>{p.foto.pizarra?.titulo ?? 'Pizarra compartida'}</span>
            <button autoFocus className="cr-boton" onClick={() => p.alExpandir(false)}>
              Volver al mundo · Esc
            </button>
          </header>
          <button className="cr-boton d8-zoom" aria-pressed={zoom} onClick={() => setZoom(!zoom)}>
            {zoom ? 'Ver completa' : 'Acercar para leer'}
          </button>
          <div className={zoom ? 'd8-visor d8-visor--zoom' : 'd8-visor'}>
            <Vista lienzo={p.lienzo} grande />
          </div>
          <p>{p.foto.pizarra?.ejemplo}</p>
        </div>
      )}
    </>
  );
}
