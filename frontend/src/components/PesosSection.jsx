import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fmt, pct } from '../api'
import { MatrizNumerica } from './common'

export default function PesosSection({ datos }) {
  const { criterios, pesos, tablas } = datos
  const { ahp, critic, entropia } = pesos
  const filasCrit = criterios.map((c) => ({ key: c.id, label: `${c.id} · ${c.nombre}` }))
  const colsCrit = criterios.map((c) => ({ key: c.id, label: c.id }))
  const tablaCritic = tablas.find((t) => t.id === critic.tabla)
  const tablaEntropia = tablas.find((t) => t.id === entropia.tabla)

  const comparacion = criterios.map((c, j) => ({
    criterio: c.id,
    nombre: c.nombre,
    AHP: ahp.pesos[j],
    CRITIC: critic.pesos[j],
    entropia: entropia.pesos[j],
  }))

  return (
    <section>
      <div className="section-head">
        <h2>Determinación de los pesos</h2>
        <p className="muted">
          AHP refleja las preferencias del cliente (comparación por pares). Como su razón de consistencia
          supera 0,10, se comparan con los pesos objetivos de CRITIC y entropía, calculados a partir de los datos.
        </p>
      </div>

      <div className="card">
        <h3>Comparación de pesos</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Criterio</th><th>Tipo</th><th>Peso AHP</th><th>Peso CRITIC</th><th>Peso Entropía</th></tr>
            </thead>
            <tbody>
              {comparacion.map((c, j) => (
                <tr key={c.criterio}>
                  <th className="row-head">{c.criterio} · {c.nombre}</th>
                  <td>{criterios[j].tipo === 'max' ? 'Beneficio' : 'Costo'}</td>
                  <td className="num">{pct(c.AHP)}</td>
                  <td className="num">{pct(c.CRITIC)}</td>
                  <td className="num">{pct(c.entropia)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="chart">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={comparacion} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" />
              <XAxis dataKey="criterio" stroke="var(--muted)" />
              <YAxis tickFormatter={(v) => `${Math.round(v * 100)}%`} stroke="var(--muted)" />
              <Tooltip
                formatter={(v) => pct(v)}
                labelFormatter={(l) => comparacion.find((c) => c.criterio === l)?.nombre}
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              />
              <Legend />
              <Bar dataKey="AHP" fill="var(--serie-1)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="CRITIC" fill="var(--serie-2)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="entropia" name="Entropía" fill="var(--cat-3)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <h2 className="subsection">AHP</h2>
      <div className="grid-4">
        <div className="card kpi"><span className="muted">λ máx</span><strong>{fmt(ahp.lambda_max)}</strong></div>
        <div className="card kpi"><span className="muted">IC = (λ − n)/(n − 1)</span><strong>{fmt(ahp.ic)}</strong></div>
        <div className="card kpi"><span className="muted">IA (n = {criterios.length})</span><strong>{fmt(ahp.ia, 2)}</strong></div>
        <div className={`card kpi ${ahp.consistente ? '' : 'warn'}`}>
          <span className="muted">RC = IC / IA</span><strong>{fmt(ahp.rc)}</strong>
          <span className="small">{ahp.consistente ? 'Consistente (≤ 0,10)' : 'RC > 0,10: el decisor debería revisar sus juicios'}</span>
        </div>
      </div>
      <MatrizNumerica titulo="Matriz de comparación por pares" filas={filasCrit} columnas={colsCrit} valores={ahp.matriz} decimales={3} />
      <MatrizNumerica
        titulo="Matriz normalizada y pesos (promedio por fila)"
        filas={filasCrit}
        columnas={[...colsCrit, { key: 'w', label: 'W' }, { key: 'aw', label: 'AW' }, { key: 'aww', label: 'AW / W' }]}
        valores={ahp.normalizada.map((f, i) => [...f, ahp.pesos[i], ahp.aw[i], ahp.aw_w[i]])}
      />

      <h2 className="subsection">Entropía</h2>
      <p className="muted">Calculada sobre la matriz «{tablaEntropia.nombre}».</p>
      <div className="grid-2">
        <div className="card kpi">
          <span className="muted">Alternativas (n)</span>
          <strong>{entropia.cantidad_alternativas}</strong>
        </div>
        <div className="card kpi">
          <span className="muted">k = 1 / ln(n)</span>
          <strong>{fmt(entropia.factor_normalizacion)}</strong>
        </div>
      </div>
      <p className="muted small">
        Se usa 1/x para transformar criterios de costo. Para pᵢⱼ = 0, el logaritmo se define como 0 y su aporte
        pᵢⱼ · ln(pᵢⱼ) queda en 0.
      </p>
      <MatrizNumerica
        titulo="Matriz transformada (beneficio: x · costo: 1/x)"
        filas={tablaEntropia.alternativas.map((a) => ({ key: a.id, label: `${a.id} · ${a.nombre}` }))}
        columnas={colsCrit}
        valores={entropia.matriz_transformada}
      />
      <MatrizNumerica
        titulo="Matriz normalizada pᵢⱼ = xᵢⱼ / Σxᵢⱼ"
        filas={tablaEntropia.alternativas.map((a) => ({ key: a.id, label: `${a.id} · ${a.nombre}` }))}
        columnas={colsCrit}
        valores={entropia.normalizada}
      />
      <MatrizNumerica
        titulo="Logaritmo natural de la matriz normalizada (ln(0) se representa como 0)"
        filas={tablaEntropia.alternativas.map((a) => ({ key: a.id, label: `${a.id} · ${a.nombre}` }))}
        columnas={colsCrit}
        valores={entropia.logaritmos}
      />
      <MatrizNumerica
        titulo="Entropía y pesos · Hⱼ = −k Σ(pᵢⱼ ln pᵢⱼ), Dⱼ = 1 − Hⱼ, Wⱼ = Dⱼ / ΣDⱼ"
        filas={[
          { key: 'entropia', label: 'Hⱼ (entropía)' },
          { key: 'divergencia', label: 'Dⱼ (divergencia)' },
          { key: 'peso', label: 'Wⱼ (peso)' },
        ]}
        columnas={colsCrit}
        valores={[entropia.entropias, entropia.divergencias, entropia.pesos]}
      />

      <h2 className="subsection">CRITIC</h2>
      <p className="muted">Calculado sobre la matriz «{tablaCritic.nombre}».</p>
      <MatrizNumerica
        titulo="Matriz normalizada (max: (x − min)/amplitud · min: (max − x)/amplitud)"
        filas={tablaCritic.alternativas.map((a) => ({ key: a.id, label: `${a.id} · ${a.nombre}` }))}
        columnas={colsCrit}
        valores={critic.normalizada}
      />
      <MatrizNumerica titulo="Matriz de correlación (Pearson)" filas={filasCrit} columnas={colsCrit} valores={critic.correlaciones} />
      <MatrizNumerica
        titulo="Información por criterio"
        filas={[
          { key: 's', label: 'σ (desvío estándar)' },
          { key: 'sum', label: 'Σ (1 − r)' },
          { key: 'c', label: 'Cj = σ · Σ (1 − r)' },
          { key: 'w', label: 'Wj = Cj / Σ Cj' },
        ]}
        columnas={colsCrit}
        valores={[
          critic.desvios,
          critic.conflicto[0].map((_, j) => critic.conflicto.reduce((s, f) => s + f[j], 0)),
          critic.informacion,
          critic.pesos,
        ]}
      />
    </section>
  )
}
