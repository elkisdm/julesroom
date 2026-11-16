# Jules camina junto al usuario — Encargo T

Clasificación: feat, mediano, riesgo medio, Tier 2. Origen: Encargo T.
Ejecución en sesión principal: delegación opt-in. Sin cambios al avatar ni a cámara.

## Contrato y diseño

- Caminando/corriendo: reutilizar el controlador del avatar, el ciclo `calcularCaminata`
  y `ajustarAlTerreno`; articular las piernas de Jules conservando su apariencia.
- Quieto: frenar y orientar el cuerpo hacia el usuario. Mantener gestos y tableta.
- Orbe: distancia grande, ruta inexistente o desproporcionada; regreso cerca y sin carrera.
  Umbrales distintos y permanencia mínima; misma posición y velocidad durante la transición de 0,4 s.
- Sólidos, separación, sitios laterales y recuperación invisible conservan el contrato anterior.

## Archivos verificados y ejecución

1. `render/asistente/seguimiento.ts`: velocidad del acompañado, estado de ruta y escalera.
2. `render/asistente/acompanamiento.ts`: decisión de forma; pruebas rojas primero.
3. `render/asistente/modelo.ts`, `locomocion.ts`, `render/Asistente.tsx`: articulaciones,
   adaptación del ciclo compartido y render; pruebas rojas de avance por ciclo y reposo.
4. Pruebas propias e invariantes existentes, typecheck, lint; videos 60 fps antes/después.

## Pre-mortem

- Caminos: compañía, reposo, recuperación y ambas formas cubiertos.
- Fallas: sin ruta conserva recuperación invisible; dt limitado por controlador.
- Invariantes: misma física entre formas, segmentos libres, ciclo por distancia.
- Simetrías: entrar/salir del orbe conservan posición y velocidad.
- Reutilización: avatar, caminata, pisada, máquina de forma y navegación existentes.
- Consumidores: Asistente consume seguimiento y pose; API pública sin cambios.
- Datos reales: tres plantillas con muebles, escaleras y múltiples alturas.
- Variantes: presente y movimiento reducido conservan personalidad y colisión.
- Afirmaciones: distinguir cobertura automatizada de revisión visual pendiente.

DoR: rutas verificadas, criterios observables, sin dependencias nuevas; buffers por instancia,
máximo cuatro núcleos y sin servicios externos. Videos fuera del repositorio.

## Cierre

- 95 pruebas focalizadas verdes: originales de asistente, presencia y caminata sin modificaciones;
  nuevas de rig, zancada, terreno, histéresis, carrera, detención y espera con el usuario en un rellano.
- Zancada medida sobre el rig de Jules: deriva durante el apoyo inferior a 1,5 cm y altura
  de apoyo dentro de 6 mm a 2,3 y 4,8 m/s. El giro dibujado coincide con el físico.
- Se reutilizan las poses y el apoyo compartidos; no se cambian los parámetros del avatar.
- El sitio lateral conserva prioridad; si no cabe, se verifica una ruta corta para hacer fila.
  En un rellano ocupado frena y espera, sin intentar adelantar ni caminar en el sitio.
- Sentado: se elige un sitio alrededor del asiento y se navega desde Jules; no se exige
  una línea que nazca dentro de la silla. Probado con asientos reales de ambas plantillas.
- Typecheck y lint del motor verdes. Cobertura aislada: 100 % de líneas y funciones;
  los dos módulos nuevos tienen todas sus ramas cubiertas. Suite global reservada a quien integra.
- Videos con reloj virtual a 60 fps, comparación de recorridos idénticos y toma adicional sentada.
  Inspección de muestras a 4 fps en los tramos críticos; evaluación perceptual continua a velocidad
  real pendiente de revisión humana. La cámara puede cortar a Jules en partes de las escaleras.
- La toma larga de mansión no encontró un asiento caminable en la tercera planta; la toma sentada
  adicional usa un taburete real de la cocina. El umbral por distancia y la vuelta a persona se prueban
  en la simulación; no se afirma haber forzado ese umbral corriendo en la toma larga de mansión.
- Un clip adicional inicia al usuario lejos de la entrada, lo hace correr y frenar: Jules recupera
  distancia como orbe y vuelve a persona entre los segundos 3 y 3,6, conservando el movimiento.
- Revisión manual del diff; sin subagentes, commits, push ni cambios en cámara, editor o creación.
