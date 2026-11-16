import type { Atuendo } from '../tipos';

/**
 * Una persona humana presente en la oficina. `x`, `y`, `z` (metros) y `rumbo` (rad, igual que el
 * yaw del motor: 0 mira hacia +z) se actualizan EN SITIO cada vez que llega un dato nuevo:
 * el motor los lee en cada cuadro, así que mover a alguien nunca renderiza React.
 */
export interface PersonaPresente {
  id: string;
  nombre: string;
  atuendo: Atuendo;
  x: number;
  y: number;
  z: number;
  rumbo: number;
  /**
   * Contador de saltos de la persona (sube en 1 al despegar; opcional). Viaja como estado, no como
   * altura: cada cliente simula el mismo arco en local, así se ve fluido aunque lleguen 10
   * actualizaciones por segundo o se pierda alguna.
   */
  saltos?: number;
  /**
   * Postura de la persona (opcional; sin él, de pie). Semántica de `y`: de pie, el piso bajo los pies
   * (también durante un salto: el arco lo simula cada cliente con `saltos`); sentada, la altura del
   * asiento (la pelvis). Viaja como estado: cada cliente hace la transición en local.
   */
  estado?: 'de-pie' | 'sentado';
  /** Id del asiento del escenario en que está sentada (`Escenario` → acciones de sentarse). */
  asiento?: string;
}

/**
 * Entrada de presencia del motor: quien implemente esto (simulada, LiveKit u otro transporte)
 * entrega a las personas del momento. El motor no sabe de redes.
 *
 * Contrato:
 * - `personas()` devuelve la lista vigente; el arreglo y sus objetos pueden mutar entre cuadros.
 * - `suscribir` avisa SOLO cuando alguien entra, sale o cambia de atuendo/nombre (la lista de
 *   ocupantes cambió), nunca por un movimiento.
 */
export interface FuentePresencia {
  personas(): readonly PersonaPresente[];
  suscribir(alCambiar: () => void): () => void;
}
