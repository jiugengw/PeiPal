-- Personal access tokens for WorkBuddy/ChatGPT-style MCP clients: generated
-- once on the website, pasted once into the client's connector config, and
-- resolved directly to a user_id on every call. Replaces the device-login
-- flow in workbuddy_login_requests (left in place, unused).
create table workbuddy_access_tokens (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

alter table workbuddy_access_tokens enable row level security;
