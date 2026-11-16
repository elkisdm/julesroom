import { useEffect, useMemo, useRef, useState } from 'react';
import { conSueloExtra } from '@oficina/motor';
import { espacioD2 } from '@oficina/motor';
import { fijarMarcasD2 } from '@oficina/motor';
import { suelosDeObjetos } from '../../construir/solidos';
import { useConexionD2 } from './conexion';
import {
  contarVotos,
  crearZonas,
  leerVotacionD2,
  resultadoVotos,
  VOTO,
  type VotacionD2,
} from './votacion';
import type { PropsGrupo } from './useGrupo';
export function useVotacion(props: PropsGrupo) {
  const { fuente, yo, dueno, invitado } = useConexionD2();
  const [votacion, setVotacion] = useState<VotacionD2 | null>(null);
  const [error, setError] = useState('');
  const actual = useRef(votacion);
  actual.current = votacion;
  const ultima = useRef(props);
  ultima.current = props;
  const revision = useRef(0);
  const envio = useRef(0);
  const libre = useMemo(() => {
    const extra = suelosDeObjetos(props.sala.mundo.objetos, props.escenario.entradas[0]?.y ?? 0);
    return espacioD2(
      conSueloExtra(props.escenario, extra.solidos, extra.superficies),
      props.avatar.y,
    );
  }, [props.escenario, props.sala.mundo.objetos]);
  const enviar = async (p: VotacionD2) => {
    try {
      await fuente?.enviarDatos(JSON.stringify(p));
      return true;
    } catch (e) {
      console.error('No se pudo enviar la votación D2', e);
      setError('No se pudo compartir la votación. Inténtalo de nuevo.');
      return false;
    }
  };
  const enviarRef = useRef(enviar);
  enviarRef.current = enviar;
  useEffect(() => {
    if (!fuente || !dueno || !yo) return;
    const salir = fuente.suscribirDatos((texto, emisor) => {
      const p = leerVotacionD2(texto, emisor, dueno);
      if (p && invitado && p.revision > revision.current) {
        revision.current = p.revision;
        actual.current = p;
        setVotacion(p);
      }
    });
    const t = setInterval(() => {
      const p = actual.current;
      if (!p || invitado || Date.now() - envio.current < VOTO.latidoMs) return;
      const conteos = p.cerrada
        ? p.conteos
        : contarVotos(p.opciones, [ultima.current.avatar, ...fuente.personas()]);
      const n = { ...p, conteos, revision: Math.max(Date.now(), p.revision + 1) };
      envio.current = Date.now();
      actual.current = n;
      setVotacion(n);
      void enviarRef.current(n);
    }, VOTO.pasoMs);
    return () => {
      salir();
      clearInterval(t);
    };
  }, [fuente, yo, dueno, invitado]);
  useEffect(() => {
    const ganadores = votacion?.cerrada ? resultadoVotos(votacion.conteos) : [];
    fijarMarcasD2(
      votacion?.opciones.map((p, i) => ({
        ...p,
        radio: VOTO.radio,
        ganadora: ganadores.includes(i),
      })) ?? [],
    );
    return () => fijarMarcasD2([]);
  }, [votacion]);
  const lanzar = async (pregunta: string, opciones: string[]) => {
    if (!fuente || invitado || !dueno || fuente.instantanea().conexion !== 'conectado') return;
    const rotulos = opciones.map((x) => x.trim());
    if (
      !pregunta.trim() ||
      pregunta.trim().length > VOTO.maxTexto ||
      rotulos.length < 2 ||
      rotulos.length > 4 ||
      rotulos.some((x) => !x || x.length > VOTO.maxRotulo)
    ) {
      setError('Escribe una pregunta y entre 2 y 4 opciones.');
      return;
    }
    const host = props.proyector.current?.mundo(yo);
    if (!host) return;
    const zonas = crearZonas(host, rotulos, libre);
    if (zonas.length !== rotulos.length) {
      setError('Aquí no caben las zonas. Busca un espacio amplio frente a ti.');
      return;
    }
    const n: VotacionD2 = {
      tipo: 'd2-votacion',
      id: crypto.randomUUID(),
      revision: Date.now(),
      pregunta: pregunta.trim(),
      opciones: zonas,
      cerrada: false,
      conteos: rotulos.map(() => 0),
    };
    if (await enviar(n)) {
      actual.current = n;
      setVotacion(n);
      setError('');
      return true;
    }
    return false;
  };
  const cerrar = async () => {
    const p = actual.current;
    if (!p || invitado || p.cerrada) return;
    const n = {
      ...p,
      cerrada: true,
      revision: Math.max(Date.now(), p.revision + 1),
      conteos: contarVotos(p.opciones, [props.avatar, ...(fuente?.personas() ?? [])]),
    };
    actual.current = n;
    setVotacion(n);
    await enviar(n);
  };
  return { votacion, error, lanzar, cerrar };
}
