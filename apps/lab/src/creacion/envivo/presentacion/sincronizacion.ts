import {
  estadoInicialPresentacion,
  leerPresentacion,
  reunirImagen,
  trocearImagen,
  PARAMETROS_PRESENTACION as P,
} from './protocolo';
import type { EstadoPresentacion, MensajePresentacion, TrozoImagen } from './protocolo';
interface Opciones {
  yo: string;
  dueno: string;
  invitado: boolean;
  presentes: () => readonly string[];
  enviar: (texto: string) => Promise<void>;
  ahora?: () => number;
}
export interface FotoPresentacion {
  estado: EstadoPresentacion;
  imagenes: ReadonlyMap<string, string>;
  laser: Extract<MensajePresentacion, { tipo: 'd3/laser' }> | null;
  error: string;
}
/** Entrega acotada con acuse por imagen; todos reutilizan los mismos trozos difundidos. */
export function crearPresentacion(o: Opciones) {
  const ahora = o.ahora ?? Date.now;
  let foto: FotoPresentacion = {
    estado: estadoInicialPresentacion(),
    imagenes: new Map(),
    laser: null,
    error: '',
  };
  const oyentes = new Set<() => void>();
  const entradas = new Map<string, Map<number, TrozoImagen>>();
  const cola: {
    id: string;
    trozos: TrozoImagen[];
    siguiente: number;
    esperando: Set<string>;
    intento: number;
    fin: number;
  }[] = [];
  let ultimoPedido = -Infinity,
    ultimaFoto = -Infinity,
    ultimoLaser = -Infinity;
  const avisar = (cambio: Partial<FotoPresentacion>) => {
    foto = { ...foto, ...cambio };
    oyentes.forEach((f) => f());
  };
  const enviar = (p: MensajePresentacion) => {
    void o.enviar(JSON.stringify(p)).catch((error: unknown) => {
      console.warn('[presentacion] envío pendiente de reintento', error);
      avisar({ error: 'La conexión se interrumpió. Reintentando la presentación…' });
    });
  };
  const esDueno = !o.invitado && o.yo === o.dueno && !!o.dueno;
  const falta = () => {
    const ls = foto.estado.laminas;
    return [ls[foto.estado.actual], ...ls].find(
      (l) => l?.tipo === 'imagen' && !foto.imagenes.has(l.id),
    );
  };
  const transmitirEstado = () => {
    enviar(foto.estado);
    ultimaFoto = ahora();
  };
  return {
    ver: () => foto,
    suscribir(fn: () => void) {
      oyentes.add(fn);
      return () => {
        oyentes.delete(fn);
      };
    },
    publicar(
      cambio: Partial<Pick<EstadoPresentacion, 'pantalla' | 'actual' | 'laminas'>>,
      imagenes: ReadonlyMap<string, string> = foto.imagenes,
    ) {
      if (!esDueno) throw new Error('Solo el anfitrión puede presentar.');
      const estado = { ...foto.estado, ...cambio, revision: foto.estado.revision + 1 };
      if (!leerPresentacion(JSON.stringify(estado), o.yo, o.dueno))
        throw new Error('La presentación supera los límites de láminas o de texto.');
      const conservadas = new Map(
        [...imagenes].filter(([id]) => estado.laminas.some((l) => l.id === id)),
      );
      avisar({ estado, imagenes: conservadas, laser: null, error: '' });
      transmitirEstado();
    },
    apuntar(x: number, y: number, visible: boolean) {
      const lamina = foto.estado.laminas[foto.estado.actual];
      if (!esDueno || !lamina || (visible && ahora() - ultimoLaser < 1000 / P.laserHz)) return;
      ultimoLaser = ahora();
      const laser = {
        tipo: 'd3/laser' as const,
        lamina: lamina.id,
        x: Math.max(0, Math.min(1, x)),
        y: Math.max(0, Math.min(1, y)),
        visible,
      };
      avisar({ laser });
      enviar(laser);
    },
    recibir(texto: string, emisor: string) {
      if (emisor === o.yo || ![o.dueno, ...o.presentes()].includes(emisor)) return;
      const p = leerPresentacion(texto, emisor, o.dueno);
      if (!p) return;
      if (p.tipo === 'd3/estado' && !esDueno) {
        if (p.revision <= foto.estado.revision) return;
        const imagenes = new Map(
          [...foto.imagenes].filter(([id]) => p.laminas.some((l) => l.id === id)),
        );
        for (const id of entradas.keys())
          if (!p.laminas.some((l) => l.id === id)) entradas.delete(id);
        avisar({ estado: p, imagenes, laser: null, error: '' });
        ultimoPedido = -Infinity;
      } else if (p.tipo === 'd3/pedir' && esDueno) {
        if (!p.id) {
          transmitirEstado();
          return;
        }
        const imagen = foto.imagenes.get(p.id);
        if (!imagen) return;
        const previa = cola.find((c) => c.id === p.id);
        if (previa) {
          previa.esperando.add(emisor);
          return;
        }
        // Un huésped solo puede solicitar cada imagen del manifiesto vigente, una vez en cola.
        const tarea = {
          id: p.id,
          trozos: trocearImagen(p.id, imagen),
          siguiente: 0,
          esperando: new Set([emisor]),
          intento: 1,
          fin: 0,
        };
        if (p.id === foto.estado.laminas[foto.estado.actual]?.id) cola.unshift(tarea);
        else cola.push(tarea);
      } else if (p.tipo === 'd3/acuse' && esDueno) {
        cola.find((c) => c.id === p.id)?.esperando.delete(emisor);
      } else if (p.tipo === 'd3/trozo' && !esDueno) {
        if (!foto.estado.laminas.some((l) => l.id === p.id && l.tipo === 'imagen')) return;
        if (foto.imagenes.has(p.id)) {
          if (p.n === p.total - 1) enviar({ tipo: 'd3/acuse', id: p.id });
          return;
        }
        let partes = entradas.get(p.id);
        if (!partes || partes.values().next().value?.total !== p.total) {
          partes = new Map();
          entradas.set(p.id, partes);
        }
        partes.set(p.n, p);
        if (partes.size !== p.total) return;
        const imagen = reunirImagen([...partes.values()]);
        entradas.delete(p.id);
        if (!imagen) return;
        avisar({ imagenes: new Map(foto.imagenes).set(p.id, imagen), error: '' });
        enviar({ tipo: 'd3/acuse', id: p.id });
        ultimoPedido = -Infinity;
      } else if (p.tipo === 'd3/laser' && p.lamina === foto.estado.laminas[foto.estado.actual]?.id)
        avisar({ laser: p });
    },
    tick() {
      if (!esDueno) {
        if (ahora() - ultimoPedido >= P.pedirCadaMs) {
          const pendiente = falta();
          if (foto.estado.revision === 0 || pendiente)
            enviar({ tipo: 'd3/pedir', id: pendiente?.id ?? '' });
          ultimoPedido = ahora();
        }
        return;
      }
      if (ahora() - ultimaFoto >= P.pedirCadaMs) transmitirEstado();
      const c = cola[0];
      if (!c) return;
      for (const id of c.esperando) if (!o.presentes().includes(id)) c.esperando.delete(id);
      if (!c.esperando.size) {
        cola.shift();
        return;
      }
      if (!foto.imagenes.has(c.id)) {
        cola.shift();
        return;
      }
      if (c.siguiente < c.trozos.length) {
        enviar(c.trozos[c.siguiente++]!);
        if (c.siguiente === c.trozos.length) c.fin = ahora();
      } else if (ahora() - c.fin >= P.reintentoMs) {
        if (c.intento >= P.intentos) {
          cola.shift();
          avisar({
            error: 'No se pudo confirmar una lámina. Los invitados volverán a solicitarla.',
          });
        } else {
          c.intento++;
          c.siguiente = 0;
        }
      }
    },
  };
}
export type PresentacionSincronizada = ReturnType<typeof crearPresentacion>;
