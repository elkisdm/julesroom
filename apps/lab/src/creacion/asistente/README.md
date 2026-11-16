# Jules local

Jules funciona sin modelo ni solicitudes de red. `responder(pregunta, contexto)` en
`ayuda.ts` es el punto de extensión: devuelve texto breve, detalle, opciones y, si corresponde,
una orden o destino. Un proveedor futuro puede producir el mismo contrato.

- `control.ts` / `useJules.ts`: órdenes completas, estado y prioridad de E. J llama; no
  actúa dentro de campos de texto. Esperar y cualquier orden nueva cancelan la guía.
- `ayuda.ts` / `useAyudaJules.ts`: saludo de la pestaña, presentes, ayuda del anfitrión y
  recorrido de cinco pasos. La altura publicada es la del piso: el salto se observa por
  Espacio o el botón táctil. Siguiente y Terminar están disponibles en todos los pasos.
- `lugares.ts`: destinos del escenario actual sobre suelo libre; nunca inventa pantallas.
- `Jules.tsx` / `AyudaJules.tsx` / `jules.css`: menú anclado y opciones sobre el campo
  existente. No cambian su tamaño ni posición. El foco no desplaza la escena en móvil.
- `verificar.mjs`: Chrome real en 5388, una pestaña por vez, sin Docker. Recorre auditorio
  y oficina a 1440 y 390. `AK_FISICO=1` añade acciones reales a la secuencia de Siguiente.

El puente `ak-jules-control` es un evento **local**, no un paquete de la sala. Entrega al
render una referencia mutable: la física escribe posiciones y la interfaz escribe órdenes.
`ak-jules-lista` enlaza ambos montajes sin depender del orden de efectos. Al desmontar se
retiran timers/listeners y se desconecta el control. No se cambia el protocolo existente.
Las órdenes caminan por el navegador del motor, conservando colisión con muebles. En una
ruta fija se omite la separación suave entre personajes para poder adelantar al usuario
detenido en un pasillo; seguir conserva esa separación. Nunca se recupera teletransportando.

```sh
pnpm --filter @oficina/lab exec vitest run src/creacion/asistente --maxWorkers=2
AK_SALIDA=/ruta/de/evidencia AK_FISICO=1 node apps/lab/src/creacion/asistente/verificar.mjs
```

El verificador necesita Vite iniciado con `pnpm --filter @oficina/lab exec vite --port 5388 --strictPort`.

`presencia.ts` limita saludos y calcula mirada/paso lateral. `usePresenciaJules.ts` consume
el censo y la sesión D2 compartida; no envía mensajes. La pantalla colocada se reconoce
por el nombre de escena `pantalla-presentacion`, cacheada a 1 Hz. La ayuda usa un portal
anclado al rectángulo del formulario para no cambiar su geometría ni bloquear Presentar.

`AK_SALIDA=/ruta/de/evidencia node apps/lab/src/creacion/asistente/presencia-verificar.mjs`
prueba una pantalla colocada, llegadas y aplausos con tres participantes simulados en
memoria, y graba un video en Chrome. No requiere Docker ni conexiones externas.
