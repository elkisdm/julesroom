/** Índice circular de un grupo de opciones, sin interferir con confirmar ni salir. */
export function indicePorTecla(actual: number, total: number, tecla: string): number | null {
  if (total === 0) return null;
  if (tecla === 'Home') return 0;
  if (tecla === 'End') return total - 1;
  const direccion = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -1, ArrowDown: 1 }[tecla];
  return direccion === undefined ? null : (actual + direccion + total) % total;
}

/** Activa y enfoca la opción vecina; el navegador conserva Enter y la aplicación, Escape. */
export function navegarBotones(evento: KeyboardEvent, grupo: HTMLElement): void {
  if (evento.metaKey || evento.ctrlKey || evento.altKey) return;
  const botones = [...grupo.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
  const actual = botones.indexOf(evento.target as HTMLButtonElement);
  if (actual < 0) return;
  const siguiente = indicePorTecla(actual, botones.length, evento.key);
  if (siguiente === null) return;
  evento.preventDefault();
  evento.stopPropagation();
  botones[siguiente]!.focus();
  botones[siguiente]!.click();
}
