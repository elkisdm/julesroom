export type {
  Actividad,
  AgenteOficina,
  Atuendo,
  AtuendoResuelto,
  Catalogo,
  Departamento,
  Disfraz,
  EstadoAgente,
  MetricasRender,
  Opcion,
  PaqueteSkins,
  Pieza,
  Zona,
} from './tipos';
export { catalogoBase } from './catalogo/base';
export { paqueteFiestasPatrias } from './catalogo/fiestas-patrias';
export { paqueteHalloween } from './catalogo/halloween';
export { paqueteNavidad } from './catalogo/navidad';
export { crearCatalogo, registrarPaquete } from './catalogo/registro';
export { alternarPieza, aplicarSkin, resolverAtuendo } from './vestuario/resolver';
export { atuendoPorRol, rolesConocidos } from './vestuario/roles';
export { horaChile, luzDelDia } from './ambiente/hora';
export type { PresenciaAsistente } from './animacion/presencia';
export { frameloopPara } from './rendimiento/visibilidad';
export { estadisticasGrafica } from './render/estadisticas';
export { TECNICAS_POR_NIVEL, tecnicasDe } from './rendimiento/tecnicas';
export type { Tecnicas } from './rendimiento/tecnicas';
export { CONFIG_AJUSTE_INICIAL } from './rendimiento/ajuste';
export type { ConfigAjuste } from './rendimiento/ajuste';
export { plano } from './mansion/plano';
export type { Ambiente } from './mansion/plano';
export { escenarioMansion } from './escenarios/mansion';
// La sala de trading y la oficina se registran al importarse (escenario y dibujo); se importa aquí, y no desde
// `escenarios/registro.ts`, porque el módulo del escenario importa el registro (se formaría un ciclo).
export { escenarioTrading } from './escenarios/trading';
import './render/escenarios/trading/DibujoTrading';
export { escenarioAuditorio } from './escenarios/auditorio';
import './render/escenarios/auditorio/DibujoAuditorio';
export { escenarioOficina } from './escenarios/oficina';
import './render/escenarios/oficina/DibujoOficina';
export {
  escenarioPorId,
  hayEscenario,
  listarEscenarios,
  registrarEscenario,
} from './escenarios/registro';
export { crearRutasPlanta } from './escenarios/rutasPlanta';
export { puntoDeReunion } from './escenarios/reuniones';
export type { PuntoDeReunion } from './escenarios/reuniones';
export {
  alturaEn,
  alturaPie,
  CARA_ASIENTO,
  crearSuelo,
  PARAMETROS_SUELO,
  puntoEnSuelo,
  sePisa,
  SIN_SUELO,
  sueloDe,
  sueloPlano,
  superficieBajo,
  superficiesDeMuebles,
} from './escenarios/suelo';
export type { Suelo } from './escenarios/suelo';
export {
  aplicarAjustes,
  conSueloExtra,
  PARAMETROS_PERSONALIZACION,
  piezasMovibles,
  TIPOS_FIJOS,
} from './escenarios/personalizacion';
export type {
  AjusteMueble,
  AjustesMuebles,
  ErrorAjuste,
  PiezaMovible,
} from './escenarios/personalizacion';
export type {
  Accion,
  AccionAbrir,
  AccionHablar,
  AccionBase,
  AccionSentarse,
  AmbienteEscenario,
  AsientoAccion,
  Caja3,
  ContenidoPantalla,
  DatosSuelo,
  Entrada,
  Escenario,
  Interes,
  Mueble,
  PaletaVariante,
  Pantalla,
  Planta,
  Reunion,
  Rutas,
  Solido,
  Superficie,
  SuperficiePlana,
  SuperficieRampa,
  SuperficieSector,
  TipoAccion,
  TipoSuperficie,
  TipoZona,
  VarianteEscenario,
  VistaZona,
  Vistas,
  ZonaEscenario,
} from './escenarios/tipos';
export { registrarDibujo } from './render/escenarios/registroDibujo';
export type { PropsDibujo } from './render/escenarios/registroDibujo';
export { useEscenario } from './render/escenarios/contexto';
export { departamentosBase } from './render/layout';
export { Oficina } from './render/Oficina';
export * as laboratorio from './laboratorio';
export type { OficinaProps, Proyector, PuntoPantalla, PosicionAgente } from './render/Oficina';
export type { AvatarPropio } from './render/Personas';
export type { VistaOficina } from './render/ControlesCamara';
export { encuadreGeneral } from './render/camara';
export type { Encuadre } from './render/camara';
export { apagarTodo, encenderTodo, fijarOpciones, OPCIONES } from './animacion/opciones';
export type { OpcionesMovimiento } from './animacion/opciones';
export { crearMando, fijarDestino } from './animacion/avatar';
export type { Mando } from './animacion/avatar';
export { accionCercana, accionesDe, ETIQUETA_ACCION } from './escenarios/acciones';
export { crearMedidor, estadisticas, medidoresAnimacion } from './animacion/medicion';
export type { EstadisticasMedidor, Medidor } from './animacion/medicion';
export type { FuentePresencia, PersonaPresente } from './presencia/tipos';
export { crearFuenteSimulada, LIMITES_SIMULADOS, puntoLibreEn } from './presencia/simulada';
export {
  ACTIVO_MERCADO_GENERICO,
  dibujarMercadoPantalla,
} from './render/escenarios/trading/lienzoMercado';
export type { AltaPersona, FuenteSimulada, OpcionesSimulada } from './presencia/simulada';
export {
  CALIDADES,
  definicionAProps,
  ejemploEquipo,
  ejemploEstudio,
  parsearDefinicion,
  serializarDefinicion,
  validarDefinicion,
} from './definicion/definicion';
export type {
  DefinicionOficina,
  Ocupante,
  OcupanteAgente,
  OcupantePersona,
  PersonaDefinida,
  PropsDeDefinicion,
  TemaOficina,
} from './definicion/definicion';
export * from './editor';

export type { Punto3 } from './render/camara';
export type { GestoAgente } from './render/animador';

// Composición de escenas auxiliares en el mismo renderer del motor.
export { FOV_VERTICAL } from './render/camara';
export { dibujoDe } from './render/escenarios/registroDibujo';
export { ContextoEscenario } from './render/escenarios/contexto';
export { Luces } from './render/Luces';
export { paletaLuz } from './render/casa/luz';
export type { RGB } from './render/casa/luz';
export { encenderLed } from './render/casa/materiales';
export { paletaConVariante } from './render/variante';
export { ajusteIdle, ajusteNeutro } from './animacion/idle';
export { useReduceMotion } from './render/preferencias';
export type { Rig } from './render/animador';

// Palanca táctil del avatar (zona muerta y curva).
export { escribirPalanca, PARAMETROS_PALANCA } from './render/entradaAvatar';

export {
  conectarSuspensionControles,
  controlesSuspendidos,
  crearSuspensionControles,
  suspenderControlesCamara,
} from './render/suspensionControles';

export { PantallaPresentacion } from './render/PantallaPresentacion';
export type { PantallaPresentacionProps } from './render/PantallaPresentacion';
export { espacioD2 } from './render/espacioD2';
export { COLORES_D2, fijarMarcasD2 } from './render/MarcasD2';
export { saludarD2 } from './render/reaccionD2';
export { CONJUNTOS, COLECCIONES, TOPS_NUEVOS, aplicarConjunto } from './catalogo/colecciones';
export type { Conjunto } from './catalogo/colecciones';

export { OBJETOS_NUEVOS, PIEZAS_NUEVAS } from './editor/ampliacion';
export type { ParteCatalogo } from './editor/ampliacion';

export { ESTILOS_CATALOGO, variantesConCatalogo } from './escenarios/estilosCatalogo';
export { resolverVariante } from './escenarios/variantes';
export { posarSentado } from './render/poseSentada';
export { calcularPose, crearPose } from './animacion/articulaciones';
export type { ControlAsistenteLocal } from './render/Asistente';
export { PARAMETROS_ASISTENTE } from './render/asistente/seguimiento';
export { avanzarSeguimiento } from './render/asistente/seguimiento';
export { crearMapaDeSuelo } from './animacion/colision';
export { crearNavegacion } from './animacion/navegacion';
export { crearSeguimiento } from './render/asistente/seguimiento';
export { lineaLibre } from './animacion/colision';
export { puntoLibre } from './animacion/colision';
export { PizarraMundo } from './render/PizarraMundo';
export type { PizarraMundoProps } from './render/PizarraMundo';
// Momentos de grupo: captura a destino temporal y efectos instanciados.
export { CapturaMomento } from './render/CapturaMomento';
export type { SolicitudFoto } from './render/CapturaMomento';
export { EfectosMomento } from './render/EfectosMomento';
