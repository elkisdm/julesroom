import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Oficina,
  crearFuenteSimulada,
  definicionAProps,
  ejemploEquipo,
  ejemploEstudio,
  parsearDefinicion,
  rolesConocidos,
  serializarDefinicion,
  validarDefinicion,
} from '@oficina/motor';
import type { DefinicionOficina, MetricasRender, OcupanteAgente, Proyector } from '@oficina/motor';
import {
  PAQUETES,
  agregarAgente,
  alternarAccesorio,
  alternarPaquete,
  cambiarAtuendo,
  cambiarDepartamento,
  cambiarRol,
  catalogoDe,
  quitarOcupante,
  renombrar,
} from './editor';
import { Boton, Campo, Desplegable, Fichas, Muestras, Seccion } from './ui';

const EJEMPLOS = [ejemploEquipo, ejemploEstudio];
const CANTIDADES_SIMULADAS = [0, 3, 25, 100];
const HORAS = [
  { id: '8', nombre: 'Mañana' },
  { id: '13', nombre: 'Mediodía' },
  { id: '19.2', nombre: 'Atardecer' },
  { id: '22', nombre: 'Noche' },
];
const CALIDADES = [
  { id: 'auto', nombre: 'Auto' },
  { id: 'alta', nombre: 'Alta' },
  { id: 'media', nombre: 'Media' },
  { id: 'baja', nombre: 'Baja' },
];

declare global {
  interface Window {
    __oficina?: { metricas: MetricasRender | null; definicion: DefinicionOficina };
    /** Solo para pruebas en navegador: proyecta un agente a píxeles del lienzo. */
    __proyectar?: Proyector;
  }
}

const clonar = (d: DefinicionOficina): DefinicionOficina => JSON.parse(JSON.stringify(d));

export function App() {
  const [definicion, setDefinicion] = useState<DefinicionOficina>(() => clonar(ejemploEquipo));
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const [simuladas, setSimuladas] = useState(3);
  const [metricas, setMetricas] = useState<MetricasRender | null>(null);
  const [hablando, setHablando] = useState<string | null>(null);
  const [texto, setTexto] = useState(() => serializarDefinicion(ejemploEquipo));
  const [erroresImport, setErroresImport] = useState<string[]>([]);

  const catalogo = useMemo(() => catalogoDe(definicion), [definicion]);
  const props = useMemo(() => definicionAProps(definicion), [definicion]);
  const validacion = useMemo(() => validarDefinicion(definicion), [definicion]);

  // El JSON visible sigue a la definición (los cambios del editor lo reescriben).
  useEffect(() => {
    setTexto(serializarDefinicion(definicion));
    setErroresImport([]);
  }, [definicion]);

  // Fuente de presencia simulada: las personas de la definición más las simuladas pedidas.
  const altas = useMemo(
    () => props.personas.map((p) => ({ id: p.id, nombre: p.nombre, atuendo: p.atuendo })),
    [props.personas],
  );
  const fuente = useMemo(
    () => crearFuenteSimulada({ cantidad: simuladas, semilla: 1, altas }),
    [simuladas, altas],
  );
  useEffect(() => {
    let id = 0;
    let anterior = performance.now();
    const paso = (t: number) => {
      fuente.avanzar(Math.min((t - anterior) / 1000, 0.1));
      anterior = t;
      id = requestAnimationFrame(paso);
    };
    id = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(id);
  }, [fuente]);

  const alMetricas = useCallback((m: MetricasRender) => {
    setMetricas(m);
    window.__oficina = { metricas: m, definicion: window.__oficina?.definicion ?? ejemploEquipo };
  }, []);
  useEffect(() => {
    window.__oficina = { metricas: window.__oficina?.metricas ?? null, definicion };
  }, [definicion]);

  const seleccionado = definicion.ocupantes.find((o) => o.id === seleccionadoId) ?? null;
  const agente: OcupanteAgente | null = seleccionado?.tipo === 'agente' ? seleccionado : null;
  const atuendo = agente ? props.agentes.find((a) => a.id === agente.id)?.atuendo : undefined;
  const editar = (f: (d: DefinicionOficina) => DefinicionOficina) => setDefinicion((d) => f(d));

  const importar = () => {
    const r = parsearDefinicion(texto);
    if (!r.ok) return setErroresImport(r.errores);
    setDefinicion(r.definicion);
    setSeleccionadoId(null);
  };
  const descargar = () => {
    const url = URL.createObjectURL(new Blob([texto], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${definicion.nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'oficina'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const copiar = () => void navigator.clipboard?.writeText(texto).catch(() => undefined);
  const lienzo = useRef<HTMLDivElement>(null);

  return (
    <div className="app">
      <div className="escena" ref={lienzo}>
        <div className="escena-lienzo">
          <Oficina
            agentes={props.agentes}
            departamentos={props.departamentos}
            catalogo={catalogo}
            horaChile={props.horaChile}
            calidad={props.calidad}
            fuentePresencia={fuente}
            seleccionadoId={seleccionadoId}
            onSeleccionar={setSeleccionadoId}
            onHablarAgente={(id) => setHablando(id)}
            onMetricas={alMetricas}
            onProyector={(f) => (window.__proyectar = f)}
          />
        </div>
        {hablando && (
          <div className="aviso-hablar" role="status">
            Hablarle a{' '}
            <strong>{props.agentes.find((a) => a.id === hablando)?.nombre ?? hablando}</strong>:
            aquí se abriría la conversación (sin backend).{' '}
            <Boton onClick={() => setHablando(null)}>Cerrar</Boton>
          </div>
        )}
        <div className="lectura" data-testid="lectura">
          {props.agentes.length} agentes · {fuente.personas().length} personas
          {metricas?.fps !== undefined
            ? ` · ${Math.round(metricas.fps)} fps · p95 ${metricas.p95?.toFixed(1) ?? '–'} ms · ${metricas.drawCalls ?? '–'} draw calls`
            : ''}
        </div>
      </div>

      <aside className="panel" aria-label="Editor de oficina">
        <Seccion titulo="Oficina">
          <Campo
            etiqueta="Nombre de la oficina"
            valor={definicion.nombre}
            invalido={!validacion.ok && definicion.nombre.trim() === ''}
            onCambio={(nombre) => editar((d) => ({ ...d, nombre }))}
          />
          <div className="fila">
            {EJEMPLOS.map((e) => (
              <Boton
                key={e.nombre}
                activo={definicion.nombre === e.nombre}
                onClick={() => {
                  setDefinicion(clonar(e));
                  setSeleccionadoId(null);
                }}
              >
                {e.nombre}
              </Boton>
            ))}
          </div>
        </Seccion>

        <Seccion titulo="Ocupantes">
          <ul className="ocupantes">
            {definicion.ocupantes.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  className={`ocupante${o.id === seleccionadoId ? ' elegido' : ''}`}
                  aria-pressed={o.id === seleccionadoId}
                  onClick={() => setSeleccionadoId(o.id === seleccionadoId ? null : o.id)}
                >
                  <span>{o.nombre || '(sin nombre)'}</span>
                  <small>{o.tipo === 'agente' ? o.rol : 'persona'}</small>
                </button>
              </li>
            ))}
          </ul>
          <Boton
            tono="primario"
            onClick={() => {
              const antes = definicion.ocupantes.length;
              const nueva = agregarAgente(definicion);
              setDefinicion(nueva);
              setSeleccionadoId(nueva.ocupantes[antes]?.id ?? null);
            }}
          >
            Agregar agente
          </Boton>
        </Seccion>

        {agente && atuendo && (
          <Seccion titulo={`Editar · ${agente.nombre || 'sin nombre'}`}>
            <Campo
              etiqueta="Nombre"
              valor={agente.nombre}
              invalido={agente.nombre.trim() === ''}
              onCambio={(n) => editar((d) => renombrar(d, agente.id, n))}
            />
            <Desplegable
              etiqueta="Rol"
              opciones={[
                ...(rolesConocidos.includes(agente.rol) ? [] : [agente.rol]),
                ...rolesConocidos,
              ].map((r) => ({ id: r, nombre: r }))}
              valor={agente.rol}
              onElegir={(r) => editar((d) => cambiarRol(d, agente.id, r))}
            />
            <Desplegable
              etiqueta="Departamento"
              opciones={definicion.departamentos.map((d) => ({ id: d.id, nombre: d.nombre }))}
              valor={agente.departamento}
              onElegir={(dep) => editar((d) => cambiarDepartamento(d, agente.id, dep))}
            />
            <Desplegable
              etiqueta="Peinado"
              opciones={catalogo.peinados}
              valor={atuendo.hair}
              onElegir={(hair) => editar((d) => cambiarAtuendo(d, agente.id, { hair }, catalogo))}
            />
            <Desplegable
              etiqueta="Cara"
              opciones={catalogo.caras}
              valor={atuendo.face}
              onElegir={(face) => editar((d) => cambiarAtuendo(d, agente.id, { face }, catalogo))}
            />
            <Desplegable
              etiqueta="Parte de arriba"
              opciones={catalogo.tops.filter((t) => t.id !== 'fundador')}
              valor={atuendo.top}
              onElegir={(top) => editar((d) => cambiarAtuendo(d, agente.id, { top }, catalogo))}
            />
            <Desplegable
              etiqueta="Parte de abajo"
              opciones={catalogo.bottoms}
              valor={atuendo.bottom}
              onElegir={(bottom) =>
                editar((d) => cambiarAtuendo(d, agente.id, { bottom }, catalogo))
              }
            />
            <Muestras
              etiqueta="Piel"
              colores={catalogo.pieles}
              valor={atuendo.skin}
              onElegir={(skin) => editar((d) => cambiarAtuendo(d, agente.id, { skin }, catalogo))}
            />
            <Muestras
              etiqueta="Pelo"
              colores={catalogo.coloresPelo}
              valor={atuendo.hairColor}
              onElegir={(hairColor) =>
                editar((d) => cambiarAtuendo(d, agente.id, { hairColor }, catalogo))
              }
            />
            <Muestras
              etiqueta="Color de arriba"
              colores={catalogo.coloresTop}
              valor={atuendo.topColor}
              onElegir={(topColor) =>
                editar((d) => cambiarAtuendo(d, agente.id, { topColor }, catalogo))
              }
            />
            <Muestras
              etiqueta="Color de abajo"
              colores={catalogo.coloresBottom}
              valor={atuendo.bottomColor}
              onElegir={(bottomColor) =>
                editar((d) => cambiarAtuendo(d, agente.id, { bottomColor }, catalogo))
              }
            />
            <Fichas
              etiqueta="Accesorios"
              opciones={catalogo.piezas}
              activas={atuendo.acc}
              onAlternar={(p) => editar((d) => alternarAccesorio(d, agente.id, p, catalogo))}
            />
            {catalogo.disfraces.length > 0 && (
              <div className="campo">
                <span className="etiqueta">Disfraces de los paquetes</span>
                <div className="fichas">
                  {catalogo.disfraces.map((f) => (
                    <Boton
                      key={f.id}
                      onClick={() =>
                        editar((d) => cambiarAtuendo(d, agente.id, f.atuendo, catalogo))
                      }
                    >
                      {f.nombre}
                    </Boton>
                  ))}
                </div>
              </div>
            )}
            <Boton
              tono="peligro"
              onClick={() => {
                editar((d) => quitarOcupante(d, agente.id));
                setSeleccionadoId(null);
              }}
            >
              Quitar agente
            </Boton>
          </Seccion>
        )}
        {seleccionado?.tipo === 'persona' && (
          <Seccion titulo={`Persona · ${seleccionado.nombre}`}>
            <p>Su posición llega de la fuente de presencia; aquí no se edita.</p>
            <Boton
              tono="peligro"
              onClick={() => {
                editar((d) => quitarOcupante(d, seleccionado.id));
                setSeleccionadoId(null);
              }}
            >
              Quitar persona
            </Boton>
          </Seccion>
        )}

        <Seccion titulo="Tema">
          <div className="campo">
            <span className="etiqueta">Hora del día (Chile)</span>
            <div className="fila">
              {HORAS.map((h) => (
                <Boton
                  key={h.id}
                  activo={definicion.tema.hora === Number(h.id)}
                  onClick={() => editar((d) => ({ ...d, tema: { ...d.tema, hora: Number(h.id) } }))}
                >
                  {h.nombre}
                </Boton>
              ))}
            </div>
          </div>
          <div className="campo">
            <span className="etiqueta">Calidad</span>
            <div className="fila">
              {CALIDADES.map((c) => (
                <Boton
                  key={c.id}
                  activo={(definicion.tema.calidad ?? 'auto') === c.id}
                  onClick={() =>
                    editar((d) => ({
                      ...d,
                      tema: { ...d.tema, calidad: c.id as DefinicionOficina['tema']['calidad'] },
                    }))
                  }
                >
                  {c.nombre}
                </Boton>
              ))}
            </div>
          </div>
          <Fichas
            etiqueta="Paquetes de skins"
            opciones={PAQUETES.map((p) => ({ id: p.id, nombre: p.nombre }))}
            activas={definicion.tema.paquetes ?? []}
            onAlternar={(id) => editar((d) => alternarPaquete(d, id))}
          />
        </Seccion>

        <Seccion titulo="Presencia simulada">
          <div className="campo">
            <span className="etiqueta">Personas que se mueven solas</span>
            <div className="fila">
              {CANTIDADES_SIMULADAS.map((n) => (
                <Boton key={n} activo={simuladas === n} onClick={() => setSimuladas(n)}>
                  {n}
                </Boton>
              ))}
            </div>
          </div>
        </Seccion>

        <Seccion titulo="JSON de la oficina">
          <div className="campo">
            <label htmlFor="json">Se actualiza con el editor; edítalo y carga para importar</label>
            <textarea
              id="json"
              className="cuadro-json"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              spellCheck={false}
            />
          </div>
          <div className="fila">
            <Boton tono="primario" disabled={!validacion.ok} onClick={descargar}>
              Descargar
            </Boton>
            <Boton onClick={copiar}>Copiar</Boton>
            <Boton onClick={importar}>Cargar este texto</Boton>
          </div>
          {(erroresImport.length > 0 || !validacion.ok) && (
            <ul className="errores" role="alert">
              {(erroresImport.length > 0 ? erroresImport : validacion.errores).map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </Seccion>
      </aside>
    </div>
  );
}
