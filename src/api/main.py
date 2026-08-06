"""FastAPI entrypoint for the Count Me In backend."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.config import cors_origins, load_config
from src.api.routes import router


load_config()

OPENAPI_TAGS = [
    {
        "name": "System",
        "description": "Service health and operational checks.",
    },
    {
        "name": "Activities",
        "description": "Browse active activities available for planning.",
    },
    {
        "name": "Households",
        "description": "Create and manage the family household.",
    },
    {
        "name": "Older adults",
        "description": "Manage older-adult profiles and practical preferences.",
    },
    {
        "name": "Trusted contacts",
        "description": "Manage people who can support a plan.",
    },
    {
        "name": "Plans",
        "description": "Create plans and move them through approval and sharing.",
    },
    {
        "name": "Support offers",
        "description": "Offer or withdraw practical support for a shared plan.",
    },
]

app = FastAPI(
    title="Count Me In API",
    version="0.1.0",
    description=(
        "Backend API for Count Me In. The API helps households create a supported "
        "activity plan for an older adult. Use the sections below in workflow order: "
        "Activities, Households, Older adults, Trusted contacts, Plans, then Support offers."
    ),
    openapi_tags=OPENAPI_TAGS,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)
app.include_router(router)


@app.get("/health", tags=["System"], summary="Check API health")
def health() -> dict[str, str]:
    return {"status": "ok"}
