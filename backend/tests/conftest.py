"""Shared pytest fixtures."""

from __future__ import annotations

import pytest

from aegis.domains.crowd.model import CrowdModel
from aegis.domains.fire.model import FireModel
from aegis.domains.flood.model import FloodModel
from aegis.ingest.http import use_transport
from aegis.settings import Settings, get_settings


@pytest.fixture(autouse=True)
def no_background_polling(monkeypatch):
    """The Command Center poller must never run during tests: it would call the live feeds."""
    monkeypatch.setenv("AEGIS_OPS_POLL", "false")


@pytest.fixture(autouse=True)
def isolated_database(tmp_path, monkeypatch):
    """Never let a test reach the database in .env (it may be the live Supabase); tests may override this."""
    monkeypatch.setenv("AEGIS_DB_URL", f"sqlite:///{(tmp_path / 'default.db').as_posix()}")
    monkeypatch.delenv("AEGIS_DB_SCHEMA", raising=False)
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture(scope="session")
def flood_model():
    return FloodModel()


@pytest.fixture(scope="session")
def fire_model():
    return FireModel()


@pytest.fixture(scope="session")
def crowd_model():
    return CrowdModel()


@pytest.fixture
def data_dir(tmp_path, monkeypatch):
    """Point every module at an empty temporary data directory."""
    settings = Settings(_env_file=None, aegis_data_dir=tmp_path, aegis_offline=False)
    monkeypatch.setattr("aegis.ingest.cache.get_settings", lambda: settings)
    monkeypatch.setattr("aegis.ingest.http.get_settings", lambda: settings)
    yield tmp_path
    use_transport(None)
