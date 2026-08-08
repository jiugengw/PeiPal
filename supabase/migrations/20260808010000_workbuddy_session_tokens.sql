-- Once approved, WorkBuddy is handed a short session token instead of the
-- caregiver's raw Supabase JWT, so its agent only ever has to retype a
-- short string across tool calls instead of a long, error-prone one.
alter table workbuddy_login_requests
  add column session_token_hash text unique;
