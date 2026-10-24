import { useEffect, useState } from 'react'
import { api, fmt } from '../api'
import { METODOS_PESOS, NOMBRE_METODO, Selector, TipoBadge } from './common'

export default function TablasSection({ datos, onCambio }) {
  const { criterios, tablas, topsis } = datos
  const [tablaId, setTablaId] = useState(tablas[0].id)
  const tabla = tablas.find((t) => t.id === tablaId)
  const [borrador, setBorrador] = useState({})
  const [propagar, setPropagar] = useState(false)
  const [valoresExclusivos, setValoresExclusivos] = useState({})
  const [estado, setEstado] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    setBorrador(Object.fromEntries(tabla.alternativas.map((a) => [a.id, String(a.desperdicio)])))
  }, [tabla])

  const cambiados = tabla.alternativas.filter((a) => Number(borrador[a.id]) !== a.desperdicio)
  const invalidos = tabla.alternativas.filter((a) => {
    const v = borrador[a.id]
    return v === '' || v === undefined || Number.isNaN(Number(v)) || Number(v) < 0
  })
  const nombresOrigen = new Set(tabla.alternativas.map((a) => a.nombre))
  const exclusivos = tablas
    .filter((destino) => destino.id !== tablaId)
    .flatMap((destino) => destino.alternativas
      .filter((a) => !nombresOrigen.has(a.nombre))
      .map((a) => ({
        tablaId: destino.id,
        tablaNombre: destino.nombre,
        alternativaId: a.id,
        nombre: a.nombre,
        desperdicioActual: a.desperdicio,
        key: `${destino.id}:${a.id}`,
      })))
  const exclusivosInvalidos = propagar && exclusivos.some(({ key }) => {
    const v = valoresExclusivos[key]
    return v === '' || v === undefined || Number.isNaN(Number(v)) || Number(v) < 0
  })
  const modificados = tabla.desperdicio_modificado

  async function guardar() {
    setGuardando(true)
    try {
      if (propagar) {
        const cambiosPorNombre = Object.fromEntries(cambiados.map((a) => [a.nombre, Number(borrador[a.id])]))
        const valoresPorTabla = {}

        for (const destino of tablas) {
          const valores = {}
          if (destino.id === tablaId) {
            for (const alternativa of cambiados) {
              valores[alternativa.id] = Number(borrador[alternativa.id])
            }
          } else {
            for (const alternativa of destino.alternativas) {
              const valorCompartido = cambiosPorNombre[alternativa.nombre]
              if (valorCompartido !== undefined) valores[alternativa.id] = valorCompartido
            }
            for (const exclusivo of exclusivos.filter((item) => item.tablaId === destino.id)) {
              valores[exclusivo.alternativaId] = Number(valoresExclusivos[exclusivo.key])
            }
          }
          if (Object.keys(valores).length) valoresPorTabla[destino.id] = valores
        }

        await api.guardarDesperdicios(valoresPorTabla)
      } else {
        const valores = Object.fromEntries(cambiados.map((a) => [a.id, Number(borrador[a.id])]))
        await api.guardarDesperdicio(tablaId, valores)
      }
      await onCambio()
      setPropagar(false)
      setValoresExclusivos({})
      setEstado({
        tipo: 'ok',
        texto: propagar
          ? 'Cambios guardados en las tablas. TOPSIS y los pesos se recalcularon.'
          : 'Desperdicio actualizado. TOPSIS recalculado.',
      })
    } catch (e) {
      setEstado({ tipo: 'error', texto: e.message })
    } finally {
      setGuardando(false)
    }
  }

  async function restablecer() {
    setGuardando(true)
    try {
      await api.restablecerDesperdicio(tablaId)
      await onCambio()
      setPropagar(false)
      setValoresExclusivos({})
      setEstado({ tipo: 'ok', texto: 'Se restablecieron los valores del cliente.' })
    } catch (e) {
      setEstado({ tipo: 'error', texto: e.message })
    } finally {
      setGuardando(false)
    }
  }

  const resultado = topsis.find((t) => t.tabla === tablaId)
  const lider = (m) => resultado.alternativas[resultado.resultados[m].ranking.indexOf(1)]

  return (
    <section>
      <div className="section-head">
        <h2>Matrices de decisión</h2>
        <p className="muted">
          Datos provistos por el cliente. Solo el criterio <strong>Desperdicio Esperado</strong> es editable;
          al guardar se recalcula TOPSIS. Podés activar la propagación para replicar los cambios entre tablas.
        </p>
      </div>

      <Selector
        opciones={tablas.map((t) => ({ id: t.id, label: t.nombre }))}
        valor={tablaId}
        onChange={(id) => {
          setTablaId(id)
          setPropagar(false)
          setValoresExclusivos({})
          setEstado(null)
        }}
      />

      <div className="card">
        <h3>{tabla.nombre}</h3>
        <p className="muted">{tabla.descripcion}</p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th></th>
                <th>Alternativa</th>
                {criterios.map((c) => (
                  <th key={c.id} className={c.clave === 'desperdicio' ? 'editable-col' : ''} title={c.unidad}>
                    {c.nombre} <TipoBadge tipo={c.tipo} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tabla.alternativas.map((a, i) => (
                <tr key={a.id}>
                  <th className="row-head">{a.id}</th>
                  <td>{a.nombre}</td>
                  {criterios.map((c, j) => {
                    if (c.clave === 'desperdicio') {
                      const invalido = invalidos.includes(a)
                      return (
                        <td key={c.id} className="editable-col">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={borrador[a.id] ?? ''}
                            className={invalido ? 'input invalid' : Number(borrador[a.id]) !== a.desperdicio ? 'input dirty' : 'input'}
                            onChange={(e) => setBorrador({ ...borrador, [a.id]: e.target.value })}
                          />
                          {a.id in modificados && <span className="mod-dot" title="Modificado respecto del cliente">●</span>}
                        </td>
                      )
                    }
                    const valor = a[c.clave]
                    const numerico = tabla.matriz[i][j]
                    return (
                      <td key={c.id} className="num">
                        {typeof valor === 'string' ? <>{valor} <span className="muted">({numerico})</span></> : fmt(valor, 0)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={propagar}
            onChange={(e) => {
              setPropagar(e.target.checked)
              setValoresExclusivos({})
            }}
          />
          <span>Propagar los cambios a las demás tablas</span>
        </label>

        {propagar && (
          <div className="card sync-card">
            <h3>Productos exclusivos de las otras tablas</h3>
            <p className="muted small">
              Los cambios de productos compartidos se copiarán automáticamente. Completá el desperdicio de los
              productos que no aparecen en «{tabla.nombre}».
            </p>
            {exclusivos.length === 0 ? (
              <p className="muted small">No hay productos exclusivos pendientes para esta tabla.</p>
            ) : (
              <div className="exclusive-fields">
                {exclusivos.map((item) => (
                  <label className="field-label" key={item.key}>
                    <span>{item.nombre} <span className="muted">· {item.tablaNombre}</span></span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={valoresExclusivos[item.key] ?? ''}
                      placeholder={`Valor actual: ${fmt(item.desperdicioActual, 0)}`}
                      className={valoresExclusivos[item.key] === undefined || valoresExclusivos[item.key] === '' ? 'input invalid' : 'input'}
                      onChange={(e) => setValoresExclusivos({ ...valoresExclusivos, [item.key]: e.target.value })}
                    />
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="actions">
          <button
            className="btn primary"
            disabled={guardando || (cambiados.length === 0 && (!propagar || exclusivos.length === 0)) || invalidos.length > 0 || exclusivosInvalidos}
            onClick={guardar}
          >
            {guardando ? 'Guardando…' : `Guardar y recalcular TOPSIS${propagar ? ' en todas las tablas' : ''}${cambiados.length ? ` (${cambiados.length})` : ''}`}
          </button>
          <button className="btn" disabled={guardando || Object.keys(modificados).length === 0} onClick={restablecer}>
            Restablecer esta tabla
          </button>
          {invalidos.length > 0 && <span className="text-error">El desperdicio debe ser un número ≥ 0.</span>}
          {exclusivosInvalidos && <span className="text-error">Completá un valor válido para cada producto exclusivo.</span>}
        </div>
        <p className="muted small">
          Los pesos CRITIC y de entropía se calculan sobre la tabla «Día habitual». Si un cambio propagado modifica
          esa matriz, ambos pesos se recalculan para las tres tablas.
        </p>
        {estado && <div className={`alert ${estado.tipo}`}>{estado.texto}</div>}
      </div>

      <div className="grid-2">
        {METODOS_PESOS.map(({ id: m }) => (
          <div className="card kpi" key={m}>
            <span className="muted">Mejor alternativa (TOPSIS con pesos {NOMBRE_METODO[m]})</span>
            <strong>{lider(m).nombre}</strong>
            <span className="muted">
              Ci = {fmt(Math.max(...resultado.resultados[m].cercania))}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
