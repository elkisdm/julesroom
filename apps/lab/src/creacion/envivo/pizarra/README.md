# Pizarra D8

Un único montaje `PizarraViva` dentro del Canvas conecta la sesión existente sin modificarla.

- `modelo.ts`: unión de siete tipos, validación acotada, respaldo, reducción al ampliar y comandos.
- `dibujo.ts`: layout puro, ajuste medido de texto y lienzo 1920×1080; `laminaActual()` es el contrato
  de integración con presentación. La textura vive durante todo el montaje y se actualiza por evento.
- `mensajes.ts` / `sincronizar.ts`: prefijo `d8:`, identidad del transporte, revisiones monótonas,
  recuperación por foto y cuota de solicitudes. Los mensajes existentes no cambian.
- `colocacion.ts`: huella conservadora, muros/obstáculos, límites y muestras del suelo; no añade una
  colisión al avatar. `MirarPizarra` usa la suspensión pública de cámara y devuelve la pose al salir.
- `PanelPizarra.tsx` / `dictado.ts` / `cliente.ts`: panel solo del dueño, dictado Web Speech es-CL,
  alternativa de texto, puente autenticado por código y modo manual sin modelo.
- `historia.ts`: 30 láminas en memoria; una nueva versión tras volver abre una rama del historial.
- `servidor/pizarra.ts`: handler Fetch con cerebro inyectable; CLI real aislada y simulador explícito.

Los detalles de arranque, configuración y límites están en `apps/lab/servidor/README.md`.
Los tests no llaman a la CLI. La verificación visual usa una sola pestaña Chrome y el simulador.
El canvas es la fuente visual compartida: los invitados reciben JSON, nunca imágenes por cuadro.
La lectura en teléfono puede ampliarse con «Ver grande»; la cámara optativa muestra el tablero entero.
