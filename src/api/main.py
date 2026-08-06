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
        "name": "Notifications",
        "description": "Send and inspect plan email delivery results.",
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
        """
Count Me In helps a household create a supported activity plan for an older adult.

## Quick-start workflow

Use **Authorize** first and enter a Supabase access token as `Bearer YOUR_TOKEN`.
The signed-in user becomes the household owner.

1. Call **Activities → List active activities** and copy an activity `id`.
2. Call **Households → Create a household** and copy the returned household `id`.
3. Call **Older adults → Create an older-adult profile**, using that household `id`.
   Choose `direct` to share plans immediately, or `family_approval` to require
   the owner to approve sharing. Copy the returned older-adult profile `id`.
4. Call **Trusted contacts → Add a trusted contact** using the profile `id`.
5. Call **Plans → Create a plan**, using the household `id`, profile `id`,
   and activity `id`. Copy the returned plan `id`.
6. If the profile uses `family_approval`, call **Plans → Update a plan status**
   with `{"status":"awaiting_approval"}`, then update it to
   `{"status":"shared"}` using the owner token. Direct-sharing plans are
   already `shared` after creation.
8. Call **Notifications → Send plan notifications** with selected trusted-contact IDs.
   Each recipient is recorded as `sent` or `failed`; retrying the same request
   skips recipients that were already sent successfully.
9. Call **Support offers → Offer support for a shared plan**.
10. Use **Plans → Get a plan**, **Support offers → List support offers**, and
   **Notifications → List plan notifications** to
   confirm the final state.

The API responses provide the IDs needed by the next step. Protected endpoints
require the same `Bearer` token and only allow access within the user's household.

## Endpoint groups

The sections below follow the same workflow order: Activities, Households,
Older adults, Trusted contacts, Plans, Notifications, then Support offers.
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


@app.get("/health", tags=["System"], summary="Check API health")
def health() -> dict[str, str]:
    return {"status": "ok"}
