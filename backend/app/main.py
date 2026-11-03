from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from . import state
from .data import AHP_MATRIZ, CRITERIOS, TABLAS
from .methods import ahp, critic, entropia, matriz_numerica, sensibilidad, topsis

app = FastAPI(title="Crisantemo - Decisión Multicriterio", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

METODOS_PESOS = ("ahp", "critic", "entropia")


class DesperdicioIn(BaseModel):
    # {alternativa_id: unidades descartadas por lote}
    valores: dict[str, float] = Field(..., examples=[{"A1": 5, "A3": 1}])


class DesperdiciosMultiplesIn(BaseModel):
    # {tabla_id: {alternativa_id: unidades descartadas por lote}}
    tablas: dict[str, dict[str, float]]


def _validar_tabla(tabla_id):
    if tabla_id not in TABLAS:
        raise HTTPException(404, f"Tabla '{tabla_id}' inexistente. Opciones: {', '.join(TABLAS)}")


def _pesos_tabla(tabla):
    """Pesos de los tres métodos calculados sobre la matriz de esta tabla.

    CRITIC y entropía dependen de las alternativas (una nueva alternativa cambia
    la variabilidad, la correlación y la distribución de cada criterio). AHP surge
    de la comparación por pares de criterios del cliente, por lo que se recalcula
    por tabla pero su resultado no depende de las alternativas.
    """
    matriz = matriz_numerica(tabla["alternativas"], CRITERIOS)
    return {
        "tabla": tabla["id"],
        "ahp": {**ahp(AHP_MATRIZ), "tabla": tabla["id"]},
        "critic": {**critic(matriz, CRITERIOS), "tabla": tabla["id"]},
        "entropia": {**entropia(matriz, CRITERIOS), "tabla": tabla["id"]},
    }


def _pesos(tablas):
    """{tabla_id: {ahp, critic, entropia}}"""
    return {tabla_id: _pesos_tabla(t) for tabla_id, t in tablas.items()}


def _tabla_out(tabla):
    return {
        **tabla,
        "matriz": matriz_numerica(tabla["alternativas"], CRITERIOS),
        "desperdicio_modificado": state.modificados(tabla["id"]),
    }


def _topsis_tabla(tabla):
    matriz = matriz_numerica(tabla["alternativas"], CRITERIOS)
    pesos = _pesos_tabla(tabla)
    return {
        "tabla": tabla["id"],
        "nombre": tabla["nombre"],
        "alternativas": [{"id": a["id"], "nombre": a["nombre"]} for a in tabla["alternativas"]],
        "matriz": matriz,
        "pesos": {m: pesos[m]["pesos"] for m in METODOS_PESOS},
        "resultados": {m: topsis(matriz, pesos[m]["pesos"], CRITERIOS) for m in METODOS_PESOS},
    }


@app.get("/api/criterios")
def get_criterios():
    return CRITERIOS


@app.get("/api/tablas")
def get_tablas():
    return [_tabla_out(t) for t in state.tablas_actuales().values()]


@app.get("/api/pesos")
def get_pesos():
    return _pesos(state.tablas_actuales())


@app.get("/api/pesos/{tabla_id}")
def get_pesos_tabla(tabla_id: str):
    _validar_tabla(tabla_id)
    return _pesos_tabla(state.tablas_actuales()[tabla_id])


@app.get("/api/topsis")
def get_topsis():
    return [_topsis_tabla(t) for t in state.tablas_actuales().values()]


@app.get("/api/topsis/{tabla_id}")
def get_topsis_tabla(tabla_id: str):
    _validar_tabla(tabla_id)
    return _topsis_tabla(state.tablas_actuales()[tabla_id])


@app.get("/api/sensibilidad/{tabla_id}")
def get_sensibilidad(tabla_id: str, metodo: str = "ahp", paso: float = 0.05):
    _validar_tabla(tabla_id)
    if metodo not in METODOS_PESOS:
        raise HTTPException(400, f"Método inválido. Opciones: {', '.join(METODOS_PESOS)}")
    if not 0.01 <= paso <= 0.25:
        raise HTTPException(400, "El paso debe estar entre 0.01 y 0.25")
    tabla = state.tablas_actuales()[tabla_id]
    pesos = _pesos_tabla(tabla)[metodo]["pesos"]
    matriz = matriz_numerica(tabla["alternativas"], CRITERIOS)
    return {
        "tabla": tabla_id,
        "metodo": metodo,
        "alternativas": [{"id": a["id"], "nombre": a["nombre"]} for a in tabla["alternativas"]],
        **sensibilidad(matriz, pesos, CRITERIOS, paso),
    }


@app.post("/api/tablas/{tabla_id}/desperdicio")
def post_desperdicio(tabla_id: str, body: DesperdicioIn):
    _validar_tabla(tabla_id)
    ids = {a["id"] for a in TABLAS[tabla_id]["alternativas"]}
    desconocidas = set(body.valores) - ids
    if desconocidas:
        raise HTTPException(400, f"Alternativas inexistentes en la tabla: {', '.join(sorted(desconocidas))}")
    negativos = [k for k, v in body.valores.items() if v < 0]
    if negativos:
        raise HTTPException(400, f"El desperdicio no puede ser negativo: {', '.join(sorted(negativos))}")

    state.actualizar_desperdicio(tabla_id, body.valores)
    return get_topsis()


@app.post("/api/desperdicio/multiple")
def post_desperdicios_multiples(body: DesperdiciosMultiplesIn):
    for tabla_id, valores in body.tablas.items():
        _validar_tabla(tabla_id)
        ids = {a["id"] for a in TABLAS[tabla_id]["alternativas"]}
        desconocidas = set(valores) - ids
        if desconocidas:
            raise HTTPException(
                400,
                f"Alternativas inexistentes en la tabla '{tabla_id}': {', '.join(sorted(desconocidas))}",
            )
        negativos = [k for k, v in valores.items() if v < 0]
        if negativos:
            raise HTTPException(
                400,
                f"El desperdicio no puede ser negativo en '{tabla_id}': {', '.join(sorted(negativos))}",
            )

    state.actualizar_desperdicios(body.tablas)
    return get_topsis()


@app.delete("/api/tablas/{tabla_id}/desperdicio")
def delete_desperdicio(tabla_id: str):
    _validar_tabla(tabla_id)
    state.restablecer(tabla_id)
    return get_topsis()


@app.delete("/api/desperdicio/multiple")
def delete_desperdicios_multiples():
    state.restablecer()
    return get_topsis()
