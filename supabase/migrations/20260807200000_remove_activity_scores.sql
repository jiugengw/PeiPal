-- Global activity scores were never personalized to an older adult.
drop index if exists public.activities_score_idx;
alter table public.activities
    drop column if exists suitability_score,
    drop column if exists engagement_score,
    drop column if exists total_score;
