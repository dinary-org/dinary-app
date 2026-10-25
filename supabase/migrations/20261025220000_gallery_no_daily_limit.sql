-- 갤러리 하루 10장 제한 없애기. 인증 기록 5건 문턱 · 정지 · 연락처 막기 · 같은 사진 두 번 막기는 그대로.
-- 같은 인자로 다시 만들어 권한은 그대로 남습니다.

create or replace function public.post_gallery_photo(
  p_record_id bigint, p_photo_ref text, p_menu text default null,
  p_caption text default null, p_add_menu_to_record boolean default false, p_area text default null
) returns bigint
language plpgsql volatile security definer set search_path = public as $$
declare
  uid       uuid := auth.uid();
  admin     boolean := public.is_admin();
  v_menu    text := nullif(trim(coalesce(p_menu, '')), '');
  v_caption text := nullif(trim(coalesce(p_caption, '')), '');
  rec       public.restaurants%rowtype;
  new_id    bigint;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if public.is_sanctioned(uid) then raise exception 'sanctioned'; end if;
  if not admin and public.my_verified_count() < 5 then raise exception 'need_5_verified'; end if;
  if coalesce(length(v_menu), 0) > 40 or coalesce(length(v_caption), 0) > 120 then raise exception 'too_long'; end if;
  if public.has_contact(v_caption) or public.has_contact(v_menu) then raise exception 'no_contact'; end if;

  select * into rec from public.restaurants where id = p_record_id and user_id = uid and coalesce(pending, false) = false;
  if not found then raise exception 'not_my_record'; end if;
  if not (p_photo_ref = any(coalesce(rec.photo_urls, '{}')) or p_photo_ref = rec.photo_url) then raise exception 'not_my_photo'; end if;
  if exists (select 1 from public.gallery_photos where record_id = p_record_id and photo_ref = p_photo_ref) then
    raise exception 'already_posted';
  end if;

  -- 직접 쓴 메뉴를 기록에도 — 같은 이름(공백 · 대소문자 무시)이 없을 때만.
  if p_add_menu_to_record and v_menu is not null and not exists (
    select 1 from jsonb_array_elements(coalesce(rec.menus, '[]'::jsonb)) m
    where lower(regexp_replace(coalesce(m->>'name', ''), '\s', '', 'g')) = lower(regexp_replace(v_menu, '\s', '', 'g'))) then
    update public.restaurants
       set menus = coalesce(menus, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('name', v_menu, 'vote', null))
     where id = p_record_id;
  end if;

  insert into public.gallery_photos (author_id, record_id, photo_ref, menu, caption, area)
  values (uid, p_record_id, p_photo_ref, v_menu, v_caption,
          coalesce(nullif(left(trim(coalesce(p_area, '')), 40), ''), public.area_of(rec.address)))
  returning id into new_id;
  return new_id;
end $$;
