import { expect, it } from 'vitest';
import { dibujoDe } from '../registroDibujo';
import { DibujoAuditorio } from './DibujoAuditorio';
it('registra el dibujo del auditorio', () => {
  expect(dibujoDe('auditorio')).toBe(DibujoAuditorio);
});
