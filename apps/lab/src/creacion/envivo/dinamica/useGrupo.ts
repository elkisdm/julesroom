import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import {
  conSueloExtra,
  fijarDestino,
  type Escenario,
  type Mando,
  type Proyector,
  type SalaGuardada,
} from '@oficina/motor';
import { espacioD2 } from '@oficina/motor';
import { suelosDeObjetos } from '../../construir/solidos';
import { D2, formarPublico, leerD2, type OrdenD2, type PuntoD2 } from './modelo';
import { useConexionD2 } from './conexion';

type Llamada = Extract<OrdenD2, { tipo: 'd2-llamada' }>;
export interface PropsGrupo {
  escenario: Escenario;
  sala: SalaGuardada;
  avatar: Pick<PuntoD2, 'x' | 'y' | 'z'>;
  mando: Mando;
  proyector: MutableRefObject<Proyector | null>;
}
export function useGrupo({ escenario, sala, avatar, mando, proyector }: PropsGrupo) {
  const conexion = useConexionD2();
  const { fuente, yo, dueno, invitado } = conexion;
  const [llamada, setLlamada] = useState<Llamada | null>(null);
  const pendiente = useRef<{ orden: Llamada; vence: number } | null>(null);
  const [segundos, setSegundos] = useState(D2.invitacionMs / 1000);
  const [siguiendo, setSiguiendo] = useState(false);
  const seguimiento = useRef(false);
  const [dirigiendo, setDirigiendo] = useState(false);
  const [aviso, setAviso] = useState('');
  const revision = useRef(0);
  const propioDestino = useRef(mando.idDestino);
  const indice = useRef(0);
  const libre = useMemo(() => {
    const extra = suelosDeObjetos(sala.mundo.objetos, escenario.entradas[0]?.y ?? 0);
    return espacioD2(conSueloExtra(escenario, extra.solidos, extra.superficies), avatar.y);
  }, [escenario, sala.mundo.objetos]);
  const actual = useRef({ avatar, libre, conexion });
  actual.current = { avatar, libre, conexion };
  const soltar = () => {
    if (seguimiento.current) {
      mando.destino = null;
      mando.idDestino++;
      propioDestino.current = mando.idDestino;
    }
    seguimiento.current = false;
    setSiguiendo(false);
  };
  const elegir = (ir: boolean) => {
    const p = pendiente.current;
    pendiente.current = null;
    setLlamada(null);
    if (!ir || !p) return;
    const lugar = p.orden.lugares[actual.current.conexion.yo];
    if (!lugar || !actual.current.libre(lugar)) {
      setAviso('Ese lugar ya no está libre. Espera otra llamada.');
      return;
    }
    (mando as Mando & { trasladoD2?: PuntoD2 }).trasladoD2 = lugar;
    indice.current = Object.keys(p.orden.lugares).indexOf(actual.current.conexion.yo);
    propioDestino.current = mando.idDestino + 1;
    seguimiento.current = p.orden.seguir;
    setSiguiendo(p.orden.seguir);
  };
  const elegirRef = useRef(elegir);
  elegirRef.current = elegir;
  useEffect(() => {
    if (!fuente || !yo || !dueno) return;
    const salir = fuente.suscribirDatos((texto, emisor) => {
      const p = leerD2(
        texto,
        emisor,
        dueno,
        fuente.personas().map((p) => p.id),
      );
      if (!p || p.tipo === 'd2-reaccion' || p.revision <= revision.current) return;
      revision.current = p.revision;
      if (p.tipo === 'd2-parar') {
        pendiente.current = null;
        setLlamada(null);
        soltar();
        return;
      }
      if (!invitado || !p.lugares[yo]) return;
      soltar();
      pendiente.current = { orden: p, vence: Date.now() + D2.invitacionMs };
      setSegundos(D2.invitacionMs / 1000);
      setLlamada(p);
    });
    const manual = (e: KeyboardEvent) => {
      if (
        !/INPUT|TEXTAREA/.test((e.target as HTMLElement)?.tagName) &&
        /^(w|a|s|d|ArrowUp|ArrowDown|ArrowLeft|ArrowRight| )$/i.test(e.key)
      )
        soltar();
    };
    addEventListener('keydown', manual);
    const t = setInterval(() => {
      const pendienteAhora = pendiente.current;
      const host = fuente.personas().find((p) => p.id === dueno);
      if (invitado && !host) {
        pendiente.current = null;
        setLlamada(null);
        soltar();
        return;
      }
      if (pendienteAhora) {
        setSegundos(Math.max(0, Math.ceil((pendienteAhora.vence - Date.now()) / 1000)));
        if (Date.now() >= pendienteAhora.vence) elegirRef.current(true);
      }
      if (!seguimiento.current || !host) return;
      if ((mando as Mando & { trasladoD2?: PuntoD2 }).trasladoD2) return;
      if (mando.adelante || mando.lateral || mando.idDestino !== propioDestino.current) {
        soltar();
        return;
      }
      const fila = Math.floor(indice.current / D2.columnasSeguimiento),
        columna = indice.current % D2.columnasSeguimiento;
      const detras = D2.distanciaSeguimiento + fila * D2.filaSeguimiento,
        lado = (columna - (D2.columnasSeguimiento - 1) / 2) * D2.columnaSeguimiento;
      const p = {
        x: host.x - Math.sin(host.rumbo) * detras + Math.cos(host.rumbo) * lado,
        y: host.y,
        z: host.z - Math.cos(host.rumbo) * detras - Math.sin(host.rumbo) * lado,
        rumbo: host.rumbo,
      };
      if (
        actual.current.libre(p) &&
        Math.hypot(p.x - actual.current.avatar.x, p.z - actual.current.avatar.z) >
          D2.umbralSeguimiento
      ) {
        fijarDestino(mando, p.x, p.z, false, p.y);
        propioDestino.current = mando.idDestino;
      }
    }, D2.pasoMs);
    return () => {
      salir();
      removeEventListener('keydown', manual);
      clearInterval(t);
      pendiente.current = null;
      seguimiento.current = false;
      setLlamada(null);
      setSiguiendo(false);
    };
  }, [fuente, yo, dueno, invitado, mando]);
  const enviar = async (p: OrdenD2) => {
    try {
      await fuente?.enviarDatos(JSON.stringify(p));
      return true;
    } catch (error) {
      console.error('No se pudo enviar la dinámica D2', error);
      setAviso('No se pudo enviar. Inténtalo de nuevo.');
      return false;
    }
  };
  const reunir = async (seguir: boolean) => {
    if (!fuente || invitado || !dueno || fuente.instantanea().conexion !== 'conectado') return;
    const ids = fuente
      .personas()
      .map((p) => p.id)
      .sort();
    const origen = proyector.current?.mundo(yo) ?? { ...avatar, rumbo: 0 };
    const lugares = formarPublico(origen, ids.length, libre);
    if (lugares.length < ids.length) {
      setAviso('Aquí no cabe todo el grupo. Busca un espacio más amplio.');
      return;
    }
    const orden: Llamada = {
      tipo: 'd2-llamada',
      revision: Date.now(),
      seguir,
      lugares: Object.fromEntries(ids.map((id, i) => [id, lugares[i]!])),
    };
    if (await enviar(orden)) {
      setDirigiendo(seguir);
      setAviso(
        seguir
          ? 'Invitación enviada. Puedes caminar.'
          : 'Invitación enviada. Se reunirán en 5 segundos.',
      );
    }
  };
  const parar = async () => {
    if (!invitado && (await enviar({ tipo: 'd2-parar', revision: Date.now() })))
      setDirigiendo(false);
  };
  return {
    ...conexion,
    llamada,
    segundos,
    siguiendo,
    dirigiendo,
    aviso,
    elegir,
    reunir,
    parar,
    soltar,
  };
}
