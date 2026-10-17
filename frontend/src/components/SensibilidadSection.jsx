import { useEffect, useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, fmt, pct } from '../api'
import { NOMBRE_METODO, Selector } from './common'

const COLORES = Array.from({ length: 10 }, (_, i) => `var(--cat-${i + 1})`)

export default function SensibilidadSection({ datos, version }) {
  const { criterios, topsis } = datos
  const [tablaId, setTablaId] = useState(topsis[0].tabla)
  const [metodo, setMetodo] = useState('ahp')
  const [criterioId, setCriterioId] = useState('C6')
  const [sens, setSens] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let vigente = true
    api.sensibilidad(tablaId, metodo)
      .then((r) => { if (vigente) { setSens(r); setError(null) } })
      .catch((e) => vigente && setError(e.message))
    return () => { vigente = false }
  }, [tablaId, metodo, version])

  const comparacion = topsis.map((t) => {
    const lider = (m) => t.alternativas[t.resultados[m].ranking.indexOf(1)].nombre
    const coinciden = t.resultados.ahp.ranking.filter((p, i) => p === t.resultados.critic.ranking[i]).length
    return { id: t.tabla, nombre: t.nombre, ahp: lider('ahp'), critic: lider('critic'), coinciden, total: t.alternativas.length }
  })

  const actual = sens && sens.tabla === tablaId && sens.metodo === metodo ? sens : null
  const crit = actual?.criterios.find((c) => c.criterio === criterioId)
  const datosGrafico = crit?.puntos.map((p) => ({
    peso: p.peso,
    ...Object.fromEntries(actual.alternativas.map((a, i) => [a.id, p.cercania[i]])),
  }))
  const nombreAlt = (i) => actual.alternativas[i].nombre

  return (
    <section>
      <div className="section-head">
        <h2>Análisis de sensibilidad</h2>
        <p className="muted">
          Se compara el resultado de TOPSIS con ambos juegos de pesos y se evalúa la robustez del ranking variando
          el peso de cada criterio entre 0 y 1 (los demás se reescalan proporcionalmente para sumar 1).
        </p>
      </div>

      <div className="card">
        <h3>AHP vs CRITIC</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Tabla</th><th>Líder con AHP</th><th>Líder con CRITIC</th><th>Puestos coincidentes</th></tr>
            </thead>
            <tbody>
              {comparacion.map((c) => (
                <tr key={c.id}>
                  <th className="row-head">{c.nombre}</th>
                  <td>{c.ahp}</td>
                  <td>{c.critic}</td>
                  <td className="num">{c.coinciden} / {c.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Selector opciones={topsis.map((x) => ({ id: x.tabla, label: x.nombre }))} valor={tablaId} onChange={setTablaId} />
      <Selector
        opciones={[{ id: 'ahp', label: 'Pesos AHP' }, { id: 'critic', label: 'Pesos CRITIC' }]}
        valor={metodo}
        onChange={setMetodo}
      />
      <Selector opciones={criterios.map((c) => ({ id: c.id, label: `${c.id} · ${c.nombre}` }))} valor={criterioId} onChange={setCriterioId} />

      {error && <div className="alert error">{error}</div>}
      {!actual && !error && <p className="muted">Calculando…</p>}

      {crit && (
        <>
          <div className="card">
            <h3>
              Ci según el peso de {criterios.find((c) => c.id === criterioId).nombre} · pesos {NOMBRE_METODO[metodo]}
            </h3>
            <p className="muted small">
              Peso actual: <strong>{pct(crit.peso_actual)}</strong>. Líder actual: <strong>{nombreAlt(actual.lider_base)}</strong>
              {crit.lider_estable_min !== null
                ? <> — se mantiene primero con pesos entre <strong>{pct(crit.lider_estable_min, 0)}</strong> y <strong>{pct(crit.lider_estable_max, 0)}</strong>.</>
                : '.'}
            </p>
            <div className="chart">
              <ResponsiveContainer width="100%" height={380}>
                <LineChart data={datosGrafico} margin={{ top: 28, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" />
                  {crit.lider_estable_min !== null && (
                    <ReferenceArea x1={crit.lider_estable_min} x2={crit.lider_estable_max} fill="var(--stable)" fillOpacity={0.5} />
                  )}
                  <XAxis dataKey="peso" type="number" domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} stroke="var(--muted)" />
                  <YAxis domain={[0, 1]} stroke="var(--muted)" />
                  <Tooltip
                    labelFormatter={(v) => `Peso: ${pct(v, 0)}`}
                    formatter={(v, id) => [fmt(v), actual.alternativas.find((a) => a.id === id)?.nombre]}
                    itemSorter={(item) => -item.value}
                    contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                  />
                  <Legend formatter={(id) => actual.alternativas.find((a) => a.id === id)?.nombre} />
                  <ReferenceLine x={crit.peso_actual} stroke="var(--text)" strokeDasharray="4 4" label={{ value: 'actual', fill: 'var(--muted)', position: 'top', fontSize: 12, offset: 8 }} />
                  {actual.alternativas.map((a, i) => (
                    <Line key={a.id} dataKey={a.id} stroke={COLORES[i % COLORES.length]} dot={false} strokeWidth={2} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            {crit.cambios_de_lider.length > 0 && (
              <ul className="small">
                {crit.cambios_de_lider.map((c, k) => (
                  <li key={k}>
                    Entre {pct(c.desde, 0)} y {pct(c.hasta, 0)}: el líder pasa de <strong>{nombreAlt(c.lider_anterior)}</strong> a <strong>{nombreAlt(c.lider_nuevo)}</strong>.
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card">
            <h3>Resumen de robustez · {NOMBRE_METODO[metodo]}</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Criterio</th><th>Peso actual</th><th>Intervalo estable del líder</th><th>Cambios de líder</th></tr>
                </thead>
                <tbody>
                  {actual.criterios.map((c) => (
                    <tr key={c.criterio} className={c.criterio === criterioId ? 'highlight' : ''}>
                      <th className="row-head">{c.criterio} · {criterios.find((x) => x.id === c.criterio).nombre}</th>
                      <td className="num">{pct(c.peso_actual)}</td>
                      <td className="num">
                        {c.lider_estable_min !== null ? `${pct(c.lider_estable_min, 0)} – ${pct(c.lider_estable_max, 0)}` : '—'}
                      </td>
                      <td className="num">{c.cambios_de_lider.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
