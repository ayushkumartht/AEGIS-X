from __future__ import annotations

import httpx

from aegis.llm.base import LLMError, post_json

DEFAULT_MODEL = "claude-sonnet-5-5"
URL = "https://api.anthropic.com/v1/messages"


class ClaudeProvider:
    name = "claude"

    def __init__(self, api_key: str, model: str = "", transport: httpx.BaseTransport | None = None):
        self.api_key = api_key
        self.model = model or DEFAULT_MODEL
        self.transport = transport

    def complete(self, system: str, user: str, *, json_mode: bool = False, temperature: float = 0.2) -> str:
        if json_mode:
            system = system + "\nReply with a single JSON object and nothing else."
        body = {
            "model": self.model,
            "max_tokens": 700,
            "temperature": temperature,
            "system": system,
            "messages": [{"role": "user", "content": user}],
        }
        headers = {"x-api-key": self.api_key, "anthropic-version": "2023-06-01"}
        data = post_json(URL, headers, body, self.transport)
        try:
            return data["content"][0]["text"]
        except (KeyError, IndexError) as exc:
            raise LLMError("Claude returned no text.") from exc
