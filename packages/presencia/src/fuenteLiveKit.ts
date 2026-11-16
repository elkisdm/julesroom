import { leerPerfil as perfilDeMetadatos, type PerfilWire as MetadatosWire } from './perfil';
import { Room, RoomEvent, Track } from 'livekit-client';
import type { RemoteAudioTrack, RemoteParticipant, RemoteTrackPublication } from 'livekit-client';
import type { Atuendo, FuentePresencia, PersonaPresente } from '@oficina/motor';
import { codificar, decodificar, esMasNuevo, LARGO_PAQUETE } from './codec';
import type { PaquetePosicion } from './codec';
import { planDegradacion } from './degradacion';
import type { Degradacion } from './degradacion';
import { crearEmisor, crearGuardiaVisibilidad, PARAMETROS_EMISOR } from './emisor';
import type { ParametrosEmisor } from './emisor';
import { PARAMETROS_INTERES, planEnvioInteres } from './interes';
import type { ParametrosInteres } from './interes';
import { PARAMETROS_VOZ, distancia3, planVoz } from './voz';
import type { ParametrosVoz } from './voz';

/** Tema del canal de datos sin garantía por el que viajan las posiciones. */
export const TEMA_POSICION = 'pos';

/** Valores iniciales parametrizables del transporte (ADR-0006). */
export const PARAMETROS_FUENTE = {
  /** Minutos con la pestaña oculta antes de desconectar. */
  desconexionMin: 5,
  /** Máximo de personas por sala; quien llega con la sala llena se desconecta. */
  topeSala: 25,
  /** Cada cuánto (ms) se reconcilia la voz (suscripciones y volumen). */
  vozCadaMs: 250,
  /** Espera de reconexión: inicial y tope (ms), se duplica en cada intento. */
  reconexionInicialMs: 1000,
  reconexionMaxMs: 15_000,
};
export type ParametrosFuente = typeof PARAMETROS_FUENTE;

/** Lo que no cambia seguido: viaja en los metadatos del participante (canal fiable). */
interface Perfil {
  nombre: string;
  atuendo: Atuendo;
  escenario: string;
  asiento: string | null;
}

export type EstadoConexion =
  'desconectado' | 'conectando' | 'conectado' | 'reconectando' | 'suspendido';

export interface OpcionesFuenteLiveKit {
  /** URL del servidor de LiveKit (`ws://…` / `wss://…`); como función, se evalúa después de obtener el token. */
  url: string | (() => string);
  /** Configuración ICE opcional; en loopback se usa iceServers vacío para no salir a STUN externo. */
  rtcConfig?: RTCConfiguration;
  /** Pide un token de acceso nuevo (se llama al conectar y en cada reconexión). */
  obtenerToken: () => Promise<string>;
  /** Identidad propia: el mismo id que el avatar propio. */
  yo: { id: string; nombre: string; atuendo: Atuendo; escenario: string };
  parametros?: {
    fuente?: Partial<ParametrosFuente>;
    emisor?: Partial<ParametrosEmisor>;
    voz?: Partial<ParametrosVoz>;
    interes?: Partial<ParametrosInteres>;
  };
  /** Sala cerrada en que está un punto (quien comparte sala se oye siempre); sin él, solo cuenta el radio. */
  salaDe?: (p: { x: number; y: number; z: number }) => string | null;
  /** Emula una red degradada sobre las posiciones recibidas (pérdida, retardo y jitter); solo para medir. */
  degradacion?: Degradacion;
  /** Registra envíos y llegadas por número de secuencia para medir el retraso extremo a extremo. */
  medicion?: boolean;
  /** Reloj (ms); por defecto `Date.now`. Se inyecta en pruebas. */
  ahora?: () => number;
}

/** Estado propio que el avatar entrega cada cuadro. */
export interface EstadoPropio {
  x: number;
  y: number;
  z: number;
  rumbo: number;
  saltos: number;
  estado: 'de-pie' | 'sentado';
  asiento: string | null;
}

/** Una persona cercana tal como la muestra la interfaz. */
export interface Cercano {
  id: string;
  nombre: string;
  distancia: number;
  /** Se le está oyendo (suscrito a su audio). */
  oyendo: boolean;
  silenciado: boolean;
  habla: boolean;
}

/** Foto inmutable del estado de la conexión y la voz para la interfaz (cambia de identidad al cambiar algo). */
export interface InstantaneaPresencia {
  conexion: EstadoConexion;
  error: string | null;
  microfono: boolean;
  /** El micrófono propio está activo pero silenciado por la persona. */
  silenciadoPropio: boolean;
  personas: number;
  cercanos: readonly Cercano[];
}

export interface MetricasFuente {
  paquetesEnviados: number;
  paquetesRecibidos: number;
  /** Paquetes descartados por llegar fuera de orden o repetidos. */
  paquetesViejos: number;
  paquetesInvalidos: number;
  /** Descartados por la degradación emulada. */
  paquetesDescartados: number;
  erroresEnvio: number;
  bytesPosicionEnviados: number;
  bytesPosicionRecibidos: number;
  /** Con `medicion`: envíos y llegadas con su hora, para cruzarlos por (emisor, seq). */
  envios: Array<{ seq: number; t: number }>;
  llegadas: Array<{ id: string; seq: number; t: number }>;
}

export interface FuenteLiveKit extends FuentePresencia {
  readonly hablandoIds: Set<string>;
  /** Canal fiable para aplicaciones; la aplicación valida su propio protocolo. */
  enviarDatos(texto: string): Promise<void>;
  suscribirDatos(recibir: (texto: string, identidad: string) => void): () => void;
  /** Nivel RMS normalizado que entrega LiveKit, sin otra captura de micrófono. */
  nivelPropio(): number;
  conectar(): Promise<void>;
  desconectar(): Promise<void>;
  /** Llamar en cada cuadro con el estado del avatar propio: decide si toca enviar. */
  publicarPropio(estado: EstadoPropio): void;
  /** Cambia nombre, atuendo o escenario propios (metadatos). */
  cambiarPerfil(cambios: Partial<Omit<Perfil, 'asiento'>>): void;
  /** Pide permiso del micrófono y lo activa. DEBE llamarse desde un gesto del usuario (clic). */
  activarMicrofono(): Promise<void>;
  apagarMicrofono(): Promise<void>;
  /** Silencia o reactiva el micrófono propio sin soltar el permiso. */
  silenciarPropio(silenciar: boolean): Promise<void>;
  /** Deja de oír a una persona (local: no cambia lo que oyen los demás). */
  silenciar(id: string, silenciar: boolean): void;
  instantanea(): InstantaneaPresencia;
  suscribirInstantanea(alCambiar: () => void): () => void;
  metricas(): MetricasFuente;
}

interface Remoto {
  persona: PersonaPresente;
  ultimaSeq: number;
  sentado: boolean;
}

/**
 * `FuentePresencia` sobre LiveKit: posiciones por canal de datos sin garantía (formato binario de 19
 * bytes), perfil por metadatos, voz por cercanía con suscripción selectiva (ADR-0006).
 * El motor interpola; aquí solo se escribe en sitio al llegar cada paquete.
 */
export function crearFuenteLiveKit(opciones: OpcionesFuenteLiveKit): FuenteLiveKit {
  const parametros = { ...PARAMETROS_FUENTE, ...opciones.parametros?.fuente };
  const parametrosVoz = { ...PARAMETROS_VOZ, ...opciones.parametros?.voz };
  const parametrosInteres = { ...PARAMETROS_INTERES, ...opciones.parametros?.interes };
  const ahora = opciones.ahora ?? Date.now;

  const perfil: Perfil = {
    nombre: opciones.yo.nombre,
    atuendo: opciones.yo.atuendo,
    escenario: opciones.yo.escenario,
    asiento: null,
  };
  const emisor = crearEmisor({ ...PARAMETROS_EMISOR, ...opciones.parametros?.emisor });
  const guardia = crearGuardiaVisibilidad({ desconexionMs: parametros.desconexionMin * 60_000 });

  const remotos = new Map<string, Remoto>();
  const lista: PersonaPresente[] = [];
  const oyentes = new Set<() => void>();
  const oyentesInstantanea = new Set<() => void>();
  const hablandoIds = new Set<string>();
  const datos = new Set<(texto: string, identidad: string) => void>();
  const silenciados = new Set<string>();
  const oyendo = new Set<string>();
  const elementosAudio = new Map<string, HTMLMediaElement>();
  /** Última suscripción pedida por identidad, para no repetir llamadas al servidor. */
  const pedido = new Map<string, boolean>();
  const ultimoEnvioInteres = new Map<string, number>();

  const metricas: MetricasFuente = {
    paquetesEnviados: 0,
    paquetesRecibidos: 0,
    paquetesViejos: 0,
    paquetesInvalidos: 0,
    paquetesDescartados: 0,
    erroresEnvio: 0,
    bytesPosicionEnviados: 0,
    bytesPosicionRecibidos: 0,
    envios: [],
    llegadas: [],
  };

  let room: Room | null = null;
  let conexion: EstadoConexion = 'desconectado';
  let error: string | null = null;
  let microfono = false;
  let silenciadoPropio = false;
  let seq = 0;
  let cercanos: readonly Cercano[] = [];
  let foto: InstantaneaPresencia = crearFoto();
  let intervaloVoz: ReturnType<typeof setInterval> | null = null;
  let intervaloGuardia: ReturnType<typeof setInterval> | null = null;
  let reconectarTimer: ReturnType<typeof setTimeout> | null = null;
  let intentos = 0;
  let cerrando = false;
  /** La guardia de visibilidad pidió pausar los envíos (pestaña oculta). */
  let pausado = false;
  let ultimoPropio: EstadoPropio | null = null;
  const buffer = new Uint8Array(LARGO_PAQUETE);

  function crearFoto(): InstantaneaPresencia {
    return { conexion, error, microfono, silenciadoPropio, personas: lista.length, cercanos };
  }
  const avisarInstantanea = () => {
    foto = crearFoto();
    oyentesInstantanea.forEach((f) => f());
  };
  const avisarLista = () => {
    oyentes.forEach((f) => f());
    avisarInstantanea();
  };
  const fijarConexion = (nueva: EstadoConexion, mensaje: string | null = null) => {
    conexion = nueva;
    error = mensaje;
    avisarInstantanea();
  };

  const metadatosPropios = (): string =>
    JSON.stringify({
      n: perfil.nombre,
      a: perfil.atuendo,
      e: perfil.escenario,
      s: perfil.asiento,
    } satisfies MetadatosWire);
  const publicarMetadatos = () => {
    if (room?.state !== 'connected') return;
    room.localParticipant.setMetadata(metadatosPropios()).catch((e: unknown) => {
      metricas.erroresEnvio++;
      console.warn('[presencia] no se pudo publicar el perfil', e);
    });
  };

  // ── Personas ────────────────────────────────────────────────────────────────

  function retirar(id: string) {
    const r = remotos.get(id);
    if (!r) return;
    remotos.delete(id);
    const i = lista.indexOf(r.persona);
    if (i >= 0) lista.splice(i, 1);
    hablandoIds.delete(id);
    oyendo.delete(id);
    pedido.delete(id);
    ultimoEnvioInteres.delete(id);
  }

  /** Aplica el perfil de un participante a su persona; devuelve si cambió algo visible (nombre/atuendo). */
  function aplicarPerfil(r: Remoto, m: MetadatosWire): boolean {
    const cambio =
      r.persona.nombre !== m.n || JSON.stringify(r.persona.atuendo) !== JSON.stringify(m.a);
    r.persona.nombre = m.n;
    r.persona.atuendo = m.a;
    r.persona.asiento = m.s ?? undefined;
    return cambio;
  }

  function alPosicion(p: PaquetePosicion, participante: RemoteParticipant) {
    const id = participante.identity;
    let r = remotos.get(id);
    if (!r) {
      const m = perfilDeMetadatos(participante.metadata);
      if (!m || m.e !== perfil.escenario) return; // sin perfil válido, o en otro escenario: no se dibuja
      const persona: PersonaPresente = {
        id,
        nombre: m.n,
        atuendo: m.a,
        x: p.x,
        y: p.y,
        z: p.z,
        rumbo: p.rumbo,
        saltos: p.saltos,
        estado: p.sentado ? 'sentado' : 'de-pie',
        asiento: m.s ?? undefined,
      };
      r = { persona, ultimaSeq: p.seq, sentado: p.sentado };
      remotos.set(id, r);
      lista.push(persona);
      avisarLista();
      return;
    }
    if (!esMasNuevo(p.seq, r.ultimaSeq)) {
      metricas.paquetesViejos++;
      return;
    }
    r.ultimaSeq = p.seq;
    const q = r.persona;
    q.x = p.x;
    q.y = p.y;
    q.z = p.z;
    q.rumbo = p.rumbo;
    q.saltos = p.saltos;
    q.estado = p.sentado ? 'sentado' : 'de-pie';
    if (!p.sentado) q.asiento = undefined;
    else if (!q.asiento) q.asiento = perfilDeMetadatos(participante.metadata)?.s ?? undefined;
    r.sentado = p.sentado;
  }

  function alMetadatos(participante: RemoteParticipant) {
    const r = remotos.get(participante.identity);
    const m = perfilDeMetadatos(participante.metadata);
    if (!r || !m) return;
    if (m.e !== perfil.escenario) {
      retirar(participante.identity);
      avisarLista();
      return;
    }
    if (aplicarPerfil(r, m)) avisarLista();
  }

  // ── Voz ─────────────────────────────────────────────────────────────────────

  function publicacionAudio(p: RemoteParticipant): RemoteTrackPublication | undefined {
    for (const pub of p.trackPublications.values()) {
      if (pub.kind === Track.Kind.Audio) return pub;
    }
    return undefined;
  }

  function conciliarVoz() {
    if (!room || room.state !== 'connected' || !ultimoPropio) return;
    const yo = { ...ultimoPropio, sala: opciones.salaDe?.(ultimoPropio) ?? null };
    const otros = lista.map((q) => ({
      id: q.id,
      x: q.x,
      y: q.y,
      z: q.z,
      sala: opciones.salaDe?.(q) ?? null,
    }));
    const plan = planVoz(yo, otros, oyendo, parametrosVoz);

    const nuevosCercanos: Cercano[] = [];
    for (const [id, remoto] of room.remoteParticipants) {
      const q = remotos.get(id)?.persona;
      if (!q) continue;
      const pub = publicacionAudio(remoto);
      const debeOirse = !!pub && plan.suscritos.has(id) && !silenciados.has(id);
      if (pub && pedido.get(id) !== debeOirse) {
        pedido.set(id, debeOirse);
        pub.setSubscribed(debeOirse);
      }
      if (debeOirse) oyendo.add(id);
      else oyendo.delete(id);
      const pista = pub?.audioTrack as RemoteAudioTrack | undefined;
      if (pista && debeOirse) pista.setVolume(plan.volumen.get(id) ?? 0);
      const d = distancia3(yo, q);
      if (d <= parametrosVoz.radio * parametrosVoz.factorSalida * 2 || silenciados.has(id)) {
        nuevosCercanos.push({
          id,
          nombre: q.nombre,
          distancia: d,
          oyendo: debeOirse,
          silenciado: silenciados.has(id),
          habla: hablandoIds.has(id),
        });
      }
    }
    nuevosCercanos.sort((a, b) => a.distancia - b.distancia);
    const igual =
      nuevosCercanos.length === cercanos.length &&
      nuevosCercanos.every((c, i) => {
        const v = cercanos[i];
        return (
          v &&
          v.id === c.id &&
          v.oyendo === c.oyendo &&
          v.silenciado === c.silenciado &&
          v.habla === c.habla &&
          Math.round(v.distancia * 2) === Math.round(c.distancia * 2)
        );
      });
    if (!igual) {
      cercanos = nuevosCercanos;
      avisarInstantanea();
    }
  }

  function alHablar(hablantes: ReadonlyArray<{ identity: string; isLocal: boolean }>) {
    const nuevos = new Set<string>();
    for (const h of hablantes) {
      if (h.isLocal) nuevos.add(opciones.yo.id);
      // El servidor detecta a todos los que hablan; solo se marca a quien además se está oyendo.
      else if (oyendo.has(h.identity)) nuevos.add(h.identity);
    }
    hablandoIds.clear();
    nuevos.forEach((id) => hablandoIds.add(id));
    avisarInstantanea();
  }

  // ── Conexión ────────────────────────────────────────────────────────────────

  function armarSala(): Room {
    const sala = new Room({
      adaptiveStream: false,
      dynacast: true,
      audioCaptureDefaults: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    sala
      .on(RoomEvent.DataReceived, (carga, participante, _tipo, tema) => {
        if (!participante) return;
        if (tema === 'sala' && carga.byteLength <= 15000) {
          const texto = new TextDecoder().decode(carga);
          datos.forEach((f) => f(texto, participante.identity));
          return;
        }
        if (tema !== TEMA_POSICION) return;
        const p = decodificar(carga);
        if (!p) {
          metricas.paquetesInvalidos++;
          return;
        }
        const entregar = () => {
          metricas.paquetesRecibidos++;
          metricas.bytesPosicionRecibidos += carga.byteLength;
          if (opciones.medicion) {
            if (metricas.llegadas.length > 20_000) metricas.llegadas.splice(0, 10_000);
            metricas.llegadas.push({ id: participante.identity, seq: p.seq, t: ahora() });
          }
          alPosicion(p, participante as RemoteParticipant);
        };
        if (!opciones.degradacion) return entregar();
        const plan = planDegradacion(Math.random, opciones.degradacion);
        if (plan.descartar) metricas.paquetesDescartados++;
        else setTimeout(entregar, plan.esperaMs);
      })
      .on(RoomEvent.ParticipantDisconnected, (p) => {
        retirar(p.identity);
        avisarLista();
      })
      .on(RoomEvent.ParticipantMetadataChanged, (_meta, p) => {
        if (p && !p.isLocal) alMetadatos(p as RemoteParticipant);
      })
      .on(RoomEvent.TrackSubscribed, (pista, _pub, p) => {
        if (pista.kind !== Track.Kind.Audio) return;
        const el = pista.attach();
        el.dataset.presenciaAudio = p.identity;
        el.style.display = 'none';
        elementosAudio.get(p.identity)?.remove();
        elementosAudio.set(p.identity, el);
        document.body.appendChild(el);
      })
      .on(RoomEvent.TrackUnsubscribed, (pista, _pub, p) => {
        if (pista.kind !== Track.Kind.Audio) return;
        pista.detach().forEach((el) => el.remove());
        elementosAudio.get(p.identity)?.remove();
        elementosAudio.delete(p.identity);
      })
      .on(RoomEvent.ActiveSpeakersChanged, (hablantes) => alHablar(hablantes))
      .on(RoomEvent.AudioPlaybackStatusChanged, () => {
        if (!sala.canPlaybackAudio) sala.startAudio().catch(() => undefined); // Sin gesto aún: se reintenta en el próximo clic.
      })
      .on(RoomEvent.Reconnecting, () => fijarConexion('reconectando'))
      .on(RoomEvent.Reconnected, () => {
        pedido.clear();
        publicarMetadatos();
        fijarConexion('conectado');
      })
      .on(RoomEvent.Disconnected, () => {
        if (cerrando || sala !== room) return;
        limpiarRemotos();
        if (conexion !== 'suspendido') {
          fijarConexion('desconectado', 'Se perdió la conexión; reintentando…');
          programarReconexion();
        }
      });
    return sala;
  }

  function limpiarRemotos() {
    elementosAudio.forEach((el) => el.remove());
    elementosAudio.clear();
    for (const id of [...remotos.keys()]) retirar(id);
    hablandoIds.clear();
    cercanos = [];
    avisarLista();
  }

  function programarReconexion() {
    if (reconectarTimer || cerrando) return;
    const espera = Math.min(
      parametros.reconexionMaxMs,
      parametros.reconexionInicialMs * 2 ** intentos,
    );
    intentos++;
    reconectarTimer = setTimeout(() => {
      reconectarTimer = null;
      conectar().catch(() => undefined); // El fallo ya quedó en `error` y programó otro intento.
    }, espera);
  }

  async function conectar(): Promise<void> {
    if (conexion === 'conectando' || conexion === 'conectado') return;
    cerrando = false;
    fijarConexion('conectando');
    try {
      const token = await opciones.obtenerToken();
      const nueva = armarSala();
      room = nueva;
      await nueva.connect(
        typeof opciones.url === 'function' ? opciones.url() : opciones.url,
        token,
        { autoSubscribe: false, rtcConfig: opciones.rtcConfig },
      );
      if (nueva.remoteParticipants.size + 1 > parametros.topeSala) {
        cerrando = true;
        await nueva.disconnect();
        room = null;
        fijarConexion('desconectado', `La sala está llena (tope ${parametros.topeSala}).`);
        return;
      }
      intentos = 0;
      await nueva.localParticipant.setMetadata(metadatosPropios());
      emisor.reiniciar();
      // Quienes ya estaban: aparecen cuando llegue su primer paquete (con su perfil ya en los metadatos).
      fijarConexion('conectado');
    } catch (e) {
      room = null;
      fijarConexion('desconectado', e instanceof Error ? e.message : String(e));
      programarReconexion();
      throw e;
    }
  }

  async function desconectar(): Promise<void> {
    cerrando = true;
    if (reconectarTimer) clearTimeout(reconectarTimer);
    reconectarTimer = null;
    const actual = room;
    room = null;
    microfono = false;
    await actual?.disconnect();
    limpiarRemotos();
    fijarConexion('desconectado');
  }

  // ── Pestaña oculta ──────────────────────────────────────────────────────────

  const alVisibilidad = () => {
    guardia.cambiarVisibilidad(!document.hidden, ahora());
    // Se pausa en el acto; el reanudar y el desconectar los decide el intervalo de la guardia.
    if (document.hidden) pausado = true;
  };
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', alVisibilidad);
  intervaloGuardia = setInterval(() => {
    const accion = guardia.revisar(ahora());
    pausado = accion === 'pausar' || accion === 'desconectar';
    if (accion === 'desconectar' && room) {
      fijarConexion('suspendido');
      const actual = room;
      room = null;
      actual.disconnect().catch((e: unknown) => console.warn('[presencia] error al suspender', e));
      limpiarRemotos();
    } else if (accion === 'reconectar' && conexion === 'suspendido') {
      conexion = 'desconectado';
      conectar().catch(() => undefined); // Si falla, `conectar` ya programó el reintento y dejó el error.
    }
  }, 1000);
  intervaloVoz = setInterval(conciliarVoz, parametros.vozCadaMs);

  return {
    hablandoIds,
    async enviarDatos(texto) {
      const carga = new TextEncoder().encode(texto);
      if (carga.byteLength > 15000) throw new Error('El mensaje de sala excede el canal fiable.');
      if (room?.state !== 'connected') return;
      await room.localParticipant.publishData(carga, { reliable: true, topic: 'sala' });
    },
    suscribirDatos(recibir) {
      datos.add(recibir);
      return () => void datos.delete(recibir);
    },
    nivelPropio: () =>
      microfono && !silenciadoPropio ? (room?.localParticipant.audioLevel ?? 0) : 0,
    personas: () => lista,
    suscribir(alCambiar) {
      oyentes.add(alCambiar);
      return () => void oyentes.delete(alCambiar);
    },
    conectar,
    async desconectar() {
      if (intervaloVoz) clearInterval(intervaloVoz);
      if (intervaloGuardia) clearInterval(intervaloGuardia);
      intervaloVoz = intervaloGuardia = null;
      if (typeof document !== 'undefined')
        document.removeEventListener('visibilitychange', alVisibilidad);
      await desconectar();
    },
    publicarPropio(estado) {
      ultimoPropio = estado;
      if (room?.state !== 'connected') return;
      const sentado = estado.estado === 'sentado';
      if (perfil.asiento !== (estado.asiento ?? null)) {
        perfil.asiento = estado.asiento ?? null;
        publicarMetadatos();
      }
      const t = ahora();
      if (pausado) return;
      if (
        !emisor.debeEnviar(t, {
          x: estado.x,
          y: estado.y,
          z: estado.z,
          rumbo: estado.rumbo,
          saltos: estado.saltos,
          sentado,
        })
      ) {
        return;
      }
      const plan = planEnvioInteres(
        { x: estado.x, z: estado.z },
        lista,
        t,
        ultimoEnvioInteres,
        parametrosInteres,
      );
      if (!plan.aTodos && plan.identidades.length === 0) return;
      seq = (seq + 1) & 0xffff;
      const bytes = codificar(
        {
          seq,
          x: estado.x,
          y: estado.y,
          z: estado.z,
          rumbo: estado.rumbo,
          saltos: estado.saltos,
          sentado,
        },
        buffer,
      );
      // La copia es necesaria: el envío es asíncrono y `buffer` se reutiliza en el próximo cuadro.
      const carga = bytes.slice();
      metricas.paquetesEnviados++;
      metricas.bytesPosicionEnviados += carga.byteLength;
      if (opciones.medicion) {
        if (metricas.envios.length > 20_000) metricas.envios.splice(0, 10_000);
        metricas.envios.push({ seq, t });
      }
      room.localParticipant
        .publishData(carga, {
          reliable: false,
          topic: TEMA_POSICION,
          ...(plan.aTodos ? {} : { destinationIdentities: plan.identidades }),
        })
        .catch(() => {
          // Canal sin garantía: perder un paquete es normal (canal aún abriéndose o reconectando); solo se cuenta.
          metricas.erroresEnvio++;
        });
    },
    cambiarPerfil(cambios) {
      if (cambios.nombre !== undefined) perfil.nombre = cambios.nombre;
      if (cambios.atuendo !== undefined) perfil.atuendo = cambios.atuendo;
      if (cambios.escenario !== undefined) perfil.escenario = cambios.escenario;
      publicarMetadatos();
    },
    async activarMicrofono() {
      if (!room || room.state !== 'connected') throw new Error('Primero hay que entrar a la sala.');
      await room.localParticipant.setMicrophoneEnabled(true);
      microfono = true;
      silenciadoPropio = false;
      avisarInstantanea();
    },
    async apagarMicrofono() {
      await room?.localParticipant.setMicrophoneEnabled(false);
      microfono = false;
      silenciadoPropio = false;
      avisarInstantanea();
    },
    async silenciarPropio(silenciar) {
      if (!room || !microfono) return;
      await room.localParticipant.setMicrophoneEnabled(!silenciar);
      silenciadoPropio = silenciar;
      avisarInstantanea();
    },
    silenciar(id, silenciar) {
      if (silenciar) silenciados.add(id);
      else silenciados.delete(id);
      pedido.delete(id);
      conciliarVoz();
    },
    instantanea: () => foto,
    suscribirInstantanea(alCambiar) {
      oyentesInstantanea.add(alCambiar);
      return () => void oyentesInstantanea.delete(alCambiar);
    },
    metricas: () => metricas,
  };
}
