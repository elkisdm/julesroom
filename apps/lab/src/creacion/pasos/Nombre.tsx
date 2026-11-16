import { useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { Proyector, SalaGuardada } from '@oficina/motor';
import { ID_YO, nombreSugerido } from '../plantillas';
import { Ancla } from '../Ancla';
import { Tecla } from '../Tecla';
import { PARAMETROS_FLUJO as P, validarNombre } from './estadoFlujo';
import { useTecladoFlujo } from './Flujo';
import { etiquetaVestidor } from './encuadreVestidor';
import type { ControlVestidor } from './Vestidor3D';
import './nombre.css';

export function Nombre({
  sala,
  alCambiar,
  alSeguir,
  alVolver,
  proyector,
  control,
  posicion,
}: {
  sala: SalaGuardada;
  alCambiar: (sala: SalaGuardada) => void;
  alSeguir: () => void;
  alVolver: () => void;
  proyector: MutableRefObject<Proyector | null>;
  control: MutableRefObject<ControlVestidor>;
  posicion: { x: number; y: number; z: number };
}) {
  const yo = sala.ocupantes.find((o) => o.id === ID_YO);
  const [valor, setValor] = useState(yo?.nombre === 'Tú' ? '' : (yo?.nombre ?? ''));
  const [mensaje, setMensaje] = useState('');
  const campo = useRef<HTMLInputElement>(null);
  useEffect(() => {
    campo.current?.focus({ preventScroll: true });
  }, []);
  const cambiar = (nombre: string) =>
    alCambiar({
      ...sala,
      ocupantes: sala.ocupantes.map((o) => (o.id === ID_YO ? { ...o, nombre: nombre || 'Tú' } : o)),
    });
  const seguir = () => {
    const v = validarNombre(valor);
    if (!v.valido) {
      setMensaje('Escribe tu nombre para presentarte.');
      campo.current?.focus();
      return;
    }
    alCambiar({
      ...sala,
      nombre: nombreSugerido(v.nombre),
      ocupantes: sala.ocupantes.map((o) => (o.id === ID_YO ? { ...o, nombre: v.nombre } : o)),
    });
    alSeguir();
  };
  useTecladoFlujo('nombre', seguir, alVolver);
  return (
    <div className="fl-nombre">
      <Ancla
        proyector={proyector}
        objetivo={() =>
          etiquetaVestidor(
            control.current.cabeza,
            posicion,
            Boolean(yo?.atuendo?.acc.includes('gorro')),
          )
        }
      >
        <span className="pv-nombre">{valor.trim() || 'Tú'}</span>
      </Ancla>
      <section className="fl-panel fl-nombre-panel" aria-label="Tu nombre">
        <h2>¿Cómo te llamas?</h2>
        <label htmlFor="fl-nombre">Así te verá tu equipo.</label>
        <input
          ref={campo}
          id="fl-nombre"
          autoComplete="given-name"
          placeholder="Tu nombre"
          value={valor}
          aria-invalid={Boolean(mensaje && !validarNombre(valor).valido)}
          aria-describedby="fl-nombre-ayuda"
          onChange={(e) => {
            const v = validarNombre(e.target.value);
            const limitado = Array.from(e.target.value).slice(0, P.nombreMaximo).join('');
            setValor(limitado);
            cambiar(limitado.trim());
            setMensaje(
              v.recortado ? `Tu nombre puede tener hasta ${P.nombreMaximo} caracteres.` : '',
            );
          }}
        />
        <div className="fl-ayuda">
          <span id="fl-nombre-ayuda" role="status">
            {mensaje || 'Puedes cambiarlo después.'}
          </span>
          <small>
            {Array.from(valor).length}/{P.nombreMaximo}
          </small>
        </div>
        <button className="cr-boton cr-boton--prim" onClick={seguir}>
          Ese soy yo <Tecla>↵</Tecla>
        </button>
      </section>
    </div>
  );
}
