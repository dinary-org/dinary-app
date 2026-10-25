-- 연인 신청 — 친구 추가처럼 닉네임으로 찾아 보내고, 받은 사람은 수락만 합니다.
-- 따로 표를 두지 않고 초대 코드(book_invites)에 받는 사람(to_user)을 붙입니다. 받는 사람만 쓸 수 있고 7일 동안 유효합니다.
-- 수락은 지금의 join_book(코드)을 그대로 씁니다. 받는 사람이 혼자 기다리던 연인 기록장이 있으면 그건 닫고 들어갑니다.

alter table public.book_invites add column if not exists to_user uuid references auth.users(id) on delete cascade;
create index if not exists book_invites_to_user_idx on public.book_invites (to_user) where to_user is not null and used_by is null;

-- 열린 연인 기록장에 들어 있는지. solo_ok — 혼자 기다리는 기록장(멤버 1명)은 빼고 봅니다.
create or replace function public.in_open_couple(p_uid uuid, solo_ok boolean) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.books bk join public.book_members m on m.book_id = bk.id
    where m.user_id = p_uid and bk.kind = 'couple' and bk.closed_at is null
      and (not solo_ok or (select count(*) from public.book_members x where x.book_id = bk.id) >= 2)
  );
$$;
revoke execute on function public.in_open_couple(uuid, boolean) from public, anon, authenticated;

-- 코드 확인 — 받는 사람이 정해진 코드는 그 사람만. 그 사람은 혼자 기다리던 기록장이 있어도 됩니다(join_book 이 닫음).
create or replace function public.check_book_invite(p_code text, p_uid uuid) returns public.book_invites
language plpgsql stable security definer set search_path = public as $$
declare
  inv public.book_invites;
begin
  select * into inv from public.book_invites where code = upper(regexp_replace(coalesce(p_code, ''), '[^0-9A-Za-z]', '', 'g'));
  if inv.code is null or (inv.to_user is not null and inv.to_user <> p_uid) then raise exception 'invite_not_found'; end if;
  if inv.used_by is not null then raise exception 'invite_used'; end if;
  if inv.expires_at < now() then raise exception 'invite_expired'; end if;
  if inv.created_by = p_uid then raise exception 'invite_own'; end if;
  if exists (select 1 from public.books where id = inv.book_id and closed_at is not null) then raise exception 'invite_expired'; end if;
  if (select count(*) from public.book_members where book_id = inv.book_id) >= 2 then raise exception 'book_full'; end if;
  if public.in_open_couple(p_uid, inv.to_user is not null) then raise exception 'already_in_couple'; end if;
  return inv;
end $$;
revoke execute on function public.check_book_invite(text, uuid) from public, anon, authenticated;

-- 받는 쪽 미리 보기 — 본문은 그대로, check_book_invite 가 바뀌어 다시 만듭니다.
create or replace function public.peek_book_invite(p_code text) returns json
language plpgsql stable security definer set search_path = public as $$
declare
  inv public.book_invites;
  p public.profiles;
  bk public.books;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  inv := public.check_book_invite(p_code, auth.uid());
  select * into bk from public.books where id = inv.book_id;
  select * into p from public.profiles where id = inv.created_by;
  return json_build_object(
    'code', inv.code,
    'book_id', inv.book_id,
    'started_on', bk.started_on,
    'inviter', json_build_object('id', inv.created_by, 'nickname', p.nickname, 'avatar_url', p.avatar_url)
  );
end $$;

-- 「함께 쓰기 시작」 — 신청으로 들어올 때는 내가 혼자 기다리던 연인 기록장을 닫습니다.
create or replace function public.join_book(p_code text) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  inv public.book_invites;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  -- 같은 코드를 두 사람이 동시에 넣지 않게 기록장 줄을 잠급니다.
  perform 1 from public.books where id = (
    select book_id from public.book_invites where code = upper(regexp_replace(coalesce(p_code, ''), '[^0-9A-Za-z]', '', 'g'))
  ) for update;
  inv := public.check_book_invite(p_code, uid);
  if inv.to_user is not null then
    update public.books bk set closed_at = now()
    where bk.kind = 'couple' and bk.closed_at is null and bk.id <> inv.book_id
      and exists (select 1 from public.book_members m where m.book_id = bk.id and m.user_id = uid);
  end if;
  insert into public.book_members (book_id, user_id) values (inv.book_id, uid);
  update public.book_invites set used_by = uid where code = inv.code;
  -- 다른 남은 코드는 닫습니다.
  update public.book_invites set expires_at = least(expires_at, now()) where book_id = inv.book_id and used_by is null;
  return inv.book_id;
end $$;

-- 새 코드 만들기 — 보낸 신청(to_user)은 그대로 둡니다.
create or replace function public.renew_book_invite(p_book uuid) returns json
language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  c text;
  exp timestamptz := now() + interval '24 hours';
begin
  if not public.book_writable(p_book) then raise exception 'not_member'; end if;
  if (select count(*) from public.book_members where book_id = p_book) >= 2 then raise exception 'book_full'; end if;
  update public.book_invites set expires_at = least(expires_at, now()) where book_id = p_book and used_by is null and to_user is null;
  c := public.new_invite_code();
  insert into public.book_invites (code, book_id, created_by, expires_at) values (c, p_book, uid, exp);
  return json_build_object('book_id', p_book, 'code', c, 'expires_at', exp);
end $$;

-- 연인 신청 보내기 — 혼자 기다리는 내 연인 기록장(p_book)에서. 한 번에 한 사람에게만(전에 보낸 신청은 닫음).
create or replace function public.request_couple(p_book uuid, p_to uuid) returns json
language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  c text;
  exp timestamptz := now() + interval '7 days';
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if not exists (select 1 from public.books where id = p_book and kind = 'couple') or not public.book_writable(p_book) then raise exception 'not_member'; end if;
  if (select count(*) from public.book_members where book_id = p_book) >= 2 then raise exception 'book_full'; end if;
  if p_to is null or p_to = uid then raise exception 'request_self'; end if;
  if not exists (select 1 from public.profiles where id = p_to and nickname is not null) then raise exception 'request_blocked'; end if;
  if exists (select 1 from public.user_blocks where (user_id = uid and blocked_id = p_to) or (user_id = p_to and blocked_id = uid)) then
    raise exception 'request_blocked';
  end if;
  if public.in_open_couple(p_to, true) then raise exception 'partner_in_couple'; end if;

  update public.book_invites set expires_at = least(expires_at, now()) where book_id = p_book and used_by is null and to_user is not null;
  c := public.new_invite_code();
  insert into public.book_invites (code, book_id, created_by, expires_at, to_user) values (c, p_book, uid, exp, p_to);
  return json_build_object('book_id', p_book, 'code', c, 'expires_at', exp);
end $$;

-- 신청 지우기 — 보낸 사람(취소)이든 받은 사람(거절)이든.
create or replace function public.cancel_couple_request(p_code text) returns void
language sql volatile security definer set search_path = public as $$
  update public.book_invites set expires_at = least(expires_at, now())
  where code = upper(p_code) and to_user is not null and used_by is null and auth.uid() in (created_by, to_user);
$$;

-- 나에게 온 신청 — 아직 유효하고 상대가 혼자 기다리는 것만, 최신순.
create or replace function public.my_couple_requests() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(r order by r.created_at desc), '[]'::json) from (
    select i.code, i.book_id, i.created_at, i.expires_at, bk.started_on,
           json_build_object('id', p.id, 'nickname', p.nickname, 'avatar_url', p.avatar_url, 'character_id', p.character_id, 'title_label_id', p.title_label_id) as inviter
    from public.book_invites i
    join public.books bk on bk.id = i.book_id
    join public.profiles p on p.id = i.created_by
    where i.to_user = auth.uid() and i.used_by is null and i.expires_at > now() and bk.closed_at is null
      and (select count(*) from public.book_members m where m.book_id = i.book_id) < 2
      and not exists (select 1 from public.user_blocks b where b.user_id = auth.uid() and b.blocked_id = i.created_by)
  ) r;
$$;

revoke execute on function public.request_couple(uuid, uuid) from public, anon;
revoke execute on function public.cancel_couple_request(text) from public, anon;
revoke execute on function public.my_couple_requests() from public, anon;
grant execute on function public.request_couple(uuid, uuid) to authenticated;
grant execute on function public.cancel_couple_request(text) to authenticated;
grant execute on function public.my_couple_requests() to authenticated;
