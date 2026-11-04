"""LLM router: turns a free-form description into a library search term and a real-world height.

Phase 2 will add a "generate" route for objects the library cannot cover.
"""

import anthropic
from pydantic import BaseModel, Field

from keys import read_key

MODEL = "claude-haiku-5-5"

SYSTEM_PROMPT = """You prepare objects for placement in an augmented-reality city scene.
Given a user's description, return:
- query: a short search term (1-3 words, English, singular) for a low-poly 3D model library,
  e.g. "park bench", "oak tree", "street lamp".
- height_m: the object's overall real-world height in meters, from the ground to its highest
  point, e.g. 0.85 for a park bench with a backrest, 4 for a pavilion. Use an explicit size
  when given ("a 10 m tower"), and scale for size words ("a small oak tree" is about 3 m, not
  the 15 m of a mature oak)."""


class Route(BaseModel):
    query: str = Field(description="Short search term for the model library")
    height_m: float = Field(gt=0, description="Typical real-world height in meters")


_api_key = read_key("Anthropic API Key.txt")
_client = anthropic.AsyncAnthropic(api_key=_api_key) if _api_key else None


async def route(prompt: str) -> Route:
    """Route a prompt. Without an Anthropic key, search for the raw prompt at a 1 m height."""
    if _client is None:
        return Route(query=prompt, height_m=1.0)

    response = await _client.messages.parse(
        model=MODEL,
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
        output_format=Route,
    )
    # parsed_output is None if the model refused or was cut off
    return response.parsed_output or Route(query=prompt, height_m=1.0)
