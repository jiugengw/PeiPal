-- Keep the account creator visible in the trusted-circle contacts.
alter table public.family_members
    add column if not exists account_user_id uuid references auth.users(id) on delete cascade;

create unique index if not exists family_members_account_owner_idx
    on public.family_members (family_id, account_user_id)
    where account_user_id is not null;

-- Existing manually-entered contacts that use the creator's address become the
-- owner contact instead of creating a duplicate row.
update public.family_members member
set account_user_id = family.created_by
from public.families family
join auth.users account on account.id = family.created_by
where member.family_id = family.id
  and member.account_user_id is null
  and account.email is not null
  and lower(member.email) = lower(account.email);

-- Create owner contacts for families that do not already have one.
insert into public.family_members (family_id, name, email, account_user_id)
select family.id,
       coalesce(nullif(account.raw_user_meta_data ->> 'full_name', ''), split_part(account.email, '@', 1)),
       lower(account.email),
       family.created_by
from public.families family
join auth.users account on account.id = family.created_by
where account.email is not null
  and not exists (
      select 1
      from public.family_members member
      where member.family_id = family.id
        and member.account_user_id = family.created_by
  );

-- Link the owner contact to every older-adult profile in the family.
insert into public.family_member_older_adults (family_member_id, older_adult_id, relationship)
select member.id, profile.id, 'Organizer'
from public.family_members member
join public.families family on family.id = member.family_id
join public.older_adult_profiles profile on profile.family_id = family.id
where member.account_user_id = family.created_by
  and not exists (
      select 1
      from public.family_member_older_adults link
      where link.family_member_id = member.id
        and link.older_adult_id = profile.id
  );
