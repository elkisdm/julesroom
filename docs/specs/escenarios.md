# Escenarios como plantillas (mansión, sala de trading, oficina)

**Clasificación**: feat · large · med risk · unknown (estética) · `packages/oficina/src/{escenarios,mansion,render/casa,render/camara.ts}`, `apps/lab/src/escenarios`
**Tier**: 3 — Full
**Origen**: revisión del autor del 2026-11-14.

## Objetivo

El dueño de una sala elige su escenario (mansión, sala de trading, oficina) como plantilla. Cada escenario
trae su planta, zonas, pantallas, entradas, colisión, rutas, luz y vistas. En cualquier escenario el avatar
propio siempre se ve, la vista general llena la pantalla y los nombres no se enciman.

## Supuestos (corrígeme si alguno está mal)

- La mansión se conserva intacta (mismas pruebas verdes): solo se envuelve en el contrato.
- La «planta» del contrato reutiliza los tipos de `mansion/plano.ts` (Ambiente, Mueble, Lugar, Muro, …): son
  genéricos y ya los leen colisión, puestos, rutas y cámara. Lo nuevo va encima (zonas, pantallas, entradas,
  vistas, ambiente).
- El escenario llega a `<Oficina>` por una prop `escenario` (id) y por un contexto React a los componentes; la
  lógica pura lo recibe como parámetro con la mansión por defecto. Nada de singleton mutable.
- `DefinicionOficina` ya tiene `plano.plantilla` (hoy solo `'mansion'`): ese es el id de escenario. Se valida
  contra el registro (extensible) en vez de una lista fija; las definiciones guardadas siguen válidas.
- Un escenario de un nivel usa un generador de rutas genérico (lugar → salida → pasillo → … → pausa) en vez de
  rutas escritas a mano.
- El dibujo de cada escenario es un componente registrado por id (igual que los paquetes de skins).

## Criterios de aceptación

- [ ] Registro de escenarios extensible: `registrarEscenario`, `escenarioPorId`, `listarEscenarios`; trae
      `mansion` y `trading`; un id desconocido cae en la mansión con aviso.
- [ ] La mansión como escenario reproduce exactamente los puestos, rutas y colisión de hoy (prueba de igualdad).
- [ ] Sala de trading: un nivel, muro de pantallas con datos, puestos por equipo, puestos de agentes, aula,
      descanso; todo lugar alcanza su pausa sin cruzar muebles (prueba sobre el mapa de colisión).
- [ ] Vistas por escenario: general (llena en 16:9 y 9:19,5), seguirme (avatar visible), zonas.
- [ ] Con 25 personas simuladas el avatar propio parte fuera del grupo y nadie lo tapa en «seguirme»
      (lo que se interpone se desvanece).
- [ ] Nombres: solo cercanos y seleccionado, sin encimarse (apilados).
- [ ] Lab `escenarios.html` (puerto 5325): selector propio de escenario y control de vista; cambio en caliente
      sin recargar, las personas simuladas se reubican.
- [ ] Presupuesto (valor inicial): 100 ocupantes, p95 ≤ 12 ms escritorio y ≤ 16,6 ms a 390×844 con CPU ×4.
- [ ] Cuadro de estilo del piloto (escritorio y 390 px) en una carpeta local antes del resto.

## Cambio 18:35 (Elkis): el piloto se PORTA desde un prototipo anterior del autor

«Necesito que esté incluido lo que hice recién con la sala de trading». El escenario `trading` parte de
un prototipo anterior del autor (misma planta y distribución): mismo plano,
mobiliario, muro de pantallas, aula-cine y puestos de agentes; sus paneles (aula, mercado, videos, chat, agente)
se abren como contenido de zonas al acercarse o hacer clic. Ocupantes = personajes del motor con avatar, cámara
y nombres nuevos. Se mejora lo necesario, no se rehace. Fuera: marca, nombre o datos del cliente, textos de su
propuesta y precios (datos de ejemplo genéricos; guardia del motor). El widget de mercado de terceros no entra:
queda una superficie de pantalla que recibe contenido. El prototipo anterior es de solo lectura.

Contrato añadido: `Escenario.intereses` (punto, radio, panel) y prop `onInteres(id | null)` en `<Oficina>`;
prop `contenidoPantallas` para alimentar una superficie desde fuera.

La dirección de arte de abajo queda como guía de MEJORA sobre la sala portada (luz, volumen, paleta), no como
diseño nuevo.

## Dirección de arte del piloto — «Hora azul en el piso»

Idea: la sala es el tablero. Lo que se recuerda es la luz del muro de datos bañando a la gente: un piso de
trading al anochecer, con la ciudad azul tras los ventanales y un muro curvo de pantallas que es la fuente de
luz principal (ámbar, verde señal y coral sobre tinta).

- Paleta: tinta (#0f1a2b), pizarra cálida para el piso (#3a3632, mate con brillo suave, nunca negro: las
  personas deben recortarse), latón (#c9a15a) en cantos y lámparas, nogal en cubiertas, señales verde
  (#3ccf91) y coral (#ff6b5a) solo en datos, cada equipo con su color en la lámpara colgante de su isla.
- Luz: cielo de hora azul en ventanales; el muro de datos emite (emisivo + luz de área rectangular cálida);
  lámparas colgantes cálidas por isla; luz de relleno fría baja. Nada plano: zócalos, bordes biselados,
  cielo raso con baffles lineales visible en el corte, columnas, alfombras por zona.
- Composición: un solo nivel en corte (fachada frontal abierta), muro de datos al fondo al centro, islas de
  equipo en arco mirando al muro, fila de agentes frente al muro, aula de vidrio a un costado, descanso con
  barra y plantas al otro. Planta compacta (~28 × 18 m) para que las personas se vean grandes.
- Prohibido: superficies vacías, una sola caja gris por mueble, reutilizar textos o marca de la demo del prototipo anterior.

## Archivos y rutas a tocar (verificado contra el código: sí)

Núcleo (contrato y desacople):

- `packages/oficina/src/escenarios/tipos.ts` — nuevo — `Escenario`, `Planta`, `ZonaEscenario`, `Pantalla`, `Vistas`, `AmbienteEscenario`.
- `packages/oficina/src/escenarios/registro.ts` — nuevo — registro extensible.
- `packages/oficina/src/escenarios/rutasPlanta.ts` — nuevo — rutas genéricas de un nivel (`crearRuta`, `escribirVisita`, `quitarVisita`) parametrizadas por planta.
- `packages/oficina/src/escenarios/mansion.ts` — nuevo — la mansión como escenario (envuelve `mansion/plano` y `mansion/rutas`).
- `packages/oficina/src/escenarios/trading/plano.ts` — nuevo — planta de la sala de trading.
- `packages/oficina/src/escenarios/trading/index.ts` — nuevo — el escenario trading.
- `packages/oficina/src/render/layout.ts` — modificar — `asignarPuestos(agentes, deptos, escenario = mansión)`; `Puesto.rutas`.
- `packages/oficina/src/render/animador.ts` — modificar — usa `puesto.rutas` en vez de importar `mansion/rutas`.
- `packages/oficina/src/animacion/colision.ts` — modificar — `crearMapaColision(nivel, planta = plano)`.
- `packages/oficina/src/presencia/simulada.ts` — modificar — opción `puntoLibre` (zona de paseo del escenario).
- `packages/oficina/src/definicion/definicion.ts` — modificar — `plano.plantilla` validado contra el registro y pasado a props como `escenario`.
- `packages/oficina/src/render/Oficina.tsx` — modificar — prop `escenario`, contexto, monta el dibujo registrado.
- `packages/oficina/src/render/Personas.tsx` — modificar — mapa de colisión y altura del avatar desde el escenario.
- `packages/oficina/src/index.ts` — modificar — exporta la API de escenarios.

Dibujo:

- `packages/oficina/src/render/escenarios/registroDibujo.ts` — nuevo — id → componente.
- `packages/oficina/src/render/escenarios/DibujoMansion.tsx` — nuevo — Cielo + Casa + EspejoAgua + CorteCasa.
- `packages/oficina/src/render/escenarios/trading/*.tsx` — nuevo — arquitectura, mobiliario, muro de datos (canvas animado), luz.

Vistas:

- `packages/oficina/src/render/camara.ts` — modificar — `encuadreGeneral(caja, ancho, alto)` por escenario; seguimiento más alto.
- `packages/oficina/src/render/ControlesCamara.tsx` — modificar — prop `vista` (general | seguir | zona:id).
- `packages/oficina/src/render/oclusion.ts` — nuevo — quién se interpone entre cámara y avatar (puro).
- `packages/oficina/src/render/Etiquetas.tsx` + `textoEtiquetas.ts` — modificar — cercanos + seleccionado, apilado.

Lab:

- `apps/lab/escenarios.html`, `apps/lab/src/escenarios/{main.tsx,Escenarios.tsx,escenarios.css,Selector.tsx}` — nuevo.
- `apps/lab/src/escenarios/medir.mjs` — nuevo — Playwright con GPU: capturas y p95 con 100 ocupantes.

## Pruebas

- `escenarios/registro.test.ts` — registro, id desconocido, no se puede registrar dos veces.
- `escenarios/mansion.test.ts` — igualdad con lo de hoy (puestos, rutas, colisión).
- `escenarios/rutasPlanta.test.ts` — cadena con nodos 0–4 y pausa; visita reescribe y quita.
- `escenarios/trading/plano.test.ts` — lugares dentro de su silla; salidas libres; cada ruta sin cruzar muebles; entradas libres y fuera de zonas de trabajo; vistas cubren la planta.
- `render/layout.test.ts` — puestos en trading; departamento desconocido cae en una zona común.
- `render/camara.test.ts` — encuadre general llena en horizontal y vertical (esquinas dentro, margen ≤ 15 %).
- `render/oclusion.test.ts` — persona entre cámara y avatar se marca; fuera del segmento, no.
- `render/textoEtiquetas.test.ts` — selección de etiquetas cercanas y apilado sin solapes.
- `definicion/definicion.test.ts` — `plano.plantilla: 'trading'` válida, id inválido reportado, `definicionAProps` entrega `escenario`.
- `presencia/simulada.test.ts` — `puntoLibre` respetado.

## Pre-mortem

- **Caminos**: el escenario entra por la prop, por `DefinicionOficina.plano.plantilla` y por el lab; los tres cubiertos. Cambio en caliente: rigs, puestos, mapa de colisión y navegación se rehacen (clave por escenario).
- **Fallas**: id desconocido → mansión + `console.warn`; planta sin café/luz → pausa en su propio pasillo.
- **Invariantes**: (1) la mansión no cambia (prueba de igualdad); (2) ningún lugar ni ruta cruza un mueble; (3) el avatar propio siempre en pantalla en «seguirme»; (4) cambiar de escenario no recarga la página.
- **Simetrías**: lo que se crea al montar un escenario (texturas canvas, geometrías) se libera al cambiar.
- **Reutilización**: `crearMapaDeCajas`, `crearNavegacion`, `encuadrarCaja`, tipos del plano.
- **Consumidores**: los 30 importadores de `mansion/plano` (lista en TABLERO 18:05): los de `render/casa/*` quedan iguales (son el dibujo de la mansión); cambian layout, animador, colisión, Personas, Oficina, camara, ControlesCamara, Asistente (reposo por escenario).
- **Datos reales**: definiciones guardadas con `plano.plantilla: 'mansion'` → mansión, sin cambios.
- **Variantes**: calidad alta/media/baja, con y sin avatar, `seguirAvatar`, `diagnostico.sinCasa`.
- **Afirmaciones**: README de `render/` y `docs/DECISIONS.md` (ADR 0012 escenarios) al cerrar.

## Fuera de alcance

- «Oficina» (paso 7): espera la confirmación del piloto.
- Editor de escenarios por el dueño; persistencia en servidor.
- Cambiar el diseño o la animación del personaje.

## Ejecución

| #   | Tarea                                                                                                                                                       | Agente           | Modelo · esfuerzo | Archivos                                                                                | Entrega                     |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ----------------- | --------------------------------------------------------------------------------------- | --------------------------- |
| 1   | Contrato, registro, mansión como escenario, desacople (layout, animador, colisión, simulada, definición, Oficina/Personas con contexto y dibujo registrado) | ejecutor         | sonnet · medium   | núcleo + `render/escenarios/{registroDibujo,DibujoMansion}`                             | diff + pruebas verdes       |
| 2   | Sala de trading: planta + dibujo con la dirección de arte, cuadro de estilo                                                                                 | ejecutor-critico | opus · high       | `escenarios/trading/*`, `render/escenarios/trading/*`                                   | diff + pruebas + 2 capturas |
| 3   | Vistas: encuadre general por escenario, seguir alto, oclusión, entrada fuera del grupo, nombres                                                             | ejecutor         | sonnet · medium   | `camara.ts`, `ControlesCamara.tsx`, `oclusion.ts`, `Etiquetas.tsx`, `textoEtiquetas.ts` | diff + pruebas verdes       |
| 4   | Lab: página `escenarios.html`, selector y control de vista propios, medición Playwright                                                                     | ejecutor         | sonnet · medium   | `apps/lab/escenarios.html`, `apps/lab/src/escenarios/*`                                 | diff + pruebas + script     |

Orden: 1 primero; luego 2, 3 y 4 en paralelo (archivos disjuntos). La integración, las capturas finales y la
medición las hace quien integra.

## Definition of Ready

- [x] Objetivo y criterios verificables.
- [x] Archivos verificados contra el código.
- [x] Supuestos de alto impacto declarados (contrato sobre los tipos del plano; prop + contexto).
- [x] Dependencias: ninguna externa; sesiones de movimiento y gráfica cerradas.
- [x] NFR: rendimiento (presupuesto arriba), accesibilidad (controles propios con teclado y foco).

## Closing check

(pendiente)

## Paso 7 — «Oficina» (OK de Elkis al piloto, 2026-11-14)

Planta abierta de un nivel con puestos, sala de reunión y zona de descanso, con el mismo contrato y la misma
vara que trading: idea visual propia, no una variante de color.

### Dirección de arte — «Nave de la mañana»

Idea: una nave industrial reconvertida con techo en diente de sierra; lo que se recuerda son las franjas de sol
de la mañana que entran en diagonal por los lucernarios y cruzan el piso y las mesas. Es el opuesto de trading
(noche, pantallas, latón): aquí manda la luz natural, el día y el trabajo en mesas compartidas.

- Hora fija ~10:00. Luz direccional cálida y baja que dibuja franjas por las ventanas del diente de sierra
  (se ven en el corte), cielo claro tras ventanales altos con marcos de acero negro.
- Materiales y paleta: muros de ladrillo encalado (#efe9df con junta), piso de cemento pulido claro (#cfc8bd,
  que recorte a las personas), roble claro (#c99b62) en mesas, acero negro (#2b2b2b) en marcos y patas,
  terracota (#c4673f) y salvia (#8fa98a) en tapices, macetas y sillas; acentos de equipo en las lámparas de
  cada mesa larga.
- Zonas: 4 mesas largas compartidas por equipo (`equipo-1`…`equipo-4`, 8 puestos cada una, monitores bajos);
  caja de vidrio de reunión con mesa grande y pantalla (contenido 'presentacion'); muro-tablero del equipo
  (pantalla 'tablero' con tareas); cocina con isla y taburetes; biblioteca/lounge con alfombra, sofás y
  estanterías; plantas grandes; bicicletas o detalles de nave para escala. Nada vacío ni plano.
- Intereses: 'reunion' (panel 'aula' o 'chat'), 'tablero' (panel 'agente' o propio), 'cocina' ('chat').
- Reuniones: isla de cocina, lounge, junto al tablero, dentro de la sala de reunión.

## Mundo recorrible (prioridad de Elkis, 2026-11-14: «todavía no puedes subir escaleras ni nada»)

Por delante de «Oficina» (que se detiene en su cuadro de estilo). Referencia de sensación: Roblox.

### Hoy

El avatar vive en un plano (x, z): `animacion/avatar.ts` no tiene altura, el salto es solo visual (`render/cuerpo.ts`
sube la pelvis), la colisión (`animacion/colision.ts`) y el A* (`animacion/navegacion.ts`) son de un nivel, y
`Personas.tsx` arma el mapa en `entradas[0].y`. Los agentes de la mansión sí cambian de planta por sus cadenas con `y`.

### Criterios

- [ ] Contrato: superficies caminables con altura (losas, escaleras rectas y de caracol, rampas, tarimas, muebles
      pisables) y consulta única `alturaEn(x, z, yActual)`; colisión según la altura; A* entre niveles por escaleras.
- [ ] Mansión: subir y bajar ambas escaleras, recorrer plantas superiores y azotea. Trading: tarima del aula.
- [ ] Salto con física de mundo: aterriza sobre lo que haya (tarima, sofá, mesa baja); cae al bajar de un borde.
- [ ] Animación en escalera: pie apoyado a la altura del peldaño, cuerpo inclinado, ritmo más lento al subir; también corriendo.
- [ ] Cámara: sube con el piso sin sacudirse; en la mansión corta en la planta del avatar.
- [ ] Sentarse (E o clic en silla, sofá o butaca; cualquier movimiento lo levanta) y aviso «E · abrir» en intereses;
      contrato de acciones extensible (puertas, objetos).
- [ ] Presencia: `y` y estado sentado viajan y se ven bien a 10 Hz; agentes de la mansión cambian de planta.
- [ ] Video 60 fps (escalera recta y caracol, caminando y corriendo, salto a la tarima, sentarse), revisado cuadro a
      cuadro; animación con 100 ocupantes ≤ ~2 ms. Entrega en una carpeta local.

### Ejecución

| #                                                                       | Tarea                                                                                                                                      | Agente                  | Archivos                                                                                                           |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| M1                                                                      | Suelo con altura: contrato, `alturaEn`, colisión por altura, A* multinivel, avatar con `y`, caída y aterrizaje; datos de mansión y trading | ejecutor-critico (opus) | `escenarios/{tipos,suelo,mansion,trading}`, `animacion/{colision,navegacion,avatar,salto}`, `render/Personas.tsx`  |
| M2                                                                      | Pies en peldaños, inclinación y ritmo; cámara con el piso y corte por planta; presencia con `y` interpolada                                | ejecutor (sonnet)       | `animacion/zancada.ts`, `render/{cuerpo,animador,camara,ControlesCamara,remotas}`, `render/casa/corte*`            |
| M3                                                                      | Acciones: sentarse y aviso «E · abrir»; contrato de acciones; estado sentado en la presencia                                               | ejecutor (sonnet)       | `escenarios/acciones.ts`, `animacion/avatar.ts` (tras M1), `presencia/tipos.ts`, `render/ControlesAvatar.tsx`, lab |
| M1 primero; M2 y M3 en paralelo después. Video y cierre: quien integra. |

### API de M1 (suelo con altura) — para M2 y M3

- Contrato (`escenarios/tipos.ts`): `Escenario.suelo?: DatosSuelo` = `superficies` (`SuperficiePlana` losa/peldaño/tarima/mueble, `SuperficieRampa`, `SuperficieSector` peldaño de caracol; cada una con `grosor`) + `solidos` (`Solido` con `y0..y1` y `radio?` de contacto) + `limites`, `paso?` (0,35), `altoCuerpo?` (1,7). Sin `suelo`, `sueloDe` arma uno plano desde `colision`.
- Consultas (`escenarios/suelo.ts`, puras, sin asignar; ~6 µs por cuadro con 100 consultas + 1 avatar): `alturaEn(suelo, x, z, yActual)` (cuerpo: la más alta a ≤ un paso por encima, o caída; `SIN_SUELO` si nada), `alturaPie(suelo, x, z, yCuerpo)` (pie: alcanza 0,6 m arriba, para apoyar el pie en el peldaño siguiente), `superficieBajo(suelo, x, z, tope)`, `puntoEnSuelo(...)` (clic bajo el corte). Subirse a un mueble sale de su geometría, no de una tabla por tipo: `sePisa(mueble)` es verdadero si su tapa (`y + alto`) está al alcance del salto (`PARAMETROS_SUELO.alcanceSalto`, 1 m; el salto sube 1,2 m) y el campo opcional `Mueble.pisable` no lo cierra (`false`: obstáculo, p. ej. la mesa que lleva una maqueta). `superficiesDeMuebles` lo vuelve una superficie en su tapa (el sofá en su asiento, `CARA_ASIENTO`) con la huella girada de `cajaDe`; el resto, un sólido `infranqueable` (bloquea a toda altura: ni se sobrevuela ni se aterriza encima). Un escenario sin `suelo` propio (oficina, sala de control) lo deriva de `colision()` + `planta.muebles` (`datosSueloDe`): la caja que es la huella de un mueble toma su geometría, el resto (muros, columnas) sigue bloqueando a toda altura. Los objetos del modo construir siguen la misma regla (`apps/lab/src/creacion/construir/solidos.ts`). A los demás, la altura viaja por presencia sin cambiar el códec: de pie, la `y` es la de los pies (la tapa); en el aire, el piso de despegue y, al caer, la cara donde aterriza (`alturaParaPresencia`).
- Colisión (`animacion/colision.ts`): `crearMapaDeSuelo(suelo)`; `puntoLibre/lineaLibre/moverConColision(..., y)` bloquean según la altura de los pies; caras de superficie con `RADIO_PIE`.
- Navegación: `crearNavegacion(mapaDeSuelo)` arma capas cada 1,2 m; `buscarRuta(nav, x0, z0, x1, z1, ruta, max, y0, y1)` cruza plantas por escaleras.
- Avatar (`animacion/avatar.ts`): `a.y` pies (física), `a.enSuelo`, `a.vy`, `a.ySuelo` (raíz del rig: apoyo suavizado) y `a.yCuerpo` (pies visibles); la pelvis sube `loc.salto.y = yCuerpo − ySuelo` (arco del salto; `salto.mundo = true`). `fijarDestino(m, x, z, corriendo, y)`. `alCambiar` entrega `y`.
- Datos: mansión en `escenarios/sueloMansion.ts` (piscina no pisable, azotea recorrible, bordes de seguridad invisibles en plantas altas y huecos), trading en `escenarios/trading/suelo.ts` (tarima, dos gradas, butacas sólidas).

### API de M3 (acciones: sentarse y abrir)

- Contrato (`escenarios/tipos.ts`): `Accion = AccionSentarse | AccionAbrir`, cada una sobre `AccionBase` (`id`, `tipo`, `nombre`, punto `x, z, y?`, `radio`). `AccionSentarse.asiento` = `{ x, z, y (pelvis sentada = cara + 1 cm), yaw, aproximacion }`; `AccionAbrir` = `{ interes, panel }`. Un tipo nuevo (`'puerta'`, `'objeto'`) es una forma más en la unión y su etiqueta en `ETIQUETA_ACCION`; las consultas solo leen `AccionBase`. `Escenario.acciones?` suma acciones propias (las 12 butacas del aula de trading).
- `escenarios/acciones.ts` (puro): `accionesDe(escenario)` deriva un asiento por silla, sillón, taburete y plaza de sofá que no sea puesto de un agente (con su aproximación libre) y un «abrir» por interés; `accionCercana(acciones, x, z, y, rumbo, actual?, excluir?)` elige la más cercana y mirada de frente, sin asignar; `accionBajoRayo` resuelve el clic sobre un asiento.
- Avatar (`animacion/avatar.ts` + `animacion/sentarse.ts`): `sentarEn(mando, accion)` / `levantarse(mando)`; máquina `libre → yendo → girando → sentándose → sentado → levantándose`. `Avatar.estado`, `Avatar.asiento`, `Avatar.yRaiz`. Teclas, salto o un clic al piso lo levantan. `AvatarPropio.alCambiar` entrega además `estado` y `asiento` (sentado, `y` es el asiento).
- `<Oficina onAccionCercana={(accion | null) => …}>`: avisa la acción a mano; el motor atiende la tecla E y el clic en el asiento; la aplicación dibuja «E · sentarse» (lab: `AvisoAccion`). Un asiento ocupado por otra persona no se ofrece.
- Presencia: `PersonaPresente.estado/asiento`; `crearFuenteSimulada({ asientos })` sienta un rato a algunas simuladas (determinista con la semilla; `ocupar(id)` reserva el asiento del avatar). Las remotas sentadas se posan en `render/poseSentada.ts` (su `y` es el asiento). Semántica única de `y` (`PersonaPresente`): de pie, el piso bajo los pies (en un salto también: el arco lo simula cada cliente con `saltos`); sentada, la altura del asiento. Las simuladas usan asientos de cualquier altura, siempre que se llegue a ellos por su piso de paseo.

## Personalización de la sala (pedido de oficina-creacion, 2026-11-14)

Después del video del mundo recorrible. Contrato acordado con oficina-creacion:

1. Hecho (d842d66): `<Oficina children>` se dibujan dentro de la escena.
2. Props `solidosExtra?: Solido[]` y `superficiesExtra?: Superficie[]` que se suman al suelo del escenario activo; el mapa
   de colisión y la navegación del avatar se rehacen al cambiar (arreglos estables).
3. Ids estables por pieza del mobiliario de la plantilla; prop `ajustesMuebles?: Record<id, { x, z, giro } | 'quitado'>`;
   función pura `aplicarAjustes(escenario, ajustes) → { escenario, errores: { id, motivo }[] }` que rehace colisión,
   suelo pisable, asientos/acciones e intereses y valida (no tapar entradas, rutas ni puestos de agentes);
   `piezasMovibles(escenario)` con id, nombre y huella. Los dibujos de trading y oficina pintan el mobiliario desde
   los datos.
4. `Escenario.variantes: { id, nombre, paleta }[]` (2–4 por escenario) y prop `variante?: string`; la hora de la
   variante manda si no llega `horaChile`.
