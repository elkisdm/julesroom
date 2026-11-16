/**
 * La sala en memoria con su historia (deshacer y rehacer) y guardado automático en el navegador.
 * Si el navegador no deja guardar (modo privado, cuota), la sala sigue viva en memoria y se avisa.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  LIMITES_SALA,
  cargarSala,
  crearHistoria,
  deshacer as deshacerH,
  guardarSala,
  listarSalas,
  renombrarSala,
  eliminarSala,
  hacer as hacerH,
  puedeDeshacer,
  puedeRehacer,
  rehacer as rehacerH,
} from '@oficina/motor';
import type { Almacen, Historia, SalaGuardada } from '@oficina/motor';

/** `localStorage` si existe y responde; si no, un almacén en memoria (la sala no se pierde mientras dura la pestaña). */
function almacenDelNavegador(): Almacen {
  try {
    const ls = window.localStorage;
    ls.getItem('jules-room/prueba');
    return ls;
  } catch {
    const m = new Map<string, string>();
    return {
      getItem: (k) => m.get(k) ?? null,
      setItem: (k, v) => void m.set(k, v),
      removeItem: (k) => void m.delete(k),
    };
  }
}

export type EstadoGuardado = 'guardado' | 'guardando' | 'sin-guardar';

export function useSala() {
  const almacen = useRef<Almacen>(almacenDelNavegador());
  const [biblioteca, setBiblioteca] = useState(() => listarSalas(almacen.current));
  const [guardada] = useState(() => cargarSala(almacen.current));
  const idActual = useRef(
    new URLSearchParams(location.search).has('sala')
      ? crypto.randomUUID()
      : (biblioteca.salas[0]?.id ?? crypto.randomUUID()),
  );
  const actualizarBiblioteca = () => setBiblioteca(listarSalas(almacen.current));
  const [historia, setHistoria] = useState<Historia<SalaGuardada> | null>(() =>
    guardada.sala && !new URLSearchParams(location.search).has('sala')
      ? crearHistoria(guardada.sala)
      : null,
  );
  const miniaturaActual = useRef<string | undefined>(undefined);
  const [guardado, setGuardado] = useState<EstadoGuardado>('guardado');
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);

  const sala = historia?.presente ?? null;

  /** Un cambio que se puede deshacer. */
  const aplicar = useCallback((nueva: SalaGuardada) => {
    setHistoria((h) => (h ? hacerH(h, nueva, LIMITES_SALA.historia) : crearHistoria(nueva)));
  }, []);
  /** Reemplaza la sala sin historia (empezar de nuevo, importar). */
  const reemplazar = useCallback((nueva: SalaGuardada, miniatura?: string) => {
    miniaturaActual.current = miniatura;
    setHistoria(crearHistoria(nueva));
  }, []);
  const deshacer = useCallback(() => setHistoria((h) => (h ? deshacerH(h) : h)), []);
  const rehacer = useCallback(() => setHistoria((h) => (h ? rehacerH(h) : h)), []);

  const persistir = useCallback((actual: SalaGuardada) => {
    const r = guardarSala(almacen.current, actual, {
      id: idActual.current,
      miniatura: miniaturaActual.current,
    });
    setBiblioteca(listarSalas(almacen.current));
    setGuardado(r.ok ? 'guardado' : 'sin-guardar');
    setErrorGuardado(r.ok ? null : (r.error ?? 'No se pudo guardar en este navegador'));
    return r.ok;
  }, []);

  // El arrastre se guarda con pausa; cambiar de sala o cerrar la página fuerza el último cambio.
  useEffect(() => {
    if (!sala) return;
    setGuardado('guardando');
    const t = window.setTimeout(() => persistir(sala), 350);
    const alSalir = () => persistir(sala);
    window.addEventListener('pagehide', alSalir);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('pagehide', alSalir);
    };
  }, [sala, persistir]);

  const reiniciar = () => {
    idActual.current = crypto.randomUUID();
    miniaturaActual.current = undefined;
    setHistoria(null);
    setErrorGuardado(null);
  };
  /** Cada creación recibe identidad propia y conserva antes cualquier autoguardado pendiente. */
  const nueva = () => {
    if (sala && !persistir(sala)) return false;
    reiniciar();
    return true;
  };
  const abrir = (id: string, miniatura?: string) => {
    // Reingresar a la sala ya abierta no exige otra escritura (también funciona sin cuota).
    if (id === idActual.current && sala) {
      if (miniatura) miniaturaActual.current = miniatura;
      return sala;
    }
    if (sala && !persistir(sala)) return null;
    const r = cargarSala(almacen.current, id);
    if (!r.sala) {
      setErrorGuardado(r.errores.join('. ') || 'No se encontró la sala.');
      return null;
    }
    idActual.current = id;
    miniaturaActual.current = miniatura ?? biblioteca.salas.find((s) => s.id === id)?.miniatura;
    setHistoria(crearHistoria(r.sala));
    return r.sala;
  };
  const renombrar = (id: string, nombre: string) => {
    const r = renombrarSala(almacen.current, id, nombre);
    setErrorGuardado(r.error ?? null);
    if (r.ok) {
      if (idActual.current === id)
        setHistoria((h) => (h ? crearHistoria({ ...h.presente, nombre: nombre.trim() }) : h));
      actualizarBiblioteca();
    }
    return r.ok;
  };
  const eliminar = (id: string) => {
    const r = eliminarSala(almacen.current, id);
    setErrorGuardado(r.error ?? null);
    if (r.ok) {
      if (idActual.current === id) reiniciar();
      actualizarBiblioteca();
    }
    return r.ok;
  };

  return {
    sala,
    salas: biblioteca.salas,
    nueva,
    abrir,
    renombrar,
    eliminar,
    /** Sala guardada encontrada al abrir (para «Volver a tu sala»). */
    salaAlAbrir: guardada.sala,
    erroresAlAbrir: guardada.errores,
    aplicar,
    reemplazar,
    deshacer,
    rehacer,
    puedeDeshacer: historia ? puedeDeshacer(historia) : false,
    puedeRehacer: historia ? puedeRehacer(historia) : false,
    guardado,
    errorGuardado,
  };
}
