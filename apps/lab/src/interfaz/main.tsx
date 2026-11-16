import { createRoot } from 'react-dom/client';
import './sistema.css';
import { Interfaz } from './Interfaz';

// Se prepara la fuente antes de mostrar texto: no hay sustitución de métricas tras el montaje.
async function iniciar() {
  try {
    await document.fonts.load('400 15px "Figtree JR"');
  } catch (error) {
    console.error('No se pudo cargar la fuente local. Se usará la fuente del sistema.', error);
  }
  const raiz = document.getElementById('raiz');
  if (raiz) {
    raiz.removeAttribute('aria-busy');
    createRoot(raiz).render(<Interfaz />);
  }
}
void iniciar();
