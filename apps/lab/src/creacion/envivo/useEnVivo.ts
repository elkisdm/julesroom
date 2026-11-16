import { sinVoz, fuenteSinVoz, PARAMETROS_SIN_VOZ } from './sinVoz';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { FuenteLiveKit, EstadoPropio } from '@oficina/presencia';
import type { SalaGuardada } from '@oficina/motor';
import { asegurarSala, recuperarSala } from './recuperacion';
import { crearEnrutador } from './enrutado';
import {
  autorizarSesion,
  configuracionViva,
  enlacePublico,
  ErrorDemo,
  esperaDemo,
  ERROR_RED_DEMO,
  mensajeConexion,
  solicitarDemo,
} from './configuracion';
import { aceptarMundo, enlaceSala, LIMITES_VIVO, mezclarSala, type BurbujaViva } from './protocolo';

declare global {
  interface Window {
    __vivo?: {
      fuente: FuenteLiveKit | null;
      sesion: SesionViva;
      recibida: boolean;
      burbuja: BurbujaViva | null;
    };
  }
}
export interface SesionViva {
  sala: string;
  yo: string;
  dueno: string;
  invitado: boolean;
  enlace: string;
}
/** Identidad por pestaña: el enlace nunca concede el rol del dueño. */
export function crearSesion(): SesionViva {
  const config = configuracionViva(import.meta.env);
  const q = new URLSearchParams(location.search);
  const valido = (v: string | null) => (v && /^[\w-]{1,64}$/.test(v) ? v : null);
  const sala = valido(q.get('sala')) ?? crypto.randomUUID();
  const yo = sessionStorage.getItem(`vivo/${sala}`) ?? crypto.randomUUID();
  sessionStorage.setItem(`vivo/${sala}`, yo);
  const dueno = config && !config.local ? '' : (valido(q.get('dueno')) ?? yo);
  // En público, el emisor autoriza la sesión antes de ofrecer un enlace.
  return {
    sala,
    yo,
    dueno,
    invitado:
      config && !config.local
        ? q.has('sala') && !localStorage.getItem(`demo/dueno/${sala}`)
        : dueno !== yo,
    enlace: config && !config.local ? '' : enlaceSala(location.href, sala, dueno),
  };
}

export function useEnVivo(
  activo: boolean,
  sala: SalaGuardada,
  aplicar: (s: SalaGuardada) => void,
  idGuardada: string,
) {
  const [sesion, setSesion] = useState(crearSesion);
  const sesionActual = useRef(sesion);
  const config = configuracionViva(import.meta.env);
  const [error, setError] = useState('');
  const [llaveDemo, cambiarLlaveDemo] = useState(() => sessionStorage.getItem('demo/llave') ?? '');
  const setLlaveDemo = (llave: string) => {
    sessionStorage.setItem('demo/llave', llave);
    cambiarLlaveDemo(llave);
  };
  const documento = idGuardada;
  const entradaInicial = useRef({
    guardada: idGuardada,
    invitacion: new URLSearchParams(location.search).get('sala'),
  });
  const [fuente, setFuente] = useState<FuenteLiveKit | null>(null);
  const [recibida, setRecibida] = useState(!sesion.invitado);
  const [nombreSala, setNombreSala] = useState(
    () => sessionStorage.getItem(`demo/nombre/${sesion.sala}`) ?? '',
  );
  const [anfitrion, setAnfitrion] = useState(
    () => sessionStorage.getItem(`demo/anfitrion/${sesion.sala}`) ?? '',
  );
  const [burbuja, setBurbuja] = useState<BurbujaViva | null>(null);
  const ultima = useRef({ sala, aplicar });
  ultima.current = { sala, aplicar };
  const estado = useRef<EstadoPropio | null>(null);
  const revision = useRef(0);
  const emitida = useRef('');
  const transmitir = useRef<(p: object) => void>(() => undefined);

  useEffect(() => {
    if (!activo || !config) return;
    let viva = true;
    let intentos = 0;
    let f: FuenteLiveKit | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    let reintento: ReturnType<typeof setTimeout> | undefined;
    let desuscribir: (() => void) | undefined;
    const iniciar = async () => {
      try {
        // El proxy devuelve 204 si falta el servidor local; la sala individual sigue disponible.
        const salud = await fetch(`${config.emisor}/salud`, { signal: AbortSignal.timeout(1500) });
        if (!viva) return;
        if (!salud.ok || salud.status === 204) {
          throw new ErrorDemo(ERROR_RED_DEMO, true);
        }
        const { crearFuenteLiveKit } = await import('@oficina/presencia');
        if (!viva) return;
        const yo = ultima.current.sala.ocupantes.find((o) => o.id === 'yo')!;
        let actual = sesionActual.current;
        const post = async (ruta: string, datos: object) => {
          try {
            return await solicitarDemo(config.emisor, ruta, datos);
          } catch (causa) {
            if (viva) setError(mensajeConexion(causa));
            throw causa;
          }
        };
        if (!config.local) {
          const invitacion =
            entradaInicial.current.guardada === idGuardada
              ? entradaInicial.current.invitacion
              : null;
          let idSala = invitacion || recuperarSala(localStorage, idGuardada);
          if (!idSala) {
            idSala = await asegurarSala(localStorage, idGuardada, () =>
              post('salas', { ...(llaveDemo ? { llaveDemo } : {}) }),
            );
          }
          if (!viva) return;
          actual = { ...actual, sala: idSala!, enlace: enlacePublico(location.href, idSala!) };
          sesionActual.current = actual;
        }
        const obtenerPase = async () => {
          if (config.local) {
            const q = new URLSearchParams({
              sala: actual.sala,
              identidad: actual.yo,
              nombre: yo.nombre,
            });
            const r = await fetch(`${config.emisor}/token?${q}`);
            if (!r.ok) throw new Error('No se pudo entrar.');
            return (await r.json()).token as string;
          }
          const clave = `demo/pestana/${actual.sala}`;
          const identidad = sessionStorage.getItem(clave) ?? crypto.randomUUID();
          sessionStorage.setItem(clave, identidad);
          const secretoDueno = localStorage.getItem(`demo/dueno/${actual.sala}`);
          const pase = await post('pases', {
            sala: actual.sala,
            identidad,
            nombre: yo.nombre,
            ...(secretoDueno ? { secretoDueno } : {}),
            ...(llaveDemo ? { llaveDemo } : {}),
          });
          if (!viva) throw new Error('Entrada cancelada.');
          const autorizada = autorizarSesion(pase);
          if (!autorizada) throw new Error('El emisor devolvió un pase inválido.');
          actual = { ...autorizada, enlace: enlacePublico(location.href, autorizada.sala) };
          sesionActual.current = actual;
          setSesion(actual);
          if (!actual.invitado) setRecibida(true);
          setError('');
          return pase.token as string;
        };
        const primerToken = await obtenerPase();
        if (!viva) return;
        f = crearFuenteLiveKit({
          url: config.url,
          rtcConfig: config.rtcConfig,
          obtenerToken: (() => {
            let primero = true;
            return async () => {
              if (primero) {
                primero = false;
                return primerToken;
              }
              return obtenerPase();
            };
          })(),
          yo: { id: actual.yo, nombre: yo.nombre, atuendo: yo.atuendo!, escenario: 'sala-en-vivo' },
          parametros: {
            fuente: { topeSala: config.local ? LIMITES_VIVO.personas : LIMITES_VIVO.personasDemo },
            ...(sinVoz(import.meta.env) ? { voz: PARAMETROS_SIN_VOZ } : {}),
          },
        });
        if (sinVoz(import.meta.env)) f = fuenteSinVoz(f);
        const fuente = f;
        transmitir.current = (p) => {
          void fuente.enviarDatos(JSON.stringify(p)).catch(() => {
            /* Reconexión: la siguiente foto/revisión se reenvía. */
          });
        };
        const enrutador = crearEnrutador();
        desuscribir = f.suscribirDatos((texto, emisor) => {
          const p = enrutador.recibir(texto, emisor, ultima.current.sala, [
            ...fuente.personas().map((p) => p.id),
            actual.dueno,
          ]);
          if (!p) return;
          if (p.tipo === 'pedir' && !actual.invitado) {
            transmitir.current({
              tipo: 'mundo',
              revision: Math.max(1, revision.current),
              sala: ultima.current.sala,
            });
          } else if (
            p.tipo === 'mundo' &&
            actual.invitado &&
            aceptarMundo(p, emisor, actual.dueno, revision.current)
          ) {
            revision.current = p.revision;
            ultima.current.aplicar(mezclarSala(p.sala, ultima.current.sala));
            setRecibida(true);
            setNombreSala(p.sala.nombre);
            sessionStorage.setItem(`demo/nombre/${actual.sala}`, p.sala.nombre);
            const nombreDueno =
              fuente.personas().find((p) => p.id === actual.dueno)?.nombre ??
              p.sala.ocupantes.find((o) => o.id === 'yo')?.nombre;
            if (nombreDueno) {
              setAnfitrion(nombreDueno);
              sessionStorage.setItem(`demo/anfitrion/${actual.sala}`, nombreDueno);
            }
          } else if (
            p.tipo === 'burbuja' &&
            ultima.current.sala.ocupantes.some((o) => o.tipo === 'agente' && o.id === p.agente)
          ) {
            setBurbuja(p);
          }
        });
        try {
          await f.conectar();
        } catch (causa) {
          // El intento inicial lo gestiona este efecto; evita dos bucles de reconexión.
          desuscribir?.();
          await f.desconectar();
          setFuente(null);
          throw causa;
        }
        intentos = 0;
        if (!viva) {
          await f.desconectar();
          return;
        }
        setFuente(f);
        const enviar = () => {
          if (estado.current) fuente.publicarPropio(estado.current);
          if (actual.invitado) transmitir.current({ tipo: 'pedir' });
          else {
            const serial = JSON.stringify(ultima.current.sala);
            if (serial !== emitida.current) {
              emitida.current = serial;
              revision.current = Math.max(revision.current + 1, Date.now());
            }
            transmitir.current({
              tipo: 'mundo',
              revision: Math.max(1, revision.current),
              sala: ultima.current.sala,
            });
          }
        };
        enviar();
        timer = setInterval(enviar, LIMITES_VIVO.pedirCadaMs);
      } catch (causa) {
        if (viva) setError(mensajeConexion(causa));
        if (viva && (!(causa instanceof ErrorDemo) || causa.reintentar))
          reintento = setTimeout(
            iniciar,
            esperaDemo(intentos++),
          ); /* Sin servicios locales, la sala individual sigue disponible. */
      }
    };
    void iniciar();
    return () => {
      viva = false;
      clearInterval(timer);
      clearTimeout(reintento);
      desuscribir?.();
      transmitir.current = () => undefined;
      if (f) void f.desconectar();
      setFuente(null);
    };
  }, [activo, llaveDemo, documento]);

  const perfil = sala.ocupantes.find((o) => o.id === 'yo');
  const atuendoPerfil = JSON.stringify(perfil?.atuendo);
  useEffect(() => {
    if (perfil?.atuendo) fuente?.cambiarPerfil({ nombre: perfil.nombre, atuendo: perfil.atuendo });
  }, [fuente, perfil?.nombre, atuendoPerfil]);

  useEffect(() => {
    if (import.meta.env.DEV) window.__vivo = { fuente, sesion, recibida, burbuja };
    return () => {
      delete window.__vivo;
    };
  }, [fuente, sesion, recibida, burbuja]);
  const foto = useSyncExternalStore(
    fuente?.suscribirInstantanea ?? (() => () => undefined),
    fuente?.instantanea ?? (() => null),
  );
  return {
    sesion,
    nombreSala,
    anfitrion,
    personas: foto?.conexion === 'conectado' ? foto.personas + 1 : undefined,
    error: error || (foto?.error ? mensajeConexion(new Error(foto.error)) : ''),
    publica: Boolean(config && !config.local),
    llaveDemo,
    setLlaveDemo,
    fuente,
    recibida,
    burbuja,
    publicar: (e: EstadoPropio) => {
      estado.current = e;
      fuente?.publicarPropio(e);
    },
    emitirBurbuja: (b: BurbujaViva) => {
      setBurbuja(b);
      transmitir.current(b);
    },
  };
}
