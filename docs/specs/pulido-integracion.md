# Corregir defectos de integración del onboarding

Clasificación: fix · mediano · riesgo medio · Tier 2. Origen: encargo G.
Ejecución en esta sesión, sin delegación (opt-in), commits ni operaciones externas.

## Objetivo y aceptación

Los nueve defectos del encargo quedan corregidos: avatar libre en las tres plantillas y tamaños,
nombre centrado incluso con giro y busto, fondo calmado sin agentes, miniaturas legibles,
API pública sin accesos relativos, script retirado, cuadro con colocación estricta sin colisión
al caminar, pestañas móviles completas y muestras compartidas.

## Archivos verificados y enfoque

- pasos/Vestidor3D.tsx, encuadreVestidor.ts, Personaje.tsx, personaje.css: composición del avatar
  en escena auxiliar del mismo renderer, sobre el fondo atenuado; ancla que sigue el centro real de la cabeza.
- pasos/BancoMundos.tsx, EscenaMundos.tsx, mundos.ts: imports públicos del motor.
- pasos/navegacionOpciones.ts y prueba: flechas en muestras y pestañas, Enter/Escape se conservan.
- pasos/MuestrasEstilo.tsx y CSS nuevos: muestras reutilizadas por ElegirMundo y PanelConstruir.
- construir/PanelConstruir.tsx, solidos.ts: conexiones mínimas; crear.css solo panel construir.
- editor/catalogo.ts y colocacion.ts: separar ocupación y bloqueo del paso.
- motor/index.ts e index.test.ts: exportaciones y contrato público.
- pasos/capturar-mundos.mjs y README: retirar script y documentación obsoleta.
- Crear.tsx: omitir agentes únicamente durante el vestidor.

## Escenarios y verificación

Dada cada plantilla y tamaño, al abrir el vestidor ningún sólido del mundo entra en la escena
del avatar; su volumen y etiqueta se proyectan en el área libre. Giro y busto mantienen el eje.
Dado un cuadro, al colocarlo sobre mueble, puesto o entrada se rechaza; al caminar no genera sólido
ni bloquea rutas. Las alfombras conservan sus reglas.
Dada una importación relativa del motor desde apps, la prueba de frontera la rechaza.
Dada una variante, ambas pantallas dibujan el mismo componente de muestras.
Pruebas específicas con máximo cuatro workers, typecheck y lint de lab y motor; capturas reales
1440×900, 390×844 y 320×640 en puerto 5335. Revisión explícita del diff (sin agente de revisión).

## Pre-mortem

- Caminos: vestidor al entrar/salir, cambio de plantilla, giro, busto, editor y caminar cubiertos.
- Fallas: sin servicios nuevos; renderer y cámara restauran estado al finalizar la composición.
- Invariantes: avatar separado del mundo; cuadro ocupa espacio; muestras únicas; frontera pública.
- Simetrías: colocación y rutas comparten noBloqueaPaso; caminar lo consume también.
- Reutilización: Persona/Flota del motor, estiloMundo, tokens de crear.css.
- Consumidores: tipoObjeto en colocacion y solidos; imports de pasos; Crear monta Vestidor3D.
- Datos reales: cuadros ya guardados usan el catálogo actual, sin migración de salas.
- Variantes: tres plantillas × tres tamaños; movimiento reducido y accesorios.
- Afirmaciones: README actualizado; no se afirma cobertura global (la corre quien integra).

DoR: rutas verificadas; supuestos reversibles; sin dependencias nuevas; accesibilidad y rendimiento
incluidos; archivos concurrentes limitados a las conexiones solicitadas.

## Hallazgos de verificación

- La figura detrás del avatar era el asistente del motor: el fondo usa el banco sin ocupantes.
- Las flechas eran interceptadas por el editor en captura: useNavegacionOpciones escucha en esa
  fase sin modificar useConstruir; prueba de navegador falló antes del ajuste y pasó después.
- A 320 la barra de construir recortaba «Listo»: sus controles pasan a una segunda fila y
  conservan áreas táctiles de 44 px. La prueba de captura también verifica sus límites.
- Las miniaturas amplían el rasgo según encuadreMiniaturas, probado antes de implementar.

## Cierre

- Defectos 1–3: composicionVestidor.test.ts (composición y geometría en 3×3 vistas),
  personaje.test.ts (encuadre/restauración); capturas de cuerpo, busto y giro.
- Defecto 4: encuadreMiniaturas.test.ts y mediciones reales de objetivos táctiles.
- Defectos 5–6: fronteraMotor.test.ts, motor/index.test.ts; script retirado de src y README actualizado.
- Defecto 7: colocacion.test.ts y solidos.test.ts, vistos fallar antes de corregir.
- Defectos 8–9: navegación probada primero en rojo en Chrome; después flechas, Enter, Escape,
  límites de pestañas/barra y selección de muestras pasan en los tres tamaños.
- Resultado: 49 pruebas específicas de lab y 16 de motor verdes; typecheck y lint de ambos verdes.
- Chrome real con GPU: 51 capturas finales, nueve combinaciones, cero errores de página y desbordes.
- Revisión explícita del diff completada, sin revisores delegados. Suite global y cobertura total
  reservadas a quien integra según el encargo. No se ejecutó commit, push, merge ni despliegue.
