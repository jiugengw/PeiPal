-- Device-authorization-style login for WorkBuddy: a caregiver approves
-- access on the real PeiPal website instead of typing a password into
-- WorkBuddy's chat. Mirrors plan_coordination_links' hashed-token shape.
create table workbuddy_login_requests (
  id bigint generated always as identity primary key,
  code_hash text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  access_token text,
  approved_at timestamptz,
  consumed_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index workbuddy_login_requests_expires_idx on workbuddy_login_requests (expires_at);

alter table workbuddy_login_requests enable row level security;
