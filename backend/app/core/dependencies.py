from app.core.config import settings
from app.services.ai_provider import BaseAIProvider, GenAIProvider


def get_ai_provider() -> BaseAIProvider:
    return GenAIProvider()
