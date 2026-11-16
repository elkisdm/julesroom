/** Servicios de la sala integrada: solo loopback y sin persistir claves ni prompts. */
import { serve } from '@hono/node-server';
import { crearApp as crearAgentes } from '../../agentes-lab/servidor/app';
import { leerClave } from '../../agentes-lab/servidor/env';
import { crearApp as crearTokens } from '../../sala/server/app';
import { CREDENCIALES_DEV } from '../../sala/server/config';
import { crearSimulador } from '@oficina/agentes';
import { crearProveedorClaude } from '@oficina/agentes/claude';
import { PLANTILLAS, salaNueva, atuendoInicial } from '../src/creacion/plantillas';
import { equipoDeSala } from '../src/creacion/envivo/equipo';
import { LIMITES_VIVO } from '../src/creacion/envivo/protocolo';

const clave =
  process.env.SALA_SIMULADA === '1'
    ? undefined
    : leerClave(`${process.env.HOME}/.config/oficina-agentes/.env`);
const equipo = PLANTILLAS.flatMap((p) =>
  equipoDeSala(
    salaNueva(p.id, { nombre: '', equipo: '', tuNombre: '', atuendo: atuendoInicial(3) }),
  ),
);
const agentes = crearAgentes({
  proveedor: clave ? crearProveedorClaude({ clave }) : crearSimulador({ retardoMs: 65 }),
  equipo,
  clave: !!clave,
  config: {
    puerto: 8798,
    maxMensajesPorMinutoPersona: LIMITES_VIVO.mensajesMinuto,
    maxMensajesPorMinutoConversacion: LIMITES_VIVO.mensajesMinuto,
    origenesPermitidos: ['http://localhost:5352', 'http://127.0.0.1:5352'],
  },
});
const servidores = [
  serve({
    fetch: crearTokens(CREDENCIALES_DEV, LIMITES_VIVO.personas).fetch,
    port: 8797,
    hostname: '127.0.0.1',
  }),
  serve({ fetch: agentes.fetch, port: 8798, hostname: '127.0.0.1' }),
];
console.log(`Sala local: tokens 8797, agentes 8798 (${clave ? 'Claude' : 'simulado'})`);
for (const senal of ['SIGINT', 'SIGTERM'] as const)
  process.on(senal, () => {
    servidores.forEach((s) => s.close());
  });
