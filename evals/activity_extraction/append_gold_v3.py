"""Generate 16 new gold labels (indices 27-42 of unlabelled.jsonl) and append.

All 16 new entries share the same URL and extracted_text:
    https://www.eventbrite.sg/d/singapore--bedok/events--today/
which is Eventbrite's 'Events and Things to do in Bedok, Singapore today'
directory page. Each entry's title is a different event row scraped from the
same listing (Buddhist chanting retreat, nightclub freshman orientation,
choral workshop, university welcome, sound healing gongs, magic-bar mentalist,
couples workshop, escape game, sound bath, comedy, business training,
reiki, BBQ, art workshop ...).

Following the same convention as the Bukit Timah Eventbrite directories
(40a3ed7b0d96f57b / 068cd0946c01421d / 6a00e2804527bf5e etc.):
  - page_type: directory
  - matches_preference: false (mixed entertainment/workshop/business events,
    none framed as senior-focused fun-and-educational)
  - matches_area: true (the page is filtered for the Bedok area)
  - is_event / is_recommendable: false
  - mobility_suitable / date / start_time / venue / registration_url: null
  - confidence: 0.95, review_status: workbuddy_only

Only `evidence` (and the matching free-text `reasoning`) varies per entry so
each gold row points at its own event title rather than being a copy of the
same text.
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))

URL_BEDOK_TODAY = "https://www.eventbrite.sg/d/singapore--bedok/events--today/"

# Per-entry evidence & reasoning. Each entry is one row of the same Bedok
# 'today' directory page. We cite the page heading + a short confirmation
# for the specific event title listed.
def make_case(case_id, event_title, time_text, venue_text, free_text_extras=""):
    """Build a directory gold row for a Bedok 'today' event."""
    evidence = [
        "# Events and Things to do in Bedok, Singapore today",
        "Looking for things to do in Bedok today? Explore popular events, concerts, workshops, networking meet-ups, food experiences, and free activities happening across Bedok right now.",
        f"Filters: Category, Date, Price, Format (Online, Class, Conference, Festival, Party)",
        f"[{event_title}]({URL_BEDOK_TODAY})",
        time_text,
        venue_text,
    ]
    if free_text_extras:
        evidence.append(free_text_extras)

    reasoning = (
        f"Eventbrite 'Events and Things to do in Bedok, Singapore today' "
        f"directory page ({URL_BEDOK_TODAY}). Aggregates many unrelated events "
        f"of varied categories (business, food, health, music, classes, conferences, "
        f"parties). The '{event_title}' row is one of many listings alongside "
        f"Buddhist chanting retreat, Mirage freshman orientation, Choral Writing "
        f"Workshop, University Welcome Week, sound-healing gongs/bowls, magic-bar "
        f"mentalist show, couples intimacy workshop, escape game, comedy night, "
        f"business communication training, reiki session, BBQ, batik painting, "
        f"etc. - none specifically framed for seniors or as 'fun and educational', "
        f"and the actual venues span central Singapore (Cherry Discotheque, "
        f"Chimichanga Raffles City, SPACE2B, Tan Boon Liat Building, The Lemon "
        f"Stand, The Magic Bar) rather than being confined to Bedok. Functions "
        f"as a discovery directory, not a single event page. The URL captured "
        f"is the category listing rather than any individual event's dedicated "
        f"eventbrite.sg/e/... page."
    )

    return {
        "id": case_id,
        "expected": {
            "page_type": "directory",
            "is_event": False,
            "is_recommendable": False,
            "matches_preference": False,
            "matches_area": True,
            "mobility_suitable": None,
            "date": None,
            "start_time": None,
            "venue": None,
            "registration_url": None,
            "confidence": 0.95,
            "evidence": evidence,
            "reasoning": reasoning,
            "review_status": "workbuddy_only",
        },
    }


new_cases = [
    # 27
    make_case(
        "5bcfed27b3d9d659",
        event_title="The 16th 100 Million Ami Dewa Recitation Retreat 2026",
        time_text="Today at 09:00",
        venue_text="Singapore \u00b7 Futsing Association Building",
    ),
    # 28
    make_case(
        "c7022990804a626e",
        event_title='Mirage "Freshman Orientation"',
        time_text="Today at 22:00",
        venue_text="Singapore \u00b7 Cherry Discotheque",
    ),
    # 29
    make_case(
        "a1515f8aff3b7a9e",
        event_title="VOS Presents: Choral Writing Workshop by Saunder Choi",
        time_text="Today at 20:00",
        venue_text="Singapore \u00b7 venue in Singapore",
    ),
    # 30
    make_case(
        "73f7cacf2f2ac16e",
        event_title="Thursday l University Welcome Week",
        time_text="Today at 19:00",
        venue_text="Singapore \u00b7 Chimichanga Raffles City",
    ),
    # 31
    make_case(
        "c9c8edf4c9971c77",
        event_title="GROUNDING GONGS + TIBETAN BOWLS + FLUTE: ROOT CHAKRA",
        time_text="Today at 18:30",
        venue_text="Singapore \u00b7 SPACE2B",
    ),
    # 32
    make_case(
        "e5b970ae93fb7a7a",
        event_title="The Magic Bar Show - Whispers of The Mind by Mentalist Nique Tan",
        time_text="Today at 20:00",
        venue_text="Singapore \u00b7 The Magic Bar",
    ),
    # 33
    make_case(
        "5e0547a4d4f70e85",
        event_title="Sweet Surrender: Gongs + Tibetan Bowls",
        time_text="Today at 20:00",
        venue_text="Singapore \u00b7 SPACE2B",
    ),
    # 34
    make_case(
        "49fad700af00454a",
        event_title="THE INTIMACY RESET Private Workshop (For Couples) by Hedonist",
        time_text="Today \u00b7 private workshop",
        venue_text="Singapore \u00b7 venue in Singapore",
    ),
    # 35
    make_case(
        "adeb170db62a8eab",
        event_title="Alice in Tan Boon Land (Escape Game)",
        time_text="Today at 18:00 + 5 more",
        venue_text="Singapore \u00b7 Tan Boon Liat Building",
    ),
    # 36
    make_case(
        "6c8c4f1ec6b197f9",
        event_title="SG61 Private Floating Sound Bath Experience",
        time_text="Today at 18:00 + 1 more",
        venue_text="Singapore \u00b7 Home (private location)",
    ),
    # 37
    make_case(
        "88f23f066a1fb1da",
        event_title="Comedy Night Thursdays @ The Lemon Stand Comedy Club",
        time_text="Tonight (Thursday comedy)",
        venue_text="Singapore \u00b7 The Lemon Stand",
    ),
    # 38
    make_case(
        "050419b41435a927",
        event_title="Influential Communication & Stakeholder Management",
        time_text="Today at 09:00",
        venue_text="Singapore \u00b7 Eureka Building (Equinix office)",
    ),
    # 39
    make_case(
        "86dc767a39b938ef",
        event_title="Experiencing Reiki",
        time_text="Today \u00b7 workshop time",
        venue_text="Singapore \u00b7 venue in Singapore",
    ),
    # 40
    make_case(
        "2208424c470597e6",
        event_title="Jungle BBQ",
        time_text="Today \u00b7 BBQ time",
        venue_text="Singapore \u00b7 19A Yarwood Ave",
    ),
    # 41
    make_case(
        "108ef6d55be7c9cc",
        event_title="Mare",
        time_text="Today at 19:00",
        venue_text="Singapore \u00b7 19A Yarwood Ave",
    ),
    # 42
    make_case(
        "f960836bbfec9199",
        event_title=(
            "Batik Painting on Handkerchief - Art Workshop "
            "\u8725\u67d3\u624b\u5e15\u7ed8\u753b\u5de5\u4f5c\u574a (Thur.\u5468\u4e94)"
        ),
        time_text="Today at 17:00",
        venue_text="Singapore \u00b7 art studio in Singapore",
    ),
]


# Validate every JSON object matches the label_schema before writing.
expected_keys_for_each_case = {"id", "expected"}
expected_inner_fields = {
    "page_type", "is_event", "is_recommendable",
    "matches_preference", "matches_area", "mobility_suitable",
    "date", "start_time", "venue", "registration_url",
    "confidence", "evidence", "reasoning", "review_status",
}

for c in new_cases:
    assert set(c.keys()) == expected_keys_for_each_case, f"bad outer keys: {c.keys()}"
    inner = c["expected"]
    assert set(inner.keys()) == expected_inner_fields, (
        f"missing/extra inner fields for {c['id']}: "
        f"set={set(inner.keys())} expected={expected_inner_fields}"
    )
    assert inner["page_type"] in {
        "specific_event", "recurring_activity", "source_page",
        "directory", "news_article", "irrelevant", "unclear"
    }
    assert isinstance(inner["is_event"], bool)
    assert isinstance(inner["is_recommendable"], bool)
    assert isinstance(inner["matches_preference"], (bool, type(None)))
    assert isinstance(inner["matches_area"], (bool, type(None)))
    assert isinstance(inner["mobility_suitable"], (bool, type(None)))
    assert inner["mobility_suitable"] in (True, False, None)
    assert isinstance(inner["confidence"], (int, float)) and 0 <= inner["confidence"] <= 1
    assert inner["review_status"] in {"workbuddy_only", "human_confirmed", "human_corrected"}
    assert isinstance(inner["evidence"], list) and inner["evidence"]
    assert isinstance(inner["reasoning"], str) and inner["reasoning"]

# Append to gold_cases.jsonl.
out_path = os.path.join(HERE, "gold_cases.jsonl")
with open(out_path, "a", encoding="utf-8") as f:
    for case in new_cases:
        f.write(json.dumps(case, ensure_ascii=False) + "\n")

# Print confirmation and total.
with open(out_path, "r", encoding="utf-8") as f:
    total = sum(1 for line in f if line.strip())
print(f"Appended {len(new_cases)} cases. Total cases in file: {total}")

# Sanity: list IDs of newly-added cases.
print("New case IDs:")
for c in new_cases:
    e = c["expected"]
    print(f"  {c['id']}  page_type={e['page_type']}  is_event={e['is_event']}")
