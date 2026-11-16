/**
 * Contrato de ESCENARIO: una plantilla de sala como datos (sin three). El dueño de la sala la elige por
 * id (`DefinicionOficina.plano.plantilla`) y el motor la lee por completo desde aquí: planta, zonas,
 * pantallas, entradas, colisión, rutas, luz y vistas. El dibujo 3D de cada escenario se registra
 * aparte por el mismo id (`render/escenarios/registroDibujo.ts`).
 *
 * La planta reutiliza los tipos del plano de la mansión (`mansion/plano.ts`): son genéricos y ya los
 * entienden la colisión, los puestos, las rutas y la cámara. Mismas convenciones de coordenadas:
 * metros, x de oeste a este, z hacia la cámara (el borde +z es el corte abierto), y = altura,
 * yaw según `atan2(x, z)`.
 */
import type {
  Ambiente,
  Caja,
  Escalera,
  Hueco,
  Lugar,
  Mueble,
  Muro,
  Punto3,
  PuntoLuz,
  PuntoXZ,
  Vano,
} from '../mansion/plano';
import type { Nodo } from '../animacion/ruta';

export type { Ambiente, Caja, Lugar, Mueble, Muro, Punto3, PuntoXZ };

/** Todo lo que ocupa el suelo y lo que lo encierra. */
export interface Planta {
  /** Recintos con piso y su pasillo (`pasilloZ`); los de trabajo llevan `departamento`. */
  ambientes: Ambiente[];
  muebles: Mueble[];
  /** Lugares de trabajo (sentado o de pie), por departamento; ver convención en `mansion/plano.ts`. */
  lugares: Lugar[];
  muros: Muro[];
  vanos: Vano[];
  /** Vacías en escenarios de un solo nivel. */
  escaleras: Escalera[];
  huecos: Hueco[];
  /** Puntos de pausa (café), en grupos de 4 contiguos. Pueden faltar: entonces se pausa en el pasillo. */
  cafe: PuntoXZ[];
  /** Punto frente a un aro de luz o atril, si lo hay. */
  luz: PuntoLuz | null;
  /** Dónde reposa el orbe asistente. */
  asistente: Punto3;
  /** Alturas de los pisos de la planta, de abajo arriba (un nivel: `[0]`). */
  niveles: number[];
}

export type TipoZona =
  'trabajo' | 'agentes' | 'reunion' | 'aula' | 'descanso' | 'pantallas' | 'paso';

/** Una zona con nombre: sirve para encuadrarla, para pasear y para rotular. */
export interface ZonaEscenario extends Caja {
  id: string;
  nombre: string;
  tipo: TipoZona;
  /** Altura del piso de la zona. */
  y: number;
  /** Altura libre que se encuadra con la zona. */
  alto: number;
  /** Departamento que trabaja aquí, si es una zona de trabajo. */
  departamento?: string;
}

export type ContenidoPantalla = 'mercado' | 'tablero' | 'presentacion' | 'video' | 'agente';

/** Una superficie que muestra contenido (muro LED, monitor, pantalla del aula). */
export interface Pantalla {
  id: string;
  /** Centro de la superficie. */
  x: number;
  y: number;
  z: number;
  ancho: number;
  alto: number;
  /** `rotation.y` de la superficie; su cara visible es su +z local. */
  giro: number;
  /** Curvatura: radio (m) del arco si es un muro curvo; 0 si es plana. */
  radio: number;
  contenido: ContenidoPantalla;
  /** Zona a la que pertenece. */
  zona: string;
}

/** Un punto por donde se entra a la sala (el avatar propio y las personas que llegan). */
export interface Entrada extends PuntoXZ {
  y: number;
  /** Hacia dónde mira quien entra. */
  yaw: number;
}

/**
 * Cómo se arma la cadena de nodos que recorre cada agente (lugar → salida → pasillo → … → pausa) y las
 * visitas a colegas. La mansión usa las suyas, escritas a mano; un escenario de un nivel usa las
 * genéricas de `rutasPlanta.ts`.
 */
export interface Rutas {
  crearRuta(lugar: Lugar, pausa: PuntoXZ, aLaLuz: boolean): Nodo[];
  escribirVisita(nodos: Nodo[], colega: Lugar): void;
  quitarVisita(nodos: Nodo[]): void;
}

/** Límites de lo que la cámara encuadra, en metros. */
export interface Caja3 {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
}

export interface VistaZona {
  id: string;
  nombre: string;
  caja: Caja3;
}

export interface Vistas {
  /** Lo que la vista general debe mostrar entero (en horizontal y en vertical). */
  general: Caja3;
  /**
   * En pantallas verticales, lo que se encuadra en su lugar (más angosto); si falta, se usa `general`
   * recortado al centro.
   */
  generalVertical?: Caja3;
  /**
   * En pantallas verticales, punto de la base visible (altura y profundidad, m) que se baja a ~14 % del
   * alto de la pantalla para que el terreno de delante no ocupe media pantalla. Sin él, la caja queda centrada.
   */
  baseVertical?: { y: number; z: number };
  /** Elevación (grados) de la cámara general y de la de seguimiento. */
  elevacionGeneral: number;
  /**
   * Elevación (grados) de la vista general en pantallas verticales: más alta, la planta se ve más
   * profunda y llena el alto. Sin ella, `elevacionGeneral`.
   */
  elevacionVertical?: number;
  /**
   * Fracción del medio-ancho y medio-alto que ocupa `general` en horizontal (por defecto 0,9). Más alta,
   * la sala llena más el cuadro y el entorno solo asoma.
   */
  margenGeneral?: number;
  seguir: {
    /** Distancia (m) de la cámara al avatar. */
    distancia: number;
    /** Elevación (grados) sobre el avatar: alta para que nadie lo tape. */
    elevacion: number;
    /** z del borde abierto del piso por el frente: al seguir, la cámara no muestra el vacío más allá. */
    frente?: number;
  };
  zonas: VistaZona[];
}

/**
 * Un punto de interés: al acercarse el avatar propio (dentro de `radio`) o al hacer clic en lo que lo
 * representa, el motor avisa con `onInteres(id)` y la aplicación abre el `panel` que corresponda
 * (aula, mercado, videos, agente…). El motor no dibuja paneles: solo avisa.
 */
export interface Interes extends PuntoXZ {
  id: string;
  nombre: string;
  /** Radio (m) de cercanía del avatar. */
  radio: number;
  /** Qué panel abre la aplicación (id libre que entiende quien usa el motor). */
  panel: string;
  /** Zona a la que pertenece. */
  zona: string;
  /**
   * Id del mueble (`planta.muebles`) al que va atado, si lo hay: al mover la pieza (`aplicarAjustes`) el
   * interés se mueve y gira con ella; si se quita, desaparece.
   */
  mueble?: string;
}

// --- acciones: lo que el avatar puede hacer con el mundo (E · sentarse, E · abrir…) ---

/**
 * Dónde y cómo se sienta alguien. `y` es la altura de la PELVIS sentada (cara del asiento + 1 cm: el
 * cojín se hunde bajo la pelvis, ver `render/casa/ambientes/asientos.ts`); los pies quedan en `y − 0,45`.
 */
export interface AsientoAccion extends PuntoXZ {
  y: number;
  /** Hacia dónde mira quien se sienta (convención de `atan2(x, z)`). */
  yaw: number;
  /** Punto libre desde el que se sienta y al que vuelve al levantarse; `y`: su piso. */
  aproximacion: Punto3;
}

/** Tipos de acción de hoy; para una puerta u objeto se agrega su tipo y su forma a `Accion`. */
export type TipoAccion = 'sentarse' | 'abrir' | 'hablar';

/**
 * Lo común a toda acción: un punto de alcance (`x`, `z`, y la altura `y` si importa: sin ella solo cuenta
 * la distancia en planta) y su radio. Las consultas (`accionCercana`) solo leen esto.
 */
export interface AccionBase<T extends string = string> extends PuntoXZ {
  /** Único entre las acciones del escenario y las extra del anfitrión. */
  id: string;
  tipo: T;
  /** Cómo se la nombra al usuario («Sofá», «Mesa Cripto»). */
  nombre: string;
  y?: number;
  /** Alcance (m) desde el avatar. */
  radio: number;
}

export interface AccionSentarse extends AccionBase<'sentarse'> {
  asiento: AsientoAccion;
}

/** Abre el panel de un punto de interés: se ejecuta como `onInteres(interes)`. */
export interface AccionAbrir extends AccionBase<'abrir'> {
  /** Id del `Interes` del escenario. */
  interes: string;
  panel: string;
}

/** Conversación aportada por la aplicación anfitriona; comparte el arbitraje de E. */
export interface AccionHablar extends AccionBase<'hablar'> {
  agenteId: string;
  alEjecutar: () => void;
}

export type Accion = AccionSentarse | AccionAbrir | AccionHablar;

export interface AmbienteEscenario {
  /** Hora fija (0–24, Chile) de la luz del escenario; `null` sigue la hora real. */
  hora: number | null;
  /** `exterior`: cielo y terreno (mansión). `interior`: sala cerrada con ventanales. */
  tipo: 'exterior' | 'interior';
  /** Colores principales, para la interfaz que acompaña al escenario. */
  paleta: { fondo: string; acento: string; texto: string };
}

/**
 * Qué cambia una variante de luz y color. Solo `hora` es obligatoria; lo que falta queda como en la
 * plantilla. Las claves de `materiales`, `emisivos` y `luces` las define y lee el dibujo de cada escenario
 * (`escenarios/variantes.ts`: `colorDe`, `emisivoDe`, `luzDe`); una clave que el dibujo no conoce se ignora.
 */
export interface PaletaVariante {
  /** Hora (0–24, Chile) de la luz general: sol, cielo, relleno y exposición. */
  hora: number;
  /** Tinta de fondo de la escena (lo que se ve más allá de la sala). */
  fondo?: string;
  /** Dirección HACIA el sol (no hace falta normalizarla): luz direccional y franjas de sol. */
  sol?: Punto3;
  /** Color (hex) de materiales del dibujo, por nombre. */
  materiales?: Record<string, string>;
  /** Rugosidad de materiales existentes (0 satinado, 1 mate), sin texturas nuevas. */
  acabados?: Record<string, number>;
  /** Brillo propio (lámparas, charcos de luz): color y fuerza, por nombre. */
  emisivos?: Record<string, { color: string; fuerza: number }>;
  /** Luces del dibujo, por grupo: `color` reemplaza al de la plantilla e `intensidad` la multiplica. */
  luces?: Record<string, { color?: string; intensidad?: number }>;
}

/** Una manera de ver la misma sala: cuidada como una dirección de arte propia, no un cambio de tono. */
export interface VarianteEscenario {
  id: string;
  nombre: string;
  paleta: PaletaVariante;
}

/**
 * Punto de reunión: donde se juntan a conversar las personas simuladas (de pie, alrededor de `x, z`,
 * mirando al centro). Quien se asigna ocupa un lugar del círculo de `radio` metros; `cupo` es cuántas
 * personas caben antes de pasar a la siguiente reunión.
 */
export interface Reunion {
  x: number;
  z: number;
  radio: number;
  cupo: number;
}

// --- mundo recorrible: superficies con altura (ver `suelo.ts`) ---

/**
 * Qué es una superficie caminable: `losa` (piso de un nivel), `peldano` (escalón de una escalera recta o
 * de caracol), `rampa`, `tarima` (escenario, graderío) o `mueble` pisable (sofá, mesa baja, banco…).
 */
export type TipoSuperficie = 'losa' | 'peldano' | 'rampa' | 'tarima' | 'mueble';

interface SuperficieBase {
  /** De dónde sale (ambiente, `escalera#k`, mueble), para depurar y para las pruebas. */
  id: string;
  tipo: TipoSuperficie;
  /**
   * Cuánto baja (m) el cuerpo sólido bajo la cara superior: 0,3 una losa, 0,06 un peldaño volado, hasta el
   * piso una tarima o un mueble. Quien está más abajo choca con ese cuerpo (con el radio del pie) si la
   * cara le queda a más de un paso y el cuerpo le alcanza la cabeza.
   */
  grosor: number;
}

/** Cara horizontal rectangular a la altura `y` (losa, peldaño recto, tarima, mueble). */
export interface SuperficiePlana extends SuperficieBase, Caja {
  forma: 'caja';
  y: number;
  /**
   * Radio (m) con que choca su cara desde abajo. Sin él, el del pie (`RADIO_PIE`: el cuerpo roza peldaños y
   * sofás); 0 es el del cuerpo entero, como un mueble de la sala que no se atraviesa con los brazos.
   */
  radio?: number;
}

/**
 * Rampa: cara inclinada a lo largo de un eje; `y0` es su altura en el borde x0 (eje 'x') o z0 (eje 'z')
 * e `y1` en el borde opuesto. No corta el paso por su frente (se sube andando); sus costados van como
 * `Solido`.
 */
export interface SuperficieRampa extends SuperficieBase, Caja {
  forma: 'rampa';
  eje: 'x' | 'z';
  y0: number;
  y1: number;
}

/**
 * Peldaño de caracol: sector de corona alrededor de (cx, cz), entre los radios `r0` y `r1` y los ángulos
 * `desde` < `hasta` (rad, convenio `atan2(z − cz, x − cx)`, sin envolver), con la cara a la altura `y`.
 */
export interface SuperficieSector extends SuperficieBase {
  forma: 'sector';
  cx: number;
  cz: number;
  r0: number;
  r1: number;
  desde: number;
  hasta: number;
  y: number;
}

export type Superficie = SuperficiePlana | SuperficieRampa | SuperficieSector;

/**
 * Lo que corta el paso al cuerpo entre dos alturas: muros y barandas de cada nivel, muebles no pisables,
 * balaustres y bordes de seguridad (frente abierto de las plantas altas, bordes de un hueco, piscina).
 * Bloquea al avatar con los pies en `y` si `y1 > y + paso` y `y0 < y + altoCuerpo`: se pasa por encima de
 * lo bajo (saltando) y por debajo de lo alto.
 */
export interface Solido extends Caja {
  id: string;
  tipo: 'muro' | 'baranda' | 'mueble' | 'borde';
  y0: number;
  y1: number;
  /**
   * Radio de contacto (m) si es menor que el del cuerpo: la columna y los balaustres de un caracol chocan
   * con los hombros (0,2) para que el cuerpo quepa en la corona de los peldaños. Sin él, el del cuerpo.
   */
  radio?: number;
  /**
   * Bloquea hasta `PARAMETROS_SUELO.alturaInfranqueable` sobre su base: no se salta por encima ni se aterriza
   * encima, pero la planta de arriba queda libre. Lo llevan los muebles que no se pueden pisar (más altos
   * que el alcance del salto, de un tipo de `NO_PISABLES_POR_DEFECTO` o con `pisable: false`).
   */
  infranqueable?: boolean;
}

/**
 * El mundo recorrible de un escenario como datos. `crearSuelo` lo indexa (grilla) para consultarlo por
 * cuadro con `alturaEn` y `alturaPie`; `crearMapaDeSuelo` (colisión) y `crearNavegacion` lo usan entero.
 */
export interface DatosSuelo {
  superficies: Superficie[];
  solidos: Solido[];
  /** Rectángulo de lo recorrible; fuera de él todo bloquea. */
  limites: Caja;
  /** Lo más alto (m) que se sube caminando; más alto, solo saltando. Por defecto `PARAMETROS_SUELO.paso`. */
  paso?: number;
  /** Alto del cuerpo (m): lo que queda más arriba se pasa por debajo. Por defecto `PARAMETROS_SUELO.altoCuerpo`. */
  altoCuerpo?: number;
}

export interface Escenario {
  id: string;
  nombre: string;
  descripcion: string;
  planta: Planta;
  /**
   * Mundo recorrible con alturas (losas, escaleras, tarimas, muebles pisables). Si falta, `sueloDe` arma
   * uno plano del nivel de entrada a partir de `colision` (mismo bloqueo que antes).
   */
  suelo?: DatosSuelo;
  zonas: ZonaEscenario[];
  pantallas: Pantalla[];
  /** Al menos una. La primera es la del avatar propio. */
  entradas: Entrada[];
  /** Puntos de interés que abren paneles (puede ser vacío). */
  intereses: Interes[];
  /**
   * Acciones propias del escenario que no salen de sus muebles ni de sus intereses (butacas del aula, una
   * puerta…). Se suman a las derivadas (`accionesDe`).
   */
  acciones?: Accion[];
  /** Zona por donde pasean las personas simuladas (y donde no estorban los puestos). */
  paseo: Caja;
  /** Puntos de reunión de las personas simuladas (ver `puntoDeReunion`); vacío: todas pasean. */
  reuniones: Reunion[];
  /** Cajas que bloquean y límites caminables del nivel `y`. */
  colision(y: number): { cajas: Caja[]; limites: Caja };
  rutas: Rutas;
  ambiente: AmbienteEscenario;
  /** 2 a 4 maneras de ver la sala; la primera es la de siempre y la que se usa sin pedir otra. */
  variantes: VarianteEscenario[];
  vistas: Vistas;
  /** Ambiente común cuyos lugares ocupa un departamento que la planta no trae (mansión: el atrio). */
  ambienteComun: string;
  /**
   * Cómo se reparten los departamentos de la definición entre los lugares de la planta.
   * `por-id`: el lugar se busca por el id del departamento (mansión).
   * `por-orden`: el departamento i de la definición ocupa los lugares cuyo `departamento` es
   * `equipo-${i + 1}`; si hay más departamentos que equipos, los sobrantes caen en `ambienteComun`.
   */
  asignacion: 'por-id' | 'por-orden';
  /**
   * El dueño puede mover y quitar el mobiliario suelto (`piezasMovibles`, `aplicarAjustes`): su dibujo
   * pinta el mobiliario desde `planta.muebles`. Sin él (la mansión, por ahora), nada se mueve.
   */
  personalizable?: boolean;
}
