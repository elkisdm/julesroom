import { filtrarCatalogo, recordarReciente } from './navegacionCatalogo';
import '../pasos/catalogo-ropa.css';
/**
 * La interfaz del modo construir, encima de la sala: barra de arriba (guardado, deshacer, salir),
 * un muelle abajo con pestañas (Agregar, En la sala, Pantallas, Puestos), herramientas sobre lo
 * elegido y el aviso junto al fantasma. La sala queda siempre a la vista.
 */
import { useRef, useState } from 'react';
import {
  CATALOGO_OBJETOS,
  variantesConCatalogo,
  CATEGORIAS,
  fijarPantalla,
  parsearSala,
  serializarSala,
  tipoObjeto,
} from '@oficina/motor';
import type { Escenario, SalaGuardada } from '@oficina/motor';
import { useNavegacionOpciones } from '../pasos/useNavegacionOpciones';
import { MuestrasEstilo } from '../pasos/MuestrasEstilo';
import { Ancla } from '../Ancla';
import { BotonSonido } from '../BotonSonido';
import { Tecla } from '../Tecla';
import { mesaDe, moverAgenteAMesa, zonasDeTrabajo } from '../plantillas';
import type { EstadoGuardado } from '../useSala';
import { OPCIONES_PANTALLA } from './contenidos';
import { Miniatura } from './Miniatura';
import type { Construir } from './useConstruir';
import { ConfirmarRestablecer } from './ConfirmarRestablecer';
import type { Mobiliario } from './useMobiliario';
import { elegirVariante, tieneVariantes, varianteActiva } from './variantes';

type Pestana = 'agregar' | 'sala' | 'estilo' | 'pantallas' | 'puestos';

interface Props {
  c: Construir;
  m: Mobiliario;
  sala: SalaGuardada;
  escenario: Escenario;
  guardado: EstadoGuardado;
  errorGuardado: string | null;
  puedeDeshacer: boolean;
  puedeRehacer: boolean;
  alDeshacer: () => void;
  alRehacer: () => void;
  alAplicar: (s: SalaGuardada) => void;
  alImportar: (s: SalaGuardada) => void;
}

const TEXTO_GUARDADO: Record<EstadoGuardado, string> = {
  guardado: 'Guardado en este navegador',
  guardando: 'Guardando…',
  'sin-guardar': 'Sin guardar',
};

function descargar(nombre: string, texto: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([texto], { type: 'application/json' }));
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(a.href);
}

const archivoDe = (nombre: string) =>
  `${
    nombre
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'sala'
  }.json`;

export function PanelConstruir({
  c,
  m,
  sala,
  escenario,
  guardado,
  errorGuardado,
  puedeDeshacer,
  puedeRehacer,
  alDeshacer,
  alRehacer,
  alAplicar,
  alImportar,
}: Props) {
  const pestanas = useNavegacionOpciones<HTMLDivElement>();
  const [pestana, setPestana] = useState<Pestana>('agregar');
  const [categoria, setCategoria] = useState<string>('plantas');
  const [busqueda, setBusqueda] = useState('');
  const [recientes, setRecientes] = useState<string[]>([]);
  const categoriasRef = useNavegacionOpciones<HTMLDivElement>();
  const itemsRef = useNavegacionOpciones<HTMLDivElement>();
  const [pantalla, setPantalla] = useState<string | null>(escenario.pantallas[0]?.id ?? null);
  const [menu, setMenu] = useState(false);
  const [erroresImport, setErroresImport] = useState<string[]>([]);
  const entradaArchivo = useRef<HTMLInputElement>(null);

  const objetos = sala.mundo.objetos;
  const hayAjustes = Object.keys(sala.mundo.ajustesMuebles).length > 0;
  const enSala = objetos.length + m.filas.length;
  const y = escenario.entradas[0]?.y ?? 0;
  const agentes = sala.ocupantes.filter((o) => o.tipo === 'agente');
  const mesas = zonasDeTrabajo(escenario);
  const items = filtrarCatalogo(
    CATALOGO_OBJETOS.map((t) => ({ ...t, id: t.tipo })),
    busqueda,
    categoria,
    recientes,
  );
  const f = c.fantasma ?? m.fantasma;
  const pieza = m.elegido;
  const botonesPieza = () =>
    pieza && !m.arrastrando && !c.fantasma ? (
      <>
        {!pieza.quitado && (
          <button type="button" onClick={() => m.girar(1)} title="Girar · R">
            ⟳ Girar
          </button>
        )}
        {!pieza.quitado && (
          <button type="button" className="cr-quitar" onClick={m.quitar} title="Quitar · Supr">
            ✕ Quitar
          </button>
        )}
        {pieza.ajustado && (
          <button type="button" onClick={m.pedirMueble}>
            Como venía
          </button>
        )}
      </>
    ) : null;
  const variantes = variantesConCatalogo(escenario.variantes);
  const conEstilo = tieneVariantes(escenario);

  const importar = async (archivo: File) => {
    const r = parsearSala(await archivo.text());
    if (!r.ok) {
      setErroresImport(r.errores);
      return;
    }
    setErroresImport([]);
    alImportar(r.sala);
    setMenu(false);
  };

  return (
    <div className="cr-construir">
      <div className="cr-barra" role="toolbar" aria-label="Construir">
        <b className="cr-barra-titulo">Construyendo</b>
        <span className={`cr-guardado cr-guardado--${guardado}`} title={errorGuardado ?? undefined}>
          {errorGuardado ?? TEXTO_GUARDADO[guardado]}
        </span>
        <button
          className="cr-icono"
          onClick={alDeshacer}
          disabled={!puedeDeshacer}
          aria-label="Deshacer (⌘Z)"
          title="Deshacer · ⌘Z"
        >
          ↶
        </button>
        <button
          className="cr-icono"
          onClick={alRehacer}
          disabled={!puedeRehacer}
          aria-label="Rehacer (⇧⌘Z)"
          title="Rehacer · ⇧⌘Z"
        >
          ↷
        </button>
        <div className="cr-menu">
          <button
            className="cr-icono"
            aria-expanded={menu}
            aria-label="Más opciones"
            onClick={() => setMenu((m) => !m)}
          >
            ⋯
          </button>
          {menu && (
            <div className="cr-menu-lista" role="menu">
              <button
                type="button"
                role="menuitem"
                disabled={!hayAjustes}
                onClick={() => {
                  setMenu(false);
                  m.pedirSala();
                }}
              >
                Volver a como venía
              </button>
              <button
                role="menuitem"
                onClick={() => descargar(archivoDe(sala.nombre), serializarSala(sala))}
              >
                Exportar sala
              </button>
              <button role="menuitem" onClick={() => entradaArchivo.current?.click()}>
                Importar sala…
              </button>
              <input
                ref={entradaArchivo}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(e) => {
                  const a = e.target.files?.[0];
                  if (a) void importar(a);
                  e.target.value = '';
                }}
              />
              {erroresImport.length > 0 && (
                <div className="cr-errores" role="alert">
                  <b>No se pudo importar</b>
                  <ul>
                    {erroresImport.slice(0, 4).map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
        <BotonSonido />
        <button className="cr-boton cr-boton--prim cr-boton--chico" onClick={c.salir}>
          Listo <Tecla>B</Tecla>
        </button>
      </div>

      {f && (
        <Ancla
          proyector={c.proyector}
          objetivo={() => ({ x: f.x, y: y + 0.1, z: f.z })}
          className="cr-consejo-ancla"
        >
          <div className={`cr-consejo cr-consejo--${f.estado}`}>
            {f.motivo ?? 'Clic para dejarlo'} · <Tecla>R</Tecla> girar
          </div>
        </Ancla>
      )}

      {botonesPieza() && (
        <Ancla
          proyector={c.proyector}
          objetivo={() => ({
            x: pieza!.x,
            y: y + pieza!.alto + 0.3,
            z: pieza!.z,
          })}
          className="cr-herramientas-ancla cr-herramientas-mueble"
        >
          <div className="cr-herramientas" role="toolbar" aria-label={pieza!.nombre}>
            {botonesPieza()}
          </div>
        </Ancla>
      )}

      {c.elegido && !f && (
        <Ancla
          proyector={c.proyector}
          objetivo={() => ({
            x: c.elegido!.x,
            y: y + (tipoObjeto(c.elegido!.tipo)?.alto ?? 1) + 0.3,
            z: c.elegido!.z,
          })}
          className="cr-herramientas-ancla"
        >
          <div
            className="cr-herramientas"
            role="toolbar"
            aria-label={tipoObjeto(c.elegido.tipo)?.nombre}
          >
            <button onClick={() => c.girarActual(1)} title="Girar · R">
              ⟳ Girar
            </button>
            <button onClick={c.duplicarSeleccion} title="Duplicar · ⌘D">
              ⧉ Duplicar
            </button>
            <button className="cr-quitar" onClick={c.quitarSeleccion} title="Quitar · Supr">
              ✕ Quitar
            </button>
          </div>
        </Ancla>
      )}

      {(m.aviso ?? c.aviso) && (
        <div className="cr-toast" role="status">
          {m.aviso ?? c.aviso}
        </div>
      )}

      {m.confirmar && (
        <ConfirmarRestablecer
          titulo={
            m.confirmar === 'sala'
              ? '¿Vuelves la sala a como venía?'
              : `¿Vuelves «${pieza?.nombre ?? 'este mueble'}» a como venía?`
          }
          detalle={
            m.confirmar === 'sala'
              ? 'Los muebles que moviste o quitaste regresan a su lugar.'
              : 'Vuelve al lugar y al giro con los que llegó la sala.'
          }
          alConfirmar={m.aceptar}
          alCancelar={m.cancelar}
        />
      )}

      <div className="cr-muelle">
        {botonesPieza() && (
          <div className="cr-acciones-fijas" role="toolbar" aria-label={pieza?.nombre}>
            {botonesPieza()}
          </div>
        )}
        <div className="cr-pestanas" ref={pestanas} role="tablist" aria-label="Qué construir">
          {(
            [
              ['agregar', 'Agregar'],
              ['sala', `En la sala · ${enSala}`],
              ...(conEstilo ? [['estilo', 'Estilo'] as const] : []),
              ['pantallas', 'Pantallas'],
              ...(mesas.length > 0 ? [['puestos', 'Puestos'] as const] : []),
            ] as [Pestana, string][]
          ).map(([id, t]) => (
            <button
              key={id}
              role="tab"
              aria-selected={pestana === id}
              onClick={() => setPestana(id)}
            >
              {t}
            </button>
          ))}
          <span className="cr-limite">
            {objetos.length} de {c.limites.maxObjetos} objetos
          </span>
        </div>

        {pestana === 'agregar' && (
          <>
            <label className="cr-buscar-catalogo">
              Buscar piezas
              <input
                type="search"
                value={busqueda}
                onChange={(e) => {
                  setBusqueda(e.target.value);
                  if (e.target.value) setCategoria('');
                }}
                placeholder="Nombre de la pieza"
              />
            </label>
            <div
              ref={categoriasRef}
              className="cr-categorias"
              role="tablist"
              aria-label="Categoría"
            >
              {[
                { id: '', nombre: 'Todas' },
                ...CATEGORIAS,
                { id: 'recientes', nombre: 'Recientes' },
              ].map((k) => (
                <button
                  key={k.id}
                  role="tab"
                  aria-selected={categoria === k.id}
                  onClick={() => setCategoria(k.id)}
                >
                  {k.nombre}
                </button>
              ))}
            </div>
            <div ref={itemsRef} className="cr-items">
              {!items.length && (
                <p className="cr-vacio">No hay piezas aquí. Prueba otra búsqueda.</p>
              )}
              {items.map((t) => (
                <button
                  key={t.tipo}
                  className="cr-item"
                  aria-pressed={c.enMano?.tipo === t.tipo}
                  onClick={() => {
                    c.tomar(t.tipo);
                    setRecientes((r) => recordarReciente(r, t.tipo));
                  }}
                >
                  <Miniatura tipo={t.tipo} />
                  <span>{t.nombre}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {pestana === 'sala' &&
          (enSala === 0 ? (
            <p className="cr-vacio">
              Todavía no agregas nada. Elige algo en <b>Agregar</b> y haz clic en el piso.
            </p>
          ) : (
            <div className="cr-lista">
              {objetos.map((o) => (
                <button
                  key={o.id}
                  aria-pressed={c.seleccion === o.id}
                  onClick={() => c.setSeleccion(o.id)}
                >
                  <Miniatura tipo={o.tipo} />
                  <span>{tipoObjeto(o.tipo)?.nombre ?? o.tipo}</span>
                </button>
              ))}
              {m.filas.map((fila) => (
                <button
                  key={`mueble-${fila.id}`}
                  className="cr-lista-mueble"
                  aria-pressed={pieza?.id === fila.id}
                  onClick={() => m.seleccionar(fila.id)}
                >
                  <span>{fila.nombre}</span>
                  <small>{fila.estado === 'quitado' ? 'Quitado' : 'Movido'}</small>
                </button>
              ))}
            </div>
          ))}

        {pestana === 'estilo' && conEstilo && (
          <div className="cr-estilo-construir">
            <span>
              {
                variantes.find((v) => v.id === varianteActiva(escenario, sala.mundo.variante))
                  ?.nombre
              }
            </span>
            <MuestrasEstilo
              variantes={variantes}
              activa={varianteActiva(escenario, sala.mundo.variante)}
              alElegir={(id) => alAplicar(elegirVariante(sala, id))}
            />
          </div>
        )}

        {pestana === 'pantallas' && (
          <div className="cr-dos">
            <div className="cr-opciones" role="listbox" aria-label="Pantalla">
              {escenario.pantallas.map((p) => (
                <button
                  key={p.id}
                  role="option"
                  aria-selected={pantalla === p.id}
                  onClick={() => setPantalla(p.id)}
                >
                  {escenario.zonas.find((z) => z.id === p.zona)?.nombre ?? p.id}
                </button>
              ))}
            </div>
            {pantalla && (
              <div className="cr-opciones" role="radiogroup" aria-label="Qué muestra">
                {OPCIONES_PANTALLA.map((o) => {
                  const actual =
                    sala.mundo.pantallas[pantalla] ??
                    escenario.pantallas.find((p) => p.id === pantalla)?.contenido;
                  return (
                    <button
                      key={o.id}
                      role="radio"
                      aria-checked={actual === o.id}
                      onClick={() => {
                        const r = fijarPantalla(sala, pantalla, o.id);
                        if (r.ok) alAplicar(r.sala);
                      }}
                    >
                      {o.nombre}
                      <small>{o.detalle}</small>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {pestana === 'puestos' && (
          <div className="cr-puestos">
            {agentes.map((a) => (
              <div key={a.id} className="cr-puesto">
                <b>{a.nombre}</b>
                <div className="cr-mesas" role="radiogroup" aria-label={`Mesa de ${a.nombre}`}>
                  {mesas.map((m, k) => (
                    <button
                      key={m.id}
                      role="radio"
                      aria-checked={mesaDe(sala, a.id) === k}
                      onClick={() => alAplicar(moverAgenteAMesa(sala, a.id, k, mesas.length))}
                    >
                      {m.nombre}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
