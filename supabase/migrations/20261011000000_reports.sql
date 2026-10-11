-- LotPulse: sightings become "reports".
--
-- A report is just a lot, a server timestamp and the anonymous reporter. The
-- table is renamed (existing rows and the realtime publication carry over),
-- the client loses the ability to delete, and the per-lot cooldown drops to
-- 5 minutes.

-- Table and columns -----------------------------------------------------------
alter table public.sightings rename to reports;
alter table public.reports rename column user_id to reporter_id;
alter table public.reports rename constraint sightings_pkey to reports_pkey;
alter table public.reports rename constraint sightings_lot_id_known to reports_lot_id_known;
alter index public.sightings_created_at_idx rename to reports_created_at_idx;
alter index public.sightings_user_recent_idx rename to reports_reporter_recent_idx;
create index reports_lot_recent_idx on public.reports (lot_id, created_at desc);

-- If a scout's profile is deleted, their reports stay as anonymous lot history.
alter table public.reports alter column reporter_id drop not null;
alter table public.reports drop constraint sightings_user_id_fkey;
alter table public.reports
  add constraint reports_reporter_id_fkey
  foreign key (reporter_id) references public.profiles (id) on delete set null;

-- Row level security ----------------------------------------------------------
-- Anyone can read the last 24 hours (and their own older reports), a signed-in
-- scout can only insert as themselves, and nobody can update or delete.
drop policy "Recent sightings are public" on public.reports;
drop policy "Scouts post as themselves" on public.reports;
drop policy "Scouts can undo a fresh sighting" on public.reports;

create policy "Recent reports are public"
  on public.reports for select
  to anon, authenticated
  using (created_at > now() - interval '24 hours' or reporter_id = (select auth.uid()));

create policy "Scouts report as themselves"
  on public.reports for insert
  to authenticated
  with check (reporter_id = (select auth.uid()));

revoke all on public.reports from anon, authenticated;
grant select on public.reports to anon, authenticated;
grant insert (lot_id) on public.reports to authenticated;

-- Server-side guards ----------------------------------------------------------
-- Server timestamps, the reporter is always the caller, one report per scout
-- per lot every 5 minutes and at most 6 an hour. The advisory lock stops
-- parallel requests slipping past.
drop trigger guard_sighting on public.reports;
drop function public.guard_sighting();

create function public.guard_report()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.reporter_id := coalesce(auth.uid(), new.reporter_id);
  new.created_at := now();

  perform pg_advisory_xact_lock(hashtextextended(new.reporter_id::text, 0));

  if exists (
    select 1
    from public.reports r
    where r.reporter_id = new.reporter_id
      and r.lot_id = new.lot_id
      and r.created_at > now() - interval '5 minutes'
  ) then
    raise exception 'cooldown: you reported this lot in the last 5 minutes';
  end if;

  if (
    select count(*)
    from public.reports r
    where r.reporter_id = new.reporter_id
      and r.created_at > now() - interval '1 hour'
  ) >= 6 then
    raise exception 'rate_limit: too many reports in the last hour';
  end if;

  return new;
end;
$$;

create trigger guard_report
  before insert on public.reports
  for each row execute function public.guard_report();

-- Weekly clout: 25 points per report since Monday, Toronto time ---------------
create or replace function public.weekly_leaderboard()
returns table (user_id uuid, username text, sightings int, points int)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.username,
    count(*)::int,
    count(*)::int * 25
  from public.reports r
  join public.profiles p on p.id = r.reporter_id
  where r.created_at >= (date_trunc('week', now() at time zone 'America/Toronto') at time zone 'America/Toronto')
  group by p.id, p.username
  order by 4 desc, p.username;
$$;
