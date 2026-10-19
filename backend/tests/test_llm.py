import httpx
import pytest

from aegis.llm.base import LLMError, NoneProvider, get_provider
from aegis.llm.explain import narrate, numbers_are_grounded, template_narration
from aegis.settings import Settings

PAYLOAD = {
    "summary": {"mean": 0.62, "p10": 0.31},
    "resilience_worst_10pct": 0.18,
    "single_points_of_failure": [{"element_id": "bridge_b1", "drop_pct": 41.2}],
}


def _settings(**kw):
    return Settings(_env_file=None, **kw)


def test_selects_provider_by_setting_and_key():
    assert get_provider(_settings(llm_provider="none")).name == "none"
    assert get_provider(_settings(llm_provider="groq")).name == "none"  # no key
    assert get_provider(_settings(llm_provider="groq", groq_api_key="k")).name == "groq"
    assert get_provider(_settings(llm_provider="gemini", gemini_api_key="k")).name == "gemini"
    assert get_provider(_settings(llm_provider="claude", anthropic_api_key="k")).name == "claude"


def test_template_uses_only_given_numbers():
    text = template_narration(PAYLOAD)
    assert numbers_are_grounded(text, PAYLOAD)
    assert "bridge_b1" in text


def test_guardrail_rejects_invented_number():
    assert numbers_are_grounded("The plan evacuates 62% on average.", PAYLOAD)
    assert not numbers_are_grounded("The plan evacuates 87% on average.", PAYLOAD)


def _openai_transport(text):
    def handler(request):
        return httpx.Response(200, json={"choices": [{"message": {"content": text}}]})

    return httpx.MockTransport(handler)


def test_narrate_accepts_grounded_llm_text():
    provider = get_provider(_settings(llm_provider="groq", groq_api_key="k"), _openai_transport("Worst 10% gets 18%."))
    out = narrate(PAYLOAD, provider)
    assert out == {"text": "Worst 10% gets 18%.", "source": "groq"}


def test_narrate_falls_back_on_invented_number_and_on_none():
    provider = get_provider(_settings(llm_provider="groq", groq_api_key="k"), _openai_transport("It gets 99%."))
    assert narrate(PAYLOAD, provider)["source"] == "template"
    assert narrate(PAYLOAD, NoneProvider())["source"] == "template"


def test_provider_http_error_becomes_llm_error():
    transport = httpx.MockTransport(lambda r: httpx.Response(500, text="boom"))
    provider = get_provider(_settings(llm_provider="groq", groq_api_key="k"), transport)
    with pytest.raises(LLMError):
        provider.complete("s", "u")
    assert narrate(PAYLOAD, provider)["source"] == "template"
