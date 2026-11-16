import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';

const raiz = resolve(import.meta.dirname, '../..');

for (const url of ['', 'https://jules.example.test']) {
  it(`compila una vista previa estática con recursos existentes ${url ? 'y URL absoluta' : 'sin URL pública'}`, () => {
    const destino = mkdtempSync(resolve(tmpdir(), 'd7-preview-'));
    try {
      execFileSync(
        process.execPath,
        [resolve(raiz, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', destino],
        {
          cwd: raiz,
          env: { ...process.env, VITE_URL_PUBLICA: url },
          stdio: 'pipe',
        },
      );
      const html = readFileSync(resolve(destino, 'crear.html'), 'utf8');
      const meta = (nombre: string) =>
        html.match(new RegExp(`<meta\\s+(?:property|name)="${nombre}"\\s+content="([^"]+)"`))?.[1];
      expect(html).toContain('<title>Jules Room · tu oficina en 3D</title>');
      expect(meta('description')).toContain('Tu oficina en 3D');
      expect(meta('robots')).toContain('noindex');
      expect(meta('og:type')).toBe('website');
      expect(meta('og:title')).toContain('Jules Room');
      expect(meta('og:description')).toBe(meta('description'));
      expect(meta('og:url')).toBe(`${url}/`);
      expect(meta('og:image')).toBe(`${url}/jules-room-social.jpg`);
      expect(meta('og:image:width')).toBe('1200');
      expect(meta('og:image:height')).toBe('630');
      expect(meta('twitter:card')).toBe('summary_large_image');
      expect(meta('twitter:image')).toBe(meta('og:image'));
      expect(meta('theme-color')).toBe('#07080b');
      expect(html).not.toMatch(/__URL_PUBLICA__|%VITE_URL_PUBLICA%|undefined/);
      const recursos = [
        meta('og:image')!,
        ...Array.from(html.matchAll(/<link[^>]+href="([^"]+)"/g), (m) => m[1]!),
      ];
      for (const recurso of recursos.filter((r) => !r.startsWith('https://fonts.'))) {
        const ruta = url && recurso.startsWith(url) ? recurso.slice(url.length) : recurso;
        expect(existsSync(resolve(destino, `.${ruta}`)), ruta).toBe(true);
      }
      const manifiesto = JSON.parse(readFileSync(resolve(destino, 'site.webmanifest'), 'utf8'));
      for (const icono of manifiesto.icons)
        expect(existsSync(resolve(destino, `.${icono.src}`))).toBe(true);
      for (const lado of [32, 180, 192, 512]) {
        const png = readFileSync(resolve(destino, `icon-${lado}.png`));
        expect(png.readUInt32BE(16)).toBe(lado);
        expect(png.readUInt32BE(20)).toBe(lado);
      }
      expect(readFileSync(resolve(destino, 'jules-room-social.jpg')).length).toBeLessThanOrEqual(
        300_000,
      );
    } finally {
      rmSync(destino, { recursive: true, force: true });
    }
  }, 120_000);
}
