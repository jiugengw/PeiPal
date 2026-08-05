"""Normalize activity search output before it reaches PostgreSQL."""

from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
from typing import Any, Protocol
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo


SINGAPORE = ZoneInfo("Asia/Singapore")


class ActivityProvider(Protocol):
    def search(self) -> list[dict[str, Any]]: ...


class ParallelActivityProvider:
    """Discover and extract activities through Parallel's Search and Extract APIs."""

    search_url = "https://api.parallel.ai/v1/search"
    extract_url = "https://api.parallel.ai/v1/extract"

    def __init__(
        self,
        api_key: str,
        *,
        area: str = "Singapore",
        start_date: str,
        end_date: str,
        timing: str = "morning",
        preference: str = "social activities and talks",
        mobility: str = "gentle, no steps",
        max_results: int = 10,
        post_json: Any | None = None,
    ) -> None:
        self.api_key = api_key
        self.area = area
        self.start_date = start_date
        self.end_date = end_date
        self.timing = timing
        self.preference = preference
        self.mobility = mobility
        self.max_results = max_results
        self._post_json = post_json or self._request_json
        self.last_stats: dict[str, int] = {}
        self.skip_examples: list[str] = []
        self.last_captured_pages: list[dict[str, Any]] = []
        self.last_predictions: list[dict[str, Any]] = []

    def search(self) -> list[dict[str, Any]]:
        preference_lower = self.preference.lower()
        health_requested = any(
            word in preference_lower
            for word in ("health", "wellness", "screening", "medical")
        )
        category_guidance = (
            "Health or wellness services are allowed because they were requested."
            if health_requested
            else "Exclude medical screenings, functional assessments, health checks, and wellness services."
        )
        objective = (
            f"Find individual upcoming in-person events in {self.area}, Singapore, "
            f"between {self.start_date} and {self.end_date}. Prioritize {self.timing} "
            f"{self.preference} activities or sessions for older adults, suitable for "
            f"mobility needs described as {self.mobility}. Only return activities that "
            "a person can directly attend or register for. Every result must have a "
            "specific event name, exact date, exact start time, physical venue, and "
            "registration, booking, or organiser contact URL. Prefer official event "
            "listing pages from community centres, libraries, government organisations, "
            "museums, or venues. Exclude news articles, general programme pages, "
            "organisation pages, directories, annual campaigns, and pages without a "
            f"specific session. {category_guidance} Treat the preference as the "
            "main activity category: social, fun, educational, creative, movement, "
            "or health. Do not substitute a health service when a recreational or "
            "educational activity was requested."
        )
        queries = [
            f"{self.area} Singapore elderly {self.preference} event register {self.start_date}",
            f"{self.area} community club elderly {self.preference} event booking",
            f"Singapore senior {self.preference} workshop registration {self.start_date}",
        ]
        search_response = self._post_json(
            self.search_url,
            {"objective": objective, "search_queries": queries},
        )
        results = (search_response.get("results") or [])[: self.max_results]
        self.last_stats = {
            "search_results": len(results),
            "pages_extracted": 0,
            "skipped_missing_date_or_time": 0,
            "skipped_outside_date_range": 0,
        }
        self.skip_examples = []
        self.last_captured_pages = []
        self.last_predictions = []
        urls = [result.get("url") for result in results if result.get("url")]
        extracted_by_url: dict[str, dict[str, Any]] = {}
        if urls:
            extract_response = self._post_json(
                self.extract_url,
                {
                    "urls": urls,
                    "objective": (
                        "Extract the exact event date, start time, venue, location, cost, "
                        "accessibility details, registration URL, and a short description. "
                        "Only use facts stated on the page."
                    ),
                    "advanced_settings": {
                        "full_content": {"max_chars_per_result": 12_000},
                    },
                },
            )
            self.last_stats["pages_extracted"] = len(extract_response.get("results") or [])
            extracted_by_url = {
                item["url"]: item
                for item in (extract_response.get("results") or [])
                if item.get("url")
            }

        activities: list[dict[str, Any]] = []
        for result in results:
            url = str(result.get("url") or "").strip()
            page = extracted_by_url.get(url, {})
            text = "\n".join(
                page.get("excerpts") or result.get("excerpts") or []
            )
            text = f"{text}\n{page.get('full_content') or ''}"
            prediction = parse_activity_text(
                text,
                area=self.area,
                start_date=self.start_date,
                end_date=self.end_date,
                source_url=url or None,
            )
            case_id = hashlib.sha256(url.encode("utf-8")).hexdigest()[:16] if url else "missing-url"
            self.last_captured_pages.append({
                "id": case_id,
                "title": str(page.get("title") or result.get("title") or "").strip(),
                "url": url,
                "search_excerpts": result.get("excerpts") or [],
                "extracted_text": text.strip()[:12_000],
                "search_parameters": {
                    "area": self.area,
                    "start_date": self.start_date,
                    "end_date": self.end_date,
                    "timing": self.timing,
                    "preference": self.preference,
                    "mobility": self.mobility,
                },
            })
            self.last_predictions.append({
                "id": case_id,
                "title": str(page.get("title") or result.get("title") or "").strip(),
                "url": url,
                "actual": prediction,
            })
            date = prediction["date"]
            start_time = prediction["start_time"]
            if not prediction["is_event"] or not url:
                self.last_stats["skipped_missing_date_or_time"] += 1
                if len(self.skip_examples) < 5:
                    self.skip_examples.append(
                        f"{prediction['decision_reason']}: {result.get('title') or url}"
                    )
                continue
            activities.append({
                "name": str(page.get("title") or result.get("title") or "Activity").strip(),
                "description": text[:2_000] or None,
                "location": prediction["venue"] or self.area,
                "date": date,
                "start_time": start_time,
                "cost": _event_cost(text),
                "info_link": url,
                "signup_link": prediction["registration_url"] or url,
                "mobility_notes": self.mobility,
                "tags": ["parallel", self.preference],
            })
        return activities

    def _request_json(self, url: str, body: dict[str, Any]) -> dict[str, Any]:
        request = Request(
            url,
            data=json.dumps(body).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "x-api-key": self.api_key,
            },
            method="POST",
        )
        try:
            with urlopen(request, timeout=45) as response:
                return json.loads(response.read().decode("utf-8"))
        except (HTTPError, URLError, TimeoutError) as error:
            raise RuntimeError(f"Parallel request failed: {error}") from error


def _event_date(text: str) -> str | None:
    patterns = (
        (r"\b(\d{1,2})[ /-](\d{1,2})[ /-](\d{4})\b", "%d/%m/%Y"),
        (r"\b(\d{4})-(\d{1,2})-(\d{1,2})\b", "%Y-%m-%d"),
        (r"\b(\d{4})/(\d{1,2})/(\d{1,2})\b", "%Y/%m/%d"),
        (r"\b(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\b", "%d %B %Y"),
        (r"\b(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\b", "%d %b %Y"),
        (r"\b([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})\b", "%B %d, %Y"),
        (r"\b([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})\b", "%b %d, %Y"),
    )
    for pattern, input_format in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            try:
                return datetime.strptime(match.group(0), input_format).strftime("%d/%m/%Y")
            except ValueError:
                continue
    return None


def _event_date_in_range(text: str, start_date: str, end_date: str) -> str | None:
    start_day = datetime.fromisoformat(start_date).date()
    end_day = datetime.fromisoformat(end_date).date()
    candidates: list[str] = []

    # Handle ranges such as “5 Aug – 30 Sep 2026” by considering both ends.
    range_pattern = (
        r"\b(\d{1,2})\s+([A-Za-z]+)\s*(?:-|–|to)\s*"
        r"(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\b"
    )
    for match in re.finditer(range_pattern, text, flags=re.IGNORECASE):
        for day, month in ((match.group(1), match.group(2)), (match.group(3), match.group(4))):
            for month_format in ("%d %B %Y", "%d %b %Y"):
                try:
                    candidates.append(
                        datetime.strptime(
                            f"{day} {month} {match.group(5)}", month_format
                        ).strftime("%d/%m/%Y")
                    )
                    break
                except ValueError:
                    continue

    # Collect all explicit dates instead of trusting only the first date on a page.
    date_patterns = (
        (r"\b\d{1,2}[ /-]\d{1,2}[ /-]\d{4}\b", "%d/%m/%Y"),
        (r"\b\d{4}-\d{1,2}-\d{1,2}\b", "%Y-%m-%d"),
        (r"\b\d{4}/\d{1,2}/\d{1,2}\b", "%Y/%m/%d"),
        (r"\b\d{1,2}\s+[A-Za-z]+\s+\d{4}\b", "%d %B %Y"),
        (r"\b\d{1,2}\s+[A-Za-z]+\s+\d{4}\b", "%d %b %Y"),
        (r"\b[A-Za-z]+\s+\d{1,2},\s+\d{4}\b", "%B %d, %Y"),
        (r"\b[A-Za-z]+\s+\d{1,2},\s+\d{4}\b", "%b %d, %Y"),
    )
    for pattern, date_format in date_patterns:
        for match in re.finditer(pattern, text, flags=re.IGNORECASE):
            try:
                candidates.append(
                    datetime.strptime(match.group(0), date_format).strftime("%d/%m/%Y")
                )
            except ValueError:
                continue

    for candidate in candidates:
        event_day = datetime.strptime(candidate, "%d/%m/%Y").date()
        if start_day <= event_day <= end_day:
            return candidate
    return None


def _event_time(text: str) -> str | None:
    match = re.search(
        r"\b(\d{1,2})(?:(?::|\.)(\d{2}))?\s*([ap])\.?m\.?\b",
        text,
        flags=re.IGNORECASE,
    )
    if not match:
        return None
    minutes = match.group(2) or "00"
    return f"{match.group(1)}:{minutes} {match.group(3).upper()}M"


def _event_location(text: str, fallback: str) -> str:
    for line in text.splitlines():
        if re.search(r"\b(venue|location|address):", line, flags=re.IGNORECASE):
            return re.sub(r"^.*?:\s*", "", line).strip(" .,-") or fallback
    return fallback


def parse_activity_text(
    text: str,
    *,
    area: str,
    start_date: str,
    end_date: str,
    source_url: str | None = None,
) -> dict[str, Any]:
    """Parse extracted page text without making any database changes."""
    date = _event_date_in_range(text, start_date, end_date)
    start_time = _event_time(text)
    location = _event_location(text, area)
    is_event = bool(date and start_time)
    if not date:
        reason = "missing in-range date"
    elif not start_time:
        reason = "missing start time"
    else:
        reason = "accepted"
    return {
        "is_event": is_event,
        "is_recommendable": is_event,
        "date": date,
        "start_time": start_time,
        "venue": location if location != area else None,
        "registration_url": source_url if is_event else None,
        "decision_reason": reason,
    }


def _event_cost(text: str) -> str | None:
    match = re.search(r"(?:ฟรี|free|\$\s*\d+(?:\.\d{1,2})?|sgd\s*\d+(?:\.\d{1,2})?)", text, flags=re.IGNORECASE)
    return match.group(0) if match else None


def _cost(value: Any) -> float | None:
    if value in (None, "", "Unknown", "unknown"):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    digits = "".join(character for character in str(value) if character.isdigit() or character == ".")
    return float(digits) if digits else None


def normalize_activity(raw: dict[str, Any]) -> dict[str, Any]:
    required = ("name", "location", "date", "start_time", "info_link")
    missing = [field for field in required if not str(raw.get(field, "")).strip()]
    if missing:
        raise ValueError(f"Activity is missing required fields: {', '.join(missing)}")

    start = _parse_start(raw["date"], raw["start_time"])
    info_link = str(raw["info_link"]).strip()
    dedupe_key = str(raw.get("dedupe_key") or f"{info_link}|{start.isoformat()}")
    content_hash = hashlib.sha256(
        json.dumps(raw, sort_keys=True, default=str).encode("utf-8")
    ).hexdigest()
    checked_at = datetime.now(timezone.utc).isoformat()

    return {
        "dedupe_key": dedupe_key,
        "name": str(raw["name"]).strip(),
        "description": raw.get("description"),
        "location": str(raw["location"]).strip(),
        "start_at": start.isoformat(),
        "cost": _cost(raw.get("cost")),
        "currency": raw.get("currency", "SGD"),
        "price_remarks": raw.get("price_remarks"),
        "slots_availability": raw.get("slots_availability"),
        "info_link": info_link,
        "signup_link": raw.get("signup_link"),
        "mobility_notes": raw.get("mobility_notes"),
        "intensity": raw.get("intensity"),
        "tags": raw.get("tags") or [],
        "suitability_score": raw.get("suitability_score"),
        "engagement_score": raw.get("engagement_score"),
        "total_score": raw.get("total_score"),
        "status": "active",
        "last_seen_at": checked_at,
        "last_checked_at": checked_at,
        "content_hash": content_hash,
    }


class JsonFileProvider:
    """Small deterministic provider for local tests and manual dry runs."""

    def __init__(self, path: Path) -> None:
        self.path = path

    def search(self) -> list[dict[str, Any]]:
        data = json.loads(self.path.read_text(encoding="utf-8"))
        activities = data.get("activities") if isinstance(data, dict) else data
        if not isinstance(activities, list):
            raise ValueError("Activity input must be a JSON list or an activities object.")
        return activities


def _parse_start(event_date: Any, event_time: Any) -> datetime:
    value = f"{event_date} {event_time}".strip()
    for time_format in ("%d/%m/%Y %I:%M %p", "%d/%m/%Y %I%p"):
        try:
            return datetime.strptime(value, time_format).replace(tzinfo=SINGAPORE)
        except ValueError:
            continue
    raise ValueError(
        f"Unsupported activity date/time '{value}'. Expected DD/MM/YYYY HH:MM AM/PM."
    )
