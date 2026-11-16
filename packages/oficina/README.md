# @oficina/motor

La Mansión del asistente: una casa moderna de lujo en 3D (React Three Fiber) vista en corte tipo casa de muñecas, con un ambiente por departamento y personajes procedurales con vestuario por piezas y zonas. Sin modelos externos; texturas CC0 de Poly Haven en `src/render/casa/texturas/`. Diseño en `docs/brief-mansion.md` y decisión en `docs/adr/002-mansion.md`.

## Uso

```tsx
import { Oficina } from '@oficina/motor';

<Oficina
  agentes={agentes} // AgenteOficina[]
  onSeleccionar={(id) => {}} // id del agente tocado, o null
  visible={abierta} // false detiene el render por completo
/>;
```

Props opcionales: `seleccionadoId`, `enfocadoId` (acerca la cámara), `departamentos`, `catalogo`, `horaChile` (por defecto la hora actual de America/Santiago), `calidad` (`auto` | `alta` | `media` | `baja`), `onMetricas`, `presenciaAsistente` y `nivelVozAsistente` (ver abajo), y para la cámara `ambienteId` (ambiente en el que entra la cámara; controlado si llega), `onAmbiente(id | null)` (el usuario tocó un ambiente o salió) `vistaGeneral` (un número: cada vez que cambia, la cámara vuelve al encuadre inicial) y `derivaCamara` (rad/s de pico, por defecto 0: una deriva lenta y senoidal del azimut para que ningún plano quede quieto; respeta los límites del modo, p. ej. ±40° dentro de un ambiente, se pausa mientras el usuario arrastra o la cámara tiene inercia, y se apaga con `prefers-reduced-motion`; sin la prop la cámara no se mueve sola).

## Cámara

Órbita libre de 360° (arrastrar), zoom (rueda o pellizco) y paneo acotado (clic derecho o dos dedos), con inercia. Los lados de la casa que quedan entre la cámara y el interior se ocultan solos (`src/render/casa/corte.ts`, con histéresis); al entrar a un ambiente se recortan los pisos de arriba. Tocar un ambiente entra a él con una órbita corta; doble toque enfoca un punto. Con `prefers-reduced-motion` no hay inercia y los viajes son instantáneos.

Cada agente lleva `estado` (`trabajando` | `esperando_decision` | `libre`) y, opcional, `actividad` (`leyendo` | `escribiendo` | `pensando` | `hablando`). Los tipos están en `src/tipos.ts`. El contrato se mantiene estable y cualquier cambio se avisa antes a `asistente-demo`.

## Presencia del asistente

`presenciaAsistente` (opcional, tipo `PresenciaAsistente`) dirige el orbe desde fuera, p. ej. conectado a la voz. Por defecto `reposo`.

| Estado               | Qué se ve                                                                |
| -------------------- | ------------------------------------------------------------------------ |
| `reposo`             | Flota y respira                                                          |
| `escuchando`         | Anillos que se contraen hacia el orbe, brillo más fino, leve inclinación |
| `pensando`           | Satélites rápidos en órbita apretada, brillo irregular, tono teal        |
| `hablando`           | Pulsos de escala rítmicos con ondas hacia afuera, ámbar brillante        |
| `esperando_decision` | Pulso lento ámbar con un halo que parpadea como un farol                 |

`nivelVozAsistente` (0..1) modula la amplitud del pulso en `hablando`; sin él se usa un ritmo sintético. Las transiciones se interpolan (sin saltos) y `prefers-reduced-motion` reduce las amplitudes. La lógica es pura y está en `src/animacion/presencia.ts`; la capa R3F solo la aplica, sin crear objetos por cuadro. Cuesta como máximo 1 draw call extra (las ondas, solo cuando se ven).

## Vida emergente

Todo es interno y automático: no hay props nuevas en `<Oficina>` (`enfocadoId` y `ambienteId` ya existían).

- **Interacciones** (`src/animacion/interacciones.ts`): un coordinador puro, con reloj y azar inyectables, que corre a 4 Hz y escribe en estructuras preasignadas (una `Interaccion` y una `Vista` por persona). Dos libres que coinciden en la pausa del café conversan 4–9 s (se giran el uno hacia el otro, se alternan los turnos: quien habla gesticula, quien escucha asiente) y se separan; un libre sentado visita a un colega que trabaja en su sala (camina por el pasillo, se para a su lado, señala la pantalla mientras el colega gira la cabeza, y vuelve). Máximo una conversación por persona, una visita por sala y 20–40 s de espera entre visitas.
- **Rutas** (`src/animacion/ruta.ts`, `src/mansion/rutas.ts`): nadie cruza muebles ni muros. Cada lugar tiene una cadena de nodos con altura, de largo variable y armada una sola vez al crear a la persona (lugar → salida libre del mueble → pasillo del ambiente → vano de puerta → escaleras, tramo a tramo → cocina → barra de café). La altura del piso se interpola con la distancia horizontal en cada tramo de escalera. Los dos nodos siguientes al pasillo quedan libres para las visitas; los tests (`rutas.test.ts`) comprueban que ningún tramo entra en la huella de un mueble, que los muros solo se cruzan por su vano y que la altura solo cambia sobre una escalera.
- **Personalidad del rol** (`src/animacion/personalidad.ts`): un mapa `rol → perfil` con pesos de idle, destino del paseo y comportamiento de la pausa; el motor no tiene `if` por rol y los roles desconocidos usan el perfil neutro. El Científico lee, el Contador revisa papeles, Contenido prueba la luz en el aro, Desarrollo estira la espalda y toma café, Ventas habla por teléfono caminando en un círculo corto. La hoja y el teléfono son una instancia más (solo cuentan en los draw calls mientras se ven).
- **Mirada al orbe**: quien espera una decisión y está de pie mira al usuario y sigue al asistente cuando pasa a menos de 6 m (con retardo y el límite de giro de `calcularMirada`).
- **Atención al enfoque** (`src/animacion/atencion.ts`, usa `enfocadoId` y `ambienteId` de `<Oficina>`): lógica pura a 4 Hz, con reloj inyectable y estructuras preasignadas. El agente enfocado deja de caminar (el paseo queda congelado y lo retoma al soltarlo), gira cuerpo y cabeza hacia la cámara con el límite y el suavizado de `calcularMirada`/`suavizar` (sentado y con la cámara a menos de 45° de su silla, gira solo el torso; si pasa de 45° se para, da un paso al costado libre de muebles (`animacion/costado.ts`) y atiende de pie, y al soltar el enfoque vuelve a sentarse), hace un gesto una sola vez por enfoque (saluda con la mano de pie, asiente sentado, cuando ya está quieto) y luego queda atento, solo con respiración y parpadeo. El resto de su sala deja de pasear, cancela sus conversaciones y visitas y lo mira (o mira al asistente si está más cerca, con histéresis). Sin enfoque pero con la cámara dentro de un ambiente, su gente pasea a la mitad de ritmo y quien está sentado mira su pantalla.
- **`retenerEnSala`** (prop opcional de `<Oficina>`, por defecto `false`): mientras es `true` nadie sale de la sala de su departamento: sin pausas de café ni conversaciones (las visitas ocurren dentro de la sala) y quien está fuera vuelve a su lugar caminando por sus rutas al doble de ritmo. Sirve a los recorridos narrados, donde el narrador nombra un lugar y los agentes tienen que estar ahí; al soltarla vuelve la rutina normal.
- **`onProyector`** (prop opcional de `<Oficina>`): recibe una vez una función `proyectar(punto | idAgente)` que devuelve `{ x, y, visible }` en píxeles del lienzo con la cámara de ese instante (`null` si el agente no existe). Sirve para anclar HTML (tarjetas, cursores) a la escena; llámala en cada cuadro.
- **`encuadreLibre`** (prop opcional, por defecto `false`): con alguien enfocado, la cámara comprueba la línea de visión hasta su cara (muros, muebles altos y otras personas, `render/visual.ts`) y, si algo la tapa, rodea por el azimut (hasta ±75° del frente) o se acerca; sin la prop el encuadre es el de siempre.
- **`enfocaAsistente`** y **`asistenteDeFrente`** (props opcionales): la cámara enfoca al asistente en reposo (el `enfocadoId` se ignora) y ella mira directo a cámara.
- **`prefers-reduced-motion`**: sin paseos, conversaciones, visitas ni gestos de idle; solo respiración y parpadeo atenuados (el coordinador cancela lo que hubiera). La atención al enfoque conserva el giro hacia la cámara, pero sin saludo ni asentimiento.

## Vestuario como datos

Cada pieza declara su zona (`cabeza`, `pelo`, `expresion`, `cara`, `orejas`, `sombrero`, `espalda`, `mano`, `cuello`, `torso`, `cintura`) y qué zonas oculta. Solo cabe una pieza por zona. Agregar un paquete de skins es agregar entradas, sin tocar el motor:

```ts
import { catalogoBase, paqueteHalloween, registrarPaquete } from '@oficina/motor';

const catalogo = registrarPaquete(registrarPaquete(catalogoBase, paqueteHalloween), miPaquete);
```

Paquetes incluidos: `paqueteHalloween`, `paqueteNavidad` y `paqueteFiestasPatrias` (Chile). Un test comprueba que `resolver.ts` y `registro.ts` no mencionan ningún id de paquete.

Si una pieza nueva necesita dibujarse, se agrega una entrada por id en `src/render/accesorios.tsx` (`ACCESORIOS`: ancla `cabeza`, `columna` o `mano` y su geometría); el motor solo busca el id. Un top con diseño propio (p. ej. el suéter navideño) se registra por id en `TOPS_CON_DISENO` de `src/render/caras.ts`; los tops sin manga corta conocida llevan manga larga.

`resolverAtuendo(catalogo, atuendo)` normaliza un atuendo (tolera campos faltantes o sobrantes) y aplica las exclusiones.

## Estructura

| Carpeta                         | Contenido                                                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `src/catalogo`, `src/vestuario` | Datos del catálogo, paquetes, zonas y resolución de atuendos                                                                          |
| `src/animacion`                 | Lógica pura: máquina de estados, marcha, articulaciones, expresión, mirada, idle, rutas, interacciones y personalidad                 |
| `src/mansion`                   | La casa como datos (niveles, ambientes, muebles, lugares de trabajo, muros y vanos, escaleras, barra de café) y las rutas entre pisos |
| `src/ambiente`                  | Hora de Chile y luz del día                                                                                                           |
| `src/rendimiento`               | Percentiles, calidad adaptativa, visibilidad                                                                                          |
| `src/render`                    | Capa React Three Fiber: personas, Asistente, cámara (`camara.ts`, `orbita.ts`, `ControlesCamara.tsx`, `zonas.ts`)                     |
| `src/render/casa`               | Arquitectura, materiales PBR, luz por hora, cielo, paisaje, piscina, espejo de agua y corte de casa de muñecas                        |
| `src/render/casa/ambientes`     | Mobiliario (un dibujo por `tipo` del plano) y revestimientos por ambiente                                                             |

Toda la lógica de decisión está en TypeScript sin three y con tests; la capa `render` solo traduce a transformaciones.

## Pruebas y laboratorio

```bash
pnpm -F @oficina/motor test        # tests de lógica
pnpm -F @oficina/motor typecheck
pnpm -F @oficina/motor lint
pnpm -F @oficina/motor-lab dev     # http://localhost:5180
```

## Rendimiento medido

Mansión completa con 30 personas, build de producción del lab, Chrome del Mac con GPU y sin límite de cuadros (2026-11-01, máquina cargada por otras sesiones):

| Caso             | Draw calls | Triángulos | p95 CPU 1× | p95 CPU 6×   |
| ---------------- | ---------- | ---------- | ---------- | ------------ |
| Vista general    | 117        | 385k       | 2,7–2,8 ms | 14,6–16,9 ms |
| Dentro de Ventas | 92         | 293k       | 2,5–2,8 ms | 11,4–14,9 ms |

WebKit (Playwright, con vsync): 60 fps estables. En el servidor de desarrollo (React de desarrollo) el p95 con CPU 6× sube a 18–34 ms. Safari de iPhone **no está medido**: el lab se abre por red local (ver `apps/oficina-lab/README.md`) y el panel de rendimiento da las cifras.
