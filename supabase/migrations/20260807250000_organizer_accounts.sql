-- The organizer signs in with a password, so a code confirming an address they
-- typed while already signed in proved nothing. Family members never hold an
-- account, so there is nothing to invite them to either.

drop table if exists public.family_email_verifications cascade;
drop table if exists public.family_member_invitations cascade;

alter table public.families drop column if exists owner_email_verified_at;
