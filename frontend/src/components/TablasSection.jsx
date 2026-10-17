import { useEffect, useState } from 'react'
import { api, fmt } from '../api'
import { NOMBRE_METODO, Selector, TipoBadge } from './common'

export default function TablasSection({ datos, onCambio }) {
  const { criterios, tablas, topsis } = datos
  const [tablaId, setTablaId] = useState(tablas[0].id)
  const tabla = tablas.find((t) => t.id === tablaId)
  const [borrador, setBorrador] = useState({})
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
  const modificados = tabla.desperdicio_modificado

  async function guardar() {
    setGuardando(true)
    try {
      const valores = Object.fromEntries(cambiados.map((a) => [a.id, Number(borrador[a.id])]))
      await api.guardarDesperdicio(tablaId, valores)
      await onCambio()
      setEstado({ tipo: 'ok', texto: 'Desperdicio actualizado. TOPSIS recalculado.' })
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
          al guardar se recalcula TOPSIS.
        </p>
      </div>

      <Selector
        opciones={tablas.map((t) => ({ id: t.id, label: t.nombre }))}
        valor={tablaId}
        onChange={(id) => { setTablaId(id); setEstado(null) }}
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

        <div className="actions">
          <button className="btn primary" disabled={guardando || cambiados.length === 0 || invalidos.length > 0} onClick={guardar}>
            {guardando ? 'Recalculando…' : `Guardar y recalcular TOPSIS${cambiados.length ? ` (${cambiados.length})` : ''}`}
          </button>
          <button className="btn" disabled={guardando || Object.keys(modificados).length === 0} onClick={restablecer}>
            Restablecer valores del cliente
          </button>
          {invalidos.length > 0 && <span className="text-error">El desperdicio debe ser un número ≥ 0.</span>}
        </div>
        {tablaId === 'habituales' && (
          <p className="muted small">
            Nota: los pesos CRITIC se calculan sobre esta matriz, por lo que modificar su desperdicio también
            actualiza los pesos CRITIC usados en las tres tablas.
          </p>
        )}
        {estado && <div className={`alert ${estado.tipo}`}>{estado.texto}</div>}
      </div>

      <div className="grid-2">
        {['ahp', 'critic'].map((m) => (
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
