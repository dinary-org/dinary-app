-- 게시판 하루 3개 제한 없애기 — 올리는 수에 문턱이 없습니다. 정지 · 연락처 막기 · 사진 확인은 그대로.
-- 같은 인자로 다시 만들어 권한은 그대로 남습니다.

create or replace function public.create_board_post(
  p_type text, p_title text, p_body text default null, p_tags text[] default '{}',
  p_record_id bigint default null,          -- food · cafe 필수, free · theme 선택
  p_course jsonb default null,              -- course: [{record_id, memo}] 2~5개
  p_theme_id bigint default null,           -- theme 필수(열린 주제)
  p_poll jsonb default null,                -- free 만: {options: [..2~5], days: 1~7}
  p_area text default null,
  p_pinned boolean default false,           -- 관리자만
  p_photos text[] default '{}'              -- 앨범에서 올린 사진(버킷 안 경로) 0~4장, 내가 올린 파일만
) returns bigint
language plpgsql volatile security definer set search_path = public as $$
declare
  uid    uuid := auth.uid();
  admin  boolean := public.is_admin();
  v_title text := trim(coalesce(p_title, ''));
  v_body  text := nullif(trim(coalesce(p_body, '')), '');
  v_tags  text[] := public.norm_tags(p_tags);
  new_id bigint;
  item   jsonb;
  pos    int := 0;
  rid    bigint;
  v_memo text;
  opts   jsonb;
  v_days int;
  lbl    text;
  v_photos text[] := coalesce(p_photos, '{}');
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if p_type not in ('free', 'theme', 'food', 'cafe', 'course') then raise exception 'bad_type'; end if;
  if public.is_sanctioned(uid) then raise exception 'sanctioned'; end if;
  if length(v_title) = 0 then raise exception 'need_title'; end if;
  if length(v_title) > 60 or coalesce(length(v_body), 0) > 2000 then raise exception 'too_long'; end if;
  if coalesce(array_length(v_tags, 1), 0) > 5 then raise exception 'too_many_tags'; end if;
  if public.has_contact(v_title) or public.has_contact(v_body) then raise exception 'no_contact'; end if;

  if p_type in ('food', 'cafe') then
    if not exists (select 1 from public.restaurants
                   where id = p_record_id and user_id = uid and coalesce(pending, false) = false
                     and (p_type = 'cafe') = (kind = 'cafe')) then
      raise exception 'not_my_record';
    end if;
  elsif p_type in ('free', 'theme') and p_record_id is not null then
    if not exists (select 1 from public.restaurants where id = p_record_id and user_id = uid and coalesce(pending, false) = false) then
      raise exception 'not_my_record';
    end if;
  end if;

  if coalesce(array_length(v_photos, 1), 0) > 4 then raise exception 'too_many_photos'; end if;
  if exists (select 1 from unnest(v_photos) ph
             where not exists (select 1 from storage.objects o
                               where o.bucket_id = 'restaurant-photos' and o.name = ph and o.owner_id = uid::text)) then
    raise exception 'not_my_upload';
  end if;

  if p_type = 'theme' and not exists (
    select 1 from public.board_themes
    where id = p_theme_id and (now() at time zone 'Asia/Seoul')::date between starts_on and ends_on) then
    raise exception 'theme_closed';
  end if;

  if p_type = 'course' then
    if jsonb_typeof(p_course) is distinct from 'array' or jsonb_array_length(p_course) not between 2 and 5 then
      raise exception 'course_size';
    end if;
    if (select count(distinct (e->>'record_id')) from jsonb_array_elements(p_course) e) <> jsonb_array_length(p_course) then
      raise exception 'course_duplicate';
    end if;
    if exists (
      select 1 from jsonb_array_elements(p_course) e
      where not exists (select 1 from public.restaurants r
                        where r.id = (e->>'record_id')::bigint and r.user_id = uid and coalesce(r.pending, false) = false)) then
      raise exception 'not_my_record';
    end if;
    if exists (select 1 from jsonb_array_elements(p_course) e where length(coalesce(e->>'memo', '')) > 60 or public.has_contact(e->>'memo')) then
      raise exception 'no_contact';
    end if;
  end if;

  if p_poll is not null then
    if p_type <> 'free' then raise exception 'poll_free_only'; end if;
    opts := p_poll->'options';
    v_days := coalesce((p_poll->>'days')::int, 3);
    if jsonb_typeof(opts) is distinct from 'array' or jsonb_array_length(opts) not between 2 and 5 then raise exception 'poll_options'; end if;
    if v_days not between 1 and 7 then raise exception 'poll_days'; end if;
    if exists (select 1 from jsonb_array_elements_text(opts) o where length(trim(o)) not between 1 and 40 or public.has_contact(o)) then
      raise exception 'poll_options';
    end if;
  end if;

  insert into public.board_posts (author_id, type, record_id, theme_id, area, title, body, tags, pinned, photo_refs)
  values (uid, p_type,
          case when p_type = 'course' then null else p_record_id end,
          case when p_type = 'theme' then p_theme_id end,
          nullif(trim(coalesce(p_area, '')), ''),
          v_title, v_body, v_tags, admin and coalesce(p_pinned, false), v_photos)
  returning id into new_id;

  if p_type = 'course' then
    for item in select value from jsonb_array_elements(p_course) loop
      pos := pos + 1;
      rid := (item->>'record_id')::bigint;
      v_memo := nullif(trim(coalesce(item->>'memo', '')), '');
      insert into public.board_post_records (post_id, position, record_id, memo) values (new_id, pos, rid, v_memo);
    end loop;
  end if;

  if p_poll is not null then
    insert into public.board_polls (post_id, closes_at) values (new_id, now() + make_interval(days => v_days));
    pos := 0;
    for lbl in select value from jsonb_array_elements_text(opts) loop
      pos := pos + 1;
      insert into public.board_poll_options (post_id, position, label) values (new_id, pos, trim(lbl));
    end loop;
  end if;

  return new_id;
end $$;
