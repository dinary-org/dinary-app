-- 내가 쓴 댓글 고치기 — 친구 소식(record_comments) · 게시판(board_comments) · 갤러리(gallery_comments).
-- 지우기는 이미 각 표의 delete 정책(작성자만)으로 됩니다. 고치기는 쓸 때와 같은 검사(빈 글 · 글자 수 · 연락처 · 정지)를 거치는 함수로만 엽니다.
-- 운영자가 숨긴 댓글은 고칠 수 없습니다(숨긴 내용을 바꿔 다시 보이게 하는 것을 막음).

create or replace function public.edit_record_comment(p_id bigint, p_body text)
returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  uid    uuid := auth.uid();
  v_body text := trim(coalesce(p_body, ''));
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if length(v_body) = 0 then raise exception 'empty'; end if;
  if length(v_body) > 120 then raise exception 'too_long'; end if;
  if public.has_contact(v_body) then raise exception 'no_contact'; end if;
  update public.record_comments set body = v_body where id = p_id and user_id = uid;
  if not found then raise exception 'not_mine'; end if;
end $$;

create or replace function public.edit_board_comment(p_id bigint, p_body text)
returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  uid    uuid := auth.uid();
  v_body text := trim(coalesce(p_body, ''));
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if public.is_sanctioned(uid) then raise exception 'sanctioned'; end if;
  if length(v_body) = 0 then raise exception 'empty'; end if;
  if length(v_body) > 500 then raise exception 'too_long'; end if;
  if public.has_contact(v_body) then raise exception 'no_contact'; end if;
  update public.board_comments set body = v_body where id = p_id and author_id = uid and hidden_at is null;
  if not found then raise exception 'not_mine'; end if;
end $$;

create or replace function public.edit_gallery_comment(p_id bigint, p_body text)
returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  uid    uuid := auth.uid();
  v_body text := trim(coalesce(p_body, ''));
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if public.is_sanctioned(uid) then raise exception 'sanctioned'; end if;
  if length(v_body) = 0 then raise exception 'empty'; end if;
  if length(v_body) > 500 then raise exception 'too_long'; end if;
  if public.has_contact(v_body) then raise exception 'no_contact'; end if;
  update public.gallery_comments set body = v_body where id = p_id and author_id = uid and hidden_at is null;
  if not found then raise exception 'not_mine'; end if;
end $$;

revoke execute on function public.edit_record_comment(bigint, text) from public, anon;
revoke execute on function public.edit_board_comment(bigint, text) from public, anon;
revoke execute on function public.edit_gallery_comment(bigint, text) from public, anon;
grant execute on function public.edit_record_comment(bigint, text) to authenticated;
grant execute on function public.edit_board_comment(bigint, text) to authenticated;
grant execute on function public.edit_gallery_comment(bigint, text) to authenticated;
