import { describe, expect, it } from 'vitest';
import * as api from './index';

describe('index', () => {
  it('exporta la API pública y no arrastra el SDK (claude.ts va por su subruta)', () => {
    for (const nombre of [
      'crearConversacion',
      'crearSimulador',
      'limpiarEntrada',
      'construirSistema',
      'EQUIPO_EJEMPLO',
      'ErrorProveedor',
      'expiro',
    ]) {
      expect(api).toHaveProperty(nombre);
    }
    expect(api).not.toHaveProperty('crearProveedorClaude');
  });
});
