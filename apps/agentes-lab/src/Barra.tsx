import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, RefObject } from 'react';
import type { DefinicionAgente } from '@oficina/agentes';
import { useAlmacen } from './almacen';
import type { Almacen } from './almacen';
import { enCurso } from './estadoConversacion';
import { completarMencion, sugerirMenciones } from './mencion';

export type ResultadoEnvio = 'ok' | 'sin-destino';

interface Props {
  almacen: Almacen;
  definiciones: readonly DefinicionAgente[];
  inputRef: RefObject<HTMLInputElement | null>;
  /** Enruta el texto (mención o conversación abierta); `sin-destino` si no hay a quién. */
  alEnviar: (texto: string) => ResultadoEnvio;
  alCerrar: () => void;
  alDetener: () => void;
}

const AVISO_SIN_DESTINO = 'Menciona a alguien con @ para hablarle';

/**
 * La barra de abajo: «Escríbele a…» con la conversación cerrada, y el compositor del agente cuando hay una
 * abierta. Un solo `<input>` de una línea; `@` abre la lista de agentes.
 */
export function Barra({ almacen, definiciones, inputRef, alEnviar, alCerrar, alDetener }: Props) {
  const fase = useAlmacen(almacen, (e) => e.fase);
  const agenteId = useAlmacen(almacen, (e) => e.agenteId);
  const valor = useAlmacen(almacen, (e) => e.borrador);
  const ocupado = useAlmacen(almacen, enCurso);
  const abierta = fase !== 'cerrada';
  const def = definiciones.find((d) => d.id === agenteId);
  const maximo = def?.maxCaracteresEntrada ?? definiciones[0]?.maxCaracteresEntrada ?? 600;

  const [cursor, setCursor] = useState(0);
  const [indice, setIndice] = useState(0);
  const [listaAbierta, setListaAbierta] = useState(true);
  const [aviso, setAviso] = useState<string | null>(null);

  const sugerencias = useMemo(
    () => (listaAbierta ? sugerirMenciones(valor, cursor, definiciones) : null),
    [listaAbierta, valor, cursor, definiciones],
  );
  const hayLista = sugerencias !== null && sugerencias.lista.length > 0;
  const activa = hayLista
    ? sugerencias.lista[Math.min(indice, sugerencias.lista.length - 1)]
    : undefined;

  // Al terminar un turno, el foco vuelve al campo (se deshabilitó mientras el agente respondía).
  const estabaOcupado = useRef(false);
  useEffect(() => {
    if (estabaOcupado.current && !ocupado && abierta) inputRef.current?.focus();
    estabaOcupado.current = ocupado;
  }, [ocupado, abierta, inputRef]);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 3500);
    return () => clearTimeout(t);
  }, [aviso]);

  const escribir = (texto: string, pos: number) => {
    almacen.despachar({ tipo: 'escribir', texto });
    setCursor(pos);
    setIndice(0);
    setListaAbierta(true);
    setAviso(null);
  };

  const elegir = (nombre: string) => {
    if (!sugerencias) return;
    const r = completarMencion(valor, cursor, sugerencias, nombre);
    escribir(r.texto, r.cursor);
    requestAnimationFrame(() => inputRef.current?.setSelectionRange(r.cursor, r.cursor));
    inputRef.current?.focus();
  };

  const enviar = () => {
    const texto = valor.trim();
    if (!texto) return;
    if (alEnviar(texto) === 'sin-destino') setAviso(AVISO_SIN_DESTINO);
  };

  const alTeclear = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    // Mientras se escribe, ninguna tecla llega al juego (W A S D, espacio, E…).
    e.nativeEvent.stopPropagation();
    if (hayLista && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      const n = sugerencias.lista.length;
      setIndice((i) => (i + (e.key === 'ArrowDown' ? 1 : n - 1)) % n);
    } else if (hayLista && (e.key === 'Enter' || e.key === 'Tab') && activa) {
      e.preventDefault();
      elegir(activa.nombre);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      enviar();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (hayLista) setListaAbierta(false);
      else {
        if (abierta) alCerrar();
        inputRef.current?.blur();
      }
    }
  };

  const placeholder = ocupado
    ? `${def?.nombre ?? 'El agente'} está ${fase === 'pensando' ? 'pensando' : 'respondiendo'}…`
    : def
      ? `Escribe a ${def.nombre}…`
      : 'Escríbele a…';

  return (
    <div className="barra" data-abierta={abierta || undefined}>
      {hayLista && (
        <ul className="barra-lista" role="listbox" id="lista-menciones" aria-label="Agentes">
          {sugerencias.lista.map((a) => (
            <li
              key={a.id}
              id={`mencion-${a.id}`}
              role="option"
              aria-selected={a.id === activa?.id}
              data-activa={a.id === activa?.id || undefined}
              onMouseDown={(e) => {
                e.preventDefault();
                elegir(a.nombre);
              }}
            >
              <strong>{a.nombre}</strong>
              <span>{a.rol}</span>
            </li>
          ))}
        </ul>
      )}
      {aviso && (
        <p className="barra-aviso" role="status">
          {aviso}
        </p>
      )}
      <div className="barra-campo">
        <input
          ref={inputRef}
          type="text"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="send"
          maxLength={maximo}
          value={valor}
          disabled={ocupado}
          placeholder={placeholder}
          aria-label={
            def ? `Mensaje para ${def.nombre}` : 'Escríbele a un agente; usa @ para elegir'
          }
          role="combobox"
          aria-expanded={hayLista}
          aria-controls="lista-menciones"
          aria-activedescendant={activa ? `mencion-${activa.id}` : undefined}
          aria-autocomplete="list"
          onChange={(e) =>
            escribir(e.target.value, e.target.selectionStart ?? e.target.value.length)
          }
          onSelect={(e) => setCursor(e.currentTarget.selectionStart ?? valor.length)}
          onKeyDown={alTeclear}
        />
        {valor.length >= maximo * 0.8 && (
          <span className="barra-cuenta" aria-live="polite">
            {valor.length}/{maximo}
          </span>
        )}
        {ocupado ? (
          <button
            type="button"
            className="barra-boton"
            aria-label="Detener respuesta"
            onClick={alDetener}
          >
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
              <rect x="4" y="4" width="8" height="8" rx="1.5" fill="currentColor" />
            </svg>
          </button>
        ) : (
          <button
            type="button"
            className="barra-boton"
            aria-label="Enviar mensaje"
            disabled={valor.trim() === ''}
            onClick={enviar}
          >
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
              <path
                d="M8 13V3M3.5 7.5L8 3l4.5 4.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
