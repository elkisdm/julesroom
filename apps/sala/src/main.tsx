import { createRoot } from 'react-dom/client';
import { App } from './App';
import './sala.css';

// Sin StrictMode a propósito: monta, desmonta y vuelve a montar los efectos, y eso abriría y cerraría la conexión.
const raiz = document.getElementById('raiz');
if (raiz) createRoot(raiz).render(<App />);
