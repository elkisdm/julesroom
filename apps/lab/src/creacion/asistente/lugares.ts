import { accionesDe, alturaEn, sueloDe, type Escenario } from '@oficina/motor';
import { crearMapaDeSuelo, puntoLibre } from '@oficina/motor';
import type { LugarJules } from './ayuda';
import type { Punto } from './control';
const P = { radio: 0.55, paso: 0.5, anillos: 8, muestras: 16 };
/** Puntos de guía derivados del mundo actual, con un espacio libre para detenerse. */
export function lugaresDe(
  escenario: Escenario,
  desde: Punto = escenario.entradas[0]!,
  colocada?: (Punto & { giro: number }) | null,
): LugarJules[] {
  const suelo = sueloDe(escenario),
    mapa = crearMapaDeSuelo(suelo);
  const libre = (p: Punto): Punto | null => {
    for (let anillo = 0; anillo <= P.anillos; anillo++) {
      for (let i = 0; i < (anillo ? P.muestras : 1); i++) {
        const angulo = (i * Math.PI * 2) / P.muestras;
        const x = p.x + Math.sin(angulo) * anillo * P.paso;
        const z = p.z + Math.cos(angulo) * anillo * P.paso;
        const y = alturaEn(suelo, x, z, p.y);
        if (Number.isFinite(y) && puntoLibre(mapa, x, z, P.radio, y)) return { x, y, z };
      }
    }
    return null;
  };
  const lugares: LugarJules[] = [];
  const agregar = (id: string, nombre: string, punto: Punto) => {
    const p = libre(punto);
    if (p) lugares.push({ id, nombre, ...p });
  };
  const zona =
    escenario.zonas.find((z) => z.id === 'centro') ??
    escenario.zonas.find((z) => z.tipo === 'paso');
  const centro = zona ?? escenario.paseo;
  agregar('centro', 'Zona central', {
    x: (centro.x0 + centro.x1) / 2,
    y: zona?.y ?? desde.y,
    z: (centro.z0 + centro.z1) / 2,
  });
  const tarima = escenario.zonas.find((z) => z.id === 'escenario');
  if (tarima)
    agregar('escenario', 'Escenario', {
      x: (tarima.x0 + tarima.x1) / 2,
      y: tarima.y,
      z: (tarima.z0 + tarima.z1) / 2,
    });
  const asientos = accionesDe(escenario)
    .filter((a) => a.tipo === 'sentarse')
    .sort(
      (a, b) => Math.hypot(a.x - desde.x, a.z - desde.z) - Math.hypot(b.x - desde.x, b.z - desde.z),
    );
  const asiento = asientos[0];
  if (asiento) {
    const p = asiento.asiento.aproximacion ?? asiento;
    agregar('asientos', escenario.id === 'auditorio' ? 'Butacas' : 'Asientos', {
      x: p.x,
      y: p.y ?? 0,
      z: p.z + 1,
    });
  }
  const pantalla = colocada
    ? { ...colocada, zona: '', contenido: 'presentacion' }
    : (escenario.pantallas.find(
        (p) => p.contenido === 'tablero' || p.contenido === 'presentacion',
      ) ?? escenario.pantallas[0]);
  if (pantalla) {
    const y = colocada?.y ?? escenario.zonas.find((z) => z.id === pantalla.zona)?.y ?? 0;
    agregar('pantalla', pantalla.contenido === 'tablero' ? 'Pantalla y pizarra' : 'Pantalla', {
      x: pantalla.x + Math.sin(pantalla.giro) * 2.5,
      y,
      z: pantalla.z + Math.cos(pantalla.giro) * 2.5,
    });
  }
  return lugares;
}
