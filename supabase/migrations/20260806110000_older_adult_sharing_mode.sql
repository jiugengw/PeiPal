alter table public.older_adult_profiles
    add column if not exists sharing_mode text not null default 'family_approval'
    check (sharing_mode in ('direct', 'family_approval'));
