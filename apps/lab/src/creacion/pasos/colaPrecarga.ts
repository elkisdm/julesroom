import type { EstadoPrecarga } from './mundos';

interface Opciones {
  programar: (tarea: () => void, fondo: boolean) => () => void;
  preparar: (clave: string, signal: AbortSignal) => Promise<string>;
  cambiar: (clave: string, estado: EstadoPrecarga, imagen: string, error?: unknown) => void;
}

/** Una intención vigente: el trabajo obsoleto nunca publica ni alimenta la caché. */
export function crearColaPrecarga({ programar, preparar, cambiar }: Opciones) {
  const terminadas = new Set<string>();
  let cola: string[] = [];
  let version = 0;
  let prioridad = '';
  let cancelarTurno = () => {};
  let actual: { clave: string; control: AbortController } | null = null;
  const cancelar = () => {
    version++;
    cancelarTurno();
    actual?.control.abort();
    actual = null;
  };
  const siguiente = () => {
    if (actual) return;
    const clave = cola.shift();
    if (!clave) return;
    if (terminadas.has(clave)) {
      siguiente();
      return;
    }
    const vigente = version;
    cancelarTurno = programar(() => {
      if (version !== vigente) return;
      const trabajo = { clave, control: new AbortController() };
      actual = trabajo;
      const finalizar = (estado: EstadoPrecarga, imagen: string, error?: unknown) => {
        if (actual !== trabajo || trabajo.control.signal.aborted) return;
        actual = null;
        if (estado === 'lista') terminadas.add(clave);
        else trabajo.control.abort(error);
        if (error === undefined) cambiar(clave, estado, imagen);
        else cambiar(clave, estado, imagen, error);
        siguiente();
      };
      void preparar(clave, trabajo.control.signal).then(
        (imagen) => finalizar('lista', imagen),
        (error: unknown) => finalizar('error', '', error),
      );
    }, clave !== prioridad);
  };
  return {
    cancelar,
    elegir(elegida: string, vecinas: readonly string[], anticipar: boolean) {
      prioridad = elegida;
      // Un vecino que pasa a ser elegido conserva lo que ya subió y compiló.
      if (actual?.clave === elegida) {
        version++;
        cancelarTurno();
      } else cancelar();
      if (!anticipar)
        for (const clave of terminadas) if (clave !== elegida) terminadas.delete(clave);
      cola = [...new Set([elegida, ...(anticipar ? vecinas : [])])].filter(
        (clave) => clave !== actual?.clave,
      );
      siguiente();
    },
  };
}
