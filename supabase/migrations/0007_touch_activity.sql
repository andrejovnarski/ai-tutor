-- A parent's activity (sign-in, or a kid playing) refreshes last_active_at at most once an hour and clears any
-- retention warning. Definer because users have no grant on retention_warned_at; it only touches the caller's own row.
create function public.touch_activity()
returns void
language sql security definer set search_path = '' as $$
  update public.parents p set last_active_at = now(), retention_warned_at = null
   where p.id = auth.uid() and p.last_active_at < now() - interval '1 hour';
$$;

revoke execute on function public.touch_activity() from public, anon;
grant execute on function public.touch_activity() to authenticated;
