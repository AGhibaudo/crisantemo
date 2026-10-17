import { useEffect, useState } from 'react'
import { api, fmt } from '../api'
import { Selector } from './common'

const EXPLICACION = {
  demanda: 'Cuántas unidades se espera vender.',
  rentabilidad: 'Cuánto se gana por unidad: precio de venta menos costo (en pesos uruguayos).',
  tiempo: 'Cuántos minutos lleva preparar un lote.',
  dificultad: 'Qué tan complicado es hacerlo, de 1 (muy simple) a 5 (muy difícil).',
  vida_util: 'Cuántos días se mantiene en condiciones para vender.',
  desperdicio: 'Cuántas unidades por lote se espera tirar porque no se venden.',
  vitrina: 'Cuánto aporta a que la vitrina se vea variada y atractiva, de 1 a 5.',
}

const MIRADAS = {
  ahp: {
    titulo: 'Según la opinión del cliente',
    detalle: 'Surge de preguntarle al cliente qué aspecto le importa más que otro, de a pares.',
  },
  critic: {
    titulo: 'Según los números',
    detalle: 'Surge de los propios datos: pesa más lo que más diferencia a un producto de otro.',
  },
}

const puntaje = (ci) => Math.round(ci * 100)
const porcentaje = (w) => `${Math.round(w * 100)} %`

function Barra({ valor, metodo }) {
  return (
    <div className="meter">
      <div className={`meter-fill ${metodo}`} style={{ width: `${Math.max(2, valor * 100)}%` }} />
    </div>
  )
}

/**
 * Cambio más cercano al peso actual (a 10 puntos o menos) que saca del primer puesto
 * al ganador actual. Devuelve el peso al que ocurre y quién pasaría a ser primero.
 */
function cambioCercano(c, liderBase) {
  const candidatos = c.cambios_de_lider
    .map((x) => {
      const subiendo = x.desde >= c.peso_actual
      if (subiendo && x.lider_anterior !== liderBase) return null
      if (!subiendo && x.lider_nuevo !== liderBase) return null
      return {
        peso: subiendo ? x.hasta : x.desde,
        nuevo: subiendo ? x.lider_nuevo : x.lider_anterior,
        distancia: Math.abs((x.desde + x.hasta) / 2 - c.peso_actual),
      }
    })
    .filter((x) => x && x.distancia <= 0.1)
    .sort((a, b) => a.distancia - b.distancia)
  return candidatos[0]
}

export default function GuiaSection({ datos, version, irA }) {
  const { criterios, pesos, topsis } = datos
  const [tablaId, setTablaId] = useState(topsis[0].tabla)
  const [sens, setSens] = useState({})

  useEffect(() => {
    let vigente = true
    Promise.all([api.sensibilidad(tablaId, 'ahp'), api.sensibilidad(tablaId, 'critic')])
      .then(([ahp, critic]) => vigente && setSens({ tabla: tablaId, ahp, critic }))
      .catch(() => vigente && setSens({}))
    return () => { vigente = false }
  }, [tablaId, version])

  const t = topsis.find((x) => x.tabla === tablaId)
  const podio = (m) =>
    t.alternativas
      .map((a, i) => ({ ...a, ci: t.resultados[m].cercania[i], pos: t.resultados[m].ranking[i] }))
      .sort((a, b) => a.pos - b.pos)
  const podioAhp = podio('ahp')
  const podioCritic = podio('critic')
  const coinciden = podioAhp[0].id === podioCritic[0].id

  const importancia = (m) =>
    criterios.map((c, j) => ({ ...c, peso: pesos[m].pesos[j] })).sort((a, b) => b.peso - a.peso)

  const desperdicio = criterios.find((c) => c.clave === 'desperdicio')
  const nombreCrit = (id) => criterios.find((c) => c.id === id).nombre

  return (
    <section className="guia">
      <div className="section-head">
        <h2>Guía rápida</h2>
        <p className="muted">
          Esta guía explica, sin términos técnicos, qué hace la aplicación y cómo leer sus resultados.
        </p>
      </div>

      <div className="card">
        <h3>1. ¿Para qué sirve?</h3>
        <p>
          Ayuda a decidir <strong>qué productos conviene priorizar en la producción</strong>. En lugar de
          decidir "a ojo", compara todos los productos en {criterios.length} aspectos a la vez (cuánto se
          vende, cuánto se gana, cuánto tiempo lleva, etc.) y arma un ranking del más conveniente al menos
          conveniente.
        </p>
        <p className="muted">
          Hay tres situaciones: un <strong>día habitual</strong>, un día habitual con un <strong>producto
          especial</strong> (Shio Pan) y un día habitual sumando un <strong>nuevo producto fijo</strong> (Alfajor de Maní).
        </p>
      </div>

      <div className="card">
        <h3>2. Los {criterios.length} aspectos que se comparan</h3>
        <div className="guia-grid">
          {criterios.map((c) => (
            <div key={c.id} className="guia-item">
              <div className="guia-item-head">
                <strong>{c.nombre}</strong>
                <span className={`badge ${c.tipo}`}>{c.tipo === 'max' ? 'más es mejor' : 'menos es mejor'}</span>
              </div>
              <p className="small">{EXPLICACION[c.clave]}</p>
              {c.clave === 'desperdicio' && <p className="small editable-note">Este es el único dato que podés modificar.</p>}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>3. ¿Qué es lo más importante?</h3>
        <p>
          No todos los aspectos pesan lo mismo. Se calcularon dos formas de repartir la importancia, y se
          muestran ambas para comparar:
        </p>
        <div className="grid-2">
          {['ahp', 'critic'].map((m) => (
            <div key={m} className="guia-item">
              <strong>{MIRADAS[m].titulo}</strong>
              <p className="small muted">{MIRADAS[m].detalle}</p>
              {importancia(m).map((c) => (
                <div key={c.id} className="meter-row">
                  <span className="small">{c.nombre}</span>
                  <Barra valor={c.peso} metodo={m} />
                  <span className="small num">{porcentaje(c.peso)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        {!pesos.ahp.consistente && (
          <p className="small muted">
            ¿Por qué dos formas? Al comparar los aspectos de a pares, las respuestas del cliente tuvieron algunas
            contradicciones (por ejemplo, decir que A importa más que B, B más que C, pero C más que A). Por eso,
            además de su opinión, se calculó una segunda versión basada solo en los datos.
          </p>
        )}
      </div>

      <div className="card">
        <h3>4. ¿Qué conviene producir?</h3>
        <Selector opciones={topsis.map((x) => ({ id: x.tabla, label: x.nombre }))} valor={tablaId} onChange={setTablaId} />
        <div className="grid-2">
          {[['ahp', podioAhp], ['critic', podioCritic]].map(([m, lista]) => (
            <div key={m} className="guia-item">
              <strong>{MIRADAS[m].titulo}</strong>
              <ol className="podio">
                {lista.map((a, i) => (
                  <li key={a.id} className={i === 0 ? 'primero' : i < 3 ? 'top' : ''}>
                    <span>{a.nombre}</span>
                    <Barra valor={a.ci} metodo={m} />
                    <span className="num"><strong>{puntaje(a.ci)}</strong><span className="muted small"> / 100</span></span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
        <div className={`alert ${coinciden ? 'ok' : 'info'}`}>
          {coinciden ? (
            <>Las dos miradas coinciden: <strong>{podioAhp[0].nombre}</strong> es el producto más conveniente.</>
          ) : (
            <>
              Las miradas no coinciden: según el cliente conviene <strong>{podioAhp[0].nombre}</strong> y según los
              números <strong>{podioCritic[0].nombre}</strong>. Los productos que aparecen arriba en ambas listas son
              una apuesta segura.
            </>
          )}
        </div>
      </div>

      <div className="card">
        <h3>5. ¿Cómo se lee el puntaje?</h3>
        <p>
          Imaginá dos productos inventados: el <strong>producto ideal</strong>, que tiene lo mejor de todos en cada
          aspecto (el que más se vende, el que más deja, el más rápido…), y el <strong>peor producto posible</strong>,
          que tiene lo peor en cada uno.
        </p>
        <p>
          El puntaje dice qué tan cerca está cada producto real del ideal: <strong>100</strong> sería igual al ideal y
          <strong> 0</strong> igual al peor. No hace falta llegar a 100; lo que importa es la posición frente a los demás.
          Si dos productos tienen puntajes muy parecidos, prácticamente empatan.
        </p>
      </div>

      <div className="card">
        <h3>6. ¿Qué puedo cambiar yo?</h3>
        <p>
          Todos los datos los dio el cliente y están fijos, salvo el <strong>{desperdicio.nombre}</strong>. Si notás
          que de un producto se tira más (o menos) de lo previsto, podés actualizarlo:
        </p>
        <ol>
          <li>Entrá a la pestaña <strong>Tablas</strong> y elegí el día.</li>
          <li>Cambiá el número en la columna resaltada <strong>{desperdicio.nombre}</strong>.</li>
          <li>Tocá <strong>Guardar y recalcular TOPSIS</strong>. El ranking se actualiza solo, y el cambio queda guardado.</li>
        </ol>
        <p className="small muted">
          Más desperdicio hace que el producto baje en el ranking. Si te equivocás, el botón
          "Restablecer valores del cliente" vuelve todo a como estaba.
        </p>
        <button className="btn primary" onClick={() => irA('tablas')}>Ir a Tablas</button>
      </div>

      <div className="card">
        <h3>7. ¿Qué tan firme es el resultado?</h3>
        <p>
          Se probó qué pasaría si a algún aspecto se le diera más o menos importancia de la calculada. Si el ganador
          sigue primero aunque cambie mucho la importancia, el resultado es <strong>firme</strong>.
        </p>
        {sens.tabla === tablaId ? (
          <div className="grid-2">
            {['ahp', 'critic'].map((m) => {
              const r = sens[m]
              const ganador = r.alternativas[r.lider_base].nombre
              const avisos = r.criterios
                .map((c) => ({ c, cambio: cambioCercano(c, r.lider_base) }))
                .filter((x) => x.cambio)
              return (
                <div key={m} className="guia-item">
                  <strong>{MIRADAS[m].titulo}</strong>
                  {avisos.length === 0 ? (
                    <p className="small">
                      <strong>{ganador}</strong> se mantiene primero aunque la importancia de cualquier aspecto
                      cambie 10 puntos o más. Resultado firme.
                    </p>
                  ) : (
                    <>
                      <p className="small"><strong>{ganador}</strong> va primero, pero podría cambiar si:</p>
                      <ul className="small">
                        {avisos.map(({ c, cambio }) => (
                          <li key={c.criterio}>
                            {nombreCrit(c.criterio)} pasara de {porcentaje(c.peso_actual)} a cerca de{' '}
                            {porcentaje(cambio.peso)} de importancia: el primero sería{' '}
                            <strong>{r.alternativas[cambio.nuevo].nombre}</strong>.
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <p className="muted small">Calculando…</p>
        )}
        <p className="small muted">El detalle con gráficos está en la pestaña <strong>Análisis de sensibilidad</strong>.</p>
      </div>

      <div className="card">
        <h3>Diccionario de términos</h3>
        <p className="small muted">Por si ves estas palabras en las otras pestañas:</p>
        <dl className="glosario">
          <dt>Criterio</dt><dd>Cada uno de los aspectos que se comparan (demanda, rentabilidad, etc.).</dd>
          <dt>Alternativa</dt><dd>Cada producto (A1, A2…).</dd>
          <dt>Peso</dt><dd>Qué tan importante es un criterio. Todos los pesos suman 100 %.</dd>
          <dt>AHP</dt><dd>Método que calcula los pesos a partir de la opinión del cliente.</dd>
          <dt>RC (razón de consistencia)</dt><dd>Mide si esas opiniones son coherentes entre sí. Por encima de 0,10 hay contradicciones.</dd>
          <dt>CRITIC</dt><dd>Método que calcula los pesos a partir de los datos.</dd>
          <dt>TOPSIS</dt><dd>Método que arma el ranking comparando cada producto con el ideal y con el peor.</dd>
          <dt>Ci (coeficiente de cercanía)</dt><dd>El puntaje de cada producto, entre 0 y 1 (en esta guía, de 0 a 100).</dd>
          <dt>Análisis de sensibilidad</dt><dd>Prueba de qué tan firme es el ranking si cambian los pesos.</dd>
        </dl>
        <p className="small muted">Valores de referencia: RC actual = {fmt(pesos.ahp.rc, 2)}.</p>
      </div>
    </section>
  )
}
