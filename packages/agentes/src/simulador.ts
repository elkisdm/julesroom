import { extraerTextoUsuario } from './prompt';
import { ErrorProveedor, type EventoModelo, type PeticionModelo, type Proveedor } from './tipos';

export interface OpcionesSimulador {
  /** Pausa entre trozos, en ms. */
  retardoMs?: number;
  palabrasPorTrozo?: number;
  /** Lanza este error antes de emitir nada. */
  falla?: 'sin-clave' | 'sin-red' | 'limite' | 'interno';
  /** Emite n trozos y lanza «cortada». */
  cortarEn?: number;
  /** Termina con motivo «tope». */
  tope?: boolean;
}

export const CONFIG_SIMULADOR = { retardoMs: 0, palabrasPorTrozo: 3, maxCaracteresCita: 60 };

/** El sistema abre con «Eres <nombre>, <rol>.» (ver `construirSistema`). */
const nombreDelSistema = (sistema: string) => /^Eres ([^,\n]+),/.exec(sistema)?.[1];

const aproximarTokens = (caracteres: number) => Math.ceil(caracteres / 4);

function esperar(ms: number, senal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    const fin = () => {
      clearTimeout(t);
      resolve();
    };
    const t = setTimeout(() => {
      senal?.removeEventListener('abort', fin);
      resolve();
    }, ms);
    senal?.addEventListener('abort', fin, { once: true });
  });
}

/** Proveedor determinista, sin red: para pruebas, demos y la sala sin clave. */
export function crearSimulador(opciones: OpcionesSimulador = {}): Proveedor {
  const { retardoMs, palabrasPorTrozo } = { ...CONFIG_SIMULADOR, ...opciones };
  return {
    async *transmitir(peticion: PeticionModelo): AsyncGenerator<EventoModelo> {
      if (opciones.falla) throw new ErrorProveedor(opciones.falla);
      const ultimo = peticion.mensajes.filter((m) => m.role === 'user').at(-1)?.content ?? '';
      let cita = extraerTextoUsuario(ultimo);
      if (cita.length > CONFIG_SIMULADOR.maxCaracteresCita)
        cita = `${cita.slice(0, CONFIG_SIMULADOR.maxCaracteresCita).trimEnd()}…`;
      const nombre = nombreDelSistema(peticion.sistema);
      const respuesta = `${nombre ? `Soy ${nombre}. ` : ''}Sobre «${cita}»: esta es una respuesta simulada.`;
      const palabras = respuesta.split(' ');
      let trozos: string[] = [];
      for (let i = 0; i < palabras.length; i += palabrasPorTrozo) {
        trozos.push(`${i === 0 ? '' : ' '}${palabras.slice(i, i + palabrasPorTrozo).join(' ')}`);
      }
      const cortar = opciones.cortarEn !== undefined;
      if (cortar) trozos = trozos.slice(0, opciones.cortarEn);

      for (const texto of trozos) {
        if (peticion.senal?.aborted) throw new ErrorProveedor('cortada');
        yield { tipo: 'texto', texto };
        await esperar(retardoMs, peticion.senal);
      }
      if (cortar || peticion.senal?.aborted) throw new ErrorProveedor('cortada');
      const entrada =
        peticion.sistema.length + peticion.mensajes.reduce((n, m) => n + m.content.length, 0);
      yield {
        tipo: 'fin',
        motivo: opciones.tope ? 'tope' : 'completo',
        uso: {
          entrada: aproximarTokens(entrada),
          salida: aproximarTokens(respuesta.length),
          cacheLeida: 0,
          cacheEscrita: 0,
        },
      };
    },
  };
}
