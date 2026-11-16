/** Fixture de integración local: usa el hook y el motor reales sin cambiar las entradas del producto. */
import { StrictMode, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Oficina, crearMando } from '@oficina/motor';
import type { Proyector } from '@oficina/motor';
import { salaNueva, atuendoInicial } from '../../plantillas';
import { useEnVivo } from '../useEnVivo';
import { Presentacion } from './Presentacion';
import '../../crear.css';
function Prueba() {
  const [sala, setSala] = useState(() =>
    salaNueva('oficina', {
      nombre: 'Sala de presentación',
      equipo: 'Demo',
      tuNombre: new URLSearchParams(location.search).get('nombre') ?? 'Anfitrión',
      atuendo: atuendoInicial(3),
    }),
  );
  const vivo = useEnVivo(true, sala, setSala, 'prueba-presentacion');
  const proyector = useRef<Proyector | null>(null);
  const [mando] = useState(crearMando);
  const avatar = useRef({ x: 0, y: 0, z: 0 });
  return (
    <div className="cr cr--dentro">
      <Oficina
        agentes={[]}
        escenario="oficina"
        fuentePresencia={vivo.fuente}
        calidad="media"
        onProyector={(p) => {
          proyector.current = p;
        }}
        avatarPropio={{
          id: vivo.sesion.yo,
          nombre: sala.ocupantes[0]?.nombre ?? 'Tú',
          atuendo: atuendoInicial(3),
          mando,
          alCambiar: (e) => {
            avatar.current = e;
            vivo.publicar({ ...e, saltos: mando.saltos });
          },
        }}
      >
        <Presentacion
          fuente={vivo.fuente}
          sesion={vivo.sesion}
          proyector={proyector}
          avatar={avatar.current}
        />
      </Oficina>
      <p style={{ position: 'absolute', top: 12, left: 24, pointerEvents: 'none' }}>
        {vivo.sesion.invitado ? 'Invitado' : 'Anfitrión'} · Prueba local de presentación
      </p>
    </div>
  );
}
if (!import.meta.env.DEV) throw new Error('Esta prueba solo está disponible en desarrollo.');
createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <Prueba />
  </StrictMode>,
);
