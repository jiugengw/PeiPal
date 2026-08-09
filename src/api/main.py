"""FastAPI entrypoint for the PeiPal backend."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.config import cors_origins, load_config
from src.api.routes import router
from src.api.oauth import router as oauth_router


load_config()

OPENAPI_TAGS = [
    {
        "name": "Activities",
        "description": "Browse active activities available for planning.",
    },
    {
        "name": "Voice",
        "description": "Create short-lived browser voice sessions.",
    },
    {
        "name": "Families",
        "description": "Create and manage the family.",
    },
    {
        "name": "Older adults",
        "description": "Manage older-adult profiles and practical preferences.",
    },
    {
        "name": "Family members",
        "description": "Manage the people a family can ask for support.",
    },
    {
        "name": "Coordination",
        "description": "Ask the whole family, and track approval, registration, and transport.",
    },
    {
        "name": "Plans",
        "description": "Create plans and move them through approval and sharing.",
    },
    {
        "name": "Notifications",
        "description": "Send and inspect plan email delivery results.",
    },
    {
        "name": "Support offers",
        "description": "Offer or withdraw practical support for a shared plan.",
    },
]

app = FastAPI(
    title="PeiPal API",
    version="0.1.0",
    description=(
        """
PeiPal helps a family create a supported activity plan for an older adult.

## Quick-start workflow

Use **Authorize** first and enter a Supabase access token as `Bearer YOUR_TOKEN`.
The signed-in user becomes the family owner.

1. Call **Activities → List active activities** and copy an activity `id`.
2. Call **Families → Create a family** and copy the returned family `id`.
3. Call **Older adults → Create an older-adult profile**, using that family `id`.
   Choose `direct` to share plans immediately, or `family_approval` to require
   the owner to approve sharing. Copy the returned older-adult profile `id`.
4. Call **Family members → Add a family member** using the family `id`, naming
   how that person is related to each older adult.
5. Call **Plans → Create a plan**, using the family `id`, profile `id`,
   and activity `id`. Copy the returned plan `id`.
6. If the profile uses `family_approval`, call **Plans → Update a plan status**
   with `{"status":"awaiting_approval"}`, then update it to
   `{"status":"shared"}` using the owner token. Direct-sharing plans are
   already `shared` after creation.
8. Call **Notifications → Send plan notifications** with selected family-member IDs.
   Each recipient is recorded as `sent` or `failed`; retrying the same request
   skips recipients that were already sent successfully.
9. Call **Support offers → Offer support for a shared plan**.
10. Use **Plans → Get a plan**, **Support offers → List support offers**, and
   **Notifications → List plan notifications** to
   confirm the final state.

The API responses provide the IDs needed by the next step. Protected endpoints
require the same `Bearer` token and only allow access within the user's family.

## Endpoint groups

The sections below follow the same workflow order: Activities, Families,
Older adults, Family members, Plans, Notifications, then Support offers.
        """
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
app.include_router(oauth_router)


@app.get("/health", tags=["System"], summary="Check API health")
def health() -> dict[str, str]:
    return {"status": "ok"}
