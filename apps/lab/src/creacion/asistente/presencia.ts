import type { Punto } from './control';
export const PRESENCIA_JULES = {
  saludoMs: 20000,
  muestraMs: 250,
  mirada: 5,
  piso: 1.5,
  anchoVista: 0.9,
  pasoLateral: 1.8,
  distanciaPantalla: 12,
  descansoApartarseMs: 5000,
};
/** El primer censo es una base; no se saluda retroactivamente ni se encolan llegadas. */
export function crearSaludos() {
  let conocidos: Set<string> | null = null;
  let ultimo = -Infinity;
  return (personas: readonly { id: string; nombre: string }[], ahora: number): string | null => {
    const nuevas = conocidos ? personas.filter((p) => !conocidos!.has(p.id)) : [];
    conocidos = new Set(personas.map((p) => p.id));
    if (!nuevas.length || ahora - ultimo < PRESENCIA_JULES.saludoMs) return null;
    ultimo = ahora;
    const nombre = nuevas[0]!.nombre.trim().split(/\s+/)[0] || 'visitante';
    return `Hola, ${nombre}. Qué gusto verte.`;
  };
}
/** Escoge una mirada cercana del mismo piso; no cambia el destino. */
export function miradaCercana(jules: Punto, personas: readonly Punto[]): Punto | null {
  let distancia = PRESENCIA_JULES.mirada;
  let elegida: Punto | null = null;
  for (const p of personas) {
    const d = Math.hypot(p.x - jules.x, p.z - jules.z);
    if (Math.abs(p.y - jules.y) <= PRESENCIA_JULES.piso && d < distancia) {
      distancia = d;
      elegida = p;
    }
  }
  return elegida;
}
/** Sale del segmento de visión, probando ambos costados sobre suelo libre. */
export function apartarseDePantalla(
  jules: Punto,
  usuario: Punto,
  pantallas: readonly Punto[],
  libre: (p: Punto) => boolean,
): Punto | null {
  for (const pantalla of pantallas) {
    const dx = pantalla.x - usuario.x,
      dz = pantalla.z - usuario.z;
    const largo = Math.hypot(dx, dz);
    if (largo < 1 || largo > PRESENCIA_JULES.distanciaPantalla) continue;
    const t = ((jules.x - usuario.x) * dx + (jules.z - usuario.z) * dz) / (largo * largo);
    if (t <= 0 || t >= 1) continue;
    const lateral = Math.hypot(jules.x - usuario.x - t * dx, jules.z - usuario.z - t * dz);
    if (
      lateral >= PRESENCIA_JULES.anchoVista ||
      Math.abs(jules.y - usuario.y) > PRESENCIA_JULES.piso
    )
      continue;
    for (const lado of [-1, 1]) {
      const punto = {
        x: jules.x + ((lado * dz) / largo) * PRESENCIA_JULES.pasoLateral,
        y: jules.y,
        z: jules.z - ((lado * dx) / largo) * PRESENCIA_JULES.pasoLateral,
      };
      if (libre(punto)) return punto;
    }
  }
  return null;
}
