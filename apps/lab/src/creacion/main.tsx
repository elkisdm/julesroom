import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Crear } from './Crear';

const raiz = document.getElementById('raiz');
if (!raiz) throw new Error('Falta #raiz en crear.html');
createRoot(raiz).render(
  <StrictMode>
    <Crear />
  </StrictMode>,
);
