# ADR 002 · La oficina pasa a ser la Mansión del asistente

Fecha: 2026-11-01. Estado: aceptado (pedido de Elkis: «está básica, recuerda que quiero una MANSIÓN»).

## Contexto

La oficina eran seis salas iguales en una grilla con escritorios. Elkis pidió una casa moderna de lujo (vidrio, hormigón, nogal, mármol, piscina infinita) vista en corte tipo casa de muñecas, con un ambiente propio por departamento, sin perder 60 FPS ni el contrato `<Oficina>` que monta la demo.

## Decisión

- **La casa es datos** (`src/mansion/plano.ts`): niveles, ambientes, muebles como huellas con `tipo`, lugares de trabajo, muros con vanos y escaleras. Las rutas (`src/mansion/rutas.ts`) y los tests de colisión leen esos datos; el render solo los dibuja.
- **Geometría procedural + texturas CC0** (Poly Haven, WebP 1k, ~350 KB) en vez de modelos GLB o generación con IA: cero costo, estilo coherente con las personas en bloque y control total del presupuesto de draw calls.
- **Luz simulada**: emisivos, charcos de luz pintados, como máximo 4 luces puntuales y un entorno PMREM para los reflejos. Sombras reales solo en calidad alta de escritorio.
- **Cámara en perspectiva con órbita de 360°** y corte que oculta los lados entre la cámara y el interior (por lado, con histéresis) y recorta los pisos de arriba con un plano de recorte al entrar a un ambiente.
- **Contrato compatible**: las props nuevas (`ambienteId`, `onAmbiente`, `vistaGeneral`) son opcionales.

## Consecuencias

- La escena pasa de ~81 a ~117 draw calls y ~385k triángulos con 30 personas. Con CPU 6× el p95 del build de producción queda en 14,6–16,9 ms en la vista general: cumple, con poco margen.
- Agregar un ambiente o un mueble es editar el plano y, si el `tipo` es nuevo, agregar su dibujo en `src/render/casa/ambientes/muebles.ts`.

## Alternativas consideradas

- **Modelos GLB de Kenney/Quaternius/Poly Pizza**: menos control del estilo y del costo; quedaron para piezas puntuales si hacen falta.
- **Generar la casa con IA 3D**: requiere OK de Elkis con monto y da mallas pesadas; descartada para esta etapa.
- **Vista isométrica fija** (como antes): Elkis la rechazó al probarla («la cámara solo puede ir a un solo lado»).
