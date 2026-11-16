import { useId, useState } from 'react';
import './llave-demo.css';
import { mensajeLlave } from './mensajeLlave';

export interface EntradaDemo {
  error: string;
  llave: string;
  alLlave: (llave: string) => void;
}

/** El código sólo vive durante la pestaña y se envía al confirmar el formulario. */
export function LlaveDemo({ error, llave, alLlave }: EntradaDemo) {
  const [texto, setTexto] = useState(llave);
  const id = useId();
  if (!error) return null;
  return (
    <>
      <p id={`${id}-error`} role="alert">
        {mensajeLlave(error, llave)}
      </p>
      {/llave/i.test(error) && (
        <form
          className="ev-llave-demo"
          onSubmit={(e) => {
            e.preventDefault();
            alLlave(texto);
          }}
        >
          <label htmlFor={id}>Llave de demo (si te la compartieron)</label>
          <input
            id={id}
            type="password"
            aria-invalid={Boolean(llave.trim())}
            aria-describedby={`${id}-error`}
            autoComplete="off"
            value={texto}
            maxLength={128}
            onChange={(e) => setTexto(e.target.value)}
          />
          <button className="cr-boton cr-boton--chico">Entrar con la llave</button>
        </form>
      )}
    </>
  );
}
