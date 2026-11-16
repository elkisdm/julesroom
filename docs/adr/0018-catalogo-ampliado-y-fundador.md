# ADR-0018 — Catálogo ampliado y selección del fundador

## Contexto

El catálogo necesita decenas de objetos y conjuntos adicionales, conservando el motor de bloques y su coste. El fundador requiere una apariencia exclusiva en la interfaz sin introducir cuentas ni cambiar el protocolo de presencia. Los nuevos estilos deben cubrir piso, muro y acentos de los interiores construibles.

## Decisión

- Mantener fichas y partes normalizadas como datos. Huella, colisión, plazas y dibujo dependen de una misma ficha; las miniaturas usan las mismas partes. Instanciar por forma, color y transparencia con las geometrías existentes.
- Usar capas de vestuario ancladas al esqueleto existente. La chaqueta del fundador termina sobre las caderas para evitar atravesar las piernas al sentarse; no se incorpora simulación de tela.
- Verificar el código con Web Crypto SHA-256 y `VITE_HASH_FUNDADOR` opcional. Fallar cerrado en selección; registrar siempre el top para dibujar perfiles remotos. El hash no constituye autorización: con cuentas haría falta validar permisos en servidor.
- Conservar el tamaño del atlas de torsos, cuadruplicar celdas reduciendo su resolución y compartir fondos lisos por color. Rasterizar miniaturas secuencialmente y conservar su caché por apariencia.
- Agregar seis variantes de paleta y acabados, resueltas tanto en dibujo como precarga. Conservar geometrías y planos de los mundos. El piso del estilo nuevo sustituye el color horneado original; las variantes previas conservan su material.
- Mantener búsqueda/categorías y ocho recientes en memoria del panel. No cambiar el límite de colocación ni introducir virtualización para este volumen.

## Consecuencias

El catálogo crece sin texturas nuevas ni luces puntuales por objeto. Puertas/arcos necesitan colisiones por parte y los asientos un puente explícito a las acciones del motor. Las muestras de torso tienen menos resolución; debe verificarse visualmente. La exclusividad puede eludirse modificando el cliente. Los clientes antiguos muestran su top de respaldo al recibir ids desconocidos. Los juegos de mobiliario son decorativos. La propuesta de hamaca se descartó tras la revisión visual.

## Alternativas consideradas

Texturas/modelos externos por pieza aumentarían memoria y carga; un abrigo rígido largo atravesaría las piernas. Autorizar mediante un secreto en el cliente no aporta seguridad. Cuentas y concesiones verificadas en servidor son la evolución correcta, pero exceden este encargo. Virtualizar antes de medir añadiría complejidad innecesaria; las listas actuales y las miniaturas en caché cumplen el volumen pedido.
