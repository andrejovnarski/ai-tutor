-- Retention bookkeeping. retention_warn_sent_at is set only after the warning email was sent; deletion requires it,
-- so nobody is deleted without having been warned. No user grant on either column.
alter table public.parents add column retention_warn_sent_at timestamptz;

-- A parent's activity (sign-in, or a kid playing) refreshes last_active_at at most once an hour and clears any
-- retention warning. Definer because users have no grant on the retention columns; it only touches the caller's own row.
create function public.touch_activity()
returns void
language sql security definer set search_path = '' as $$
  update public.parents p set last_active_at = now(), retention_warned_at = null, retention_warn_sent_at = null
   where p.id = auth.uid() and p.last_active_at < now() - interval '1 hour';
$$;

revoke execute on function public.touch_activity() from public, anon;
grant execute on function public.touch_activity() to authenticated;

-- Deletes the account only if, under a row lock, it is still warned (and the warning was sent) and inactive.
-- A concurrent touch_activity either commits first (then this finds nothing) or waits for this delete.
create function public.retention_delete(p_parent uuid, p_warned_before timestamptz, p_inactive_before timestamptz)
returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.parents p
   where p.id = p_parent and p.retention_warned_at <= p_warned_before and p.retention_warn_sent_at is not null
     and p.last_active_at <= p_inactive_before
   for update;
  if not found then return false; end if;
  delete from auth.users where id = p_parent;
  return true;
end $$;

revoke execute on function public.retention_delete(uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.retention_delete(uuid, timestamptz, timestamptz) to service_role;
