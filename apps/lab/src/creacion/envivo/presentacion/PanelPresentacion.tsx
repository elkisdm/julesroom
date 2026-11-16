import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { prepararImagen, validarArchivos } from './imagenes';
import { PARAMETROS_PRESENTACION as P } from './protocolo';
import type { PresentacionSincronizada } from './sincronizacion';
import type { Lamina, PosicionPantalla } from './protocolo';
interface Props {
  control: PresentacionSincronizada;
  anfitrion: boolean;
  poner: () => void;
  mover: (dx: number, dz: number, giro: number) => void;
  ver: () => void;
  volver: () => void;
  viendo: boolean;
  lienzo: HTMLCanvasElement | null;
  errorEscena: string;
}
export function PanelPresentacion({
  control,
  anfitrion,
  poner,
  mover,
  ver,
  volver,
  viendo,
  lienzo,
  errorEscena,
}: Props) {
  const foto = useSyncExternalStore(control.suscribir, control.ver);
  const { estado } = foto;
  const [abierto, setAbierto] = useState(false);
  const [visor, setVisor] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [titulo, setTitulo] = useState('');
  const [cuerpo, setCuerpo] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState('');
  const entrada = useRef<HTMLInputElement>(null);
  const canvas2D = useRef<HTMLCanvasElement>(null);
  const dialogo = useRef<HTMLDivElement>(null);
  const avanzar = (delta: number) =>
    control.publicar({
      actual: Math.max(0, Math.min(estado.laminas.length - 1, estado.actual + delta)),
    });
  const ejecutar = (fn: () => void) => {
    try {
      fn();
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo actualizar la presentación.');
    }
  };
  const cargar = async (archivos: File[]) => {
    if (cargando || !anfitrion) return;
    try {
      validarArchivos(archivos, estado.laminas.length);
      const nuevas: Lamina[] = [];
      const imagenes = new Map(foto.imagenes);
      for (const [i, archivo] of archivos.entries()) {
        setCargando(`Preparando ${i + 1} / ${archivos.length}…`);
        const datos = await prepararImagen(archivo);
        const id = crypto.randomUUID();
        imagenes.set(id, datos);
        nuevas.push({ id, tipo: 'imagen', nombre: archivo.name.slice(0, 120) });
      }
      control.publicar({ laminas: [...estado.laminas, ...nuevas] }, imagenes);
      setError('');
    } catch (e) {
      console.warn('[presentacion] importación rechazada', e);
      setError(e instanceof Error ? e.message : 'No se pudieron preparar las imágenes.');
    } finally {
      setCargando('');
      if (entrada.current) entrada.current.value = '';
    }
  };
  useEffect(() => {
    if (!visor) return;
    const anterior = document.activeElement as HTMLElement | null;
    dialogo.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => anterior?.focus();
  }, [visor]);
  useEffect(() => {
    const c = canvas2D.current;
    if (c && lienzo) {
      c.width = lienzo.width;
      c.height = lienzo.height;
      c.getContext('2d')?.drawImage(lienzo, 0, 0);
    }
  }, [visor, lienzo]);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        setVisor(false);
        setAbierto(false);
        volver();
        return;
      }
      const t = e.target as HTMLElement | null;
      if (
        t?.closest('input,textarea,[contenteditable="true"]') ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey
      )
        return;
      if (anfitrion && estado.laminas.length && ['ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!e.repeat && e.type === 'keydown') avanzar(e.code === 'ArrowRight' ? 1 : -1);
      }
    };
    window.addEventListener('keydown', tecla, true);
    window.addEventListener('keyup', tecla, true);
    return () => {
      window.removeEventListener('keydown', tecla, true);
      window.removeEventListener('keyup', tecla, true);
    };
  }, [anfitrion, estado, volver]);
  const texto = () => {
    if (!titulo.trim()) throw new Error('Escribe un título para la lámina.');
    const lineas = cuerpo.split('\n').filter((l) => l.trim());
    if (lineas.length > 5 || lineas.some((l) => l.length > 100))
      throw new Error('Usa hasta 5 líneas de 100 caracteres.');
    const laminas = [
      ...estado.laminas,
      { id: crypto.randomUUID(), tipo: 'texto' as const, titulo: titulo.trim(), lineas },
    ];
    control.publicar({ laminas, actual: laminas.length - 1 });
    setTitulo('');
    setCuerpo('');
  };
  const botonesMover: [string, number, number, number][] = [
    ['Mover a la izquierda', -P.pasoMover, 0, 0],
    ['Mover al fondo', 0, -P.pasoMover, 0],
    ['Mover al frente', 0, P.pasoMover, 0],
    ['Mover a la derecha', P.pasoMover, 0, 0],
    ['Girar a la izquierda', 0, 0, -P.pasoGiro],
    ['Girar a la derecha', 0, 0, P.pasoGiro],
  ];
  const p: PosicionPantalla | null = estado.pantalla;
  if (!anfitrion && !p) return null;
  return (
    <div className="d3-ui" data-viendo={viendo}>
      <div className="d3-barra">
        {anfitrion && (
          <button
            className="cr-boton cr-boton--chico"
            aria-expanded={abierto}
            onClick={() => setAbierto(!abierto)}
          >
            Presentar
          </button>
        )}
        {p && (
          <button className="cr-boton cr-boton--chico" onClick={viendo ? volver : ver}>
            {viendo ? 'Volver · Esc' : 'Ver pantalla'}
          </button>
        )}
        {p && (
          <button className="cr-boton cr-boton--chico" onClick={() => setVisor(true)}>
            Visor 2D
          </button>
        )}
      </div>
      {anfitrion && abierto && (
        <section
          className="d3-panel"
          aria-label="Presentación del anfitrión"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void cargar(Array.from(e.dataTransfer.files));
          }}
        >
          <header>
            <h2>Tu presentación</h2>
            <button
              className="cr-boton cr-boton--chico"
              aria-label="Cerrar presentación"
              onClick={() => setAbierto(false)}
            >
              ×
            </button>
          </header>
          <button className="cr-boton cr-boton--prim" onClick={poner}>
            Poner pantalla aquí
          </button>
          {p && (
            <>
              <div className="d3-mover">
                {botonesMover.map(([nombre, dx, dz, giro], i) => (
                  <button
                    key={nombre}
                    className="cr-boton cr-boton--chico"
                    aria-label={nombre}
                    title={nombre}
                    onClick={() => mover(dx, dz, giro)}
                  >
                    {['←', '↑', '↓', '→', '↶', '↷'][i]}
                  </button>
                ))}
              </div>
              <button
                className="cr-boton cr-boton--chico"
                onClick={() => ejecutar(() => control.publicar({ pantalla: null }))}
              >
                Quitar pantalla
              </button>
            </>
          )}
          <div className="d3-importar">
            <input
              hidden
              ref={entrada}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => void cargar(Array.from(e.target.files ?? []))}
            />
            <button
              className="cr-boton"
              disabled={!!cargando || estado.laminas.length >= P.maxLaminas}
              onClick={() => entrada.current?.click()}
            >
              {cargando || 'Elegir imágenes'}
            </button>
            <p>O arrástralas aquí. PNG, JPG o WebP · hasta {P.maxLaminas} láminas.</p>
          </div>
          {!!estado.laminas.length && (
            <nav className="d3-navegar" aria-label="Cambiar lámina">
              <button
                className="cr-boton"
                aria-label="Lámina anterior"
                disabled={!estado.actual}
                onClick={() => ejecutar(() => avanzar(-1))}
              >
                ←
              </button>
              <output aria-live="polite">
                {estado.actual + 1} / {estado.laminas.length}
              </output>
              <button
                className="cr-boton"
                aria-label="Lámina siguiente"
                disabled={estado.actual === estado.laminas.length - 1}
                onClick={() => ejecutar(() => avanzar(1))}
              >
                →
              </button>
            </nav>
          )}
          <details className="d3-texto">
            <summary>Crear lámina de texto</summary>
            <label htmlFor="d3-titulo">Título</label>
            <input
              id="d3-titulo"
              maxLength={90}
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
            />
            <label htmlFor="d3-lineas">Hasta 5 líneas</label>
            <textarea
              id="d3-lineas"
              rows={5}
              maxLength={504}
              value={cuerpo}
              onChange={(e) => setCuerpo(e.target.value)}
            />
            <button
              className="cr-boton"
              disabled={estado.laminas.length >= P.maxLaminas}
              onClick={() => ejecutar(texto)}
            >
              Mostrar texto
            </button>
          </details>
          <p className="d3-ayuda">
            ← → cambia de lámina. Mantén P y apunta sobre la pantalla para usar el láser.
          </p>
          <p aria-live="polite">
            {foto.imagenes.size > 0 ? `${foto.imagenes.size} imágenes preparadas` : ''}
          </p>
          {(error || errorEscena || foto.error) && (
            <p role="alert" className="d3-error">
              {error || errorEscena || foto.error}
            </p>
          )}
        </section>
      )}
      {visor && (
        <div
          ref={dialogo}
          className="d3-visor"
          role="dialog"
          aria-modal="true"
          aria-label="Lámina actual"
          onKeyDown={(e) => {
            if (e.key === 'Tab') {
              const botones = Array.from(
                dialogo.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [],
              );
              const i = botones.indexOf(document.activeElement as HTMLButtonElement);
              e.preventDefault();
              botones[(i + (e.shiftKey ? -1 : 1) + botones.length) % botones.length]?.focus();
            }
          }}
        >
          <div className="d3-visor-controles">
            <button className="cr-boton" onClick={() => setVisor(false)}>
              Volver al mundo · Esc
            </button>
            <button
              className="cr-boton"
              disabled={zoom >= 3}
              onClick={() => setZoom(Math.min(3, zoom + 0.5))}
            >
              Ampliar +
            </button>
            <button
              className="cr-boton"
              disabled={zoom <= 1}
              onClick={() => setZoom(Math.max(1, zoom - 0.5))}
            >
              Reducir −
            </button>
          </div>
          <div className="d3-visor-lamina">
            <canvas
              style={{
                width: `${zoom * 100}%`,
                maxWidth: zoom === 1 ? '100%' : 'none',
                maxHeight: zoom === 1 ? 'calc(100dvh - 160px)' : 'none',
              }}
              ref={canvas2D}
              aria-label={`Lámina ${estado.actual + 1} de ${estado.laminas.length}`}
            />
          </div>
        </div>
      )}
    </div>
  );
}
