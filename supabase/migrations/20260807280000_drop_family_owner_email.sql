-- The organizer authenticates with Supabase, which already holds their address.
-- This column duplicated it, was required at setup, and was never read back.

alter table public.families drop column if exists owner_email;
