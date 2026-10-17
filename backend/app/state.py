"""Estado persistente (SQLite): valores de Desperdicio Esperado modificados por el usuario.

Solo se guardan los valores que difieren de los provistos por el cliente; las
tablas originales siguen viviendo en app/data.py.
"""

import copy
import os
import sqlite3
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path

from .data import TABLAS

DB_POR_DEFECTO = Path(__file__).resolve().parent.parent / "crisantemo.db"

_ESQUEMA = """
CREATE TABLE IF NOT EXISTS desperdicio (
    tabla_id       TEXT NOT NULL,
    alternativa_id TEXT NOT NULL,
    valor          REAL NOT NULL CHECK (valor >= 0),
    actualizado    TEXT NOT NULL,
    PRIMARY KEY (tabla_id, alternativa_id)
)
"""


def ruta_db():
    return Path(os.environ.get("CRISANTEMO_DB", DB_POR_DEFECTO))


def _conectar():
    conn = sqlite3.connect(ruta_db())
    conn.execute(_ESQUEMA)
    return conn


def _leer(tabla_id=None):
    """{tabla_id: {alternativa_id: valor}}"""
    with closing(_conectar()) as conn:
        if tabla_id is None:
            filas = conn.execute("SELECT tabla_id, alternativa_id, valor FROM desperdicio").fetchall()
        else:
            filas = conn.execute(
                "SELECT tabla_id, alternativa_id, valor FROM desperdicio WHERE tabla_id = ?", (tabla_id,)
            ).fetchall()
    resultado = {}
    for t, a, v in filas:
        resultado.setdefault(t, {})[a] = v
    return resultado


def tablas_actuales():
    """Tablas del cliente con los desperdicios modificados aplicados."""
    tablas = copy.deepcopy(TABLAS)
    for tabla_id, valores in _leer().items():
        if tabla_id not in tablas:
            continue
        for alt in tablas[tabla_id]["alternativas"]:
            if alt["id"] in valores:
                alt["desperdicio"] = valores[alt["id"]]
    return tablas


def modificados(tabla_id):
    return _leer(tabla_id).get(tabla_id, {})


def actualizar_desperdicio(tabla_id, valores):
    originales = {a["id"]: a["desperdicio"] for a in TABLAS[tabla_id]["alternativas"]}
    ahora = datetime.now(timezone.utc).isoformat(timespec="seconds")
    with closing(_conectar()) as conn, conn:
        for alt_id, valor in valores.items():
            if valor == originales[alt_id]:
                conn.execute(
                    "DELETE FROM desperdicio WHERE tabla_id = ? AND alternativa_id = ?", (tabla_id, alt_id)
                )
            else:
                conn.execute(
                    """INSERT INTO desperdicio (tabla_id, alternativa_id, valor, actualizado)
                       VALUES (?, ?, ?, ?)
                       ON CONFLICT (tabla_id, alternativa_id)
                       DO UPDATE SET valor = excluded.valor, actualizado = excluded.actualizado""",
                    (tabla_id, alt_id, valor, ahora),
                )


def restablecer(tabla_id=None):
    with closing(_conectar()) as conn, conn:
        if tabla_id is None:
            conn.execute("DELETE FROM desperdicio")
        else:
            conn.execute("DELETE FROM desperdicio WHERE tabla_id = ?", (tabla_id,))
