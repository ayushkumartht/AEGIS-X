"""Tests for custom exception hierarchy."""
from __future__ import annotations
import pytest
from aegis.exceptions import AegisError, DomainNotFoundError, SimulationError, ConfigurationError


def test_message_contains_domain():
    assert "tsunami" in str(DomainNotFoundError("tsunami"))


def test_hierarchy():
    assert issubclass(DomainNotFoundError, AegisError)
    assert issubclass(SimulationError, AegisError)
    assert issubclass(ConfigurationError, AegisError)


def test_raises():
    with pytest.raises(DomainNotFoundError):
        raise DomainNotFoundError("fire2")
