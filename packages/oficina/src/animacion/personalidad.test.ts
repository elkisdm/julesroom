import { describe, expect, it } from 'vitest';
import { LOOK_POR_ROL } from '../vestuario/roles';
import { azarSemilla } from '../test-utils';
import { nuevoIdle, TODAS_LAS_VARIANTES } from './idle';
import { PERFIL_NEUTRO, PERFILES, perfilDeRol } from './personalidad';

const sumaPesos = (pesos: Record<string, number | undefined>) =>
  Object.values(pesos).reduce<number>((suma, peso) => suma + (peso ?? 0), 0);

describe('perfiles de idle por rol', () => {
  it('cada rol conocido tiene su perfil, con pesos que suman más de 0', () => {
    for (const rol of Object.keys(LOOK_POR_ROL)) {
      const perfil = PERFILES[rol];
      expect(perfil, rol).toBeDefined();
      expect(sumaPesos(perfil?.pesos ?? {}), rol).toBeGreaterThan(0);
    }
  });

  it('solo menciona variantes que existen y con pesos no negativos', () => {
    for (const perfil of [PERFIL_NEUTRO, ...Object.values(PERFILES)]) {
      for (const [nombre, peso] of Object.entries(perfil.pesos)) {
        expect(TODAS_LAS_VARIANTES).toContain(nombre);
        expect(peso).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('un rol desconocido usa el perfil neutro', () => {
    expect(perfilDeRol('Astronauta')).toBe(PERFIL_NEUTRO);
    expect(perfilDeRol('Contador')).toBe(PERFILES['Contador']);
  });

  it('cada personalidad se nota: el Científico lee, el Contador revisa papeles', () => {
    const azar = azarSemilla(9);
    const moda = (rol: string) => {
      const cuenta = new Map<string, number>();
      for (let i = 0; i < 600; i++) {
        const { variante } = nuevoIdle(azar, perfilDeRol(rol).pesos);
        cuenta.set(variante, (cuenta.get(variante) ?? 0) + 1);
      }
      return [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    };
    expect(moda('Científico')).toBe('leer_documento');
    expect(moda('Contador')).toBe('revisar_papeles');
  });

  it('Contenido prueba la luz, Ventas habla por teléfono caminando y el resto toma café', () => {
    for (const rol of ['Guionista', 'Editor de video', 'Community']) {
      expect(perfilDeRol(rol)).toMatchObject({ destinoPaseo: 'luz', pausa: 'probar_luz' });
    }
    for (const rol of ['Ejecutivo de ventas', 'Analista comercial']) {
      expect(perfilDeRol(rol)).toMatchObject({ destinoPaseo: 'cafe', pausa: 'telefono_circulo' });
    }
    expect(perfilDeRol('Backend')).toMatchObject({ destinoPaseo: 'cafe', pausa: 'cafe' });
    expect(perfilDeRol('Backend').pesos.estirar_espalda).toBeGreaterThan(0);
    expect(perfilDeRol('Backend').pesos.tomar_cafe).toBeGreaterThan(0);
  });
});
