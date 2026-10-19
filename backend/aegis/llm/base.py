"""LLM provider interface. Every provider talks plain HTTPS through httpx (no vendor SDKs)."""

from __future__ import annotations

from typing import Protocol

import httpx

from aegis.exceptions import AegisError
from aegis.settings import Settings, get_settings

TIMEOUT_S = 45.0


class LLMError(AegisError):
    """Raised when a provider cannot return a completion."""


class LLMProvider(Protocol):
    name: str

    def complete(
        self, system: str, user: str, *, json_mode: bool = False, temperature: float = 0.2
    ) -> str: ...


class NoneProvider:
    """No LLM configured: callers fall back to template text."""

    name = "none"

    def complete(self, system: str, user: str, *, json_mode: bool = False, temperature: float = 0.2) -> str:
        raise LLMError("No LLM provider configured (LLM_PROVIDER=none).")


def post_json(url: str, headers: dict, body: dict, transport: httpx.BaseTransport | None = None) -> dict:
    try:
        with httpx.Client(timeout=TIMEOUT_S, transport=transport) as client:
            resp = client.post(url, headers=headers, json=body)
    except httpx.HTTPError as exc:
        raise LLMError(f"LLM request failed: {exc}") from exc
    if resp.status_code >= 400:
        raise LLMError(f"LLM provider returned HTTP {resp.status_code}: {resp.text[:200]}")
    return resp.json()


def get_provider(settings: Settings | None = None, transport: httpx.BaseTransport | None = None) -> LLMProvider:
    from aegis.llm.claude_provider import ClaudeProvider
    from aegis.llm.gemini_provider import GeminiProvider
    from aegis.llm.groq_provider import GroqProvider

    s = settings or get_settings()
    choice = s.llm_provider.lower().strip()
    if choice == "groq" and s.groq_api_key:
        return GroqProvider(s.groq_api_key, s.llm_model, transport)
    if choice == "gemini" and s.gemini_api_key:
        return GeminiProvider(s.gemini_api_key, s.llm_model, transport)
    if choice == "claude" and s.anthropic_api_key:
        return ClaudeProvider(s.anthropic_api_key, s.llm_model, transport)
    return NoneProvider()
