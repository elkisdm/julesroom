/** «E · hablar con Dato»: el agente que el avatar tiene a mano. También se puede tocar (móvil). */
export function AvisoHablar({ nombre, alAbrir }: { nombre: string | null; alAbrir: () => void }) {
  if (!nombre) return null;
  return (
    <button type="button" className="aviso" key={nombre} onClick={alAbrir}>
      <kbd>E</kbd>
      <span>hablar con</span>
      <span className="aviso-objeto">{nombre}</span>
    </button>
  );
}
