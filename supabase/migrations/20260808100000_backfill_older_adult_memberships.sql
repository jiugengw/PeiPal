-- Repair older-adult accounts that were linked to a profile before their
-- family_accounts membership was created or after it was removed.
insert into public.family_accounts (family_id, user_id, role)
select family_id, user_id, 'older_adult'
from public.older_adult_profiles
where user_id is not null
on conflict (family_id, user_id) do nothing;
