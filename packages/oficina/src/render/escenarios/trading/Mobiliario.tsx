import { useMemo } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { Color, MeshBasicMaterial } from 'three';
import {
  AULA,
  BARRA,
  centroEquipo,
  DESCANSO,
  EQUIPOS,
  ESPERA,
  FILA_AGENTES,
  FILA_FRENTE,
  MESA_ALTO,
  MESA_PUESTO,
  MESA_RADIO,
  MESAS,
  PRIVADO,
  PUESTOS_X,
  PUFS,
  QUIOSCO,
  REPISA,
  SILLAS_DX,
} from '../../../escenarios/trading/plano';
import { COLOR_EQUIPO } from './Arquitectura';
import { Instancias } from './Instancias';
import type { Item } from './Instancias';
import { useLienzo } from './lienzo';
import { celdaAtlas, geometriaQuads, quadTocado } from './quads';
import type { Quad } from './quads';
import { useRecursos } from './recursos';
import {
  ATLAS_LETRERO,
  ATLAS_MONITOR,
  dibujarAtlasLetreros,
  dibujarAtlasMonitores,
} from './texturas';

const ALTO_MESA = MESA_PUESTO.alto;
/** Monitores: los de la fila de agentes miran a la cámara; los del frente, bajos para no tapar caras. */
const MONITOR_AGENTE = { ancho: 0.78, alto: 0.46, y: 1.12 };
const MONITOR_FRENTE = { ancho: 0.62, alto: 0.36, y: 0.99 };
const LETRERO = { ancho: 2.3, alto: 0.56, y: 1.98, z: FILA_AGENTES.mesaZ - 0.55 };
const BRILLO = new Color('#ffffff').multiplyScalar(1.08);

interface PropsBancos {
  /** Clic en un puesto de la fila de agentes (desde 0). */
  alTocarPuesto: (n: number) => void;
}

/**
 * Los dos bancos de puestos, espalda con espalda: la fila de agentes con tres monitores por puesto
 * mirando al muro de datos (y su letrero colgante), y la del frente con dos monitores bajos, mirando
 * a la cámara. Sobre cada equipo, su lámpara lineal de latón con la luz de su color.
 */
export function Bancos({ alTocarPuesto }: PropsBancos) {
  const { mat, geo, guardar } = useRecursos();
  const atlasMonitores = useLienzo(
    ATLAS_MONITOR.columnas * ATLAS_MONITOR.celda.w,
    ATLAS_MONITOR.filas * ATLAS_MONITOR.celda.h,
    dibujarAtlasMonitores,
  );
  const atlasLetreros = useLienzo(
    ATLAS_LETRERO.columnas * ATLAS_LETRERO.celda.w,
    ATLAS_LETRERO.filas * ATLAS_LETRERO.celda.h,
    dibujarAtlasLetreros,
  );

  const piezas = useMemo(() => {
    const cubiertas: Item[] = [];
    const cantos: Item[] = [];
    const costados: Item[] = [];
    const biseles: Item[] = [];
    const brazos: Item[] = [];
    const teclados: Item[] = [];
    const asientos: Item[] = [];
    const respaldos: Item[] = [];
    const bases: Item[] = [];
    const lamparitas: Item[] = [];
    const monitores: Quad[] = [];
    let celda = 0;
    for (const [fila, f, cantidad, mon] of [
      ['a', FILA_AGENTES, 3, MONITOR_AGENTE],
      ['b', FILA_FRENTE, 2, MONITOR_FRENTE],
    ] as const) {
      // Hacia dónde mira quien se sienta: −z en la fila de agentes, +z en la del frente.
      const s = fila === 'a' ? -1 : 1;
      for (const cx of PUESTOS_X) {
        cubiertas.push({
          p: [cx, ALTO_MESA, f.mesaZ],
          e: [MESA_PUESTO.ancho, 0.05, MESA_PUESTO.fondo],
        });
        cantos.push({
          p: [cx, ALTO_MESA - 0.01, f.mesaZ - s * (MESA_PUESTO.fondo / 2)],
          e: [MESA_PUESTO.ancho, 0.035, 0.03],
        });
        for (const dx of [-MESA_PUESTO.ancho / 2 + 0.05, MESA_PUESTO.ancho / 2 - 0.05])
          costados.push({
            p: [cx + dx, ALTO_MESA / 2, f.mesaZ],
            e: [0.05, ALTO_MESA, MESA_PUESTO.fondo - 0.08],
          });
        // Panel de modestia: tapa las piernas desde el lado opuesto a quien se sienta.
        costados.push({
          p: [cx, 0.42, f.mesaZ + s * (MESA_PUESTO.fondo / 2 - 0.04)],
          e: [MESA_PUESTO.ancho - 0.1, 0.6, 0.03],
        });
        const zMon = f.mesaZ + s * 0.24;
        const xs = cantidad === 3 ? [-0.84, 0, 0.84] : [...SILLAS_DX];
        xs.forEach((dx, k) => {
          const giro = fila === 'a' ? -dx * 0.32 : Math.PI;
          const zz = zMon + (cantidad === 3 && k !== 1 ? -s * 0.1 : 0);
          monitores.push({
            x: cx + dx,
            y: mon.y,
            z: zz,
            ancho: mon.ancho,
            alto: mon.alto,
            giro,
            inclinacion: -0.06,
            uv: celdaAtlas(celda++, ATLAS_MONITOR.columnas, ATLAS_MONITOR.filas),
          });
          biseles.push({
            p: [cx + dx, mon.y, zz + s * 0.025],
            e: [mon.ancho + 0.05, mon.alto + 0.05, 0.035],
            r: giro,
          });
          brazos.push({
            p: [cx + dx, (ALTO_MESA + mon.y) / 2, zz + s * 0.07],
            e: [0.05, mon.y - ALTO_MESA, 0.05],
          });
        });
        for (const dx of SILLAS_DX) {
          const x = cx + dx;
          teclados.push({ p: [x, ALTO_MESA + 0.03, f.mesaZ - s * 0.22], e: [0.44, 0.02, 0.14] });
          const z = f.sillaZ;
          asientos.push({ p: [x, 0.47, z], e: [0.5, 0.08, 0.48] });
          respaldos.push({ p: [x, 0.84, z - s * 0.26], e: [0.46, 0.58, 0.06], rx: s * 0.1 });
          bases.push({ p: [x, 0.23, z], e: [0.06, 0.46, 0.06] });
          bases.push({ p: [x, 0.03, z], e: [0.54, 0.05, 0.54] });
        }
        lamparitas.push({
          p: [cx + 1.25, ALTO_MESA + 0.32, f.mesaZ + s * 0.3],
          e: [0.16, 0.08, 0.16],
        });
      }
    }

    // Letreros colgantes sobre los puestos de agentes.
    const letreros: Quad[] = PUESTOS_X.map((x, n) => ({
      x,
      y: LETRERO.y,
      z: LETRERO.z,
      ancho: LETRERO.ancho,
      alto: LETRERO.alto,
      giro: 0,
      inclinacion: -0.12,
      uv: celdaAtlas(n, ATLAS_LETRERO.columnas, ATLAS_LETRERO.filas),
    }));
    const cables: Item[] = PUESTOS_X.flatMap((x): Item[] =>
      [-1.1, 1.1].map((dx) => ({
        p: [x + dx, (LETRERO.y + 5.4) / 2, LETRERO.z],
        e: [0.01, 5.4 - LETRERO.y, 0.01],
      })),
    );

    // Lámpara lineal de cada equipo: carcasa de latón sobre el pasillo, tira de luz de su color.
    const carcasas: Item[] = [];
    const tiras: Item[][] = [];
    for (let k = 1; k <= EQUIPOS; k++) {
      const x = centroEquipo(k);
      const y = 3.35;
      carcasas.push({ p: [x, y, -6.48], e: [5.4, 0.1, 0.3] });
      tiras.push([{ p: [x, y - 0.06, -6.48], e: [5.2, 0.02, 0.18] }]);
      for (const dx of [-2.4, 2.4])
        cables.push({ p: [x + dx, (y + 5.4) / 2, -6.48], e: [0.01, 5.4 - y, 0.01] });
    }
    return {
      cubiertas,
      cantos,
      costados,
      biseles,
      brazos,
      teclados,
      asientos,
      respaldos,
      bases,
      lamparitas,
      monitores,
      letreros,
      cables,
      carcasas,
      tiras,
    };
  }, []);

  const mallas = useMemo(
    () => ({
      monitores: guardar(geometriaQuads(piezas.monitores)),
      letreros: guardar(geometriaQuads(piezas.letreros)),
      matMonitores: guardar(
        new MeshBasicMaterial({ map: atlasMonitores, color: BRILLO, toneMapped: false }),
      ),
      matLetreros: guardar(
        new MeshBasicMaterial({
          map: atlasLetreros,
          color: BRILLO,
          toneMapped: false,
          transparent: true,
        }),
      ),
      tiras: COLOR_EQUIPO.map((c) =>
        guardar(
          new MeshBasicMaterial({ color: new Color(c).multiplyScalar(2.4), toneMapped: false }),
        ),
      ),
    }),
    [piezas, atlasMonitores, atlasLetreros, guardar],
  );
  const tocarLetrero = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6 || e.faceIndex === undefined || e.faceIndex === null) return;
    e.stopPropagation();
    alTocarPuesto(quadTocado(e.faceIndex));
  };
  const filaA = piezas.cubiertas.slice(0, PUESTOS_X.length);
  return (
    <>
      <Instancias items={filaA} geometria={geo.caja} material={mat.nogal} alTocar={alTocarPuesto} />
      <Instancias
        items={piezas.cubiertas.slice(PUESTOS_X.length)}
        geometria={geo.caja}
        material={mat.nogal}
      />
      <Instancias items={piezas.cantos} geometria={geo.caja} material={mat.laton} />
      <Instancias items={piezas.costados} geometria={geo.caja} material={mat.metal} />
      <Instancias items={piezas.biseles} geometria={geo.caja} material={mat.bisel} />
      <Instancias items={piezas.brazos} geometria={geo.caja} material={mat.metalClaro} />
      <Instancias items={piezas.teclados} geometria={geo.caja} material={mat.bisel} />
      <Instancias items={piezas.asientos} geometria={geo.caja} material={mat.tela} />
      <Instancias items={piezas.respaldos} geometria={geo.caja} material={mat.tela} />
      <Instancias items={piezas.bases} geometria={geo.cilindroBajo} material={mat.metal} />
      <Instancias items={piezas.lamparitas} geometria={geo.cilindro} material={mat.luzCalida} />
      <Instancias items={piezas.cables} geometria={geo.caja} material={mat.metal} />
      <Instancias items={piezas.carcasas} geometria={geo.caja} material={mat.laton} />
      {piezas.tiras.map((t, i) => (
        <Instancias key={i} items={t} geometria={geo.caja} material={mallas.tiras[i]!} />
      ))}
      <mesh geometry={mallas.monitores} material={mallas.matMonitores} />
      <mesh
        geometry={mallas.letreros}
        material={mallas.matLetreros}
        onClick={tocarLetrero}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
      />
    </>
  );
}

/** El aula-cine: tarima con atril, graderío con tres filas de butacas y la luz del escalón. */
export function Aula() {
  const { mat, geo } = useRecursos();
  const piezas = useMemo(() => {
    const t = AULA.tarima;
    const tarima: Item[] = [
      {
        p: [(t.x0 + t.x1) / 2, t.alto / 2, (t.z0 + t.z1) / 2],
        e: [t.x1 - t.x0, t.alto, t.z1 - t.z0],
      },
    ];
    const ancho = AULA.gradas.x1 - AULA.gradas.x0;
    const cx = (AULA.gradas.x0 + AULA.gradas.x1) / 2;
    const gradas: Item[] = AULA.filas
      .slice(1)
      .map((f) => ({ p: [cx, f.y / 2, f.z + 0.1], e: [ancho, f.y, 1.6] }));
    const asientos: Item[] = [];
    const respaldos: Item[] = [];
    const brazos: Item[] = [];
    for (const f of AULA.filas)
      for (const x of AULA.butacasX) {
        asientos.push({ p: [x, f.y + 0.44, f.z], e: [0.62, 0.14, 0.58] });
        respaldos.push({ p: [x, f.y + 0.78, f.z + 0.29], e: [0.62, 0.68, 0.12], rx: 0.12 });
        for (const dx of [-0.35, 0.35])
          brazos.push({ p: [x + dx, f.y + 0.5, f.z], e: [0.07, 0.48, 0.6] });
      }
    const atril: Item[] = [{ p: [AULA.atril.x, t.alto + 0.55, AULA.atril.z], e: [0.6, 1.1, 0.45] }];
    const luzEscalon: Item[] = [
      { p: [(t.x0 + t.x1) / 2, 0.06, t.z1 + 0.01], e: [t.x1 - t.x0 - 0.2, 0.025, 0.02] },
      ...AULA.filas
        .slice(1)
        .map((f): Item => ({ p: [cx, f.y - 0.04, f.z - 0.71], e: [ancho - 0.2, 0.02, 0.02] })),
    ];
    return { tarima, gradas, asientos, respaldos, brazos, atril, luzEscalon };
  }, []);
  return (
    <>
      <Instancias items={piezas.tarima} geometria={geo.caja} material={mat.nogalPanel} />
      <Instancias items={piezas.gradas} geometria={geo.caja} material={mat.alfombraAula} />
      <Instancias items={piezas.asientos} geometria={geo.caja} material={mat.butaca} />
      <Instancias items={piezas.respaldos} geometria={geo.caja} material={mat.butaca} />
      <Instancias items={piezas.brazos} geometria={geo.caja} material={mat.metal} />
      <Instancias items={piezas.atril} geometria={geo.caja} material={mat.nogal} />
      <Instancias items={piezas.luzEscalon} geometria={geo.caja} material={mat.luzTenue} />
    </>
  );
}

/** Mesas altas por mercado: cubierta de piedra con canto de latón sobre un pie de metal. */
export function Mesas({ alTocar }: { alTocar: (indice: number) => void }) {
  const { mat, geo } = useRecursos();
  const piezas = useMemo(() => {
    const cubiertas: Item[] = MESAS.map((m) => ({
      p: [m.x, MESA_ALTO, m.z],
      e: [MESA_RADIO * 2, 0.06, MESA_RADIO * 2],
    }));
    const cantos: Item[] = MESAS.map((m) => ({
      p: [m.x, MESA_ALTO - 0.04, m.z],
      e: [MESA_RADIO * 2 + 0.04, 0.03, MESA_RADIO * 2 + 0.04],
    }));
    const pies: Item[] = MESAS.flatMap((m): Item[] => [
      { p: [m.x, MESA_ALTO / 2, m.z], e: [0.22, MESA_ALTO, 0.22] },
      { p: [m.x, 0.025, m.z], e: [0.9, 0.05, 0.9] },
    ]);
    const soportes: Item[] = MESAS.map((m) => ({
      p: [m.x, MESA_ALTO + 0.15, m.z - 0.42],
      e: [0.08, 0.3, 0.08],
    }));
    return { cubiertas, cantos, pies, soportes };
  }, []);
  return (
    <>
      <Instancias
        items={piezas.cubiertas}
        geometria={geo.cilindro}
        material={mat.piedra}
        alTocar={alTocar}
      />
      <Instancias items={piezas.cantos} geometria={geo.cilindro} material={mat.laton} />
      <Instancias items={piezas.pies} geometria={geo.cilindro} material={mat.metal} />
      <Instancias items={piezas.soportes} geometria={geo.caja} material={mat.metal} />
    </>
  );
}

/** Sala privada (sillones y mesa), videoteca (quiosco y pufs), barra de café y descanso. */
export function Estar() {
  const { mat, geo } = useRecursos();
  const piezas = useMemo(() => {
    const cuero: Item[] = [];
    const nogal: Item[] = [];
    const piedra: Item[] = [];
    const tinta: Item[] = [];
    const laton: Item[] = [];
    const tela: Item[] = [];
    const botellas: Item[] = [];
    // Sillones de la sala privada: asiento y respaldo hacia el muro de atrás de cada uno.
    for (const s of [...PRIVADO.sillones, ...ESPERA.sillones]) {
      const lado = Math.sign(Math.sin(s.giro));
      cuero.push({ p: [s.x, 0.24, s.z], e: [1, 0.44, 1] });
      cuero.push({ p: [s.x - lado * 0.42, 0.62, s.z], e: [0.16, 0.8, 1] });
    }
    nogal.push({ p: [PRIVADO.mesa.x, 0.21, PRIVADO.mesa.z], e: [1.6, 0.42, 0.8] });
    nogal.push({ p: [ESPERA.mesa.x, 0.2, ESPERA.mesa.z], e: [0.6, 0.4, 1] });
    // Quiosco y pufs.
    tinta.push({
      p: [QUIOSCO.x, QUIOSCO.alto / 2, QUIOSCO.z],
      e: [QUIOSCO.ancho, QUIOSCO.alto, QUIOSCO.fondo],
    });
    laton.push({
      p: [QUIOSCO.x, QUIOSCO.alto + 0.02, QUIOSCO.z],
      e: [QUIOSCO.ancho + 0.04, 0.04, QUIOSCO.fondo + 0.04],
    });
    for (let i = 0; i < 3; i++)
      tela.push({
        p: [PUFS.x - PUFS.ancho / 3 + (i * PUFS.ancho) / 3, 0.22, PUFS.z],
        e: [PUFS.ancho / 3 - 0.08, 0.44, PUFS.fondo],
      });
    // Barra: mueble de nogal, cubierta de piedra, apoyapiés de latón; repisa con botellas encendidas.
    const bz = (BARRA.z0 + BARRA.z1) / 2;
    const largo = BARRA.z1 - BARRA.z0;
    nogal.push({
      p: [(BARRA.x0 + BARRA.x1) / 2, BARRA.alto / 2, bz],
      e: [BARRA.x1 - BARRA.x0, BARRA.alto, largo],
    });
    piedra.push({
      p: [(BARRA.x0 + BARRA.x1) / 2 - 0.05, BARRA.alto + 0.03, bz],
      e: [BARRA.x1 - BARRA.x0 + 0.2, 0.06, largo + 0.1],
    });
    laton.push({ p: [BARRA.x0 - 0.12, 0.2, bz], e: [0.04, 0.04, largo - 0.2] });
    const rz = (REPISA.z0 + REPISA.z1) / 2;
    tinta.push({
      p: [(REPISA.x0 + REPISA.x1) / 2, REPISA.alto / 2, rz],
      e: [REPISA.x1 - REPISA.x0, REPISA.alto, REPISA.z1 - REPISA.z0],
    });
    for (const y of [1.2, 1.7, 2.2]) {
      laton.push({ p: [REPISA.x0 - 0.02, y - 0.06, rz], e: [0.04, 0.03, REPISA.z1 - REPISA.z0] });
      for (let z = REPISA.z0 + 0.25; z < REPISA.z1 - 0.2; z += 0.32)
        botellas.push({
          p: [REPISA.x0 + 0.12, y + 0.08, z + ((y * 7) % 0.1)],
          e: [0.08, 0.24, 0.08],
        });
    }
    // Descanso: sofá de tela con respaldo contra el muro, mesa baja, mesa alta y taburetes.
    const sofa = DESCANSO.sofa;
    tela.push({ p: [sofa.x - 0.05, 0.22, sofa.z], e: [sofa.fondo - 0.1, 0.44, sofa.ancho] });
    tela.push({ p: [sofa.x + sofa.fondo / 2 - 0.12, 0.6, sofa.z], e: [0.22, 0.72, sofa.ancho] });
    nogal.push({
      p: [DESCANSO.mesaBaja.x, 0.2, DESCANSO.mesaBaja.z],
      e: [DESCANSO.mesaBaja.fondo, 0.4, DESCANSO.mesaBaja.ancho],
    });
    // Retroiluminación de la barra: cintas cálidas bajo cada repisa y en el canto bajo la cubierta.
    const cintas: Item[] = [1.2, 1.7, 2.2].map((y) => ({
      p: [REPISA.x0 - 0.03, y - 0.1, rz],
      e: [0.02, 0.025, REPISA.z1 - REPISA.z0 - 0.1],
    }));
    cintas.push({
      p: [BARRA.x0 - 0.01, BARRA.alto - 0.08, bz],
      e: [0.02, 0.03, largo - 0.1],
    });
    return { cuero, nogal, piedra, tinta, laton, tela, botellas, cintas };
  }, []);
  // Lámparas colgantes cálidas sobre el descanso, la barra y la espera: el costado derecho no queda a oscuras.
  const colgantes = useMemo<Item[]>(
    () =>
      [
        [DESCANSO.mesaAlta.x, DESCANSO.mesaAlta.z],
        [14.8, 1.8],
        [14.8, 5.2],
        [ESPERA.mesa.x, ESPERA.mesa.z],
      ].map(([x, z]) => ({ p: [x!, 3.1, z!], e: [0.5, 0.08, 0.5] })),
    [],
  );
  const redondas = useMemo(() => {
    const cubiertas: Item[] = [
      { p: [DESCANSO.mesaAlta.x, 1.05, DESCANSO.mesaAlta.z], e: [0.9, 0.05, 0.9] },
    ];
    const asientos: Item[] = DESCANSO.taburetes.map((t) => ({
      p: [t.x, 0.75, t.z],
      e: [0.4, 0.06, 0.4],
    }));
    const pies: Item[] = [
      { p: [DESCANSO.mesaAlta.x, 0.52, DESCANSO.mesaAlta.z], e: [0.1, 1.04, 0.1] },
      ...DESCANSO.taburetes.map((t): Item => ({ p: [t.x, 0.37, t.z], e: [0.05, 0.74, 0.05] })),
    ];
    return { cubiertas, asientos, pies };
  }, []);
  return (
    <>
      <Instancias items={piezas.cuero} geometria={geo.caja} material={mat.cuero} />
      <Instancias items={piezas.nogal} geometria={geo.caja} material={mat.nogal} />
      <Instancias items={piezas.piedra} geometria={geo.caja} material={mat.piedra} />
      <Instancias items={piezas.tinta} geometria={geo.caja} material={mat.tinta} />
      <Instancias items={piezas.laton} geometria={geo.caja} material={mat.laton} />
      <Instancias items={piezas.tela} geometria={geo.caja} material={mat.tela} />
      <Instancias items={piezas.cintas} geometria={geo.caja} material={mat.luzCalida} />
      <Instancias items={colgantes} geometria={geo.cilindro} material={mat.luzCalida} />
      <Instancias items={piezas.botellas} geometria={geo.cilindroBajo} material={mat.botellas} />
      <Instancias items={redondas.cubiertas} geometria={geo.cilindro} material={mat.piedra} />
      <Instancias items={redondas.asientos} geometria={geo.cilindro} material={mat.cuero} />
      <Instancias items={redondas.pies} geometria={geo.cilindroBajo} material={mat.laton} />
    </>
  );
}
