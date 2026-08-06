# WorkBuddy activity evaluation integration

## Purpose

WorkBuddy helps the team create and review a reliable evaluation dataset for
the activity search pipeline. It does not run the production website, write to
Supabase, or decide what users see directly.

The integration answers two separate questions:

1. Does Parallel find and extract real event pages?
2. Does our parser accept activities that are suitable for the user's request?

An event can be real but unsuitable. For example, a functional screening may
be a dated event, but it should not be recommended when the user asks for
something fun and educational.

## Development flow

```text
Parallel Search and Extract
          |
          v
capture_activity_eval.py
          |
          +--> unlabelled.jsonl --> WorkBuddy --> gold_cases.jsonl
          |
          +--> predictions.jsonl ----------------------+
                                                        |
                                                        v
                                  evaluate_activity_extraction.py
                                                        |
                                                        v
                                      JSON and Markdown reports
```

The raw cases and system predictions are intentionally separated. WorkBuddy
must label the raw cases without reading the predictions, which prevents the
current parser from influencing the expected answers.

## Responsibilities

### Repository code

The repository handles deterministic work:

- calling Parallel Search and Extract;
- capturing titles, URLs, excerpts and extracted page text;
- keeping system predictions separate from labels;
- calculating metrics;
- generating failure reports;
- ensuring evaluation never writes to Supabase.

### WorkBuddy

WorkBuddy performs the first-pass semantic review:

- classifies each page;
- decides whether it is a real event;
- decides whether it matches the requested preference and area;
- extracts the expected date, time, venue and registration URL;
- records evidence and confidence;
- asks a teammate to confirm uncertain cases.

### Teammate

The teammate configures the WorkBuddy skill or workflow and reviews only:

- labels below `0.8` confidence;
- cases classified as `unclear`;
- cases where the page content is incomplete or contradictory.

## Files

| File | Purpose |
| --- | --- |
| `scripts/capture_activity_eval.py` | Captures real pages without Supabase |
| `evals/activity_extraction/unlabelled.jsonl` | Unbiased input for WorkBuddy |
| `evals/activity_extraction/predictions.jsonl` | Hidden production-parser output |
| `evals/activity_extraction/label_schema.json` | Required WorkBuddy label format |
| `evals/activity_extraction/workbuddy_label_prompt.md` | Labelling instructions |
| `evals/activity_extraction/gold_cases.jsonl` | WorkBuddy labels reviewed by the team |
| `scripts/evaluate_activity_extraction.py` | Compares labels and predictions |
| `evals/activity_extraction/latest_report.json` | Machine-readable metrics |
| `evals/activity_extraction/latest_report.md` | Human-readable results and failures |

Generated raw captures, predictions and reports are excluded from Git by
default. The reviewed `gold_cases.jsonl` may be committed when the team is
comfortable retaining the labelled URLs and metadata.

## Step 1: Capture real Parallel results

Ensure `.env` contains `PARALLEL_API_KEY`, then run:

Windows:
```bash
.venv/Scripts/python.exe scripts/capture_activity_eval.py --area Bishan --start-date 2026-08-05 --end-date 2026-09-05 --timing Morning --preference "fun and educational" --mobility "Gentle, no steps"
```
Linux/macOS:
```bash
.venv/bin/python scripts/capture_activity_eval.py \
  --area Bishan \
  --start-date 2026-08-05 \
  --end-date 2026-09-05 \
  --timing Morning \
  --preference "fun and educational" \
  --mobility "Gentle, no steps"
```


This command does not require Supabase credentials and does not save
activities. It produces:

```text
evals/activity_extraction/unlabelled.jsonl
evals/activity_extraction/predictions.jsonl
```

Build a larger test set by repeating the command with different preferences or
areas and adding `--append`:

Windows:
```bash
.venv/Scripts/python.exe scripts/capture_activity_eval.py --area "Toa Payoh" --preference "creative and social" --append
```
Linux/macOS:
```bash
.venv/bin/python scripts/capture_activity_eval.py \
  --area "Toa Payoh" \
  --preference "creative and social" \
  --append
```

The capture command deduplicates pages by URL.

## Step 2: Label with WorkBuddy

Give WorkBuddy these files:

```text
evals/activity_extraction/unlabelled.jsonl
evals/activity_extraction/label_schema.json
evals/activity_extraction/workbuddy_label_prompt.md
```

Do not give WorkBuddy `predictions.jsonl` before labelling.

WorkBuddy should write one label per line to:

```text
evals/activity_extraction/gold_cases.jsonl
```

Supported page types are:

- `specific_event`
- `recurring_activity`
- `source_page`
- `directory`
- `news_article`
- `irrelevant`
- `unclear`

WorkBuddy labels `is_event` and `is_recommendable` separately. It also checks
preference, area and mobility suitability. Human confirmation is recorded as
`human_confirmed` or `human_corrected`.

## Step 3: Run the evaluation
Windows:
```bash
.venv/Scripts/python.exe scripts/evaluate_activity_extraction.py --cases evals/activity_extraction/gold_cases.jsonl --predictions evals/activity_extraction/predictions.jsonl
```
Linux/macOS:
```bash
.venv/bin/python scripts/evaluate_activity_extraction.py \
  --cases evals/activity_extraction/gold_cases.jsonl \
  --predictions evals/activity_extraction/predictions.jsonl
```

The evaluator reports:

- event precision and recall;
- recommendation precision and recall;
- usable-event rate;
- preference-, area- and mobility-match rates;
- date, time, venue and registration-link accuracy;
- low-confidence and unreviewed labels;
- false positives, false negatives and field mismatches.

Use `--fail-on-mismatch` only in automated checks where any mismatch should
produce a failing exit code. Normal evaluation runs succeed and produce a
report even when failures are found.

## How to use the results

Review false positives first because they represent pages the product might
incorrectly recommend. Then inspect false negatives and field failures. Change
the search prompt or parser using the development cases, rerun the evaluation,
and compare metrics.

Keep a small final test set untouched while tuning. This reduces the risk of
changing the prompt until it only works for examples the team has already seen.

## Production boundary

WorkBuddy is currently part of development and quality assurance, not the
runtime request path:

```text
Development: Parallel --> WorkBuddy-assisted labels --> evaluation
Production:  scheduled refresh --> Parallel --> Supabase --> backend API
```

The website and voice agent continue reading accepted activities from the
backend API. They do not wait for WorkBuddy or Parallel during a user request.

## Security and data handling

- Keep `PARALLEL_API_KEY` in `.env` only.
- Do not include API keys in WorkBuddy inputs or evaluation artifacts.
- Do not send `predictions.jsonl` to WorkBuddy before independent labelling.
- Do not run production Supabase writes from evaluation scripts.
- Review extracted page content before committing it because it may contain
  third-party text.
