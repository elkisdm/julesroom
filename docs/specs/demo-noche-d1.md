# Recuperar la sala y entrar sin tropiezos (D1)

Clasificación: fix/feat, mediano, riesgo medio, conocido; Tier 2. Origen: encargo D1.
Ejecución en sesión principal, sin delegar (instrucción opt-in del encargo).

## Objetivo y aceptación

1. Dada una sala guardada con capacidad de dueño, al reabrir desde portada, Mis salas,
   recarga o Invitar, se solicita pase para la misma sala en vivo. Otra sala guardada es independiente.
2. Dado 429, sala llena o red caída, se muestra el motivo y se reintenta con espera creciente;
   solo un rechazo de llave muestra su formulario. La sala individual sigue disponible.
3. Dada una llave confirmada, recargar conserva la llave en sessionStorage, nunca URL/localStorage.
4. Invitación: nombre → personaje → dentro; opción Entrar ya, sin navegación de creador.
5. Variable de compilación sin voz, si se completa: sin captura/publicación/suscripción ni UI de voz.
6. Opcional: contador y copia con confirmación en Invitar.

## Rutas verificadas y ejecución

- `apps/lab/src/creacion/envivo/{useEnVivo,configuracion,LlaveDemo}.tsx/ts`: conexión y errores.
- Nuevo `envivo/recuperacion.ts` + test: relación sala guardada → sala viva con capacidad local.
- `apps/lab/src/creacion/{Crear,Entrada}.tsx`, `pasos/{Nombre,Invitar}.tsx`: entrada.
- `apps/sala/server/demo.ts` + test: cupo consultado a LiveKit antes del pase (punto 2).
- `.env.example`, guía y README de envivo: documentar lo terminado.
- Presencia: únicamente condición de voz de una línea, si se completa el punto 5.

## Diseño y pre-mortem

- Caminos: portada, biblioteca, invitación, recarga, Invitar repetido; todos verificados en Chrome.
- Fallas: 401 requiere llave; 429/503/red reintentan; 404 sala caducada requiere nueva creación propia.
- Invariantes: enlace sin secretos; capacidad local no concede rol sin pase; cada guardada tiene relación propia.
- Simetrías: entrar y volver a Invitar consultan la misma relación, no una variable global de pestaña.
- Reutilización: solicitarDemo, autorizarSesion, FuenteLiveKit y sus reintentos existentes.
- Consumidores: Crear calcula rol; LlaveDemo separa llave/reintentos; Entrada acorta navegación.
- Datos reales: guardada con id, demo/dueno por sala viva, sesiones previas sin relación: migración conservadora.
- Variantes: público, local explícito y sin configuración; variable sin voz conserva valor por defecto.
- Afirmaciones: documentación actualizada sin afirmar despliegue ni redes externas verificadas.

## Verificación

TDD de recuperación y errores; pruebas focalizadas sala/lab, typecheck y lint. Chrome real local,
LiveKit Docker propio demo-d1-, emisor 5372, lab 5371. Capturas en destino D1. Revisión explícita
del diff (sin comando de revisión Claude). Suite completa y publicación quedan a quien integra.

## Hallazgos y ajuste de diseño

La identidad de biblioteca no es un campo de SalaGuardada. Se usa identidad provisional en Crear
hasta que su primer autoguardado publique el id real; se enlaza sin editar useSala (zona ajena).
La invitación inicial tiene prioridad sobre la biblioteca del navegador; abrir otra sala o crear
una nueva cambia la identidad de conexión y deja de reutilizar ese parámetro de navegación.

Compatibilidad: se migra el puntero anterior demo/sala con capacidad local o el caso inequívoco
una guardada/una capacidad. Varias capacidades antiguas sin relación no permiten adivinar a qué
guardada pertenecen; abrir una vez su invitación vuelve a vincular la sala al autoguardar.

## Cierre real (2026-11-15)

- Recuperación: 4 pruebas de capacidad, independencia, creación compartida en curso y migración;
  Chrome confirmó portada en pestaña nueva, Mis salas, dos guardadas y repetir Invitar.
- Errores: pruebas de emisor con 25 identidades (409 y regreso del dueño), 503, 429 y llave.
  Chrome/LiveKit real con tope de prueba 2: tercer perfil espera y entra automáticamente al salir
  otro. 429 inducido en navegador: esperas de 2,09 / 4,03 / 8,01 s, sin formulario de llave.
  Red interrumpida en el navegador: conserva la sala individual y conecta al restablecerla.
- Llave: recarga real conserva sessionStorage y no vuelve a pedirla; sin llave en localStorage ni URL.
- Invitado: nombre → personaje → dentro, Entrar ya, nombres de sala/anfitrión recordados por pestaña.
  Medida automática sin pausa para capturas: 1,58–2,75 s en las pasadas locales.
  Comparación controlada con pausa idéntica de 1 s y conexión anterior simulada al entrar:
  2 muestras/variante, medias 2.347 ms antes / 1.884 ms ahora (~20 %); no es prueba estadística.
  Después del clic final: medias 954 / 558 ms. Datos completos en tiempos.json del destino D1.
- Sin voz: Chrome comprobó cero capturas y pistas salientes de la aplicación; un publicador de
  prueba cercano emitió audio real y ningún cliente se suscribió. Sin variable, tres perfiles
  enviaron y recibieron audio RTP creciente (1 pista saliente y 2 entrantes por perfil).
- Invitar: contador, texto listo para chat sin llave, copia real al portapapeles y confirmación.
  Capturas inspeccionadas en 1440×900, 390×844 y 320×640; llave con estilo propio y foco visible.
- Pruebas focalizadas: lab 24, sala 28, guardia 2, todas verdes. Typecheck/lint de lab y sala verdes.
  Build con VITE_SALA_SIN_VOZ=1 verde; advertencia existente de chunks grandes.
- Revisión explícita del diff y git diff --check limpios. Se corrigieron la prioridad de invitación
  sobre biblioteca, la cancelación tardía y la superposición del aviso de carga con los errores.
  No se presupone ningún hook o comando de revisión de Claude ejecutado.
- Presencia.tsx cambia exactamente una condición de una línea para ocultar voz; Conversacion,
  useSala, render 3D y packages/presencia permanecen intactos. No hay mensajes nuevos de protocolo.
- No se midió cobertura: no hay script/ratchet utilizable por paquete en este árbol. Suite completa,
  redes externas, TLS/TURN y publicación quedan a quien integra. Sin commits, push ni acceso remoto.

### Comandos reproducibles

```bash
pnpm --filter @oficina/lab exec vitest run src/creacion/envivo/configuracion.test.ts src/creacion/envivo/recuperacion.test.ts src/creacion/envivo/entradaInvitada.test.ts src/creacion/envivo/sinVoz.test.ts src/creacion/pasos/invitar.test.ts --maxWorkers=2
pnpm --filter @oficina/sala exec vitest run server/demo.test.ts server/app.test.ts --maxWorkers=2
pnpm --filter @oficina/motor exec vitest run src/guardia.test.ts --maxWorkers=2
pnpm --filter @oficina/lab typecheck
pnpm --filter @oficina/lab lint
pnpm --filter @oficina/sala typecheck
pnpm --filter @oficina/sala lint
```

Con lab 5371 y emisor 5372 (llave local ficticia `prueba-d1`), LiveKit propio en 7880/7881/7882:
`e2e/d1-entrada.mjs` prueba el modo sin voz por defecto; `DEMO_SIN_VOZ_PRUEBA=0` prueba voz habitual
(con el front recompilado/reiniciado sin la variable). `d1-errores.mjs` requiere emisor con
DEMO_TOPE_SALA=2. `d1-tiempo.mjs` compara la conexión al entrar simulada con la conexión anticipada.
Todos se ejecutan con `pnpm --filter @oficina/sala exec node e2e/<archivo>` y variables DEMO_URL,
DEMO_LLAVE_PRUEBA, DEMO_CAPTURAS según el script. Resultados y capturas: carpeta D1 del encargo.

Limpieza comprobada: sin listeners en 5371/5372; `docker ps -a --filter name=demo-d1-`
sin contenedores. Se detuvo y eliminó únicamente demo-d1-livekit. Informe breve y JSON de resultados
conservados junto a las capturas en el destino D1 del encargo.
