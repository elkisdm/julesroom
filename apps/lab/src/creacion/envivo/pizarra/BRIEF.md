# D8: explicar en una pizarra compartida

Feat grande, riesgo alto (puente y autorización), Tier 3. Origen: encargo D8.
Ejecución en sesión principal: adaptación Codex, delegación opt-in no solicitada.
Rutas verificadas: módulo nuevo pizarra; servidor/pizarra.ts y pruebas; package.json,
servidor/README; render/PizarraMundo.tsx, index.ts/index.test.ts; import y un montaje en Crear.

## Diseño y aceptación

Lienzo propio 1920×1080, textura persistente, tablero 6×3,375 m. JSON acotado y validación
manual como los contratos del proyecto (sin librería de esquemas instalada).
Puente HTTP loopback con código efímero, CORS exacto, cola de dos, aborto y cerebro inyectado.
CLI sin claves ni MCP; Explicar sin herramientas, Investigar solo WebSearch/WebFetch.

- Dado texto o voz, al explicar se dibuja uno de siete gráficos con ejemplo y textos ajustados.
- Dado Ampliar, se conserva contexto; el historial conserva versiones y permite volver.
- Dado invitado o emisor ajeno, no puede reemplazar el tablero; una entrada tardía pide estado.
- Dado puente ausente se ofrece el comando y escritura manual; salida inválida reintenta una vez.
- Dado muro o suelo insuficiente, colocar rechaza; no modifica mundo ni colisiones existentes.
- Dado origen/código incorrecto, exceso de cola o tiempo, el puente rechaza sin ejecutar más procesos.

## Pre-mortem

Caminos: voz, texto, manual, ampliar, borrar, historial, pedir foto y reconexión.
Fallas: puente caído/error/timeout → aviso y manual; JSON inválido → reintento + respaldo.
Invariantes: solo dueño, mensajes <15 KB, una CLI activa, barras con fuente; pruebas negativas.
Simetrías: borrar/historial también requieren dueño; invitados solo solicitan foto.
Reutilización: fuente.enviarDatos/suscribirDatos y escenario.colision; sin alterar protocolo existente.
Consumidores: solo módulos nuevos, render y montaje; los mensajes viejos no cambian.
Datos reales: sesión.dueno vacío hasta autorización pública; fuente puede ser null.
Variantes: simulada/real, explicar/investigar, individual/público, voz disponible/ausente.
Afirmaciones: README e informe distinguen simulación, red real y voz humana no probada.

## Verificación y ejecución

1. Tests rojos de modelo, comandos, mensajes, colocación y ajuste; implementar lógica/dibujo.
2. Tests de puente con cerebro falso; implementar CLI y HTTP sin invocarlo en tests.
3. Panel + tablero; Chrome local sin Docker; siete tipos, ampliar, historial, 1440/390 y video.
4. Tests propios --maxWorkers=2, typecheck/lint de ambos paquetes, diff explícito.
   DoR: rutas y criterios verificados, dependencias identificadas; seguridad, privacidad,
   accesibilidad y rendimiento cubiertos. Parámetros operativos en env; límites visuales en código.
   Fuera de alcance: persistencia entre sesiones, presentación/cine, deploy y cambios de voz en sala.

## Hallazgos adoptados antes de corregir

- La cámara de seguimiento recorta un tablero grande cerca del avatar. Agregar encuadre optativo
  «Mirar en el mundo» usando suspenderControlesCamara existente, con retorno a la pose anterior.
  Probar encuadre para 1440/390/320 y repetir capturas. No modifica el seguimiento global.
- Recuperación de entrada tardía se extrae a sincronizar.ts para probar 20 participantes en memoria.
- Al ampliar a mano un gráfico, se conserva el gráfico y se añade la idea al ejemplo; prueba de
  regresión roja/verde. No se reemplaza por una lámina vacía de tipo idea.
- En teléfono la lámina 16:9 tiene poco espacio: «Acercar para leer» permite recorrerla con scroll.

## Cierre verificado — 2026-11-15

- 27 pruebas nuevas verdes (8 archivos): contratos, textos máximos de los siete tipos, ampliación,
  comandos, colocación, historia, dictado, cliente, CLI falsa, código/CORS/PNA/cola/timeout.
- 6 pruebas del motor verdes: exportación pública y guardia. Typecheck y lint de lab/motor verdes;
  build del lab correcto, con advertencia existente de tamaño de chunks. `git diff --check` limpio.
- Pruebas negativas de autorización y código: quitar cada control hizo fallar su test; restaurados.
- Chrome, una pestaña: siete tipos, ampliar, historial, borrar, sin puente y escritura manual;
  capturas completas y en mundo a 1440/390, panel a 320, lectura ampliada móvil, cero errores JS.
  Inspección visual de los siete tipos y casos de longitud máxima: sin texto fuera de sus cajas.
- Dictado probado con adaptador Web Speech falso (es-CL, parciales, mantener/soltar V); 20 invitados
  en memoria, entrada tardía, rechazo de emisor ajeno y recuperación de estado.
- ÚNICA llamada real: fotosíntesis, Haiku configurado por defecto, HTTP 200, JSON válido tipo idea,
  sin respaldo, 7771 ms en puente / 7803 ms total. Simulación: 350–351 ms de puente; aparición 2 s.
- Evidencia en una carpeta local de capturas: PNG, resultados JSON, logs y video MP4
  de 26,6 s a 1440 px fijos. `e2e.mjs` reproduce el recorrido sin llamar a Claude.
- Revisión explícita de diff y archivos nuevos realizada en la sesión principal: identidad del
  transporte, tamaño de mensajes, cola hasta cierre efectivo, limpieza de textura/listeners y
  límites de alcance. No se invocó un comando de revisión de Claude ni se asumieron sus hooks.
- Pendiente de ensayo humano: micrófono real, búsqueda web real y transporte LiveKit real.
  Cobertura global no medida; suite completa reservada a quien integra por las reglas del encargo.
  En móvil y con textos máximos hay que ampliar para leer; no se certificó lectura a 15 m.
  La pizarra evita obstáculos al colocar, pero no añade un collider nuevo para los avatares.
- Cierre: navegador cerrado y puertos propios 5381/5390 libres, verificado con lsof. Sin Docker,
  commits, push ni acceso a servidores remotos.
