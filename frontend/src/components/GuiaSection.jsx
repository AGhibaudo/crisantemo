import { useEffect, useState } from 'react'
import { api, fmt } from '../api'
import { METODOS_TOPSIS, NOMBRE_METODO, Selector } from './common'

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
  critic: {
    titulo: 'Según los números',
    detalle: 'Surge de los propios datos y reparte la importancia de forma casi pareja entre los aspectos.',
  },
  entropia: {
    titulo: 'Según la diversidad de los datos',
    detalle: 'Pesa más los criterios que distinguen en mayor medida a las alternativas.',
  },
}

// Diferencia de Ci (2 puntos de 100) por debajo de la cual dos productos se consideran parejos.
const UMBRAL_PAREJOS = 0.02

const puntaje = (ci) => Math.round(ci * 100)
const porcentaje = (w) => `${Math.round(w * 100)} %`

const listar = (productos) => new Intl.ListFormat('es').format(productos.map((p) => p.nombre))

/**
 * Aplica la regla de decisión de la guía: CRITIC manda y Entropía solo desempata
 * a los productos que CRITIC deja parejos.
 */
function decision(critic, entropia) {
  const lider = critic[0]
  const parejos = critic.filter((a) => lider.ci - a.ci < UMBRAL_PAREJOS)

  if (parejos.length === 1) {
    return entropia[0].id === lider.id
      ? { firme: true, texto: <>Priorizar <strong>{lider.nombre}</strong>: CRITIC y Entropía coinciden.</> }
      : {
          firme: false,
          texto: (
            <>
              Priorizar <strong>{lider.nombre}</strong>, según CRITIC. Entropía prefiere a{' '}
              <strong>{entropia[0].nombre}</strong>, pero eso no cambia la decisión: es un aviso para revisar el
              aspecto que más pesa en Entropía.
            </>
          ),
        }
  }

  const candidatos = entropia.filter((a) => parejos.some((p) => p.id === a.id))
  const finalistas = candidatos.filter((a) => candidatos[0].ci - a.ci < UMBRAL_PAREJOS)
  return {
    firme: false,
    texto: (
      <>
        Con CRITIC quedan parejos {listar(parejos)}. Al desempatar con Entropía,{' '}
        {finalistas.length === 1 ? (
          <>conviene priorizar <strong>{finalistas[0].nombre}</strong>.</>
        ) : (
          <>
            quedan adelante <strong>{listar(finalistas)}</strong>: resultan igual de convenientes y la elección entre
            ellos queda a criterio del cliente.
          </>
        )}
      </>
    ),
  }
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
  const { criterios, pesos: pesosPorTabla, topsis } = datos
  const [tablaId, setTablaId] = useState(topsis[0].tabla)
  const pesos = pesosPorTabla[tablaId]
  const [sens, setSens] = useState({})

  useEffect(() => {
    let vigente = true
    Promise.all(METODOS_TOPSIS.map(({ id }) => api.sensibilidad(tablaId, id)))
      .then((resultados) => vigente && setSens({
        tabla: tablaId,
        ...Object.fromEntries(resultados.map((resultado) => [resultado.metodo, resultado])),
      }))
      .catch(() => vigente && setSens({}))
    return () => { vigente = false }
  }, [tablaId, version])

  const t = topsis.find((x) => x.tabla === tablaId)
  const podio = (m) =>
    t.alternativas
      .map((a, i) => ({ ...a, ci: t.resultados[m].cercania[i], pos: t.resultados[m].ranking[i] }))
      .sort((a, b) => a.pos - b.pos)
  const podios = Object.fromEntries(METODOS_TOPSIS.map(({ id }) => [id, podio(id)]))
  const recomendacion = decision(podios.critic, podios.entropia)
  const ultimo = podios.critic[podios.critic.length - 1]

  const importancia = (m) =>
    criterios.map((c, j) => ({ ...c, peso: pesos[m].pesos[j] })).sort((a, b) => b.peso - a.peso)
  const pesosCritic = importancia('critic')
  const pesosEntropia = importancia('entropia')
  const criticMayor = pesosCritic[0]
  const criticMenor = pesosCritic[pesosCritic.length - 1]
  const entropiaMayor = pesosEntropia[0]
  const entropiaMenor = pesosEntropia[pesosEntropia.length - 1]

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
          Su objetivo es <strong>determinar y priorizar los productos que resultan más convenientes para la
          producción de Crisantemo</strong>, considerando factores económicos, comerciales, productivos y operativos.
          En lugar de decidir "a ojo", compara todos los productos en {criterios.length} aspectos a la vez y arma un
          ranking del más conveniente al menos conveniente.
        </p>
        <p className="muted">
          Hay tres situaciones: un <strong>día habitual</strong>, un día habitual con un <strong>producto
          especial</strong> (Shio Pan) y un día habitual sumando un <strong>nuevo producto fijo</strong> (Alfajor de Maní).
        </p>
        <div className="alert info">
          <strong>Importante:</strong> el ranking <strong>no es un orden de producción</strong>. Indica qué productos
          convienen más, no cuál elaborar primero. Lo explicamos en el punto 8.
        </div>
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
        <h3>3. ¿Por qué no se usa la opinión del cliente (AHP)?</h3>
        <p>
          AHP calcula la importancia de cada aspecto a partir de la opinión del cliente, preguntándole cuál importa más
          que otro, de a pares. Para confiar en el resultado, esas respuestas tienen que ser coherentes entre sí. Eso se
          mide con la <strong>razón de consistencia (RC)</strong>, que debe ser de 0,10 o menos.
        </p>
        <p>
          Acá dio <strong>RC = {fmt(pesos.ahp.rc, 2)}</strong>, casi siete veces el máximo aceptado. Por ejemplo, las
          respuestas dicen que la Dificultad importa más que la Vida Útil, la Vida Útil más que el Desperdicio y el
          Desperdicio más que la Dificultad: un círculo que no permite saber cuál importa más.
        </p>
        <p>
          Por eso <strong>el ranking no se calcula con AHP</strong>. Esto no quiere decir que la opinión del cliente no
          importe, sino que estas respuestas no alcanzan para obtener pesos confiables. Se calculan en cambio con
          CRITIC y Entropía, que surgen de los datos. Los pesos de AHP siguen disponibles como referencia en la
          pestaña <strong>Pesos</strong>.
        </p>
      </div>

      <div className="card">
        <h3>4. ¿Qué pesa más en cada método?</h3>
        <p>
          No todos los aspectos pesan lo mismo. CRITIC y Entropía reparten la importancia de distinta forma, y ambas
          cambian según los productos de cada situación:
        </p>
        <Selector opciones={topsis.map((x) => ({ id: x.tabla, label: x.nombre }))} valor={tablaId} onChange={setTablaId} />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Aspecto</th>
                {METODOS_TOPSIS.map(({ id: m }) => <th key={m} className="num">Peso {NOMBRE_METODO[m]}</th>)}
              </tr>
            </thead>
            <tbody>
              {criterios.map((c, j) => (
                <tr key={c.id}>
                  <th className="row-head">{c.nombre}</th>
                  {METODOS_TOPSIS.map(({ id: m }) => {
                    const mayor = importancia(m)[0].id === c.id
                    return (
                      <td key={m} className={mayor ? 'num highlight' : 'num'}>
                        {mayor ? <strong>{porcentaje(pesos[m].pesos[j])}</strong> : porcentaje(pesos[m].pesos[j])}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted">Resaltado: el aspecto que más pesa en cada método.</p>
      </div>

      <div className="card">
        <h3>5. ¿Qué productos resultan más convenientes?</h3>
        <Selector opciones={topsis.map((x) => ({ id: x.tabla, label: x.nombre }))} valor={tablaId} onChange={setTablaId} />
        <div className="grid-2">
          {METODOS_TOPSIS.map(({ id: m }) => (
            <div key={m}>
              <strong>{NOMBRE_METODO[m]}: {MIRADAS[m].titulo.toLowerCase()}</strong>
              <p className="small muted">{MIRADAS[m].detalle}</p>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th className="num">Puesto</th><th>Producto</th><th className="num">Puntaje</th></tr>
                  </thead>
                  <tbody>
                    {podios[m].map((a) => (
                      <tr key={a.id} className={a.pos === 1 ? 'highlight' : ''}>
                        <td className="num">{a.pos}</td>
                        <td>{a.nombre}</td>
                        <td className="num">{puntaje(a.ci)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
        <div className={`alert ${recomendacion.firme ? 'ok' : 'info'}`}>
          <strong>Decisión para "{t.nombre}":</strong> {recomendacion.texto}
        </div>
      </div>

      <div className="card">
        <h3>6. ¿Qué decisión tomar y en qué momento?</h3>
        <div className="guia-grid">
          <div className="guia-item">
            <strong>Siempre, como primera opción: CRITIC</strong>
            <p className="small">Es la decisión predilecta. Empezá por este ranking para ver qué productos convienen más.</p>
          </div>
          <div className="guia-item">
            <strong>Si los productos quedan parejos: Entropía</strong>
            <p className="small">
              Si CRITIC deja varios productos a menos de 2 puntos, sus aspectos no están marcando una diferencia. Entropía
              desempata porque da más peso a lo que más los diferencia. En "{t.nombre}" ese aspecto
              es {entropiaMayor.nombre}, con {porcentaje(entropiaMayor.peso)} de peso.
            </p>
          </div>
          <div className="guia-item">
            <strong>Si los dos coinciden: decisión firme</strong>
            <p className="small">Cuando el mismo producto lidera en CRITIC y en Entropía, se puede priorizar con confianza.</p>
          </div>
          <div className="guia-item">
            <strong>Si no coinciden y no hay empate: sigue CRITIC</strong>
            <p className="small">Mantené la decisión de CRITIC y tomá la de Entropía como un aviso para revisar ese aspecto.</p>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>7. ¿Por qué CRITIC antes que Entropía?</h3>
        <ul>
          <li>
            <strong>Reparte el peso de forma casi simétrica.</strong> En "{t.nombre}", cada aspecto pesa entre{' '}
            {porcentaje(criticMenor.peso)} y {porcentaje(criticMayor.peso)}. Ninguno recibe mayor peso que el resto de manera
            marcada, y eso se ajusta al objetivo de considerar a la vez factores económicos, comerciales, productivos y
            operativos.
          </li>
          <li>
            <strong>Tiene en cuenta más información.</strong> CRITIC mira cuánto varía cada aspecto y también si aporta
            algo distinto a los demás, para no contar dos veces lo mismo. Entropía solo mira cómo se distribuyen los valores
            de cada aspecto.
          </li>
          <li>
            <strong>Entropía puede depender de un solo dato.</strong> En "{t.nombre}", {entropiaMayor.nombre} pesa{' '}
            {porcentaje(entropiaMayor.peso)} y {entropiaMenor.nombre} apenas {porcentaje(entropiaMenor.peso)}. Cuando un
            aspecto pesa tanto, los demás casi no cuentan. Por eso conviene usarla como desempate y no como decisión principal.
          </li>
        </ul>
      </div>

      <div className="card">
        <h3>8. ¿Por qué el ranking no es un orden de producción?</h3>
        <p>
          El orden que da TOPSIS responde a un único objetivo: <strong>determinar y priorizar los productos que resultan
          más convenientes para la producción de Crisantemo, considerando factores económicos, comerciales, productivos y
          operativos</strong>.
        </p>
        <p>
          El puesto 1 es el producto más conveniente en conjunto, no el que hay que elaborar primero. El ranking tampoco dice
          cuántas unidades hacer ni cómo organizar la jornada. Y estar abajo no significa dejar de elaborar un producto:
          {' '}{ultimo.nombre} sale último con CRITIC, pero eso solo indica que es el menos conveniente de la lista.
        </p>
      </div>

      <div className="card">
        <h3>9. ¿Cómo se lee el puntaje?</h3>
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
        <h3>10. ¿Qué puedo cambiar yo?</h3>
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
        <h3>11. ¿Qué tan firme es el resultado?</h3>
        <p>
          Se probó qué pasaría si a algún aspecto se le diera más o menos importancia de la calculada. Si el ganador
          sigue primero aunque cambie mucho la importancia, el resultado es <strong>firme</strong>.
        </p>
        {sens.tabla === tablaId ? (
          <div className="grid-2">
            {METODOS_TOPSIS.map(({ id: m }) => {
              const r = sens[m]
              const ganador = r.alternativas[r.lider_base].nombre
              const avisos = r.criterios
                .map((c) => ({ c, cambio: cambioCercano(c, r.lider_base) }))
                .filter((x) => x.cambio)
              return (
                <div key={m} className="guia-item">
                  <strong>{NOMBRE_METODO[m]}</strong>
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
          <dt>AHP</dt><dd>Método que calcula los pesos a partir de la opinión del cliente. No se usa para el ranking porque sus respuestas resultaron inconsistentes.</dd>
          <dt>RC (razón de consistencia)</dt><dd>Mide si esas opiniones son coherentes entre sí. Por encima de 0,10 hay contradicciones.</dd>
          <dt>CRITIC</dt><dd>Método que calcula los pesos a partir de los datos. Es la decisión predilecta.</dd>
          <dt>Entropía</dt><dd>Método objetivo que asigna más peso a los criterios que más diferencian las alternativas. Se usa para desempatar.</dd>
          <dt>TOPSIS</dt><dd>Método que arma el ranking comparando cada producto con el ideal y con el peor.</dd>
          <dt>Ci (coeficiente de cercanía)</dt><dd>El puntaje de cada producto, entre 0 y 1 (en esta guía, de 0 a 100).</dd>
          <dt>Análisis de sensibilidad</dt><dd>Prueba de qué tan firme es el ranking si cambian los pesos.</dd>
        </dl>
        <p className="small muted">Valores de referencia: RC actual = {fmt(pesos.ahp.rc, 2)}.</p>
      </div>
    </section>
  )
}
