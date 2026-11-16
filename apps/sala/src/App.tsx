import { useState } from 'react';
import { escenarioPorId, hayEscenario } from '@oficina/motor';
import type { Atuendo } from '@oficina/motor';
import { APARIENCIAS, atuendoDe, nuevaIdentidad } from './identidad';
import { Sala } from './Sala';

const params = new URLSearchParams(window.location.search);
const ESCENARIO = hayEscenario(params.get('escenario') ?? '')
  ? (params.get('escenario') as string)
  : 'trading';
const SALA = (params.get('sala') ?? 'demo').slice(0, 24);

export interface Entrada {
  id: string;
  nombre: string;
  atuendo: Atuendo;
}

/** Pantalla de entrada (nombre y apariencia rápida) y, después, la sala. */
export function App() {
  const [entrada, setEntrada] = useState<Entrada | null>(() => {
    // Atajo para pruebas automáticas: ?nombre=Ana&rol=Backend entra directo.
    const nombre = params.get('nombre');
    if (!nombre) return null;
    const rol = params.get('rol') ?? 'Backend';
    return {
      id: nuevaIdentidad(),
      nombre: nombre.slice(0, 40),
      atuendo: atuendoDe(rol, Number(params.get('v') ?? 0)),
    };
  });
  if (entrada) return <Sala entrada={entrada} sala={SALA} escenario={ESCENARIO} />;
  return <Ingreso alEntrar={setEntrada} />;
}

function Ingreso({ alEntrar }: { alEntrar: (e: Entrada) => void }) {
  const [nombre, setNombre] = useState('');
  const [indice, setIndice] = useState(0);
  const [variante, setVariante] = useState(() => Math.floor(Math.random() * 20));
  const apariencia = APARIENCIAS[indice] ?? APARIENCIAS[0];
  const valido = nombre.trim().length > 0;
  const nombreEscenario = escenarioPorId(ESCENARIO).nombre;

  return (
    <main className="ing">
      <form
        className="ing-tarjeta"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valido) return;
          alEntrar({
            id: nuevaIdentidad(),
            nombre: nombre.trim().slice(0, 40),
            atuendo: atuendoDe(apariencia.rol, variante),
          });
        }}
      >
        <h1>Entrar a la sala</h1>
        <p className="ing-sub">
          {nombreEscenario} · sala «{SALA}»
        </p>
        <label className="ing-campo">
          Tu nombre
          <input
            autoFocus
            value={nombre}
            maxLength={40}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Cómo te verán los demás"
          />
        </label>
        <fieldset className="ing-aspecto">
          <legend>Apariencia</legend>
          <div className="ing-fichas" role="radiogroup" aria-label="Apariencia">
            {APARIENCIAS.map((a, i) => (
              <button
                type="button"
                key={a.rol}
                role="radio"
                aria-checked={i === indice}
                className={i === indice ? 'ficha activa' : 'ficha'}
                onClick={() => setIndice(i)}
              >
                <span className="ficha-color" style={{ background: a.color }} />
                {a.etiqueta}
              </button>
            ))}
          </div>
          <button type="button" className="ing-otra" onClick={() => setVariante((v) => v + 1)}>
            Probar otra cara y peinado
          </button>
        </fieldset>
        <button type="submit" className="ing-entrar" disabled={!valido}>
          Entrar
        </button>
        <p className="ing-nota">El micrófono se pide después, cuando tú lo actives.</p>
      </form>
    </main>
  );
}
