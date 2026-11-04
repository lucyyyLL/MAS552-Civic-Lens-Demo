"""Poly Pizza model library search (https://poly.pizza/docs/api)."""

import math
from urllib.parse import quote

import httpx

from keys import read_key

SEARCH_URL = "https://api.poly.pizza/v1.1/search/{query}"
MAX_TRIANGLES = 50_000  # heavier meshes can crash Safari on iPhones

# Uploaders frame thumbnails from slightly above the model. A camera this far below the horizon
# means the model is not Y-up, e.g. exported Z-up from Blender and framed from its front.
BELOW_HORIZON = math.radians(110)

_API_KEY = read_key("PolyPizza API Key.txt")


async def search(query: str) -> dict | None:
    """Return the most relevant model light enough for mobile AR, or None if nothing matches.

    Each result includes Title, Download (a CORS-enabled GLB URL), Attribution and Licence.
    """
    if not _API_KEY:
        raise RuntimeError("Poly Pizza API key file not found in the secrets folder")

    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.get(
            SEARCH_URL.format(query=quote(query)),
            headers={"x-auth-token": _API_KEY},
            params={"Limit": 10},
        )
    response.raise_for_status()

    results = response.json().get("results", [])
    return next((m for m in results if m["Tri Count"] <= MAX_TRIANGLES), None)


def upright_rotation(model: dict) -> list[float]:
    """Return the [x, y, z] rotation in degrees that stands the model upright.

    Uses the thumbnail camera Poly Pizza stores per model ("Orbit"; phi is its angle from +Y).
    A camera far below the horizon marks a Z-up model, which is turned so +Z points up.
    """
    phi = float((model.get("Orbit") or {}).get("phi", 0))
    return [-90, 0, 0] if phi > BELOW_HORIZON else [0, 0, 0]
