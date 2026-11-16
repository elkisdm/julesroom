import { defineConfig } from 'vitest/config';
import base, { CRITICAL_THRESHOLDS } from '@devground/vitest-config';

// Umbrales de cobertura VIVOS en este repo (committeados). CRITICAL_THRESHOLDS
// (rutas dinero/leads/auth, ADR-0012) se hereda del preset; el piso GLOBAL con
// ratchet lo lleva este archivo: autoUpdate sube estos números a la cobertura
// real y nunca los baja (ADR-0025). Arrancan en 0 → el primer test:coverage
// los siembra con la cobertura actual del proyecto.
export default defineConfig({
  ...base,
  test: {
    ...base.test,
    // Monorepo TypeScript: el código vive en packages/*/src y apps/*/src.
    include: ['packages/*/src/**/*.test.{ts,tsx}', 'apps/*/src/**/*.test.{ts,tsx}'],
    coverage: {
      ...base.test.coverage,
      include: ['packages/*/src/**/*.{ts,tsx}', 'apps/*/src/**/*.{ts,tsx}'],
      exclude: [
        'packages/*/src/**/*.test.{ts,tsx}',
        'apps/*/src/**/*.test.{ts,tsx}',
        '**/dist/**',
        '**/node_modules/**',
        '**/*.config.*',
      ],
      thresholds: {
        ...CRITICAL_THRESHOLDS,
        autoUpdate: true,
        lines: 0,
        functions: 0,
        branches: 0,
        statements: 0,
      },
    },
  },
});
