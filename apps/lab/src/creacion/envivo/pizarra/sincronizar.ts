const PARAMETROS = { pedirCadaMs: 2000, reenviarCadaMs: 5000, participantes: 25 };
import { PEDIR_PIZARRA, recibirPizarra, serializarPizarra, type FotoPizarra } from './mensajes';
export interface CanalPizarra {
  enviarDatos(texto: string): Promise<void>;
  suscribirDatos(f: (texto: string, emisor: string) => void): () => void;
  personas(): readonly { id: string }[];
}
/** Foto fiable, recepción autorizada y recuperación de entrada tardía/reconexión. */
export function sincronizarPizarra(
  fuente: CanalPizarra,
  dueno: string,
  anfitrion: boolean,
  actual: () => FotoPizarra,
  recibir: (f: FotoPizarra) => void,
  error: () => void,
): () => void {
  let activo = true;
  const enviar = (texto: string) => {
    void fuente.enviarDatos(texto).catch(() => {
      if (activo) error();
    });
  };
  const pedidos = new Map<string, number>();
  const salir = fuente.suscribirDatos((texto, emisor) => {
    if (anfitrion) {
      if (texto !== PEDIR_PIZARRA || !fuente.personas().some((p) => p.id === emisor)) return;
      const ahora = Date.now(),
        ultimo = pedidos.get(emisor);
      if (ultimo !== undefined && ahora - ultimo < PARAMETROS.pedirCadaMs) return;
      if (pedidos.size >= PARAMETROS.participantes) pedidos.clear();
      pedidos.set(emisor, ahora);
      enviar(serializarPizarra(actual()));
    } else {
      const foto = recibirPizarra(texto, emisor, dueno, actual().revision);
      if (foto) recibir(foto);
    }
  });
  if (!anfitrion) enviar(PEDIR_PIZARRA);
  const timer = anfitrion
    ? setInterval(() => enviar(serializarPizarra(actual())), PARAMETROS.reenviarCadaMs)
    : undefined;
  return () => {
    activo = false;
    salir();
    clearInterval(timer);
  };
}
