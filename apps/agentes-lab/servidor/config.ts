/** Valores iniciales parametrizables del servidor local. Nada viene de variables de entorno. */
export interface ConfigServidor {
  /** Tope del cuerpo de una petición, en bytes. */
  maxCuerpoBytes: number;
  maxMensajesPorMinutoConversacion: number;
  maxMensajesPorMinutoOrigen: number;
  maxMensajesPorMinutoPersona: number;
  /** Conversaciones vivas en memoria; al llenarse se descarta la más inactiva. */
  maxConversaciones: number;
  /** Una conversación sin actividad por este tiempo se olvida. */
  ttlConversacionMs: number;
  /** Ventana deslizante de los límites de mensajes. */
  ventanaLimiteMs: number;
  puerto: number;
  origenesPermitidos: string[];
  /** Solo para pruebas: toma el origen del encabezado `x-origen-prueba`. */
  permitirOrigenDePrueba: boolean;
}

export const CONFIG_INICIAL: ConfigServidor = {
  maxCuerpoBytes: 4096,
  maxMensajesPorMinutoConversacion: 12,
  maxMensajesPorMinutoOrigen: 40,
  maxMensajesPorMinutoPersona: 12,
  maxConversaciones: 200,
  ttlConversacionMs: 30 * 60 * 1000,
  ventanaLimiteMs: 60_000,
  puerto: 8791,
  origenesPermitidos: ['http://127.0.0.1:5329', 'http://localhost:5329'],
  permitirOrigenDePrueba: false,
};

export function configurar(parcial: Partial<ConfigServidor> = {}): ConfigServidor {
  return { ...CONFIG_INICIAL, ...parcial };
}
