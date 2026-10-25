-- 게시판에 붙인 기록 상세 — 글 · 코스 · 댓글의 기록 카드를 누르면 내 기록 상세처럼 크게(메모 review 는 빼고).
-- 남의 기록은 restaurants 를 직접 못 읽어서, 게시판에 보이는 글 · 코스 · 댓글에 붙은 기록일 때만 보여도 되는 칸을 돌려줍니다.
-- 보이는 조건은 board_feed · board_course_rows · board_comment_rows 와 같습니다(차단한 사람 X, 숨긴 글 · 댓글은 관리자만).

create or replace function public.board_record_detail(p_record_id bigint) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', r.id, 'kind', r.kind, 'name', r.name, 'category', r.category, 'region', r.region, 'address', r.address,
    'rating', r.rating, 'menu', r.menu, 'menus', coalesce(to_jsonb(r.menus), '[]'::jsonb),
    'price_level', r.price_level, 'price_range', r.price_range,
    'visited_at', r.visited_at, 'keywords', coalesce(to_jsonb(r.keywords), '[]'::jsonb),
    'photo_urls', coalesce(to_jsonb(r.photo_urls), '[]'::jsonb), 'cover_index', r.cover_index, 'photo_url', r.photo_url,
    'verified', r.verified, 'verified_at', r.verified_at
  )
  from public.restaurants r
  where r.id = p_record_id
    and auth.uid() is not null
    and (
      r.user_id = auth.uid()
      or exists (select 1 from public.board_posts p
                 where p.record_id = r.id and not public.is_blocked(p.author_id) and (p.hidden_at is null or public.is_admin()))
      or exists (select 1 from public.board_post_records pr join public.board_posts p on p.id = pr.post_id
                 where pr.record_id = r.id and not public.is_blocked(p.author_id) and (p.hidden_at is null or public.is_admin()))
      or exists (select 1 from public.board_comments c
                 where c.record_id = r.id and not public.is_blocked(c.author_id) and (c.hidden_at is null or public.is_admin()))
    );
$$;

revoke execute on function public.board_record_detail(bigint) from public, anon;
grant execute on function public.board_record_detail(bigint) to authenticated;
