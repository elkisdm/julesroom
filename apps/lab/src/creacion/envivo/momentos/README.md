# Momentos de grupo · D5

`Momentos` se compone dentro del Canvas de `Oficina`. Su interfaz usa una raíz DOM propia dentro de `.cr`,
por lo que nunca aparece dentro del PNG. Recibe `fuente`, `sesion`, `sala` y `proyector`
del consumidor de `useEnVivo`; no crea conexiones, no consulta secretos y no usa `window.__vivo`.
El panel solo aparece para la identidad del anfitrión y solo emite con transporte conectado.
Cada receptor compara la identidad autenticada del transporte con `sesion.dueno`.

Montaje previsto (única línea dentro de Oficina, cuando `paso === 'dentro'`):

```tsx
{
  paso === 'dentro' && (
    <Momentos fuente={vivo.fuente} sesion={vivo.sesion} sala={sala} proyector={proyector} />
  );
}
```

Importación: `import { Momentos } from './envivo/momentos/Momentos';`.
`Crear.tsx` está excluido por el encargo; la integración requiere una excepción explícita o que
el integrador añada esa línea. No se monta mediante globals de desarrollo ni metadata de perfil.

## Contrato y límites

- `d5/momento`, versión 1; ningún mensaje existente cambia. Versiones o tipos desconocidos se ignoran.
- 1.200 caracteres por paquete, 80 por texto, cinco segundos entre eventos del mismo tipo,
  repetición rechazada; apagar el foco es inmediato. Temporizadores de 1–60 minutos.
- Foto a `inicio + 3 s`, bienvenida de 6 s, confeti de 3,5 s. Reloj de fin absoluto,
  sin ticks de red. Los relojes de los dispositivos deben estar sincronizados; tolerancia de 10 s.
- Transporte fiable de LiveKit. Los eventos son efímeros: quien entra tarde no recibe eventos anteriores.
- Una pestaña suspendida más de 5 s no captura una foto atrasada. Puede volver a pedirla el anfitrión.
- Copiar usa ClipboardItem/PNG tras un clic y ofrece descarga cuando el navegador lo rechaza.
- La última tanda de fotos libera sus object URLs al reemplazarse, cerrarse o desmontarse.

## Render

`CapturaMomento` usa WebGLRenderTarget temporal, lectura de píxeles y pie con Bricolage Grotesque.
No activa preserveDrawingBuffer. La cámara habitual no se mueve; la toma amplia usa la esfera que
contiene a los participantes, con margen para cuerpos y aspecto vertical. El encuadre no reubica
personajes ni elimina obstáculos del escenario. Cada captura tiene tope de 1920 px de ancho.
`EfectosMomento` usa un mesh instanciado de 96 piezas; no crea geometrías o texturas por cuadro.
Atención atenúa las luces y el entorno, sigue al anfitrión y restaura intensidades al apagar/desmontar.
Con movimiento reducido el confeti permanece quieto, no hay destello ni animación de entrada.

## Verificación y alcance

Pruebas puras: protocolo con veinte receptores, autenticación, límites, repetición, hora de fin,
foto y bienvenida; encuadre horizontal/vertical con veinte posiciones. Sin Docker ni servidor remoto.
`verificar.mjs` abre una sola pestaña con un transporte en memoria explícitamente simulado y la
Oficina real. Guarda capturas, dos PNG y video; no cambia las credenciales ni el flujo productivo.
No se implementa baile/ola: no hay contrato público para gestos humanos consentidos en esta zona.

Ejecuta desde la raíz: `node apps/lab/src/creacion/envivo/momentos/verificar.mjs <carpeta-salida>`.
El servidor Vite debe estar activo en 5378. La carpeta se recibe por argumento para conservar el código portable.

## Resultado de esta entrega

- Lab: 12 pruebas verdes (seis de D5 y seis de compatibilidad existente).
- Motor: ocho pruebas verdes de encuadre, exportaciones y guardia. Rojo observado antes del código de protocolo y encuadre.
- Typecheck y lint de lab/motor: correctos. Prettier y revisión explícita del diff: correctos.
- Chrome real, una pestaña: panel a 1440/390/320, cuenta y dos PNG, copiar, foco reversible,
  confeti, bienvenida, fin del temporizador con reloj simulado, Escape con foco restituido,
  invitado sin panel y con una sola foto, rechazo de intruso, buffer persistente desactivado.
- Transporte en memoria con 20 participantes, sin Docker ni conexión a servidores remotos. Video de 13 s.
- Montaje productivo pendiente: no se modificó Crear ni ningún archivo excluido. El parche de montaje
  revisable se entrega junto a las capturas; necesita la excepción solicitada o integración por el dueño.
- Sin gesto de grupo, sincronización retrospectiva para nuevas entradas ni prueba de red real.
- No se ejecutó la suite completa ni se afirmó cobertura global: corresponde a quien integra.
