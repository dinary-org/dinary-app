-- 내 글에는 좋아요(cheer)를 못 누릅니다 — 앱은 내 글의 하트를 수만 보여 주고, 서버도 막습니다.
-- 위시에 담기(want)는 내 글이어도 그대로. 내 글은 글쓴이가 언제나 읽을 수 있어 아래 exists 가 그대로 맞습니다.
drop policy if exists "reactions write" on public.board_reactions;
create policy "reactions write" on public.board_reactions for insert to authenticated
  with check (
    auth.uid() = user_id
    and (kind <> 'cheer' or not exists (select 1 from public.board_posts p where p.id = post_id and p.author_id = auth.uid()))
  );
