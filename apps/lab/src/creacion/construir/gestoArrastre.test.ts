import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Raycaster, Vector2, Vector3 } from 'three';
import { FOV_VERTICAL, LIMITES_SALA } from '@oficina/motor';
import { crearAgarre, destinoDeAgarre, superaUmbral, type Rayo } from './gestoArrastre';

const PASO = LIMITES_SALA.paso;
const UMBRAL_PX = 6;

function rayo(camara: PerspectiveCamera, ndcX: number, ndcY: number): Rayo {
  const raycaster = new Raycaster();
  raycaster.setFromCamera(new Vector2(ndcX, ndcY), camara);
  const { origin, direction } = raycaster.ray;
  return {
    ox: origin.x,
    oy: origin.y,
    oz: origin.z,
    dx: direction.x,
    dy: direction.y,
    dz: direction.z,
  };
}

/** Cámara de casa de muñecas: `azimut` 0 mira desde +z. */
function camaraEn(azimut: number, elevacion: number, distancia: number) {
  const camara = new PerspectiveCamera(FOV_VERTICAL, 1440 / 900, 0.1, 400);
  const plano = Math.cos(elevacion) * distancia;
  camara.position.set(
    Math.sin(azimut) * plano,
    Math.sin(elevacion) * distancia,
    Math.cos(azimut) * plano,
  );
  camara.lookAt(0, 0, 0);
  camara.updateProjectionMatrix();
  camara.updateMatrixWorld();
  return camara;
}

describe('superaUmbral', () => {
  it('un movimiento menor al umbral es un clic', () => {
    expect(superaUmbral({ x: 10, y: 20 }, { x: 14, y: 23 }, UMBRAL_PX)).toBe(false);
    expect(superaUmbral({ x: 0, y: 0 }, { x: UMBRAL_PX, y: 0 }, UMBRAL_PX)).toBe(true);
  });
});

describe('el punto agarrado sigue al puntero', () => {
  const origen = { x: 0, z: 0 };
  const agarrado = { x: 0.25, y: 0.62, z: -0.15 };
  const agarre = crearAgarre(origen, agarrado);

  it('el rayo que pasa por el punto agarrado devuelve el origen, en tres azimuts', () => {
    for (const azimut of [0.4, 2.3, 4.6]) {
      const camara = camaraEn(azimut, 0.95, 16);
      const v = new Vector3(agarrado.x, agarrado.y, agarrado.z).project(camara);
      const destino = destinoDeAgarre(rayo(camara, v.x, v.y), agarre, PASO);
      expect(destino, `azimut ${azimut}`).toEqual({ x: 0, z: 0 });
    }
  });

  it('tras mover el puntero, el punto queda a menos de media celda, en tres azimuts', () => {
    for (const azimut of [0.4, 2.3, 4.6]) {
      const camara = camaraEn(azimut, 0.95, 16);
      const desplazamiento = rayo(camara, 0.22, -0.08);
      const destino = destinoDeAgarre(desplazamiento, agarre, PASO);
      expect(destino, `azimut ${azimut}`).not.toBeNull();
      const t = (agarre.planoY - desplazamiento.oy) / desplazamiento.dy;
      const ix = desplazamiento.ox + desplazamiento.dx * t;
      const iz = desplazamiento.oz + desplazamiento.dz * t;
      expect(Math.abs(destino!.x + agarre.dx - ix)).toBeLessThanOrEqual(PASO / 2 + 1e-9);
      expect(Math.abs(destino!.z + agarre.dz - iz)).toBeLessThanOrEqual(PASO / 2 + 1e-9);
      expect(Math.hypot(destino!.x - origen.x, destino!.z - origen.z)).toBeGreaterThan(PASO);
    }
  });

  it('un rayo paralelo al plano no inventa un destino', () => {
    expect(destinoDeAgarre({ ox: 0, oy: 2, oz: 0, dx: 1, dy: 0, dz: 0 }, agarre, PASO)).toBeNull();
  });
});
