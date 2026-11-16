# Banco visual del catálogo

Abrir `/catalogo.html` con el servidor de desarrollo de Lab. Usa el motor real y no modifica la cámara ni la navegación del producto. No forma parte de las entradas de compilación de Vite.

- `?objeto=sofa-modulo`: pieza aislada, dimensionada desde su ficha.
- `?mini&conjunto=musgo`: conjunto completo con una identidad de muestra.
- `?mini&conjunto=lino&accesorio=mochila-urbana&pose=espalda`: accesorio aislado.
- `?mundo=trading&pose=sentado`: fundador con la pose del motor; también frente, tres-cuartos, espalda, caminando, grupo, saltando y saludando.
- `?rendimiento`: 150 objetos instanciados, 120 cuadros de calentamiento y 300 de muestra. El resultado queda en `window.__catalogoMedicion` (fps, p95 en ms, llamadas, triángulos, GPU).

La carga de este banco aísla el coste de las piezas. La comprobación en sala completa usa adicionalmente el instrumento de desarrollo existente `window.__crear`; no debe confundirse con el banco aislado. Los detalles de datos, materiales, exclusividad y límites están en `docs/catalogo/README.md`.
