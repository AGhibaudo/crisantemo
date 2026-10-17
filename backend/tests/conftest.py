import pytest


@pytest.fixture(autouse=True)
def db_temporal(tmp_path, monkeypatch):
    # Cada test usa su propia base SQLite, sin tocar backend/crisantemo.db.
    monkeypatch.setenv("CRISANTEMO_DB", str(tmp_path / "test.db"))
