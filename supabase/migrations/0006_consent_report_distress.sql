-- Plan 3b: consent log, distress flags, weekly report sends, retention warning, mastery timestamp.
create table public.consents (
  id bigint generated always as identity primary key,
  parent_id uuid not null references public.parents on delete cascade,
  at timestamptz not null default now(),
  notice_version text not null,
  method text not null check (method in ('stripe', 'fake')),
  ref text not null
);
create unique index consents_ref_key on public.consents (ref);
create index consents_parent_idx on public.consents (parent_id);

create table public.distress_flags (
  id bigint generated always as identity primary key,
  kid_id uuid not null references public.kids on delete cascade,
  line text not null check (char_length(line) <= 500),
  at timestamptz not null default now()
);
create index distress_flags_kid_idx on public.distress_flags (kid_id, at);

create table public.report_sends (
  parent_id uuid references public.parents on delete cascade,
  week_start date,
  sent_at timestamptz not null default now(),
  primary key (parent_id, week_start)
);

alter table public.consents enable row level security;
alter table public.distress_flags enable row level security;
alter table public.report_sends enable row level security;

revoke all on public.consents, public.distress_flags, public.report_sends from anon, authenticated;
grant select on public.consents, public.distress_flags to authenticated;

create policy consents_select on public.consents for select to authenticated
  using (parent_id = (select auth.uid()));
create policy distress_flags_select on public.distress_flags for select to authenticated
  using (kid_id in (select id from public.kids where parent_id = (select auth.uid())));

alter table public.parents add column retention_warned_at timestamptz;
alter table public.skill_state add column mastered_at timestamptz;

-- Mastery mirrors src/domain/kid/bkt.ts: MASTERED_P = 0.95 and MASTERED_ATTEMPTS = 5. Placement alone does not count.
-- The first time a row crosses the line mastered_at is set, and it is never changed afterwards.
create function public.set_mastered_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.mastered_at is not null then
    new.mastered_at := old.mastered_at;
  elsif new.p_known >= 0.95 and new.attempts >= 5 then
    new.mastered_at := coalesce(new.mastered_at, now());
  end if;
  return new;
end $$;

create trigger skill_state_mastered_at before insert or update on public.skill_state
  for each row execute function public.set_mastered_at();

create function public.grant_consent(p_parent uuid, p_notice text, p_method text, p_ref text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.consents (parent_id, notice_version, method, ref)
  values (p_parent, p_notice, p_method, p_ref)
  on conflict (ref) do nothing;
  if found then
    update public.parents p set consent_at = now() where p.id = p_parent;
  end if;
end $$;

revoke execute on function public.grant_consent(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.grant_consent(uuid, text, text, text) to service_role;
