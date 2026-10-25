-- 「하지만 빨랐죠?」 라벨(src/lib/labels.ts BETA). 베타 기간에 가입한 사람은 모두 받습니다.
-- 가입 때(프로필이 생길 때) beta_signup_open() 값이 beta_tester 에 들어가고, 이후엔 앱이 바꿀 수 없습니다.
-- 지금 있는 계정도 모두 받습니다.
--
-- 베타 모집을 끝낼 때는 아래 한 줄만 돌리면 됩니다(이미 받은 사람은 그대로):
--   create or replace function public.beta_signup_open() returns boolean language sql immutable as $$ select false $$;

create or replace function public.beta_signup_open() returns boolean
language sql immutable as $$ select true $$;

alter table public.profiles add column if not exists beta_tester boolean not null default false;
update public.profiles set beta_tester = true where beta_tester is false;

create or replace function public.guard_profile_beta() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.beta_tester := public.beta_signup_open();
  elsif auth.uid() is not null and new.beta_tester is distinct from old.beta_tester then
    raise exception 'beta_tester_locked';
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_profile_beta on public.profiles;
create trigger trg_guard_profile_beta
before insert or update on public.profiles
for each row execute function public.guard_profile_beta();
