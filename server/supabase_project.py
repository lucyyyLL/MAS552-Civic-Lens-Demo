"""The Supabase project that holds shared objects and generated models (supabase/schema.sql).

Settings come from "Supabase Settings.txt" in the secrets folder: PROJECT_ID (the project's
URL or ref), PUBLISHABLE_KEY and SECRET_KEY. The publishable key is meant for browsers, where
row-level security protects the data, so it is handed to the front end at runtime instead of
being committed. The secret key bypasses row-level security and never leaves this server.
"""

from urllib.parse import urlsplit

import httpx

from keys import read_settings

MODELS_BUCKET = "models"

_SETTINGS = read_settings("Supabase Settings.txt")


def _project_url() -> str | None:
    project = _SETTINGS.get("PROJECT_ID")
    if not project:
        return None
    # Accept the project's REST or base URL as well as the bare ref
    host = urlsplit(project).netloc or f"{project}.supabase.co"
    return f"https://{host}"


URL = _project_url()


def public_config() -> dict:
    """What the front end needs to connect: the project URL and the publishable key."""
    if not (URL and _SETTINGS.get("PUBLISHABLE_KEY")):
        raise RuntimeError("Supabase settings not found in the secrets folder")
    return {"url": URL, "publishableKey": _SETTINGS["PUBLISHABLE_KEY"]}


async def upload_model(name: str, content: bytes) -> str:
    """Store a GLB in the public models bucket and return its permanent URL."""
    secret = _SETTINGS.get("SECRET_KEY")
    if not (URL and secret):
        raise RuntimeError("Supabase secret key not found in the secrets folder")
    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(
            f"{URL}/storage/v1/object/{MODELS_BUCKET}/{name}",
            content=content,
            headers={"apikey": secret, "Content-Type": "model/gltf-binary", "x-upsert": "true"},
        )
    response.raise_for_status()
    return f"{URL}/storage/v1/object/public/{MODELS_BUCKET}/{name}"
