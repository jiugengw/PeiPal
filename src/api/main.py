"""FastAPI entrypoint for the Count Me In backend."""

from fastapi import FastAPI

from src.api.config import load_config
from src.api.routes import router


load_config()
app = FastAPI(title="Count Me In API", version="0.1.0")
app.include_router(router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
