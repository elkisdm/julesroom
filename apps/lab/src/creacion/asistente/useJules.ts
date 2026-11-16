import { useEffect, useRef, useState } from 'react';
import { accionesDe } from '@oficina/motor';
import type { ControlAsistenteLocal } from '@oficina/motor';
import {
  actualizar,
  crearEstado,
  etiqueta,
  ordenar,
  PARAMETROS_JULES,
  puedeInteractuar,
  type Orden,
  type Punto,
} from './control';

/** Un único puente local por escena. No publica datos ni modifica el mundo compartido. */
export function useJules() {
  const [menu, setMenu] = useState(false);
  const [estado, setEstado] = useState('espera aquí');
  const [cerca, setCerca] = useState(false);
  const alOrden = useRef<(() => void) | null>(null);
  const maquina = useRef(crearEstado({ x: 0, y: 0, z: 0 }));
  const control = useRef<ControlAsistenteLocal>({
    posicion: { x: 0, y: 0, z: 0 },
    usuario: { x: 0, y: 0, z: 0, estado: 'de-pie' },
    puesto: { x: 0, y: 0, z: 0 },
    destino: null,
    seguir: false,
    disponible: false,
    version: 0,
    alTocar: () => setMenu(true),
  });
  const ejecutar = (orden: Orden, destino?: Punto) => {
    const c = control.current;
    if (!c.disponible) return;
    if (orden !== 'guiar') {
      c.marca = null;
      alOrden.current?.();
    }
    ordenar(maquina.current, orden, c.posicion, c.usuario, destino);
    c.version++;
    c.seguir = orden === 'seguir' || orden === 'venir';
    c.destino = maquina.current.destino;
    setEstado(etiqueta(maquina.current));
  };
  const ejecutarRef = useRef(ejecutar);
  ejecutarRef.current = ejecutar;
  useEffect(() => {
    const tieneFoco = () => {
      const c = control.current;
      return puedeInteractuar(c.posicion, c.usuario, c.escenario ? accionesDe(c.escenario) : []);
    };
    const vincular = () =>
      window.dispatchEvent(new CustomEvent('ak-jules-control', { detail: control.current }));
    window.addEventListener('ak-jules-lista', vincular);
    vincular();
    let mundo: typeof control.current.escenario;
    const id = window.setInterval(() => {
      const c = control.current;
      if (!c.disponible) return;
      if (mundo !== c.escenario) {
        maquina.current = crearEstado(c.puesto);
        maquina.current.destino = { ...c.posicion };
        c.destino = maquina.current.destino;
        c.seguir = false;
        c.marca = null;
        alOrden.current?.();
        setEstado(etiqueta(maquina.current));
        mundo = c.escenario;
      }
      const anterior = maquina.current.modo;
      actualizar(maquina.current, c.posicion, c.usuario);
      if (anterior !== maquina.current.modo) {
        c.seguir = false;
        c.destino = maquina.current.destino;
        c.version++;
        setEstado(etiqueta(maquina.current));
      }
      setCerca(tieneFoco());
    }, PARAMETROS_JULES.periodoMs);
    const tecla = (e: KeyboardEvent) => {
      if (
        e.repeat ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        (e.target as HTMLElement)?.closest('input,textarea,button,[contenteditable="true"]')
      )
        return;
      const c = control.current;
      if (!c.disponible) return;
      if (e.code === 'KeyJ') {
        e.preventDefault();
        ejecutarRef.current('venir');
      }
      if (e.code === 'KeyE' && tieneFoco()) {
        e.preventDefault();
        e.stopImmediatePropagation();
        setMenu((v) => !v);
      }
      if (e.code === 'Escape') setMenu(false);
    };
    window.addEventListener('keydown', tecla, true);
    return () => {
      clearInterval(id);
      window.removeEventListener('keydown', tecla, true);
      window.removeEventListener('ak-jules-lista', vincular);
      window.dispatchEvent(new CustomEvent('ak-jules-control', { detail: null }));
    };
  }, []);
  return { menu, setMenu, estado, cerca, control, ejecutar, alOrden };
}
