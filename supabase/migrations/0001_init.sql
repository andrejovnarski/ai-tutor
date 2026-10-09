create type kid_grade as enum ('K','1','2','3','4','5');
create type age_band as enum ('5-7','8-11');
create type avatar as enum ('fox','bear','owl','frog','duck','rabbit','cat','turtle');

create table parents (
  id uuid primary key references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  consent_at timestamptz,                -- set only by Plan 3b's consent flow
  pin_hash text, pin_salt text,
  pin_failed int not null default 0, pin_locked_until timestamptz,
  last_active_at timestamptz not null default now()
);
create table kids (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references parents on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 20),
  grade kid_grade not null, age_band age_band not null, avatar avatar not null,
  placed boolean not null default false,
  created_at timestamptz not null default now()
);
create table skill_state (
  kid_id uuid references kids on delete cascade, skill_id text,
  p_known double precision not null, attempts int not null, level smallint not null check (level between 1 and 3),
  correct_streak int not null, wrong_streak int not null, last_seen timestamptz,
  placed boolean not null, recent_tags text[] not null,
  primary key (kid_id, skill_id)
);
create table style_stats (
  kid_id uuid references kids on delete cascade, style text,
  tries int not null, wins int not null, primary key (kid_id, style)
);
create table attempts (
  id bigint generated always as identity primary key,
  kid_id uuid not null references kids on delete cascade,
  session_id uuid not null, skill_id text not null, template_id text not null, seed bigint not null,
  level smallint not null, answer int not null, result text not null, mistake_tag text, style text,
  time_ms int not null, at timestamptz not null, try smallint not null, mode text not null,
  unique (session_id, at, try, skill_id)
);
create table sessions (
  id uuid primary key default gen_random_uuid(),
  kid_id uuid not null references kids on delete cascade,
  version int not null default 0, state jsonb not null,
  started_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  ended_at timestamptz
);
create unique index one_open_session on sessions (kid_id) where ended_at is null;
create index attempts_kid_at on attempts (kid_id, at);

-- Parent row is created by trigger on sign-up.
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into parents (id) values (new.id);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- Privileges: nothing for anon; parents may only touch last_active_at directly.
revoke all on parents, kids, skill_state, style_stats, attempts, sessions from anon;
revoke update on parents from authenticated;
grant update (last_active_at) on parents to authenticated;
revoke update, delete on attempts from authenticated;

alter table parents enable row level security;
alter table kids enable row level security;
alter table skill_state enable row level security;
alter table style_stats enable row level security;
alter table attempts enable row level security;
alter table sessions enable row level security;

create policy parents_select on parents for select to authenticated using (id = (select auth.uid()));
create policy parents_update on parents for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy kids_select on kids for select to authenticated using (parent_id = (select auth.uid()));
create policy kids_update on kids for update to authenticated
  using (parent_id = (select auth.uid())) with check (parent_id = (select auth.uid()));
create policy kids_delete on kids for delete to authenticated using (parent_id = (select auth.uid()));
create policy kids_insert on kids for insert to authenticated with check (
  parent_id = (select auth.uid())
  and exists (select 1 from parents p where p.id = (select auth.uid()) and p.consent_at is not null)
);

create policy skill_state_all on skill_state for all to authenticated
  using (kid_id in (select id from kids where parent_id = (select auth.uid())))
  with check (kid_id in (select id from kids where parent_id = (select auth.uid())));
create policy style_stats_all on style_stats for all to authenticated
  using (kid_id in (select id from kids where parent_id = (select auth.uid())))
  with check (kid_id in (select id from kids where parent_id = (select auth.uid())));
create policy sessions_all on sessions for all to authenticated
  using (kid_id in (select id from kids where parent_id = (select auth.uid())))
  with check (kid_id in (select id from kids where parent_id = (select auth.uid())));
create policy attempts_select on attempts for select to authenticated
  using (kid_id in (select id from kids where parent_id = (select auth.uid())));
create policy attempts_insert on attempts for insert to authenticated
  with check (kid_id in (select id from kids where parent_id = (select auth.uid())));

create function save_step(p_session uuid, p_version int, p_state jsonb, p_ended boolean,
  p_attempts jsonb, p_skill_states jsonb, p_style_stats jsonb, p_kid_placed boolean)
returns int
language plpgsql security invoker set search_path = public as $$
declare
  v_kid uuid;
begin
  update sessions
     set state = p_state, version = version + 1, updated_at = now(),
         ended_at = case when p_ended then now() else ended_at end
   where id = p_session and version = p_version
  returning kid_id into v_kid;
  if not found then
    return -1;
  end if;

  insert into attempts (kid_id, session_id, skill_id, template_id, seed, level, answer, result,
                        mistake_tag, style, time_ms, at, try, mode)
  select kid_id, session_id, skill_id, template_id, seed, level, answer, result,
         mistake_tag, style, time_ms, at, try, mode
    from jsonb_populate_recordset(null::attempts, p_attempts);

  insert into skill_state
  select * from jsonb_populate_recordset(null::skill_state, p_skill_states)
  on conflict (kid_id, skill_id) do update set
    p_known = excluded.p_known, attempts = excluded.attempts, level = excluded.level,
    correct_streak = excluded.correct_streak, wrong_streak = excluded.wrong_streak,
    last_seen = excluded.last_seen, placed = excluded.placed, recent_tags = excluded.recent_tags;

  insert into style_stats
  select * from jsonb_populate_recordset(null::style_stats, p_style_stats)
  on conflict (kid_id, style) do update set tries = excluded.tries, wins = excluded.wins;

  if p_kid_placed then
    update kids set placed = true where id = v_kid;
  end if;
  return p_version + 1;
end $$;
revoke execute on function save_step from anon, public;
grant execute on function save_step to authenticated;
