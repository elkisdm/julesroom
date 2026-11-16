import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Medicion } from './Medicion';
import '../estilos.css';

const raiz = document.getElementById('raiz');
if (raiz) {
  createRoot(raiz).render(
    <StrictMode>
      <Medicion />
    </StrictMode>,
  );
}
