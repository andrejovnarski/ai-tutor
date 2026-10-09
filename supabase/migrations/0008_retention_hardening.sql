-- Retention hardening.

-- 1. A warning counts as sent only if it was sent for the current claim: a sent time older than retention_warned_at is
--    left over from an earlier cycle. retention_warn_unsent marks a claim whose email has not gone out (yet), so the
--    cron can re-claim it and never deletes on it. Generated, so it can never disagree with the two timestamps.
alter table public.parents add column retention_warn_unsent boolean generated always as (
  retention_warned_at is not null
  and (retention_warn_sent_at is null or retention_warn_sent_at < retention_warned_at)
) stored;

-- 2. Deletes the account only if, under a row lock, it is still warned, the warning was sent for this claim, and the
--    parent is still inactive. A concurrent touch_activity either commits first (then this finds nothing) or waits.
create or replace function public.retention_delete(p_parent uuid, p_warned_before timestamptz, p_inactive_before timestamptz)
returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.parents p
   where p.id = p_parent and p.retention_warned_at <= p_warned_before
     and p.retention_warn_sent_at is not null and p.retention_warn_sent_at >= p.retention_warned_at
     and p.last_active_at <= p_inactive_before
   for update;
  if not found then return false; end if;
  delete from auth.users where id = p_parent;
  return true;
end $$;

revoke execute on function public.retention_delete(uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.retention_delete(uuid, timestamptz, timestamptz) to service_role;

-- 3. Activity is recorded only through touch_activity (which also clears a retention warning), so a user can no longer
--    set last_active_at directly, e.g. into the future to dodge retention.
revoke update (last_active_at) on public.parents from authenticated;
