-- Backfill the token discriminator for environments that already applied the
-- initial MCP OAuth migration before token_type was added.
alter table oauth_refresh_tokens add column if not exists token_type text;
update oauth_refresh_tokens set token_type = 'refresh' where token_type is null;
alter table oauth_refresh_tokens alter column token_type set not null;

do $$
begin
  alter table oauth_refresh_tokens
    add constraint oauth_refresh_tokens_token_type_check
    check (token_type in ('access', 'refresh'));
exception
  when duplicate_object then null;
end $$;
