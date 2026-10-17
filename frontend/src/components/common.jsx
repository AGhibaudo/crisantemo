import { fmt } from '../api'

export function Selector({ opciones, valor, onChange }) {
  return (
    <div className="selector">
      {opciones.map((o) => (
        <button
          key={o.id}
          className={valor === o.id ? 'chip active' : 'chip'}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function TipoBadge({ tipo }) {
  return <span className={`badge ${tipo}`}>{tipo === 'max' ? 'Max' : 'Min'}</span>
}

/** Tabla numérica: filas = alternativas/criterios, columnas = criterios. */
export function MatrizNumerica({ titulo, filas, columnas, valores, decimales = 4, resaltar }) {
  return (
    <div className="card">
      {titulo && <h3>{titulo}</h3>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th></th>
              {columnas.map((c) => <th key={c.key}>{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={f.key} className={resaltar?.(i) ? 'highlight' : ''}>
                <th className="row-head">{f.label}</th>
                {valores[i].map((v, j) => <td key={j} className="num">{fmt(v, decimales)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export const columnasCriterios = (criterios) =>
  criterios.map((c) => ({
    key: c.id,
    label: (
      <span title={c.unidad}>
        {c.id} · {c.nombre} <TipoBadge tipo={c.tipo} />
      </span>
    ),
  }))

export const NOMBRE_METODO = { ahp: 'AHP', critic: 'CRITIC' }
