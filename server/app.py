"""Civic Lens backend. Holds the API keys so the static front end never sees them.

Run from the repo folder:  npm run api
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import llm_router
import polypizza

app = FastAPI(title="Civic Lens API")

# The deployed front end (GitHub Pages) lives on a different origin than this server
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["POST"], allow_headers=["*"])


class ResolveRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=200)


@app.post("/api/resolve")
async def resolve(request: ResolveRequest) -> dict:
    """Turn a description into a placeable model: its GLB URL, how to stand it upright, its
    target height and its credit line."""
    route = await llm_router.route(request.prompt)
    model = await polypizza.search(route.query)
    if model is None:
        raise HTTPException(404, f'No model found for "{route.query}"')

    return {
        "query": route.query,
        "title": model["Title"],
        "modelUrl": model["Download"],
        "uprightRotation": polypizza.upright_rotation(model),
        "heightM": route.height_m,
        "attribution": model["Attribution"],
    }
