import { leerPerfil } from '../../../../../packages/presencia/src/perfil';
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { verificarCodigoFundador, puedeOfrecerFundador, vestirFundador } from './fundador';
import { atuendoInicial } from '../plantillas';
import { categorias, sorprender } from './estadoPersonaje';
import { catalogoBase, resolverAtuendo } from '@oficina/motor';
describe('fundador', () => {
  const hash = createHash('sha256').update('solo-prueba').digest('hex');
  it('sin configuración y con hash inválido cierra la selección', async () => {
    expect(await verificarCodigoFundador('solo-prueba', undefined)).toBe(false);
    expect(await verificarCodigoFundador('solo-prueba', 'inválido')).toBe(false);
    expect(puedeOfrecerFundador(undefined, true)).toBe(false);
    expect(puedeOfrecerFundador(hash, false)).toBe(false);
  });
  it('compara SHA-256 exacto; no acepta código vacío o incorrecto', async () => {
    expect(await verificarCodigoFundador('solo-prueba', hash)).toBe(true);
    expect(await verificarCodigoFundador('otra', hash)).toBe(false);
    expect(await verificarCodigoFundador('', hash)).toBe(false);
    expect(puedeOfrecerFundador(hash, true)).toBe(true);
  });
  it('equipa el conjunto sin cambiar la identidad', () => {
    const a = atuendoInicial(3);
    const b = vestirFundador(a);
    expect(b.top).toBe('fundador');
    expect(b.skin).toBe(a.skin);
    expect(b.hair).toBe(a.hair);
    expect(b.bottom).toBe('pantalon');
    expect(b.topColor).not.toBe(b.bottomColor);
    expect(resolverAtuendo({ ...catalogoBase, paquetes: [] }, b).top).toBe('fundador');
  });
  it('el perfil existente transporta el atuendo del fundador sin cerrar el vocabulario', () => {
    const a = vestirFundador(atuendoInicial(3));
    const remoto = leerPerfil(JSON.stringify({ n: 'Alex', a, e: 'sala', s: null }));
    expect(remoto?.a).toEqual(a);
    expect(resolverAtuendo({ ...catalogoBase, paquetes: [] }, remoto!.a).top).toBe('fundador');
  });
  it('no aparece en opciones públicas ni en azar; el cliente anterior usa el top base', () => {
    expect(categorias[0]!.opciones.some((o) => o.id === 'fundador')).toBe(false);
    for (let i = 0; i < 50; i++) expect(sorprender(atuendoInicial(3), i).top).not.toBe('fundador');
    const antiguo = {
      ...catalogoBase,
      tops: catalogoBase.tops.filter((t) => t.id !== 'fundador'),
      paquetes: [],
    };
    expect(resolverAtuendo(antiguo, vestirFundador(atuendoInicial(3))).top).toBe('polera');
  });
});
