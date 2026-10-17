import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import GuiaSection from './components/GuiaSection'
import ThemeToggle from './components/ThemeToggle'
import TablasSection from './components/TablasSection'
import PesosSection from './components/PesosSection'
import TopsisSection from './components/TopsisSection'
import SensibilidadSection from './components/SensibilidadSection'

const SECCIONES = [
  { id: 'guia', label: 'Guía' },
  { id: 'tablas', label: 'Tablas' },
  { id: 'pesos', label: 'Pesos AHP / CRITIC' },
  { id: 'topsis', label: 'TOPSIS' },
  { id: 'sensibilidad', label: 'Análisis de sensibilidad' },
]

export default function App() {
  const [seccion, setSeccion] = useState('tablas')
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(null)
  // Se incrementa cada vez que cambian los datos, para que las secciones recarguen.
  const [version, setVersion] = useState(0)

  const cargar = useCallback(async () => {
    try {
      const [criterios, tablas, pesos, topsis] = await Promise.all([
        api.criterios(), api.tablas(), api.pesos(), api.topsis(),
      ])
      setDatos({ criterios, tablas, pesos, topsis })
      setError(null)
      setVersion((v) => v + 1)
    } catch (e) {
      setError(`No se pudo conectar con el backend: ${e.message}`)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  return (
    <div className="app">
      <header className="header">
        <div className="header-top">
          <div>
            <h1>Crisantemo</h1>
            <p className="subtitle">Modelo de apoyo a la decisión multicriterio · AHP · CRITIC · TOPSIS</p>
          </div>
          <ThemeToggle />
        </div>
        <nav className="tabs">
          {SECCIONES.map((s) => (
            <button
              key={s.id}
              className={seccion === s.id ? 'tab active' : 'tab'}
              onClick={() => setSeccion(s.id)}
            >
              {s.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="main">
        {error && <div className="alert error">{error}</div>}
        {!datos && !error && <p className="muted">Cargando…</p>}
        {datos && seccion === 'guia' && <GuiaSection datos={datos} version={version} irA={setSeccion} />}
        {datos && seccion === 'tablas' && <TablasSection datos={datos} onCambio={cargar} />}
        {datos && seccion === 'pesos' && <PesosSection datos={datos} />}
        {datos && seccion === 'topsis' && <TopsisSection datos={datos} />}
        {datos && seccion === 'sensibilidad' && <SensibilidadSection datos={datos} version={version} />}
      </main>
    </div>
  )
}
