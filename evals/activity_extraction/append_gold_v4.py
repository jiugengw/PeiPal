"""Generate 28 new gold labels (indices 43-70 of unlabelled.jsonl) and append.

The 28 new entries split into two directory batches that share URL/extracted_text
within each batch:

  Group A (19 entries, indices 43-61):
    URL: https://allevents.in/bedok/all
    Page: "All Upcoming events in Bedok" discovery directory (allevents.in
          category listing for Bedok-area events of all kinds).
    Per entry, only the captured title differs.
    -> directory, matches_preference=false (no seniors filter), matches_area=true (Bedok)

  Group B (9 entries, indices 62-70):
    URL: https://www.eventbrite.com/d/singapore--singapore/seniors
    Page: "Seniors Events and Things to do in Singapore, Singapore" directory
          (Eventbrite category listing filtered for senior audience across
          Singapore). Note the Neighborhood filter dropdown lists Malaysian
          neighborhoods (Bukit Chagar, Kampong Senibong, Larkin, Century) -
          these are city-spillover UI, not the actual content.
    -> directory, matches_preference=true (directory filter explicitly targets
       seniors), matches_area=true (Singapore-wide directory encompasses Bedok),
       confidence 0.9 because of the gap between the directory's filter intent
       (seniors + Singapore) and the specific event content which is mixed
       (Cataract/IOL education vs Riftbound trading-card tournament vs
       pregnancy event vs wealth summit).

Following the directory convention from prior batches
(40a3ed7b0d96f57b / 068cd0946c01421d / batch3 Eventbrite Bedok today / etc):
  - page_type: directory
  - is_event / is_recommendable: false (a directory is not itself an event, and
    cannot be recommended to attend)
  - mobility_suitable / date / start_time / venue / registration_url: null
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))

# Group A: allevents.in/bedok/all --------------------------------------------
URL_ALLEVENTS_BEDOK = "https://allevents.in/bedok/all"

def make_allevents_case(case_id, event_title, when_text, where_text, fee_text=""):
    """allevents.in Bedok 'All Upcoming events' directory, one row."""
    evidence = [
        "# All Upcoming events in Bedok",
        "Find out what's on in Bedok, There are countless events in Bedok from genres like comedy, art, food to festivals; you can find your pick and have the best time of your life.",
        "Check out some amazing free events in Bedok to take away all the fun experiences.",
        when_text,
        f"[### {event_title}]({URL_ALLEVENTS_BEDOK}{case_id})",
        where_text,
    ]
    if fee_text:
        evidence.append(fee_text)

    reasoning = (
        f"allevents.in 'All Upcoming events in Bedok' directory page "
        f"({URL_ALLEVENTS_BEDOK}). Aggregates many unrelated upcoming events "
        f"in / around Bedok - trivia nights (Avatar, Naruto), comedy hours, "
        f"cooking classes (otah-making, heritage dishes), business seminars, "
        f"food and photo walks, breastfeeding and parenting events, wellness "
        f"and dog-walking events, Russian-language picnics, mixed-language "
        f"events and others - none of which are framed for seniors or as "
        f"'fun and educational' despite the directory itself carrying the "
        f"Bedok-area filter. The specific {event_title!r} row is one of many "
        f"listings on the page. Page is a discovery directory rather than a "
        f"single event."
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


allevents_cases = [
    make_allevents_case(
        "0229bb87719a78dc",
        event_title="AVATAR THE LAST AIRBENDER TRIVIA NIGHT",
        when_text="Tue, 11 Aug 2026 07:30 PM",
        where_text="41 E Coast Rd",
        fee_text="SGD 30",
    ),
    make_allevents_case(
        "025991d846d5b1d8",
        event_title="Comedy After Hours | Thursday 13th August 2026 @ Monk's Brew Club",
        when_text="Thu, 13 Aug 2026 07:30 PM",
        where_text="Monk's Brew Club",
    ),
    make_allevents_case(
        "dfb7652fdeadf0a0",
        event_title="Exclusive Boxing Class",
        when_text="Tue, 15 Aug 2026 09:30 AM",
        where_text="Spartans Boxing Club Joo Chiat",
        fee_text="Free",
    ),
    make_allevents_case(
        "5f728deddd761741",
        event_title="Lee Wee & Brothers: Central Kitchen Visit and Otah-Making Workshop",
        when_text="Fri, 15 Aug 2026 10:00 AM",
        where_text="Lee Wee & Brothers",
    ),
    make_allevents_case(
        "647f19f0078b0b41",
        event_title="LELAKI HEBAT 2.0",
        when_text="Fri, 15 Aug 2026 02:00 PM",
        where_text="The Yards @ Joo Chiat",
        fee_text="SGD 50",
    ),
    make_allevents_case(
        "7def0d4c52d22e5d",
        event_title="\u041f\u0438\u043a\u043d\u0438\u043a c Bilingvi",
        when_text="Fri, 15 Aug 2026 05:00 PM",
        where_text="ECP BBQ Pit F49",
        fee_text="SGD 33",
    ),
    make_allevents_case(
        "e47eb5a941f2e913",
        event_title="Cook and Dine - Singapore Heritage Dishes",
        when_text="Sun, 16 Aug 2026 03:00 PM",
        where_text="Find Tickets (event organiser link)",
    ),
    make_allevents_case(
        "8ec50b28c3f69320",
        event_title="NARUTO TRIVIA",
        when_text="Tue, 18 Aug 2026 07:30 PM",
        where_text="41 E Coast Rd",
        fee_text="SGD 30",
    ),
    make_allevents_case(
        "d0d1925fc5b1dcb5",
        event_title="Uncertain by Design \u2014 Futures, Strategy and Organisation in a Complex World",
        when_text="Tue, 18 Aug 2026 09:00 AM",
        where_text="Singapore",
    ),
    make_allevents_case(
        "9a1168cdf46fc48b",
        event_title="AI at the Estuary \u2013 SG Public Workshop",
        when_text="Tue, 18 Aug 2026 01:30 PM",
        where_text="Common Ground Civic Centre & Consultancy",
        fee_text="SGD 80",
    ),
    make_allevents_case(
        "983ad6f3589ef2a3",
        event_title="The Weight We Carry",
        when_text="Wed, 19 Aug 2026 07:00 PM",
        where_text="Holistic Quarters",
        fee_text="SGD 38",
    ),
    make_allevents_case(
        "265b26a7d15f3fb6",
        event_title="Spoke & Bird presents Cleo Cheng & Vivien Yap",
        when_text="Thu, 20 Aug 2026 08:00 PM",
        where_text="Monk's Brew Club",
        fee_text="SGD 14",
    ),
    make_allevents_case(
        "8e962aff05b933df",
        event_title="IN GOOD COMPANY x Eastside: Joo Chiat Food Tour",
        when_text="Fri, 21 Aug 2026 08:30 AM",
        where_text="IN GOOD COMPANY Joo Chiat",
        fee_text="SGD 89",
    ),
    make_allevents_case(
        "71e3e690bd5f4117",
        event_title="IN GOOD COMPANY x Eastside: Joo Chiat Photo Walk",
        when_text="Sat, 22 Aug 2026 08:30 AM",
        where_text="IN GOOD COMPANY Joo Chiat",
        fee_text="SGD 89",
    ),
    make_allevents_case(
        "6b932f93af347f4a",
        event_title="Rise & Invest: The Next-Gen Wealth Circle",
        when_text="Sat, 22 Aug 2026 10:30 AM",
        where_text="Dutch Colony Coffee Co.",
        fee_text="SGD 4",
    ),
    make_allevents_case(
        "e7d5f2b864a103a9",
        event_title="BMSG World Breastfeeding Week Celebrations 2026",
        when_text="Fri, 29 Aug 2026 01:00 PM",
        where_text="Common Ground Civic Centre",
    ),
    make_allevents_case(
        "bb5ced1bb91f9c38",
        event_title="Jemput Ber-jamu: Conversations Over Jamu, Career and Cancer",
        when_text="Fri, 29 Aug 2026 10:30 AM",
        where_text="Common Ground Civic Centre",
    ),
    make_allevents_case(
        "661ff032fe51cbee",
        event_title="Worst Beat Contest: Disappointing Drops + Unexpected Mashups",
        when_text="Sun, 30 Aug 2026 07:00 PM",
        where_text="Buzzed Coffee Bar",
        fee_text="SGD 14",
    ),
    make_allevents_case(
        "c441db5775eab4ce",
        event_title="TPJ Wellness Pawject",
        when_text="Sun, 30 Aug 2026 04:00 PM",
        where_text="AURA Rehab",
        fee_text="Free",
    ),
]


# Group B: eventbrite.com Singapore seniors ---------------------------------
URL_EB_SENIORS = (
    "https://www.eventbrite.com/d/singapore--singapore/seniors"
)

def make_eb_seniors_case(case_id, event_title, when_text, where_text):
    """Eventbrite Singapore seniors directory, one row."""
    evidence = [
        "# Seniors Events and Things to do in Singapore, Singapore",
        "Filters: Category, Date, Neighborhood, Price, Format (Class, Conference, Festival, Party, Online)",
        f"[### {event_title}](https://www.eventbrite.sg/e/{case_id})",
        when_text,
        where_text,
    ]

    reasoning = (
        f"Eventbrite 'Seniors Events and Things to do in Singapore, Singapore' "
        f"directory page ({URL_EB_SENIORS}). The page heading and URL filter "
        f"explicitly target a senior audience across Singapore - so the "
        f"directory's filter does match the captured preference. However, "
        f"actual row content is mixed: some rows are clearly senior-focused "
        f"(Cataract/IOL community talk, SUSS Geronpreneurship Festival, "
        f"Senior Friendly Exercise) while others are not (Riftbound trading-card "
        f"tournament, Singapore International Pen Show, Bump Birth and Beyond "
        f"pregnancy event, Wealth-Creation Summit). The specific "
        f"{event_title!r} row is one entry on this directory; the page itself "
        f"is a discovery listing rather than a single event, so is_event and "
        f"is_recommendable are both false regardless of preference match. "
        f"Note: the Neighborhood filter dropdown lists Bukit Chagar, Kampong "
        f"Senibong, Larkin and Century - these are Malaysian (Johor Bahru-area) "
        f"labels suggesting Eventbrite is mixing JB content into this "
        f"directory; treated as a Singapore seniors discovery listing for "
        f"label purposes."
    )

    return {
        "id": case_id,
        "expected": {
            "page_type": "directory",
            "is_event": False,
            "is_recommendable": False,
            "matches_preference": True,
            "matches_area": True,
            "mobility_suitable": None,
            "date": None,
            "start_time": None,
            "venue": None,
            "registration_url": None,
            "confidence": 0.9,
            "evidence": evidence,
            "reasoning": reasoning,
            "review_status": "workbuddy_only",
        },
    }


eb_seniors_cases = [
    make_eb_seniors_case(
        "dbd1d7f0dda17444",
        event_title="\u4eba\u5de5\u667a\u80fd\u6570\u7801\u65f6\u4ee3 \u767d\u5185\u969c\u624b\u672f,\u4eba\u5de5\u6676\u4f53(IOL)\u4e0e\u773c\u775b\u8001\u5316",
        when_text="(Wed 12 Aug 2026 14:30) - Community Club",
        where_text="Singapore \u00b7 Community Club (Pasir Ris East CC)",
    ),
    make_eb_seniors_case(
        "b5b0dd40efa5820a",
        event_title="SUSS Geronpreneurship Innovation Festival",
        when_text="Wed, Aug 26, 10:00 AM",
        where_text="Singapore \u00b7 Suntec Singapore Convention & Exhibition Centre",
    ),
    make_eb_seniors_case(
        "8b35e03c81e6934c",
        event_title="Pioneers & Paws",
        when_text="Sat, Aug 15, 8:30 AM",
        where_text="Singapore \u00b7 Clarke Quay",
    ),
    make_eb_seniors_case(
        "9cfc1d0ebfac1d8a",
        event_title="Nature & Sustainability Tour: Urban Biodiversity Walk [Aug '26]",
        when_text="Sat, Aug 29, 8:00 AM",
        where_text="Singapore \u00b7 Gardens by the Bay Sustainability",
    ),
    make_eb_seniors_case(
        "28a4602a7d751a5d",
        event_title="Let Us Move It Move It! (Senior Friendly Exercise)",
        when_text="Sat, 08 Aug 2026 10:00 AM + 1 more",
        where_text="Singapore \u00b7 (event organiser location)",
    ),
    make_eb_seniors_case(
        "af00c2ceae453b1c",
        event_title="Riftbound Regional Qualifier: Singapore",
        when_text="Fri, Sep 4, 12:00 PM",
        where_text="Singapore \u00b7 Singapore EXPO",
    ),
    make_eb_seniors_case(
        "33be156d654a1210",
        event_title="Singapore International Pen Show 2026",
        when_text="Sat, Sep 5, 12:00 PM",
        where_text="Singapore \u00b7 PARKROYAL COLLECTION Pickering",
    ),
    make_eb_seniors_case(
        "12c73c3cf9740b8a",
        event_title="Bump, Birth and Beyond",
        when_text="Sat, Aug 29, 11:00 AM",
        where_text="Singapore \u00b7 Conrad Singapore Marina Bay",
    ),
    make_eb_seniors_case(
        "f838273b95d1faf8",
        event_title="August LIVESTREAM Asset Protection & Wealth Creation Summit",
        when_text="Aug 2026 \u00b7 Online (Livestream)",
        where_text="Online",
    ),
]


new_cases = allevents_cases + eb_seniors_cases


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
print("\nNew case IDs:")
print("  Group A (allevents.in Bedok):")
for c in allevents_cases:
    print(f"    {c['id']}  {c['expected']['matches_preference']=} {c['expected']['matches_area']=} {c['expected']['confidence']=}")
print("  Group B (Eventbrite Singapore seniors):")
for c in eb_seniors_cases:
    print(f"    {c['id']}  {c['expected']['matches_preference']=} {c['expected']['matches_area']=} {c['expected']['confidence']=}")
