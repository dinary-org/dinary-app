-- 앱 전체 공지 푸시 — 올릴 때 「푸시로도 보내기」를 고르면 push-send(kind: notice)가 모든 기기에 한 번 보냅니다.
-- pushed_at 은 보낸 시각 — 함수가 null 일 때만 채우고 보내서, 같은 공지가 두 번 나가지 않습니다.
alter table public.app_notices add column if not exists pushed_at timestamptz;
