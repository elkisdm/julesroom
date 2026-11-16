/** Estado de entrada sobre el mundo, sin bloquear el formulario de llave o los reintentos. */
export function CargaInvitada({ nombre, anfitrion }: { nombre?: string; anfitrion?: string }) {
  return (
    <section className="fl-panel ev-carga-invitada" role="status" aria-label="Conectando la sala">
      <h2>{nombre ? `Entrando a ${nombre}` : 'Entrando a la sala'}</h2>
      <p>{anfitrion ? `Tu anfitrión es ${anfitrion}.` : 'Preparando tu lugar…'}</p>
    </section>
  );
}
