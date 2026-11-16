import { useEffect, useId, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { Icono } from './iconos';
import type { NombreIcono } from './iconos';
import { indicePorTecla } from './interaccion';

export const clases = (...valores: (string | false | undefined)[]) =>
  valores.filter(Boolean).join(' ');

export function Cargando({ etiqueta = 'Cargando' }: { etiqueta?: string }) {
  return (
    <span className="jr-cargando" role="status" aria-label={etiqueta}>
      <span />
    </span>
  );
}

export function Boton({
  jerarquia = 'secundario',
  cargando,
  icono,
  children,
  className,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  jerarquia?: 'primario' | 'secundario' | 'terciario';
  cargando?: boolean;
  icono?: NombreIcono;
}) {
  return (
    <button
      type="button"
      {...props}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      className={clases('jr-boton', `jr-boton--${jerarquia}`, className)}
    >
      <span className="jr-boton-contenido" data-cargando={cargando}>
        {icono && <Icono nombre={icono} />}
        {children}
      </span>
      {cargando && <Cargando etiqueta="Procesando" />}
    </button>
  );
}

export function BotonIcono({
  nombre,
  icono,
  activo,
  cargando,
  disabled,
  className,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  nombre: string;
  icono: NombreIcono;
  activo?: boolean;
  cargando?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={nombre}
      title={nombre}
      aria-pressed={activo}
      {...props}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      className={clases('jr-boton-icono', className)}
    >
      {cargando ? <Cargando etiqueta="Procesando" /> : <Icono nombre={icono} activo={activo} />}
    </button>
  );
}

export function Loseta({
  nombre,
  icono,
  activo,
  atajo,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  nombre: string;
  icono: NombreIcono;
  activo: boolean;
  atajo: string;
}) {
  return (
    <button
      type="button"
      {...props}
      className="jr-loseta"
      aria-label={nombre}
      aria-pressed={activo}
      aria-keyshortcuts={atajo}
      title={`${nombre} · ${atajo}`}
    >
      <Icono nombre={icono} activo={activo} />
      <span className="jr-loseta-nombre">
        {{
          Moverse: 'Mover',
          Construir: 'Crear',
          Personas: 'Gente',
          Conversación: 'Chat',
          Presentar: 'Mostrar',
        }[nombre] ?? nombre}
      </span>
      <span className="jr-tooltip" aria-hidden="true">
        {nombre}
        <kbd>{atajo}</kbd>
      </span>
    </button>
  );
}

export function Conmutador({
  etiqueta,
  descripcion,
  activo,
  alCambiar,
  deshabilitado = false,
}: {
  etiqueta: string;
  descripcion?: string;
  activo: boolean;
  alCambiar: (v: boolean) => void;
  deshabilitado?: boolean;
}) {
  const id = useId();
  return (
    <div className="jr-conmutador-fila">
      <span id={id}>
        {etiqueta}
        {descripcion && <small>{descripcion}</small>}
      </span>
      <button
        className="jr-conmutador"
        type="button"
        role="switch"
        aria-labelledby={id}
        aria-checked={activo}
        disabled={deshabilitado}
        onClick={() => alCambiar(!activo)}
      >
        <span />
      </button>
    </div>
  );
}

export interface Opcion {
  valor: string;
  etiqueta: string;
  icono?: NombreIcono;
}

export function Segmentado({
  etiqueta,
  opciones,
  valor,
  alCambiar,
  tipo = 'segmentado',
  idPanel,
  deshabilitado = false,
}: {
  etiqueta: string;
  opciones: readonly Opcion[];
  valor: string;
  alCambiar: (v: string) => void;
  tipo?: 'segmentado' | 'pestanas';
  idPanel?: string;
  deshabilitado?: boolean;
}) {
  const grupo = useRef<HTMLDivElement>(null);
  const tabs = tipo === 'pestanas';
  return (
    <div
      ref={grupo}
      className={clases('jr-segmentado', tabs && 'jr-pestanas')}
      role={tabs ? 'tablist' : 'radiogroup'}
      aria-label={etiqueta}
      onKeyDown={(e) => {
        const i = indicePorTecla(
          e.key,
          opciones.findIndex((o) => o.valor === valor),
          opciones.length,
        );
        if (i === null) return;
        e.preventDefault();
        e.stopPropagation();
        alCambiar(opciones[i]!.valor);
        grupo.current?.querySelectorAll<HTMLButtonElement>('button')[i]?.focus();
      }}
    >
      {opciones.map((o) => (
        <button
          type="button"
          disabled={deshabilitado}
          key={o.valor}
          id={idPanel ? `${idPanel}-${o.valor}` : undefined}
          role={tabs ? 'tab' : 'radio'}
          aria-controls={tabs ? idPanel : undefined}
          aria-selected={tabs ? valor === o.valor : undefined}
          aria-checked={!tabs ? valor === o.valor : undefined}
          tabIndex={valor === o.valor ? 0 : -1}
          onClick={() => alCambiar(o.valor)}
        >
          {o.icono && <Icono nombre={o.icono} />}
          {o.etiqueta}
        </button>
      ))}
    </div>
  );
}

export function Campo({
  etiqueta,
  ayuda,
  error,
  icono,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  etiqueta: string;
  ayuda?: string;
  error?: string;
  icono?: NombreIcono;
}) {
  const id = useId();
  return (
    <label className="jr-campo" htmlFor={id}>
      <span>{etiqueta}</span>
      <span className="jr-campo-interior">
        {icono && <Icono nombre={icono} />}
        <input
          {...props}
          id={id}
          aria-invalid={Boolean(error)}
          aria-describedby={ayuda || error ? `${id}-ayuda` : undefined}
        />
      </span>
      {(ayuda || error) && (
        <small id={`${id}-ayuda`} role={error ? 'alert' : undefined}>
          {error && <span aria-hidden="true">! </span>}
          {error || ayuda}
        </small>
      )}
    </label>
  );
}

export function Selector({
  etiqueta,
  opciones,
  valor,
  alCambiar,
  deshabilitado = false,
}: {
  etiqueta: string;
  opciones: readonly Opcion[];
  valor: string;
  alCambiar: (v: string) => void;
  deshabilitado?: boolean;
}) {
  const id = useId();
  const [abierto, abrir] = useState(false);
  const [indice, resaltar] = useState(0);
  const raiz = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const elegida = opciones.find((o) => o.valor === valor);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) abrir(false);
    };
    document.addEventListener('pointerdown', fuera);
    return () => document.removeEventListener('pointerdown', fuera);
  }, [abierto]);
  useEffect(() => {
    if (abierto)
      raiz.current?.querySelector('[data-resaltado="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [indice, abierto]);
  const elegir = (i: number) => {
    const o = opciones[i];
    if (o) alCambiar(o.valor);
    abrir(false);
    boton.current?.focus();
  };
  return (
    <div className="jr-selector" ref={raiz}>
      <span id={`${id}-etiqueta`} className="jr-etiqueta">
        {etiqueta}
      </span>
      <button
        type="button"
        ref={boton}
        role="combobox"
        aria-labelledby={`${id}-etiqueta ${id}-valor`}
        aria-expanded={abierto}
        aria-controls={`${id}-lista`}
        aria-haspopup="listbox"
        aria-activedescendant={abierto ? `${id}-${indice}` : undefined}
        disabled={deshabilitado || !opciones.length}
        onClick={() => {
          resaltar(
            Math.max(
              0,
              opciones.findIndex((o) => o.valor === valor),
            ),
          );
          abrir(!abierto);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && abierto) {
            e.preventDefault();
            e.stopPropagation();
            abrir(false);
            return;
          }
          if (e.key === 'Tab') {
            abrir(false);
            return;
          }
          if (['Enter', ' '].includes(e.key)) {
            e.preventDefault();
            if (abierto) elegir(indice);
            else {
              resaltar(
                Math.max(
                  0,
                  opciones.findIndex((o) => o.valor === valor),
                ),
              );
              abrir(true);
            }
            return;
          }
          const siguiente = indicePorTecla(
            e.key,
            abierto ? indice : opciones.findIndex((o) => o.valor === valor),
            opciones.length,
          );
          if (siguiente !== null) {
            e.preventDefault();
            e.stopPropagation();
            resaltar(siguiente);
            abrir(true);
          } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
            const i = opciones.findIndex((o) =>
              o.etiqueta.toLocaleLowerCase().startsWith(e.key.toLocaleLowerCase()),
            );
            if (i >= 0) {
              resaltar(i);
              abrir(true);
            }
          }
        }}
      >
        <span id={`${id}-valor`}>{elegida?.etiqueta ?? 'Sin opciones'}</span>
        <Icono nombre="abajo" />
      </button>
      {abierto && (
        <div
          className="jr-opciones"
          role="listbox"
          aria-labelledby={`${id}-etiqueta`}
          id={`${id}-lista`}
        >
          {opciones.map((o, i) => (
            <button
              type="button"
              key={o.valor}
              id={`${id}-${i}`}
              role="option"
              tabIndex={-1}
              aria-selected={valor === o.valor}
              data-resaltado={i === indice}
              onPointerMove={() => resaltar(i)}
              onClick={() => elegir(i)}
            >
              {o.icono && <Icono nombre={o.icono} />}
              <span>{o.etiqueta}</span>
              {valor === o.valor && <Icono nombre="listo" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Deslizador({
  etiqueta,
  valor,
  alCambiar,
  min = 0,
  max = 100,
  unidad = '%',
  deshabilitado = false,
}: {
  etiqueta: string;
  valor: number;
  alCambiar: (v: number) => void;
  min?: number;
  max?: number;
  unidad?: string;
  deshabilitado?: boolean;
}) {
  const id = useId();
  return (
    <label className="jr-deslizador" htmlFor={id}>
      <span>
        {etiqueta}
        <output>
          {valor}
          {unidad}
        </output>
      </span>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        value={valor}
        aria-valuetext={`${valor}${unidad}`}
        disabled={deshabilitado}
        onChange={(e) => alCambiar(Number(e.target.value))}
      />
    </label>
  );
}

export function Menu({
  etiqueta,
  icono = 'mas',
  opciones,
  alElegir,
  deshabilitado = false,
}: {
  etiqueta: string;
  icono?: NombreIcono;
  opciones: readonly Opcion[];
  alElegir: (v: string) => void;
  deshabilitado?: boolean;
}) {
  const [abierto, abrir] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const activador = useRef<HTMLButtonElement>(null);
  const id = useId();
  const cerrar = () => {
    abrir(false);
    activador.current?.focus();
  };
  useEffect(() => {
    if (!abierto) return;
    raiz.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    const fuera = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) abrir(false);
    };
    document.addEventListener('pointerdown', fuera);
    return () => document.removeEventListener('pointerdown', fuera);
  }, [abierto]);
  return (
    <div className="jr-menu" ref={raiz}>
      <button
        type="button"
        disabled={deshabilitado}
        ref={activador}
        className="jr-boton-icono"
        title={etiqueta}
        aria-label={etiqueta}
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-controls={id}
        onClick={() => abrir(!abierto)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            abrir(true);
          }
        }}
      >
        <Icono nombre={icono} />
      </button>
      {abierto && (
        <div
          className="jr-opciones"
          id={id}
          role="menu"
          aria-label={etiqueta}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              cerrar();
            }
            if (e.key === 'Tab') {
              e.preventDefault();
              cerrar();
            }
            const botones = [
              ...raiz.current!.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'),
            ];
            const siguiente = indicePorTecla(
              e.key,
              botones.indexOf(document.activeElement as HTMLButtonElement),
              botones.length,
            );
            if (siguiente !== null) {
              e.preventDefault();
              e.stopPropagation();
              botones[siguiente]?.focus();
            }
          }}
        >
          {opciones.map((o) => (
            <button
              type="button"
              role="menuitem"
              key={o.valor}
              tabIndex={-1}
              onClick={() => {
                alElegir(o.valor);
                cerrar();
              }}
            >
              {o.icono && <Icono nombre={o.icono} />}
              <span>{o.etiqueta}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** El diálogo nativo aporta fondo inerte, trampa de foco y restauración sin listeners globales. */
export function Dialogo({
  abierto,
  titulo,
  alCerrar,
  children,
  hoja = false,
}: {
  abierto: boolean;
  titulo: string;
  alCerrar: () => void;
  children: ReactNode;
  hoja?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;
    if (abierto && !dialogo.open) dialogo.showModal();
    else if (!abierto && dialogo.open) dialogo.close();
  }, [abierto]);
  return (
    <dialog
      ref={ref}
      className={clases('jr-dialogo', hoja && 'jr-hoja')}
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault();
        alCerrar();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            alCerrar();
        }
      }}
    >
      <header>
        <h2 id={id}>{titulo}</h2>
        <BotonIcono nombre="Cerrar diálogo" icono="cerrar" onClick={alCerrar} />
      </header>
      <div className="jr-dialogo-cuerpo">{children}</div>
    </dialog>
  );
}

export function Fila({
  icono,
  iniciales,
  titulo,
  detalle,
  estado,
  activo,
  onClick,
}: {
  icono?: NombreIcono;
  iniciales?: string;
  titulo: string;
  detalle?: string;
  estado?: string;
  activo?: boolean;
  onClick?: () => void;
}) {
  const contenido = (
    <>
      {iniciales ? (
        <span className="jr-avatar" aria-hidden="true">
          {iniciales}
        </span>
      ) : (
        icono && <Icono nombre={icono} />
      )}
      <span className="jr-fila-texto">
        <span>{titulo}</span>
        {detalle && <small>{detalle}</small>}
      </span>
      {estado && (
        <span className="jr-fila-estado" aria-label={estado} title={estado}>
          <span className="jr-punto" />
        </span>
      )}
    </>
  );
  return onClick ? (
    <button type="button" className="jr-fila" aria-pressed={activo} onClick={onClick}>
      {contenido}
    </button>
  ) : (
    <div className="jr-fila">{contenido}</div>
  );
}
export function Tecla({ children }: { children: ReactNode }) {
  return <kbd className="jr-tecla">{children}</kbd>;
}
export function Insignia({ children }: { children: ReactNode }) {
  return <span className="jr-insignia">{children}</span>;
}
export function Estado({ children }: { children: ReactNode }) {
  return (
    <span className="jr-estado">
      <span className="jr-punto" aria-hidden="true" />
      {children}
    </span>
  );
}
export function Progreso({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <div className="jr-progreso">
      <span>
        {etiqueta}
        <span>{valor}%</span>
      </span>
      <progress aria-label={etiqueta} value={valor} max={100} />
    </div>
  );
}
export function Aviso({
  texto,
  alCerrar,
  accion,
  alAccion,
}: {
  texto: string;
  alCerrar?: () => void;
  accion?: string;
  alAccion?: () => void;
}) {
  return (
    <div className="jr-aviso" role="status">
      <Icono nombre="listo" />
      <span>{texto}</span>
      {accion && (
        <Boton jerarquia="terciario" onClick={alAccion}>
          {accion}
        </Boton>
      )}
      {alCerrar && <BotonIcono nombre="Cerrar aviso" icono="cerrar" onClick={alCerrar} />}
    </div>
  );
}
