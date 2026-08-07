import json

import pytest

from src.agents import email_tools


CONTACTS = {
    "contacts": [
        {
            "id": "anna",
            "name": "Anna Lim",
            "relationship": "Daughter",
            "email": "anna@example.com",
        },
        {
            "id": "shaun",
            "name": "Shaun Lim",
            "relationship": "Grandson",
            "email": "shaun@example.com",
        },
    ]
}


@pytest.fixture(autouse=True)
def contacts_file(monkeypatch, tmp_path):
    path = tmp_path / "contacts.json"
    path.write_text(json.dumps(CONTACTS), encoding="utf-8")
    monkeypatch.setenv("CONTACTS_FILE", str(path))
    email_tools.prepared_emails.clear()
    return path


def test_list_contacts_hides_addresses():
    result = json.loads(email_tools.list_family_members())

    assert result["contacts"][0] == {
        "id": "anna",
        "name": "Anna Lim",
        "relationship": "Daughter",
    }
    assert "anna@example.com" not in json.dumps(result)


def test_invalid_or_duplicate_contacts_are_rejected(contacts_file):
    contacts_file.write_text("not json", encoding="utf-8")
    with pytest.raises(ValueError, match="could not be read"):
        email_tools.list_family_members()

    duplicated = {"contacts": [CONTACTS["contacts"][0], CONTACTS["contacts"][0]]}
    contacts_file.write_text(json.dumps(duplicated), encoding="utf-8")
    with pytest.raises(ValueError, match="Duplicate"):
        email_tools.list_family_members()


def test_prepare_email_returns_an_immutable_preview():
    preview = json.loads(
        email_tools.prepare_invitation_email(
            ["anna", "shaun"], "Would you like to join?", "Mary is going on Saturday."
        )
    )

    assert preview["recipients"] == ["Anna Lim", "Shaun Lim"]
    assert preview["subject"] == "Would you like to join?"
    assert preview["body"] == "Mary is going on Saturday."
    assert preview["sent"] is False


def test_prepare_email_rejects_unknown_contacts_and_long_content():
    with pytest.raises(ValueError, match="Unknown"):
        email_tools.prepare_invitation_email(["unknown"], "Hello", "Message")
    with pytest.raises(ValueError, match="Subject"):
        email_tools.prepare_invitation_email(
            ["anna"], "x" * (email_tools.MAXIMUM_SUBJECT_LENGTH + 1), "Message"
        )


def test_send_is_private_and_does_not_repeat_successes(monkeypatch):
    preview = json.loads(
        email_tools.prepare_invitation_email(
            ["anna", "shaun"], "Activity invitation", "Would you like to join Mary?"
        )
    )
    attempts = []

    def deliver(recipient, subject, body, idempotency_key):
        attempts.append((recipient["id"], idempotency_key))
        if recipient["id"] == "shaun" and len(attempts) == 2:
            raise RuntimeError("temporary provider error")
        return f"provider-{recipient['id']}"

    monkeypatch.setattr(email_tools, "_deliver_email", deliver)
    first_result = json.loads(
        email_tools.send_invitation_email(preview["prepared_email_id"])
    )
    second_result = json.loads(
        email_tools.send_invitation_email(preview["prepared_email_id"])
    )

    assert [delivery["status"] for delivery in first_result["deliveries"]] == [
        "sent",
        "failed",
    ]
    assert [delivery["status"] for delivery in second_result["deliveries"]] == [
        "already_sent",
        "sent",
    ]
    assert [contact_id for contact_id, _ in attempts] == ["anna", "shaun", "shaun"]
    assert attempts[1][1] == attempts[2][1]
    assert "@example.com" not in json.dumps(first_result)
