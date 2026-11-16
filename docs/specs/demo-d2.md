# Dinámica D2 para la demo

Clasificación: feat · grande · riesgo alto (mensajes compartidos) · Tier 3.
Origen: encargo D2, demo de noche. Límite de 50 minutos; ejecución en esta sesión,
sin delegación, conforme a la adaptación Codex y al opt-in del usuario.

## Objetivo y alcance

Nombres legibles para veinte personas, reunir/seguir con consentimiento, reacciones,
votación espacial y grabación limpia. Cada prioridad se cierra y prueba antes de la siguiente.
Rutas verificadas: `envivo/Presencia.tsx`, `Dentro.tsx`, `envivo/envivo.css`, módulo nuevo
`envivo/dinamica/` y `packages/oficina/src/render/`. Sin cambios en Crear, Entrada,
useEnVivo, pasos, servidor ni presentación. No cambia el protocolo existente.

## Diseño y ejecución

1. Nombres: conservar SDF instanciado; humanos siempre elegibles y tamaño mínimo legible.
   Marca de anfitrión anclada con el proyector existente. Test de apilado con 20 nombres.
2. Reunir: mensajes `d2-*` fiables desde el dueño autenticado; invitación 5 s,
   aceptación predeterminada, rechazo explícito. Semicírculo con destinos libres y separados.
   El render valida de nuevo la colisión antes de trasladar. Seguir usa navegación existente;
   movimiento manual cancela. Tests de autoridad, límites, colisión y separación.
3. Reacciones: cada emisor solo modifica su reacción, cuota local y receptora; mano persistente
   ordenada por llegada. Test de caducidad, cuota y orden. Sin audio.
4. Votación: solo si quedan terminadas las anteriores y tiempo de E2E; en caso contrario intacta.
5. Grabación: H/Esc fuera de campos; ocultar UI conservando mundo y rótulos, aviso 1 s.

## Escenarios

Dadas 20 personas visibles, al alejar cámara sus nombres siguen legibles y no se descartan.
Dado un invitado, al intentar llamar o dirigir no cambia a otros.
Dada una llamada válida, Ir o 5 s traslada a lugar libre; Quedarme conserva posición.
Dado seguimiento aceptado, al caminar el dueño los demás lo siguen; moverse libera.
Dadas reacciones simultáneas, cada avatar muestra la suya; manos duran hasta bajarse.
Dado un campo de texto, 1–5/H no interfieren; fuera de campos H entra y H/Esc sale.

## Pre-mortem / DoR

Caminos: conectar, desconectar, entrada tardía y reconectar; estado efímero, sin persistencia.
Fallas: envío fallido muestra error; dueño ausente cancela seguimiento; dato inválido se ignora.
Invariantes: autoridad firmada, reacción por identidad, mensajes acotados, posición libre.
Simetrías: cuota al enviar y recibir; teclado y táctil equivalentes.
Reutilización: FuenteLiveKit, Mando/fijarDestino, Proyector y SDF existentes.
Consumidores: Presencia comunica conexión a Dentro; Personas consume orden local validada.
Datos reales: identidades aleatorias, posiciones mutables, fuente nullable al iniciar.
Variantes: público/local/individual; controles compartidos solo con conexión y dueño conocido.
Afirmaciones: el cierre distingue evidencia local de producción y pendientes.
NFR: sin secretos, sin dependencias, sin geometrías/texturas por cuadro, reduce-motion y foco.
Objetivo/rutas/dependencias/supuestos verificados. Verificación: pruebas focalizadas,
typecheck/lint de lab y motor, diff explícito (sin comandos de review Claude), Chrome real
con LiveKit Docker propio y emisor 5374/lab 5373; evidencia en destino D2 del encargo.

## Cierre verificado

- Nombres: 20 candidatos persistentes, apilado limitado por el encuadre y corrección lateral;
  `nombresVivos.test.ts` más captura real con 20 conexiones.
- Reunir/seguir: Chrome con un dueño y dos invitados probó Ir, Quedarme, espera sin traslado
  antes de 5 s, aceptación predeterminada, desplazamiento autónomo y liberación manual.
  El render vuelve a comprobar obstáculos, límites y apoyo; pruebas de muebles añadidos.
- Reacciones: botones/1–5 compartidos, manos en orden, mano independiente de risa y bajada,
  aplauso de tres personas. Estado de manos por conexión, incluido constructor desmontado.
- Votación: pregunta escrita, zonas de suelo, invitado caminando, conteo y ganador remoto.
  Pruebas de empate, cero votos, otra planta, validación de forma y autoridad.
- Grabación: H/H/Esc, aviso de 1 s, rótulos conservados y escritura sin capturar atajos;
  capturas escritorio/390/320 px inspeccionadas.
- `vitest` focalizado: lab 24 y motor 60 pruebas verdes. Typecheck y lint de ambos: exit 0.
  Build de lab: exit 0; warnings de tamaño de chunks y de import estático/dinámico de solidos.
  Sin medición de cobertura disponible por paquete; la suite completa queda a quien integra.
- E2E local: 20 conexiones (3 perfiles Chrome aislados y 17 clientes ligeros), sin errores de
  página. Muestra de 60 cuadros: p95 16,7 ms con 3 y 16,8 ms con 20; 111 llamadas de dibujo en ambos.
  Es medición local, no garantía en otros equipos ni prueba de redes externas.
- Diff revisado explícitamente: autoridad por transporte, límites, cuotas, limpieza de timers,
  UI visible/oculta, zonas reservadas y `git diff --check`. No se presuponen hooks de Claude.
- Artefactos en el destino D2 del encargo: PNG, `resultado.json` y `demo-d2.mp4` (24 s).
  No se hicieron commits, push, acceso remoto ni despliegues.
- Pendiente opcional: «Ir con persona». Limitaciones: manos sin historial para quien entra
  después de levantarlas; votación efímera al desmontar la dinámica del anfitrión.
- Limpieza comprobada: puertos 5373/5374 sin procesos escuchando; contenedor
  `demo-d2-livekit` detenido y eliminado, sin otros contenedores D2 restantes.
