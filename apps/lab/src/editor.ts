import {
  alternarPieza,
  aplicarSkin,
  atuendoPorRol,
  catalogoBase,
  crearCatalogo,
  paqueteFiestasPatrias,
  paqueteHalloween,
  paqueteNavidad,
  registrarPaquete,
  resolverAtuendo,
  rolesConocidos,
} from '@oficina/motor';
import type {
  Atuendo,
  Catalogo,
  DefinicionOficina,
  Ocupante,
  OcupanteAgente,
  PaqueteSkins,
} from '@oficina/motor';

/** Paquetes de skins que existen en el motor; la definición elige cuáles usa (`tema.paquetes`). */
export const PAQUETES: readonly PaqueteSkins[] = [
  paqueteHalloween,
  paqueteNavidad,
  paqueteFiestasPatrias,
];

/** El catálogo de una oficina: el base más los paquetes que su tema declara. */
export function catalogoDe(d: DefinicionOficina): Catalogo {
  let catalogo = crearCatalogo(catalogoBase);
  for (const id of d.tema.paquetes ?? []) {
    const paquete = PAQUETES.find((p) => p.id === id);
    if (paquete) catalogo = registrarPaquete(catalogo, paquete);
  }
  return catalogo;
}

const mapear = (d: DefinicionOficina, id: string, f: (a: OcupanteAgente) => Ocupante) => ({
  ...d,
  ocupantes: d.ocupantes.map((o) => (o.id === id && o.tipo === 'agente' ? f(o) : o)),
});

const indiceAgente = (d: DefinicionOficina, id: string) =>
  Math.max(
    0,
    d.ocupantes.filter((o) => o.tipo === 'agente').findIndex((o) => o.id === id),
  );

function idLibre(d: DefinicionOficina): { id: string; n: number } {
  const usados = new Set(d.ocupantes.map((o) => o.id));
  let n = d.ocupantes.length + 1;
  while (usados.has(`ag-${n}`)) n++;
  return { id: `ag-${n}`, n };
}

/** Suma un agente nuevo (rol rotativo, primer departamento) con el atuendo de su rol. */
export function agregarAgente(d: DefinicionOficina): DefinicionOficina {
  const { id } = idLibre(d);
  const agentes = d.ocupantes.filter((o) => o.tipo === 'agente').length;
  const rol = rolesConocidos[agentes % rolesConocidos.length] ?? 'QA';
  const nuevo: OcupanteAgente = {
    tipo: 'agente',
    id,
    nombre: `Agente ${agentes + 1}`,
    rol,
    departamento: d.departamentos[0]?.id ?? '',
    estado: 'trabajando',
    atuendo: atuendoPorRol(rol, agentes),
  };
  return { ...d, ocupantes: [...d.ocupantes, nuevo] };
}

export const quitarOcupante = (d: DefinicionOficina, id: string): DefinicionOficina => ({
  ...d,
  ocupantes: d.ocupantes.filter((o) => o.id !== id),
});

export const renombrar = (d: DefinicionOficina, id: string, nombre: string): DefinicionOficina =>
  mapear(d, id, (a) => ({ ...a, nombre }));

/** Cambia el rol y reinicia el atuendo al del rol nuevo. */
export const cambiarRol = (d: DefinicionOficina, id: string, rol: string): DefinicionOficina =>
  mapear(d, id, (a) => ({ ...a, rol, atuendo: atuendoPorRol(rol, indiceAgente(d, id)) }));

export function cambiarDepartamento(
  d: DefinicionOficina,
  id: string,
  departamento: string,
): DefinicionOficina {
  if (!d.departamentos.some((x) => x.id === departamento)) return d;
  return mapear(d, id, (a) => ({ ...a, departamento }));
}

const atuendoActual = (d: DefinicionOficina, a: OcupanteAgente): Atuendo =>
  a.atuendo ?? atuendoPorRol(a.rol, indiceAgente(d, a.id));

export const cambiarAtuendo = (
  d: DefinicionOficina,
  id: string,
  parche: Partial<Atuendo>,
  catalogo: Catalogo,
): DefinicionOficina =>
  mapear(d, id, (a) => {
    const { ocultas, ...atuendo } = resolverAtuendo(
      catalogo,
      aplicarSkin(catalogo, atuendoActual(d, a), parche),
    );
    void ocultas;
    return { ...a, atuendo };
  });

/** Equipa o quita una pieza; un id que el catálogo no tiene no cambia nada. */
export function alternarAccesorio(
  d: DefinicionOficina,
  id: string,
  pieza: string,
  catalogo: Catalogo,
): DefinicionOficina {
  if (!catalogo.piezas.some((p) => p.id === pieza)) return d;
  return mapear(d, id, (a) => ({
    ...a,
    atuendo: alternarPieza(catalogo, atuendoActual(d, a), pieza),
  }));
}

/** Activa o desactiva un paquete de skins en el tema. Un paquete desconocido no cambia nada. */
export function alternarPaquete(d: DefinicionOficina, id: string): DefinicionOficina {
  if (!PAQUETES.some((p) => p.id === id)) return d;
  const actuales = d.tema.paquetes ?? [];
  const paquetes = actuales.includes(id) ? actuales.filter((p) => p !== id) : [...actuales, id];
  return { ...d, tema: { ...d.tema, paquetes } };
}
