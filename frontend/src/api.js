async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const detail = typeof body.detail === 'string' ? body.detail : `Error ${res.status}`
    throw new Error(detail)
  }
  return res.json()
}

export const api = {
  criterios: () => request('/criterios'),
  tablas: () => request('/tablas'),
  pesos: () => request('/pesos'),
  topsis: () => request('/topsis'),
  sensibilidad: (tabla, metodo, paso = 0.05) =>
    request(`/sensibilidad/${tabla}?metodo=${metodo}&paso=${paso}`),
  guardarDesperdicio: (tabla, valores) =>
    request(`/tablas/${tabla}/desperdicio`, { method: 'POST', body: JSON.stringify({ valores }) }),
  restablecerDesperdicio: (tabla) => request(`/tablas/${tabla}/desperdicio`, { method: 'DELETE' }),
}

export const fmt = (n, d = 4) =>
  typeof n === 'number' ? n.toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d }) : n

export const pct = (n, d = 2) => `${fmt(n * 100, d)} %`
