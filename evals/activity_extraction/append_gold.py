"""Generate 15 new gold labels and append to evals/activity_extraction/gold_cases.jsonl.

Conventions inherited from the existing gold_cases.jsonl:
  - Sembawang CC homepages  -> source_page (matches 9cb64247778ea3a1 Toa Payoh East CC)
  - Bukit Timah Eventbrite  -> directory   (matches 91cfc0df90b133d5 Toa Payoh Eventbrite)
  - matches_preference: null for source_pages; false for directories
  - matches_area: true (content is specific to the captured area)
  - mobility_suitable: null (no per-event evidence on listing pages)
  - date / start_time / registration_url: null for all listing pages
  - review_status: workbuddy_only (no human confirmation requested; all conf >= 0.85)
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))

SEMBAWANG_VENUE = "Sembawang CC, Blk 117B Canberra Crescent, #01-370, Singapore 752117"

new_cases = [
    # ---- Cases 1-4: Sembawang CC homepage (source_page), four event titles ----
    {
        "id": "c9fde5320c6d9e0c",
        "expected": {
            "page_type": "source_page",
            "is_event": False,
            "is_recommendable": False,
            "matches_preference": None,
            "matches_area": True,
            "mobility_suitable": None,
            "date": None,
            "start_time": None,
            "venue": SEMBAWANG_VENUE,
            "registration_url": None,
            "confidence": 0.9,
            "evidence": [
                "Sembawang CC",
                "Blk 117B Canberra Crescent, #01-370 752117",
                "Sembawang Central CACC Smart Guitar Workshop on 15 August 2026",
                "Sembawang CC 15 Aug 2026 12:00 PM - 3:00 PM $68.00",
                "[See All Events](https://www.onepa.gov.sg/Events/search??events=&aoi=&sort=rel&outlet=Sembawang+CC&showAllResults=true)",
            ],
            "reasoning": "Sembawang Community Club homepage (https://www.onepa.gov.sg/cc/sembawang-cc). Lists multiple upcoming events in its 'Our Events' section (Smart Guitar Workshop, Golf Interest Group, LPA Talk, First Aid Cert, Kayak N Klean, Blood Donation Drive, Sembawang Wind Orchestra). The URL is the CC landing page, not the dedicated Smart Guitar Workshop event page (https://www.onepa.gov.sg/events/sembawang-central-cacc-smart-guitar-workshop-on-15-august-2026-e39802466). Per the source_page convention used for other onePA CC homepages, a venue page that aggregates events is not itself a recommendable single event. matches_preference is null because multiple events of different types are listed.",
            "review_status": "workbuddy_only",
        },
    },
    {
        "id": "8dc1c2b5b5f370c0",
        "expected": {
            "page_type": "source_page",
            "is_event": False,
            "is_recommendable": False,
            "matches_preference": None,
            "matches_area": True,
            "mobility_suitable": None,
            "date": None,
            "start_time": None,
            "venue": SEMBAWANG_VENUE,
            "registration_url": None,
            "confidence": 0.9,
            "evidence": [
                "Sembawang CC",
                "Blk 117B Canberra Crescent, #01-370 752117",
                "CSN Golf Interest Group - 27 August 2026",
                "Sembawang CC 27 Aug 2026 7:00 PM - 9:00 PM $5.00",
                "[See All Events](https://www.onepa.gov.sg/Events/search??events=&aoi=&sort=rel&outlet=Sembawang+CC&showAllResults=true)",
            ],
            "reasoning": "Sembawang Community Club homepage (https://www.onepa.gov.sg/cc/sembawang-cc). The 'CSN Golf Interest Group' event is one of many listed under the CC's 'Our Events' block, alongside Smart Guitar Workshop, LPA Talk, First Aid Cert, Kayak N Klean, Blood Donation Drive and Sembawang Wind Orchestra. The URL is the CC landing page rather than the dedicated Golf Interest Group event page. Per source_page convention, multi-event CC homepages are venue listings, not a single recommendable event; mobility, exact date/start_time/registration_url cannot be pinned to one session.",
            "review_status": "workbuddy_only",
        },
    },
    {
        "id": "db5443e2ec9f70b4",
        "expected": {
            "page_type": "source_page",
            "is_event": False,
            "is_recommendable": False,
            "matches_preference": None,
            "matches_area": True,
            "mobility_suitable": None,
            "date": None,
            "start_time": None,
            "venue": SEMBAWANG_VENUE,
            "registration_url": None,
            "confidence": 0.9,
            "evidence": [
                "Sembawang CC",
                "Blk 117B Canberra Crescent, #01-370 752117",
                "LPA Talk and Certification by Sembawang CC WEC",
                "Sembawang CC 30 Aug 2026 9:30 AM - 12:30 PM Free",
                "[See All Events](https://www.onepa.gov.sg/Events/search??events=&aoi=&sort=rel&outlet=Sembawang+CC&showAllResults=true)",
            ],
            "reasoning": "Sembawang Community Club homepage (https://www.onepa.gov.sg/cc/sembawang-cc). The LPA (Lasting Power of Attorney) Talk and Certification by Sembawang CC WEC appears as one row in the CC's 'Our Events' block alongside Smart Guitar Workshop, Golf Interest Group, First Aid Cert, Kayak N Klean, Blood Donation Drive and Sembawang Wind Orchestra. The URL is the CC landing page, not the dedicated LPA Talk event page. Per source_page convention the page is a venue listing, not a single event; matches_preference is left null because the page aggregates varied events.",
            "review_status": "workbuddy_only",
        },
    },
    {
        "id": "d88e41348c90f556",
        "expected": {
            "page_type": "source_page",
            "is_event": False,
            "is_recommendable": False,
            "matches_preference": None,
            "matches_area": True,
            "mobility_suitable": None,
            "date": None,
            "start_time": None,
            "venue": SEMBAWANG_VENUE,
            "registration_url": None,
            "confidence": 0.9,
            "evidence": [
                "Sembawang CC",
                "Blk 117B Canberra Crescent, #01-370 752117",
                "2-DAY STANDARD FIRST AID CERTIFICATION COURSE (SFA)",
                "Sembawang CC 30 Aug 2026 9:30 AM - 6:30 PM Free",
                "[See All Events](https://www.onepa.gov.sg/Events/search??events=&aoi=&sort=rel&outlet=Sembawang+CC&showAllResults=true)",
            ],
            "reasoning": "Sembawang Community Club homepage (https://www.onepa.gov.sg/cc/sembawang-cc). The 2-day Standard First Aid Certification Course is one row in the CC's 'Our Events' block alongside Smart Guitar Workshop, Golf Interest Group, LPA Talk, Kayak N Klean, Blood Donation Drive and Sembawang Wind Orchestra. The URL is the CC landing page, not the dedicated SFA event page. Per source_page convention the page itself is a venue listing rather than a single recommendable event; first-aid certification is a functional course that does not fit the 'fun and educational' framing anyway.",
            "review_status": "workbuddy_only",
        },
    },
    # ---- Cases 5-9: Eventbrite Bukit Timah community (directory) ----
    {
        "id": "44a3ed7b0d96f57b",
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
            "evidence": [
                "# Community events in Bukit Timah, Singapore",
                "Discover the best Community events in your area and online",
                "SBK ANNIVERSARY PARTY",
                "Sunday at 11:00",
                "Midland House",
            ],
            "reasoning": "Eventbrite category page for community events in Bukit Timah, Singapore (https://www.eventbrite.sg/b/singapore--bukit-timah/community/). Aggregates many unrelated community events (SBK Anniversary Party, 520 Social Singles Mixer aged 25-45, Tamil performance, Roney Tan show, LIT Board Games, One SG61 with ANTICA, Healthy Mindset talk) under a single 'Community events' heading. None of the listed items are specifically framed for seniors or as 'fun and educational'; functions as a discovery directory, not a concrete event page. matches_preference false because no senior/fun-educational framing on the listing.",
            "review_status": "workbuddy_only",
        },
    },
    {
        "id": "f7f8bfd18bc9d0cd",
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
            "evidence": [
                "# Community events in Bukit Timah, Singapore",
                "Discover the best Community events in your area and online",
                "520 Social Presents: The Drift Date | Singles Mixer (Ages 25-45)",
                "Tomorrow at 19:00",
                "Dorifto!",
            ],
            "reasoning": "Eventbrite category page for community events in Bukit Timah, Singapore. The 520 Social Singles Mixer is explicitly targeted at ages 25-45, which excludes seniors, so even on its own it is a clear non-match for a senior-friendly fun-and-educational search. The page is a directory of unrelated community events (SBK Anniversary, Tamil event, Roney Tan, LIT Board Games, One SG61, Healthy Mindset talk) rather than a single event page.",
            "review_status": "workbuddy_only",
        },
    },
    {
        "id": "72b5fd9275c0f0b7",
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
            "evidence": [
                "# Community events in Bukit Timah, Singapore",
                "Discover the best Community events in your area and online",
                "Roney Tan - Discovering Golden Bell",
                "Sat, Aug 15, 10:00 AM",
                "Danish Seamen's Church Singapore",
            ],
            "reasoning": "Eventbrite category page for community events in Bukit Timah, Singapore. The Roney Tan show is one of several unrelated items on the listing (SBK Anniversary, Singles Mixer 25-45, Tamil event, LIT Board Games, One SG61, Healthy Mindset talk). The page itself is a discovery directory rather than a single event page; the show appears to be a music performance rather than a senior-focused educational activity.",
            "review_status": "workbuddy_only",
        },
    },
    {
        "id": "ca90961ec215769d",
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
            "evidence": [
                "# Community events in Bukit Timah, Singapore",
                "Discover the best Community events in your area and online",
                "LIT Board Games Day! (Q3 2026)",
                "Saturday at 15:00",
                "Larks Improv Theatre",
            ],
            "reasoning": "Eventbrite category page for community events in Bukit Timah, Singapore. The LIT Board Games Day is one of several unrelated items on the listing (SBK Anniversary, Singles Mixer 25-45, Tamil event, Roney Tan, One SG61, Healthy Mindset talk). The page is a discovery directory rather than a single event; board gaming is social/entertainment, not framed as a senior-focused fun-and-educational activity.",
            "review_status": "workbuddy_only",
        },
    },
    {
        "id": "0be5e054bac2c11b",
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
            "evidence": [
                "# Community events in Bukit Timah, Singapore",
                "Discover the best Community events in your area and online",
                "One SG61 with ANTICA",
                "Sat, Aug 22, 12:00 PM",
                "Perennial Business City",
            ],
            "reasoning": "Eventbrite category page for community events in Bukit Timah, Singapore. One SG61 with ANTICA is one item among several unrelated listings (SBK Anniversary, Singles Mixer 25-45, Tamil event, Roney Tan show, LIT Board Games, Healthy Mindset talk). The page is a discovery directory rather than a single event; the activity appears to be a SG61 national-day celebration rather than a senior-focused educational offering.",
            "review_status": "workbuddy_only",
        },
    },
    # ---- Cases 10-15: Eventbrite Bukit Timah events (directory) ----
    {
        "id": "068cd0946c01421d",
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
            "evidence": [
                "Things to do in Bukit Timah",
                "Trending searches",
                "JCS Summer Recital 2026: \u548c\u97f3\u306e\u8272 Colors of Harmony",
                "Sat, Aug 15, 2:15 PM",
                "10 Square Auditorium",
            ],
            "reasoning": "Eventbrite's events index for Bukit Timah, Singapore (https://www.eventbrite.com/d/singapore--bukit-timah/events/). The top of the page is dominated by 'Trending searches' of global online events (Imposter Fatigue, C++ Memory Management Deep Dive, Cottage Food Safety, ARBD community awareness, Marketing Breakthrough, etc. in PDT/EDT/MDT/GMT+1 timezones) and a 'Nearby cities' navigational block. The JCS Summer Recital is one of many Singapore event rows lower down. Page is a discovery directory, not a single event; the recital is a music performance for a general audience, not framed as senior-focused fun-and-educational.",
            "review_status": "workbuddy_only",
        },
    },
    {
        "id": "dc0cbb92d1582a7a",
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
            "evidence": [
                "Things to do in Bukit Timah",
                "Trending searches",
                "Soundbath and Incense Making Workshop",
                "Wed, Aug 19, 11:00 AM",
                "Mapletree Business City Town Hall",
            ],
            "reasoning": "Eventbrite's events index for Bukit Timah, Singapore (https://www.eventbrite.com/d/singapore--bukit-timah/events/). The page mixes global trending online events (PDT/EDT/MDT) at the top with a handful of Singapore listings lower down, including the Soundbath and Incense Making Workshop. Page is a discovery directory, not a single event; the workshop is wellness/craft rather than framed senior-focused educational content.",
            "review_status": "workbuddy_only",
        },
    },
    {
        "id": "b76dd7aa67af8e16",
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
            "evidence": [
                "Things to do in Bukit Timah",
                "Trending searches",
                "Launch Party: Mirror/Mirrored - Personal Discovery through Play",
                "Sat, Aug 22, 1:45 PM",
                "Singapore Polytechnic Graduates' Guild",
            ],
            "reasoning": "Eventbrite's events index for Bukit Timah, Singapore. Combines global trending searches and Singapore event rows; the Mirror/Mirrored launch party is one of many listings. Page is a discovery directory, not a single event; an improv-theatre launch is social entertainment, not framed as senior-focused educational content.",
            "review_status": "workbuddy_only",
        },
    },
    {
        "id": "bcfc4065c963b731",
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
            "evidence": [
                "Things to do in Bukit Timah",
                "Trending searches",
                "Seminar on the new ABRSM 2027-28 Grades 1-8 & ARSM Piano Pieces",
                "Mon, Aug 24, 9:00 AM",
                "Concorde Hotel Ballroom Level 3",
            ],
            "reasoning": "Eventbrite's events index for Bukit Timah, Singapore. Page mixes global online trending events with Singapore listings including the ABRSM piano seminar. Page is a discovery directory, not a single event; the seminar is a music-exam professional session, not framed as senior-focused fun-and-educational content.",
            "review_status": "workbuddy_only",
        },
    },
    {
        "id": "6a00e2804527bf5e",
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
            "evidence": [
                "Things to do in Bukit Timah",
                "Trending searches",
                "Bump, Birth and Beyond",
                "Sat, Aug 29, 11:00 AM",
                "Conrad Singapore Marina Bay",
            ],
            "reasoning": "Eventbrite's events index for Bukit Timah, Singapore. Page mixes global trending online events with Singapore listings including Bump, Birth and Beyond (a pregnancy/parenting event at Conrad Singapore Marina Bay). Page is a discovery directory, not a single event; the activity targets expectant parents, not seniors, so it does not match the fun-and-educational senior framing.",
            "review_status": "workbuddy_only",
        },
    },
    {
        "id": "dd63e0b1e37dcb6f",
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
            "evidence": [
                "Things to do in Bukit Timah",
                "Trending searches",
                "Riftbound Regional Qualifier: Singapore",
                "Fri, Sep 4, 12:00 PM",
                "Singapore EXPO",
            ],
            "reasoning": "Eventbrite's events index for Bukit Timah, Singapore. Page mixes global online trending events with Singapore listings including the Riftbound Regional Qualifier (a trading-card-game tournament at Singapore EXPO). Page is a discovery directory, not a single event; a competitive gaming tournament is not framed as senior-focused fun-and-educational content.",
            "review_status": "workbuddy_only",
        },
    },
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
    assert set(c.keys()) == expected_keys_for_each_case, f"bad keys: {c.keys()}"
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
