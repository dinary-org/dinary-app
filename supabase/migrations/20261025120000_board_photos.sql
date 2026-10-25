-- 게시판 글에 앨범 사진 붙이기 — 기록 없이 사진만 0~4장.
-- 사진은 기록 사진과 같은 비공개 버킷(restaurant-photos)에 올리고, 글에는 버킷 안 경로만 둡니다.
-- 보이는 범위는 글과 같습니다(로그인한 누구나 · 숨긴 글 · 차단한 사람 제외).

alter table public.board_posts add column if not exists photo_refs text[] not null default '{}';

/* ───────────── 1) 글 올리기 — p_photos 를 끝에 더함(기본값이 있어 예전 앱도 그대로) ───────────── */

drop function if exists public.create_board_post(text, text, text, text[], bigint, jsonb, bigint, jsonb, text, boolean);

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
  if not admin and public.my_verified_count() < 5 then raise exception 'need_5_verified'; end if;
  if not admin and (select count(*) from public.board_posts
      where author_id = uid
        and (created_at at time zone 'Asia/Seoul')::date = (now() at time zone 'Asia/Seoul')::date) >= 3 then
    raise exception 'daily_limit';
  end if;
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

/* ───────────── 2) 목록 · 상세 뷰 — photo_refs 를 끝에 ───────────── */

create or replace view public.board_feed as
  with base as (
    select p.*, (p.hidden_at is null or public.is_admin()) as shown
    from public.board_posts p
    where not public.is_blocked(p.author_id)
  )
  select p.id, p.type, p.author_id, p.created_at, p.edited_at, p.theme_id, p.area, p.pinned, p.hidden_at,
         case when p.shown then p.title end as title,
         case when p.shown then coalesce(p.body, p.note) end as body,
         case when p.shown then p.tags else '{}'::text[] end as tags,
         p.record_id,
         a.nickname, a.avatar_url, a.character_id, a.title_label_id, a.role as author_role,
         r.name as place_name, r.kind, r.category, r.address, r.rating, r.photo_urls, r.cover_index, r.photo_url,
         r.verified, r.verified_at, r.lat, r.lng,
         case when r.id is null then null else public.place_of(r.place_key, r.name, r.address) end as place,
         (select count(*) from public.board_reactions x where x.post_id = p.id and x.kind = 'want')::int as want_count,
         (select count(*) from public.board_reactions x where x.post_id = p.id and x.kind = 'been')::int as been_count,
         (select count(*) from public.board_reactions x where x.post_id = p.id and x.kind = 'cheer')::int as cheer_count,
         exists (select 1 from public.board_reactions x where x.post_id = p.id and x.kind = 'want' and x.user_id = auth.uid()) as my_want,
         exists (select 1 from public.board_reactions x where x.post_id = p.id and x.kind = 'been' and x.user_id = auth.uid()) as my_been,
         exists (select 1 from public.board_reactions x where x.post_id = p.id and x.kind = 'cheer' and x.user_id = auth.uid()) as my_cheer,
         (select count(*) from public.board_comments c
           where c.post_id = p.id and c.hidden_at is null and not public.is_blocked(c.author_id))::int as comment_count,
         (select count(*) from public.board_post_records pr where pr.post_id = p.id)::int as course_count,
         (select count(*) from public.board_post_records pr join public.restaurants cr on cr.id = pr.record_id
           where pr.post_id = p.id and cr.verified)::int as course_verified,
         (select array_agg(cr.name order by pr.position) from public.board_post_records pr join public.restaurants cr on cr.id = pr.record_id
           where pr.post_id = p.id and p.shown) as course_names,
         (select count(*) from public.board_poll_votes v where v.post_id = p.id)::int as poll_total,
         (select bp.closes_at from public.board_polls bp where bp.post_id = p.id) as poll_closes_at,
         (select v.option_id from public.board_poll_votes v where v.post_id = p.id and v.user_id = auth.uid()) as my_vote,
         case when p.shown then p.photo_refs else '{}'::text[] end as photo_refs
  from base p
  join public.profiles a on a.id = p.author_id
  left join public.restaurants r on r.id = p.record_id and p.shown;

/* ───────────── 3) 사진 공개 — 게시판 글에 붙인 사진 ───────────── */

create or replace function public.can_see_photo(obj text) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    exists (select 1 from public.profiles p where public.photo_ref_is(p.avatar_url, obj))
    or exists (select 1 from public.board_posts bp
               where exists (select 1 from unnest(bp.photo_refs) u where public.photo_ref_is(u, obj))
                 and bp.hidden_at is null and not public.is_blocked(bp.author_id))
    or exists (select 1 from public.gallery_photos g
               where public.photo_ref_is(g.photo_ref, obj) and g.hidden_at is null and not public.is_blocked(g.author_id))
    or exists (
      select 1 from public.restaurants r
      where (public.photo_ref_is(r.photo_url, obj)
             or exists (select 1 from unnest(r.photo_urls) u where public.photo_ref_is(u, obj)))
        and (
          r.user_id = auth.uid()
          or public.is_book_member(r.book_id)
          or (not public.is_blocked(r.user_id) and (
                r.visibility = 'public'
             or (r.visibility = 'friends' and public.is_friend(auth.uid(), r.user_id))
             or exists (select 1 from public.friend_posts fp
                        where fp.record_id = r.id and public.can_see_post(fp.user_id, fp.audience))
             or exists (select 1 from public.board_posts bp where bp.record_id = r.id and bp.hidden_at is null and not public.is_blocked(bp.author_id))
             or exists (select 1 from public.board_post_records pr join public.board_posts bp on bp.id = pr.post_id
                        where pr.record_id = r.id and bp.hidden_at is null and not public.is_blocked(bp.author_id))
             or exists (select 1 from public.board_comments bc where bc.record_id = r.id and bc.hidden_at is null and not public.is_blocked(bc.author_id))
             or exists (select 1 from public.board_answers ba where ba.record_id = r.id and not public.is_blocked(ba.author_id))
          ))
        )
    )
  );
$$;

revoke execute on function public.create_board_post(text, text, text, text[], bigint, jsonb, bigint, jsonb, text, boolean, text[]) from public, anon;
grant execute on function public.create_board_post(text, text, text, text[], bigint, jsonb, bigint, jsonb, text, boolean, text[]) to authenticated;
