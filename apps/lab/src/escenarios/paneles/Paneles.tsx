import { useEffect, useRef, useState } from 'react';
import type { PuntoPantalla } from '@oficina/motor';
import { AGENTES_SALA, agenteDelPuesto } from './agentes';
import type { EstadoPanel, Panel } from './abrir';
import { mensajePropio, mensajesIniciales, siguienteMensaje } from './chat';
import type { Mensaje } from './chat';
import { claseInicial, detalleClase, exponer } from './clase';
import { PanelAgente } from './PanelAgente';
import { PanelAula } from './PanelAula';
import { PanelChat } from './PanelChat';
import { PanelMercado } from './PanelMercado';
import { PanelVideos } from './PanelVideos';
import { asignarTarea, avanzarTareas, estadoInicial } from './tareas';
import type { EstadoAgentes } from './tareas';
import './paneles.css';

const CADA_MENSAJE_MS = 7000;

interface Props {
  origen?: PuntoPantalla | null;
  estado: EstadoPanel;
  alFijar: (fijado: boolean) => void;
  alCerrar: () => void;
}

/**
 * Panel lateral (escritorio) u hoja inferior (móvil) que muestra el panel abierto. Lleva el estado de la
 * sala de ejemplo (clase del aula, tareas de agentes, chat) para que sobreviva a cerrar y abrir.
 */
export function Paneles({ estado, origen, alFijar, alCerrar }: Props) {
  const { panel, fijado } = estado;
  const contenedor = useRef<HTMLElement>(null);
  useEffect(() => {
    const hoja = contenedor.current;
    if (hoja && origen && panel) {
      hoja.style.transformOrigin = `${origen.x - hoja.offsetLeft}px ${origen.y - hoja.offsetTop}px`;
    }
  }, [origen, panel]);
  const [clase, setClase] = useState(() => claseInicial(Date.now()));
  const [vistas, setVistas] = useState<Record<string, string[]>>({});
  const [agentes, setAgentes] = useState<EstadoAgentes>(() => estadoInicial(AGENTES_SALA));
  const [mensajes, setMensajes] = useState<Mensaje[]>(() =>
    mensajesIniciales('privado', new Date()),
  );
  const siguiente = useRef(3);
  const [ahora, setAhora] = useState(() => Date.now());

  // Mientras se ve el aula o un agente, o haya una tarea en marcha, el reloj de la demo avanza.
  const hayTareas = Object.values(agentes).some((e) => e.tarea);
  const necesitaReloj = panel?.tipo === 'aula' || panel?.tipo === 'agente' || hayTareas;
  useEffect(() => {
    if (!necesitaReloj) return;
    const id = setInterval(() => {
      const t = Date.now();
      setAhora(t);
      setAgentes((actual) => avanzarTareas(actual, t).estados);
    }, 500);
    return () => clearInterval(id);
  }, [necesitaReloj]);

  const chatAbierto = panel?.tipo === 'chat';
  useEffect(() => {
    if (!chatAbierto) return;
    const id = setInterval(() => {
      const m = siguienteMensaje('privado', siguiente.current, new Date());
      if (!m) return;
      siguiente.current += 1;
      setMensajes((l) => [...l, m]);
    }, CADA_MENSAJE_MS);
    return () => clearInterval(id);
  }, [chatAbierto]);

  // El último panel se conserva mientras se desliza hacia afuera.
  const [mostrado, setMostrado] = useState<Panel | null>(panel);
  if (panel && panel !== mostrado) setMostrado(panel);

  useEffect(() => {
    if (!panel) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) alCerrar();
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [panel, alCerrar]);

  const hoja = { fijado, alFijar, alCerrar };
  let contenido = null;
  if (mostrado?.tipo === 'mercado')
    contenido = <PanelMercado key={mostrado.activo} activoInicial={mostrado.activo} {...hoja} />;
  else if (mostrado?.tipo === 'aula')
    contenido = (
      <PanelAula
        clase={clase}
        detalle={detalleClase(clase)}
        ahora={ahora}
        vistas={vistas}
        alAlternarVista={(cursoId, leccionId) =>
          setVistas((v) => {
            const hechas = v[cursoId] ?? [];
            return {
              ...v,
              [cursoId]: hechas.includes(leccionId)
                ? hechas.filter((x) => x !== leccionId)
                : [...hechas, leccionId],
            };
          })
        }
        alExponer={(cursoId, leccionId) => setClase(exponer(cursoId, leccionId, 'Tú', Date.now()))}
        {...hoja}
      />
    );
  else if (mostrado?.tipo === 'videos') contenido = <PanelVideos {...hoja} />;
  else if (mostrado?.tipo === 'chat')
    contenido = (
      <PanelChat
        lugar="Privado"
        mensajes={mensajes}
        alEnviar={(texto) => {
          const m = mensajePropio(texto, new Date(), `propio-${Date.now()}`);
          if (m) setMensajes((l) => [...l, m]);
        }}
        {...hoja}
      />
    );
  else if (mostrado?.tipo === 'agente') {
    const agente = agenteDelPuesto(mostrado.puesto);
    contenido = (
      <PanelAgente
        key={agente.id}
        agente={agente}
        estado={agentes[agente.id]!}
        ahora={ahora}
        alAsignar={(t) => {
          const inicio = Date.now();
          setAhora(inicio);
          setAgentes((a) => (a[agente.id]?.tarea ? a : asignarTarea(a, agente.id, t, inicio)));
        }}
        {...hoja}
      />
    );
  }

  return (
    <aside
      ref={contenedor}
      className="pn"
      data-abierto={panel ? '' : undefined}
      aria-hidden={panel ? undefined : true}
      inert={!panel}
      onPointerDown={(e) => {
        // Tocar el panel lo fija, salvo sus propios botones (cerrar, fijar).
        if (panel && !fijado && !(e.target as HTMLElement).closest('.pn-icono')) alFijar(true);
      }}
    >
      {contenido}
    </aside>
  );
}
