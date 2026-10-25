-- 푸시 알림 — 기기마다 Expo 푸시 토큰 하나. 앱이 로그인 · 앞으로 올 때 등록하고, 로그아웃할 때 지웁니다.
-- 한 기기에서 계정을 바꾸면 같은 토큰이 새 계정으로 옮겨 갑니다(그래서 직접 쓰기 대신 함수로만).
-- 보내기는 Edge Function push-send(서비스 키)가 합니다.
create table if not exists public.push_tokens (
  token       text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  platform    text not null check (platform in ('ios', 'android')),
  updated_at  timestamptz not null default now()
);
create index if not exists push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

drop policy if exists "push_tokens read own" on public.push_tokens;
create policy "push_tokens read own" on public.push_tokens for select to authenticated
  using (user_id = auth.uid());

create or replace function public.register_push_token(p_token text, p_platform text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다'; end if;
  if p_token is null or length(p_token) > 200 or p_token !~ '^ExponentPushToken\[' then raise exception '토큰 형식이 아닙니다'; end if;
  insert into public.push_tokens (token, user_id, platform, updated_at)
  values (p_token, auth.uid(), p_platform, now())
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end;
$$;

create or replace function public.unregister_push_token(p_token text) returns void
language sql security definer set search_path = public as $$
  delete from public.push_tokens where token = p_token and user_id = auth.uid();
$$;

revoke all on function public.register_push_token(text, text) from public, anon;
revoke all on function public.unregister_push_token(text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;
