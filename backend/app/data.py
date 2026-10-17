"""Datos provistos por el cliente (fuente: doc/TPI_G7_Crisantemo.xlsx).

Todo es fijo salvo el criterio "Desperdicio Esperado", que el usuario puede
modificar por tabla (ver app/state.py).
"""

ESCALA_DIFICULTAD = {"Muy Simple": 1, "Simple": 2, "Moderado": 3, "Difícil": 4, "Muy Difícil": 5}
ESCALA_VITRINA = {"Muy Poco": 1, "Poco": 2, "Normal": 3, "Alto": 4, "Muy Alto": 5}

CRITERIOS = [
    {"id": "C1", "clave": "demanda", "nombre": "Demanda Esperada", "tipo": "max", "unidad": "Unidades / período"},
    {"id": "C2", "clave": "rentabilidad", "nombre": "Rentabilidad", "tipo": "max", "unidad": "$ UY (precio - costo)"},
    {"id": "C3", "clave": "tiempo", "nombre": "Tiempo de Elaboración", "tipo": "min", "unidad": "Minutos / lote"},
    {"id": "C4", "clave": "dificultad", "nombre": "Dificultad de Elaboración", "tipo": "min", "unidad": "1 (Muy Simple) a 5 (Muy Difícil)"},
    {"id": "C5", "clave": "vida_util", "nombre": "Vida Útil", "tipo": "max", "unidad": "Días"},
    {"id": "C6", "clave": "desperdicio", "nombre": "Desperdicio Esperado", "tipo": "min", "unidad": "Unidades descartadas / lote"},
    {"id": "C7", "clave": "vitrina", "nombre": "Contribución a la Vitrina", "tipo": "max", "unidad": "1 (Muy Poco) a 5 (Muy Alto)"},
]

CRITERIO_EDITABLE = "desperdicio"


def _alt(id_, nombre, demanda, precio, costo, tiempo, dificultad, vida_util, desperdicio, vitrina):
    return {
        "id": id_,
        "nombre": nombre,
        "demanda": demanda,
        "rentabilidad": precio - costo,
        "tiempo": tiempo,
        "dificultad": dificultad,
        "vida_util": vida_util,
        "desperdicio": desperdicio,
        "vitrina": vitrina,
    }


HABITUALES = [
    _alt("A1", "Scones", 18, 75, 17, 30, "Muy Simple", 2, 7, "Muy Alto"),
    _alt("A2", "Chipá", 9, 100, 25, 35, "Moderado", 2, 0, "Muy Alto"),
    _alt("A3", "Roll de Canela", 6, 180, 30, 60, "Simple", 2, 2, "Normal"),
    _alt("A4", "Porción de Tarta de Coco", 4, 220, 52, 60, "Muy Simple", 7, 0, "Alto"),
    _alt("A5", "Alfajor de Dulce de Leche", 6, 140, 58, 70, "Moderado", 14, 0, "Alto"),
    _alt("A6", "Alfajor de Frutos Rojos", 6, 140, 54, 70, "Moderado", 14, 0, "Alto"),
    _alt("A7", "Cookies", 6, 155, 31, 30, "Muy Simple", 7, 1, "Muy Alto"),
    _alt("A8", "Porción de Brownie", 6, 220, 67, 37, "Simple", 4, 2, "Alto"),
    _alt("A9", "Porción de Tarta de Ricota", 6, 220, 51, 90, "Difícil", 5, 0, "Alto"),
]

SHIO_PAN = _alt("A10", "Shio Pan", 16, 90, 15, 90, "Simple", 1, 3, "Muy Alto")
ALFAJOR_MANI = _alt("A10", "Alfajor de Maní", 20, 140, 55, 75, "Moderado", 14, 3, "Alto")

# Cada tabla tiene copias propias de sus filas: el desperdicio se edita por tabla.
TABLAS = {
    "habituales": {
        "id": "habituales",
        "nombre": "Día habitual",
        "descripcion": "Productos habituales de la cartera semanal.",
        "alternativas": [dict(a) for a in HABITUALES],
    },
    "especial": {
        "id": "especial",
        "nombre": "Día habitual + producto especial",
        "descripcion": "Productos habituales más un producto especial para un día particular (Shio Pan).",
        "alternativas": [dict(a) for a in HABITUALES + [SHIO_PAN]],
    },
    "nuevo_habitual": {
        "id": "nuevo_habitual",
        "nombre": "Día habitual + nuevo producto habitual",
        "descripcion": "Productos habituales más una nueva alternativa permanente (Alfajor de Maní).",
        "alternativas": [dict(a) for a in HABITUALES + [ALFAJOR_MANI]],
    },
}

# Tabla de comparación por pares AHP (orden C1..C7), según el cliente.
AHP_MATRIZ = [
    [1, 1 / 7, 1, 1 / 5, 1, 1 / 7, 1],
    [7, 1, 7, 7, 1, 1, 7],
    [1, 1 / 7, 1, 5, 7, 7, 9],
    [5, 1 / 7, 1 / 5, 1, 7, 1 / 7, 1],
    [1, 1, 1 / 7, 1 / 7, 1, 7, 7],
    [7, 1, 1 / 7, 7, 1 / 7, 1, 7],
    [1, 1 / 7, 1 / 9, 1, 1 / 7, 1 / 7, 1],
]

# Índice aleatorio de Saaty según n.
INDICE_ALEATORIO = {1: 0.0, 2: 0.0, 3: 0.58, 4: 0.90, 5: 1.12, 6: 1.24, 7: 1.32, 8: 1.41, 9: 1.45, 10: 1.49}

# CRITIC se calcula sobre la matriz de productos habituales (como en el Excel).
TABLA_CRITIC = "habituales"
