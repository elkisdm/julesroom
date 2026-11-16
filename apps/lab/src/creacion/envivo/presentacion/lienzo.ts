import type { Lamina } from './protocolo';
const DISENO = {
  ancho: 1600,
  alto: 900,
  fondo: '#101722',
  texto: '#f4efe6',
  acento: '#e9b949',
  suave: '#b9b2a6',
  margen: 100,
};
function lineas(c: CanvasRenderingContext2D, texto: string, ancho: number): string[] {
  const resultado: string[] = [];
  let linea = '';
  for (const palabra of texto.split(/\s+/)) {
    if (c.measureText(`${linea} ${palabra}`).width > ancho && linea) {
      resultado.push(linea);
      linea = '';
    }
    // También corta palabras largas, para que ninguna lámina desborde el marco.
    for (const letra of `${linea ? ' ' : ''}${palabra}`) {
      if (c.measureText(linea + letra).width > ancho) {
        resultado.push(linea);
        linea = '';
      }
      linea += letra;
    }
  }
  if (linea) resultado.push(linea);
  return resultado;
}
/** Se dibuja solo al cambiar lámina, imagen o contador; no participa del bucle de render. */
export async function crearLienzo(
  lamina: Lamina | undefined,
  imagen: string | undefined,
  actual: number,
  total: number,
): Promise<HTMLCanvasElement> {
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  canvas.width = DISENO.ancho;
  canvas.height = DISENO.alto;
  const c = canvas.getContext('2d');
  if (!c) throw new Error('No se pudo dibujar la presentación.');
  c.fillStyle = DISENO.fondo;
  c.fillRect(0, 0, canvas.width, canvas.height);
  if (lamina?.tipo === 'imagen' && imagen) {
    const img = new Image();
    img.src = imagen;
    await img.decode();
    const escala = Math.min(canvas.width / img.width, canvas.height / img.height);
    c.drawImage(
      img,
      (canvas.width - img.width * escala) / 2,
      (canvas.height - img.height * escala) / 2,
      img.width * escala,
      img.height * escala,
    );
  } else if (lamina?.tipo === 'texto') {
    c.fillStyle = DISENO.acento;
    c.fillRect(DISENO.margen, 100, 80, 6);
    c.fillStyle = DISENO.texto;
    let tituloPx = 76;
    let titulo: string[] = [];
    do {
      c.font = `600 ${tituloPx}px "Bricolage Grotesque", sans-serif`;
      titulo = lineas(c, lamina.titulo, 1400);
      if (titulo.length <= 3 || tituloPx <= 44) break;
      tituloPx -= 4;
    } while (true);
    titulo.forEach((l, i) => c.fillText(l, DISENO.margen, 205 + i * tituloPx * 1.15));
    const inicio = 245 + titulo.length * tituloPx * 1.15;
    let cuerpoPx = 38;
    let cuerpo: string[] = [];
    do {
      c.font = `400 ${cuerpoPx}px Inter, sans-serif`;
      cuerpo = lamina.lineas.flatMap((l) => lineas(c, l, 1400));
      if (cuerpo.length * cuerpoPx * 1.4 <= 800 - inicio || cuerpoPx <= 24) break;
      cuerpoPx -= 2;
    } while (true);
    cuerpo.forEach((l, i) => c.fillText(l, DISENO.margen, inicio + i * cuerpoPx * 1.4));
  } else {
    c.fillStyle = DISENO.texto;
    c.font = '600 82px "Bricolage Grotesque", sans-serif';
    c.fillText(lamina ? 'Recibiendo lámina…' : 'Aquí empieza la conversación.', 100, 430);
    c.fillStyle = DISENO.suave;
    c.font = '400 36px Inter, sans-serif';
    c.fillText(
      lamina ? 'El anfitrión la está compartiendo.' : 'Presentación del anfitrión',
      100,
      500,
    );
  }
  if (total) {
    const contador = `${actual + 1} / ${total}`;
    c.font = '600 28px Inter, sans-serif';
    const ancho = c.measureText(contador).width + 40;
    c.fillStyle = DISENO.fondo;
    c.fillRect(canvas.width - ancho - 24, canvas.height - 65, ancho, 44);
    c.fillStyle = DISENO.texto;
    c.textAlign = 'right';
    c.fillText(contador, canvas.width - 44, canvas.height - 34);
  }
  return canvas;
}
