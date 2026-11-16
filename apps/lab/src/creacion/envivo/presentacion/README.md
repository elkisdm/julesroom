# Presentación compartida · D3

Módulo independiente de presentación, sin audio: la voz de la demo va por Meet.

- `Presentacion.tsx`: montaje **dentro** de `<Oficina>`, fuente/identidad del hook existente,
  suscripción, cámara y raíz de interfaz en `.cr`. El contexto del motor aporta también
  los sólidos y superficies extra del mundo construido.
- `colocacion.ts`: marco y pies sobre suelo continuo, sin intersecar sólidos; reduce a partir de 6 m.
- `protocolo.ts`: mensajes `d3/*`, validación del dueño, manifiesto y JPEG fragmentado.
- `sincronizacion.ts`: revisiones, prioridad de lámina actual, difusión compartida, acuse y reintento.
- `imagenes.ts`: conversión secuencial en navegador; máximo 1600 px y 200 KB por JPEG.
- `lienzo.ts`: tipografías del producto, texto y contador; solo redibuja al cambiar el contenido.
- `PanelPresentacion.tsx` / `presentacion.css`: anfitrión, flechas, visor ampliable y táctil.
- `prueba.html`, `prueba.tsx`, `prueba.mjs`: fixture solo de desarrollo con el hook real y Chrome.

El render `PantallaPresentacion` vive en `@oficina/motor`: marco 16:9, pies, textura liberada
al cambiar y láser interpolado sin asignaciones por cuadro. Conserva únicamente la textura
actual; las imágenes comprimidas (máximo 40 × 200 KB) permiten cambiar de inmediato.
Al encuadrar, la lámina se dibuja sobre los objetos y rótulos que pudieran taparla.

## Integración pendiente de excepción al alcance

El encargo prohíbe editar `Crear.tsx`, pero es el único componente que dispone de la fuente y
la sesión autenticada retornadas por `useEnVivo`. Se pidió autorización antes de tocarlo.
Sin esa excepción, el módulo está conectado en la fixture y **no aparece en `crear.html`**.
El montaje mínimo propuesto en `Crear.tsx` es un import:

```tsx
import { Presentacion } from './envivo/presentacion/Presentacion';
```

Y, dentro del `Suspense` de `paso === 'dentro'`, junto a `EscenaObjetosDentro`:

```tsx
<Presentacion
  fuente={vivo.fuente}
  sesion={vivo.sesion}
  proyector={proyector}
  avatar={pos.current}
  activo={!c.construyendo}
/>
```

## Límites y transporte

Los parámetros iniciales están en `PARAMETROS_PRESENTACION`; `validarArchivos` admite otro
límite de cantidad hasta el tope del protocolo. No hay dependencias ni servicios nuevos.
La fuente garantiza fiable y máximo 15.000 bytes. Los trozos base64 usan 10.000 caracteres;
se envía uno cada 60 ms (menos de 17/s), más hasta 15 movimientos de láser/s. El anfitrión
difunde una imagen una vez para todos los receptores que la necesitan, espera acuse por
imagen y participante, y reenvía hasta tres veces. Los ausentes salen de la espera.
Cada invitado vuelve a pedir lo que falta, primero la actual. Las imágenes ya recibidas
acusan duplicados sin reservar otra copia. La navegación no espera que termine el lote.
Solo la identidad autenticada del dueño puede emitir estado, trozos o láser aceptados;
pedir y acusar exige ser participante presente. No se confía en campos de rol del mensaje.
El manifiesto completo debe caber en un mensaje: un lote excepcionalmente grande de textos
muestra un error antes de cambiar el estado. Los mensajes de otros encargos se ignoran.

No persiste tras cerrar la pestaña anfitriona. No hay portada separada: la primera lámina
sirve de apertura. TURN, TLS y redes externas quedan fuera de la prueba local.

## Comprobar

```sh
pnpm --filter @oficina/lab exec vitest run src/creacion/envivo/presentacion --maxWorkers=2
pnpm --filter @oficina/motor exec vitest run src/index.test.ts --maxWorkers=2
pnpm --filter @oficina/lab typecheck
pnpm --filter @oficina/lab lint
pnpm --filter @oficina/motor typecheck
pnpm --filter @oficina/motor lint
```

Con LiveKit local, emisor en 5376 y Vite configurado con ambas URL en 5375:

```sh
node apps/lab/src/creacion/envivo/presentacion/prueba.mjs
```

La fixture crea tres contextos Chrome aislados, uno entra tarde. Genera doce PNG reales de
1920×1080, importa por el selector, verifica tamaño y compresión, sincronización y rechazo
de suplantación, cámara/Esc, láser, texto, visor a 390/320 px y texturas estables al navegar.
Las capturas, el video y `resultado.json` van a la carpeta D3 del escritorio; se pueden
cambiar las rutas con `DEMO_URL` y `DEMO_CAPTURAS`.
