-- OAuth 2.1 credentials for remote MCP clients such as Tencent WorkBuddy.
create table oauth_clients (
  client_id text primary key,
  client_name text not null,
  redirect_uris text[] not null,
  created_at timestamptz not null default now()
);

create table oauth_authorization_codes (
  code_hash text primary key,
  client_id text not null references oauth_clients(client_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  redirect_uri text not null,
  code_challenge text not null,
  scope text not null,
  expires_at timestamptz not null,
  used_at timestamptz
);

create table oauth_refresh_tokens (
  token_hash text primary key,
  token_type text not null check (token_type in ('access', 'refresh')),
  client_id text not null references oauth_clients(client_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

alter table oauth_clients enable row level security;
alter table oauth_authorization_codes enable row level security;
alter table oauth_refresh_tokens enable row level security;
