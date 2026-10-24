# Modelo de Apoyo a la Toma de Decisiones - Pastelería Crisantemo

Este proyecto corresponde a la 1ª Entrega del Trabajo Práctico Integrador para la cátedra de Decisiones en Escenarios Complejos (DEC) de la Universidad Tecnológica Nacional - Facultad Regional Córdoba (UTN FRC).

## Descripción del Proyecto

El objetivo principal es desarrollar un modelo de apoyo a la toma de decisiones multicriterio para la pastelería Crisantemo (Montevideo, Uruguay). El sistema busca priorizar y determinar los productos más convenientes para producir, reemplazando la toma de decisiones basada en la intuición por un análisis cuantitativo y estructurado.

El modelo contempla factores económicos, productivos, comerciales y operativos, permitiendo evaluar tanto productos habituales como productos especiales o de edición limitada para días específicos.

## Integrantes y Cátedra

* **Curso:** 5K2 - Ingeniería en Sistemas de Información
* **Docentes:** Ing. Claudia Beatriz Peretto, Ing. Sergio Hernán Rosa

### Grupo 7:

* **Wendler, Juan José** (Legajo: 89390)
* **Angonese, Juan Pablo** (Legajo: 98230)
* **Ceballos Pratto, Agustín** (Legajo: 93203)
* **Scrosati, Emanuel Genaro** (Legajo: 95632)
* **Ghibaudo, Alan Yair** (Legajo: 97570)

## Metodología Utilizada

El problema se aborda como un Problema de Decisión Multicriterio (MCDA) comparando tres métodos para ponderar los criterios y TOPSIS para ordenar las alternativas:

1. **AHP (Analytic Hierarchy Process):** Utilizado para determinar la ponderación y los pesos relativos ($w_j$) de los criterios de evaluación a partir de comparaciones por pares de las preferencias del cliente, validando la consistencia mediante el Índice de Consistencia ($IC$).

2. **CRITIC:** Calcula pesos objetivos usando la variabilidad de cada criterio y su correlación con los demás.

3. **Entropía:** Calcula pesos objetivos a partir de la distribución normalizada de los valores. Los criterios de costo se transforman con $1/x$; si una proporción normalizada es 0, su logaritmo se representa como 0 y su aporte a la entropía también es 0.

4. **TOPSIS (Technique for Order Preference by Similarity to Ideal Solution):** Aplicado sobre las matrices de decisión normalizadas (vía Suma de Cuadrados) para generar un ranking de alternativas en función de su cercanía a la solución ideal. Se calcula con los pesos de AHP, CRITIC y entropía.

## Criterios de Evaluación

Las alternativas de producción (productos) son evaluadas bajo los siguientes 7 criterios:

| Criterio | Tipo | Unidad / Escala | Objetivo |
| ----- | ----- | ----- | ----- |
| **Demanda Esperada** | Cuantitativo | Unidades / Período | Maximizar |
| **Rentabilidad** | Cuantitativo | $ (Precio - Costo) | Maximizar |
| **Tiempo de Elaboración** | Cuantitativo | Minutos / Lote | Minimizar |
| **Dificultad de Elaboración** | Cualitativo Ordinal | 1 a 5 (Muy Simple a Muy Difícil) | Minimizar |
| **Vida Útil** | Cuantitativo | Días | Maximizar |
| **Desperdicio Esperado** | Cuantitativo | Unidades descartadas / Lote | Minimizar |
| **Contribución a la Vitrina** | Cualitativo Ordinal | 1 a 5 (Muy Poco a Muy Alto) | Maximizar |

## Escenarios Evaluados (Matrices de Decisión)

El modelo contempla tres escenarios principales representados mediante distintas matrices:

1. **Matriz 1 (Productos Habituales):** Evaluación de la cartera base de productos semanales (Scones, Chipá, Roll de Canela, Tartas, Alfajores, Cookies, Brownies).

2. **Matriz 2 (Habituales + Producto Especial):** Incorporación de una alternativa especial válida para un día particular (Shio Pan).

3. **Matriz 3 (Habituales + Nuevo Producto Habitual):** Análisis de conveniencia para incorporar una nueva alternativa permanente (Alfajor de Maní).

## Aplicación web

Backend en **Python + FastAPI** (`backend/`) y frontend en **React + JavaScript** con Vite (`frontend/`). Los datos del cliente están en `backend/app/data.py` (tomados de `doc/TPI_G7_Crisantemo.xlsx`); el único dato modificable es el **Desperdicio Esperado**. En la pestaña Tablas, un checkbox permite propagar cambios de productos compartidos y pedir los valores de productos exclusivos de cada escenario.

### Ejecutar

```bash
# Backend (http://127.0.0.1:8000, docs en /docs)
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000

# Frontend (http://localhost:5173, redirige /api al backend)
cd frontend
npm install
npm run dev
```

Tests del backend: `cd backend && python -m pytest`.

### API

| Método | Ruta | Descripción |
| ----- | ----- | ----- |
| GET | `/api/criterios` | Criterios y su sentido (max/min) |
| GET | `/api/tablas` | Las 3 matrices de decisión (con el desperdicio vigente) |
| GET | `/api/pesos` | AHP (λ, IC, IA, RC), CRITIC (σ, correlaciones, Cj, Wj) y entropía (Hj, Dj, Wj) |
| GET | `/api/topsis` · `/api/topsis/{tabla}` | TOPSIS con pesos AHP, CRITIC y entropía |
| GET | `/api/sensibilidad/{tabla}?metodo=ahp\|critic\|entropia&paso=0.05` | Variación del peso de cada criterio de 0 a 1 |
| POST | `/api/tablas/{tabla}/desperdicio` | `{"valores": {"A1": 5}}` — modifica el desperdicio y devuelve TOPSIS recalculado |
| POST | `/api/desperdicio/multiple` | `{"tablas": {"habituales": {"A1": 5}, "especial": {"A1": 5}}}` — actualiza varias tablas en una transacción |
| DELETE | `/api/tablas/{tabla}/desperdicio` | Restablece los valores del cliente |

Tablas: `habituales`, `especial`, `nuevo_habitual`.

### Persistencia

Los desperdicios modificados se guardan en SQLite (`backend/crisantemo.db`, se crea sola al primer uso; se puede cambiar con la variable de entorno `CRISANTEMO_DB`). Solo se almacenan los valores que difieren de los del cliente, en la tabla `desperdicio (tabla_id, alternativa_id, valor, actualizado)`. Para volver a los datos originales: endpoint DELETE o borrar el archivo `.db`.
