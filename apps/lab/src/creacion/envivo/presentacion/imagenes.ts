import { PARAMETROS_PRESENTACION as P } from './protocolo';
export function dimensionesReducidas(ancho: number, alto: number, max = P.ladoMayor) {
  const escala = Math.min(1, max / Math.max(ancho, alto));
  return { ancho: Math.round(ancho * escala), alto: Math.round(alto * escala) };
}
export function validarArchivos(
  archivos: readonly { type: string; size: number }[],
  existentes: number,
  limite = P.maxLaminas,
) {
  if (!archivos.length) throw new Error('Elige al menos una imagen.');
  if (archivos.length + existentes > limite)
    throw new Error(`Puedes presentar hasta ${limite} láminas.`);
  if (archivos.some((a) => !['image/png', 'image/jpeg', 'image/webp'].includes(a.type)))
    throw new Error('Elige imágenes PNG, JPG o WebP.');
  if (archivos.some((a) => a.size > 30 * 1024 * 1024))
    throw new Error('Cada archivo debe pesar menos de 30 MB.');
}
/** Decodifica y comprime de una en una para limitar el pico de memoria al importar un lote. */
export async function prepararImagen(archivo: File): Promise<string> {
  const bitmap = await createImageBitmap(archivo);
  try {
    const d = dimensionesReducidas(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = d.ancho;
    canvas.height = d.alto;
    const c = canvas.getContext('2d');
    if (!c) throw new Error('Tu navegador no puede preparar esta imagen.');
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, canvas.width, canvas.height);
    c.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (let escala = 0; escala < 5; escala++) {
      for (const calidad of [0.86, 0.75, 0.62, 0.48, 0.32]) {
        const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', calidad));
        if (!blob) throw new Error('No se pudo convertir la imagen a JPEG.');
        if (blob.size <= P.maxBytesImagen)
          return await new Promise<string>((resolve, reject) => {
            const lector = new FileReader();
            lector.onload = () => resolve(lector.result as string);
            lector.onerror = () => reject(new Error('No se pudo leer la imagen.'));
            lector.readAsDataURL(blob);
          });
      }
      const copia = await createImageBitmap(canvas);
      canvas.width = Math.round(canvas.width * 0.8);
      canvas.height = Math.round(canvas.height * 0.8);
      c.drawImage(copia, 0, 0, canvas.width, canvas.height);
      copia.close();
    }
    throw new Error('No se pudo reducir la imagen a 200 KB. Prueba con una imagen más simple.');
  } finally {
    bitmap.close();
  }
}
