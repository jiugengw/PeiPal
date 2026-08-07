import smtplib

import pytest

from src.services import notifications


class FakeSMTP:
    def __init__(self, host, port, *, timeout, context):
        self.host = host
        self.port = port
        self.timeout = timeout
        self.context = context
        self.login_calls = []
        self.messages = []

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def login(self, username, password):
        self.login_calls.append((username, password))

    def send_message(self, message):
        self.messages.append(message)


def gmail_client(monkeypatch):
    created = []

    def factory(host, port, *, timeout, context):
        client = FakeSMTP(host, port, timeout=timeout, context=context)
        created.append(client)
        return client

    monkeypatch.setattr(notifications.smtplib, "SMTP_SSL", factory)
    monkeypatch.setattr(notifications.ssl, "create_default_context", lambda: "tls-context")
    return created


def configure_gmail(monkeypatch):
    monkeypatch.setenv("GMAIL_ADDRESS", "countmein.demo@gmail.com")
    monkeypatch.setenv("GMAIL_APP_PASSWORD", "abcd efgh ijkl mnop")
    monkeypatch.setenv("GMAIL_FROM_NAME", "Count Me In")


def test_send_email_uses_gmail_ssl_and_accepts_other_recipients(monkeypatch):
    configure_gmail(monkeypatch)
    clients = gmail_client(monkeypatch)

    provider_id = notifications.send_email(
        recipient_email="anna@example.net",
        subject="Mary has a plan",
        body="Plain text",
        html_body="<p>Plain text</p>",
        idempotency_key="plan-notification/5/3",
    )

    client = clients[0]
    assert (client.host, client.port, client.timeout, client.context) == (
        "smtp.gmail.com",
        465,
        30,
        "tls-context",
    )
    assert client.login_calls == [("countmein.demo@gmail.com", "abcdefghijklmnop")]
    message = client.messages[0]
    assert str(message["From"]) == "Count Me In <countmein.demo@gmail.com>"
    assert str(message["To"]) == "anna@example.net"
    assert str(message["Subject"]) == "Mary has a plan"
    assert message["X-Count-Me-In-Delivery-Key"] == "plan-notification/5/3"
    assert message.get_body(preferencelist=("plain",)).get_content().strip() == "Plain text"
    assert message.get_body(preferencelist=("html",)).get_content().strip() == "<p>Plain text</p>"
    assert provider_id == str(message["Message-ID"])
    assert provider_id.endswith("@gmail.com>")


def test_send_email_requires_gmail_credentials(monkeypatch):
    monkeypatch.delenv("GMAIL_ADDRESS", raising=False)
    monkeypatch.delenv("GMAIL_APP_PASSWORD", raising=False)

    with pytest.raises(RuntimeError, match="GMAIL_ADDRESS and GMAIL_APP_PASSWORD"):
        notifications.send_plan_email(
            recipient_email="anna@example.net",
            subject="Subject",
            body="Body",
            idempotency_key="delivery-key",
        )


def test_send_email_requires_a_gmail_address(monkeypatch):
    monkeypatch.setenv("GMAIL_ADDRESS", "sender@example.com")
    monkeypatch.setenv("GMAIL_APP_PASSWORD", "abcdefghijklmnop")

    with pytest.raises(RuntimeError, match="gmail.com"):
        notifications.send_plan_email(
            recipient_email="anna@example.net",
            subject="Subject",
            body="Body",
            idempotency_key="delivery-key",
        )


def test_send_email_rejects_invalid_recipient(monkeypatch):
    configure_gmail(monkeypatch)
    gmail_client(monkeypatch)

    with pytest.raises(RuntimeError, match="recipient_email"):
        notifications.send_plan_email(
            recipient_email="not-an-address",
            subject="Subject",
            body="Body",
            idempotency_key="delivery-key",
        )


def test_send_email_propagates_gmail_authentication_failure(monkeypatch):
    configure_gmail(monkeypatch)

    class AuthenticationFailure(FakeSMTP):
        def login(self, username, password):
            raise smtplib.SMTPAuthenticationError(535, b"Authentication failed")

    monkeypatch.setattr(notifications.smtplib, "SMTP_SSL", AuthenticationFailure)

    with pytest.raises(smtplib.SMTPAuthenticationError):
        notifications.send_plan_email(
            recipient_email="anna@example.net",
            subject="Subject",
            body="Body",
            idempotency_key="delivery-key",
        )


def test_send_email_propagates_gmail_delivery_failure(monkeypatch):
    configure_gmail(monkeypatch)

    class DeliveryFailure(FakeSMTP):
        def send_message(self, message):
            raise smtplib.SMTPException("delivery failed")

    monkeypatch.setattr(notifications.smtplib, "SMTP_SSL", DeliveryFailure)

    with pytest.raises(smtplib.SMTPException, match="delivery failed"):
        notifications.send_plan_email(
            recipient_email="anna@example.net",
            subject="Subject",
            body="Body",
            idempotency_key="delivery-key",
        )
