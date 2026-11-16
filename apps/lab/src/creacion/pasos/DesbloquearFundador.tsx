import { useState } from 'react';
import type { Atuendo } from '@oficina/motor';
import { puedeOfrecerFundador, verificarCodigoFundador, vestirFundador } from './fundador';
import './fundador.css';
const hash = import.meta.env.VITE_HASH_FUNDADOR as string | undefined;
export function DesbloquearFundador({
  atuendo,
  alElegir,
  alDesbloquear,
  imagen,
}: {
  atuendo: Atuendo;
  alElegir: (a: Atuendo) => void;
  alDesbloquear: () => void;
  imagen?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [desbloqueado, setDesbloqueado] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState('');
  if (!puedeOfrecerFundador(hash, true)) return null;
  return (
    <div
      className="pv-fundador"
      data-teclado-propio
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          setAbierto(false);
          e.currentTarget.querySelector('button')?.focus();
        }
      }}
    >
      {desbloqueado ? (
        <button className="cr-boton" onClick={() => alElegir(vestirFundador(atuendo))}>
          {imagen && <img src={imagen} width={64} height={64} alt="Atuendo Fundador Ónix" />}Vestir
          Fundador · Ónix
        </button>
      ) : (
        <>
          <button
            className="pv-volver"
            onClick={() => setAbierto(!abierto)}
            aria-expanded={abierto}
          >
            Tengo un código de fundador
          </button>
          {abierto && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setOcupado(true);
                try {
                  const valido = await verificarCodigoFundador(codigo, hash);
                  setDesbloqueado(valido);
                  setMensaje(valido ? 'Ónix desbloqueado.' : 'El código no coincide.');
                  if (valido) {
                    alDesbloquear();
                    setCodigo('');
                    alElegir(vestirFundador(atuendo));
                  }
                } catch (error) {
                  console.error('No se pudo verificar el código de fundador', error);
                  setMensaje('No se pudo verificar. Intenta de nuevo en una conexión segura.');
                } finally {
                  setOcupado(false);
                }
              }}
            >
              <label htmlFor="codigo-fundador">Código de fundador</label>
              <input
                id="codigo-fundador"
                type="password"
                autoComplete="off"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                aria-describedby="estado-fundador"
              />
              <button className="cr-boton" disabled={ocupado || !codigo}>
                {ocupado ? 'Verificando…' : 'Desbloquear'}
              </button>
            </form>
          )}
        </>
      )}
      <span id="estado-fundador" role="status">
        {mensaje}
      </span>
    </div>
  );
}
