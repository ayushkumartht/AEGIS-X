"""Shared pytest fixtures."""
from __future__ import annotations
import pytest
from aegis.domains.flood.model import FloodModel
from aegis.domains.fire.model import FireModel
from aegis.domains.crowd.model import CrowdModel


@pytest.fixture(scope="session")
def flood_model():
    return FloodModel()


@pytest.fixture(scope="session")
def fire_model():
    return FireModel()


@pytest.fixture(scope="session")
def crowd_model():
    return CrowdModel()
