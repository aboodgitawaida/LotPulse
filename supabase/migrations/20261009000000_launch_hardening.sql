-- LotPulse: privacy and abuse hardening before the public launch.

-- Sighting history ------------------------------------------------------------
-- A sighting is the scout name, a lot and a time. Kept readable forever, that
-- adds up to a timeline of when each named scout is on campus. Everyone now
-- sees only the last 24 hours (all the app's feed uses); scouts still see
-- their own reports for their weekly stats.
drop policy "Sightings are public" on public.sightings;

create policy "Recent sightings are public"
  on public.sightings for select
  to anon, authenticated
  using (created_at > now() - interval '24 hours' or user_id = (select auth.uid()));

-- The weekly leaderboard needs the whole week, so it can't read through the
-- 24-hour policy. A security definer function returns only the totals.
drop view public.weekly_leaderboard;

create function public.weekly_leaderboard()
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
  from public.sightings s
  join public.profiles p on p.id = s.user_id
  where s.created_at >= (date_trunc('week', now() at time zone 'America/Toronto') at time zone 'America/Toronto')
  group by p.id, p.username
  order by 4 desc, p.username;
$$;

revoke execute on function public.weekly_leaderboard() from public;
grant execute on function public.weekly_leaderboard() to anon, authenticated;

-- Scout names -------------------------------------------------------------------
-- Names are public, so block ones that pose as the app, the university or
-- parking staff, plus "You", which the leaderboard uses for the viewer.
-- NOT VALID: applies to new names without failing on any existing ones.
alter table public.profiles
  add constraint profiles_username_reserved check (
    lower(username) !~ '^(you|me|admin|administrator|mod|moderator|staff|support|system|official|utm|uoft|lotpulse.*|.*parking_?(services|enforcement|officer).*|.*campus_?(police|safety|security).*)$'
  ) not valid;
