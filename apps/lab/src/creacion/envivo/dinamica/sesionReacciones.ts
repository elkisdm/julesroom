import { saludarD2 } from '@oficina/motor';
import { crearReacciones } from './reacciones';
import { crearCuota, D2, leerD2 } from './modelo';
interface FuenteReacciones {
  personas(): readonly { id: string }[];
  suscribirDatos(fn: (texto: string, emisor: string) => void): () => void;
}
const sesiones = new WeakMap<FuenteReacciones, ReturnType<typeof crearSesion>>();
function crearSesion(fuente: FuenteReacciones, yo: string, dueno: string) {
  const estado = crearReacciones();
  const oyentes = new Set<() => void>();
  const cuota = crearCuota(D2.cuotaMs);
  let festejo = 0;
  const avisar = () => {
    for (const fn of oyentes) fn();
  };
  const aplicar = (id: string, numero: number, activa: boolean) => {
    const ahora = Date.now();
    if (estado.recibir(id, numero, activa, ahora)) festejo = ahora;
    if (numero === 1) saludarD2(id, ahora + D2.reaccionMs);
    avisar();
  };
  // Una suscripción por conexión; permanece al abrir el constructor. Sin timers propios.
  // La fuente y este registro son efímeros y pueden recolectarse juntos al desconectar.
  fuente.suscribirDatos((texto, emisor) => {
    const p = leerD2(
      texto,
      emisor,
      dueno,
      fuente.personas().map((p) => p.id),
    );
    if (p?.tipo === 'd2-reaccion' && cuota(emisor, Date.now()))
      aplicar(emisor, p.reaccion, p.activa);
  });
  return {
    estado,
    aplicar,
    festejo: () => (Date.now() - festejo < D2.festejoMs ? festejo : 0),
    suscribir(fn: () => void) {
      oyentes.add(fn);
      return () => {
        oyentes.delete(fn);
      };
    },
    limpiar() {
      const cambio = estado.limpiar(Date.now(), [yo, ...fuente.personas().map((p) => p.id)]);
      const caduco = festejo > 0 && Date.now() - festejo >= D2.festejoMs;
      if (caduco) festejo = 0;
      if (cambio || caduco) avisar();
    },
  };
}
/** Conserva la reacción y las manos durante toda la conexión, incluso con la UI desmontada. */
export function sesionReacciones(fuente: FuenteReacciones, yo: string, dueno: string) {
  let s = sesiones.get(fuente);
  if (!s) {
    s = crearSesion(fuente, yo, dueno);
    sesiones.set(fuente, s);
  }
  return s;
}
