import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fmt } from '../api'
import { MatrizNumerica, METODOS_PESOS, NOMBRE_METODO, Selector, columnasCriterios } from './common'

export default function TopsisSection({ datos }) {
  const { criterios, topsis } = datos
  const [tablaId, setTablaId] = useState(topsis[0].tabla)
  const [metodo, setMetodo] = useState('ahp')
  const [detalle, setDetalle] = useState(false)

  const t = topsis.find((x) => x.tabla === tablaId)
  const r = t.resultados[metodo]
  const filasAlt = t.alternativas.map((a) => ({ key: a.id, label: `${a.id} · ${a.nombre}` }))
  const cols = columnasCriterios(criterios)

  const ranking = t.alternativas
    .map((a, i) => ({
      ...a,
      ...Object.fromEntries(Object.keys(t.resultados).flatMap((m) => [
        [m, t.resultados[m].cercania[i]],
        [`pos${m}`, t.resultados[m].ranking[i]],
      ])),
      dPos: r.d_positiva[i],
      dNeg: r.d_negativa[i],
      ci: r.cercania[i],
      pos: r.ranking[i],
    }))
    .sort((a, b) => a.pos - b.pos)

  return (
    <section>
      <div className="section-head">
        <h2>TOPSIS</h2>
        <p className="muted">
          Normalización por suma de cuadrados, ponderación con los pesos de AHP, CRITIC o entropía, distancias euclídeas a
          las soluciones ideal (A⁺) y anti-ideal (A⁻), y coeficiente de cercanía Ci = d⁻ / (d⁺ + d⁻).
        </p>
      </div>

      <Selector opciones={topsis.map((x) => ({ id: x.tabla, label: x.nombre }))} valor={tablaId} onChange={setTablaId} />
      <Selector opciones={METODOS_PESOS} valor={metodo} onChange={setMetodo} />

      <div className="card">
        <h3>Ranking · {t.nombre} · pesos {NOMBRE_METODO[metodo]}</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th><th>Alternativa</th><th>d⁺</th><th>d⁻</th><th>Ci</th>
                {Object.keys(t.resultados).map((m) => <th key={m}>Puesto {NOMBRE_METODO[m]}</th>)}
              </tr>
            </thead>
            <tbody>
              {ranking.map((a) => (
                <tr key={a.id} className={a.pos === 1 ? 'highlight' : ''}>
                  <td className="num"><strong>{a.pos}</strong></td>
                  <td>{a.id} · {a.nombre}</td>
                  <td className="num">{fmt(a.dPos)}</td>
                  <td className="num">{fmt(a.dNeg)}</td>
                  <td className="num"><strong>{fmt(a.ci)}</strong></td>
                  {Object.keys(t.resultados).map((m) => <td key={m} className="num">{a[`pos${m}`]}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="chart">
          <ResponsiveContainer width="100%" height={Math.max(260, ranking.length * 34)}>
            <BarChart data={ranking} layout="vertical" margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" />
              <XAxis type="number" domain={[0, 1]} stroke="var(--muted)" />
              <YAxis type="category" dataKey="nombre" width={190} stroke="var(--muted)" tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => fmt(v)} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)' }} />
              <Legend />
              {METODOS_PESOS.map(({ id }, i) => (
                <Bar key={id} dataKey={id} name={`Ci (${NOMBRE_METODO[id]})`} fill={`var(--cat-${i + 1})`} radius={[0, 4, 4, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <button className="btn" onClick={() => setDetalle(!detalle)}>
        {detalle ? 'Ocultar' : 'Ver'} pasos intermedios
      </button>
      {detalle && (
        <>
          <MatrizNumerica titulo="1. Matriz de decisión (valores numéricos)" filas={filasAlt} columnas={cols} valores={t.matriz} decimales={0} />
          <MatrizNumerica
            titulo="2. Matriz normalizada rij = xij / √Σ xij²"
            filas={[...filasAlt, { key: 'norma', label: '√Σ x²' }]}
            columnas={cols}
            valores={[...r.normalizada, r.normas]}
          />
          <MatrizNumerica
            titulo={`3. Matriz ponderada vij = wj · rij (pesos ${NOMBRE_METODO[metodo]})`}
            filas={[...filasAlt, { key: 'ip', label: 'A⁺ (ideal)' }, { key: 'in', label: 'A⁻ (anti-ideal)' }]}
            columnas={cols}
            valores={[...r.ponderada, r.ideal_positivo, r.ideal_negativo]}
            resaltar={(i) => i >= filasAlt.length}
          />
        </>
      )}
    </section>
  )
}
