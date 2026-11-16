import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { conectarD2 } from './dinamica/conexion';
import { LlaveDemo } from './LlaveDemo';
import { estadoAnfitrion } from './configuracion';
import type { FuenteLiveKit } from '@oficina/presencia';

export function Presencia({
  fuente,
  enlace,
  esperando,
  dueno,
  invitado,
  errorConexion = '',
  publica = false,
  llaveDemo = '',
  alLlaveDemo,
}: {
  fuente: FuenteLiveKit | null;
  enlace: string;
  esperando: boolean;
  dueno: string;
  invitado: boolean;
  errorConexion?: string;
  publica?: boolean;
  llaveDemo?: string;
  alLlaveDemo?: (llave: string) => void;
}) {
  useEffect(() => {
    conectarD2({ fuente, dueno, invitado });
    return () => conectarD2({ fuente: null, dueno: '' });
  }, [fuente, dueno, invitado]);
  const [copiado, setCopiado] = useState('');
  const [error, setError] = useState('');
  const [explicar, setExplicar] = useState(false);
  const [anuncio, setAnuncio] = useState('');
  const anteriores = useRef(new Map<string, string>());
  const [nivel, setNivel] = useState(0);
  const foto = useSyncExternalStore(
    fuente?.suscribirInstantanea ?? (() => () => undefined),
    fuente?.instantanea ?? (() => null),
  );
  useEffect(() => {
    if (!fuente) return;
    const t = setInterval(() => setNivel(fuente.nivelPropio()), 100);
    return () => clearInterval(t);
  }, [fuente]);
  useEffect(() => {
    const nombres = new Map(fuente?.personas().map((p) => [p.id, p.nombre]) ?? []);
    for (const [id, nombre] of nombres)
      if (!anteriores.current.has(id)) setAnuncio(`${nombre} entró a la sala.`);
    for (const [id, nombre] of anteriores.current)
      if (!nombres.has(id)) setAnuncio(`${nombre} salió de la sala.`);
    anteriores.current = nombres;
  }, [foto, fuente]);
  useEffect(() => {
    if (!anuncio) return;
    const t = setTimeout(() => setAnuncio(''), 2600);
    return () => clearTimeout(t);
  }, [anuncio]);
  const microfono = async () => {
    if (!fuente) return;
    try {
      setError('');
      if (foto?.microfono) await fuente.silenciarPropio(!foto.silenciadoPropio);
      else await fuente.activarMicrofono();
      setExplicar(false);
    } catch {
      setError(
        'No pudimos activar tu micrófono. Revisa el permiso en la barra del navegador y vuelve a intentarlo.',
      );
    }
  };
  return (
    <aside className="ev-presencia" aria-label="Personas en la sala">
      <details>
        <summary>
          {foto?.conexion === 'conectado'
            ? `${(foto?.personas ?? 0) + 1} en la sala`
            : 'Tu sala · individual'}
        </summary>
        <ul aria-label="Presentes">
          <li>Tú</li>
          {fuente?.personas().map((p) => (
            <li key={p.id}>
              {p.nombre}
              {fuente.hablandoIds.has(p.id) ? ' · hablando' : ''}
            </li>
          ))}
        </ul>
        <label htmlFor="ev-enlace">Invitar a esta sala</label>
        <input
          id="ev-enlace"
          value={enlace}
          placeholder="Conectando la sala…"
          readOnly
          onFocus={(e) => e.currentTarget.select()}
        />
        <button
          className="cr-boton cr-boton--chico"
          disabled={!enlace}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(enlace);
              setCopiado('Enlace copiado');
            } catch {
              setCopiado('Selecciona y copia el enlace');
            }
          }}
        >
          {copiado || 'Copiar enlace'}
        </button>
      </details>
      {foto?.error?.includes('llena') && <p role="status">{foto.error}</p>}
      {estadoAnfitrion(
        invitado,
        Boolean(fuente?.personas().some((p) => p.id === dueno)),
        !esperando,
      ) && (
        <p role="status">
          {estadoAnfitrion(
            invitado,
            Boolean(fuente?.personas().some((p) => p.id === dueno)),
            !esperando,
          )}
        </p>
      )}
      {publica && alLlaveDemo ? (
        <LlaveDemo error={errorConexion} llave={llaveDemo} alLlave={alLlaveDemo} />
      ) : (
        errorConexion && <p role="alert">{errorConexion}</p>
      )}
      {import.meta.env.VITE_SALA_SIN_VOZ === '1' ? (
        <p>La voz va por Meet.</p>
      ) : (
        foto?.conexion === 'conectado' && (
          <>
            <button
              className="cr-boton cr-boton--chico"
              aria-pressed={foto.microfono && !foto.silenciadoPropio}
              onClick={() => (foto.microfono ? void microfono() : setExplicar(!explicar))}
            >
              {!foto.microfono
                ? 'Usar mi voz'
                : foto.silenciadoPropio
                  ? 'Activar mi voz'
                  : 'Silenciar mi voz'}
            </button>
            {foto.microfono && (
              <meter aria-label="Nivel de tu micrófono" min={0} max={1} value={nivel} />
            )}
            {explicar && (
              <div className="ev-permiso">
                <p>
                  Tu voz se oye cerca de ti y se desvanece al alejarte. Puedes silenciarla cuando
                  quieras.
                </p>
                <button
                  className="cr-boton cr-boton--prim cr-boton--chico"
                  onClick={() => void microfono()}
                >
                  Permitir micrófono
                </button>
                <button className="cr-boton cr-boton--chico" onClick={() => setExplicar(false)}>
                  Ahora no
                </button>
              </div>
            )}
            {foto.cercanos.map((p) => (
              <p className="ev-oyendo" key={p.id}>
                {p.nombre} · {p.oyendo ? 'se oye cerca' : 'fuera de alcance'}
              </p>
            ))}
          </>
        )
      )}
      {anuncio && (
        <p className="ev-movimiento" role="status">
          {anuncio}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </aside>
  );
}
