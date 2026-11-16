type Almacen = Pick<Storage, 'getItem' | 'setItem'>;
/** Recupera solo salas cuya capacidad de anfitrión sigue en este navegador. */
export function recuperarSala(almacen: Almacen, guardada: string): string | null {
  const viva = almacen.getItem(`demo/guardada/${guardada}`);
  return viva && almacen.getItem(`demo/dueno/${viva}`) ? viva : null;
}
/** Persiste la relación por documento; ninguna capacidad se añade al enlace. */
export function guardarSala(almacen: Almacen, guardada: string, viva: string, secreto: string) {
  almacen.setItem(`demo/dueno/${viva}`, secreto);
  almacen.setItem(`demo/guardada/${guardada}`, viva);
}

const pendientes = new Map<string, Promise<string>>();
/** Reutiliza incluso la petición en curso al volver rápido al paso Invitar. */
export async function asegurarSala(
  almacen: Almacen,
  guardada: string,
  crear: () => Promise<{ sala: string; secretoDueno: string }>,
): Promise<string> {
  const existente = recuperarSala(almacen, guardada);
  if (existente) return existente;
  const pendiente = pendientes.get(guardada);
  if (pendiente) return pendiente;
  const solicitud = crear().then(({ sala, secretoDueno }) => {
    guardarSala(almacen, guardada, sala, secretoDueno);
    return sala;
  });
  pendientes.set(guardada, solicitud);
  try {
    return await solicitud;
  } finally {
    pendientes.delete(guardada);
  }
}

/** Migra solo una capacidad anterior inequívoca; nunca reemplaza una relación ya guardada. */
export function migrarSalaAnterior(almacen: Almacen, guardada: string, anterior: string | null) {
  if (recuperarSala(almacen, guardada) || !anterior) return;
  const secreto = almacen.getItem(`demo/dueno/${anterior}`);
  if (secreto) guardarSala(almacen, guardada, anterior, secreto);
}
