import {
  avanzarAvatar,
  crearAvatar,
  crearMando,
  fijarDestino,
  PARAMETROS_AVATAR,
  RADIO_AVATAR,
} from '../../animacion/avatar';
import { lineaLibre, puntoLibre } from '../../animacion/colision';
import { buscarRuta } from '../../animacion/navegacion';
import type { Navegacion } from '../../animacion/navegacion';
import { PARAMETROS_SEPARACION } from '../../animacion/separacion';
import type { Otros } from '../../animacion/separacion';
import { pendienteSuelo, topeVelocidadEscalera } from '../../animacion/pisada';
import { suavizarAnguloExp } from '../../animacion/resorte';
import { alturaEn, SIN_SUELO } from '../../escenarios/suelo';
import type { Punto3 } from '../../escenarios/tipos';

/** Ajustes exclusivos de compañía; no alteran las velocidades del usuario. */
export const PARAMETROS_ASISTENTE = {
  radio: RADIO_AVATAR,
  radioRuta: 0.42,
  celda: 0.25,
  capacidadOtros: 512,
  distancia: 1.8,
  distanciaMin: 1.1,
  distanciaFila: 1.2,
  capacidadRutaSitio: 64,
  desvioFilaMax: 2,
  distanciaMax: 5.5,
  distanciaRecuperacion: 18,
  correrDesde: 3.2,
  periodoRuta: 0.3,
  cambioDestino: 0.65,
  dtMax: 0.05,
  muestras: 12,
  toleranciaPiso: 1,
  tiempoAtasco: 5,
  duracionRecuperacion: 0.45,
  velocidadMin: 0.08,
  distanciaViaje: 0.3,
  mediaVidaGiro: 0.16,
  velocidadTransformacion: 0,
  forma: {
    distanciaOrbe: 7.5,
    distanciaPersona: 3.5,
    razonRutaOrbe: 3,
    razonRutaPersona: 1.8,
    distanciaRutaMin: 3,
    velocidadRegreso: 2.5,
    permanenciaMinima: 1.5,
  },
  separacion: {
    ...PARAMETROS_SEPARACION,
    radioAvatar: 0.55,
    radioOtro: 0.55,
    empujeMax: 6.2,
  },
  margenCono: 0.35,
  flotacion: 0.08,
  frecuenciaFlotacion: 1.3,
  locomocion: {
    ...PARAMETROS_AVATAR,
    radioLlegada: 0.12,
  },
  locomocionOrbe: { ...PARAMETROS_AVATAR, velMax: 3.4, velCorrer: 6.2, radioLlegada: 0.12 },
};

/** Estado físico compartido por persona y orbe; el navegador pertenece a esta instancia. */
export function crearSeguimiento(nav: Navegacion, inicio: Punto3, camara?: Punto3) {
  const punto = { ...inicio };
  if (nav.suelo) punto.y = alturaEn(nav.suelo, punto.x, punto.z, punto.y);
  if (!puntoLibre(nav.mapa, punto.x, punto.z, PARAMETROS_ASISTENTE.radio, punto.y)) {
    const ruta = new Float64Array(2);
    if (buscarRuta(nav, punto.x, punto.z, punto.x, punto.z, ruta, 1, punto.y, punto.y)) {
      punto.x = ruta[0]!;
      punto.z = ruta[1]!;
      if (nav.suelo) punto.y = alturaEn(nav.suelo, punto.x, punto.z, inicio.y);
    }
  }
  const e = {
    nav,
    avatar: crearAvatar(punto.x, punto.z, 0, punto.y),
    mando: crearMando(),
    origen: { ...punto },
    destino: { ...punto },
    candidato: { ...punto },
    espera: 0,
    atasco: 0,
    recuperacion: 'normal' as 'normal' | 'saliendo' | 'entrando',
    visibilidad: 1,
    usuarioAnterior: { ...punto },
    usuarioIniciado: false,
    velocidadUsuario: 0,
    sinRuta: false,
    sinSitio: false,
    razonRuta: 1,
    rutaSitio: new Float64Array(PARAMETROS_ASISTENTE.capacidadRutaSitio * 2),
  };
  if (camara && elegirSitio(e, punto, camara)) {
    e.avatar = crearAvatar(e.candidato.x, e.candidato.z, 0, e.candidato.y);
    Object.assign(e.destino, e.candidato);
  }
  return e;
}
export type Seguimiento = ReturnType<typeof crearSeguimiento>;
type UsuarioAcompanado = Punto3 & { estado?: 'de-pie' | 'sentado' };

/** Elige un sitio lateral visible en la planta del usuario, sin ocupar un sólido ni el cono de cámara. */
function elegirSitio(
  e: Seguimiento,
  usuario: UsuarioAcompanado,
  camara: Punto3,
  otros?: Otros,
): boolean {
  const p = PARAMETROS_ASISTENTE;
  const angulo = Math.atan2(usuario.x - camara.x, usuario.z - camara.z) - Math.PI / 2;
  for (let k = 0; k < p.muestras * 2; k++) {
    // Sin costado libre, hace fila del lado del que viene: nunca intenta adelantar en el vano.
    const fila = k >= p.muestras;
    const i = k % p.muestras;
    const base = fila ? Math.atan2(e.avatar.x - usuario.x, e.avatar.z - usuario.z) : angulo;
    const radio = fila ? p.distanciaFila : p.distancia;
    const a = base + ((i % 2 ? -1 : 1) * Math.ceil(i / 2) * Math.PI * 2) / p.muestras;
    const x = usuario.x + Math.sin(a) * radio;
    const z = usuario.z + Math.cos(a) * radio;
    if (
      fila &&
      (x - usuario.x) * (e.avatar.x - usuario.x) + (z - usuario.z) * (e.avatar.z - usuario.z) < 0
    )
      continue;
    const haciaCamara =
      (x - usuario.x) * (camara.x - usuario.x) + (z - usuario.z) * (camara.z - usuario.z);
    if (
      !fila &&
      haciaCamara >
        p.margenCono * p.distancia * Math.hypot(camara.x - usuario.x, camara.z - usuario.z)
    )
      continue;
    const suelo = e.nav.suelo;
    const y = suelo ? alturaEn(suelo, x, z, usuario.y) : usuario.y;
    if (y === SIN_SUELO || Math.abs(y - usuario.y) > p.toleranciaPiso) continue;
    if (!puntoLibre(e.nav.mapa, x, z, p.radio, y)) continue;
    if (!lineaLibre(e.nav.mapa, x, z, x, z, p.radio, y)) continue;
    if (usuario.estado === 'sentado') {
      // El asiento es un sólido: no se exige una línea que nazca dentro de la silla.
      // El controlador verifica después la ruta desde Jules hasta este punto libre.
    } else if (fila) {
      // La línea a una sola altura confunde los peldaños con sólidos: se comprueba la ruta 3D.
      const n = buscarRuta(
        e.nav,
        usuario.x,
        usuario.z,
        x,
        z,
        e.rutaSitio,
        p.capacidadRutaSitio,
        usuario.y,
        y,
      );
      let largo = 0,
        px = usuario.x,
        pz = usuario.z;
      for (let j = 0; j < n; j++) {
        const nx = e.rutaSitio[j * 2]!,
          nz = e.rutaSitio[j * 2 + 1]!;
        largo += Math.hypot(nx - px, nz - pz);
        px = nx;
        pz = nz;
      }
      if (!n || largo > radio * p.desvioFilaMax) continue;
    } else if (!lineaLibre(e.nav.mapa, usuario.x, usuario.z, x, z, p.radio, y)) continue;
    let ocupado = false;
    if (otros)
      for (let j = 0; j < otros.n; j++) {
        if (Math.hypot(x - (otros.x[j] as number), z - (otros.z[j] as number)) < p.distanciaMin)
          ocupado = true;
      }
    if (ocupado) continue;
    e.candidato.x = x;
    e.candidato.y = y;
    e.candidato.z = z;
    return true;
  }
  return false;
}

/** Solicita rutas al mismo controlador del avatar, con inercia, colisión y escaleras existentes. */
export function avanzarSeguimiento(
  e: Seguimiento,
  usuario: UsuarioAcompanado,
  camara: Punto3,
  delta: number,
  otros?: Otros,
  mover = true,
  acompanar = true,
  orbe = false,
): void {
  const p = PARAMETROS_ASISTENTE;
  const dt = Math.min(p.dtMax, Math.max(0, delta));
  if (!dt) return;
  const a = e.avatar;
  e.velocidadUsuario = e.usuarioIniciado
    ? Math.hypot(usuario.x - e.usuarioAnterior.x, usuario.z - e.usuarioAnterior.z) / dt
    : 0;
  Object.assign(e.usuarioAnterior, usuario);
  e.usuarioIniciado = true;
  const distancia = Math.hypot(a.x - usuario.x, a.z - usuario.z, a.y - usuario.y);
  e.espera -= dt;
  if (e.recuperacion !== 'normal') {
    const signo = e.recuperacion === 'saliendo' ? -1 : 1;
    e.visibilidad = Math.max(0, Math.min(1, e.visibilidad + (signo * dt) / p.duracionRecuperacion));
    if (e.visibilidad === 0 && elegirSitio(e, usuario, camara, otros)) {
      // Solo se recoloca totalmente contraída: nunca hay un trayecto visible atravesando la sala.
      e.avatar = crearAvatar(e.candidato.x, e.candidato.z, a.rumbo, e.candidato.y);
      e.mando = crearMando();
      Object.assign(e.destino, e.candidato);
      e.recuperacion = 'entrando';
      e.atasco = 0;
      e.espera = 0;
    } else if (e.visibilidad === 1) e.recuperacion = 'normal';
    return;
  }
  if (e.espera <= 0) {
    e.espera = p.periodoRuta;
    const sitio = acompanar
      ? elegirSitio(e, usuario, camara, otros)
      : puntoLibre(e.nav.mapa, usuario.x, usuario.z, p.radio, usuario.y);
    e.sinSitio = !sitio;
    if (!acompanar) Object.assign(e.candidato, usuario);
    if (sitio) {
      const c = e.candidato;
      if (
        Math.hypot(c.x - e.destino.x, c.z - e.destino.z) > p.cambioDestino ||
        Math.abs(c.y - e.destino.y) > p.toleranciaPiso
      ) {
        Object.assign(e.destino, c);
        fijarDestino(e.mando, c.x, c.z, distancia > p.distanciaMax, c.y);
      }
    }
  }
  // En un rellano ocupado no puede adelantar: espera en su peldaño, sin marchar contra el usuario.
  if (
    acompanar &&
    e.velocidadUsuario < p.velocidadMin &&
    distancia < p.distancia &&
    Math.abs(a.y - usuario.y) > p.radio
  ) {
    if (e.mando.destino) {
      e.mando.destino = null;
      e.mando.idDestino++;
    }
    Object.assign(e.destino, { x: a.x, y: a.y, z: a.z });
    e.sinSitio = false;
  }
  e.mando.correr = e.velocidadUsuario > p.forma.velocidadRegreso || distancia > p.correrDesde;
  a.rutaCorriendo = e.mando.correr;
  a.loc.topeVelocidad = !mover
    ? p.velocidadTransformacion
    : e.nav.suelo
      ? topeVelocidadEscalera(
          pendienteSuelo(e.nav.suelo, a.x, a.z, a.rumbo, a.ySuelo),
          e.mando.correr,
        )
      : Infinity;
  const x = a.x,
    z = a.z,
    y = a.y;
  avanzarAvatar(
    a,
    e.mando,
    0,
    e.nav.mapa,
    e.nav,
    orbe ? p.locomocionOrbe : p.locomocion,
    dt,
    otros,
    p.separacion,
  );
  // El avatar elige carrera automática en rutas largas: aquí manda el paso del acompañado.
  a.rutaCorriendo = e.mando.correr;
  // La resolución por deslizamiento puede cortar la esquina entre dos extremos libres.
  // Conservamos también el segmento barrido: frenar y replantear antes de atravesarlo.
  if (!lineaLibre(e.nav.mapa, x, z, a.x, a.z, p.radio, y)) {
    a.x = a.loc.x = x;
    a.z = a.loc.z = z;
    a.y = a.yCuerpo = a.ySuelo = y;
    a.velocidad = a.loc.velocidad = 0;
    e.mando.idDestino++;
  }
  const pendiente = Math.hypot(a.x - e.destino.x, a.z - e.destino.z) > p.distanciaViaje;
  e.sinRuta = e.sinSitio || (pendiente && a.nRuta === 0);
  let largo = 0,
    px = a.x,
    pz = a.z;
  for (let i = a.iRuta; i < a.nRuta; i++) {
    const nx = a.ruta[i * 2]!,
      nz = a.ruta[i * 2 + 1]!;
    largo += Math.hypot(nx - px, nz - pz);
    px = nx;
    pz = nz;
  }
  const directa = Math.hypot(a.x - e.destino.x, a.z - e.destino.z);
  e.razonRuta = directa > p.forma.distanciaRutaMin ? largo / directa : 1;
  if (a.velocidad < p.velocidadMin && acompanar) {
    a.rumbo = a.loc.rumbo = suavizarAnguloExp(
      a.rumbo,
      Math.atan2(usuario.x - a.x, usuario.z - a.z),
      p.mediaVidaGiro,
      dt,
    );
  }
  if (
    Math.hypot(a.x - x, a.z - z) < p.velocidadMin * dt &&
    (distancia > p.distanciaMax || pendiente)
  )
    e.atasco += dt;
  else e.atasco = 0;
  if (distancia > p.distanciaRecuperacion || e.atasco > p.tiempoAtasco) e.recuperacion = 'saliendo';
}
