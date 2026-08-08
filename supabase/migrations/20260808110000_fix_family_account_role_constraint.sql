-- The household_members -> family_accounts rename preserved the original
-- constraint name on some databases. Remove both possible names before
-- installing the current role constraint.
alter table public.family_accounts
    drop constraint if exists household_members_role_check;

alter table public.family_accounts
    drop constraint if exists family_accounts_role_check;

alter table public.family_accounts
    add constraint family_accounts_role_check
    check (role in ('owner', 'older_adult', 'family_member', 'caregiver'));
