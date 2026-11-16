import { useEffect, useRef, useState } from 'react';
import { escenarioPorId, type SalaGuardada } from '@oficina/motor';
import { useConexionD2 } from '../envivo/dinamica/conexion';
import {
  avanzarRecorrido,
  eventoDelRecorrido,
  eventoDeTecla,
  iniciarRecorrido,
  opciones,
  PASOS,
  responder,
  type ContextoJules,
  type EventoRecorrido,
  type Recorrido,
  type RespuestaJules,
} from './ayuda';
import { lugaresDe } from './lugares';
import type { useJules } from './useJules';
import type { Punto } from './control';
const P = { muestraMs: 150, burbujaMs: 7000, maxPalabras: 12 };
export function useAyudaJules(
  sala: SalaGuardada,
  jules: ReturnType<typeof useJules>,
  posicion: Punto & { velocidad?: number; estado?: string },
  identidad: string,
) {
  const conexion = useConexionD2();
  const dueno = !conexion.fuente || !conexion.invitado;
  const nombre = sala.ocupantes.find((p) => p.id === 'yo')?.nombre ?? 'visitante';
  const [respuesta, setRespuesta] = useState<RespuestaJules>({
    texto: `Hola, ${nombre}. Soy Jules.`,
    opciones: opciones(dueno),
  });
  const [panel, setPanel] = useState(true);
  const [burbuja, setBurbuja] = useState('');
  const [recorrido, setRecorrido] = useState<Recorrido>(null);
  const recorridoRef = useRef<Recorrido>(null);
  const timerBurbuja = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const baseY = useRef(posicion.y);
  const objetivoPantalla = useRef<Punto | null>(null);
  useEffect(() => {
    jules.alOrden.current = () => {
      if (recorridoRef.current) {
        setRespuesta({
          texto: 'Recorrido terminado. Puedes pedirme ayuda cuando quieras.',
          opciones: opciones(dueno),
        });
        setBurbuja('');
      }
      recorridoRef.current = null;
      setRecorrido(null);
    };
    return () => {
      jules.alOrden.current = null;
    };
  }, [jules.alOrden, dueno]);
  const decir = (texto: string) => {
    const palabras = texto.split(/\s+/);
    setBurbuja(
      palabras.length <= P.maxPalabras ? texto : `${palabras.slice(0, P.maxPalabras).join(' ')}…`,
    );
    clearTimeout(timerBurbuja.current);
    timerBurbuja.current = setTimeout(() => setBurbuja(''), P.burbujaMs);
  };
  const mostrar = (r: RespuestaJules) => {
    setRespuesta(r);
    setPanel(true);
    decir(r.texto);
  };
  const contexto = (): ContextoJules => ({
    nombre,
    dueno,
    personas: [
      { nombre, anfitrion: dueno },
      ...(conexion.fuente?.personas() ?? []).map((p) => ({
        nombre: p.nombre,
        anfitrion: p.id === conexion.dueno,
      })),
    ],
    lugares: lugaresDe(
      jules.control.current.escenario ?? escenarioPorId(sala.plano.plantilla),
      posicion,
      jules.control.current.pantalla,
    ),
  });
  const irPaso = (r: Recorrido) => {
    recorridoRef.current = r;
    setRecorrido(r);
    baseY.current = posicion.y;
    if (!r) {
      jules.ejecutar('esperar');
      jules.control.current.marca = null;
      mostrar({ texto: 'Listo. Ya puedes explorar a tu ritmo.', opciones: opciones(dueno) });
      return;
    }
    const paso = PASOS[r.paso]!;
    const lugares = contexto().lugares;
    const id = ['centro', 'escenario', 'asientos', 'centro', 'pantalla'][r.paso];
    const destino = lugares.find((p) => p.id === id) ?? lugares.find((p) => p.id === 'centro');
    objetivoPantalla.current =
      r.paso === 4 ? (lugares.find((p) => p.id === 'pantalla') ?? null) : null;
    if (destino) {
      jules.ejecutar('guiar', destino);
      jules.control.current.marca = destino;
    }
    mostrar({
      texto:
        r.paso === 4 && !lugares.some((p) => p.id === 'pantalla')
          ? 'No hay pantalla puesta. Puedes terminar el recorrido.'
          : paso.texto,
      opciones: [],
    });
  };
  const avanzar = (evento: EventoRecorrido) => {
    const actual = recorridoRef.current;
    const siguiente = avanzarRecorrido(actual, evento);
    if (siguiente !== actual) irPaso(siguiente);
  };
  const preguntar = (texto: string) => {
    const r = responder(texto, contexto());
    if (r.orden || r.destino || r.accion === 'recorrido') {
      recorridoRef.current = null;
      setRecorrido(null);
      jules.control.current.marca = null;
    }
    if (r.orden) jules.ejecutar(r.orden);
    if (r.destino) {
      jules.ejecutar('guiar', r.destino);
      jules.control.current.marca = r.destino;
    }
    if (r.accion === 'recorrido') {
      irPaso(iniciarRecorrido());
      return;
    }
    mostrar(r);
  };
  const funciones = useRef({ avanzar, mostrar });
  funciones.current = { avanzar, mostrar };
  useEffect(() => {
    const key = `ak-jules-saludo/${identidad}/${sala.plano.plantilla}`;
    let saludar = true;
    try {
      saludar = !sessionStorage.getItem(key);
      sessionStorage.setItem(key, '1');
    } catch {
      /* El saludo sigue disponible sin almacenamiento. */
    }
    if (saludar)
      funciones.current.mostrar({
        texto: `Hola, ${nombre}. Soy Jules.`,
        opciones: opciones(dueno),
      });
    return () => clearTimeout(timerBurbuja.current);
  }, [identidad, sala.plano.plantilla, nombre, dueno]);
  useEffect(() => {
    const id = setInterval(() => {
      const r = recorridoRef.current;
      if (!r) return;
      const evento = eventoDelRecorrido(r, posicion, baseY.current, objetivoPantalla.current);
      if (evento) funciones.current.avanzar(evento);
    }, P.muestraMs);
    const tecla = (e: KeyboardEvent) => {
      const evento = eventoDeTecla(
        e.code,
        Boolean(
          (e.target as HTMLElement)?.closest('input,textarea,button,[contenteditable="true"]'),
        ),
        e.repeat,
        e.ctrlKey || e.metaKey || e.altKey,
      );
      if (evento) funciones.current.avanzar(evento);
    };
    const reaccion = (e: MouseEvent) => {
      if ((e.target as HTMLElement)?.closest('.d2-reacciones button'))
        funciones.current.avanzar('reaccion');
    };
    const saltoTactil = (e: PointerEvent) => {
      if ((e.target as HTMLElement)?.closest('.cr-botones-tactiles button'))
        funciones.current.avanzar('saltar');
    };
    window.addEventListener('keydown', tecla);
    window.addEventListener('click', reaccion);
    window.addEventListener('pointerdown', saltoTactil);
    return () => {
      clearInterval(id);
      window.removeEventListener('keydown', tecla);
      window.removeEventListener('click', reaccion);
      window.removeEventListener('pointerdown', saltoTactil);
    };
  }, [posicion, jules.control]);
  return {
    respuesta,
    panel,
    setPanel,
    burbuja,
    recorrido,
    preguntar,
    decir,
    avanzar,
    abrir: () => {
      setPanel(true);
      setRespuesta((r) => ({ ...r, opciones: recorridoRef.current ? [] : opciones(dueno) }));
    },
    cancelar: () => avanzar('cancelar'),
  };
}
