"""Métodos de decisión multicriterio: AHP, CRITIC, TOPSIS y análisis de sensibilidad."""

import math
from statistics import stdev

from .data import ESCALA_DIFICULTAD, ESCALA_VITRINA, INDICE_ALEATORIO


def _normalizar_etiqueta(texto):
    # El Excel usa "Díficil"; se aceptan ambas grafías.
    return texto.replace("Díficil", "Difícil")


def matriz_numerica(alternativas, criterios):
    """Convierte las alternativas a una matriz numérica (escalas ordinales a 1..5)."""
    filas = []
    for alt in alternativas:
        fila = []
        for c in criterios:
            valor = alt[c["clave"]]
            if c["clave"] == "dificultad":
                valor = ESCALA_DIFICULTAD[_normalizar_etiqueta(valor)]
            elif c["clave"] == "vitrina":
                valor = ESCALA_VITRINA[valor]
            fila.append(float(valor))
        filas.append(fila)
    return filas


def _columnas(matriz):
    return [list(col) for col in zip(*matriz)]


def ahp(matriz):
    n = len(matriz)
    sumas = [sum(matriz[i][j] for i in range(n)) for j in range(n)]
    normalizada = [[matriz[i][j] / sumas[j] for j in range(n)] for i in range(n)]
    pesos = [sum(fila) / n for fila in normalizada]
    aw = [sum(matriz[i][j] * pesos[j] for j in range(n)) for i in range(n)]
    aw_w = [aw[i] / pesos[i] for i in range(n)]
    lambda_max = sum(aw_w) / n
    ic = (lambda_max - n) / (n - 1)
    ia = INDICE_ALEATORIO[n]
    rc = ic / ia if ia else 0.0
    return {
        "matriz": matriz,
        "sumas_columnas": sumas,
        "normalizada": normalizada,
        "pesos": pesos,
        "aw": aw,
        "aw_w": aw_w,
        "lambda_max": lambda_max,
        "ic": ic,
        "ia": ia,
        "rc": rc,
        "consistente": rc <= 0.10,
    }


def _correlacion(x, y):
    mx, my = sum(x) / len(x), sum(y) / len(y)
    cov = sum((a - mx) * (b - my) for a, b in zip(x, y))
    vx = sum((a - mx) ** 2 for a in x)
    vy = sum((b - my) ** 2 for b in y)
    if vx == 0 or vy == 0:
        # Criterio sin variación: no aporta información, se toma correlación nula.
        return 0.0
    return cov / math.sqrt(vx * vy)


def critic(matriz, criterios):
    cols = _columnas(matriz)
    maximos = [max(c) for c in cols]
    minimos = [min(c) for c in cols]
    amplitudes = [mx - mn for mx, mn in zip(maximos, minimos)]

    norm_cols = []
    for j, c in enumerate(criterios):
        if amplitudes[j] == 0:
            norm_cols.append([0.0] * len(cols[j]))
        elif c["tipo"] == "max":
            norm_cols.append([(x - minimos[j]) / amplitudes[j] for x in cols[j]])
        else:
            norm_cols.append([(maximos[j] - x) / amplitudes[j] for x in cols[j]])

    desvios = [stdev(col) for col in norm_cols]
    m = len(criterios)
    correlaciones = [[_correlacion(norm_cols[i], norm_cols[k]) if i != k else 1.0 for k in range(m)] for i in range(m)]
    conflicto = [[1 - correlaciones[i][k] for k in range(m)] for i in range(m)]
    informacion = [desvios[j] * sum(conflicto[i][j] for i in range(m)) for j in range(m)]
    total = sum(informacion)
    pesos = [cj / total for cj in informacion] if total else [1 / m] * m

    return {
        "maximos": maximos,
        "minimos": minimos,
        "amplitudes": amplitudes,
        "normalizada": [list(f) for f in zip(*norm_cols)],
        "desvios": desvios,
        "correlaciones": correlaciones,
        "conflicto": conflicto,
        "informacion": informacion,
        "pesos": pesos,
    }


def topsis(matriz, pesos, criterios):
    cols = _columnas(matriz)
    normas = [math.sqrt(sum(x * x for x in col)) for col in cols]
    normalizada = [[(x / normas[j]) if normas[j] else 0.0 for j, x in enumerate(fila)] for fila in matriz]
    ponderada = [[r * pesos[j] for j, r in enumerate(fila)] for fila in normalizada]

    pcols = _columnas(ponderada)
    ideal_pos = [max(col) if c["tipo"] == "max" else min(col) for col, c in zip(pcols, criterios)]
    ideal_neg = [min(col) if c["tipo"] == "max" else max(col) for col, c in zip(pcols, criterios)]

    d_pos = [math.sqrt(sum((v - a) ** 2 for v, a in zip(fila, ideal_pos))) for fila in ponderada]
    d_neg = [math.sqrt(sum((v - a) ** 2 for v, a in zip(fila, ideal_neg))) for fila in ponderada]
    cercania = [(dn / (dp + dn)) if (dp + dn) else 0.0 for dp, dn in zip(d_pos, d_neg)]

    return {
        "normas": normas,
        "normalizada": normalizada,
        "ponderada": ponderada,
        "ideal_positivo": ideal_pos,
        "ideal_negativo": ideal_neg,
        "d_positiva": d_pos,
        "d_negativa": d_neg,
        "cercania": cercania,
        "ranking": ranking(cercania),
    }


def ranking(cercania):
    """Posición (1 = mejor) de cada alternativa según su coeficiente de cercanía."""
    orden = sorted(range(len(cercania)), key=lambda i: -cercania[i])
    posiciones = [0] * len(cercania)
    for pos, i in enumerate(orden, start=1):
        posiciones[i] = pos
    return posiciones


def redistribuir_pesos(pesos, j, nuevo):
    """Fija el peso del criterio j y reparte el resto proporcionalmente entre los demás."""
    resto = 1 - pesos[j]
    if resto == 0:
        otros = 1 / (len(pesos) - 1)
        return [nuevo if k == j else (1 - nuevo) * otros for k in range(len(pesos))]
    return [nuevo if k == j else pesos[k] * (1 - nuevo) / resto for k in range(len(pesos))]


def sensibilidad(matriz, pesos, criterios, paso=0.05):
    """Varía el peso de cada criterio entre 0 y 1 y registra la cercanía de cada alternativa."""
    pasos = int(round(1 / paso))
    valores = [round(i * paso, 6) for i in range(pasos + 1)]
    lider_base = topsis(matriz, pesos, criterios)["ranking"].index(1)

    resultado = []
    for j, c in enumerate(criterios):
        puntos = []
        for v in valores:
            res = topsis(matriz, redistribuir_pesos(pesos, j, v), criterios)
            puntos.append({"peso": v, "cercania": res["cercania"], "ranking": res["ranking"]})

        # Intervalo continuo de pesos (alrededor del actual) en el que el líder no cambia.
        estables = [p["ranking"][lider_base] == 1 for p in puntos]
        inicio = min(range(len(valores)), key=lambda i: abs(valores[i] - pesos[j]))
        lo = hi = inicio
        if estables[inicio]:
            while lo > 0 and estables[lo - 1]:
                lo -= 1
            while hi < len(valores) - 1 and estables[hi + 1]:
                hi += 1
        cambios = []
        for a, b in zip(puntos, puntos[1:]):
            la, lb = a["ranking"].index(1), b["ranking"].index(1)
            if la != lb:
                cambios.append({"desde": a["peso"], "hasta": b["peso"], "lider_anterior": la, "lider_nuevo": lb})

        resultado.append({
            "criterio": c["id"],
            "peso_actual": pesos[j],
            "puntos": puntos,
            "lider_estable_min": valores[lo] if estables[inicio] else None,
            "lider_estable_max": valores[hi] if estables[inicio] else None,
            "cambios_de_lider": cambios,
        })
    return {"lider_base": lider_base, "criterios": resultado}
