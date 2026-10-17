import math

import pytest
from fastapi.testclient import TestClient

from app import state
from app.main import app
from app.methods import redistribuir_pesos

client = TestClient(app)

# Valores calculados en doc/TPI_G7_Crisantemo.xlsx
PESOS_AHP_EXCEL = [0.04198573205, 0.2817966139, 0.2179603868, 0.1098632818, 0.1487309978, 0.1726382175, 0.02702477027]
PESOS_CRITIC_EXCEL = [0.123621353, 0.1822157484, 0.1247514236, 0.1276189895, 0.1746760875, 0.1511073871, 0.1160090109]


@pytest.fixture(autouse=True)
def limpiar_estado():
    state.restablecer()
    yield
    state.restablecer()


def test_pesos_coinciden_con_excel():
    p = client.get("/api/pesos").json()
    assert p["ahp"]["pesos"] == pytest.approx(PESOS_AHP_EXCEL, abs=1e-9)
    assert p["ahp"]["lambda_max"] == pytest.approx(12.45449511, abs=1e-7)
    assert p["ahp"]["rc"] == pytest.approx(0.6886988774, abs=1e-9)
    assert p["ahp"]["consistente"] is False
    assert p["critic"]["pesos"] == pytest.approx(PESOS_CRITIC_EXCEL, abs=1e-9)


def test_topsis_tres_tablas():
    res = client.get("/api/topsis").json()
    assert [t["tabla"] for t in res] == ["habituales", "especial", "nuevo_habitual"]
    for t in res:
        for r in t["resultados"].values():
            assert sorted(r["ranking"]) == list(range(1, len(t["alternativas"]) + 1))
            assert all(0 <= c <= 1 for c in r["cercania"])


def test_post_desperdicio_recalcula_topsis():
    antes = client.get("/api/topsis/especial").json()
    r = client.post("/api/tablas/especial/desperdicio", json={"valores": {"A1": 0, "A4": 10}})
    assert r.status_code == 200
    despues = client.get("/api/topsis/especial").json()

    assert despues["matriz"][0][5] == 0 and despues["matriz"][3][5] == 10
    assert despues["resultados"]["ahp"]["cercania"] != antes["resultados"]["ahp"]["cercania"]
    # Las otras tablas no se modifican.
    tablas = {t["id"]: t for t in client.get("/api/tablas").json()}
    assert tablas["habituales"]["matriz"][0][5] == 7
    assert tablas["especial"]["desperdicio_modificado"] == {"A1": 0, "A4": 10}


def test_desperdicio_habituales_recalcula_critic():
    client.post("/api/tablas/habituales/desperdicio", json={"valores": {"A1": 1}})
    assert client.get("/api/pesos").json()["critic"]["pesos"] != pytest.approx(PESOS_CRITIC_EXCEL)


def test_restablecer_desperdicio():
    client.post("/api/tablas/habituales/desperdicio", json={"valores": {"A1": 1}})
    client.delete("/api/tablas/habituales/desperdicio")
    assert client.get("/api/pesos").json()["critic"]["pesos"] == pytest.approx(PESOS_CRITIC_EXCEL, abs=1e-9)


@pytest.mark.parametrize("valores, codigo", [({"A99": 1}, 400), ({"A1": -1}, 400), ({"A1": "x"}, 422)])
def test_post_desperdicio_invalido(valores, codigo):
    assert client.post("/api/tablas/habituales/desperdicio", json={"valores": valores}).status_code == codigo


def test_desperdicio_uniforme_no_rompe():
    valores = {f"A{i}": 2 for i in range(1, 10)}
    r = client.post("/api/tablas/habituales/desperdicio", json={"valores": valores})
    assert r.status_code == 200
    assert math.isclose(sum(client.get("/api/pesos").json()["critic"]["pesos"]), 1)


def test_sensibilidad():
    r = client.get("/api/sensibilidad/habituales", params={"metodo": "critic", "paso": 0.1}).json()
    assert len(r["criterios"]) == 7
    assert len(r["criterios"][0]["puntos"]) == 11


def test_redistribuir_pesos_suma_uno():
    w = redistribuir_pesos(PESOS_AHP_EXCEL, 2, 0.6)
    assert w[2] == 0.6 and math.isclose(sum(w), 1)


def test_desperdicio_persiste_en_sqlite():
    import sqlite3

    client.post("/api/tablas/nuevo_habitual/desperdicio", json={"valores": {"A10": 1, "A2": 4}})
    with sqlite3.connect(state.ruta_db()) as conn:
        filas = conn.execute("SELECT tabla_id, alternativa_id, valor FROM desperdicio ORDER BY alternativa_id").fetchall()
    assert filas == [("nuevo_habitual", "A10", 1.0), ("nuevo_habitual", "A2", 4.0)]

    # Volver al valor original del cliente elimina la fila.
    client.post("/api/tablas/nuevo_habitual/desperdicio", json={"valores": {"A2": 0}})
    assert state.modificados("nuevo_habitual") == {"A10": 1.0}
