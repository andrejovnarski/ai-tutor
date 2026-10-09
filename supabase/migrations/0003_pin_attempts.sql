-- Atomic PIN attempt bookkeeping. One UPDATE per call, so parallel guesses each count (the row lock
-- serialises them) and a slow request can never clear a lock it did not see expire.
create function record_pin_failure(p_parent uuid)
returns table (failed int, locked_until timestamptz)
language sql security definer set search_path = '' as $$
  update public.parents p
     set pin_failed = case
           when p.pin_locked_until > now() then p.pin_failed                    -- locked: leave as is
           when p.pin_locked_until is not null then 1                           -- expired lock: fresh count
           else p.pin_failed + 1 end,
         pin_locked_until = case
           when p.pin_locked_until > now() then p.pin_locked_until              -- never shorten or clear
           when (case when p.pin_locked_until is not null then 1 else p.pin_failed + 1 end) >= 5
             then now() + interval '10 minutes'
           else null end
   where p.id = p_parent
  returning p.pin_failed, p.pin_locked_until;
$$;

create function reset_pin_failures(p_parent uuid)
returns void
language sql security definer set search_path = '' as $$
  update public.parents p
     set pin_failed = 0, pin_locked_until = null
   where p.id = p_parent and (p.pin_locked_until is null or p.pin_locked_until <= now());
$$;

revoke execute on function record_pin_failure, reset_pin_failures from public, anon, authenticated;
grant execute on function record_pin_failure, reset_pin_failures to service_role;
