-- LotPulse: scouts delete their own data from the app.
--
-- A scout is an anonymous sign-in that only their browser holds, so the
-- request itself proves who they are; no email or support inbox needed.
-- delete_my_data() removes the caller's reports and their account (the
-- profile goes with it via on delete cascade). It only ever touches
-- auth.uid(), so nobody can delete someone else.

create function public.delete_my_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not_signed_in: nothing to delete';
  end if;
  delete from public.reports where reporter_id = me;
  delete from auth.users where id = me;
end;
$$;

revoke all on function public.delete_my_data() from public, anon;
grant execute on function public.delete_my_data() to authenticated;
