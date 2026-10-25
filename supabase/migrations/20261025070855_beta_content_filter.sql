-- Server-enforced text filtering supplements reporting, blocking and human photo review.
-- It applies to direct Data API writes as well as SECURITY DEFINER posting RPCs.
create or replace function public.contains_objectionable_text(value text)
returns boolean language sql immutable set search_path = '' as $$
  select regexp_replace(lower(coalesce(value, '')), '[[:space:][:punct:]]', '', 'g')
           ~ '(씨발|씨빨|시발놈|개새끼|병신|아동포르노|미성년자성매매)'
      or lower(coalesce(value, '')) ~ '\m(fuck|fucking|motherfucker|nigger)\M';
$$;
revoke all on function public.contains_objectionable_text(text) from public, anon;
grant execute on function public.contains_objectionable_text(text) to authenticated;

create or replace function public.guard_community_text()
returns trigger language plpgsql set search_path = '' as $$
declare
  field text;
  incoming jsonb := to_jsonb(new);
begin
  foreach field in array tg_argv loop
    if tg_op = 'UPDATE' and incoming->field is not distinct from to_jsonb(old)->field then
      continue;
    end if;
    if public.contains_objectionable_text(incoming->>field) then
      raise exception '게시할 수 없는 표현이 포함되어 있습니다. 내용을 수정해 주세요.' using errcode = '23514';
    end if;
  end loop;
  return new;
end;
$$;
revoke all on function public.guard_community_text() from public, anon, authenticated;

create trigger beta_filter_board_posts before insert or update on public.board_posts
  for each row execute function public.guard_community_text('title', 'body', 'note', 'tags');
create trigger beta_filter_board_comments before insert or update on public.board_comments
  for each row execute function public.guard_community_text('body');
create trigger beta_filter_gallery before insert or update on public.gallery_photos
  for each row execute function public.guard_community_text('caption', 'menu');
create trigger beta_filter_gallery_comments before insert or update on public.gallery_comments
  for each row execute function public.guard_community_text('body');
create trigger beta_filter_friend_posts before insert or update on public.friend_posts
  for each row execute function public.guard_community_text('note');
create trigger beta_filter_record_comments before insert or update on public.record_comments
  for each row execute function public.guard_community_text('body');
create trigger beta_filter_profiles before insert or update on public.profiles
  for each row execute function public.guard_community_text('nickname');
