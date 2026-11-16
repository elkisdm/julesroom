import type { ReactNode } from 'react';

/** Una tecla dibujada como tecla (no como pastilla). */
export const Tecla = ({ children }: { children: ReactNode }) => (
  <kbd className="cr-tecla">{children}</kbd>
);
