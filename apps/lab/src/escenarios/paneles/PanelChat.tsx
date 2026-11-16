import { useEffect, useRef, useState } from 'react';
import type { Mensaje } from './chat';
import { Hoja } from './Hoja';
import type { PropsHoja } from './tipos';

/** Chat escrito de la zona donde estás: las personas conversan entre sí; los agentes no participan. */
export function PanelChat({
  lugar,
  mensajes,
  alEnviar,
  ...hoja
}: {
  lugar: string;
  mensajes: readonly Mensaje[];
  alEnviar: (texto: string) => void;
} & PropsHoja) {
  const [texto, setTexto] = useState('');
  const lista = useRef<HTMLOListElement>(null);
  useEffect(() => {
    lista.current?.scrollTo({ top: lista.current.scrollHeight });
  }, [mensajes.length]);

  return (
    <Hoja titulo={`Chat · ${lugar}`} bajada="Conversación de esta parte de la sala." {...hoja}>
      <ol ref={lista} className="pn-chat" aria-live="polite" aria-label="Mensajes">
        {mensajes.map((m) => (
          <li key={m.id} data-propio={m.propio || undefined}>
            <span className="pn-meta">{m.hora}</span>
            {m.propio ? (
              <p>{m.texto}</p>
            ) : (
              <p>
                <b>{m.autor}:</b> {m.texto}
              </p>
            )}
          </li>
        ))}
      </ol>
      <form
        className="pn-chat-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!texto.trim()) return;
          alEnviar(texto);
          setTexto('');
        }}
      >
        <input
          type="text"
          value={texto}
          maxLength={280}
          aria-label={`Escribe en ${lugar}`}
          placeholder={`Escribe en ${lugar}`}
          onChange={(e) => setTexto(e.target.value)}
        />
        <button type="submit" className="pn-boton" data-principal disabled={!texto.trim()}>
          Enviar
        </button>
      </form>
    </Hoja>
  );
}
