import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from src.api.main import app
from src.api.models import OlderAdultCreate, PlanCreate, PlanNotificationCreate, SupportOfferCreate


client = TestClient(app)


@pytest.mark.parametrize(
    "method,path",
    [
        ("get", "/api/households"),
        ("get", "/api/households/1"),
        ("get", "/api/older-adults/1"),
        ("patch", "/api/older-adults/1"),
        ("post", "/api/plans"),
        ("get", "/api/plans?household_id=1"),
        ("get", "/api/plans/1"),
        ("patch", "/api/plans/1"),
        ("post", "/api/plans/1/support-offers"),
        ("get", "/api/plans/1/support-offers"),
        ("post", "/api/plans/1/notifications"),
        ("get", "/api/plans/1/notifications"),
    ],
)
def test_core_workflow_requires_authentication(method, path):
    response = getattr(client, method)(path)

    assert response.status_code == 401


def test_plan_create_requires_the_three_relationship_ids():
    with pytest.raises(ValidationError):
        PlanCreate(household_id=1, older_adult_id=1)


def test_support_offer_rejects_unknown_support_type():
    with pytest.raises(ValidationError):
        SupportOfferCreate(support_type="send_money")


def test_older_adult_sharing_mode_defaults_to_family_approval():
    profile = OlderAdultCreate(household_id=1, name="Mary Lim")

    assert profile.sharing_mode == "family_approval"


def test_plan_notification_requires_at_least_one_contact():
    with pytest.raises(ValidationError):
        PlanNotificationCreate(contact_ids=[])
