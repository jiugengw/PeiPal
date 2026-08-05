"""Request models for the website API."""

from __future__ import annotations

from pydantic import BaseModel, Field


class HouseholdCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class OlderAdultCreate(BaseModel):
    household_id: int
    name: str = Field(min_length=1, max_length=120)
    preferred_name: str | None = Field(default=None, max_length=120)
    age: int | None = Field(default=None, ge=0, le=130)
    language: str | None = Field(default=None, max_length=80)
    mobility_notes: str | None = Field(default=None, max_length=2_000)
    transport_notes: str | None = Field(default=None, max_length=2_000)


class TrustedContactCreate(BaseModel):
    older_adult_id: int
    name: str = Field(min_length=1, max_length=120)
    relationship: str = Field(min_length=1, max_length=80)
    email: str | None = Field(default=None, max_length=320)
    phone: str | None = Field(default=None, max_length=40)
