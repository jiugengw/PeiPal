"""Request models for the website API."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class HouseholdCreate(BaseModel):
    model_config = ConfigDict(json_schema_extra={"examples": [{"name": "Lim Family"}]})

    name: str = Field(min_length=1, max_length=120)


class HouseholdUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class OlderAdultCreate(BaseModel):
    model_config = ConfigDict(json_schema_extra={"examples": [{
        "household_id": 1,
        "name": "Mary Lim",
        "preferred_name": "Mary",
        "age": 75,
        "language": "English",
        "mobility_notes": "Prefers seated activities",
        "transport_notes": "Family can help arrange transport",
        "sharing_mode": "family_approval",
    }]})

    household_id: int
    name: str = Field(min_length=1, max_length=120)
    preferred_name: str | None = Field(default=None, max_length=120)
    age: int | None = Field(default=None, ge=0, le=130)
    language: str | None = Field(default=None, max_length=80)
    mobility_notes: str | None = Field(default=None, max_length=2_000)
    transport_notes: str | None = Field(default=None, max_length=2_000)
    sharing_mode: Literal["direct", "family_approval"] = "family_approval"


class OlderAdultUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    preferred_name: str | None = Field(default=None, max_length=120)
    age: int | None = Field(default=None, ge=0, le=130)
    language: str | None = Field(default=None, max_length=80)
    mobility_notes: str | None = Field(default=None, max_length=2_000)
    transport_notes: str | None = Field(default=None, max_length=2_000)
    sharing_mode: Literal["direct", "family_approval"] | None = None


class TrustedContactCreate(BaseModel):
    model_config = ConfigDict(json_schema_extra={"examples": [{
        "older_adult_id": 1,
        "name": "Anna Lim",
        "relationship": "Daughter",
        "email": "anna@example.com",
        "phone": "+65 91234567",
    }]})

    older_adult_id: int
    name: str = Field(min_length=1, max_length=120)
    relationship: str = Field(min_length=1, max_length=80)
    email: str | None = Field(default=None, max_length=320)
    phone: str | None = Field(default=None, max_length=40)


class TrustedContactUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    relationship: str | None = Field(default=None, min_length=1, max_length=80)
    email: str | None = Field(default=None, max_length=320)
    phone: str | None = Field(default=None, max_length=40)


class PlanCreate(BaseModel):
    model_config = ConfigDict(json_schema_extra={"examples": [{
        "household_id": 1,
        "older_adult_id": 1,
        "activity_id": 1,
    }]})

    household_id: int
    older_adult_id: int
    activity_id: int


class PlanUpdate(BaseModel):
    model_config = ConfigDict(json_schema_extra={"examples": [
        {"status": "awaiting_approval"},
        {"status": "shared"},
        {"status": "cancelled"},
    ]})

    status: Literal["awaiting_approval", "shared", "cancelled"]


class SupportOfferCreate(BaseModel):
    model_config = ConfigDict(json_schema_extra={"examples": [{
        "support_type": "transport",
        "note": "I can drive Mary there.",
    }]})

    support_type: Literal[
        "join",
        "remind",
        "transport",
        "alternative",
        "booking",
        "encourage",
    ]
    note: str | None = Field(default=None, max_length=2_000)


class PlanNotificationCreate(BaseModel):
    model_config = ConfigDict(json_schema_extra={"examples": [{
        "contact_ids": [1, 2],
    }]})

    contact_ids: list[int] = Field(min_length=1, max_length=20)
