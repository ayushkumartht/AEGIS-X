from __future__ import annotations

import httpx

from aegis.llm.base import post_json

DEFAULT_MODEL = "llama-3.3-70b-versatile"
URL = "https://api.groq.com/openai/v1/chat/completions"


class GroqProvider:
    name = "groq"

    def __init__(self, api_key: str, model: str = "", transport: httpx.BaseTransport | None = None):
        self.api_key = api_key
        self.model = model or DEFAULT_MODEL
        self.transport = transport

    def complete(self, system: str, user: str, *, json_mode: bool = False, temperature: float = 0.2) -> str:
        body = {
            "model": self.model,
            "temperature": temperature,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        }
        if json_mode:
            body["response_format"] = {"type": "json_object"}
        data = post_json(URL, {"Authorization": f"Bearer {self.api_key}"}, body, self.transport)
        return data["choices"][0]["message"]["content"]
