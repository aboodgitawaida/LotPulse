-- LotPulse: least-privilege grants on scout names.
--
-- Supabase gives anon and authenticated every privilege on new tables, and
-- until now only row level security stopped them updating or deleting
-- profiles. Take those privileges away too, so a policy added by mistake
-- later can't open the table up. Scouts can still read every name and create
-- their own, sending only their id and name (the join time is the server's).
--
-- Only privileges change here: no rows are touched.

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant insert (id, username) on public.profiles to authenticated;

-- guard_report() only ever runs as the reports trigger, never from the API.
revoke all on function public.guard_report() from public, anon, authenticated;
