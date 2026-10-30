-- LotPulse: keep slurs and obscene words out of scout names.
--
-- Scout names are public on the leaderboard and the live feed, so the
-- database refuses offensive ones, the same way it refuses names that pose
-- as staff. A modified client can't skip it.
--
-- The word lists are ROT13-encoded so this file doesn't read as a list of
-- slurs. To change them, encode a word with
--   select translate('word', 'abcdefghijklmnopqrstuvwxyz', 'nopqrstuvwxyzabcdefghijklm');
-- and replace this function in a new migration.
--
-- NOT VALID: only new names are checked; existing rows are never rejected or
-- rewritten.

create function public.username_is_offensive(username text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  -- Blocked anywhere in the name: slurs, strong profanity, explicit terms and
  -- hate symbols that don't hide inside everyday words.
  anywhere constant text[] := array(
    select translate(w, 'abcdefghijklmnopqrstuvwxyz', 'nopqrstuvwxyzabcdefghijklm')
    from unnest(array[
      'shpx', 'fuvg', 'phag', 'ovgpu', 'juber', 'fyhg', 'avtt', 'snttbg',
      'sntbg', 'genaal', 'jrgonpx', 'ornare', 'xvxr', 'zbyrfg', 'crqbcuvy',
      'cnrqbcuvy', 'uvgyre', 'xxx', '1488', 'juvgrcbjre', 'fvrturvy', 'cbea',
      'qvyqb', 'wvmm', 'cravf', 'intvan', 'nffubyr', 'chffl', 'oybjwbo',
      'unaqwbo', 'pbpxfhpx', 'qvpxurnq', 'obbo'
    ]) w
  );
  -- Blocked only as a whole word, because they hide inside ordinary words
  -- (class, grape, therapist, peacock, scoutwatch, swanky, retardant...).
  whole constant text[] := array(
    select translate(w, 'abcdefghijklmnopqrstuvwxyz', 'nopqrstuvwxyzabcdefghijklm')
    from unnest(array[
      'nff', 'nefr', 'gvg', 'gvgf', 'qvpx', 'pbpx', 'phz', 'nany', 'nahf',
      'snt', 'ubzb', 'pbba', 'tbbx', 'fcvp', 'puvax', 'qlxr', 'cnxv',
      'arteb', 'anmv', 'urvy', 'encr', 'encrq', 'encrf', 'encvfg', 'crqb',
      'cnrqb', 'xlf', 'zvys', 'gjng', 'gjngf', 'jnax', 'jnaxre', 'jnaxref',
      'jnaxvat', 'ergneq', 'ergneqrq', 'ergneqf'
    ]) w
  );
  -- The whole name with underscores dropped ("a_s_s" counts), plus each word:
  -- underscores and camelCase both split words (BigWord -> big, word).
  joined constant text := lower(replace(username, '_', ''));
  candidates constant text[] :=
    regexp_split_to_array(lower(regexp_replace(username, '([a-z0-9])([A-Z])', '\1_\2', 'g')), '_+')
    || joined;
  candidate text;
  form text;
  squeezed text;
  doubled text;
  word text;
begin
  foreach candidate in array candidates loop
    -- Try it as typed and with leetspeak undone (a 1 can be an i or an l).
    foreach form in array array[
      candidate,
      translate(candidate, '0134578', 'oieastb'),
      translate(candidate, '0134578', 'oleastb')
    ] loop
      -- Stretched letters count too ("fuuuck", "asss"), but only runs of three
      -- or more, so real double letters (rapped, Shiite) are left alone.
      squeezed := regexp_replace(form, '(.)\1{2,}', '\1', 'g');
      doubled := regexp_replace(form, '(.)\1{2,}', '\1\1', 'g');
      foreach word in array whole loop
        if word in (form, squeezed, doubled) then
          return true;
        end if;
      end loop;
      if candidate = joined then
        foreach word in array anywhere loop
          if strpos(form, word) > 0 or strpos(squeezed, word) > 0 or strpos(doubled, word) > 0 then
            return true;
          end if;
        end loop;
      end if;
    end loop;
  end loop;
  return false;
end;
$$;

alter table public.profiles
  add constraint profiles_username_clean
  check (not public.username_is_offensive(username)) not valid;
