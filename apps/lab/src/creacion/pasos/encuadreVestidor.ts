import type { Encuadre } from '@oficina/motor';
export const PARAMETROS_VESTIDOR = {
  corteMovil: 720,
  panelAncho: 390,
  margen: 32,
  cabecera: 76,
  panelMovil: 340,
  altoAvatar: 2.1,
  alturaNombre: 1.85,
  margenNombre: 0.34,
  margenNombreGorro: 0.54,
  prioridadComposicion: 2,
  anchoAvatar: 1.2,
  profundidad: 0.3,
  ocupacion: 0.83,
  fov: 28,
  altoBusto: 1.25,
  centroBusto: 1.4,
  suavizado: 12,
  sensibilidadGiro: 0.012,
  retorno: 9,
  actualizarMiniaturasMs: 150,
  duracionGesto: 1,
  fondoDistancia: 1,
  fondoLado: 100,
  fondoOpacidad: 0.72,
  fondoColor: '#07080b',
  luzAmbiente: 0.8,
  luzIntensidad: 24,
  luzAltura: 3,
  luzDistancia: 12,
};
const p = PARAMETROS_VESTIDOR;
export function areaVestidor(ancho: number, alto: number) {
  return ancho <= p.corteMovil
    ? {
        x: p.margen / 2,
        y: p.cabecera,
        ancho: ancho - p.margen,
        alto: alto - p.cabecera - p.panelMovil,
      }
    : {
        x: p.margen,
        y: p.cabecera,
        ancho: ancho - p.panelAncho - p.margen * 3,
        alto: alto - p.cabecera - p.margen,
      };
}
/** Cámara paralela frontal: desplaza su eje óptico para colocar el avatar en el área libre. */
export function encuadreVestidor(
  ancho: number,
  alto: number,
  pies: { x: number; y: number; z: number },
  busto: boolean,
): Encuadre {
  const area = areaVestidor(ancho, alto);
  const tan = Math.tan((p.fov * Math.PI) / 360);
  const altura = busto ? p.altoBusto : p.altoAvatar;
  const distancia =
    Math.max(
      (altura * alto) / (area.alto * p.ocupacion),
      (p.anchoAvatar * alto) / (area.ancho * p.ocupacion),
    ) /
      (2 * tan) +
    p.profundidad;
  const ndcX = ((area.x + area.ancho / 2) / ancho) * 2 - 1;
  const ndcY = 1 - ((area.y + area.alto / 2) / alto) * 2;
  const objetivo = {
    x: pies.x - (ndcX * distancia * tan * ancho) / alto,
    y: pies.y + (busto ? p.centroBusto : p.altoAvatar / 2) - ndcY * distancia * tan,
    z: pies.z,
  };
  return { objetivo, posicion: { ...objetivo, z: objetivo.z + distancia }, distancia };
}

/** La cabeza del rig incluye el desplazamiento del idle y del giro, sin estimarlo desde los pies. */
export function nombreSobreCabeza(cabeza: { x: number; y: number; z: number }, gorro: boolean) {
  return { ...cabeza, y: cabeza.y + (gorro ? p.margenNombreGorro : p.margenNombre) };
}

/** Etiqueta del nombre en Nombre y Tú: sobre la cabeza del rig; antes del primer cuadro, sobre los pies. */
export function etiquetaVestidor(
  cabeza: { x: number; y: number; z: number } | undefined,
  pies: { x: number; y: number; z: number },
  gorro: boolean,
) {
  return cabeza ? nombreSobreCabeza(cabeza, gorro) : { ...pies, y: pies.y + p.alturaNombre };
}
