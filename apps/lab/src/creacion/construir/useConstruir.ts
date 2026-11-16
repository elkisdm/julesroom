/**
 * Estado e interacción del modo construir: objeto en mano (fantasma), selección, arrastre, teclas.
 * Toda la lógica de si cabe o no y de cómo cambia la sala vive en `@oficina/motor` (editor); aquí
 * solo se conecta el puntero y el teclado con ella.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import {
  LIMITES_SALA,
  ajustar,
  colocar,
  duplicar,
  evaluarColocacion,
  girar,
  girarObjeto,
  mover,
  quitar,
} from '@oficina/motor';
import type { Escenario, Giro, Proyector, SalaGuardada } from '@oficina/motor';
import { sonar } from '../sonido';
import type { Fantasma } from './Objetos3D';

interface Opciones {
  sala: SalaGuardada;
  escenario: Escenario;
  aplicar: (s: SalaGuardada) => void;
  /** Solo dentro de la sala se puede entrar a construir. */
  activo: boolean;
  proyector: MutableRefObject<Proyector | null>;
  /** Esc ya usado por un mueble de la plantilla o un diálogo: no sale de construir. */
  consumirEscape?: () => boolean;
}

/** Teclas del avatar que no deben moverlo mientras se construye. */
const TECLAS_AVATAR = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
  'KeyE',
  'ShiftLeft',
  'ShiftRight',
]);

export function useConstruir({
  sala,
  escenario,
  aplicar,
  activo,
  proyector,
  consumirEscape,
}: Opciones) {
  const alEscape = useRef(consumirEscape);
  alEscape.current = consumirEscape;
  const [construyendo, setConstruyendo] = useState(false);
  const [enMano, setEnMano] = useState<{ tipo: string; giro: Giro } | null>(null);
  const [puntero, setPuntero] = useState<{ x: number; z: number } | null>(null);
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const bajadaSobre = useRef<string | null>(null);
  const arrastrandoRef = useRef<string | null>(null);
  const punteroRef = useRef<{ x: number; z: number } | null>(null);

  const limites = LIMITES_SALA;
  const y = escenario.entradas[0]?.y ?? 0;
  const caja = useMemo(() => escenario.colision(y).limites, [escenario, y]);
  const objetos = sala.mundo.objetos;

  const avisar = useCallback((t: string) => {
    setAviso(t);
    sonar('error');
  }, []);
  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(() => setAviso(null), 2600);
    return () => window.clearTimeout(t);
  }, [aviso]);

  // Fantasma: el objeto en mano o el que se arrastra, en la celda del puntero.
  const fantasma: Fantasma | null = useMemo(() => {
    if (!puntero) return null;
    const x = ajustar(puntero.x, limites.paso);
    const z = ajustar(puntero.z, limites.paso);
    let base: { id: string; tipo: string; giro: Giro } | null = null;
    if (enMano) base = { id: '__fantasma', ...enMano };
    else if (arrastrando) {
      const o = objetos.find((x) => x.id === arrastrando);
      if (o) base = { id: o.id, tipo: o.tipo, giro: o.giro };
    }
    if (!base) return null;
    const r = evaluarColocacion({ ...base, x, z }, { escenario, objetos, limites });
    return { tipo: base.tipo, x, z, giro: base.giro, estado: r.estado, motivo: r.motivo };
  }, [puntero, enMano, arrastrando, objetos, escenario, limites]);

  const entrar = useCallback(() => {
    if (!activo) return;
    setConstruyendo(true);
    sonar('paso');
  }, [activo]);
  const salir = useCallback(() => {
    setConstruyendo(false);
    setEnMano(null);
    setSeleccion(null);
    arrastrandoRef.current = null;
    bajadaSobre.current = null;
    setArrastrando(null);
  }, []);

  const tomar = useCallback((tipo: string) => {
    setEnMano((m) => (m?.tipo === tipo ? null : { tipo, giro: 0 }));
    setSeleccion(null);
  }, []);

  const resultado = useCallback(
    (
      r: { ok: true; sala: SalaGuardada } | { ok: false; motivo: string },
      sonido: 'colocar' | 'quitar' | 'girar',
    ) => {
      if (r.ok) {
        aplicar(r.sala);
        sonar(sonido);
        return r.sala;
      }
      avisar(r.motivo);
      return null;
    },
    [aplicar, avisar],
  );
  const objetosRef = useRef(objetos);
  const salaRef = useRef(sala);
  const escenarioRef = useRef(escenario);
  const resultadoRef = useRef(resultado);
  const enManoRef = useRef(enMano);
  const limitesRef = useRef(limites);
  objetosRef.current = objetos;
  salaRef.current = sala;
  escenarioRef.current = escenario;
  resultadoRef.current = resultado;
  enManoRef.current = enMano;
  limitesRef.current = limites;

  const girarActual = useCallback(
    (sentido: 1 | -1 = 1) => {
      if (enMano) {
        setEnMano({ ...enMano, giro: girar(enMano.giro, sentido) });
        sonar('girar');
      } else if (seleccion) resultado(girarObjeto(sala, escenario, seleccion, sentido), 'girar');
    },
    [enMano, seleccion, sala, escenario, resultado],
  );
  const quitarSeleccion = useCallback(() => {
    if (!seleccion) return;
    if (resultado(quitar(sala, seleccion), 'quitar')) setSeleccion(null);
  }, [seleccion, sala, resultado]);
  const duplicarSeleccion = useCallback(() => {
    if (!seleccion) return;
    const nueva = resultado(duplicar(sala, escenario, seleccion), 'colocar');
    const ultimo = nueva?.mundo.objetos[nueva.mundo.objetos.length - 1];
    if (ultimo) setSeleccion(ultimo.id);
  }, [seleccion, sala, escenario, resultado]);

  const alPuntero = useCallback((x: number, z: number, presionado: boolean) => {
    punteroRef.current = { x, z };
    setPuntero({ x, z });
    if (presionado && bajadaSobre.current && !arrastrandoRef.current) {
      arrastrandoRef.current = bajadaSobre.current;
      setArrastrando(bajadaSobre.current);
    }
  }, []);

  const alSoltar = useCallback((x: number, z: number) => {
    const presionado = bajadaSobre.current;
    bajadaSobre.current = null;
    const id = arrastrandoRef.current;
    if (id) {
      arrastrandoRef.current = null;
      setArrastrando(null);
      const lim = limitesRef.current;
      const sx = ajustar(x, lim.paso);
      const sz = ajustar(z, lim.paso);
      const actual = objetosRef.current.find((o) => o.id === id);
      if (actual && actual.x === sx && actual.z === sz) return;
      resultadoRef.current(mover(salaRef.current, escenarioRef.current, id, x, z), 'colocar');
      return;
    }
    // Un clic sobre el objeto solo lo selecciona: no lo suelta ni borra la selección.
    if (presionado) return;
    const mano = enManoRef.current;
    if (mano) {
      const nueva = resultadoRef.current(
        colocar(salaRef.current, escenarioRef.current, { ...mano, x, z }, limitesRef.current),
        'colocar',
      );
      const ultimo = nueva?.mundo.objetos[nueva.mundo.objetos.length - 1];
      if (ultimo) {
        setSeleccion(ultimo.id);
        setEnMano(null);
      }
      return;
    }
    setSeleccion(null);
  }, []);

  const alBajarSobre = useCallback((id: string) => {
    if (enManoRef.current) return;
    bajadaSobre.current = id;
    setSeleccion(id);
  }, []);

  // Respaldo si el lienzo no recibe el pointerup (se soltó fuera). Si el gesto ya
  // se cerró en la captura, la ref está vacía y esto no mueve dos veces.
  useEffect(() => {
    const fin = (e: PointerEvent) => {
      // Otro dedo que se levanta no cierra el arrastre del primero.
      if (!e.isPrimary || e.buttons !== 0) return;
      bajadaSobre.current = null;
      const id = arrastrandoRef.current;
      if (!id) return;
      arrastrandoRef.current = null;
      setArrastrando(null);
      const p = punteroRef.current;
      if (!p) return;
      resultadoRef.current(mover(salaRef.current, escenarioRef.current, id, p.x, p.z), 'colocar');
    };
    window.addEventListener('pointerup', fin);
    return () => window.removeEventListener('pointerup', fin);
  }, []);

  // Teclas: B entra/sale; dentro, R gira, Supr quita, D duplica (con ⌘/Ctrl), Esc suelta o sale.
  useEffect(() => {
    if (!activo) return;
    const enTexto = (t: EventTarget | null) =>
      t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA)$/.test(t.tagName));
    const alTecla = (e: KeyboardEvent) => {
      if (enTexto(e.target)) return;
      const k = e.key.toLowerCase();
      if (!construyendo) {
        if (k === 'b' && !e.metaKey && !e.ctrlKey) entrar();
        return;
      }
      // Mientras se construye, el avatar no se mueve: estas teclas son del editor.
      if (TECLAS_AVATAR.has(e.code)) e.stopPropagation();
      if (e.metaKey || e.ctrlKey) {
        if (k === 'd') {
          e.preventDefault();
          duplicarSeleccion();
        }
        return;
      }
      if (k === 'b') salir();
      else if (k === 'escape') {
        if (enMano) setEnMano(null);
        else if (seleccion) setSeleccion(null);
        else if (alEscape.current?.()) e.stopPropagation();
        else salir();
      } else if (k === 'r') girarActual(e.shiftKey ? -1 : 1);
      else if (k === 'delete' || k === 'backspace') {
        e.preventDefault();
        quitarSeleccion();
      }
    };
    // En captura: llega antes que los controles del avatar y puede frenarlos.
    window.addEventListener('keydown', alTecla, true);
    const alClic = (e: MouseEvent) => {
      if (construyendo && (e.target as HTMLElement | null)?.tagName === 'CANVAS')
        e.stopPropagation();
    };
    window.addEventListener('click', alClic, true);
    return () => {
      window.removeEventListener('keydown', alTecla, true);
      window.removeEventListener('click', alClic, true);
    };
  }, [
    activo,
    construyendo,
    entrar,
    salir,
    enMano,
    seleccion,
    girarActual,
    quitarSeleccion,
    duplicarSeleccion,
  ]);

  const elegido = objetos.find((o) => o.id === seleccion) ?? null;

  return {
    construyendo,
    entrar,
    salir,
    enMano,
    tomar,
    seleccion,
    setSeleccion,
    elegido,
    fantasma,
    aviso,
    girarActual,
    quitarSeleccion,
    duplicarSeleccion,
    proyector,
    limites,
    props3D: {
      objetos,
      y,
      limites: caja,
      paso: limites.paso,
      construyendo,
      fantasma,
      seleccion,
      arrastrando,
      alPuntero,
      alSoltar,
      alBajarSobre,
    },
  };
}

export type Construir = ReturnType<typeof useConstruir>;
