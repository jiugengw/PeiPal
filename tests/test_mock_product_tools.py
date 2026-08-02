import json

from src.agents.mock_product_tools import (
    MOCK_ACTIVITIES,
    create_invitation_draft,
    recommend_activities,
)


def test_mock_recommendation_has_a_replaceable_contract():
    """Keep the mock recommendation shape stable for the teammates' implementation."""

    result = json.loads(
        recommend_activities(
            location="Toa Payoh",
            time_preference="Saturday afternoon",
            activity_preference="relaxing",
            mobility="short walking distance",
        )
    )

    assert result["request"]["location"] == "Toa Payoh"
    assert len(result["activities"]) == 3
    assert result["activities"] == list(MOCK_ACTIVITIES)
    assert {"id", "name", "location", "time", "distance"} <= result["activities"][0].keys()


def test_invitation_tool_only_creates_a_draft():
    """Ensure the invitation tool returns draft text and never reports a send."""

    result = json.loads(
        create_invitation_draft(
            activity_id="library-craft",
            activity_name="Quiet library craft session",
            activity_time="Saturday afternoon",
            recipients="trusted family",
        )
    )

    assert result["activity_id"] == "library-craft"
    assert result["recipients"] == "trusted family"
    assert "Quiet library craft session" in result["draft"]
    assert result["sent"] is False
