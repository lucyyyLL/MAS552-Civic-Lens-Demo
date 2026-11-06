"""LLM router: decides whether a description is served from the model library or generated with
text-to-3D, and estimates its real-world height.
"""

from typing import Literal

import anthropic
from pydantic import BaseModel, Field

from keys import read_key

MODEL = "claude-haiku-5-5"

SYSTEM_PROMPT = """You prepare objects for placement in an augmented-reality city scene.
Objects come either from a library of generic low-poly models (fast, free) or from a text-to-3D
generator (one to two minutes, costs credits). Given a user's description, return:
- source: "library" for common, generic objects the description names without a distinctive
  design ("a bench", "a small oak tree", "street lamp", "red car"). "generate" when the
  description asks for a specific design, form, material or style that a generic model would
  miss ("an organic wooden pavilion", "a bench shaped like a wave", "a flower installation").
- query: for "library", a short search term (1-3 words, English, singular), e.g. "park bench".
  For "generate", a clear English description of the single object for the generator: shape,
  material, colors and style, ending with "low-poly", without size or placement details.
- height_m: the object's overall real-world height in meters, from the ground to its highest
  point, e.g. 0.85 for a park bench with a backrest, 4 for a pavilion. Use an explicit size
  when given ("a 10 m tower"), and scale for size words ("a small oak tree" is about 3 m, not
  the 15 m of a mature oak)."""


class Route(BaseModel):
    source: Literal["library", "generate"] = Field(description="Where the model comes from")
    query: str = Field(description="Library search term, or the description for the generator")
    height_m: float = Field(gt=0, description="Overall real-world height in meters")


_api_key = read_key("Anthropic API Key.txt")
_client = anthropic.AsyncAnthropic(api_key=_api_key) if _api_key else None


def _fallback(prompt: str) -> Route:
    """Search the library for the raw prompt at a 1 m height."""
    return Route(source="library", query=prompt, height_m=1.0)


async def route(prompt: str) -> Route:
    """Route a prompt. Without an Anthropic key, every prompt goes to the library."""
    if _client is None:
        return _fallback(prompt)

    response = await _client.messages.parse(
        model=MODEL,
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
        output_format=Route,
    )
    # parsed_output is None if the model refused or was cut off
    return response.parsed_output or _fallback(prompt)
