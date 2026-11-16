import { useEffect, useRef } from 'react';
import { sueloDe, alturaEn } from '@oficina/motor';
import { crearMapaDeSuelo, puntoLibre, lineaLibre } from '@oficina/motor';
import { useConexionD2 } from '../envivo/dinamica/conexion';
import { sesionReacciones } from '../envivo/dinamica/sesionReacciones';
import { D2 } from '../envivo/dinamica/modelo';
import {
  crearSaludos,
  miradaCercana,
  apartarseDePantalla,
  PRESENCIA_JULES as P,
} from './presencia';
import type { useJules } from './useJules';
/** Consume presencia y reacciones existentes; no envía paquetes ni altera la sala. */
export function usePresenciaJules(
  jules: ReturnType<typeof useJules>,
  decir: (texto: string) => void,
) {
  const { fuente, yo, dueno } = useConexionD2();
  const actual = useRef({ jules, decir });
  actual.current = { jules, decir };
  useEffect(() => {
    const saludos = crearSaludos();
    saludos(fuente?.personas() ?? [], Date.now());
    let mundo: typeof jules.control.current.escenario;
    let mapa: ReturnType<typeof crearMapaDeSuelo> | null = null;
    let ultimaCesion = -Infinity;
    const id = setInterval(() => {
      const { jules: j, decir } = actual.current;
      const c = j.control.current;
      if (!c.disponible || !c.escenario) return;
      const personas = fuente?.personas() ?? [];
      const saludo = saludos(personas, Date.now());
      if (saludo) decir(saludo);
      c.mirar = miradaCercana(c.posicion, [c.usuario, ...personas]);
      if (mundo !== c.escenario) {
        mundo = c.escenario;
        mapa = crearMapaDeSuelo(sueloDe(mundo));
      }
      if (
        j.estado !== 'espera aquí' ||
        c.marca ||
        Date.now() - ultimaCesion < P.descansoApartarseMs
      )
        return;
      const pantallas = c.pantalla
        ? [c.pantalla]
        : c.escenario.pantallas.map((p) => ({ x: p.x, y: c.usuario.y, z: p.z }));
      const destino = apartarseDePantalla(c.posicion, c.usuario, pantallas, (p) =>
        Boolean(
          mapa &&
          puntoLibre(mapa, p.x, p.z, 0.42, p.y) &&
          Math.abs(alturaEn(sueloDe(c.escenario!), p.x, p.z, p.y) - p.y) < 0.2 &&
          lineaLibre(mapa, c.posicion.x, c.posicion.z, p.x, p.z, 0.42, p.y),
        ),
      );
      if (destino) {
        ultimaCesion = Date.now();
        j.ejecutar('guiar', destino);
      }
    }, P.muestraMs);
    return () => {
      clearInterval(id);
      jules.control.current.mirar = null;
    };
  }, [fuente, jules.control]);
  useEffect(() => {
    if (!fuente || !yo || !dueno) return;
    const sesion = sesionReacciones(fuente, yo, dueno);
    let ultimo = 0;
    return sesion.suscribir(() => {
      const festejo = sesion.festejo();
      if (!festejo || festejo === ultimo) return;
      ultimo = festejo;
      actual.current.jules.control.current.aplaudirHasta = festejo + D2.festejoMs;
      actual.current.decir('¡Buen trabajo, equipo!');
    });
  }, [fuente, yo, dueno]);
}
