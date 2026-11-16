/** Configuración de LiveKit que usa el servidor de tokens. */
export interface ConfigLiveKit {
  url: string;
  apiKey: string;
  apiSecret: string;
}

/**
 * Credenciales públicas y documentadas del modo `--dev` de livekit-server.
 * No son secretos: solo sirven contra un servidor local levantado con `--dev`.
 */
export const CREDENCIALES_DEV: ConfigLiveKit = {
  url: 'ws://localhost:7880',
  apiKey: 'devkey',
  apiSecret: 'secret',
};

const VARIABLES = ['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET'] as const;

/**
 * Lee LIVEKIT_URL, LIVEKIT_API_KEY y LIVEKIT_API_SECRET del entorno.
 * Sin ninguna y fuera de producción, usa las credenciales del modo dev.
 * Si falta alguna en cualquier otro caso, lanza un error que nombra las faltantes.
 */
export function leerConfigLiveKit(env: Record<string, string | undefined>): ConfigLiveKit {
  const faltantes = VARIABLES.filter((nombre) => !env[nombre]);
  if (faltantes.length === 0) {
    return {
      url: env.LIVEKIT_URL!,
      apiKey: env.LIVEKIT_API_KEY!,
      apiSecret: env.LIVEKIT_API_SECRET!,
    };
  }
  if (faltantes.length === VARIABLES.length && env.NODE_ENV !== 'production') {
    return CREDENCIALES_DEV;
  }
  throw new Error(`Falta configurar LiveKit: define ${faltantes.join(', ')}.`);
}

/** Puerto del servidor LiveKit; el cliente arma la URL con el hostname de la página. */
export function puertoLiveKit(url: string): number {
  const { port, protocol } = new URL(url);
  if (port) return Number(port);
  return protocol === 'wss:' || protocol === 'https:' ? 443 : 80;
}
