import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { afterEach, expect, it, vi } from 'vitest';
import { spawn } from 'node:child_process';
import { cerebroCli } from '../../../../servidor/pizarra';
import { ejemplos } from './modelo';
vi.mock('node:child_process', () => ({ spawn: vi.fn() }));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
function procesoFalso() {
  const p = Object.assign(new EventEmitter(), {
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    kill: vi.fn(() => {
      queueMicrotask(() => p.emit('close', 1));
      return true;
    }),
  });
  vi.mocked(spawn).mockReturnValue(p as unknown as ReturnType<typeof spawn>);
  return p;
}
it('usa la suscripción, ningún secreto de API, sin shell/MCP/persistencia ni herramientas en Explicar', async () => {
  const p = procesoFalso();
  vi.stubEnv('ANTHROPIC_API_KEY', 'fixture-no-real');
  const promesa = cerebroCli({ explicar: 'modelo-rapido', investigar: 'modelo-busqueda' })(
    'idea de prueba',
    { intencion: 'explicar', signal: new AbortController().signal },
  );
  const [binario, args, opciones] = vi.mocked(spawn).mock.calls[0]!;
  expect(binario).toBe('claude');
  expect(args).toContain('--safe-mode');
  expect(args).toContain('--no-session-persistence');
  expect(args).toContain('--strict-mcp-config');
  expect(args).toContain('modelo-rapido');
  expect((args as string[])[(args as string[]).indexOf('--tools') + 1]).toBe('');
  expect(opciones?.env).not.toHaveProperty('ANTHROPIC_API_KEY');
  expect(opciones?.shell).toBeUndefined();
  p.stdout.write(JSON.stringify({ result: JSON.stringify(ejemplos('idea')) }));
  p.emit('close', 0);
  expect(JSON.parse((await promesa) as string).tipo).toBe('idea');
});
it('Investigar solo habilita búsqueda/lectura web y abortar mata el proceso', async () => {
  const p = procesoFalso(),
    control = new AbortController();
  const promesa = cerebroCli({ explicar: 'rapido', investigar: 'busqueda' })('idea', {
    intencion: 'investigar',
    signal: control.signal,
  });
  const args = vi.mocked(spawn).mock.calls[0]![1] as string[];
  expect(args[args.indexOf('--tools') + 1]).toBe('WebSearch,WebFetch');
  expect(args[args.indexOf('--allowedTools') + 1]).toBe('WebSearch,WebFetch');
  control.abort();
  await expect(promesa).rejects.toThrow();
  expect(p.kill).toHaveBeenCalledExactlyOnceWith('SIGKILL');
});
