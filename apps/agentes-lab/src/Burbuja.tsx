import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { DefinicionAgente } from '@oficina/agentes';
import type { Proyectar } from './proximidad';
import { altoMaximoBurbuja, PARAMETROS_AVATAR, rectAvatar, ubicarBurbuja } from './anclaje';
import type { Rect } from './anclaje';
import type { Lado } from './anclaje';
import { useAlmacen } from './almacen';
import type { Almacen } from './almacen';
import { historialDe } from './estadoConversacion';
import type { Intercambio } from './estadoConversacion';
import { avanceTipeo } from './tipeo';
import { prefiereMenosMovimiento, reservaCompositor, tamanoVisible } from './ventana';

interface Props {
  almacen: Almacen;
  definiciones: readonly DefinicionAgente[];
  proyector: { current: Proyectar | null };
  /** Posición del avatar propio en el mundo: la burbuja no debe taparlo. */
  avatar: { current: { x: number; y: number; z: number } };
  alCerrar: () => void;
  alReintentar: () => void;
}

/** Texto de la respuesta que va apareciendo por trozos; se escribe directo en el DOM, sin pintar React por cuadro. */
function TextoVivo({ texto, activo }: { texto: string; activo: boolean }) {
  const nodo = useRef<HTMLSpanElement>(null);
  const objetivo = useRef(texto);
  const mostrados = useRef(0);
  const raf = useRef(0);
  const [escribiendo, setEscribiendo] = useState(false);

  useLayoutEffect(() => {
    // Un texto nuevo (no una continuación) empieza de cero.
    if (!texto.startsWith(objetivo.current.slice(0, mostrados.current))) mostrados.current = 0;
    objetivo.current = texto;
    const reducido = prefiereMenosMovimiento();
    const pintar = () => {
      raf.current = 0;
      const el = nodo.current;
      if (!el) return;
      const cuerpo = el.closest('.burbuja-cuerpo');
      const pegado = cuerpo
        ? cuerpo.scrollTop + cuerpo.clientHeight >= cuerpo.scrollHeight - 24
        : false;
      mostrados.current = avanceTipeo(mostrados.current, objetivo.current.length, reducido);
      el.textContent = objetivo.current.slice(0, mostrados.current);
      if (cuerpo && pegado) cuerpo.scrollTop = cuerpo.scrollHeight;
      if (mostrados.current < objetivo.current.length) raf.current = requestAnimationFrame(pintar);
      else setEscribiendo(false);
    };
    if (mostrados.current < texto.length) {
      setEscribiendo(true);
      if (!raf.current) raf.current = requestAnimationFrame(pintar);
    } else {
      pintar();
    }
  }, [texto]);
  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current);
      raf.current = 0;
    },
    [],
  );

  return (
    <>
      <span ref={nodo} />
      {(activo || escribiendo) && <span className="cursor" aria-hidden="true" />}
    </>
  );
}

function Turno({ i, ultimo, activo }: { i: Intercambio; ultimo: boolean; activo: boolean }) {
  return (
    <div className="turno">
      <p className="turno-tu">{i.usuario}</p>
      {i.respuesta !== '' && (
        <p className="turno-agente" aria-live={ultimo ? 'polite' : undefined}>
          {ultimo ? <TextoVivo texto={i.respuesta} activo={activo} /> : i.respuesta}
        </p>
      )}
      {i.cortada && !i.error && <p className="turno-nota">Se interrumpió la respuesta.</p>}
      {i.error && (
        <p className="turno-error" role="status">
          {i.error.mensaje}
          {i.cortada && <span className="turno-nota"> Lo recibido quedó arriba.</span>}
        </p>
      )}
    </div>
  );
}

/** Burbuja anclada sobre la cabeza del agente: saludo, último intercambio y la respuesta llegando. */
export function Burbuja({
  almacen,
  definiciones,
  proyector,
  avatar,
  alCerrar,
  alReintentar,
}: Props) {
  const agenteId = useAlmacen(almacen, (e) => e.agenteId);
  const fase = useAlmacen(almacen, (e) => e.fase);
  const historial = useAlmacen(almacen, (e) => historialDe(e, e.agenteId ?? ''));
  const def = definiciones.find((d) => d.id === agenteId);
  const [verAnteriores, setVerAnteriores] = useState(false);

  const nodo = useRef<HTMLDivElement>(null);
  const abierta = agenteId !== null && fase !== 'cerrada';

  useEffect(() => setVerAnteriores(false), [agenteId]);

  // Posición por cuadro: se escribe `transform` directo; React no pinta nada por cuadro.
  useEffect(() => {
    const el = nodo.current;
    if (!abierta || !el || !agenteId) return;
    let raf = 0;
    let ancho = 0;
    let alto = 0;
    const medir = new ResizeObserver(([entrada]) => {
      const caja = entrada?.borderBoxSize[0];
      ancho = caja?.inlineSize ?? el.offsetWidth;
      alto = caja?.blockSize ?? el.offsetHeight;
    });
    medir.observe(el);
    const previo = { transform: '', lado: '' as Lado | '', cola: -1, angulo: NaN, tope: -1 };
    const bucle = () => {
      raf = requestAnimationFrame(bucle);
      const cabeza = proyector.current?.(agenteId);
      if (!cabeza || ancho === 0) return;
      const ventana = tamanoVisible();
      const reservaAbajo = reservaCompositor();
      const tope = Math.round(altoMaximoBurbuja(ventana.alto, ventana.ancho, reservaAbajo));
      if (tope !== previo.tope) {
        el.style.setProperty('--alto-max', `${tope}px`);
        previo.tope = tope;
      }
      const a = avatar.current;
      const pies = proyector.current?.({ x: a.x, y: a.y, z: a.z });
      const coronilla = proyector.current?.({ x: a.x, y: a.y + PARAMETROS_AVATAR.altura, z: a.z });
      const evitar: Rect[] =
        pies?.visible && coronilla?.visible ? [rectAvatar(pies, coronilla)] : [];
      const u = ubicarBurbuja(cabeza, { ancho, alto, altoMax: tope }, ventana, undefined, {
        evitar,
        reservaAbajo,
        ladoPrevio: previo.lado || undefined,
      });
      const t = `translate3d(${Math.round(u.x)}px, ${Math.round(u.y)}px, 0)`;
      if (t !== previo.transform) {
        el.style.transform = t;
        previo.transform = t;
      }
      if (u.lado !== previo.lado) {
        el.dataset.lado = u.lado;
        previo.lado = u.lado;
      }
      const cola = Math.round(u.cola);
      if (cola !== previo.cola) {
        el.style.setProperty('--cola', `${cola}px`);
        previo.cola = cola;
      }
      if (u.lado === 'borde' && u.angulo !== previo.angulo) {
        el.style.setProperty('--angulo', `${u.angulo}rad`);
        previo.angulo = u.angulo;
      }
      el.style.visibility = 'visible';
    };
    raf = requestAnimationFrame(bucle);
    return () => {
      cancelAnimationFrame(raf);
      medir.disconnect();
      el.style.visibility = 'hidden';
    };
  }, [abierta, agenteId, proyector, avatar]);

  if (!abierta || !def) return null;
  const ultimo = historial.at(-1);
  const anteriores = historial.slice(0, -1);
  const respondiendo = fase === 'respondiendo';
  const pensando = fase === 'pensando';

  return (
    <div
      ref={nodo}
      className="burbuja"
      role="dialog"
      aria-label={`Conversación con ${def.nombre}`}
      data-lado="arriba"
    >
      <header className="burbuja-cabeza">
        <svg
          className="burbuja-flecha"
          viewBox="0 0 16 16"
          width="16"
          height="16"
          aria-hidden="true"
        >
          <path
            d="M2 8h11M9 4l4 4-4 4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div className="burbuja-quien">
          <strong>{def.nombre}</strong>
          <span>{def.rol}</span>
        </div>
        <button
          type="button"
          className="boton-icono"
          aria-label="Cerrar conversación"
          onClick={alCerrar}
        >
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path
              d="M3.5 3.5l9 9M12.5 3.5l-9 9"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </header>
      <div className="burbuja-cuerpo">
        {anteriores.length > 0 && (
          <button
            type="button"
            className="burbuja-mas"
            aria-expanded={verAnteriores}
            onClick={() => setVerAnteriores((v) => !v)}
          >
            {verAnteriores ? 'Ocultar anteriores' : `Ver anteriores (${anteriores.length})`}
          </button>
        )}
        {verAnteriores &&
          anteriores.map((i, n) => <Turno key={n} i={i} ultimo={false} activo={false} />)}
        {!ultimo && <p className="turno-agente turno-saludo">{def.saludo}</p>}
        {ultimo && <Turno i={ultimo} ultimo activo={respondiendo} />}
        {pensando && (
          <p className="turno-pensando" role="status">
            {def.nombre} está pensando
          </p>
        )}
        {fase === 'error' && (
          <button type="button" className="boton-secundario" onClick={alReintentar}>
            Reintentar
          </button>
        )}
      </div>
      <i className="burbuja-cola" aria-hidden="true" />
    </div>
  );
}
