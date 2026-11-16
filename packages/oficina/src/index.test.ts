import { describe, expect, expectTypeOf, it } from 'vitest';
import * as oficina from './index';
import type {
  AccionHablar,
  GestoAgente,
  OficinaProps,
  PosicionAgente,
  Proyector,
  Punto3,
} from './index';
import { dibujoDe } from './render/escenarios/registroDibujo';

describe('@oficina/motor', () => {
  it('exporta los contratos de posición, mirada, gesto y conversación', () => {
    expectTypeOf<Proyector['mundo']>().returns.toEqualTypeOf<PosicionAgente | null>();
    expectTypeOf<PosicionAgente>().toExtend<Punto3>();
    expectTypeOf<OficinaProps['miradaAgentes']>().toEqualTypeOf<
      Record<string, string | Punto3> | undefined
    >();
    expectTypeOf<OficinaProps['gestoAgentes']>().toEqualTypeOf<
      Record<string, GestoAgente> | undefined
    >();
    expectTypeOf<AccionHablar>().toExtend<oficina.Accion>();
    expect(oficina.ETIQUETA_ACCION.hablar).toBe('hablar');
  });

  it('exporta la API pública: lógica pura y el componente', () => {
    expect(Object.keys(oficina).sort()).toEqual([
      'ACTIVO_MERCADO_GENERICO',
      'CALIDADES',
      'CARA_ASIENTO',
      'CATALOGO_OBJETOS',
      'CATEGORIAS',
      'CLAVE_SALA',
      'COLECCIONES',
      'COLORES_D2',
      'CONFIG_AJUSTE_INICIAL',
      'CONJUNTOS',
      'CapturaMomento',
      'ContextoEscenario',
      'ESTILOS_CATALOGO',
      'ETIQUETA_ACCION',
      'EfectosMomento',
      'FOV_VERTICAL',
      'LIMITES_SALA',
      'LIMITES_SIMULADOS',
      'Luces',
      'OBJETOS_NUEVOS',
      'OPCIONES',
      'Oficina',
      'PARAMETROS_ASISTENTE',
      'PARAMETROS_BIBLIOTECA',
      'PARAMETROS_PALANCA',
      'PARAMETROS_PERSONALIZACION',
      'PARAMETROS_SUELO',
      'PIEZAS_NUEVAS',
      'PantallaPresentacion',
      'PizarraMundo',
      'SIN_SUELO',
      'TECNICAS_POR_NIVEL',
      'TIPOS_FIJOS',
      'TOPS_NUEVOS',
      'aDefinicion',
      'accionCercana',
      'accionesDe',
      'ajustar',
      'ajusteIdle',
      'ajusteNeutro',
      'alternarPieza',
      'alturaEn',
      'alturaPie',
      'apagarTodo',
      'aplicarAjustes',
      'aplicarConjunto',
      'aplicarSkin',
      'asignarPuesto',
      'atuendoPorRol',
      'avanzarSeguimiento',
      'calcularPose',
      'cambiarPlantilla',
      'cargarSala',
      'catalogoBase',
      'colocar',
      'conSueloExtra',
      'conectarSuspensionControles',
      'controlesSuspendidos',
      'crearCatalogo',
      'crearFuenteSimulada',
      'crearHistoria',
      'crearMando',
      'crearMapaDeSuelo',
      'crearMedidor',
      'crearNavegacion',
      'crearPose',
      'crearRutasPlanta',
      'crearSeguimiento',
      'crearSuelo',
      'crearSuspensionControles',
      'definicionAProps',
      'departamentosBase',
      'deshacer',
      'dibujarMercadoPantalla',
      'dibujoDe',
      'duplicar',
      'ejemploEquipo',
      'ejemploEstudio',
      'eliminarSala',
      'encenderLed',
      'encenderTodo',
      'encuadreGeneral',
      'escenarioAuditorio',
      'escenarioMansion',
      'escenarioOficina',
      'escenarioPorId',
      'escenarioTrading',
      'escribirPalanca',
      'espacioD2',
      'estadisticas',
      'estadisticasGrafica',
      'evaluarColocacion',
      'fijarDestino',
      'fijarMarcasD2',
      'fijarOpciones',
      'fijarPantalla',
      'fijarVariante',
      'frameloopPara',
      'girar',
      'girarMueble',
      'girarObjeto',
      'guardarSala',
      'hacer',
      'hayEscenario',
      'horaChile',
      'huella',
      'laboratorio',
      'lineaLibre',
      'listarEscenarios',
      'listarSalas',
      'luzDelDia',
      'medidoresAnimacion',
      'migrarDefinicion',
      'mover',
      'moverMueble',
      'muebleBajoPunto',
      'mundoVacio',
      'paletaConVariante',
      'paletaLuz',
      'paqueteFiestasPatrias',
      'paqueteHalloween',
      'paqueteNavidad',
      'parsearDefinicion',
      'parsearSala',
      'piezasMovibles',
      'plano',
      'posarSentado',
      'puedeDeshacer',
      'puedeRehacer',
      'puntoDeReunion',
      'puntoEnSuelo',
      'puntoLibre',
      'puntoLibreEn',
      'quitar',
      'quitarMueble',
      'radianes',
      'razonNoSeleccionable',
      'registrarDibujo',
      'registrarEscenario',
      'registrarPaquete',
      'rehacer',
      'renombrarSala',
      'resolverAtuendo',
      'resolverVariante',
      'restablecerMueble',
      'restablecerSala',
      'rolesConocidos',
      'saludarD2',
      'sePisa',
      'serializarDefinicion',
      'serializarSala',
      'sueloDe',
      'sueloPlano',
      'superficieBajo',
      'superficiesDeMuebles',
      'suspenderControlesCamara',
      'tecnicasDe',
      'tipoObjeto',
      'useEscenario',
      'useReduceMotion',
      'validarDefinicion',
      'validarSala',
      'variantesConCatalogo',
      'zonasAlcanzables',
    ]);
  });

  it('importar el motor registra la sala de trading y la oficina (escenario y dibujo) junto a la mansión', () => {
    expect(oficina.escenarioPorId('auditorio')).toBe(oficina.escenarioAuditorio);
    expect(dibujoDe('auditorio')).toBeDefined();
    expect(oficina.escenarioPorId('trading')).toBe(oficina.escenarioTrading);
    expect(oficina.escenarioPorId('oficina')).toBe(oficina.escenarioOficina);
    expect(oficina.listarEscenarios().map((e) => e.id)).toEqual(
      expect.arrayContaining(['mansion', 'trading', 'oficina']),
    );
    expect(dibujoDe('trading')).toBeDefined();
    expect(dibujoDe('oficina')).toBeDefined();
  });

  it('la API pública funciona de punta a punta: catálogo por defecto + rol + resolución', () => {
    const catalogo = oficina.registrarPaquete(
      oficina.crearCatalogo(oficina.catalogoBase),
      oficina.paqueteHalloween,
    );
    const resuelto = oficina.resolverAtuendo(catalogo, oficina.atuendoPorRol('QA', 1));
    expect(resuelto.acc).toEqual(['lentes']);
  });
});
