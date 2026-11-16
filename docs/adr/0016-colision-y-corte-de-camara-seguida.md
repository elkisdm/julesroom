# Colisión volumétrica y prioridad del corte de seguimiento

## Contexto

El brazo radial muestreaba un rayo sin volumen cada tres cuadros. El rodeo aprobado de columnas conserva deliberadamente el radio mientras gira. Además, los mundos preparados por el selector pueden escribir sobre el mismo plano de corte que la mansión activa.

## Decisión

Consultar por cuadro el primer contacto contra cajas expandidas por el radio de cámara: es un barrido conservador del volumen, continuo en distancia y sin dependencias físicas nuevas. Mantener separadas la visibilidad, la distancia elegida y la distancia temporal del brazo. Predecir con velocidad de traslación y órbita, retener el radio corto y recuperar despacio. Conservar el compromiso angular aprobado y la autoridad manual, incluida su pausa.

Mantener `planoCorte` como `Plane` compartido, combinando su valor de escena con un límite activo de seguimiento. El seguimiento solo puede bajar ese corte; salir o desmontarse libera la prioridad. Se reutiliza el suavizado vertical de `corteSeguirSuave`.

En distancias críticas se ocultan las piezas instanciadas del avatar propio con histéresis; al recuperar espacio se restituye su visibilidad original. No se modifican materiales compartidos ni la animación.

## Consecuencias

Los muros finos ya no dependen del paso radial. El zoom se recuerda durante los bloqueos y se suaviza por separado. El plano de corte no permite que una previsualización sin seguimiento vuelva a tapar al avatar activo.

## Actualización: pendientes de la cámara de seguir (encargo U)

**Obstáculo angosto.** Con el usuario orbitando (`orbitando === true`), una caja de la casa cuya huella no supera `anchoAngosto` (1,2 m: columnas, plantas, muebles altos) deja de acortar la cámara: la distancia elegida se conserva y la caja se desvanece mientras queda entre la cámara y el avatar (`obstaculos` y `opacidadObstaculos` en el estado). El criterio es la medida de la caja y no el ángulo con que se ve, así una caja no cambia de clase al moverse el avatar; la histéresis es temporal (baja con media vida de 0,03 s, reaparece tras 0,4 s sin tapar y con media vida de 0,2 s). Sin `orbitando` (consumidor radial) y con el rodeo al caminar (`orbitando === false`) todo sigue como estaba: el rodeo de columnas es el comportamiento aprobado y sus 107 pruebas no cambian. El desvanecimiento se dibuja con un descarte punteado dentro de la caja, compilado en los materiales estándar y básicos (`render/desvanecer.ts`), porque la casa decorada se fusiona en pocas mallas y no hay una por columna; los materiales con `onBeforeCompile` propio sin encadenar (atlas de las personas, contorno) quedan fuera; los instanciados con volumen sí lo reciben, así que el borde de alguien pegado a la columna puede verse punteado mientras ella se desvanece (holgura de 6 cm).

**Rescate acotado.** El rescate inmediato (`seguro`) desaparece en la órbita manual. El brazo anticipa el muro barriendo los azimuts que la órbita va a recorrer (`limiteBarrido`): por cada uno, el hueco libre más lo que el tope de cambio de distancia permite recorrer hasta llegar a él. El tope de 6 m/s rige siempre, también en una órbita de 25 rad/s o mientras la cámara aún llega desde la vista general (ahí baja a lo más al ritmo de la propia llegada). Si el muro aparece antes de que el tope permita rodearlo, la cámara lo cruza unos cuadros y el propio muro se desvanece (misma maquinaria, regla de «la cámara quedó más allá de su primer contacto») en vez de saltar.

**Losas y techos (encargo U3).** Siguen sin entrar en la colisión: el corte de seguir oculta lo que queda sobre el cielo del piso del avatar y la cámara de casa de muñecas mira por encima de él. Se implementó el tope de altura bajo la losa (`techo` en la entrada, solo en la mansión: `alturaDeCorteSeguir` del avatar menos `margenTecho`), aplicado sobre la ELEVACIÓN y no sobre la distancia (`limitarElevacionBajoTecho`): conserva la distancia pedida y el tope de 0,10 m por cuadro; el tope sube de inmediato y baja a `velocidadTecho` (0,5 rad/s) al pasar a un piso más bajo, y no baja de la elevación mínima de la órbita. **Queda apagado** (`PARAMETROS_SEGUIMIENTO.limitarAlTecho = false`) porque medido en navegador, encendido, la vista de seguir de la mansión queda a ≈10° en lugar de 35° y: orbitando hacia afuera la cámara queda dentro del terreno (pantalla llena de colina en el video de la cocina), el avatar queda oculto por completo en 41 de 360 cuadros (antes 2) y caminando junto a un muro la distancia mínima baja de 7,25 m a 4,33 m. Con la cámara bajo el cielo del piso no hay forma de conservar a la vez distancia, elevación y visibilidad. Acortar la distancia en lugar de bajar la elevación se probó (20°, 5,4 m) y fue peor: la llegada a la sala se vuelve lenta y aparecen saltos de más de 0,7 m por cuadro al caminar. Encenderlo es cambiar ese valor; queda a decisión del dueño del producto. En trading y oficina no hay techo sobre el área de trabajo y nada cambia.

**Envolvente exterior (encargo U3).** El `borde` de las salas de un solo nivel (oficina, trading) es ladrillo con ventanales: visto desde fuera es opaco y, con la órbita manual, la cámara quedaba al otro lado con el reverso del muro llenando la vista (negro). No se agrega a la colisión: acortar la cámara contra un muro a 0,8 m del avatar la dejaría a ~1 m. Se trata como `fantasmas` en la entrada (`cajasDeEnvolvente`): no acortan la cámara y se desvanecen en cuanto quedan entre ella y el avatar, con o sin órbita manual, con la misma maquinaria y parámetros que los obstáculos angostos. Los materiales con shader propio (pantallas como el tablero del fondo) no se desvanecen: queda un tramo corto con el reverso de la pantalla a la vista. En la mansión el borde es vidrio y no hay nada que desvanecer.

**Jules (encargo U3).** Se desvanece como una caja más: `asistente` (sus pies) en la entrada; si el rayo de la cámara a la cabeza, el pecho o los pies del avatar cruza su cuerpo (radio 0,4 m más `margenDesvanecer`), baja su opacidad (`opacidadAsistente`, mismos tiempos que los obstáculos) y `escribirDesvanecidas` publica su caja (cuerpo y anillo, radio 0,85 m) como una más. La cámara no se mueve por ella. Como la caja se dibuja con el descarte punteado de los materiales estándar y básicos, cualquier cosa de la casa dentro de esos 0,85 m también se punteará mientras ella tapa. El halo (sprite) no se desvanece. Además, el seguimiento orienta ahora la cámara hacia la mira (`lookAt`) tras fijar su posición, porque la elevación efectiva puede diferir de la que el control orbital acaba de leer.

## Alternativas consideradas

- Seguir bajando el paso radial: mantiene el rayo sin volumen y el problema de cantos finos.
- Acortar siempre durante el rodeo: rompe el comportamiento estable de columnas ya aprobado.
- Cambiar opacidad de materiales del avatar: las piezas se dibujan instanciadas con materiales compartidos; afectaría a otras personas.
- Cambiar el onboarding: fuera del alcance y de los archivos autorizados.
- Añadir las losas como sólidos: destruye la vista de casa de muñecas (ver arriba).
- Acortar la distancia contra el techo (en lugar de bajar la elevación): se probó (a 20° y 5,4 m) y empeoró los saltos al caminar y la llegada a la sala.
- Muros de la envolvente exterior como sólidos de cámara: la dejan a ~1 m del avatar pegado al muro; se desvanecen en su lugar.
- Un rescate más rápido que el tope en la órbita extrema: es el salto que se quería quitar; se prefiere cruzar el muro unos cuadros con el muro desvanecido.
