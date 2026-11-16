import { useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { Proyector, SalaGuardada } from '@oficina/motor';
import { Ancla } from '../Ancla';
import { atuendoInicial, ID_YO } from '../plantillas';
import { cambiar, categorias, deshacer, navegar, seleccionar, sorprender } from './estadoPersonaje';
import type { Historial } from './estadoPersonaje';
import type { ControlVestidor } from './Vestidor3D';
import { areaVestidor, etiquetaVestidor, PARAMETROS_VESTIDOR as P } from './encuadreVestidor';
import './personaje.css';
import { ColeccionesRopa } from './ColeccionesRopa';
import { claveMiniatura } from './cacheMiniaturas';
import { DesbloquearFundador } from './DesbloquearFundador';

export function Personaje({
  sala,
  alCambiar,
  alIr,
  control,
  proyector,
  posicion,
}: {
  sala: SalaGuardada;
  alCambiar: (s: SalaGuardada) => void;
  alIr: (p: 'nombre' | 'agentes') => void;
  control: MutableRefObject<ControlVestidor>;
  proyector: MutableRefObject<Proyector | null>;
  posicion: { x: number; y: number; z: number };
}) {
  const yo = sala.ocupantes.find((o) => o.id === ID_YO)!;
  const [historial, setHistorial] = useState<Historial>({
    actual: yo.atuendo ?? atuendoInicial(3),
    anterior: null,
  });
  const [categoria, setCategoria] = useState(control.current.categoria);
  const [imagenes, setImagenes] = useState<Record<string, string>>({});
  const [anuncio, setAnuncio] = useState('');
  const semilla = useRef(0);
  const cursorOpcion = useRef(0);
  const arrastre = useRef<number | null>(null);
  const panel = useRef<HTMLElement>(null);
  const a = yo.atuendo ?? historial.actual;
  const cat = categorias[categoria]!;
  const guardar = (h: Historial) => {
    setHistorial(h);
    alCambiar({
      ...sala,
      ocupantes: sala.ocupantes.map((o) => (o.id === ID_YO ? { ...o, atuendo: h.actual } : o)),
    });
  };
  const elegir = (i: number) => {
    const o = cat.opciones[i]!;
    cursorOpcion.current = i;
    guardar(cambiar(historial, seleccionar(a, cat, o.id)));
    setAnuncio(`${cat.nombre}: ${o.nombre}`);
  };
  const cambiarCategoria = (i: number) => {
    setCategoria(i);
    control.current.categoria = i;
    cursorOpcion.current = 0;
  };
  const activo = (id: string) =>
    cat.id === 'acc' ? (id ? a.acc.includes(id) : !a.acc.length) : a[cat.id] === id;
  const opciones = useRef({ a, categoria, elegir, cambiarCategoria, alIr });
  opciones.current = { a, categoria, elegir, cambiarCategoria, alIr };
  useEffect(() => {
    panel.current?.focus();
    const teclado = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.target instanceof Element && e.target.closest('[data-teclado-propio]')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const v = opciones.current;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        v.alIr('nombre');
        return;
      }
      if (e.key === 'Enter') {
        if (e.isComposing || e.repeat) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        v.alIr('agentes');
        return;
      }
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const c = categorias[v.categoria]!;
      const actual =
        c.id === 'acc' ? cursorOpcion.current : c.opciones.findIndex((o) => o.id === v.a[c.id]);
      const cursor = navegar({ categoria: v.categoria, opcion: Math.max(0, actual) }, e.key);
      if (cursor.categoria !== v.categoria) {
        v.cambiarCategoria(cursor.categoria);
        requestAnimationFrame(() =>
          panel.current
            ?.querySelector('[role="tab"][aria-selected="true"]')
            ?.scrollIntoView({ block: 'nearest', inline: 'nearest' }),
        );
      } else v.elegir(cursor.opcion);
    };
    window.addEventListener('keydown', teclado, true);
    let firma = '';
    const id = window.setInterval(() => {
      const nueva = Object.keys(control.current.miniaturas).join('|');
      if (nueva !== firma) {
        firma = nueva;
        setImagenes({ ...control.current.miniaturas });
      }
    }, P.actualizarMiniaturasMs);
    return () => {
      window.removeEventListener('keydown', teclado, true);
      clearInterval(id);
      control.current.arrastrando = false;
      control.current.giro = 0;
    };
  }, [control]);
  const [area, setArea] = useState(() => areaVestidor(innerWidth, innerHeight));
  useEffect(() => {
    const actualizar = () => setArea(areaVestidor(innerWidth, innerHeight));
    window.addEventListener('resize', actualizar);
    return () => window.removeEventListener('resize', actualizar);
  }, []);
  return (
    <div className="pv">
      <div
        className="pv-girar"
        aria-label="Arrastra para girar tu personaje"
        style={{ left: area.x, top: area.y, width: area.ancho, height: area.alto }}
        onPointerDown={(e) => {
          arrastre.current = e.clientX;
          control.current.arrastrando = true;
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (arrastre.current === null) return;
          control.current.giro += (e.clientX - arrastre.current) * P.sensibilidadGiro;
          arrastre.current = e.clientX;
        }}
        onPointerUp={() => {
          arrastre.current = null;
          control.current.arrastrando = false;
        }}
        onPointerCancel={() => {
          arrastre.current = null;
          control.current.arrastrando = false;
        }}
      >
        <span className="pv-giro-pista">↔ Arrastra para girar</span>
      </div>
      <Ancla
        proyector={proyector}
        objetivo={() => etiquetaVestidor(control.current.cabeza, posicion, a.acc.includes('gorro'))}
      >
        <span className="pv-nombre">{yo.nombre}</span>
      </Ancla>
      <section ref={panel} tabIndex={-1} className="pv-panel" aria-label="Tu personaje">
        <header className="pv-cabecera">
          <div>
            <p>Tu personaje</p>
            <h2>Así eres tú.</h2>
          </div>
          <span className="pv-cuenta">
            {categoria + 1} / {categorias.length}
          </span>
        </header>
        <div className="pv-categorias" role="tablist" aria-label="Personalizar personaje">
          {categorias.map((c, i) => (
            <button
              key={c.id}
              role="tab"
              aria-selected={categoria === i}
              aria-controls="pv-opciones"
              id={`pv-tab-${c.id}`}
              tabIndex={categoria === i ? 0 : -1}
              onClick={() => cambiarCategoria(i)}
            >
              {c.nombre}
            </button>
          ))}
        </div>
        <div className="pv-eleccion">
          <h3>{cat.nombre}</h3>
          <span>{cat.opciones.find((o) => activo(o.id))?.nombre}</span>
        </div>
        <div
          id="pv-opciones"
          role="tabpanel"
          aria-labelledby={`pv-tab-${cat.id}`}
          className="pv-opciones"
        >
          <ColeccionesRopa
            atuendo={a}
            imagenes={imagenes}
            control={control}
            alElegir={(a) => guardar(cambiar(historial, a))}
          />
          <div
            role="group"
            aria-label={cat.nombre}
            className={`pv-rejilla${cat.color ? ' pv-rejilla--colores' : ''}`}
          >
            {cat.opciones.map((o, i) => {
              const imagen = imagenes[claveMiniatura(cat, o.id, a)];
              return (
                <button
                  key={o.id}
                  className="pv-opcion"
                  aria-label={o.nombre}
                  aria-pressed={activo(o.id)}
                  title={o.nombre}
                  onClick={() => elegir(i)}
                >
                  {cat.color ? (
                    <span className="pv-color" style={{ backgroundColor: o.id }} />
                  ) : imagen ? (
                    <img src={imagen} alt="" />
                  ) : (
                    <span className="pv-preparando" aria-hidden="true">
                      …
                    </span>
                  )}
                  {activo(o.id) && (
                    <span className="pv-elegida" aria-hidden="true">
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <DesbloquearFundador
            alDesbloquear={() => {
              control.current.fundadorDesbloqueado = true;
            }}
            imagen={imagenes[`fundador:${JSON.stringify(a)}`]}
            atuendo={a}
            alElegir={(a) => guardar(cambiar(historial, a))}
          />
        </div>
        <div className="pv-acciones">
          <button
            className="cr-boton"
            onClick={() => {
              guardar(cambiar(historial, sorprender(a, ++semilla.current)));
              setAnuncio('Un nuevo look para ti');
            }}
          >
            Sorpréndeme <span aria-hidden="true">⤨</span>
          </button>
          <button
            className="cr-boton"
            disabled={!historial.anterior}
            onClick={() => {
              guardar(deshacer(historial));
              setAnuncio('Cambio deshecho');
            }}
          >
            Deshacer
          </button>
        </div>
        <footer className="pv-pie">
          <button
            className="pv-volver"
            onClick={() => alIr('nombre')}
            aria-label="Volver al nombre"
          >
            ←
          </button>
          <button className="cr-boton cr-boton--prim" onClick={() => alIr('agentes')}>
            Este soy yo <span aria-hidden="true">↵</span>
          </button>
        </footer>
        <p className="pv-teclado">← → opciones · ↑ ↓ categorías · Enter seguir</p>
        <span className="pv-sr" role="status">
          {anuncio}
        </span>
      </section>
    </div>
  );
}
