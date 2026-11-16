import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { alturaEn, sueloDe, PizarraMundo, type Escenario } from '@oficina/motor';
import type { FuenteLiveKit } from '@oficina/presencia';
import type { SesionViva } from '../useEnVivo';
import { PanelPizarra, type PanelProps } from './PanelPizarra';
import { animar, laminaActual } from './dibujo';
import { ampliar, comandoVoz, respaldo, type Pizarra } from './modelo';
import { agregar, mover, vacia } from './historia';
import { explicar } from './cliente';
import { buscarColocacion, TABLERO } from './colocacion';
import { serializarPizarra, type FotoPizarra } from './mensajes';
import { sincronizarPizarra } from './sincronizar';
import { MirarPizarra } from './MirarPizarra';
export { laminaActual } from './dibujo';
interface Props {
  vivo: { fuente: FuenteLiveKit | null; sesion: SesionViva };
  posicion: RefObject<{ x: number; y: number; z: number }>;
  escenario: Escenario;
}
const inicial = (): FotoPizarra => ({
  tipo: 'd8:pizarra',
  revision: 1,
  pizarra: null,
  posicion: null,
  estado: 'lista',
  texto: '',
});
/** Montaje único dentro del Canvas; el panel DOM vive en su propia raíz, sobre el mundo. */
export function PizarraViva({ vivo, posicion, escenario }: Props) {
  const [foto, setFoto] = useState(inicial),
    [historia, setHistoria] = useState(vacia),
    [aviso, setAviso] = useState(''),
    [expandida, setExpandida] = useState(false);
  const [mirando, setMirando] = useState(false);
  const lienzo = useMemo(laminaActual, []),
    anterior = useRef<Pizarra | null>(null);
  const root = useRef<Root | null>(null),
    fotoRef = useRef(foto),
    historiaRef = useRef(historia),
    ocupado = useRef(false),
    montado = useRef(true);
  fotoRef.current = foto;
  historiaRef.current = historia;
  const anfitrion =
    !vivo.sesion.invitado && !!vivo.sesion.dueno && vivo.sesion.yo === vivo.sesion.dueno;
  const camera = useThree((s) => s.camera),
    gl = useThree((s) => s.gl);
  const suelo = useMemo(() => sueloDe(escenario), [escenario]);
  useEffect(() => {
    montado.current = true;
    const nodo = document.createElement('div');
    nodo.className = 'd8-raiz';
    gl.domElement.closest('.cr')?.appendChild(nodo);
    root.current = createRoot(nodo);
    return () => {
      montado.current = false;
      const r = root.current;
      root.current = null;
      queueMicrotask(() => {
        r?.unmount();
        nodo.remove();
      });
    };
  }, [gl]);
  useEffect(() => {
    const cancelar = animar(
      lienzo,
      foto.pizarra,
      () => lienzo.dispatchEvent(new Event('d8:dibujo')),
      foto.estado,
      foto.texto,
      anterior.current,
    );
    return cancelar;
  }, [lienzo, foto.pizarra, foto.estado, foto.texto]);
  const cambiar = (cambio: Partial<FotoPizarra>) => {
    if (!anfitrion) return;
    const nueva = {
      ...fotoRef.current,
      ...cambio,
      revision: Math.max(Date.now(), fotoRef.current.revision + 1),
    };
    fotoRef.current = nueva;
    setFoto(nueva);
  };
  useEffect(() => {
    const fuente = vivo.fuente;
    if (!fuente) return;
    return sincronizarPizarra(
      fuente,
      vivo.sesion.dueno,
      anfitrion,
      () => fotoRef.current,
      (recibida) => {
        anterior.current = fotoRef.current.pizarra;
        fotoRef.current = recibida;
        setFoto(recibida);
      },
      () => setAviso('La conexión se está recuperando. La pizarra se reenviará.'),
    );
  }, [vivo.fuente, vivo.sesion.dueno, anfitrion]);
  useEffect(() => {
    if (anfitrion && vivo.fuente)
      void vivo.fuente
        .enviarDatos(serializarPizarra(foto))
        .catch(() => setAviso('La conexión se está recuperando. La pizarra se reenviará.'));
  }, [foto, anfitrion, vivo.fuente]);
  const guardar = (p: Pizarra) => {
    const h = agregar(historiaRef.current, p);
    historiaRef.current = h;
    setHistoria(h);
    cambiar({ pizarra: p, estado: 'lista', texto: '' });
  };
  const navegar = (delta: number) => {
    if (!anfitrion || ocupado.current || !historiaRef.current.laminas.length) return;
    const h = mover(historiaRef.current, delta);
    historiaRef.current = h;
    setHistoria(h);
    anterior.current = null;
    cambiar({ pizarra: h.laminas[h.indice]!, estado: 'lista', texto: '' });
  };
  const borrar = () => {
    if (ocupado.current) return;
    anterior.current = null;
    cambiar({ pizarra: null, estado: 'lista', texto: '' });
  };
  const generar: PanelProps['alIdea'] = async (idea, intencion, sumar, codigo, manual) => {
    if (!anfitrion || ocupado.current) return;
    const comando = comandoVoz(idea);
    if (comando) {
      if (comando === 'borrar') borrar();
      else navegar(comando === 'volver' ? -1 : 1);
      return;
    }
    const previa = fotoRef.current.pizarra;
    anterior.current = sumar ? previa : null;
    if (manual) {
      guardar(sumar && previa ? ampliar(previa, respaldo(idea)) : respaldo(idea));
      setAviso('Texto escrito a mano. No se consultó ningún modelo.');
      return;
    }
    ocupado.current = true;
    setAviso('');
    cambiar({ estado: 'pensando', texto: idea });
    try {
      const r = await explicar(codigo, idea, intencion, sumar && previa ? previa : undefined);
      if (!montado.current) return;
      guardar(sumar && previa ? ampliar(previa, r.pizarra) : r.pizarra);
      setAviso(
        `${r.simulada ? 'Ejemplo simulado' : r.respaldo ? 'Guía de respaldo; no es una investigación verificada' : 'Explicación lista'} · ${(r.latenciaMs / 1000).toFixed(1)} s`,
      );
    } catch (e) {
      if (!montado.current) return;
      const error = e instanceof Error ? e.message : 'No pude completar la explicación.';
      cambiar({ estado: 'error', texto: `${error} Puedes escribir tu idea a mano.` });
      setAviso(error);
    } finally {
      ocupado.current = false;
    }
  };
  const colocar = () => {
    if (!anfitrion) return;
    const yo = posicion.current,
      direccion = camera.getWorldDirection(new Vector3());
    const colision = escenario.colision(yo.y);
    const cajas = [
      ...colision.cajas,
      ...suelo.solidos.filter((s) => s.y1 > yo.y + 0.1 && s.y0 < yo.y + TABLERO.alto + TABLERO.pie),
    ];
    const p = buscarColocacion(
      yo,
      Math.atan2(direccion.x, direccion.z),
      { cajas, limites: colision.limites },
      (x, z) => alturaEn(suelo, x, z, yo.y),
    );
    if (!p) {
      setAviso('Aquí no cabe la pizarra. Busca un espacio abierto y vuelve a colocarla.');
      return;
    }
    cambiar({ posicion: p });
    setAviso('Pizarra colocada. Haz clic sobre ella para verla grande.');
  };
  useEffect(() => {
    root.current?.render(
      <PanelPizarra
        anfitrion={anfitrion}
        foto={foto}
        lienzo={lienzo}
        aviso={aviso}
        indice={historia.indice}
        total={historia.laminas.length}
        expandida={expandida}
        alExpandir={setExpandida}
        mirando={mirando}
        alMirar={setMirando}
        alColocar={colocar}
        alIdea={generar}
        alMover={navegar}
        alBorrar={borrar}
      />,
    );
  });
  return foto.posicion ? (
    <>
      <PizarraMundo lienzo={lienzo} posicion={foto.posicion} alAbrir={() => setExpandida(true)} />
      {mirando && <MirarPizarra posicion={foto.posicion} />}
    </>
  ) : null;
}
