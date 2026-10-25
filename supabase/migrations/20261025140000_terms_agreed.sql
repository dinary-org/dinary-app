-- 약관 동의 — 첫 로그인 직후(기존 이용자는 다음 실행 때) 이용약관 · 개인정보 처리방침에 동의한 시각.
-- 비어 있으면 앱이 동의 화면을 띄웁니다. 시각은 기기 시계가 아니라 서버 now() 로만 채웁니다(함수로만).
alter table public.profiles add column if not exists terms_agreed_at timestamptz;

-- profiles 행이 없는 계정도 있어(웰컴 화면의 upsert 참고) insert … on conflict. 이미 동의했으면 처음 시각을 지킵니다.
create or replace function public.agree_terms() returns timestamptz
language plpgsql security definer set search_path = public as $$
declare v_at timestamptz;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다'; end if;
  insert into public.profiles (id, terms_agreed_at) values (auth.uid(), now())
  on conflict (id) do update set terms_agreed_at = coalesce(public.profiles.terms_agreed_at, now())
  returning terms_agreed_at into v_at;
  return v_at;
end;
$$;

revoke all on function public.agree_terms() from public, anon;
grant execute on function public.agree_terms() to authenticated;
