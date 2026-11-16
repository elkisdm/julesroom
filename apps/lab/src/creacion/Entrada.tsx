/** Enruta las capas de entrada; cada paso es dueño de su interfaz y confirmación. */
import type { MutableRefObject } from 'react';
import type { Proyector, ResumenSala, SalaGuardada } from '@oficina/motor';
import type { EntradaDemo } from './envivo/LlaveDemo';
import type { Paso } from './Crear';
import type { ControlVestidor } from './pasos/Vestidor3D';
import { BotonSonido } from './BotonSonido';
import { ElegirMundo } from './pasos/ElegirMundo';
import { Personaje } from './pasos/Personaje';
import { Llegada } from './pasos/Llegada';
import { Nombre } from './pasos/Nombre';
import { Agentes } from './pasos/Agentes';
import { Invitar } from './pasos/Invitar';
import { Flujo } from './pasos/Flujo';

interface Props {
  paso: Paso;
  invitado?: boolean;
  alEntrarYa?: () => void;
  /** Enlace de la sala compartida; `null` sin los servicios locales. */
  enlace: string | null;
  demo?: EntradaDemo;
  personas?: number;
  lista: boolean;
  agentesElegidos: string[];
  alAgentes: (ids: string[]) => void;
  precarga: { porcentaje: number; fallos: number };
  miniaturas: Record<string, string>;
  cuadroVisible: string;
  variante?: string;
  alVariante: (id: string) => void;
  sala: SalaGuardada;
  salas: ResumenSala[];
  errorBiblioteca: string;
  alAbrirSala: (id: string) => void;
  alCrearSala: () => void;
  alRenombrarSala: (id: string, nombre: string) => boolean;
  alEliminarSala: (id: string) => boolean;
  alCambiar: (s: SalaGuardada) => void;
  alElegirPlantilla: (id: string) => void;
  alIr: (p: Paso) => void;
  alEntrar: () => void;
  proyector: MutableRefObject<Proyector | null>;
  controlVestidor: MutableRefObject<ControlVestidor>;
  posicionVestidor: { x: number; y: number; z: number };
}

export function Entrada(props: Props) {
  const { paso } = props;
  return (
    <div className="cr-capa" key={paso}>
      {props.invitado ? (
        <header className="fl-cabecera">
          <nav className="fl-pasos" aria-label="Pasos de entrada">
            <button
              aria-current={paso === 'nombre' ? 'step' : undefined}
              onClick={() => props.alIr('nombre')}
            >
              Nombre
            </button>
            <button
              aria-current={paso === 'personaje' ? 'step' : undefined}
              disabled={paso === 'nombre'}
              onClick={() => props.alIr('personaje')}
            >
              Personaje
            </button>
          </nav>
          {paso === 'personaje' && (
            <button className="cr-boton cr-boton--prim cr-boton--chico" onClick={props.alEntrarYa}>
              Entrar ya
            </button>
          )}
        </header>
      ) : (
        paso !== 'llegada' && <Flujo paso={paso} alIr={props.alIr} />
      )}
      <div className="cr-esquina-sup">
        <BotonSonido />
      </div>
      {paso === 'llegada' && (
        <Llegada
          lista={props.lista}
          precarga={props.precarga}
          salas={props.salas}
          miniaturas={props.miniaturas}
          error={props.errorBiblioteca}
          alCrear={props.alCrearSala}
          alAbrir={props.alAbrirSala}
          alRenombrar={props.alRenombrarSala}
          alEliminar={props.alEliminarSala}
        />
      )}
      {paso === 'sala' && (
        <ElegirMundo
          plantilla={props.sala.plano.plantilla}
          variante={props.variante}
          miniaturas={props.miniaturas}
          fallos={props.precarga.fallos}
          cuadroVisible={props.cuadroVisible}
          preparada={props.lista}
          alElegir={props.alElegirPlantilla}
          alVariante={props.alVariante}
          alConfirmar={() => props.alIr('nombre')}
          alVolver={() => props.alIr('llegada')}
        />
      )}
      {paso === 'nombre' && (
        <Nombre
          sala={props.sala}
          alCambiar={props.alCambiar}
          alSeguir={() => props.alIr('personaje')}
          alVolver={() => props.alIr('sala')}
          proyector={props.proyector}
          control={props.controlVestidor}
          posicion={props.posicionVestidor}
        />
      )}
      {paso === 'personaje' && (
        <Personaje {...props} control={props.controlVestidor} posicion={props.posicionVestidor} />
      )}
      {paso === 'agentes' && (
        <Agentes
          sala={props.sala}
          elegidos={props.agentesElegidos}
          alElegir={props.alAgentes}
          alSeguir={() => props.alIr('invitar')}
          alVolver={() => props.alIr('personaje')}
          proyector={props.proyector}
        />
      )}
      {paso === 'invitar' && (
        <Invitar
          enlace={props.enlace}
          demo={props.demo}
          personas={props.personas}
          nombreSala={props.sala.nombre}
          alEntrar={props.alEntrar}
          alVolver={() => props.alIr('agentes')}
        />
      )}
    </div>
  );
}
