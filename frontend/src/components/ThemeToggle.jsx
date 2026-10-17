import { useEffect, useState } from 'react'

const CLAVE = 'crisantemo-tema'

function temaInicial() {
  try {
    const guardado = localStorage.getItem(CLAVE)
    if (guardado === 'light' || guardado === 'dark') return guardado
  } catch { /* almacenamiento no disponible */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export default function ThemeToggle() {
  const [tema, setTema] = useState(temaInicial)

  useEffect(() => {
    document.documentElement.dataset.theme = tema
  }, [tema])

  function alternar() {
    const nuevo = tema === 'dark' ? 'light' : 'dark'
    setTema(nuevo)
    try { localStorage.setItem(CLAVE, nuevo) } catch { /* almacenamiento no disponible */ }
  }

  const aOscuro = tema === 'light'
  return (
    <button
      className="theme-toggle"
      onClick={alternar}
      title={aOscuro ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
      aria-label={aOscuro ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
    >
      <span className="icon" aria-hidden="true">{aOscuro ? '☾' : '☀'}</span>
      {aOscuro ? 'Modo oscuro' : 'Modo claro'}
    </button>
  )
}
