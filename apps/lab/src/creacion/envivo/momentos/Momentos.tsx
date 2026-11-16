import { useEffect, useMemo, useRef, useState } from 'react';
import { InterfazMomentos } from './InterfazMomentos';
import { CapturaMomento, EfectosMomento } from '@oficina/motor';
import type { Proyector, Punto3, SalaGuardada, SolicitudFoto } from '@oficina/motor';
import type { FuenteLiveKit } from '@oficina/presencia';
import type { SesionViva } from '../useEnVivo';
import { crearMomento, crearReceptorMomentos, segundosRestantes } from './protocolo';
import type { AccionMomento, Momento } from './protocolo';
import { PanelMomentos } from './PanelMomentos';
import './momentos.css';
const UI = { refrescoMs: 100, flashMs: 180, avisoMs: 5000 };
interface Foto {
  blob: Blob;
  url: string;
  amplia: boolean;
}

/** Se monta dentro de Oficina; el portal deja la interfaz fuera del lienzo capturado. */
export function Momentos({
  fuente,
  sesion,
  sala,
  proyector,
}: {
  fuente: FuenteLiveKit | null;
  sesion: SesionViva;
  sala: SalaGuardada;
  proyector: { current: Proyector | null };
}) {
  const [ahora, setAhora] = useState(Date.now());
  const [foto, setFoto] = useState<Momento | null>(null);
  const [temporizador, setTemporizador] = useState<Momento | null>(null);
  const [celebrar, setCelebrar] = useState<Momento | null>(null);
  const [bienvenida, setBienvenida] = useState<Momento | null>(null);
  const [atencion, setAtencion] = useState(false);
  const [solicitud, setSolicitud] = useState<SolicitudFoto | null>(null);
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [aviso, setAviso] = useState('');
  const [flash, setFlash] = useState(false);
  const urls = useRef<string[]>([]);
  const capturada = useRef(0);
  const recibir = useMemo(() => crearReceptorMomentos(sesion.dueno), [sesion.dueno, fuente]);
  const anfitrion = !sesion.invitado && Boolean(sesion.dueno) && sesion.yo === sesion.dueno;
  const conectado = Boolean(fuente?.instantanea().conexion === 'conectado');
  const aplicar = (p: Momento) => {
    if (p.accion === 'foto') setFoto(p);
    else if (p.accion === 'temporizador') setTemporizador(p);
    else if (p.accion === 'celebrar') setCelebrar(p);
    else if (p.accion === 'bienvenida') setBienvenida(p);
    else setAtencion(p.accion === 'atencion');
  };
  useEffect(
    () =>
      fuente?.suscribirDatos((texto, emisor) => {
        const p = recibir(texto, emisor, Date.now());
        if (p) aplicar(p);
      }),
    [fuente, recibir],
  );
  useEffect(() => {
    const timer = setInterval(() => setAhora(Date.now()), UI.refrescoMs);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!aviso) return;
    const timer = setTimeout(() => setAviso(''), UI.avisoMs);
    return () => clearTimeout(timer);
  }, [aviso]);
  useEffect(
    () => () => {
      for (const url of urls.current) URL.revokeObjectURL(url);
    },
    [],
  );
  const posicion = (id: string): Punto3 | null =>
    proyector.current?.mundo(id) ?? fuente?.personas().find((p) => p.id === id) ?? null;
  useEffect(() => {
    if (!foto || ahora < foto.fin || capturada.current === foto.inicio) return;
    capturada.current = foto.inicio;
    // Una pestaña suspendida no toma una foto tardía que ya no corresponde al instante compartido.
    if (ahora - foto.fin > UI.avisoMs) {
      setFoto(null);
      return;
    }
    for (const url of urls.current) URL.revokeObjectURL(url);
    urls.current = [];
    setFotos([]);
    setFlash(true);
    setSolicitud({
      id: foto.inicio,
      nombre: sala.nombre,
      fecha: foto.fin,
      amplia: anfitrion,
      puntos: () =>
        [sesion.yo, ...(fuente?.personas().map((p) => p.id) ?? [])]
          .map(posicion)
          .filter((p): p is Punto3 => p !== null),
      alFoto: (blob, amplia) => {
        const url = URL.createObjectURL(blob);
        urls.current.push(url);
        setFotos((prev) => [...prev, { blob, url, amplia }]);
      },
      alError: setAviso,
    });
    const timer = setTimeout(() => {
      setFlash(false);
      setFoto(null);
    }, UI.flashMs);
    return () => {
      clearTimeout(timer);
      setFlash(false);
    };
  }, [foto, ahora >= (foto?.fin ?? Infinity)]);
  const emitir = async (accion: AccionMomento, opciones = {}) => {
    if (!anfitrion || !fuente || !conectado) return;
    try {
      const p = crearMomento(accion, Date.now(), opciones);
      const texto = JSON.stringify(p);
      if (!recibir(texto, sesion.yo, Date.now())) {
        setAviso('Espera unos segundos antes de repetir este momento.');
        return;
      }
      try {
        await fuente.enviarDatos(texto);
      } catch {
        throw new Error('No pudimos compartir el momento. Inténtalo otra vez.');
      }
      aplicar(p);
    } catch (error) {
      setAviso(
        error instanceof Error
          ? error.message
          : 'No pudimos compartir el momento. Inténtalo otra vez.',
      );
    }
  };
  const segundos = temporizador ? segundosRestantes(temporizador.fin, ahora) : 0;
  const cuenta = foto ? segundosRestantes(foto.fin, ahora) : 0;
  return (
    <>
      <CapturaMomento solicitud={solicitud} />
      <EfectosMomento
        celebrar={celebrar && celebrar.fin > ahora ? celebrar : null}
        atencion={atencion}
        anfitrion={() => posicion(sesion.dueno)}
      />
      <InterfazMomentos>
        <div className="d5-ui">
          {anfitrion && (
            <PanelMomentos
              habilitado={conectado}
              atencion={atencion}
              emitir={(a, o) => void emitir(a, o)}
            />
          )}
          {cuenta > 0 && (
            <div className="d5-cuenta" role="status" aria-live="assertive">
              <small>Foto de grupo</small>
              <strong key={cuenta}>{cuenta}</strong>
              <span>Mira a la cámara</span>
            </div>
          )}
          {flash && <div className="d5-flash" aria-hidden="true" />}
          {temporizador && ahora < temporizador.fin + UI.avisoMs && (
            <div
              className="d5-reloj"
              role="timer"
              aria-label={temporizador.texto || 'Temporizador'}
            >
              <span>{temporizador.texto || 'Tiempo juntos'}</span>
              <strong>
                {segundos > 0
                  ? `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`
                  : 'Tiempo cumplido'}
              </strong>
              {segundos === 0 && <span role="status">Ya puedes continuar</span>}
            </div>
          )}
          {bienvenida && bienvenida.fin > ahora && (
            <div className="d5-bienvenida" role="status">
              {bienvenida.texto}
            </div>
          )}
          {fotos.length > 0 && (
            <section className="d5-fotos" aria-label="Tu foto de grupo">
              <div className="d5-cabecera">
                <h2>Un recuerdo de esta sala</h2>
                <button
                  className="cr-boton cr-boton--chico"
                  aria-label="Cerrar fotos"
                  onClick={() => {
                    setFotos([]);
                    for (const url of urls.current) URL.revokeObjectURL(url);
                    urls.current = [];
                  }}
                >
                  ×
                </button>
              </div>
              {fotos.map((f) => (
                <div className="d5-foto" key={f.url}>
                  <img
                    src={f.url}
                    alt={
                      f.amplia
                        ? 'Toma amplia de todos los presentes'
                        : 'Foto de grupo desde tu vista'
                    }
                  />
                  <div className="d5-fila">
                    <span>{f.amplia ? 'Todos juntos' : 'Tu vista'}</span>
                    <a
                      className="cr-boton cr-boton--chico"
                      href={f.url}
                      download={`foto-grupo-${f.amplia ? 'amplia' : 'mi-vista'}.png`}
                    >
                      Guardar foto
                    </a>
                    <button
                      className="cr-boton cr-boton--chico"
                      onClick={async () => {
                        try {
                          if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined')
                            throw new Error(
                              'Tu navegador no permite copiar imágenes. Usa Guardar foto.',
                            );
                          await navigator.clipboard.write([
                            new ClipboardItem({ 'image/png': f.blob }),
                          ]);
                          setAviso('Foto copiada');
                        } catch {
                          setAviso('No pudimos copiar la imagen. Usa Guardar foto.');
                        }
                      }}
                    >
                      Copiar
                    </button>
                  </div>
                </div>
              ))}
            </section>
          )}
          {aviso && (
            <p className="d5-aviso" role="status">
              {aviso}
            </p>
          )}
        </div>
      </InterfazMomentos>
    </>
  );
}
