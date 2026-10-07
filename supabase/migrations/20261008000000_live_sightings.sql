-- LotPulse: shared, live enforcement sightings.
--
-- Students sign in anonymously (Supabase anonymous auth), pick a public scout
-- name, and report sightings per lot. Everyone can read sightings; the guards
-- below are enforced by the database, not the browser.

-- Scout names -----------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  created_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[A-Za-z0-9_]{3,20}$')
);

create unique index profiles_username_unique on public.profiles (lower(username));

-- Sightings -------------------------------------------------------------------
create table public.sightings (
  id uuid primary key default gen_random_uuid(),
  lot_id text not null,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint sightings_lot_id_known check (lot_id in ('P9', 'P4', 'P8', 'P11', 'CCT', 'IC'))
);

create index sightings_created_at_idx on public.sightings (created_at desc);
create index sightings_user_recent_idx on public.sightings (user_id, created_at desc);

-- Row level security ----------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.sightings enable row level security;

create policy "Scout names are public"
  on public.profiles for select
  to anon, authenticated
  using (true);

create policy "Scouts create their own profile"
  on public.profiles for insert
  to authenticated
  with check (id = (select auth.uid()));

create policy "Sightings are public"
  on public.sightings for select
  to anon, authenticated
  using (true);

create policy "Scouts post as themselves"
  on public.sightings for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Scouts can undo a fresh sighting"
  on public.sightings for delete
  to authenticated
  using (user_id = (select auth.uid()) and created_at > now() - interval '2 minutes');

grant select on public.profiles, public.sightings to anon, authenticated;
grant insert on public.profiles to authenticated;
grant insert, delete on public.sightings to authenticated;

-- Server-side guards ----------------------------------------------------------
-- Timestamps come from the server, and each scout gets a per-lot cooldown and
-- an hourly cap. The advisory lock stops parallel requests slipping past.
create function public.guard_sighting()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.user_id := coalesce(auth.uid(), new.user_id);
  new.created_at := now();

  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));

  if exists (
    select 1
    from public.sightings s
    where s.user_id = new.user_id
      and s.lot_id = new.lot_id
      and s.created_at > now() - interval '15 minutes'
  ) then
    raise exception 'cooldown: you reported this lot in the last 15 minutes';
  end if;

  if (
    select count(*)
    from public.sightings s
    where s.user_id = new.user_id
      and s.created_at > now() - interval '1 hour'
  ) >= 6 then
    raise exception 'rate_limit: too many sightings in the last hour';
  end if;

  return new;
end;
$$;

create trigger guard_sighting
  before insert on public.sightings
  for each row execute function public.guard_sighting();

-- Weekly leaderboard (weeks start Monday, Toronto time) -----------------------
create view public.weekly_leaderboard
with (security_invoker = true)
as
select
  p.id as user_id,
  p.username,
  count(*)::int as sightings,
  count(*)::int * 25 as points
from public.sightings s
join public.profiles p on p.id = s.user_id
where s.created_at >= (date_trunc('week', now() at time zone 'America/Toronto') at time zone 'America/Toronto')
group by p.id, p.username
order by points desc, p.username;

grant select on public.weekly_leaderboard to anon, authenticated;

-- Live updates ----------------------------------------------------------------
alter publication supabase_realtime add table public.sightings;
