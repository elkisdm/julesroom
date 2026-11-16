import { useState } from 'react';
import type { ResumenSala } from '@oficina/motor';
import { Tecla } from '../Tecla';
import { llegadaDisponible } from './estadoFlujo';
import { useTecladoFlujo } from './Flujo';
import { accionLlegada } from './biblioteca';
import { MisSalas } from './MisSalas';
import './llegada.css';

export function Llegada({
  lista,
  precarga,
  salas,
  miniaturas,
  error,
  alCrear,
  alAbrir,
  alRenombrar,
  alEliminar,
}: {
  lista: boolean;
  precarga: { porcentaje: number; fallos: number };
  salas: ResumenSala[];
  miniaturas: Record<string, string>;
  error: string;
  alCrear: () => void;
  alAbrir: (id: string) => void;
  alRenombrar: (id: string, nombre: string) => boolean;
  alEliminar: (id: string) => boolean;
}) {
  const [biblioteca, setBiblioteca] = useState(false);
  const disponible = llegadaDisponible({ terminada: lista, fallos: precarga.fallos });
  const acciones = accionLlegada(salas);
  const seguir = () => {
    if (disponible) {
      if (salas[0]) alAbrir(salas[0].id);
      else alCrear();
    }
  };
  useTecladoFlujo('llegada', seguir, undefined, !biblioteca);
  return (
    <section className="fl-llegada" aria-label="Bienvenido a Jules Room">
      <div className="fl-bienvenida">
        <h1>
          Jules Room<span aria-hidden="true">.</span>
        </h1>
        <p>Tu equipo y tus agentes, en un mismo lugar.</p>
        <div className="fl-acciones-llegada">
          <button
            className="cr-boton cr-boton--prim"
            onClick={seguir}
            disabled={!disponible}
            title={acciones.principal}
          >
            <span>{acciones.principal}</span> <Tecla>↵</Tecla>
          </button>
          {acciones.conSalas && disponible && (
            <div className="fl-acciones-secundarias">
              <button className="cr-boton" onClick={alCrear}>
                Crear una sala nueva
              </button>
              <button className="cr-boton" onClick={() => setBiblioteca(true)}>
                Mis salas <span aria-hidden="true">↗</span>
              </button>
            </div>
          )}
          <span className="fl-preparacion" role="status">
            {!lista
              ? 'Preparando tu lugar…'
              : error || (precarga.fallos ? 'Puedes seguir. Reintentaremos al abrir tu sala.' : '')}
          </span>
        </div>
      </div>
      {biblioteca && (
        <MisSalas
          salas={salas}
          miniaturas={miniaturas}
          error={error}
          alCerrar={() => setBiblioteca(false)}
          alAbrir={alAbrir}
          alRenombrar={alRenombrar}
          alEliminar={alEliminar}
        />
      )}
    </section>
  );
}
