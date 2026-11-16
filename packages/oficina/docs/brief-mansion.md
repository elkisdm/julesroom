# La Mansión del asistente · brief (etapa 4)

**Clasificación**: feat · large · riesgo medio (contrato `<Oficina>` que monta la demo) · incierto en lo visual · toca `packages/oficina/`, `apps/oficina-lab/`
**Tier**: 3 — Full

## Concepto (dirección de arte)

**«La casa en el cerro».** Una casa de arquitecto chilena, moderna, encajada en una ladera sobre el valle: losas de hormigón visto que vuelan, muros de vidrio de piso a cielo, madera cálida (nogal) en cielos y muebles, mármol blanco veteado en el atrio y la cocina. Se recuerda por tres cosas:

1. **El corte**: la fachada sur no existe. Se ve la casa entera como una maqueta de arquitecto, con el canto de las losas marcado (línea de hormigón de 30 cm) y el terreno cortado debajo (tierra y roca en sección).
2. **El atrio de doble altura** en el centro, con el núcleo del asistente flotando sobre un espejo de agua negro, una escalera escultórica de peldaños volados de nogal y una pasarela de vidrio que lo cruza por el fondo en el segundo piso.
3. **La piscina infinita** delante del primer piso, cuyo borde se funde con el valle: de noche refleja la casa iluminada.

Nada de cajas grises: cada ambiente tiene su material dominante, su luz y su objeto protagonista.

## Planta por piso (fachada abierta hacia la cámara, eje x de oeste a este)

Ancho total ~32 m, fondo de cada piso 8 m, altura libre 3,6 m por piso (losa 0,3).

| Nivel                         | Oeste                                                                                                                                         | Centro                                                                                                       | Este                                                                                                                                             |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Torre** (+11,7 m)           | —                                                                                                                                             | **Investigación**: observatorio con cúpula de cobre abierta, telescopio refractor y mesas de cartas celestes | —                                                                                                                                                |
| **Piso 3** (+7,8 m)           | **Desarrollo**: estudio con muros de pantallas (videowall curvo de 3×2), escritorios de nogal flotantes, sillas de malla                      | Rellano sobre el atrio + escalera de caracol a la torre                                                      | **Contenido**: estudio de grabación con paneles acústicos de fieltro, aro de luz, cámaras en trípode, mesa de mezcla y letrero de neón «AL AIRE» |
| **Piso 2** (+3,9 m)           | **Finanzas**: biblioteca de doble muro de libros con escalera corredera y la **bóveda** de acero (puerta redonda entreabierta, brillo dorado) | Vacío del atrio con baranda de vidrio                                                                        | **Ventas**: salón de negocios con sillones de cuero coñac, mesa de mármol, carro de bar y pantalla de pipeline                                   |
| **Piso 1** (0 m)              | **Personal · gimnasio** (máquina, pesas, espejo) y **living con chimenea** lineal de hormigón y sofá modular                                  | **Atrio** de doble altura: Asistente, espejo de agua, escalera escultórica                                   | **Cocina** de isla de mármol con barra de café (aquí van todos por su café)                                                                      |
| **Exterior** (0 m, al frente) | Terraza de deck de madera con reposeras                                                                                                       | **Piscina infinita** a lo largo de la fachada                                                                | Olivos y gramíneas en jardineras                                                                                                                 |
| **Terreno** (bajo 0)          | Corte de roca y tierra con raíces                                                                                                             |                                                                                                              |                                                                                                                                                  |

Escaleras: la escultórica del atrio une los pisos 1 ↔ 2 ↔ 3; una escalera de caracol en el puente lleva a la torre. Las personas suben y bajan por ellas.

## Paleta de materiales (PBR)

| Material              | Color base                                               | Rugosidad            | Metal | Dónde                                   |
| --------------------- | -------------------------------------------------------- | -------------------- | ----- | --------------------------------------- |
| Hormigón visto        | `#b9b5ae` con ruido fino                                 | 0,85                 | 0     | losas, muros, chimenea                  |
| Mármol blanco veteado | `#ece9e4` + vetas grises                                 | 0,18 (reflejo suave) | 0     | atrio, cocina, mesa de Ventas           |
| Nogal                 | `#6b4630` con veta                                       | 0,55                 | 0     | cielos, escalera, escritorios, libreros |
| Vidrio                | transmisión simulada (`MeshPhysical` con opacidad + env) | 0,05                 | 0     | muros traseros, barandas, puente        |
| Latón cepillado       | `#b08d57`                                                | 0,35                 | 1     | grifería, lámparas, bóveda              |
| Cuero coñac           | `#8a4b2a`                                                | 0,6                  | 0     | sillones de Ventas                      |
| Fieltro antracita     | `#2e3136`                                                | 0,95                 | 0     | paneles de Contenido                    |
| Acero negro           | `#1d1f22`                                                | 0,4                  | 0,8   | marcos, bóveda, telescopio              |
| Agua                  | azul petróleo `#1f6f7a` + reflejo del entorno            | 0,05                 | 0     | piscina, espejo del atrio               |

Texturas: Poly Haven CC0 a 1k (mármol, hormigón, madera), recomprimidas; si una no carga, el material cae a su color plano. Sin modelos pagados ni generación 3D (gasto: US$ 0).

## Luz

- **Hora de Chile manda** (`horaChile`): mañana fresca, mediodía neutro, **atardecer dorado** (18–20 h) y **noche de luna azulada** con la casa encendida por dentro.
- **Interior cálido simulado, no calculado**: cielos de nogal con tiras de luz LED (emisivas), lámparas colgantes de latón con halo, charcos de luz pintados en el piso (texturas aditivas) y como máximo 4 luces puntuales reales por escena. Nada de una luz por lámpara.
- **Reflejos**: entorno PMREM generado en el cliente (sala neutra para el interior + cielo para el agua), así el mármol, el vidrio y el agua brillan sin trazado de rayos.
- **Cielo**: degradado por hora, estrellas y luna de noche, cordillera en silueta al fondo (2 planos), sin niebla densa.
- Sombras reales solo con calidad `alta` en escritorio; en el resto, sombras de contacto horneadas bajo muebles y personas.

## Cámara (casa de muñecas)

- Perspectiva con lente larga (FOV ~28°), de frente y algo elevada; ve los tres pisos y la torre a la vez.
- Un toque en un ambiente vacío del piso **entra** a ese ambiente: la cámara viaja y se encuadra en él. Botón o toque fuera para **salir** a la vista completa. Órbita limitada (±25°) para no ver la casa por detrás.
- `enfocadoId` sigue acercando a una persona, como antes.
- Móvil vertical: la casa se ve completa (encuadre por ancho) y entrar a un ambiente llena la pantalla.

## Supuestos (corrígeme si algo no calza)

- Personal se reparte en living + gimnasio + terraza; la cocina es compartida (no es de ningún departamento).
- Cada ambiente tiene 6 lugares de trabajo (30 personas = 5 por departamento con holgura); el lugar 7 en adelante es de pie.
- Todas las personas se sientan a la misma altura de asiento (0,45 m); los muebles se dibujan para esa altura.
- Ruta al café: cada uno baja por la escalera del atrio hasta la cocina del piso 1.
- `departamentos` sigue siendo una prop: si llega un id que no está en la casa, esa persona va al atrio.

## Criterios de aceptación

- [ ] Se ve una mansión moderna de lujo en corte: 3 pisos + torre + piscina, con los 7 ambientes del programa reconocibles sin etiquetas.
- [ ] Materiales con PBR (mármol y agua con reflejo, vidrio, nogal, hormigón) e iluminación distinta de día, al atardecer y de noche según la hora de Chile.
- [ ] Las personas trabajan en su ambiente, suben y bajan por la escalera y toman café en la cocina, sin atravesar muros ni muebles.
- [ ] Tocar un ambiente acerca la cámara a él; salir vuelve a la vista completa. `enfocadoId` sigue funcionando.
- [ ] `<Oficina agentes onSeleccionar visible enfocadoId horaChile calidad onMetricas />` compila sin cambios en la demo (props nuevas opcionales).
- [ ] 30 personas: p95 ≤ 17 ms en Chrome (con CPU 1× y 6×) y 60 fps en WebKit; `visible=false` detiene el render.
- [ ] Capturas en una carpeta local y RESUMEN actualizado.

## Archivos a tocar (verificado contra el código: sí)

- `src/mansion/plano.ts` — nuevo — la casa como datos: niveles, ambientes (caja, departamento, material dominante), lugares de trabajo, cocina, escaleras y grafo de rutas.
- `src/mansion/rutas.ts` — nuevo — cadena de nodos con altura (salida del lugar → puerta → escalera → cocina).
- `src/render/layout.ts` — modificar — `asignarPuestos` toma los lugares del plano; `Puesto` gana `y` (altura del piso). `departamentosBase` se mantiene.
- `src/animacion/ruta.ts` — modificar — nodos con `y` y cadenas de largo variable.
- `src/render/animador.ts`, `src/render/Personas.tsx`, `src/render/Asistente.tsx` — modificar — `Y0` fijo → altura del puesto / del nodo.
- `src/render/casa/*.tsx` — nuevo — `Casa` (estructura fusionada por material), `Ambientes` (mobiliario por ambiente), `Piscina`, `Vegetacion`, `Cielo`, `materiales.ts`.
- `src/render/Luces.tsx` — reescribir — luz de la casa por hora.
- `src/render/camara.ts` + `src/render/ControlesCamara.tsx` (nuevo, sale de `Oficina.tsx`) — cámara de casa de muñecas y entrada a ambientes.
- `src/render/Oficina.tsx` — modificar — monta la casa en vez de salas/escritorios; props nuevas opcionales `ambienteId` y `onAmbiente`.
- `src/render/Sala.tsx`, `Escritorio.tsx`, `Objetos.tsx` — borrar cuando la casa las reemplace (cero código muerto).
- `apps/oficina-lab/src/Lab.tsx` — modificar — selector de ambiente y hora.
- `packages/oficina/README.md`, `docs/adr/002-mansion.md` — documentación.

## Tests

- `src/mansion/plano.test.ts`: ambientes sin solaparse, cada lugar dentro de su ambiente y sobre su piso, 6 lugares por departamento, todo departamento base tiene ambiente, la cocina y las escaleras conectan los 3 pisos.
- `src/mansion/rutas.test.ts`: ninguna ruta atraviesa muros ni muebles; las rutas que cambian de piso pasan por la escalera; la altura de los nodos es continua (sin saltos de piso fuera de la escalera).
- `src/render/camara.test.ts`: encuadre de casa completa en paisaje y retrato; entrar a un ambiente lo encuadra; salir vuelve.
- `src/render/layout.test.ts` (actualizar): puestos desde el plano, con `y`.
- Lab: medición con 30 agentes (como antes).

## Pre-mortem

- **Caminos**: los agentes llegan por props (demo y lab); `departamentos` personalizados → atrio. Cubierto.
- **Fallas**: textura que no carga → color plano (sin pantalla negra); sin WebGL → el texto de siempre.
- **Invariantes**: (1) nadie cruza un muro o mueble → test de rutas; (2) solo se cambia de piso por la escalera → test; (3) `visible=false` = frameloop `never` → test existente; (4) contrato de props → typecheck de la demo.
- **Simetrías**: subir y bajar por la escalera usan la misma cadena invertida.
- **Reutilización**: `Fusionados`, `Instancias`, `recursos.ts`, `avanzarNav`, `decidirCalidad`, `luzDelDia`.
- **Consumidores**: `Puesto` lo leen `animador.ts`, `Personas.tsx`, `Asistente.tsx` y `flota.ts` → cambian a `y`; `centroSala` y `ANCHO_SALA` los usan `Sala.tsx`, `Objetos.tsx`, `Etiquetas.tsx` y `layout.test.ts` → se reemplazan por el plano. La demo solo usa `Oficina`, `departamentosBase` y el catálogo → sin cambios.
- **Datos reales**: los agentes de la demo traen `departamento` con los 6 ids base.
- **Variantes**: `calidad` auto/alta/media/baja y `prefers-reduced-motion` (sin paseos ni escaleras).
- **Afirmaciones**: README del paquete y RESUMEN se reescriben con lo medido de verdad.

## Fuera de alcance

- Generación 3D con IA (requiere tu OK con monto).
- Lip-sync y cuerpo del asistente (sigue siendo el núcleo de luz).
- Medir en iPhone real (sigue pendiente de tu lado).

## Ejecución

| #   | Tarea                                                                              | Agente           | Modelo · esfuerzo                                                              | Archivos                                                                                            | Entrega             |
| --- | ---------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | ------------------- |
| 1   | Plano como datos, rutas con escaleras, puestos con `y`, animación por pisos        | ejecutor         | sonnet · medium                                                                | `src/mansion/*`, `layout.ts`, `ruta.ts`, `animador.ts`, `Personas.tsx`, `Asistente.tsx`, `flota.ts` | diff + tests verdes |
| 2   | Arquitectura, materiales PBR, luz por hora, cielo, piscina y vegetación            | ejecutor-critico | opus · high (es el corazón visual; el criterio de arte pesa más que el riesgo) | `src/render/casa/*`, `Luces.tsx`                                                                    | diff + capturas     |
| 3   | Mobiliario de diseño de los 7 ambientes                                            | ejecutor-critico | opus · high                                                                    | `src/render/casa/ambientes/*`                                                                       | diff + capturas     |
| 4   | Cámara de casa de muñecas, entrar/salir de ambiente, montaje en `Oficina.tsx`, lab | ejecutor         | sonnet · medium                                                                | `camara.ts`, `ControlesCamara.tsx`, `Oficina.tsx`, `apps/oficina-lab/src/*`                         | diff + tests verdes |

Orden: 1 primero (fija el plano que leen los demás); luego 2 y 4 en paralelo (archivos distintos); 3 después de 2 (usa sus materiales). La integración, la revisión visual, la medición y las capturas las hago yo.

## Cierre de la etapa (2026-11-01)

| Criterio                                                            | Estado                          | Prueba                                                 |
| ------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------ |
| Mansión en corte con los 7 ambientes reconocibles                   | Hecho                           | las capturas 10 a 21 en una carpeta local              |
| PBR y luz por hora de Chile                                         | Hecho                           | `casa/luz.test.ts`, `oclusion.test.ts`; capturas 01–04 |
| Personas por pisos, escaleras y café sin atravesar muros ni muebles | Hecho                           | `mansion/rutas.test.ts`, `render/animador.test.ts`     |
| Tocar un ambiente para entrar y salir; `enfocadoId`                 | Hecho                           | `camara.test.ts`, `zonas.test.ts`, `orbita.test.ts`    |
| Contrato `<Oficina>` compatible                                     | Hecho                           | `pnpm -F @asistente/web typecheck` en verde            |
| p95 ≤ 17 ms con 30 personas; 60 fps en WebKit                       | Hecho, con poco margen a CPU 6× | README del paquete, «Rendimiento medido»               |
| Capturas y RESUMEN                                                  | Hecho                           | una carpeta local                                      |

Fuera del brief, a pedido de Elkis: órbita libre de 360° con corte de casa de muñecas adaptable al ángulo, doble toque para enfocar y «Vista general».

## Para retomar

**Cómo levantar el lab:** desde la raíz del repo, `pnpm -F @oficina/motor-lab dev` y abrir http://localhost:5180. Hay un selector de ambiente, un deslizador de hora simulada, un selector de 9, 18 o 30 personas y los botones «Salir» y «Vista general». Apágalo con `lsof -tiTCP:5180 -sTCP:LISTEN | xargs kill`.

**Qué quedó hecho:** el plano como datos con las rutas entre pisos, la arquitectura, los materiales PBR, la luz por hora, el cielo y la cordillera en 360°, el terreno en estratos, la piscina infinita, el espejo de agua del atrio, el mobiliario de los 7 ambientes (30 tipos de mueble), los revestimientos por ambiente y la cámara de 360° con el corte adaptable.

**Qué falta o se puede mejorar:**

- Margen de rendimiento con CPU 6× en la vista general (14,6–16,9 ms). Candidatos: congelar las matrices de los grupos estáticos de mobiliario (`updateMatrixWorld` pesa ~7 % en el perfil) y fusionar más mallas del mobiliario.
- Medir en un iPhone real (Safari y WKWebView).
- En celular (390 px) la casa queda chica en la vista general y el doble toque acerca demasiado.
- El espejo de agua del atrio todavía se lee como un tapete oscuro desde la vista general.
- El ocultamiento de los lados es instantáneo, sin fundido.
- Una persona en un piso recortado deja de dibujarse, pero sigue captando el toque.
- Las sombras de contacto junto a un muro oculto siguen visibles.
- Personal: el gimnasio y el living no conversan entre sí, porque las interacciones son por ambiente.
- Contenido usa como pausa el aro de luz y no baja a la cocina.
