/**
 * El primer minuto dentro de la sala, sin ventanas: pistas que flotan junto a tu personaje y se
 * van al cumplirlas, una lista corta de misiones en el rincón, la charla con un agente como burbuja
 * sobre su cabeza y, en el teléfono, palanca y botones.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { accionesDe, escribirPalanca } from '@oficina/motor';
import type { Escenario, Mando, Proyector, SalaGuardada } from '@oficina/motor';
import { Dinamica } from './envivo/dinamica/Dinamica';
import { Ancla } from './Ancla';
import { BotonSonido } from './BotonSonido';
import { Tecla } from './Tecla';
import { MISIONES, conHabla, conMuestra, misionActual, todasHechas } from './misiones';
import type { EstadoMisiones } from './misiones';
import type { EstadoAvatar } from './Crear';
import { sonar } from './sonido';

export interface EstadoMisionesVivo {
  estado: EstadoMisiones;
  setEstado: (e: EstadoMisiones) => void;
  /** Recorrido acumulado entre renders (React solo se entera al cumplir una misión). */
  interno: MutableRefObject<EstadoMisiones>;
  cerrada: boolean;
  setCerrada: (c: boolean) => void;
}

interface Props {
  misiones: EstadoMisionesVivo;
  sala: SalaGuardada;
  escenario: Escenario;
  avatar: EstadoAvatar;
  mando: Mando;
  proyector: MutableRefObject<Proyector | null>;
  agenteHablando: string | null;
  alConstruir: () => void;
  puedeConstruir: boolean;
}

function Palanca({ mando }: { mando: Mando }) {
  const base = useRef<HTMLDivElement>(null);
  const [p, setP] = useState({ x: 0, y: 0 });
  const mover = (cx: number, cy: number) => {
    const r = base.current?.getBoundingClientRect();
    if (!r) return;
    const R = r.width / 2;
    let x = (cx - (r.left + R)) / R;
    let y = (cy - (r.top + R)) / R;
    const m = Math.hypot(x, y);
    if (m > 1) {
      x /= m;
      y /= m;
    }
    setP({ x, y });
    escribirPalanca(x, y, mando);
  };
  const soltar = () => {
    setP({ x: 0, y: 0 });
    mando.lateral = 0;
    mando.adelante = 0;
    mando.correr = false;
  };
  return (
    <div
      ref={base}
      className="cr-palanca"
      aria-label="Palanca para caminar"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        mover(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => e.buttons && mover(e.clientX, e.clientY)}
      onPointerUp={soltar}
      onPointerCancel={soltar}
    >
      <span style={{ transform: `translate(${p.x * 34}px, ${p.y * 34}px)` }} />
    </div>
  );
}

export function Dentro({
  misiones,
  sala,
  escenario,
  avatar,
  mando,
  proyector,
  agenteHablando,
  alConstruir,
  puedeConstruir,
}: Props) {
  // Las misiones viven en `Crear`: entrar y salir de construir no las reinicia.
  const { estado: m, setEstado: setM, interno, cerrada, setCerrada } = misiones;

  // Las misiones leen al avatar unas 10 veces por segundo; solo renderizan si algo cambió.
  // El recorrido se acumula en una referencia; React solo se entera cuando se cumple una misión.
  useEffect(() => {
    const t = window.setInterval(() => {
      const antes = interno.current;
      const n = conMuestra(antes, { ...avatar, saltos: mando.saltos });
      interno.current = n;
      if (n.hechas.length > antes.hechas.length) {
        sonar('mision');
        setM(n);
      }
    }, 100);
    return () => window.clearInterval(t);
  }, [avatar, mando]);
  useEffect(() => {
    if (!agenteHablando) return;
    interno.current = conHabla(interno.current);
    setM(interno.current);
  }, [agenteHablando]);
  useEffect(() => {
    if (!todasHechas(m)) return;
    const t = window.setTimeout(() => setCerrada(true), 2500);
    return () => window.clearTimeout(t);
  }, [m]);

  const actual = misionActual(m);
  const asientos = useMemo(
    () => accionesDe(escenario).filter((a) => a.tipo === 'sentarse'),
    [escenario],
  );
  /** Para «siéntate», la pista va sobre el asiento más cercano, no sobre ti. */
  const objetivoPista = () => {
    if (actual?.id !== 'sentarse' || asientos.length === 0)
      return { x: avatar.x, y: avatar.y + 2.9, z: avatar.z };
    let mejor = asientos[0]!;
    let d = Infinity;
    for (const a of asientos) {
      const dd = Math.hypot(a.x - avatar.x, a.z - avatar.z);
      if (dd < d) {
        d = dd;
        mejor = a;
      }
    }
    return { x: mejor.x, y: (mejor.y ?? avatar.y) + 1.4, z: mejor.z };
  };
  const [tactil] = useState(() => window.matchMedia?.('(pointer: coarse)').matches ?? false);
  const yo = sala.ocupantes.find((o) => o.id === 'yo');

  return (
    <div className="cr-dentro">
      <Dinamica
        proyector={proyector}
        escenario={escenario}
        sala={sala}
        avatar={avatar}
        mando={mando}
      />
      <div className="cr-chip-sala">
        {sala.nombre}
        {sala.equipo && <small>{sala.equipo}</small>}
      </div>
      <div className="cr-esquina-sup">
        <BotonSonido />
        {puedeConstruir && (
          <button className="cr-boton cr-boton--chico" onClick={alConstruir}>
            <Tecla>B</Tecla> Construir
          </button>
        )}
      </div>

      {actual && actual.id !== 'hablar' && (
        <Ancla proyector={proyector} objetivo={objetivoPista} className="cr-pista-ancla">
          <div className="cr-pista" key={actual.id}>
            {tactil ? (
              <small>{actual.tactil.pista}</small>
            ) : (
              <>
                {actual.teclas.map((t) => (
                  <Tecla key={t}>{t}</Tecla>
                ))}
                <small>{actual.pista}</small>
              </>
            )}
          </div>
        </Ancla>
      )}

      {!cerrada && (
        <ul className="cr-misiones" aria-label="Para empezar">
          <li className="cr-misiones-titulo">
            {todasHechas(m) ? `Listo, ${yo?.nombre ?? ''}. Ya sabes moverte.` : 'Para empezar'}
          </li>
          {MISIONES.map((x) => (
            <li
              key={x.id}
              className={
                m.hechas.includes(x.id) ? 'hecha' : actual?.id === x.id ? 'ahora' : undefined
              }
            >
              {tactil ? x.tactil.texto : x.texto}
            </li>
          ))}
        </ul>
      )}

      <Palanca mando={mando} />
      <div className="cr-botones-tactiles">
        <button onPointerDown={() => (mando.saltos += 1)}>Saltar</button>
      </div>
    </div>
  );
}
