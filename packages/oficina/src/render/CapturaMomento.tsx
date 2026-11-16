import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { HalfFloatType, PerspectiveCamera, Vector2, Vector3, WebGLRenderTarget } from 'three';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { Punto3 } from './camara';
import { encuadreFoto } from './encuadreFoto';

export interface SolicitudFoto {
  id: number;
  nombre: string;
  fecha: number;
  amplia: boolean;
  puntos: () => readonly Punto3[];
  alFoto: (blob: Blob, amplia: boolean) => void;
  alError: (mensaje: string) => void;
}
const FOTO = { pie: 76, fuente: 23, margen: 28, anchoMax: 1920 };
/** Captura aislada: no cambia el buffer persistente ni la cámara de navegación. */
export function CapturaMomento({ solicitud }: { solicitud: SolicitudFoto | null }) {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    if (!solicitud) return;
    let vigente = true;
    const capturar = async () => {
      await document.fonts.ready;
      if (!vigente) return;
      const size = gl.getDrawingBufferSize(new Vector2());
      const escala = Math.min(1, FOTO.anchoMax / size.x);
      const ancho = Math.max(1, Math.round(size.x * escala));
      const alto = Math.max(1, Math.round(size.y * escala));
      const anterior = gl.getRenderTarget();
      const destino = new WebGLRenderTarget(ancho, alto);
      const origen = new WebGLRenderTarget(ancho, alto, { type: HalfFloatType });
      const salida = new OutputPass();
      const capturarVista = async (amplia: boolean) => {
        let camara = camera;
        if (amplia) {
          const nueva = new PerspectiveCamera(45, ancho / alto, 0.5, 2000);
          const encuadre = encuadreFoto(solicitud.puntos(), ancho / alto, nueva.fov);
          const centro = new Vector3(encuadre.centro.x, encuadre.centro.y, encuadre.centro.z);
          nueva.position
            .copy(centro)
            .add(new Vector3(0, 0.65, 1).normalize().multiplyScalar(encuadre.distancia));
          nueva.lookAt(centro);
          nueva.updateMatrixWorld();
          camara = nueva;
        }
        const pixeles = new Uint8Array(ancho * alto * 4);
        try {
          gl.setRenderTarget(origen);
          gl.render(scene, camara);
          salida.render(gl, destino, origen, 0, false);
          gl.readRenderTargetPixels(destino, 0, 0, ancho, alto, pixeles);
        } finally {
          gl.setRenderTarget(anterior);
        }
        const lienzo = document.createElement('canvas');
        lienzo.width = ancho;
        lienzo.height = alto + FOTO.pie;
        const ctx = lienzo.getContext('2d');
        if (!ctx) throw new Error('No pudimos preparar la foto.');
        const imagen = ctx.createImageData(ancho, alto);
        const fila = ancho * 4;
        for (let y = 0; y < alto; y++)
          imagen.data.set(pixeles.subarray((alto - y - 1) * fila, (alto - y) * fila), y * fila);
        ctx.putImageData(imagen, 0, 0);
        const estilo = getComputedStyle(document.querySelector('.cr') ?? document.body);
        ctx.fillStyle = estilo.getPropertyValue('--tinta').trim() || '#07080b';
        ctx.fillRect(0, alto, ancho, FOTO.pie);
        ctx.fillStyle = estilo.getPropertyValue('--texto').trim() || '#f4efe6';
        ctx.font = `${FOTO.fuente}px ${estilo.getPropertyValue('--display').trim() || 'sans-serif'}`;
        const fecha = new Intl.DateTimeFormat('es', { dateStyle: 'long' }).format(solicitud.fecha);
        ctx.fillText(
          `${solicitud.nombre} · ${fecha}`,
          FOTO.margen,
          alto + FOTO.pie * 0.62,
          ancho - FOTO.margen * 2,
        );
        const blob = await new Promise<Blob>((resolve, reject) =>
          lienzo.toBlob(
            (b) => (b ? resolve(b) : reject(new Error('No pudimos exportar el PNG.'))),
            'image/png',
          ),
        );
        if (vigente) solicitud.alFoto(blob, amplia);
      };
      try {
        await capturarVista(false);
        if (solicitud.amplia) await capturarVista(true);
      } finally {
        destino.dispose();
        origen.dispose();
        salida.dispose();
      }
    };
    void capturar().catch(() => {
      if (vigente) solicitud.alError('No pudimos tomar la foto. Vuelve a intentarlo.');
    });
    return () => {
      vigente = false;
    };
  }, [solicitud, gl, scene, camera]);
  return null;
}
