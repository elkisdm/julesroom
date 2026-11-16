import { useEffect, useState } from 'react';
import { teclaD2 } from './modelo';
const GRABACION = { avisoMs: 1000 };
/** Atajo local: no se transmite y no interfiere con campos ni combinaciones del navegador. */
export function useGrabacion() {
  const [grabando, setGrabando] = useState(false);
  const [aviso, setAviso] = useState(false);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const accion = teclaD2(
        e.key,
        Boolean(el?.closest('input,textarea,[contenteditable="true"]')),
        e.ctrlKey || e.metaKey || e.altKey,
      );
      if (e.repeat || (accion !== 'grabar' && accion !== 'salir')) return;
      if (accion === 'salir' && !document.documentElement.classList.contains('d2-grabando')) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      setGrabando((actual) => (accion === 'salir' ? false : !actual));
    };
    addEventListener('keydown', tecla, true);
    return () => {
      removeEventListener('keydown', tecla, true);
      document.documentElement.classList.remove('d2-grabando');
    };
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle('d2-grabando', grabando);
    if (!grabando) {
      setAviso(false);
      return;
    }
    (document.activeElement as HTMLElement | null)?.blur();
    setAviso(true);
    const t = setTimeout(() => setAviso(false), GRABACION.avisoMs);
    return () => clearTimeout(t);
  }, [grabando]);
  return { grabando, aviso };
}
