"""Tripo text-to-3D generation (https://developers.tripo3d.ai)."""

from pathlib import Path

import httpx

from keys import read_key

BASE_URL = "https://openapi.tripo3d.ai/v3"
MODEL = "P1-20260311"  # P series: low-poly with clean topology, light enough for mobile AR
FACE_LIMIT = 10_000    # P1 accepts 50-20,000
ATTRIBUTION = "Generated with Tripo AI"

# Finished models are copied here: Tripo's download links are temporary, and a local copy is
# served from this server's own origin and can be reused (e.g. pre-generated demo prompts).
CACHE_DIR = Path(__file__).parent / "generated"
CACHE_DIR.mkdir(exist_ok=True)

_API_KEY = read_key("TripoAI API Key.txt")


def _api() -> httpx.AsyncClient:
    if not _API_KEY:
        raise RuntimeError("Tripo API key file not found in the secrets folder")
    return httpx.AsyncClient(
        base_url=BASE_URL, headers={"Authorization": f"Bearer {_API_KEY}"}, timeout=30
    )


async def start(prompt: str) -> str:
    """Start a text-to-model task and return its task id."""
    async with _api() as api:
        response = await api.post(
            "/generation/text-to-model",
            json={"prompt": prompt, "model": MODEL, "face_limit": FACE_LIMIT},
        )
    response.raise_for_status()
    return response.json()["data"]["task_id"]


async def check(task_id: str) -> dict:
    """Report a task as {"status": "running" | "success" | "failed", ...}.

    "running" carries "progress" (0-100), "failed" carries "error", and "success" carries
    "modelUrl", the path of the cached GLB on this server.
    """
    path = CACHE_DIR / f"{task_id}.glb"
    model_url = f"/api/models/{path.name}"
    if path.exists():
        return {"status": "success", "modelUrl": model_url}

    async with _api() as api:
        response = await api.get(f"/tasks/{task_id}")
    response.raise_for_status()
    task = response.json()["data"]

    # Tripo reports queued, running, success, failed or cancelled; unknown values keep polling
    if task["status"] in ("failed", "cancelled"):
        return {"status": "failed", "error": task.get("error_message") or "Generation failed"}
    if task["status"] != "success":
        return {"status": "running", "progress": task.get("progress", 0)}

    # Download without the API key header: the file lives on Tripo's CDN
    async with httpx.AsyncClient(timeout=60) as cdn:
        model = await cdn.get(task["output"]["model_url"])
    model.raise_for_status()
    path.write_bytes(model.content)
    return {"status": "success", "modelUrl": model_url}
