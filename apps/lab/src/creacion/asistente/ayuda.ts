import { normalizar, reconocerOrden, type Orden, type Punto } from './control';
export interface LugarJules extends Punto {
  id: string;
  nombre: string;
}
export interface ContextoJules {
  nombre: string;
  dueno: boolean;
  personas: { nombre: string; anfitrion: boolean }[];
  lugares: LugarJules[];
}
export interface RespuestaJules {
  texto: string;
  detalle?: string;
  opciones: string[];
  orden?: Orden;
  accion?: 'recorrido' | 'lugares';
  destino?: LugarJules;
}
export const opciones = (dueno: boolean) => [
  'Muéstrame qué puedo hacer',
  'Llévame a…',
  '¿Quién está aquí?',
  'Dime los atajos',
  ...(dueno ? ['¿Cómo invito gente?', '¿Cómo presento?'] : []),
];
/** Punto de extensión: un proveedor futuro puede implementar este mismo contrato. Sin red hoy. */
export function responder(pregunta: string, contexto: ContextoJules): RespuestaJules {
  const t = normalizar(pregunta).replace(/^@?jules\s+/, '');
  const base = { opciones: opciones(contexto.dueno) };
  const orden = reconocerOrden(pregunta);
  if (orden)
    return {
      ...base,
      orden,
      texto: {
        seguir: 'Voy contigo.',
        esperar: 'Aquí te espero.',
        venir: 'Ya voy. Nos vemos en un momento.',
        puesto: 'Vuelvo a mi puesto.',
        guiar: 'Ven, te muestro.',
      }[orden],
    };
  if (/^hola( jules)?$/.test(t)) return { ...base, texto: `Hola, ${contexto.nombre}. Soy Jules.` };
  if (/^(muestrame que puedo hacer|que puedo hacer|ayuda|recorrido)$/.test(t))
    return { ...base, texto: 'Ven, descubramos la sala juntos.', accion: 'recorrido' };
  if (/^(llevame a…?|lugares|a donde puedo ir)$/.test(t))
    return {
      ...base,
      texto: 'Elige un lugar. Te acompaño hasta allí.',
      accion: 'lugares',
      opciones: contexto.lugares.map((p) => p.nombre),
    };
  const destino = contexto.lugares.find(
    (p) => normalizar(p.nombre) === t || `llevame a ${normalizar(p.nombre)}` === t,
  );
  if (destino)
    return { ...base, texto: `Vamos a ${destino.nombre.toLowerCase()}. Sigue la marca.`, destino };
  if (/^(quien esta aqui|quienes estan aqui|quien vino|presentes)$/.test(t))
    return {
      ...base,
      texto: 'Estas son las personas que están aquí.',
      detalle:
        contexto.personas
          .map((p) => `${p.nombre}${p.anfitrion ? ' · anfitrión' : ''}`)
          .join('\n') || 'Por ahora estás tú.',
    };
  if (/^(dime los atajos|atajos|teclas)$/.test(t))
    return {
      ...base,
      texto: 'Aquí tienes los atajos. Prueba cuando quieras.',
      detalle:
        'WASD / flechas · moverte\nShift · correr\nEspacio · saltar y subir a muebles\nE · sentarte o hablar con Jules cerca\n1–5 · saludar, aplaudir, mano, risa, me gusta\nJ · llamar a Jules\nH · ocultar interfaz para grabar · Esc vuelve',
    };
  if (contexto.dueno && /^(como invito gente|invitar)$/.test(t))
    return {
      ...base,
      texto: 'Comparte el enlace de tu sala con tu equipo.',
      detalle:
        'En una sala en vivo, usa Copiar enlace en presencia. Cada persona elige su nombre y personaje. Si la sala pide llave, compártela por separado. En modo individual no hay enlace activo. La voz va por Meet.',
    };
  if (contexto.dueno && /^(como presento|presentar)$/.test(t))
    return {
      ...base,
      texto: 'Usa Presentar para preparar lo que quieres mostrar.',
      detalle:
        'Presentar abre la pantalla y sus opciones. En vivo, Reunir aquí acerca al grupo y Votar abre una votación. H oculta la interfaz para tu grabación; no inicia una grabadora. Esc la recupera. Comparte voz y transmisión por Meet.',
    };
  return {
    ...base,
    texto: 'Todavía no puedo responder preguntas libres aquí. Puedo ayudarte a explorar.',
    detalle: 'Elige una opción, un lugar o dime «sígueme», «quédate» o «ven».',
  };
}
export const PASOS = [
  {
    id: 'correr',
    titulo: 'Moverte y correr',
    texto: 'Muévete con WASD. Mantén Shift para correr conmigo.',
  },
  {
    id: 'saltar',
    titulo: 'Saltar y subir',
    texto: 'Pulsa Espacio para saltar. También puedes subirte a muebles.',
  },
  { id: 'sentado', titulo: 'Tomar asiento', texto: 'Acércate a un asiento libre y pulsa E.' },
  { id: 'reaccion', titulo: 'Reaccionar', texto: 'Prueba 1–5: saluda, aplaude o levanta la mano.' },
  {
    id: 'pantalla',
    titulo: 'Mirar la pantalla',
    texto: 'Acércate a la pantalla. Aquí compartimos ideas.',
  },
] as const;
export type EventoRecorrido = (typeof PASOS)[number]['id'] | 'siguiente' | 'cancelar';
export type Recorrido = { paso: number } | null;
const DETECCION = { velocidadCorrer: 2.8, salto: 0.3, cercaPantalla: 3 };
/** El motor publica altura de piso, no el arco: el salto usa su entrada existente. */
export function eventoDeTecla(
  code: string,
  enCampo: boolean,
  repetida: boolean,
  modificador: boolean,
): EventoRecorrido | null {
  if (enCampo || repetida || modificador) return null;
  if (code === 'Space') return 'saltar';
  return /^Digit[1-5]$/.test(code) ? 'reaccion' : null;
}
/** Lee hechos del avatar, no teclas que podrían haber sido bloqueadas por un formulario. */
export function eventoDelRecorrido(
  recorrido: Recorrido,
  usuario: Punto & { velocidad?: number; estado?: string },
  baseY: number,
  pantalla: Punto | null,
): EventoRecorrido | null {
  if (!recorrido) return null;
  if (recorrido.paso === 0 && (usuario.velocidad ?? 0) > DETECCION.velocidadCorrer) return 'correr';
  if (recorrido.paso === 1 && usuario.y - baseY > DETECCION.salto) return 'saltar';
  if (recorrido.paso === 2 && usuario.estado === 'sentado') return 'sentado';
  if (
    recorrido.paso === 4 &&
    pantalla &&
    Math.hypot(usuario.x - pantalla.x, usuario.y - pantalla.y, usuario.z - pantalla.z) <
      DETECCION.cercaPantalla
  )
    return 'pantalla';
  return null;
}
export const iniciarRecorrido = (): Recorrido => ({ paso: 0 });
/** Solo la acción del paso actual o Siguiente lo completan. */
export function avanzarRecorrido(r: Recorrido, evento: EventoRecorrido): Recorrido {
  if (!r || evento === 'cancelar') return null;
  if (evento !== 'siguiente' && evento !== PASOS[r.paso]?.id) return r;
  return r.paso + 1 < PASOS.length ? { paso: r.paso + 1 } : null;
}
