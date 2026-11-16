# Dinámica D2

`Dentro` monta los controles y rótulos con su `Mando` y `Proyector`. `Presencia` entrega
la fuente y el dueño ya autorizado por `useEnVivo`; `Conversacion` entrega la identidad
propia. `conexion.ts` conecta estos tres hermanos sin modificar el coordinador `Crear`.

- `modelo.ts`: protocolo fiable `d2-llamada`, `d2-parar`, `d2-reaccion`, cotas,
  cuota por identidad, semicírculos y atajos.
- `useGrupo.ts`: invitación de 5 s con Ir predeterminado/Quedarme, consentimiento y
  seguimiento con navegación existente; teclado, palanca o clic manual liberan.
- `reacciones.ts` / `useReacciones.ts`: 1 saludar, 2 aplaudir, 3 subir/bajar mano,
  4 risa, 5 me gusta. Reacciones breves independientes de la mano; aplauso de tres
  identidades en 1,5 s dispara una lluvia breve, con descanso y movimiento reducido.
- `votacion.ts` / `useVotacion.ts` / `PanelVotacion.tsx`: pregunta y 2–4 zonas,
  conteo espacial publicado por el anfitrión cada 1,5 s y cierre que congela el resultado.
  Sin votos no inventa ganador; un empate reconoce todas las opciones máximas.
- `useGrabacion.ts`: H oculta la UI local, H/Esc vuelve, aviso 1 s; no captura campos.
- `verificar.mjs`: Chrome real, tres perfiles aislados y 17 clientes ligeros adicionales.

Los mensajes ajenos al módulo se ignoran. Llamadas, seguimiento y votaciones solo se
aceptan desde la identidad autorizada del anfitrión; una reacción solo modifica al emisor
real y lleva cuota de 800 ms en envío y recepción. No se publica audio ni se solicitan
permisos de micrófono. El registro y los puentes son efímeros, de una sala por página.
Las manos se conservan durante toda la conexión, también al abrir y cerrar el constructor;
no se reconstruyen para quien entra después de haberse levantado. La votación se recupera
por latido mientras el anfitrión mantiene montada la dinámica.

Los puentes internos del render están en `packages/oficina/src/render/`: el traslado se
consume una vez y se revalida contra el mapa real; el saludo reutiliza `calcularPose`;
`MarcasD2` dibuja discos y bordes sin crear geometría por cuadro. Los imports internos
hacia estos puentes son deliberados para mantener el cambio dentro de la zona D2 y
no ampliar la API pública del motor. El validador usa muebles ajustados y objetos añadidos.

## Verificación local

Desde la raíz, con LiveKit propio y emisor/lab encendidos en los puertos D2:

```sh
pnpm --filter @oficina/lab exec vitest run src/creacion/envivo/dinamica --maxWorkers=2
pnpm --filter @oficina/motor exec vitest run src/render/nombresVivos.test.ts src/render/textoEtiquetas.test.ts src/render/trasladoD2.test.ts src/render/reaccionD2.test.ts --maxWorkers=2
node apps/lab/src/creacion/envivo/dinamica/verificar.mjs
```

El script espera el laboratorio en 5373, emisor en 5374 y LiveKit en 7893 (TCP RTC 7894,
UDP 7895), sin llave de demo y solo loopback. Guarda capturas y videos en el destino D2
del encargo. No levanta ni apaga infraestructura; eso corresponde a la sesión que la crea.
El emisor debe estar recién iniciado o con suficientes salas/pases libres para la prueba.
