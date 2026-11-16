interface Resultado {
  isFinal: boolean;
  0: { transcript: string };
}
interface Reconocimiento {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<Resultado> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type VentanaVoz = Window & {
  SpeechRecognition?: new () => Reconocimiento;
  webkitSpeechRecognition?: new () => Reconocimiento;
};
/** Web Speech se activa solamente desde un gesto del anfitrión; no usa el audio de la sala. */
export function iniciarDictado(
  parcial: (s: string) => void,
  terminado: (s: string) => void,
  error: (s: string) => void,
): { parar: () => void; cancelar: () => void } | null {
  const w = window as VentanaVoz,
    Constructor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Constructor) {
    error('Tu navegador no ofrece dictado. Escribe la idea aquí.');
    return null;
  }
  const r = new Constructor();
  let ultimo = '',
    cancelado = false;
  r.lang = 'es-CL';
  r.interimResults = true;
  r.continuous = true;
  r.onresult = (e) => {
    ultimo = Array.from(e.results)
      .map((v) => v[0].transcript)
      .join(' ');
    parcial(ultimo);
  };
  r.onerror = (e) => {
    cancelado = true;
    error(
      e.error === 'not-allowed'
        ? 'Permite el micrófono para dictar, o escribe tu idea.'
        : 'No pude escucharte. Intenta de nuevo o escribe tu idea.',
    );
  };
  r.onend = () => {
    terminado(cancelado ? '' : ultimo.trim());
  };
  try {
    r.start();
  } catch {
    error('No pude iniciar el dictado. Puedes escribir la idea.');
    return null;
  }
  return {
    parar: () => r.stop(),
    cancelar: () => {
      cancelado = true;
      r.abort();
    },
  };
}
