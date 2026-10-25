-- Include ownerless wish and community attachments; retain photos referenced by other users.
-- 회원 탈퇴 때 지울 사진 파일 목록 — account-delete 함수(service role)만 부릅니다.
-- 사진 경로에는 사용자 id 가 없고, 프로젝트를 옮기며 복사한 파일은 storage.objects.owner 가 비어 있습니다.
-- 그래서 (1) 내가 올린 파일(owner_id) + (2) 내 기록 · 프로필이 가리키는 파일을 모읍니다.
-- 다른 사람의 기록 · 프로필도 가리키는 파일은 빼고 남깁니다(혹시 함께 쓰는 경우 대비).
-- DB 값은 「경로」(새 기록) 또는 「공개 주소」(예전 기록) — 앱 photoPath 와 같은 규칙으로 경로만 뽑습니다.
-- 구글 프로필 사진 같은 바깥 주소는 null 이 되어 빠집니다.
create or replace function public.account_photo_paths(p_uid uuid)
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  with refs as (
    select r.user_id as uid, v
      from public.restaurants r
      cross join lateral unnest(array[r.photo_url, r.image_url] || coalesce(r.photo_urls, '{}'::text[])) as u(v)
    union all
    select p.id, p.avatar_url from public.profiles p
    union all
    select w.user_id, w.capture_path from public.wishes w
    union all
    select b.author_id, v from public.board_posts b
      cross join lateral jsonb_array_elements_text(coalesce(to_jsonb(b)->'photo_refs', '[]'::jsonb)) as u(v)
    union all
    select g.author_id, g.photo_ref from public.gallery_photos g
  ),
  paths as (
    select uid,
           case
             when v !~* '^https?://' then v
             when v ~ '/storage/v1/object/[a-z]+/restaurant-photos/'
               then split_part(split_part(split_part(v, '/restaurant-photos/', 2), '?', 1), '#', 1)
           end as path
      from refs
     where v is not null and v <> ''
  )
  select o.name
    from storage.objects o
   where o.bucket_id = 'restaurant-photos'
     and (o.owner_id = p_uid::text
          or o.name in (select path from paths where uid = p_uid and path is not null))
     and o.name not in (select path from paths where uid <> p_uid and path is not null);
$$;

revoke all on function public.account_photo_paths(uuid) from public, anon, authenticated;
grant execute on function public.account_photo_paths(uuid) to service_role;
