import type { EstadoPrecarga } from './mundos';

/** Los portales conservan recursos; solo el banco visible recibe sus cuadros de animación. */
export function alEstarActivo<A extends unknown[]>(
  activo: { current: boolean },
  ejecutar: (...args: A) => void,
): (...args: A) => void {
  return (...args) => {
    if (activo.current) ejecutar(...args);
  };
}

/** Durante la comparación el banco dibuja la selección; el motor oculto no reconstruye su copia. */
export function salaDeFondo<T>(actual: T, anterior: T, comparando: boolean): T {
  return comparando ? anterior : actual;
}

/** La llegada ya dibujaba su elegida mientras preparaba; solo comparar necesita el marcador. */
export function puedeDibujarBanco(comparando: boolean, estado?: EstadoPrecarga): boolean {
  return !comparando || estado !== undefined;
}
