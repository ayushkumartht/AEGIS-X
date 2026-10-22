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


def test_aegis_error_is_exception():
    assert issubclass(AegisError, Exception)


def test_simulation_error_raises():
    with pytest.raises(SimulationError):
        raise SimulationError("model diverged")


def test_configuration_error_raises():
    with pytest.raises(ConfigurationError):
        raise ConfigurationError("missing key: api_url")


def test_domain_not_found_isinstance():
    exc = DomainNotFoundError("earthquake")
    assert isinstance(exc, AegisError)
    assert isinstance(exc, Exception)


def test_simulation_error_message():
    msg = "NaN encountered at step 42"
    exc = SimulationError(msg)
    assert msg in str(exc)


def test_configuration_error_message():
    msg = "REDIS_URL is not set"
    exc = ConfigurationError(msg)
    assert msg in str(exc)

