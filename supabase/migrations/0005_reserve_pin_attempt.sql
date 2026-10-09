-- PIN attempts are reserved before the PIN is checked, so parallel guesses cannot outrun the lock.
-- One UPDATE per call: the row lock serialises parallel calls and each re-checks the lock, so at most
-- 5 attempts are allowed before the 10-minute lock. The caller verifies the PIN only when allowed,
-- and on success calls reset_pin_failures, which also clears a lock that same attempt set.
drop function public.record_pin_failure(uuid);

create function public.reserve_pin_attempt(p_parent uuid)
returns table (allowed boolean, locked_until timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_locked timestamptz;
begin
  update public.parents p
     set pin_failed = case when p.pin_locked_until is not null then 1 else p.pin_failed + 1 end,  -- expired lock: fresh count
         pin_locked_until = case when p.pin_locked_until is null and p.pin_failed + 1 >= 5
                                 then now() + interval '10 minutes' end
   where p.id = p_parent and (p.pin_locked_until is null or p.pin_locked_until <= now())
  returning p.pin_locked_until into v_locked;
  if found then
    return query select true, v_locked;
  else
    return query select false, p.pin_locked_until from public.parents p where p.id = p_parent;
  end if;
end $$;

-- A correct PIN on an allowed attempt clears the count and any lock.
create or replace function public.reset_pin_failures(p_parent uuid)
returns void
language sql security definer set search_path = '' as $$
  update public.parents p set pin_failed = 0, pin_locked_until = null where p.id = p_parent;
$$;

revoke execute on function public.reserve_pin_attempt(uuid), public.reset_pin_failures(uuid) from public, anon, authenticated;
grant execute on function public.reserve_pin_attempt(uuid), public.reset_pin_failures(uuid) to service_role;
