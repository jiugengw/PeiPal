"""Request models for the website API."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class FamilyCreate(BaseModel):
    model_config = ConfigDict(json_schema_extra={"examples": [{"name": "Lim Family"}]})

    name: str = Field(min_length=1, max_length=120)


class FamilyUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class OlderAdultCreate(BaseModel):
    model_config = ConfigDict(json_schema_extra={"examples": [{
        "family_id": 1,
        "name": "Mary Lim",
        "preferred_name": "Mary",
        "age": 75,
        "language": "English",
        "email": "mary@example.com",
        "mobility_notes": "Prefers seated activities",
        "transport_notes": "Family can help arrange transport",
        "sharing_mode": "family_approval",
    }]})

    family_id: int
    name: str = Field(min_length=1, max_length=120)
    preferred_name: str | None = Field(default=None, max_length=120)
    age: int | None = Field(default=None, ge=0, le=130)
    language: str | None = Field(default=None, max_length=80)
    email: EmailStr | None = Field(
        default=None,
        description="Optional. When present, the older adult also receives the plan decision.",
    )
    mobility_notes: str | None = Field(default=None, max_length=2_000)
    transport_notes: str | None = Field(default=None, max_length=2_000)
    sharing_mode: Literal["direct", "family_approval"] = "family_approval"


class OlderAdultUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    preferred_name: str | None = Field(default=None, max_length=120)
    age: int | None = Field(default=None, ge=0, le=130)
    language: str | None = Field(default=None, max_length=80)
    email: EmailStr | None = None
    mobility_notes: str | None = Field(default=None, max_length=2_000)
    transport_notes: str | None = Field(default=None, max_length=2_000)
    sharing_mode: Literal["direct", "family_approval"] | None = None


class FamilyMemberRelationship(BaseModel):
    """How one family member is related to one older adult."""

    model_config = ConfigDict(json_schema_extra={"examples": [{
        "older_adult_id": 1,
        "relationship": "Daughter",
    }]})

    older_adult_id: int
    relationship: str = Field(min_length=1, max_length=80)


class FamilyMemberCreate(BaseModel):
    model_config = ConfigDict(json_schema_extra={"examples": [{
        "family_id": 1,
        "name": "Anna Lim",
        "email": "anna@example.com",
        "relationships": [{"older_adult_id": 1, "relationship": "Daughter"}],
    }]})

    family_id: int
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    relationships: list[FamilyMemberRelationship] = Field(min_length=1, max_length=20)


class FamilyMemberUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    email: EmailStr | None = None
    relationships: list[FamilyMemberRelationship] | None = Field(
        default=None, min_length=1, max_length=20
    )


class PlanCreate(BaseModel):
    model_config = ConfigDict(json_schema_extra={"examples": [{
        "family_id": 1,
        "older_adult_id": 1,
        "activity_id": 1,
    }]})

    family_id: int
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
        "family_member_ids": [1, 2],
    }]})

    family_member_ids: list[int] = Field(min_length=1, max_length=20)


class VoiceSessionResponse(BaseModel):
    client_secret: str
    expires_at: int | None = None
    session: dict[str, Any] | None = None


class FamilyResponse(FamilyCreate):
    id: int
    created_by: str
    created_at: datetime


class OlderAdultResponse(OlderAdultCreate):
    id: int
    created_by: str
    created_at: datetime


class FamilyMemberResponse(BaseModel):
    id: int
    family_id: int
    name: str
    email: EmailStr
    relationships: list[FamilyMemberRelationship]
    created_at: datetime


class ActivityResponse(BaseModel):
    id: int
    dedupe_key: str
    name: str
    description: str | None = None
    location: str
    start_at: datetime
    end_at: datetime | None = None
    cost: float | None = None
    currency: str
    info_link: str
    signup_link: str | None = None
    tags: list[str] | None = None
    status: str
    first_seen_at: datetime
    last_seen_at: datetime
    last_checked_at: datetime
    created_at: datetime
    updated_at: datetime


class ActivityListResponse(BaseModel):
    activities: list[ActivityResponse]


class ActivityRecommendationResponse(BaseModel):
    activity: ActivityResponse
    recommendation_score: float
    match_factors: dict[str, float]


class ActivityRecommendationListResponse(BaseModel):
    recommendations: list[ActivityRecommendationResponse]


class FamilyListResponse(BaseModel):
    families: list[FamilyResponse]


class OlderAdultListResponse(BaseModel):
    older_adults: list[OlderAdultResponse]


class FamilyMemberListResponse(BaseModel):
    family_members: list[FamilyMemberResponse]


class PlanResponse(BaseModel):
    id: int
    family_id: int
    older_adult_id: int
    activity_id: int
    status: Literal["draft", "awaiting_approval", "shared", "cancelled"]
    created_by: str
    approved_by: str | None = None
    approved_at: datetime | None = None
    shared_at: datetime | None = None
    cancelled_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class PlanListResponse(BaseModel):
    plans: list[PlanResponse]


class SupportOfferResponse(BaseModel):
    id: int
    plan_id: int
    offered_by: str
    support_type: Literal[
        "join",
        "remind",
        "transport",
        "alternative",
        "booking",
        "encourage",
    ]
    note: str | None = None
    status: Literal["offered", "withdrawn"]
    created_at: datetime
    updated_at: datetime


class SupportOfferListResponse(BaseModel):
    support_offers: list[SupportOfferResponse]


class PlanNotificationResponse(BaseModel):
    id: int
    plan_id: int
    family_member_id: int
    recipient_name: str
    recipient_email: str | None = None
    status: Literal["pending", "sent", "failed"]
    provider_id: str | None = None
    error_message: str | None = None
    attempted_at: datetime | None = None
    sent_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class PlanNotificationListResponse(BaseModel):
    notifications: list[PlanNotificationResponse]


class NotificationDeliveryResponse(BaseModel):
    family_member_id: int
    name: str
    status: Literal["sent", "already_sent", "failed"]
    provider_id: str | None = None
    error: str | None = None


class NotificationDeliveryListResponse(BaseModel):
    deliveries: list[NotificationDeliveryResponse]
