-- Recall schedule and most recent successful recall. Existing skills keep the defaults.
alter table skill_state
  add column check_step int not null default 0,
  add column check_due timestamptz,
  add column remembered_at timestamptz;

-- save_step hardening: rows are always written for the session's own kid and session
-- (never the ids in the JSON payload), and an ended session accepts no more steps.
create or replace function save_step(p_session uuid, p_version int, p_state jsonb, p_ended boolean,
  p_attempts jsonb, p_skill_states jsonb, p_style_stats jsonb, p_kid_placed boolean)
returns int
language plpgsql security invoker set search_path = public as $$
declare
  v_kid uuid;
begin
  update sessions
     set state = p_state, version = version + 1, updated_at = now(),
         ended_at = case when p_ended then now() else ended_at end
   where id = p_session and version = p_version and ended_at is null
  returning kid_id into v_kid;
  if not found then
    return -1;
  end if;

  insert into attempts (kid_id, session_id, skill_id, template_id, seed, level, answer, result,
                        mistake_tag, style, time_ms, at, try, mode)
  select v_kid, p_session, skill_id, template_id, seed, level, answer, result,
         mistake_tag, style, time_ms, at, try, mode
    from jsonb_populate_recordset(null::attempts, p_attempts);

  insert into skill_state (kid_id, skill_id, p_known, attempts, level, correct_streak, wrong_streak,
                           last_seen, placed, recent_tags, check_step, check_due, remembered_at)
  select v_kid, skill_id, p_known, attempts, level, correct_streak, wrong_streak,
         last_seen, placed, recent_tags, coalesce(check_step, 0), check_due, remembered_at
    from jsonb_populate_recordset(null::skill_state, p_skill_states)
  on conflict (kid_id, skill_id) do update set
    p_known = excluded.p_known, attempts = excluded.attempts, level = excluded.level,
    correct_streak = excluded.correct_streak, wrong_streak = excluded.wrong_streak,
    last_seen = excluded.last_seen, placed = excluded.placed, recent_tags = excluded.recent_tags,
    check_step = excluded.check_step, check_due = excluded.check_due, remembered_at = excluded.remembered_at;

  insert into style_stats (kid_id, style, tries, wins)
  select v_kid, style, tries, wins
    from jsonb_populate_recordset(null::style_stats, p_style_stats)
  on conflict (kid_id, style) do update set tries = excluded.tries, wins = excluded.wins;

  if p_kid_placed then
    update kids set placed = true where id = v_kid;
  end if;
  return p_version + 1;
end $$;
revoke execute on function save_step from anon, public;
grant execute on function save_step to authenticated;
