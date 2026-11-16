# @oficina/presencia

Presencia en vivo para el motor: dos o más personas en la misma sala se ven moverse y se oyen por cercanía. Implementa `FuentePresencia` (contrato de `@oficina/motor`) sobre LiveKit. Decisión: `docs/adr/0006-tiempo-real-y-voz.md`; brief: `docs/specs/presencia.md`.

## Qué hay

| Archivo            | Qué hace                                                                                                                                                                                                                                                         |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `codec.ts`         | Paquete de posición binario de 19 bytes, versionado (versión, flags, seq u16, x/y/z f32, rumbo u16, saltos u8). `esMasNuevo` compara `seq` en círculo para descartar paquetes viejos o repetidos.                                                                |
| `emisor.ts`        | Cadencia de envío (`hz` 10; quieto, solo un latido de 1 Hz) y guardia de pestaña oculta (pausa; desconecta tras N minutos; reconecta al volver).                                                                                                                 |
| `voz.ts`           | `planVoz`: a quién se oye. Entra a ≤ 4,5 m, sale a > 5,6 m (histéresis), misma sala cerrada siempre, volumen que cae con la distancia (cuenta la altura).                                                                                                        |
| `interes.ts`       | Gestión de interés **apagada** (`habilitada: false`): con más de 50 personas, posiciones completas solo a quienes están cerca y reducidas a los lejanos.                                                                                                         |
| `degradacion.ts`   | Red degradada emulada en el cliente (pérdida, retardo, jitter) para medir; las herramientas de Chrome no afectan a WebRTC.                                                                                                                                       |
| `fuenteLiveKit.ts` | `crearFuenteLiveKit`: conexión, posiciones por canal de datos sin garantía (tema `pos`), perfil por metadatos del participante, voz por suscripción selectiva (`autoSubscribe: false`), `hablandoIds`, silenciar, reconexión con espera creciente, tope de sala. |

## Uso

```ts
const fuente = crearFuenteLiveKit({
  url: 'ws://localhost:7880',
  obtenerToken: async () => (await fetch('/api/token?…')).json().then((r) => r.token),
  yo: { id, nombre, atuendo, escenario: 'trading' },
});
await fuente.conectar();
// <Oficina fuentePresencia={fuente} hablandoIds={fuente.hablandoIds} avatarPropio={{ …, alCambiar: (e) => fuente.publicarPropio({ …e, saltos }) }} />
// El micrófono se activa SOLO desde un clic: await fuente.activarMicrofono()
```

Todos los valores operativos (`hz`, radio, factor de salida, minutos oculta, tope de sala, interés) son parámetros con valor inicial; el panel de la oficina podrá reemplazarlos.

## Pruebas

`pnpm test` (lógica pura). Las pruebas con navegadores reales y las mediciones están en `apps/sala/e2e/`.
