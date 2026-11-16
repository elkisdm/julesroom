import { analizar } from './analisis';
import { precio } from './agentes';

export type ChatId = 'aula' | 'muro' | 'cripto' | 'forex' | 'materias' | 'privado';

export interface Mensaje {
  id: string;
  autor: string;
  texto: string;
  /** «HH:MM», 24 h. */
  hora: string;
  propio?: boolean;
  /** Línea que deja una acción tuya (saludar), no un mensaje. */
  accion?: boolean;
}

interface Linea {
  autor: string;
  texto: string;
}

const MAX_MENSAJE = 280;
const INICIALES = 3;
const veces = (n: number) => (n === 1 ? '1 vez' : `${n} veces`);

/** Quiénes escriben en cada conversación (personas de ejemplo). */
export const AUTORES: Record<ChatId, readonly string[]> = {
  aula: ['Andrés', 'Camila', 'Valentina', 'Mateo', 'Lucía'],
  muro: ['Isabel', 'Tomás', 'Martina'],
  cripto: ['Javier', 'Fernanda'],
  forex: ['Pablo', 'Carolina'],
  materias: ['Gabriela', 'Felipe'],
  privado: ['Paula', 'Sebastián'],
};

/** Lo que dicen en cada zona, escrito con los números del análisis de ejemplo. */
function guion(): Record<ChatId, Linea[]> {
  const btc = analizar('btc', '1h');
  const eth = analizar('eth', '1h');
  const eur = analizar('eur', '1h');
  const xau = analizar('xau', '4h');
  const s1 = btc.soportes[0]!;
  const r1eth = eth.resistencias[0]!;
  const r1eur = eur.resistencias[0]!;
  return {
    aula: [
      { autor: 'Andrés', texto: 'Empezamos la clase de hoy: cómo leer soportes y resistencias.' },
      { autor: 'Andrés', texto: 'Un nivel pesa más cuanto más veces reaccionó el precio en él, no por lo cerca que esté.' },
      { autor: 'Camila', texto: '¿Cuántos toques hacen falta para considerarlo un nivel?' },
      { autor: 'Andrés', texto: `No hay un número fijo. En el gráfico compartido, el soporte S1 de BTC/USDT lleva ${veces(s1.toques)}.` },
      { autor: 'Valentina', texto: '¿Y en temporalidades más largas se ve igual?' },
      { autor: 'Andrés', texto: 'Abre el muro de mercado y cambia la temporalidad: suelen coincidir los niveles más tocados.' },
      { autor: 'Mateo', texto: 'Ahora entiendo mejor dónde se invalida un escenario.' },
      { autor: 'Lucía', texto: '¿La lección queda en el panel del aula para repasarla después?' },
      { autor: 'Andrés', texto: 'Sí, y la puedes marcar como vista desde ahí.' },
      { autor: 'Andrés', texto: 'Recuerda que esto es material educativo, no una recomendación para operar.' },
    ],
    muro: [
      { autor: 'Isabel', texto: `BTC/USDT está cerca de su soporte S1 en ${precio('btc', s1.precio)}.` },
      { autor: 'Tomás', texto: 'En el calendario de hoy hay datos de empleo a las 09:30. Conviene mirar el gráfico después.' },
      { autor: 'Isabel', texto: `El agente de escenarios estima ${btc.probabilidades.alcista} % alcista y ${btc.probabilidades.bajista} % bajista, con datos de ejemplo.` },
      { autor: 'Tomás', texto: `¿Alguien revisa la resistencia R1 de ETH/USDT en ${precio('eth', r1eth.precio)}?` },
      { autor: 'Martina', texto: 'El letrero de noticias ya muestra el evento de las 09:30.' },
      { autor: 'Tomás', texto: `El agente de riesgo marca la invalidez del escenario alcista bajo ${precio('btc', btc.escenarios.alcista.invalidez)}.` },
      { autor: 'Isabel', texto: 'Lo que ves aquí es información de apoyo, no asesoría financiera.' },
      { autor: 'Martina', texto: 'Al terminar la clase comparto un resumen de los niveles.' },
    ],
    cripto: [
      { autor: 'Javier', texto: 'ETH/USDT lleva varias velas sin salir del rango.' },
      { autor: 'Fernanda', texto: `Yo sigo la resistencia R1 en ${precio('eth', r1eth.precio)}; ya la tocó ${veces(r1eth.toques)}.` },
      { autor: 'Javier', texto: '¿Alguien tiene a mano las alertas de hoy?' },
      { autor: 'Fernanda', texto: 'El agente de alertas deja la última en su letrero.' },
      { autor: 'Javier', texto: 'Prefiero esperar el cierre de la vela de 4 h antes de sacar conclusiones.' },
      { autor: 'Fernanda', texto: 'Buen punto, la de 1 h me confunde más de lo que aclara.' },
    ],
    forex: [
      { autor: 'Pablo', texto: `EUR/USD está cerca de su resistencia R1 en ${precio('eur', r1eur.precio)}.` },
      { autor: 'Carolina', texto: 'Hoy hay datos en el calendario que pueden mover al euro.' },
      { autor: 'Pablo', texto: '¿Qué temporalidad usan para marcar los niveles del euro?' },
      { autor: 'Carolina', texto: 'Yo marco en 1 h y lo confirmo en 4 h.' },
      { autor: 'Pablo', texto: 'Tiene sentido, me quedo con esa rutina.' },
      { autor: 'Carolina', texto: 'Son datos de ejemplo, así que sirven para practicar.' },
    ],
    materias: [
      { autor: 'Gabriela', texto: `XAU/USD se mueve entre S1 en ${precio('xau', xau.soportes[0]!.precio)} y R1 en ${precio('xau', xau.resistencias[0]!.precio)}.` },
      { autor: 'Felipe', texto: `Lo sigo en 4 h: la tendencia es ${xau.tendencia.direccion}.` },
      { autor: 'Gabriela', texto: '¿Cuál de los dos niveles lleva más toques?' },
      { autor: 'Felipe', texto: `S1 lleva ${veces(xau.soportes[0]!.toques)} y R1, ${veces(xau.resistencias[0]!.toques)}.` },
      { autor: 'Gabriela', texto: 'Entonces conviene mirar primero el nivel con más toques.' },
      { autor: 'Felipe', texto: 'Con datos de ejemplo, claro.' },
    ],
    privado: [
      { autor: 'Paula', texto: '¿Tienes un minuto para revisar mi rutina de revisión diaria?' },
      { autor: 'Sebastián', texto: 'Claro. ¿Qué parte te cuesta más?' },
      { autor: 'Paula', texto: 'Decidir cuánto arriesgar por operación.' },
      { autor: 'Sebastián', texto: 'Yo parto de un porcentaje fijo de mi capital.' },
      { autor: 'Paula', texto: '¿Y si cambia la volatilidad?' },
      { autor: 'Sebastián', texto: 'Ajusto el tamaño de la posición, no el porcentaje.' },
      { autor: 'Paula', texto: 'Gracias, lo pruebo con un ejemplo.' },
      { autor: 'Sebastián', texto: 'Cuando quieras repasamos tu registro.' },
    ],
  };
}

let memo: Record<ChatId, Linea[]> | null = null;
const guionDe = (zona: ChatId) => (memo ??= guion())[zona];

export const mensajesTotales = (zona: ChatId) => guionDe(zona).length;

const hora24 = (fecha: Date) =>
  `${String(fecha.getHours()).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')}`;

/** Hora (24 h) de un instante `minutos` antes de `ahora`. */
const haceMinutos = (ahora: Date, minutos: number) =>
  hora24(new Date(ahora.getTime() - minutos * 60_000));

/** Lo que ya se escribió al entrar a una zona: los primeros mensajes, de hace unos minutos. */
export function mensajesIniciales(zona: ChatId, ahora: Date): Mensaje[] {
  return guionDe(zona)
    .slice(0, INICIALES)
    .map((l, i) => ({
      id: `${zona}-${i}`,
      ...l,
      hora: haceMinutos(ahora, (INICIALES - i) * 2),
    }));
}

/** El mensaje que llega después del índice `indice`; `null` cuando el guion se acabó. */
export function siguienteMensaje(zona: ChatId, indice: number, ahora: Date): Mensaje | null {
  const l = guionDe(zona)[indice];
  return l ? { id: `${zona}-${indice}`, ...l, hora: haceMinutos(ahora, 0) } : null;
}

/** Tu mensaje: sin espacios sobrantes, de hasta 280 caracteres; vacío no se envía. */
export function mensajePropio(texto: string, ahora: Date, id: string): Mensaje | null {
  const limpio = texto.trim().slice(0, MAX_MENSAJE);
  if (!limpio) return null;
  return { id, autor: 'Tú', texto: limpio, hora: haceMinutos(ahora, 0), propio: true };
}
