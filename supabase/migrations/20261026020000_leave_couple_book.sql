-- 끊긴 연인 기록장 지우기 — 나에게서만. 내가 빠지면 상대에게는 그대로 남고, 두 사람 모두 지우면 기록장이 통째로 삭제됩니다
-- (기록 · 위시 · 한 줄 · 기념일 식사 · 콕 찌르기, 그 기록으로 올린 커뮤니티 글까지 on delete cascade).
--
-- 사진 파일: storage.objects 는 SQL 로 지울 수 없어서(storage.protect_delete) 함수가 경로만 골라 줍니다.
--  · 마지막 사람이 올린 파일 → 돌려주면 앱이 Storage API 로 지웁니다(「photos delete own」).
--  · 그 밖의 파일(먼저 지운 사람이 올린 것 등) → photo_cleanup 에 쌓아 두고 서비스 키로 따로 지웁니다.
--  · 지운 뒤에도 다른 곳(개인 기록으로 남긴 복사본 · 프로필 등)이 가리키는 파일은 남깁니다.

create table if not exists public.photo_cleanup (
  path       text primary key,
  created_at timestamptz not null default now()
);
alter table public.photo_cleanup enable row level security;  -- 정책 없음 = 서비스 키만

-- DB 사진 값 → 버킷 안 경로. 앱 photoPath · account_photo_paths 와 같은 규칙(바깥 주소는 null).
create or replace function public.photo_ref_path(v text) returns text
language sql immutable set search_path = '' as $$
  select case
    when v is null or v = '' then null
    when v !~* '^https?://' then v
    when v ~ '/storage/v1/object/[a-z]+/restaurant-photos/'
      then split_part(split_part(split_part(v, '/restaurant-photos/', 2), '?', 1), '#', 1)
  end;
$$;

create or replace function public.leave_couple_book(p_book uuid) returns text[]
language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cand text[];
  mine text[];
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  perform 1 from public.books where id = p_book for update;
  if not exists (
    select 1 from public.books b join public.book_members m on m.book_id = b.id
    where b.id = p_book and m.user_id = uid and b.kind = 'couple'
  ) then raise exception 'not_member'; end if;
  if exists (select 1 from public.books where id = p_book and closed_at is null) then raise exception 'book_open'; end if;

  delete from public.book_members where book_id = p_book and user_id = uid;
  if exists (select 1 from public.book_members where book_id = p_book) then return '{}'; end if;

  -- 마지막 사람 — 이 기록장의 사진 경로를 모아 두고 기록장을 지웁니다.
  select array_agg(distinct p) into cand from (
    select public.photo_ref_path(v) as p
      from public.restaurants r
      cross join lateral unnest(array[r.photo_url, r.image_url] || coalesce(r.photo_urls, '{}'::text[])) as u(v)
     where r.book_id = p_book
    union all
    select public.photo_ref_path(w.capture_path) from public.wishes w where w.book_id = p_book
  ) x where p is not null;
  delete from public.books where id = p_book;
  if cand is null then return '{}'; end if;

  -- 지운 뒤에도 가리키는 곳이 남은 파일은 뺍니다.
  with refs as (
    select v from public.restaurants r
      cross join lateral unnest(array[r.photo_url, r.image_url] || coalesce(r.photo_urls, '{}'::text[])) as u(v)
    union all select p.avatar_url from public.profiles p
    union all select w.capture_path from public.wishes w
    union all select v from public.board_posts b
      cross join lateral jsonb_array_elements_text(coalesce(to_jsonb(b)->'photo_refs', '[]'::jsonb)) as u(v)
    union all select g.photo_ref from public.gallery_photos g
  ),
  gone as (
    select o.name, o.owner_id from storage.objects o
     where o.bucket_id = 'restaurant-photos' and o.name = any(cand)
       and o.name not in (select public.photo_ref_path(v) from refs where public.photo_ref_path(v) is not null)
  ),
  queued as (
    insert into public.photo_cleanup (path)
    select name from gone where owner_id is distinct from uid::text
    on conflict do nothing
  )
  select coalesce(array_agg(name) filter (where owner_id = uid::text), '{}') into mine from gone;
  return mine;
end $$;

revoke execute on function public.leave_couple_book(uuid) from public, anon;
grant execute on function public.leave_couple_book(uuid) to authenticated;
