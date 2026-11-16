/** Vista de cámara de la página y su paso por la URL. Lógica pura. */
export type Vista = 'general' | 'seguir' | { zona: string };

export function parsearVista(texto: string | null, zonas: readonly string[]): Vista {
  if (texto === 'seguir') return 'seguir';
  if (texto?.startsWith('zona:')) {
    const zona = texto.slice(5);
    if (zonas.includes(zona)) return { zona };
  }
  return 'general';
}

/**
 * Vista con la que abre la página si la URL no pide una: en pantallas verticales «seguir», porque la
 * vista general de la sala entera deja mucho cielo y fachada en un teléfono; en horizontal, «general».
 */
export const vistaPorDefecto = (ancho: number, alto: number): 'general' | 'seguir' =>
  alto > ancho ? 'seguir' : 'general';

export const serializarVista = (v: Vista): string =>
  typeof v === 'string' ? v : `zona:${v.zona}`;

export const mismaVista = (a: Vista, b: Vista): boolean =>
  serializarVista(a) === serializarVista(b);

/** Props de `<Oficina>` para la vista elegida: el motor encuadra general, sigue al avatar o una zona. */
export function propsDeVista(vista: Vista): { vista: Vista; seguirAvatar: boolean } {
  return { vista, seguirAvatar: vista === 'seguir' };
}

/** Variante con la que abre: la pedida si existe en el escenario; si no, ninguna (el motor usa la primera). */
export function varianteInicial(pedida: string | null, ids: readonly string[]): string | undefined {
  return pedida && ids.includes(pedida) ? pedida : undefined;
}

/** Escenario con el que abre la página: el pedido si existe; si no, trading si existe; si no, el primero. */
export function escenarioInicial(pedido: string | null, ids: readonly string[]): string {
  if (pedido && ids.includes(pedido)) return pedido;
  return ids.includes('trading') ? 'trading' : (ids[0] ?? 'mansion');
}
