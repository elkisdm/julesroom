# Catálogo y fundador

El top `fundador` se registra para que cualquier cliente actual pueda dibujarlo desde presencia, pero se excluye de los selectores públicos y del azar. En el paso Tú, «Tengo un código de fundador» aparece únicamente si `VITE_HASH_FUNDADOR` contiene un SHA-256 hexadecimal válido. Tras verificar el código con Web Crypto aparece «Vestir Fundador · Ónix». La selección equipa chaqueta, pantalón y botas; conserva piel, cara y pelo. Lentes oscuros y reloj son opcionales en Extras.

Configura `VITE_HASH_FUNDADOR` en el entorno de compilación de `apps/lab` y vuelve a compilar. Genera el SHA-256 del código exacto fuera del repositorio: espacios y mayúsculas cuentan. No guardes ni el código ni su hash real en archivos versionados. Sin la variable no se ofrece el conjunto. El desbloqueo vive en la sesión del panel; el atuendo elegido se guarda como los demás.

Es exclusividad de interfaz, **no una garantía criptográfica**: alguien que modifique su cliente puede enviar un atuendo propio. Con cuentas haría falta una concesión de fundador autorizada por el servidor y validar allí los cambios de apariencia y los metadatos de presencia. El protocolo actual acepta ids abiertos; un cliente antiguo normaliza un top desconocido a su top por defecto.

La página local `catalogo.html` es un banco visual del laboratorio: muestra el modelo real, los mundos existentes y las poses del motor, sin cambiar cámara ni navegación del producto. `?mundo=oficina|trading&pose=frente|tres-cuartos|espalda|caminando|sentado|grupo|saltando|saludando`, `?mini` y `?distancia` sirven para revisar.

## Contenido y navegación

Se agregan 24 conjuntos públicos en seis colecciones (Oficina, Creativa, Deportiva, Noche, Técnica y Abrigo), diez siluetas de torso y seis accesorios (lentes oscuros, gorro acanalado, audífonos de estudio, mochila urbana, reloj y bufanda de lana). Los conjuntos conservan piel, cara y pelo. Sus datos están en `packages/oficina/src/catalogo/colecciones.ts`; las capas articuladas, en `render/RopaColecciones.tsx`. El fundador queda fuera de colecciones, selectores y azar.

El catálogo de construir suma 52 piezas: 42 muebles/objetos y diez de construcción. `packages/oficina/src/editor/ampliacion.ts` contiene fichas en metros y partes normalizadas compartidas por dibujo y miniatura. Todas declaran `pisable`; las plazas de asiento declaran posición/altura/orientación. Los arcos, puertas, escalones y sombrillas usan volúmenes locales separados: no se rellena el hueco de la puerta. Las repisas tienen colisión elevada; las luminarias suspendidas y los cuadros no bloquean el paso. Los planos de hasta 15 cm siguen el criterio del motor. Los bancos con respaldo se pueden usar como asiento, pero no como plataforma.

Para agregar una pieza, registra su ficha y partes, verifica huella en los cuatro giros, `pisable`, altura del asiento y aproximación, y ejecuta las pruebas de ampliación y miniaturas. Una geometría nueva debe poder agruparse por forma/material con las existentes; ninguna de estas piezas agrega texturas ni luces puntuales. Arcade/futbolín/ping-pong son muebles decorativos: no implementan juegos. La propuesta de hamaca se retiró en la revisión visual porque su silueta rígida no alcanzaba la calidad del resto.

Construir y Vestidor incluyen búsqueda sin distinguir tildes/mayúsculas y los últimos ocho elementos elegidos, sin duplicados. Recientes dura la sesión del panel. Las miniaturas SVG de muebles se memoizan por tipo; las de ropa se rasterizan de una en una en el WebGL existente y se cachean por apariencia resultante. Para 70 piezas y 24 conjuntos no se necesita virtualización. En móvil, abrir una colección deja temporalmente el espacio de personalización a sus opciones; cerrarla recupera los controles individuales.

## Estilos y coste

Nórdico claro, Industrial, Noche · Ónix, Biofílico, Retro cálido y Minimal blanco se eligen desde Construir → Estilo. Cubren los dos interiores construibles, Oficina y Trading. Las claves de paleta y acabados viven en `escenarios/estilosCatalogo.ts`; los mundos conservan sus planos, geometrías y mobiliario. Los pisos nuevos sustituyen el tinte de la textura original para que el color elegido sea real. Las variantes anteriores conservan sus materiales. La precarga y el dibujo usan el mismo resolvedor de variantes.

El atlas de torsos mantiene 2.228.224 píxeles: pasa de 128 celdas de 128×136 a 512 de 64×68. Los fondos lisos de las nuevas prendas comparten celdas por color y los detalles viven en geometría. El compromiso es menos resolución por celda; las capturas permiten revisar ese detalle. No cambia el atlas de caras ni el códec de presencia.

`catalogo.html?objeto=<tipo>` muestra una pieza; `?mini&conjunto=<id>` muestra un conjunto; `?rendimiento` carga 150 piezas en un banco de render. El banco es solo de desarrollo, no una ruta del producto compilado. Para medir una sala completa se usa el instrumento existente `window.__crear`, con objetos validados por `evaluarColocacion`. El límite normal del editor permanece en 60; la prueba de 150 es una carga de estrés. Las mediciones corresponden a Chrome con GPU y deben repetirse en el hardware objetivo.
