-- Session versions are monotonic per kid: a new session starts at the kid's previous final version,
-- so a version a client holds from an ended session can never match a step of the next one.
-- Race-safe: a new session can only be inserted once the old one's ending step has committed
-- (one_open_session), and this runs inside the inserting statement, after that commit is visible.
create function public.continue_session_version() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  new.version := coalesce((select max(s.version) from public.sessions s where s.kid_id = new.kid_id), 0);
  return new;
end $$;
revoke execute on function public.continue_session_version() from public, anon, authenticated;

create trigger sessions_continue_version before insert on public.sessions
  for each row execute function public.continue_session_version();
