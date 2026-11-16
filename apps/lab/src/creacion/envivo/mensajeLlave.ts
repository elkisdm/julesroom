const INCORRECTA = 'La llave de demo es incorrecta.';

/** Sin llave escrita, el 401 del emisor significa «falta la llave», no «la escribiste mal». */
export function mensajeLlave(error: string, llave: string): string {
  return error === INCORRECTA && !llave.trim()
    ? 'Escribe la llave de la demo para abrir tu sala a invitados.'
    : error;
}
