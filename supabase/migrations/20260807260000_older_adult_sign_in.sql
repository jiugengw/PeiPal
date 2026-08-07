-- The older adult signs in with a magic link to their own email, so nobody ever
-- shares a password. The organizer keeps their own password account and remains
-- the only person who can change the family group.

alter table public.older_adult_profiles
    add column if not exists user_id uuid references auth.users(id) on delete set null;

create unique index if not exists older_adult_profiles_user_idx
    on public.older_adult_profiles (user_id)
    where user_id is not null;

create index if not exists older_adult_profiles_email_idx
    on public.older_adult_profiles (lower(email))
    where email is not null;

alter table public.family_accounts drop constraint if exists family_accounts_role_check;
alter table public.family_accounts add constraint family_accounts_role_check
    check (role in ('owner', 'older_adult', 'family_member', 'caregiver'));
