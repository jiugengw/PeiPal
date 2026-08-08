"""Async client for the existing PeiPal FastAPI endpoints."""

from __future__ import annotations

from typing import Any

import httpx

from src.mcp.config import peipal_api_url


class PeiPalApiError(RuntimeError):
    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


class PeiPalApi:
    def __init__(self, client: httpx.AsyncClient | None = None) -> None:
        self._client = client

    async def request(
        self,
        method: str,
        path: str,
        *,
        token: str | None = None,
        params: dict[str, Any] | None = None,
        json: dict[str, Any] | None = None,
    ) -> Any:
        owns_client = self._client is None
        client = self._client or httpx.AsyncClient(
            base_url=peipal_api_url(),
            headers={"Authorization": f"Bearer {token}"} if token else {},
            timeout=15,
        )
        try:
            response = await client.request(method, path, params=params, json=json)
            if response.is_error:
                try:
                    body = response.json()
                    detail = body.get("detail", body) if isinstance(body, dict) else body
                except ValueError:
                    detail = response.text
                raise PeiPalApiError(response.status_code, str(detail))
            if response.status_code == 204:
                return None
            return response.json()
        except httpx.HTTPError as error:
            raise PeiPalApiError(503, f"PeiPal API is unavailable: {error}") from error
        finally:
            if owns_client:
                await client.aclose()


def filter_activities(
    activities: list[dict[str, Any]],
    *,
    interest: str | None = None,
    max_cost: float | None = None,
) -> list[dict[str, Any]]:
    interest_terms = [term for term in (interest or "").lower().split() if term]
    filtered: list[dict[str, Any]] = []
    for activity in activities:
        cost = activity.get("cost")
        if max_cost is not None and cost is not None and float(cost) > max_cost:
            continue
        if interest_terms:
            searchable = " ".join(
                [
                    str(activity.get("name") or ""),
                    str(activity.get("description") or ""),
                    " ".join(str(tag) for tag in activity.get("tags") or []),
                ]
            ).lower()
            if not all(term in searchable for term in interest_terms):
                continue
        filtered.append(activity)
    return filtered
