# Interfaz AF · Jules Room

Prototipo independiente en `/interfaz.html`. No importa estilos de creación ni conecta servicios.

```sh
pnpm --filter @oficina/lab exec vite --port 5383 --strictPort
pnpm --filter @oficina/lab exec vitest run src/interfaz/interaccion.test.ts src/interfaz/escenaDemo.test.ts --maxWorkers=4
pnpm --filter @oficina/lab typecheck
pnpm --filter @oficina/lab lint
```

Parámetros de entrada: `?tema=claro`, `?ambiente=noche`, `?vista=sistema`. Se pueden combinar.

## Responsabilidades

| Archivo                          | Función                                                                                  |
| -------------------------------- | ---------------------------------------------------------------------------------------- |
| `tokens.css`                     | Primitivos → semánticos → componentes. Oscuro por defecto, claro mediante `data-tema`.   |
| `sistema.css`, `componentes.tsx` | Botones, campos, selector, menú, diálogo nativo modal, hoja, pestañas, lista y feedback. |
| `iconos.tsx`                     | SVG propios, caja de 24, trazo de 1,5 y siluetas activas.                                |
| `interaccion.ts`                 | Contratos puros de teclado, exclusión de modos, gesto y texto.                           |
| `Interfaz.tsx`, `sala.css`       | Composición, estado de demostración, controles, atajos y adaptación por contenedor.      |
| `Escena.tsx`, `escenaDemo.ts`    | Oficina y trading del motor; cinco visitantes conocidos + avatar propio.                 |
| `Paneles.tsx`, `Palanca.tsx`     | Contenido contextual y entrada táctil del motor.                                         |
| `Galeria.tsx`, `galeria.css`     | Catálogo navegable de tokens, iconos, controles y estados.                               |
| `main.tsx`, `fuentes/`           | Montaje después de cargar Figtree local; licencia OFL incluida.                          |

## Decisión de arquitectura del prototipo

**Contexto.** La interfaz vive sobre escenas claras y oscuras, con varias capas de controles heredadas. La propuesta debe poder evaluarse sin afectar creación ni editor.

**Decisión.** Una entrada Vite separada y una clase raíz `.jr`. El riel elige un modo exclusivo. Un único `aside` desarrolla ese contexto, y pasa a hoja no modal en teléfono. Los diálogos usan `showModal()` para hacer inerte el fondo y atrapar foco. La escena memoizada conserva su Canvas durante tema/modos; se suspende al abrir la galería. La simulación de personas avanza fuera de React y las métricas solo escriben atributos de diagnóstico. No hay efectos de vidrio ni dependencias nuevas.

**Consecuencias.** Importar este módulo es una decisión explícita de migración. La página existente mantiene sus recursos. Los mensajes, objetos y preferencias son estado de ejemplo en memoria; se reinician al recargar. Construir añade piezas al boceto, no al mundo. Micrófono y reacciones no envían datos; presentar encuadra una zona; vista para grabar solo despeja la interfaz.

**Alternativas consideradas.** Cambiar `crear.css` habría mezclado evaluación visual y regresiones. Un iframe no permitiría componer controles con el motor. Vidrio traslúcido haría el contraste dependiente de cada cuadro. Un Canvas por miniatura añadiría costo; el catálogo usa SVG propios.

## Uso accesible

- Alt+1…6: modos; Alt+M: micrófono de ejemplo. No actúan mientras se escribe.
- Tab recorre controles. Flechas/Home/End seleccionan segmentos y pestañas; el selector confirma con Enter y cancela con Escape. También admite búsqueda inicial por letra.
- Escape cierra el nivel abierto y devuelve foco. Dentro de un diálogo, Tab/Shift+Tab no salen de él. Un selector abierto consume el primer Escape.
- El panel contextual no es modal: el mundo sigue disponible. Al comenzar a caminar se cierra. Micrófono y vista quedan disponibles en movimiento.
- En móvil, la hoja reemplaza temporalmente palanca/dock; la barra de modos permanece. Cerrar recupera las acciones de pulgar.
- `prefers-reduced-motion` suprime transiciones y paseo autónomo; la locomoción iniciada por la persona sigue disponible.
- Mensajes son texto React, sin HTML. Los enlaces de invitación usan el dominio reservado `.example`.

## Acento opcional

El valor inicial es blanco en oscuro y carbón en claro. Para evaluar latón, aplica al contenedor:

```css
.jr {
  --acento-personal: #e9b949;
  --sobre-acento-personal: #141414;
}
```

Solo afecta acciones primarias y conmutadores activos. El foco conserva su contraste neutro; el estado nunca depende solo del color. Vuelve a medir contraste si cambias cualquiera de estos dos tokens. No modificar la escala de grises para introducir una marca.

## Tipografía y movimiento

Figtree variable local (20,15 kB), pesos 400/500/600: aperturas claras, altura de x generosa y una voz humanista. Se precarga desde HTML y se espera su carga antes del primer texto; si falla, se informa en consola y se monta con la fuente del sistema. No se solicitan fuentes a servidores externos.

Ritmo 4 px; radios 8/12/16; altura mínima 44; riel 64 y losetas 48. Entradas 160 ms, presión/salida 100 ms, estados 120 ms. Sin rebotes. Las animaciones de salida del diálogo usan transiciones discretas de `display/overlay`; los paneles cierran inmediatamente para liberar el mundo y devolver foco sin demora.

Las mediciones y pruebas de navegador están en la entrega AF junto a `verificar.mjs`, `capturar.mjs`, `medir.mjs` y `contraste.mjs`; se ejecutan desde la raíz del monorepo para reutilizar Playwright de `apps/sala`.
