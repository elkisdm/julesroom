# Suavizar la cámara del avatar junto a obstáculos

Clasificación: fix, alcance grande, riesgo medio, Tier 3. Origen: encargo O.

## Exploración y diseño

El brazo radial se muestrea cada tres cuadros con un rayo sin volumen. Su resorte puede conservar una posición dentro de un sólido; el tope de velocidad no garantiza seguridad. El rodeo de columnas conserva el radio deliberadamente. El salto ya se excluye al seguir la raíz sobre el suelo. La preferencia de movimiento reducido todavía no llega al seguimiento.

Se separa la visibilidad del personaje de la seguridad del volumen de cámara. Se conserva el compromiso angular de columnas y la autoridad manual; se anticipa el límite radial y se retiene el brazo corto antes de recuperar lentamente. La distancia elegida sigue separada de la distancia temporal por colisión. La anticipación del encuadre será menor y el resorte no adelantará al avatar al frenar.

Referencias: investigación de videojuegos, A5 (Keren, ventana y anticipación), y [Cinemachine Deoccluder](https://docs.unity.cn/Packages/com.unity.cinemachine%403.0/manual/CinemachineDeoccluder.html) (radio, retención, amortiguación asimétrica). No se incorporan dependencias.

## Archivos verificados

- `packages/oficina/src/render/camara.ts`: seguimiento, parámetros y estado.
- `packages/oficina/src/render/ControlesCamara.tsx`: integración de preferencia y controles.
- `packages/oficina/src/render/oclusion.ts`: rescate de visibilidad del avatar propio.
- `packages/oficina/src/render/camaraColision.ts`: consultas puras del volumen (nuevo).
- `packages/oficina/src/render/camaraPro.test.ts`: regresiones con escenarios reales (nuevo).
- `packages/oficina/src/render/casa/planoCorte.ts` y su prueba: prioridad del corte del avatar sobre otros escritores del plano compartido.
- Pruebas invariantes: `camara.test.ts`, `camaraEscalera.test.ts`, `camaraColumnas.test.ts`.

## Escenarios verificables

1. Dado un muro real y un recorrido paralelo a 0,4 m, al avanzar 360 cuadros en ambos sentidos, la posición final no entra en su volumen y el radio cambia con el tope parametrizado, excepto un rescate inmediato de seguridad.
2. Dado un obstáculo fino real, al alternar su línea diez veces, la recuperación no invierte repetidamente el sentido por un borde intermitente.
3. Dada una carrera seguida de reposo, la mira no rebasa la posición final del avatar.
4. Dado movimiento reducido, no hay anticipación ni apertura por carrera.
5. Dada una órbita manual con pausa, el azimut solicitado se conserva; un bloqueo temporal no reemplaza el zoom elegido.
6. Dado salto/escalera, se conserva el seguimiento del suelo con suavizado vertical independiente.

## Pre-mortem

- Caminos: seguimiento de escenarios y sala creada comparten ControlesCamara; cámaras generales conservan su contrato.
- Fallas: dt cero conserva estado; teletransporte reinicia; no hay red ni servicio nuevo.
- Invariantes: autoridad manual, zoom recordado, rodeo estable y salto desacoplado.
- Simetrías: ambos sentidos por muro; entrada rápida y salida lenta deliberadamente diferentes.
- Reutilización: cajasDeLaCasa, posicionDe, resortes existentes.
- Consumidores: ControlesCamara y pruebas consumen EntradaSeguimiento; nuevos campos opcionales.
- Datos reales: sólidos de planta; la lista actual excluye bordes y losas, limitación a resolver/verificar explícitamente.
- Variantes: escritorio/móvil, reducir movimiento, seguimiento apagado, órbita manual.
- Afirmaciones: el informe separará resultados comprobados y recorridos pendientes.

## Ejecución

En la sesión principal, según adaptación Codex de delegación opt-in: grabar antes; escribir regresiones rojas; implementar colisión y encuadre; verificar invariantes/typecheck/lint; grabar después y comparativas. Máximo cuatro workers de Vitest. Sin commit ni operaciones externas.

Definition of Ready: objetivo y escenarios verificables; rutas verificadas; cambios reversibles; sin dependencias nuevas; NFR: continuidad visual, seguridad geométrica, accesibilidad de movimiento y costo por cuadro. La aceptación visual completa requiere revisar los videos a velocidad real.

## Cierre

279 pruebas propias y relacionadas, typecheck y lint del motor en verde. Se registran las limitaciones completas en el informe de entrega. No se ejecuta la suite completa, por instrucción del encargo.

### Ajustes intencionales de pruebas existentes

- La ventana baja de 0,5 a 0,3 m: la prueba de realineación usa ahora un desplazamiento de 0,2 m que permanece dentro de ella.
- La anticipación máxima baja de 3,6 a 1,4 m y su horizonte de 0,7 a 0,28 s. Las expectativas de adelantarse más de 0,3 m a los pies se sustituyen por mantenerse cerca de ellos, con el test nuevo de frenado monótono como contrato. Se conserva la prueba de anticipación respecto al centro de la ventana, con un umbral de 0,05 m.
- El snapshot de trayectoria libre de `camaraColumnas.test.ts` se actualiza por este encuadre y el zoom suave. Sus otros 106 casos de rodeo y autoridad manual conservan sus expectativas.
- Se eliminan los parámetros internos de muestreo radial (`pasoBrazo`, `cadaCuadros`) y su distancia de rescate: la consulta volumétrica es continua y se calcula cada cuadro. No eran exportaciones públicas del motor.

### Corte de la mansión compartido con las previsualizaciones

`planoCorte` conserva la API `Plane` y la escritura de `constant` del dibujo. Su lectura combina ese corte con un límite de seguimiento activo. Así, una escritura posterior de `SIN_CORTE` desde otra instancia del dibujo no vuelve a tapar al avatar con los pisos superiores. `ControlesCamara` registra los pies del avatar solamente en la mansión y libera esa prioridad al salir o desmontarse. Usa `corteSeguirSuave` existente: al subir amortigua, al bajar oculta la losa inmediatamente. Las dos regresiones de `casa/planoCorte.test.ts` se ejecutaron primero rojas, luego verdes, junto a las 28 de `casa/corte.test.ts`.

### Rescate de proximidad y límites de entrega

`oclusion.ts` conserva y restaura la visibilidad de las piezas propias; se ocultan bajo `distanciaOcultarAvatar` (1,6 m) y vuelven al superar `distanciaMinBrazo` (2,2 m). La animación, los materiales compartidos y el estilo del personaje no cambian. El test valida la histéresis, los accesorios ya invisibles y la restauración al salir.

Ver ADR-0016. No se afirma cobertura geométrica de losas/techos ni de la envolvente exterior: no están en `cajasDeLaCasa`. El corte resuelve su oclusión visual, no una colisión física contra ellos. Una órbita extrema puede agotar la predicción y activar el rescate radial inmediato. La revisión de cuadros no equivale a aprobación de la sensación a velocidad real.

### Comprobación de cierre

- Recorridos reales, zoom, canto fino, frenado, movimiento reducido y proximidad: `camaraPro.test.ts`, 31 casos.
- Rodeo: `camaraColumnas.test.ts`, 107 casos; salto y altura: `camaraEscalera.test.ts`; transición de construir: `camaraSalidaConstruir.test.ts`.
- Corte compartido: `casa/planoCorte.test.ts` y `casa/corte.test.ts`; oclusión existente: `oclusion.test.ts`; guardia sin rutas personales: verde tras eliminar los módulos temporales de captura del antes.
- Total dirigido: 279 pruebas / 9 archivos. Typecheck y lint del motor verdes. Revisión explícita del diff en la sesión principal, sin lanzar agentes de review porque la delegación es opt-in.
- Cobertura de líneas de cámara: 97,84 % en HEAD original → 97,94 %; cuatro módulos puros finales: 98,27 %. No se mide toda la aplicación.
- Sin commit, push, cambio de rama ni despliegue. El encargo conserva los pendientes geométricos y visuales descritos arriba; no se marca como aceptación integral.

El máximo real de OrbitControls se pasa al seguimiento: el brazo no escribe radios que el control vuelva a recortar. Esto impide que ese recorte se interprete como un nuevo zoom y permite pellizcar desde el límite en vertical. La regresión reproduce un máximo de 5 m con un ajuste de 2 cm.

## Pendientes cerrados (encargo U)

Clasificación: fix, alcance medio, Tier 2. Pruebas: `render/camaraPendientes.test.ts` (53 casos con la geometría real de trading, oficina y mansión) y `render/desvanecer.test.ts`.

1. **Órbita manual detrás de una columna o mueble alto.** Una caja con huella ≤ `anchoAngosto` (1,2 m) no acorta la cámara mientras el usuario orbita: se desvanece y la distancia elegida se conserva. La distancia es idéntica a la de un mundo sin esa caja, 360° a 1 m de cada columna de trading y oficina.
2. **Rescate acotado.** El cambio de distancia por cuadro no supera `velocidadDistanciaBrazo · dt` en órbitas de 6, 12 y 25 rad/s junto a cada muro de más de 3 m de las tres plantillas, ni al llegar desde la vista general. El brazo se anticipa barriendo los azimuts por delante; lo que el tope no alcanza a rodear se resuelve desvaneciendo el muro que la cámara cruza.
3. **Losas y techos.** No entran en la colisión (ADR-0016). En U3 se implementó el tope de altura bajo el cielo del piso del avatar, sobre la elevación y con prueba en los tres pisos, pero queda APAGADO por defecto (`limitarAlTecho`): encendido deja la cámara dentro del terreno y oculta al avatar al orbitar en la mansión. Decisión pendiente del dueño del producto.
4. **Envolvente exterior.** Prueba de 360° a 0,4 m de cada muro opaco extremo de las tres plantillas: todo lo que separa a la cámara del avatar queda desvanecido en ≤ 3 cuadros. Desde U3, el borde de ladrillo de oficina y trading también se desvanece sin acortar la cámara (`fantasmas`).
5. **Jules entre la cámara y el avatar.** Resuelto en U3: se desvanece como una caja más y la cámara no se mueve por ella (ADR-0016).

Valores iniciales parametrizables nuevos en `PARAMETROS_SEGUIMIENTO`: `anchoAngosto`, `margenDesvanecer`, `vidaDesvanecer`, `vidaReaparecer`, `esperaReaparecer`, `pasoBarrido`, `velocidadMinBarrido` y, en U3, `radioAsistente`, `radioAnilloAsistente`, `altoAsistente`, `limitarAlTecho`, `margenTecho`, `velocidadTecho`, `altoEnvolvente`, `espesorEnvolvente`.

Una condición existente cambió a propósito: `llegando` (cámara más lejos que la pedida) exige ahora superar la pedida en `TOLERANCIA_ZOOM` y no solo en un epsilon; con el epsilon, una cámara asentada se tomaba por «llegando» y se saltaba el tope.
