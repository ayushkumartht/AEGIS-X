"""Custom exception hierarchy for AEGIS-X."""
from __future__ import annotations


class AegisError(Exception):
    """Base class for all AEGIS-X errors."""


class DomainNotFoundError(AegisError):
    """Raised when an unknown domain key is requested."""
    def __init__(self, domain: str) -> None:
        super().__init__(f"Unknown domain: {domain!r}")
        self.domain = domain


class SimulationError(AegisError):
    """Raised when a simulation step fails unexpectedly."""


class OptimisationError(AegisError):
    """Raised when the optimiser cannot find a feasible solution."""


class ConfigurationError(AegisError):
    """Raised when settings or parameters are invalid."""


class OfflineError(AegisError):
    """Raised when data is needed from the network but AEGIS_OFFLINE is set and nothing is cached."""


class DataError(AegisError):
    """Raised when fetched or configured data is missing or invalid."""
