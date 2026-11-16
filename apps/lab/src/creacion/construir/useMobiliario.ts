/**
 * Selección, arrastre y restablecer de los muebles de la plantilla.
 * Si cabe o no lo decide `moverMueble` (el mismo motor que guarda `ajustesMuebles`).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LIMITES_SALA,
  ajustar,
  girarMueble,
  moverMueble,
  muebleBajoPunto,
  piezasMovibles,
  quitarMueble,
  restablecerMueble,
  restablecerSala,
} from '@oficina/motor';
import type { AjustesMuebles, Escenario, SalaGuardada } from '@oficina/motor';
import { sonar } from '../sonido';
import type { Fantasma } from './Objetos3D';
import { cajaDesplazada, estadoDeMotivo, filasDeAjustes } from './interaccionMobiliario';
import type { FilaMueble, Huella } from './interaccionMobiliario';
import { PARAMETROS_CONSTRUIR } from './parametrosConstruir';

interface Opciones {
  sala: SalaGuardada;
  /** Plantilla sin ajustes: las operaciones se validan contra ella, no contra la sala ya movida. */
  plantilla: Escenario;
  /** Escenario con los ajustes ya aplicados: ahí se toca el mueble. */
  escenario: Escenario;
  aplicar: (s: SalaGuardada) => void;
  construyendo: boolean;
  enMano: boolean;
  /** Id del objeto agregado elegido, para no tener dos selecciones. */
  seleccionObjeto: string | null;
  limpiarObjeto: () => void;
  alDeshacer: () => void;
  alRehacer: () => void;
}

export interface MuebleElegido {
  id: string;
  nombre: string;
  x: number;
  z: number;
  alto: number;
  quitado: boolean;
  ajustado: boolean;
}

const PASO = LIMITES_SALA.paso;

export function useMobiliario({
  sala,
  plantilla,
  escenario,
  aplicar,
  construyendo,
  enMano,
  seleccionObjeto,
  limpiarObjeto,
  alDeshacer,
  alRehacer,
}: Opciones) {
  const [id, setId] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [cursor, setCursor] = useState<{ x: number; z: number } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<null | 'mueble' | 'sala'>(null);
  const activo = useRef(false);
  const moviendo = useRef(false);
  const origen = useRef<{ x: number; z: number } | null>(null);
  const salaRef = useRef(sala);
  const plantillaRef = useRef(plantilla);
  const idRef = useRef(id);
  const cursorRef = useRef(cursor);
  salaRef.current = sala;
  plantillaRef.current = plantilla;
  idRef.current = id;
  cursorRef.current = cursor;

  const avisar = useCallback((t: string) => {
    setAviso(t);
    sonar('error');
  }, []);
  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(() => setAviso(null), PARAMETROS_CONSTRUIR.avisoMs);
    return () => window.clearTimeout(t);
  }, [aviso]);

  useEffect(() => {
    if (!seleccionObjeto) return;
    activo.current = false;
    moviendo.current = false;
    setArrastrando(false);
    setId(null);
  }, [seleccionObjeto]);

  useEffect(() => {
    if (construyendo) return;
    activo.current = false;
    moviendo.current = false;
    setArrastrando(false);
    setId(null);
    setConfirmar(null);
  }, [construyendo]);

  const nombres = useMemo(
    () => new Map(piezasMovibles(plantilla).map((p) => [p.id, p.nombre])),
    [plantilla],
  );
  const huellas = useMemo(
    () => new Map(piezasMovibles(escenario).map((p) => [p.id, p.huella])),
    [escenario],
  );

  const filas: FilaMueble[] = useMemo(
    () => filasDeAjustes(plantilla, sala.mundo.ajustesMuebles),
    [plantilla, sala.mundo.ajustesMuebles],
  );

  const elegido: MuebleElegido | null = useMemo(() => {
    if (!id) return null;
    const nombre = nombres.get(id);
    const original = plantilla.planta.muebles.find((m) => m.id === id);
    if (!nombre || !original) return null;
    const ajuste = sala.mundo.ajustesMuebles[id];
    const actual = escenario.planta.muebles.find((m) => m.id === id);
    return {
      id,
      nombre,
      x: actual?.x ?? original.x,
      z: actual?.z ?? original.z,
      alto: original.alto,
      quitado: ajuste === 'quitado',
      ajustado: ajuste !== undefined,
    };
  }, [id, nombres, plantilla, escenario, sala.mundo.ajustesMuebles]);

  const vista = useMemo(() => {
    if (!arrastrando || !id || !cursor) return { fantasma: null as Fantasma | null, ajustes: null };
    const actual = escenario.planta.muebles.find((m) => m.id === id);
    const huella = huellas.get(id);
    if (!actual || !huella) return { fantasma: null, ajustes: null };
    const r = moverMueble(sala, plantilla, id, cursor.x, cursor.z);
    const caja = cajaDesplazada(huella, cursor.x - actual.x, cursor.z - actual.z);
    const base = { tipo: '', x: cursor.x, z: cursor.z, giro: 0 as const, caja };
    if (!r.ok) {
      return {
        fantasma: { ...base, estado: estadoDeMotivo(r.motivo), motivo: r.motivo },
        ajustes: null as AjustesMuebles | null,
      };
    }
    return {
      fantasma: { ...base, estado: 'libre' as const, motivo: null },
      ajustes: r.sala === sala ? null : r.sala.mundo.ajustesMuebles,
    };
  }, [arrastrando, id, cursor, escenario, huellas, sala, plantilla]);

  const soltarEn = useCallback(
    (x: number, z: number) => {
      const pieza = idRef.current;
      const desde = origen.current;
      activo.current = false;
      moviendo.current = false;
      setArrastrando(false);
      setCursor(null);
      cursorRef.current = null;
      if (!pieza || !desde) return;
      const sx = ajustar(x, PASO);
      const sz = ajustar(z, PASO);
      // Un clic no llega aquí: el umbral de píxeles lo filtra antes. Si la celda
      // no cambió, tampoco hay nada que guardar.
      if (sx === desde.x && sz === desde.z) return;
      const r = moverMueble(salaRef.current, plantillaRef.current, pieza, sx, sz);
      if (!r.ok) avisar(r.motivo);
      else if (r.sala !== salaRef.current) {
        aplicar(r.sala);
        sonar('colocar');
      }
    },
    [aplicar, avisar],
  );

  const alBajarPiso = useCallback(
    (x: number, z: number): { x: number; z: number } | null => {
      if (!construyendo || enMano) return null;
      const bajo = muebleBajoPunto(escenario, x, z);
      if (!bajo) return null;
      if (bajo.motivo) {
        avisar(bajo.motivo);
        return null;
      }
      const actual = escenario.planta.muebles.find((m) => m.id === bajo.id);
      if (!actual) return null;
      limpiarObjeto();
      origen.current = { x: actual.x, z: actual.z };
      idRef.current = bajo.id;
      setId(bajo.id);
      activo.current = true;
      return { x: actual.x, z: actual.z };
    },
    [construyendo, enMano, escenario, avisar, limpiarObjeto],
  );

  const alPuntero = useCallback((x: number, z: number) => {
    if (!activo.current) return;
    const sx = ajustar(x, PASO);
    const sz = ajustar(z, PASO);
    const siguiente = { x: sx, z: sz };
    cursorRef.current = siguiente;
    if (!moviendo.current) {
      moviendo.current = true;
      setArrastrando(true);
    }
    setCursor((c) => (c && c.x === sx && c.z === sz ? c : siguiente));
  }, []);

  const alSoltar = useCallback(
    (x: number, z: number): boolean => {
      if (!activo.current) {
        if (!enMano) setId(null);
        return false;
      }
      soltarEn(x, z);
      return true;
    },
    [enMano, soltarEn],
  );

  useEffect(() => {
    const fin = (e: PointerEvent) => {
      // Otro dedo que se levanta no cierra el arrastre del primero.
      if (!e.isPrimary || e.buttons !== 0) return;
      if (!activo.current) return;
      const c = cursorRef.current;
      if (!c) {
        activo.current = false;
        moviendo.current = false;
        setArrastrando(false);
        return;
      }
      soltarEn(c.x, c.z);
    };
    window.addEventListener('pointerup', fin);
    return () => window.removeEventListener('pointerup', fin);
  }, [soltarEn]);

  const seleccionar = useCallback(
    (nuevo: string) => {
      limpiarObjeto();
      activo.current = false;
      moviendo.current = false;
      cursorRef.current = null;
      setArrastrando(false);
      setCursor(null);
      setId(nuevo);
    },
    [limpiarObjeto],
  );

  const girar = useCallback(
    (sentido: 1 | -1) => {
      if (!id || sala.mundo.ajustesMuebles[id] === 'quitado') return;
      const r = girarMueble(sala, plantilla, id, sentido);
      if (!r.ok) avisar(r.motivo);
      else if (r.sala !== sala) {
        aplicar(r.sala);
        sonar('girar');
      }
    },
    [id, sala, plantilla, aplicar, avisar],
  );

  const quitar = useCallback(() => {
    if (!id || sala.mundo.ajustesMuebles[id] === 'quitado') return;
    const r = quitarMueble(sala, plantilla, id);
    if (!r.ok) avisar(r.motivo);
    else if (r.sala !== sala) {
      aplicar(r.sala);
      sonar('quitar');
    }
  }, [id, sala, plantilla, aplicar, avisar]);

  const pedirMueble = useCallback(() => {
    if (id) setConfirmar('mueble');
  }, [id]);
  const pedirSala = useCallback(() => setConfirmar('sala'), []);
  const cancelar = useCallback(() => setConfirmar(null), []);
  const aceptar = useCallback(() => {
    if (confirmar === 'mueble' && id) {
      const siguiente = restablecerMueble(sala, id);
      if (siguiente !== sala) aplicar(siguiente);
      sonar('colocar');
    } else if (confirmar === 'sala') {
      const siguiente = restablecerSala(sala);
      if (siguiente !== sala) aplicar(siguiente);
      setId(null);
      sonar('colocar');
    }
    setConfirmar(null);
  }, [confirmar, id, sala, aplicar]);

  const consumirEscape = useCallback(() => {
    if (confirmar) {
      setConfirmar(null);
      return true;
    }
    if (id || activo.current) {
      activo.current = false;
      moviendo.current = false;
      cursorRef.current = null;
      setArrastrando(false);
      setCursor(null);
      setId(null);
      return true;
    }
    return false;
  }, [confirmar, id]);

  useEffect(() => {
    if (!construyendo) return;
    const enTexto = (t: EventTarget | null) =>
      t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA)$/.test(t.tagName));
    const alTecla = (e: KeyboardEvent) => {
      if (enTexto(e.target) || confirmar) return;
      const k = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && k === 'z') {
        e.preventDefault();
        if (e.shiftKey) alRehacer();
        else alDeshacer();
        return;
      }
      if (e.metaKey || e.ctrlKey || enMano || !id) return;
      if (k === 'r') girar(e.shiftKey ? -1 : 1);
      else if (k === 'delete' || k === 'backspace') quitar();
    };
    window.addEventListener('keydown', alTecla);
    return () => window.removeEventListener('keydown', alTecla);
  }, [construyendo, confirmar, enMano, id, girar, quitar, alDeshacer, alRehacer]);

  const huella: Huella | null = id && !arrastrando ? (huellas.get(id) ?? null) : null;

  return {
    filas,
    elegido,
    arrastrando,
    fantasma: vista.fantasma,
    ajustesDibujo: vista.ajustes,
    huella,
    aviso,
    confirmar,
    alBajarPiso,
    alPuntero,
    alSoltar,
    seleccionar,
    girar,
    quitar,
    pedirMueble,
    pedirSala,
    cancelar,
    aceptar,
    consumirEscape,
  };
}

export type Mobiliario = ReturnType<typeof useMobiliario>;
