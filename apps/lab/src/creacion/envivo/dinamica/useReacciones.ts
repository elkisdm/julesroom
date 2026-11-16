import { useEffect, useMemo, useRef, useState } from 'react';
import { D2, crearCuota } from './modelo';
import { useConexionD2 } from './conexion';
import { sesionReacciones } from './sesionReacciones';
import { crearReacciones } from './reacciones';
const VACIO = crearReacciones();
export function useReacciones() {
  const { fuente, yo, dueno } = useConexionD2();
  const sesion = useMemo(
    () => (fuente && yo && dueno ? sesionReacciones(fuente, yo, dueno) : null),
    [fuente, yo, dueno],
  );
  const cuota = useRef(crearCuota(D2.cuotaMs));
  const [, dibujar] = useState(0);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!sesion) return;
    const salir = sesion.suscribir(() => dibujar((n) => n + 1));
    sesion.limpiar();
    dibujar((n) => n + 1);
    const t = setInterval(sesion.limpiar, D2.pasoMs);
    return () => {
      salir();
      clearInterval(t);
    };
  }, [sesion]);
  const reaccionar = async (numero: number) => {
    if (
      !fuente ||
      !sesion ||
      !yo ||
      fuente.instantanea().conexion !== 'conectado' ||
      !cuota.current(yo, Date.now())
    )
      return;
    const activa = numero !== 3 || !sesion.estado.manos().includes(yo);
    try {
      await fuente.enviarDatos(JSON.stringify({ tipo: 'd2-reaccion', reaccion: numero, activa }));
      sesion.aplicar(yo, numero, activa);
      setError('');
    } catch (e) {
      console.error('No se pudo enviar la reacción D2', e);
      setError('No se pudo enviar tu reacción. Inténtalo de nuevo.');
    }
  };
  const estado = sesion?.estado ?? VACIO;
  return {
    reaccionar,
    manos: estado.manos(),
    visibles: estado.visibles(),
    festejo: sesion?.festejo() ?? 0,
    error,
  };
}
