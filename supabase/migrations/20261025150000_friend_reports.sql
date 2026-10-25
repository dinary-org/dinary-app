-- 친구 소식 · 그 댓글도 신고(이용약관 6조). 차단은 이미 friend_feed · record_comments 읽기에서 is_blocked 로 빠집니다.
-- 친구 소식과 댓글은 친구에게만 읽혀 운영자도 못 보므로, 신고함 미리보기와 내리기는 아래 함수로만.

alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('post', 'answer', 'comment', 'board_comment', 'gallery_photo', 'gallery_comment', 'friend_post', 'record_comment', 'user', 'tour'));

-- 신고함 미리보기 — 신고된 것만(아무 소식이나 엿보지 못하게).
create or replace function public.admin_report_preview(p_type text, p_id text)
returns table (title text, body text, author_id uuid, author_name text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  if not exists (select 1 from public.reports where target_type = p_type and target_id = p_id) then return; end if;
  if p_type = 'friend_post' then
    return query
      select '친구 소식 · ' || r.name, f.note::text, f.user_id, p.nickname
        from public.friend_posts f
        join public.restaurants r on r.id = f.record_id
        left join public.profiles p on p.id = f.user_id
       where f.id = p_id::bigint;
  elsif p_type = 'record_comment' then
    return query
      select '친구 소식 댓글'::text, c.body::text, c.user_id, p.nickname
        from public.record_comments c
        left join public.profiles p on p.id = c.user_id
       where c.id = p_id::bigint;
  end if;
end $$;

-- 내리기 — 소식만 지우고 기록(restaurants)은 그대로. 댓글은 지웁니다.
create or replace function public.admin_remove_friend_post(p_id bigint) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  delete from public.friend_posts where id = p_id;
  perform public.admin_log('remove_friend_post', 'friend_post', p_id::text);
end $$;

create or replace function public.admin_remove_record_comment(p_id bigint) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  delete from public.record_comments where id = p_id;
  perform public.admin_log('remove_record_comment', 'record_comment', p_id::text);
end $$;

revoke all on function public.admin_report_preview(text, text) from public, anon;
revoke all on function public.admin_remove_friend_post(bigint) from public, anon;
revoke all on function public.admin_remove_record_comment(bigint) from public, anon;
grant execute on function public.admin_report_preview(text, text) to authenticated;
grant execute on function public.admin_remove_friend_post(bigint) to authenticated;
grant execute on function public.admin_remove_record_comment(bigint) to authenticated;
