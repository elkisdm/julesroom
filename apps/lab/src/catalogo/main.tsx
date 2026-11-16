import { Muestras } from './Muestras';
/** Banco visual local: usa modelos, mundos, luces y poses reales; no modifica la navegación del producto. */
import { createRoot } from 'react-dom/client';
import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import {
  catalogoBase,
  crearCatalogo,
  resolverAtuendo,
  aplicarConjunto,
  CONJUNTOS,
  laboratorio as L,
  dibujoDe,
  escenarioPorId,
  atuendoPorRol,
} from '@oficina/motor';
import type { Atuendo } from '@oficina/motor';
import { posarSentado } from '@oficina/motor';
import { calcularPose, crearPose } from '@oficina/motor';
import { vestirFundador } from '../creacion/pasos/fundador';
const q = new URLSearchParams(location.search);
const mundo = q.get('mundo') ?? 'oficina';
const pose = q.get('pose') ?? 'frente';
const mini = q.has('mini');
const conjunto = q.get('conjunto');
const indiceConjunto = CONJUNTOS.findIndex((c) => c.id === conjunto);
const grupo = pose === 'grupo';
const oscuro = mundo === 'trading';
const e = escenarioPorId(mundo);
const Dibujo = dibujoDe(mundo)!;
const base = {
  ...atuendoPorRol('Backend', 1),
  hair: 'corto',
  hairColor: '#1f1611',
  skin: catalogoBase.pieles[Math.max(0, indiceConjunto) % catalogoBase.pieles.length]!,
  face: 'serio',
};
const origen = oscuro ? { x: 0, y: 0, z: 6 } : { x: 0, y: 0, z: 5 };
const catalogo = crearCatalogo(catalogoBase);
const hora = oscuro ? 22 : 10;
function Modelo({ a, i }: { a: Atuendo; i: number }) {
  const rigs = useRef(new Map<string, L.Rig>());
  const id = `modelo-${i}`;
  const recursos = useMemo(
    () => ({ flota: new L.Flota(), cuerpo: L.crearEstadoCuerpo(id), saludo: crearPose() }),
    [id],
  );
  useEffect(() => () => recursos.flota.liberar(), [recursos]);
  useFrame((_, dt) => {
    const rig = rigs.current.get(id);
    if (!rig) return;
    const { cuerpo, flota } = recursos;
    cuerpo.loc.rumbo =
      pose === 'espalda' ? Math.PI : pose === 'tres-cuartos' || pose === 'sentado' ? 0.55 : 0;
    cuerpo.loc.velocidad = pose === 'caminando' ? 1.15 : 0;
    cuerpo.loc.fase = 0.18;
    if (pose === 'saltando') {
      cuerpo.loc.salto.fase = 'aire';
      cuerpo.loc.salto.y = 0.35;
    }
    L.aplicarCuerpo(rig, cuerpo, 1.2, Math.min(dt, 0.03));
    rig.raiz.position.set(
      (mini ? 0 : origen.x) + (grupo ? (i - 2.5) * 1.25 : 0),
      mini ? 0 : origen.y,
      (mini ? 0 : origen.z) + (grupo && i !== 2 ? 0.35 : 0),
    );
    if (pose === 'sentado') {
      posarSentado(rig, 1, 0);
      rig.raiz.position.y -= 0.17;
    }
    if (pose === 'saludando') {
      const p = calcularPose(
        { fase: 0, postura: 'de_pie', saludando: true, velocidad: 0, t: 0.7 },
        recursos.saludo,
      );
      rig.brazos[1].hombro.rotation.x = p.brazos[1].hombro;
      rig.brazos[1].hombro.rotation.z = p.brazos[1].abduccion;
      rig.brazos[1].codo.rotation.x = -p.brazos[1].codo;
    }
    rig.raiz.updateMatrixWorld(true);
    flota.inicio();
    for (const parte of rig.partes)
      if (parte.ancla.visible && !parte.cartel)
        flota.agregar(
          parte.geometria,
          parte.estilo.familia,
          parte.ancla.matrixWorld,
          parte.estilo.color,
          parte.celda,
        );
    flota.fin();
  });
  return (
    <>
      <L.Persona
        agente={{ id, nombre: '', rol: '', departamento: '', estado: 'libre' }}
        atuendo={resolverAtuendo(catalogo, a)}
        seleccionado={false}
        rigs={rigs}
        onSeleccionar={() => undefined}
      />
      <primitive object={recursos.flota.raiz} dispose={null} />
    </>
  );
}
function Escena() {
  const rigs = useRef(new Map<string, L.Rig>());
  const paleta = useMemo(() => L.paletaLuz(hora), []);
  const { camera } = useThree();
  useEffect(() => {
    const d = q.has('distancia') ? 15 : grupo ? 10 : mini ? 4 : 4.5;
    camera.position.set(mini ? 0 : origen.x, mini ? 1 : 1.65, (mini ? 0 : origen.z) + d);
    camera.lookAt(mini ? 0 : origen.x, 0.85, mini ? 0 : origen.z);
    camera.updateMatrixWorld();
  }, [camera]);
  return (
    <>
      <L.Luces paleta={paleta} sombras={false} puntuales={false} />
      {!mini && (
        <Dibujo
          escenario={e}
          variante={e.variantes[0]!}
          paleta={paleta}
          sombras={false}
          movimiento={0}
          rigs={rigs}
          ambiente={null}
          asistente={new Vector3(100, 0, 100)}
          escalaAsistente={0}
          sinCasa={false}
          contenidoPantallas={{}}
          onInteres={() => undefined}
        />
      )}
      {mini && (
        <>
          <color attach="background" args={['#303640']} />
          <ambientLight intensity={2.4} />
          <directionalLight position={[2, 3, 4]} intensity={3} />
        </>
      )}
      {grupo ? (
        Array.from({ length: 6 }, (_, i) => (
          <Modelo
            key={i}
            i={i}
            a={
              i === 2
                ? vestirFundador(base)
                : atuendoPorRol(['Backend', 'Community', 'Ventas', 'Diseño', 'Data'][i % 5]!, i)
            }
          />
        ))
      ) : (
        <Modelo
          i={0}
          a={{
            ...(conjunto
              ? aplicarConjunto(
                  { ...base, hair: catalogoBase.peinados[Math.max(0, indiceConjunto) % 5]!.id },
                  conjunto,
                )
              : vestirFundador(base)),
            ...(q.get('accesorio') ? { acc: [q.get('accesorio')!] } : {}),
          }}
        />
      )}
      {pose === 'sentado' && (
        <mesh position={[origen.x, 0.21, origen.z - 0.06]}>
          <boxGeometry args={[0.75, 0.42, 0.65]} />
          <meshStandardMaterial color="#63768b" />
        </mesh>
      )}
    </>
  );
}
createRoot(document.getElementById('raiz')!).render(
  q.has('objeto') || q.has('rendimiento') ? (
    <Muestras />
  ) : (
    <>
      <Canvas
        dpr={1}
        camera={{ fov: 35, near: 0.05, far: 200 }}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
      >
        <Escena />
      </Canvas>
      {!mini && (
        <div id="rotulo">
          Fundador · Ónix
          <small>
            {mundo} · {pose}
            {q.has('distancia') ? ' · 15 metros' : ''}
          </small>
        </div>
      )}
    </>
  ),
);
