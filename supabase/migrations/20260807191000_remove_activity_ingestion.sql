-- The demo catalog is seeded directly; no ingestion, scraping, or quality runs remain.
drop table if exists public.activity_ingestion_runs cascade;
