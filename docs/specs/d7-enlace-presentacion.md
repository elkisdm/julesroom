# D7 — enlace y presentación

Clasificación: fix/feat · presentación acotada · riesgo bajo · conocido · Tier 1.
Ejecución directa; sin delegación, Docker, red remota, commits ni publicación.

Objetivo: compartir Jules Room con una vista previa estática real y una entrada legible.
Supuestos: el nombre de la sala no llega al paso Nombre (Entrada solo entrega un borrador);
la bienvenida será general, sin afirmar un nombre de sala que no conocemos.

Rutas verificadas: crear.html (cabecera), public (assets), llegada.css y marcado de Llegada.tsx,
crear.css (bienvenida/disposición), pasos/nombre.css. Auxiliares necesarios: vite.config.ts
(sustitución estática de VITE_URL_PUBLICA), .env.example y vistaPrevia.test.ts (HTML compilado).

Aceptación:

- HTML compilado con OG/Twitter, título y descripción en español, iconos y manifiesto existentes.
- JPG 1200×630 ≤300 KB con captura real del mundo y personajes, sin imagen generada.
- URL absoluta con VITE_URL_PUBLICA; sin ella, referencias locales válidas. Noindex conservado.
- Portada legible a 1440, 390 y 320; CTA deshabilitado visible durante carga y transición suave.
- Bienvenida general antes del nombre, y formularios accesibles en ventanas bajas mediante CSS.
- Pruebas de llegada y HTML, typecheck/lint; capturas antes/después inspeccionadas.

Consumidores: crawlers sin JS leen crear.html; navegador lee los mismos metadatos/manifest.
Fallas: sin variable se usan rutas desde raíz; no se inventan dominio ni nombre de sala.
La lógica de disponibilidad y navegación de Llegada queda a la tarea que la posee.

## Cierre verificado

- 29 pruebas verdes: llegada, estadoFlujo, biblioteca y vistaPrevia. Las dos pruebas nuevas
  se observaron rojas antes de implementar y luego compilaron con y sin URL pública.
- `pnpm --filter @oficina/lab typecheck`, `lint` y `build`: exit 0. Build conserva el aviso
  de chunks grandes. HTML de `dist/crear.html` leído: etiquetas presentes y sin marcadores.
- JPG real 1200×630, 125.989 bytes. Captura de la oficina en el paso Invitar, con tres agentes
  y avatar propio; composición con Bricolage Grotesque e Inter cargadas explícitamente.
- Chrome real por Playwright, GPU Metal: antes/después a 1440×900, 390×844, 320×640;
  nombre también a 640×420 y 844×390. Llave probada en cuatro tamaños con respuestas HTTP
  locales interceptadas (salud 200, pase 401); no hubo LiveKit ni Docker.
- Campo y botón de llave comprobados con `elementFromPoint`, dentro del viewport y sin capas
  encima. La solución es solo disposición CSS: superficie opaca, apilamiento y scroll acotado.
- Preparación: HTML inicial con JS demorado, botón disabled; posición y tamaño idénticos tras
  cargar; clic final abre selección de sala. La lógica de disponibilidad quedó sin modificar.
- Contraste: nueve cuadros reales de la oficina luminosa y tres cotas con blanco puro detrás
  de la capa. Mínimo conservador 4,54:1 (incluye borde del atajo); título/bajada >13:1 en
  escritorio. JSON, medición por píxeles y capturas en la carpeta D7 del escritorio.
- Revisé explícitamente el diff y `git diff --check`: limpio. No se ejecutaron revisores
  delegados ni se presupuso ningún hook. No se tocaron Llegada.tsx, Crear.tsx, Entrada.tsx,
  MisSalas.tsx, envivo, el render ni vercel.json.
- Bienvenida general mediante CSS (también visible en creación propia): el paso no recibe el
  nombre de la sala invitada. Se conserva la navegación existente y la personalización.
- Pendiente de integración: fijar VITE_URL_PUBLICA al origen público real al compilar y probar
  la tarjeta/caché en WhatsApp tras publicar. No se accedió a producción ni se envió el enlace.
- Suite completa y cobertura quedan a quien integra; este encargo no añade lógica de producto.
