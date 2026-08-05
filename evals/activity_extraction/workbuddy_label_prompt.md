# Activity extraction labelling task

Read `unlabelled.jsonl` and label every case using `label_schema.json`. Write one
JSON object per line to `gold_cases.jsonl`. Do not read `predictions.jsonl`
before labelling because it contains the system being evaluated.

Classify pages as `specific_event`, `recurring_activity`, `source_page`,
`directory`, `news_article`, `irrelevant`, or `unclear`. Set `is_event` to true
only when the page provides enough information to recommend a concrete session
or calculate its next recurring session. Independently set `is_recommendable`
only when it also matches the requested area and preference. For example, a
functional screening may be a real event but is not recommendable for a request
for fun and educational activities. Label `matches_preference`, `matches_area`,
and `mobility_suitable`; use null for mobility when the page gives no evidence.
Use `DD/MM/YYYY` and `HH:MM AM/PM` for dates and times. Copy short evidence from
the extracted text and provide a confidence from 0 to 1.

Automatically label high-confidence cases. Ask the teammate to confirm cases
below 0.8 confidence or cases classified as `unclear`. Record confirmations as
`human_confirmed` and corrections as `human_corrected`; otherwise use
`workbuddy_only`.
