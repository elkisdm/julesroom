# 0012 — Formato guardado de una sala

- **Estado:** Aceptado (2026-11-15)
- **Fecha:** 2026-11-14
- **Decisor:** Elkis

## Contexto

La persona arma su sala (plantilla, nombre, personaje, agentes) y la construye (objetos, pantallas, puestos, estilo). Hoy eso se guarda en el navegador; mañana irá a Postgres (ADR-0003) por organización. `DefinicionOficina` (versión 1) ya describe la oficina para el motor, pero no tiene lugar para el mundo construido. Lo que se guarde hoy tiene que poder cargarse cuando exista el servidor, sin perder salas.

## Decisión

Un documento `SalaGuardada` con **versión de formato 2**:

```ts
interface SalaGuardada extends Omit<DefinicionOficina, 'version'> {
  version: 2;
  equipo?: string; // nombre del equipo
  mundo: {
    variante?: string; // id de Escenario.variantes
    objetos: ObjetoColocado[]; // { id, tipo, x, z, giro (cuartos 0–3) }
    ajustesMuebles: Record<string, { x: number; z: number; giro: number } | 'quitado'>;
    pantallas: Record<string, ContenidoPantalla>; // id de Escenario.pantallas → qué muestra
    puestos: Record<string, string>; // id de ocupante → id de Lugar
  };
}
```

- La versión 1 se migra sola al cargar o importar (`migrarDefinicion`: `mundo` vacío).
- El motor sigue recibiendo `DefinicionOficina` v1 (`aDefinicion`): el formato guardado no obliga a cambiar el motor.
- Las coordenadas son las del escenario (metros, mismo eje que `planta`). Los objetos guardan su `tipo` del catálogo del editor, no geometría.
- Una versión mayor que la conocida se rechaza con un error legible (no se intenta adivinar).
- Límites como parámetros con valor inicial (`LIMITES_SALA`): 60 objetos, rejilla 0,5 m, 100 pasos de historia; luego se configuran desde el panel por organización (ADR-0009).
- En el navegador, `jules-room/salas/indice` contiene resúmenes `{ id, nombre, plantilla, ultimoUso, miniatura? }`, ordenados por último uso al leer. La miniatura opcional es una captura JPEG del mundo elegido, reutilizable después de recargar. Cada documento vive en `jules-room/salas/documentos/<id>` (id codificado); exportar e importar conservan el mismo JSON v2.
- La identidad pertenece a la biblioteca, no al documento intercambiable. `guardarSala` y `cargarSala` aceptan un id opcional; sin él actualizan/leen la última sala, conservando el contrato anterior. Crear otra sala asigna un UUID nuevo.
- Al primer acceso se migra `jules-room/sala/actual`, conservándolo como respaldo. Un índice presente, incluso vacío, impide repetir la migración. Si falta cuota se informa el fallo y el documento anterior sigue legible.
- La escritura del documento precede a la publicación del índice; si falla el índice, se restaura el documento anterior. Al eliminar, un fallo de borrado restaura el índice. No se afirma atomicidad entre pestañas o ante el cierre del proceso entre escrituras.
- `PARAMETROS_BIBLIOTECA` fija el valor inicial de 12 salas y 80 caracteres por nombre. El máximo se puede pasar a `guardarSala` por organización. Cuota llena o límite alcanzado producen un resultado legible sin expulsar otras salas.
- Renombrar preserva el último uso; eliminar necesita confirmación en la interfaz. Las fechas se presentan relativas a la duración transcurrida, sin conversiones de zona horaria.

## Consecuencias

- Lo que se guarde hoy entra tal cual a una columna `jsonb` de `oficinas` cuando exista el servidor; la versión dice cómo leerlo.
- Mover muebles de la plantilla depende de ids estables del escenario (acordado con oficina-escenarios). Si un id deja de existir, su ajuste se ignora y se avisa al cargar.
- Cambiar de plantilla con objetos colocados: los objetos fuera de la nueva planta se descartan con aviso.
- Volver a mirar si el mundo crece a paredes o plantas libres: ahí el documento necesitaría su propia geometría.

## Respaldo

`knowledge/adr/0012-donde-vive-cada-configuracion.md` (valores iniciales parametrizables) y criterio general (documentos versionados con migración al leer).

## Alternativas consideradas (biblioteca, 2026-11-15)

Un único JSON con todas las salas simplifica la escritura atómica, pero reescribe todos los mundos al mover un objeto y aumenta el costo de cada autoguardado. Se elige índice más documentos separados, con compensación de escrituras fallidas y respaldo de migración. IndexedDB permitiría transacciones reales entre documentos, a costa de cambiar el contrato síncrono actual; se difiere hasta necesitar concurrencia entre pestañas.
