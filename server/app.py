"""Civic Lens backend. Holds the API keys so the static front end never sees them.

Run from the repo folder:  npm run api
"""

from uuid import UUID

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

import llm_router
import polypizza
import tripo

app = FastAPI(title="Civic Lens API")

# The deployed front end (GitHub Pages) lives on a different origin than this server
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["GET", "POST"], allow_headers=["*"]
)

# Generated models, cached by tripo.check()
app.mount("/api/models", StaticFiles(directory=tripo.CACHE_DIR), name="models")


class ResolveRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=200)


@app.post("/api/resolve")
async def resolve(request: ResolveRequest) -> dict:
    """Turn a description into a placeable model: how to stand it upright, its target height,
    its credit line, and either its GLB URL (library) or a job id to poll (generation)."""
    route = await llm_router.route(request.prompt)
    placement = {"query": route.query, "heightM": route.height_m}

    if route.source == "generate":
        return {
            **placement,
            "title": request.prompt,
            "jobId": await tripo.start(route.query),
            "uprightRotation": [0, 0, 0],  # generated GLBs are Y-up
            "attribution": tripo.ATTRIBUTION,
        }

    model = await polypizza.search(route.query)
    if model is None:
        raise HTTPException(404, f'No model found for "{route.query}"')
    return {
        **placement,
        "title": model["Title"],
        "modelUrl": model["Download"],
        "uprightRotation": polypizza.upright_rotation(model),
        "attribution": model["Attribution"],
    }


@app.get("/api/jobs/{job_id}")
async def job(job_id: UUID) -> dict:
    """Report a generation job's progress; once it succeeds, includes the model's URL."""
    return await tripo.check(str(job_id))
