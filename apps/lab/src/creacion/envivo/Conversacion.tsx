import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import type { Proyector, SalaGuardada } from '@oficina/motor';
import { conectarD2 } from './dinamica/conexion';
import { limpiarEntrada, fraseDeError } from '@oficina/agentes';
import { enviarMensaje, salud } from '../../../../agentes-lab/src/cliente';
import { useJules } from '../asistente/useJules';
import { Jules } from '../asistente/Jules';
import { useAyudaJules } from '../asistente/useAyudaJules';
import { AyudaJules } from '../asistente/AyudaJules';
import { esMensajeParaJules } from '../asistente/control';
import { usePresenciaJules } from '../asistente/usePresenciaJules';
import { respuestaLocal } from './sinServidor';
import { Ancla } from '../Ancla';
import { crearCola, LIMITES_VIVO, type BurbujaViva } from './protocolo';
import { encuadrarBurbuja } from './encuadre';
import { equipoDeSala } from './equipo';

export function Conversacion({
  sala,
  abierto,
  cerrar,
  proyector,
  burbuja,
  emitir,
  conversacionId,
  posicion,
  local = false,
}: {
  sala: SalaGuardada;
  abierto: string | null;
  cerrar: () => void;
  proyector: MutableRefObject<Proyector | null>;
  burbuja: BurbujaViva | null;
  emitir: (b: BurbujaViva) => void;
  conversacionId: string;
  posicion: { x: number; y: number; z: number };
  /** Sin el servidor de agentes: el simulador local responde, sin pedir nada a la red. */
  local?: boolean;
}) {
  useEffect(() => {
    conectarD2({ yo: conversacionId });
  }, [conversacionId]);
  const jules = useJules();
  const ayuda = useAyudaJules(sala, jules, posicion, conversacionId);
  usePresenciaJules(jules, ayuda.decir);
  const [chatMovil, setChatMovil] = useState(false);
  const [texto, setTexto] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState('');
  const [proveedor, setProveedor] = useState('Conectando agentes…');
  const input = useRef<HTMLInputElement>(null);
  const formulario = useRef<HTMLFormElement>(null);
  const control = useRef<AbortController | null>(null);
  const cola = useMemo(() => crearCola(), []);
  const equipo = useMemo(() => equipoDeSala(sala), [sala]);
  const agente = sala.ocupantes.find((o) => o.tipo === 'agente' && o.id === abierto);
  const ultimas = useRef({ emitir, posicion });
  ultimas.current = { emitir, posicion };
  useEffect(() => {
    if (local) {
      setProveedor('Jules te ayuda a recorrer esta sala');
      return;
    }
    void salud()
      .then((s) =>
        setProveedor(s.clave ? 'Agentes conectados' : 'Proveedor simulado · sin clave real'),
      )
      .catch(() => setProveedor('Agentes sin conexión'));
    return () => control.current?.abort();
  }, [local]);
  useEffect(() => {
    if (abierto) input.current?.focus();
  }, [abierto]);
  useEffect(() => {
    const teclear = (e: KeyboardEvent) => {
      if (
        e.key === 'Enter' &&
        !/INPUT|TEXTAREA|BUTTON/.test((e.target as HTMLElement)?.tagName) &&
        !e.ctrlKey &&
        !e.metaKey
      ) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    addEventListener('keydown', teclear);
    return () => removeEventListener('keydown', teclear);
  }, []);
  const enviar = async () => {
    if (!texto.trim()) return;
    if (esMensajeParaJules(texto)) {
      ayuda.preguntar(texto);
      setTexto('');
      setAviso('J · Llamar a Jules');
      input.current?.blur();
      return;
    }
    const mencion = /^@([^\s]+)\s*(.*)$/s.exec(texto.trim());
    const objetivo = mencion
      ? sala.ocupantes.find(
          (o) =>
            o.tipo === 'agente' && o.nombre.toLocaleLowerCase() === mencion[1]!.toLocaleLowerCase(),
        )
      : agente;
    const contenido = mencion ? mencion[2]! : texto;
    const def = objetivo
      ? equipo.find((a) => a.id === `${sala.plano.plantilla}-${objetivo.id}`)
      : null;
    if (!def || !objetivo) {
      setAviso('Escribe @ y el nombre de un agente de esta sala.');
      return;
    }
    if (!cola.reservar(contenido)) {
      setAviso(
        `Espera tu respuesta; puedes enviar ${LIMITES_VIVO.mensajesMinuto} mensajes por minuto de hasta ${LIMITES_VIVO.caracteres} caracteres.`,
      );
      return;
    }
    setAviso('');
    setOcupado(true);
    setTexto('');
    control.current = new AbortController();
    const b: BurbujaViva = {
      tipo: 'burbuja',
      id: crypto.randomUUID(),
      agente: objetivo.id,
      texto: '',
      fase: 'pensando',
      ...posicion,
    };
    ultimas.current.emitir({ ...b });
    try {
      const eventos = local
        ? respuestaLocal(def, limpiarEntrada(contenido, LIMITES_VIVO.caracteres).texto)
        : enviarMensaje({
            agenteId: def.id,
            conversacionId,
            texto: limpiarEntrada(contenido, LIMITES_VIVO.caracteres).texto,
            quien: sala.ocupantes.find((o) => o.id === 'yo')?.nombre,
            via: mencion ? 'mencion' : 'cerca',
            senal: control.current.signal,
            frasesLocales: def.frasesError,
          });
      for await (const e of eventos) {
        if (e.tipo === 'texto') {
          b.texto = (b.texto + e.texto).slice(0, LIMITES_VIVO.respuesta);
          b.fase = 'texto';
        }
        if (e.tipo === 'error') {
          b.texto = e.mensaje;
          b.fase = 'error';
        }
        if (e.tipo === 'fin') b.fase = 'fin';
        ultimas.current.emitir({ ...b });
      }
    } catch {
      b.texto = fraseDeError(def, 'interno');
      b.fase = 'error';
      ultimas.current.emitir({ ...b });
    } finally {
      cola.terminar();
      setOcupado(false);
    }
  };
  const visible = burbuja && sala.ocupantes.some((o) => o.id === burbuja.agente);
  const nombreBurbuja = sala.ocupantes.find((o) => o.id === burbuja?.agente)?.nombre;
  return (
    <>
      <Jules
        jules={jules}
        proyector={proyector}
        burbuja={ayuda.panel && chatMovil ? '' : ayuda.burbuja}
        alAyuda={() => {
          ayuda.abrir();
          setChatMovil(true);
        }}
        alOrden={() => ayuda.cancelar()}
      />
      {visible && (
        <Ancla
          proyector={proyector}
          objetivo={() => {
            const p = proyector.current?.mundo(burbuja.agente);
            return p ? { ...p, y: p.y + 2.6 } : null;
          }}
          ajustar={(p, nodo) => {
            const caja = nodo.firstElementChild?.getBoundingClientRect();
            return caja
              ? { ...p, ...encuadrarBurbuja(p, caja.width, caja.height, innerWidth, innerHeight) }
              : p;
          }}
          className="cr-burbuja-ancla"
        >
          <div className="cr-burbuja ev-burbuja" role="status" data-agente={burbuja.agente}>
            <strong>{nombreBurbuja}</strong>
            <p>{burbuja.texto || 'Estoy pensando…'}</p>
          </div>
        </Ancla>
      )}
      <button
        className="cr-boton cr-hablar ev-abrir-chat"
        type="button"
        aria-expanded={chatMovil || Boolean(abierto)}
        onClick={() => setChatMovil(!chatMovil)}
      >
        {chatMovil ? 'Ocultar chat' : 'Hablar con Jules'}
      </button>
      <form
        ref={formulario}
        className="cr-hablar ev-hablar"
        data-abierto={chatMovil || Boolean(abierto)}
        onSubmit={(e) => {
          e.preventDefault();
          void enviar();
        }}
      >
        {!jules.menu && <AyudaJules ayuda={ayuda} ancla={formulario} />}
        <label className="ev-sr" htmlFor="ev-texto">
          Escríbele a Jules
        </label>
        <input
          id="ev-texto"
          ref={input}
          value={texto}
          maxLength={LIMITES_VIVO.caracteres}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              cerrar();
              e.currentTarget.blur();
            }
          }}
          placeholder="Escríbele a Jules…"
          autoComplete="off"
          aria-describedby="ev-aviso"
        />
        <button
          className="cr-boton cr-boton--prim cr-boton--chico"
          disabled={ocupado || !texto.trim()}
        >
          {ocupado ? 'Respondiendo…' : 'Enviar'}
        </button>
        {abierto && (
          <button
            className="cr-icono"
            type="button"
            aria-label="Cerrar conversación"
            onClick={cerrar}
          >
            ✕
          </button>
        )}
        <small id="ev-aviso" role="status">
          {aviso || proveedor}
        </small>
      </form>
    </>
  );
}
