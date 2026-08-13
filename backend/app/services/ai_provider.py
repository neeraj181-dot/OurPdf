from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

from google import genai
from google.genai import types

from app.core.config import settings


class BaseAIProvider(ABC):
    @abstractmethod
    def generate_content(
        self,
        prompt: Any,
        system_instruction: Optional[str] = None,
        response_mime_type: Optional[str] = None,
    ) -> str:
        """
        Generate text content given a prompt or list of content parts.
        """
        pass


class GenAIProvider(BaseAIProvider):
    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: Optional[str] = None,
    ):
        self.api_key = api_key or settings.AI_API_KEY
        self.model_name = model_name or settings.AI_MODEL_NAME
        self._client: Optional[genai.Client] = None

    @property
    def client(self) -> genai.Client:
        if self._client is None:
            if not self.api_key:
                raise ValueError("AI_API_KEY environment variable is not set.")
            self._client = genai.Client(
                api_key=self.api_key,
                http_options={"headers": {"User-Agent": "spoti-pdf-studio"}},
            )
        return self._client

    def generate_content(
        self,
        prompt: Any,
        system_instruction: Optional[str] = None,
        response_mime_type: Optional[str] = None,
    ) -> str:
        config_kwargs: Dict[str, Any] = {}
        if system_instruction:
            config_kwargs["system_instruction"] = system_instruction
        if response_mime_type:
            config_kwargs["response_mime_type"] = response_mime_type

        config = types.GenerateContentConfig(**config_kwargs) if config_kwargs else None

        response = self.client.models.generate_content(
            model=self.model_name,
            contents=prompt,
            config=config,
        )
        return response.text or ""
