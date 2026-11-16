import { useNavegacionOpciones } from './useNavegacionOpciones';
import { useState } from 'react';
import type { MutableRefObject } from 'react';
import { COLECCIONES, CONJUNTOS, aplicarConjunto } from '@oficina/motor';
import type { Atuendo } from '@oficina/motor';
import type { ControlVestidor } from './Vestidor3D';
import { claveConjunto } from './cacheMiniaturas';
import { filtrarCatalogo, recordarReciente } from '../construir/navegacionCatalogo';
import './catalogo-ropa.css';
const fichas = CONJUNTOS.map((c) => ({ ...c, categoria: c.coleccion }));
export function ColeccionesRopa({
  atuendo,
  imagenes,
  control,
  alElegir,
}: {
  atuendo: Atuendo;
  imagenes: Record<string, string>;
  control: MutableRefObject<ControlVestidor>;
  alElegir: (a: Atuendo) => void;
}) {
  const [abierto, setAbierto] = useState(false),
    [coleccion, setColeccion] = useState('oficina'),
    [busqueda, setBusqueda] = useState(''),
    [recientes, setRecientes] = useState<string[]>([]);
  const filtros = useNavegacionOpciones<HTMLDivElement>();
  const rejilla = useNavegacionOpciones<HTMLDivElement>();
  const items = filtrarCatalogo(fichas, busqueda, coleccion, recientes);
  control.current.conjuntos = abierto ? items.map((c) => c.id) : [];
  return (
    <div
      className="pv-colecciones"
      data-teclado-propio
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          setAbierto(false);
          e.currentTarget.querySelector('button')?.focus();
        }
      }}
    >
      <button className="cr-boton" aria-expanded={abierto} onClick={() => setAbierto(!abierto)}>
        Conjuntos · 24 <span aria-hidden="true">{abierto ? '−' : '+'}</span>
      </button>
      {abierto && (
        <>
          <label className="pv-buscar">
            Buscar conjuntos
            <input
              type="search"
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                if (e.target.value) setColeccion('');
              }}
              placeholder="Nombre del conjunto"
            />
          </label>
          <div ref={filtros} className="pv-filtros" role="group" aria-label="Colecciones">
            {[
              { id: '', nombre: 'Todos' },
              ...COLECCIONES,
              { id: 'recientes', nombre: 'Recientes' },
            ].map((c) => (
              <button
                key={c.id}
                aria-pressed={coleccion === c.id}
                onClick={() => setColeccion(c.id)}
              >
                {c.nombre}
              </button>
            ))}
          </div>
          <div ref={rejilla} className="pv-rejilla">
            {items.map((c) => (
              <button
                className="pv-conjunto"
                key={c.id}
                onClick={() => {
                  alElegir(aplicarConjunto(atuendo, c.id));
                  setRecientes((r) => recordarReciente(r, c.id));
                }}
                aria-label={c.nombre}
              >
                {imagenes[claveConjunto(c.id, atuendo)] ? (
                  <img src={imagenes[claveConjunto(c.id, atuendo)]} alt="" />
                ) : (
                  <span className="pv-preparando">…</span>
                )}
                <span>{c.nombre}</span>
              </button>
            ))}
          </div>
          {!items.length && <p>No hay conjuntos aquí. Prueba otra búsqueda.</p>}
        </>
      )}
    </div>
  );
}
