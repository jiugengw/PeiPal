"""Vercel entrypoint for the PeiPal API deployment."""

from src.api.main import app

__all__ = ["app"]
