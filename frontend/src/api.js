async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    cache: 'no-store',
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
  guardarDesperdicios: (tablas) =>
    request('/desperdicio/multiple', { method: 'POST', body: JSON.stringify({ tablas }) }),
  restablecerDesperdicio: (tabla) => request(`/tablas/${tabla}/desperdicio`, { method: 'DELETE' }),
  restablecerTodosLosDesperdicios: () => request('/desperdicio/multiple', { method: 'DELETE' }),
}

export const fmt = (n, d = 4) =>
  typeof n === 'number' ? n.toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d }) : n

export const pct = (n, d = 2) => `${fmt(n * 100, d)} %`
