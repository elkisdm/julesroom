import { describe, expect, it } from 'vitest';
import { CREDENCIALES_DEV, leerConfigLiveKit, puertoLiveKit } from './config';

describe('leerConfigLiveKit', () => {
  it('usa las variables cuando están las tres', () => {
    const config = leerConfigLiveKit({
      LIVEKIT_URL: 'wss://sala.ejemplo.cl',
      LIVEKIT_API_KEY: 'k',
      LIVEKIT_API_SECRET: 's',
    });
    expect(config).toEqual({ url: 'wss://sala.ejemplo.cl', apiKey: 'k', apiSecret: 's' });
  });

  it('sin variables y fuera de producción usa las credenciales del modo dev', () => {
    expect(leerConfigLiveKit({})).toEqual(CREDENCIALES_DEV);
    expect(CREDENCIALES_DEV).toEqual({
      url: 'ws://localhost:7880',
      apiKey: 'devkey',
      apiSecret: 'secret',
    });
  });

  it('sin variables en producción lanza un error descriptivo', () => {
    expect(() => leerConfigLiveKit({ NODE_ENV: 'production' })).toThrow(/LIVEKIT_URL/);
  });

  it('con alguna variable faltante lanza un error que nombra las que faltan', () => {
    expect(() => leerConfigLiveKit({ LIVEKIT_URL: 'ws://x:1', LIVEKIT_API_KEY: 'k' })).toThrow(
      /LIVEKIT_API_SECRET/,
    );
  });
});

describe('puertoLiveKit', () => {
  it('lee el puerto explícito', () => {
    expect(puertoLiveKit('ws://localhost:7880')).toBe(7880);
  });
  it('usa 443 para wss y 80 para ws sin puerto', () => {
    expect(puertoLiveKit('wss://sala.ejemplo.cl')).toBe(443);
    expect(puertoLiveKit('ws://sala.ejemplo.cl')).toBe(80);
  });
});
