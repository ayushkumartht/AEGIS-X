from __future__ import annotations

import httpx

from aegis.llm.base import LLMError, post_json

DEFAULT_MODEL = "gemini-2.5-flash"
URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


class GeminiProvider:
    name = "gemini"

    def __init__(self, api_key: str, model: str = "", transport: httpx.BaseTransport | None = None):
        self.api_key = api_key
        self.model = model or DEFAULT_MODEL
        self.transport = transport

    def complete(self, system: str, user: str, *, json_mode: bool = False, temperature: float = 0.2) -> str:
        config = {"temperature": temperature}
        if json_mode:
            config["responseMimeType"] = "application/json"
        body = {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": user}]}],
            "generationConfig": config,
        }
        data = post_json(
            URL.format(model=self.model), {"x-goog-api-key": self.api_key}, body, self.transport
        )
        try:
            return data["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError) as exc:
            raise LLMError("Gemini returned no text.") from exc
