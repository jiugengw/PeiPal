"""FastAPI entrypoint for the Count Me In backend."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.config import cors_origins, load_config
from src.api.routes import router


load_config()
app = FastAPI(title="Count Me In API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)
app.include_router(router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
