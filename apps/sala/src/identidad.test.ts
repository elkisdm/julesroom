import { describe, expect, it } from 'vitest';
import { enlaceDeSala, nombreDeSala, nuevaIdentidad, urlLiveKit } from './identidad';

describe('identidad y enlaces', () => {
  it('la identidad es corta y solo letras y números', () => {
    expect(nuevaIdentidad(() => 0.5)).toMatch(/^u-[a-z2-9]{8}$/);
  });

  it('la sala sigue el formato del ADR y se sanea', () => {
    expect(nombreDeSala('Mi oficina!')).toBe('org:demo:oficina:Mi-oficina-');
    expect(nombreDeSala('', 'acme')).toBe('org:acme:oficina:x');
  });

  it('LiveKit usa el mismo equipo y ws bajo http, wss bajo https', () => {
    expect(urlLiveKit({ protocol: 'http:', hostname: '192.168.1.110' }, 7880)).toBe(
      'ws://192.168.1.110:7880',
    );
    expect(urlLiveKit({ protocol: 'https:', hostname: 'sala.ejemplo.dev' }, 443)).toBe(
      'wss://sala.ejemplo.dev:443',
    );
    expect(urlLiveKit({ protocol: 'http:', hostname: '::1' }, 7880)).toBe('ws://[::1]:7880');
  });

  it('el enlace usa la IP local cuando la página está en localhost', () => {
    const pagina = { protocol: 'http:', hostname: 'localhost', port: '5328' };
    expect(enlaceDeSala(pagina, '192.168.1.110', 'a b', 'trading')).toBe(
      'http://192.168.1.110:5328/?sala=a%20b&escenario=trading',
    );
    expect(enlaceDeSala(pagina, undefined, 'x', 'oficina')).toBe(
      'http://localhost:5328/?sala=x&escenario=oficina',
    );
    expect(
      enlaceDeSala({ ...pagina, hostname: '192.168.1.5' }, '10.0.0.1', 'x', 'oficina'),
    ).toContain('192.168.1.5');
  });
});
