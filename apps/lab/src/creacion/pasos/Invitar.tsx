import { useState } from 'react';
import { Tecla } from '../Tecla';

import { useTecladoFlujo } from './Flujo';
import { LlaveDemo, type EntradaDemo } from '../envivo/LlaveDemo';
import { avisoInvitar } from '../envivo/sinServidor';
import './invitar.css';

export function Invitar({
  enlace,
  alEntrar,
  alVolver,
  demo,
  personas,
  nombreSala,
}: {
  enlace: string | null;
  demo?: EntradaDemo;
  personas?: number;
  nombreSala?: string;
  alEntrar: () => void;
  alVolver: () => void;
}) {
  const [estado, setEstado] = useState('');
  useTecladoFlujo('invitar', alEntrar, alVolver);
  const copiar = async () => {
    if (!enlace) return;
    try {
      await navigator.clipboard.writeText(enlace);
      setEstado('Enlace copiado.');
    } catch (error) {
      console.error('No se pudo copiar el enlace', error);
      setEstado('No se pudo copiar. Puedes seleccionar el enlace.');
    }
  };
  return (
    <section className="fl-panel fl-invitar" aria-label="Invitar y entrar">
      <p>Ya tienes tu lugar.</p>
      <h2>Nos vemos dentro.</h2>
      {enlace === null ? (
        <span className="fl-copia">{avisoInvitar(false)}</span>
      ) : (
        <>
          <label htmlFor="fl-enlace">Un enlace para tu equipo</label>
          <div className="fl-enlace">
            <input
              id="fl-enlace"
              placeholder="Conectando la sala…"
              readOnly
              value={enlace}
              onFocus={(e) => e.target.select()}
            />
            <button
              className="cr-boton cr-boton--chico"
              disabled={!enlace}
              onClick={() => void copiar()}
            >
              {estado === 'Enlace copiado.' ? 'Copiado ✓' : 'Copiar enlace'}
            </button>
          </div>
          <span className="fl-copia" role="status">
            {estado ||
              (enlace
                ? 'Abre este enlace en otro navegador. Entra primero para compartir tu mundo.'
                : 'Conectando la sala…')}
          </span>
        </>
      )}
      {personas !== undefined && <p role="status">{personas} en la sala</p>}
      {enlace && nombreSala && (
        <p className="fl-copia" style={{ overflowWrap: 'anywhere' }}>
          Te invito a {nombreSala}. Entra aquí: {enlace}
        </p>
      )}
      {demo && <LlaveDemo {...demo} />}
      <button className="cr-boton cr-boton--prim" onClick={alEntrar}>
        Entrar a la sala <Tecla>↵</Tecla>
      </button>
    </section>
  );
}
