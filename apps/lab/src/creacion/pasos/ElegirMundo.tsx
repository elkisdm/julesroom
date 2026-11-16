import { useEffect, useRef, type CSSProperties } from 'react';
import { escenarioPorId } from '@oficina/motor';
import { PLANTILLAS } from '../plantillas';
import { Tecla } from '../Tecla';
import {
  accionDeTecla,
  datosMundo,
  direccionDeslizamiento,
  estiloMundo,
  navegarMundo,
  PARAMETROS_MUNDOS,
} from './mundos';
import { MuestrasEstilo } from './MuestrasEstilo';
import './mundos.css';

const EQUIPOS: Record<string, string> = {
  trading: 'Para equipos que siguen el pulso del mercado.',
  oficina: 'Para equipos que diseñan, construyen y lanzan juntos.',
  mansion: 'Para equipos que quieren un espacio para cada idea.',
};

interface Props {
  plantilla: string;
  variante?: string;
  miniaturas: Record<string, string>;
  fallos: number;
  cuadroVisible: string;
  preparada: boolean;
  alElegir: (id: string) => void;
  alVariante: (id: string) => void;
  alConfirmar: () => void;
  alVolver: () => void;
}

export function ElegirMundo(props: Props) {
  const { plantilla, variante, miniaturas, alElegir, alVariante, alConfirmar, fallos } = props;
  const e = escenarioPorId(plantilla);
  const d = datosMundo(e);
  const estilo = estiloMundo(e.variantes, variante);
  const clave = `${plantilla}:${estilo.elegida?.id}`;
  const marcador = useRef({ clave, necesario: !props.preparada });
  if (marcador.current.clave !== clave) marcador.current = { clave, necesario: !props.preparada };
  const cuadroListo = props.cuadroVisible === clave || !marcador.current.necesario;
  const toque = useRef<{ x: number; y: number } | null>(null);
  const acciones = useRef(props);
  acciones.current = props;
  useEffect(() => {
    const tecla = (event: KeyboardEvent) => {
      const p = acciones.current;
      const accion = accionDeTecla(
        event.key,
        event.metaKey || event.ctrlKey || event.altKey || event.isComposing,
      );
      if (!accion) return;
      event.preventDefault();
      if (accion === 'anterior' || accion === 'siguiente')
        p.alElegir(navegarMundo(p.plantilla, accion === 'anterior' ? -1 : 1));
      if (accion === 'confirmar') p.alConfirmar();
      if (accion === 'volver') p.alVolver();
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, []);
  return (
    <section
      className="cr-mundos"
      style={{ '--fundido-mundos': `${PARAMETROS_MUNDOS.fundidoMs}ms` } as CSSProperties}
      aria-label="Elige tu sala"
      onTouchStart={(event) => {
        const t = event.touches[0];
        toque.current = t ? { x: t.clientX, y: t.clientY } : null;
      }}
      onTouchEnd={(event) => {
        const t = event.changedTouches[0];
        if (t && toque.current) {
          const direccion = direccionDeslizamiento(
            toque.current.x,
            t.clientX,
            t.clientY - toque.current.y,
          );
          if (direccion) {
            event.preventDefault();
            alElegir(navegarMundo(plantilla, direccion));
          }
        }
        toque.current = null;
      }}
      onTouchCancel={() => {
        toque.current = null;
      }}
    >
      <div
        className={`cr-mundos-marcador${cuadroListo ? ' cr-mundos-marcador--listo' : ''}`}
        data-mundo-pendiente={cuadroListo ? undefined : plantilla}
        aria-hidden="true"
      >
        <img src={miniaturas[plantilla] ?? `/mundos/${plantilla}.jpg`} alt="" />
      </div>
      <div className="cr-mundos-navegar">
        <button
          className="cr-boton"
          aria-label="Sala anterior"
          onClick={() => alElegir(navegarMundo(plantilla, -1))}
        >
          ←
        </button>
        <span>Arrastra para explorar · desliza para cambiar</span>
        <button
          className="cr-boton"
          aria-label="Sala siguiente"
          onClick={() => alElegir(navegarMundo(plantilla, 1))}
        >
          →
        </button>
      </div>
      <div className="cr-mundos-pie">
        <div
          className="cr-mundos-descripcion"
          key={plantilla}
          aria-live="polite"
          aria-atomic="true"
        >
          <h2>{d.nombre}</h2>
          <p>{EQUIPOS[plantilla]}</p>
          <div className="cr-mundos-datos">
            <span>
              <b>{d.puestos}</b> puestos
            </span>
            <span>
              <b>{d.zonas}</b> zonas
            </span>
            <span>
              <b>{d.plantas}</b> {d.plantas === 1 ? 'planta' : 'plantas'}
            </span>
          </div>
        </div>
        <div className="cr-mundos-eleccion">
          {estilo.visible && (
            <div className="cr-mundos-estilos">
              <span>
                Estilo <b>{estilo.elegida?.nombre}</b>
              </span>
              <MuestrasEstilo
                variantes={e.variantes}
                activa={estilo.elegida?.id}
                alElegir={alVariante}
              />
            </div>
          )}
          <div className="cr-mundos-miniaturas" role="group" aria-label="Mundos disponibles">
            {PLANTILLAS.map((p) => (
              <button
                key={p.id}
                aria-label={escenarioPorId(p.id).nombre}
                aria-pressed={p.id === plantilla}
                onClick={() => alElegir(p.id)}
              >
                <img src={miniaturas[p.id] ?? `/mundos/${p.id}.jpg`} alt="" />
                <span>{escenarioPorId(p.id).nombre}</span>
              </button>
            ))}
          </div>
          <button className="cr-boton cr-boton--prim cr-mundos-confirmar" onClick={alConfirmar}>
            Elegir esta sala <Tecla>↵</Tecla>
          </button>
          {fallos > 0 && (
            <p className="cr-mundos-aviso" role="status">
              Alguna sala no pudo prepararse. Puedes explorar y elegir igualmente.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
