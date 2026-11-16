# Jules acompaña por rutas válidas

Este documento registra el Encargo N. El viaje permanente como orbe se sustituye por
la marcha articulada del [Encargo T](jules-camina.md), que conserva esta navegación.

Clasificación: fix, mediano, riesgo medio, Tier 2. Origen: Encargo N.
Objetivo: acompañar al avatar con colisión, suelo real y transformaciones continuas.
Alcance verificado: `render/Asistente.tsx`, `render/asistente/seguimiento.ts` y su prueba,
conexión mínima en `render/Oficina.tsx`. No se modifica cámara ni creación.

## Diseño y ejecución

Se reutilizan `avanzarAvatar`, su locomoción, `buscarRuta`, colisión y suelo: un mando interno
solicita destinos laterales alrededor del usuario. No se crea otro sistema de rutas.
La figura existente viaja como orbe, para no deslizar piernas rígidas. La forma nunca copia
un destino sobre la posición. Recuperación con contracción antes de recolocar en punto libre.
Ejecución en la sesión principal (delegación opt-in): pruebas rojas → controlador → conexión → videos.
Parámetros propios para distancia, frecuencia, aceleración, recuperación y tolerancias.

## Escenarios de aceptación

- Dado trading/oficina/mansión, al acompañar una ruta, cada posición y segmento quedan libres.
- Dado un usuario caminando/corriendo, tras acomodarse mantiene banda de compañía; quieto, frena.
- Dado un destino sin ruta o distancia excesiva, desaparece gradualmente y reaparece en punto libre.
- Dado cambio de nivel, sigue escaleras mediante navegación compartida.
- Dado cambio de forma, no se cambia la posición por la transformación.
- Las pruebas existentes de asistente y presencia se ejecutan sin modificarlas.

## Pre-mortem

- Caminos/consumidores: index sin avatar; escenarios y crear con avatar, props de Oficina → Asistente.
- Fallas: punto lateral sólido → buscar otro; sin ruta → recuperación; dt grande → límite compartido.
- Invariantes: suelo y sólidos compartidos; no interpolar atravesando; reposo sin replanteo continuo.
- Simetrías: ambas formas usan la misma posición física y ruta.
- Reutilización: avatar, navegación, separación y suelo existentes.
- Datos reales: los escenarios traen entradas, muros, muebles, superficies y varios niveles.
- Variantes: presente conserva reposo; reduced motion conserva colisión, sin teletransporte visible.
- Afirmaciones: evidencia en videos; registrar los recorridos que no se pudieron comprobar.

DoR: rutas y contratos leídos; sin dependencias externas; rendimiento con buffers reutilizados,
sin servicios ni coste de API. Verificación: pruebas propias (máximo 4 workers), typecheck y lint motor.

## Cierre verificado

- 17 casos nuevos: muro barrido, banda mínima/máxima a 2,3 y 4,8 m/s, reposo,
  geometría de las tres plantillas, recuperación lejana y sin ruta, transición,
  escalera real, cámara con agentes, inicio dentro de sólido y junto al usuario, sentado, separación durante la transformación y regreso al reposo y bloqueo de una ruta activa.
- Las 42 pruebas existentes de forma, posición, modelo, gesto y presencia no se modificaron.
- Cobertura aislada del controlador: líneas 100 %, funciones 100 %, ramas 95,77 %.
- Typecheck y lint de `@oficina/motor` verdes. No se ejecutó la suite completa, por encargo.
- Videos con reloj virtual a 60 fps; recorridos idénticos antes/después, más toma sentada.
  En el antes Jules queda casi siempre fuera de plano; en código se confirmó interpolación
  sin mapa ni suelo. En el después la geometría puede ocultarla durante parte de las escaleras.
- La inspección de muestras a 4 fps complementa los MP4; la evaluación perceptual continua
  a velocidad real queda para la revisión humana. No se afirma que equivalgan.
- El desplazamiento continúa siendo como orbe: las piernas de este modelo son geometría rígida.
  La persona espera, mira al usuario y se transforma antes de moverse.
