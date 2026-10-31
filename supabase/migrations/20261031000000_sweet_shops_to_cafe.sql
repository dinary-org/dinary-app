-- 아이스크림 · 빵 · 도넛 가게를 카페로 — 카카오가 「음식점 > 간식 > …」(음식점 그룹 FD6)으로 두는 곳이라
-- 지금까지 맛집으로 저장됐습니다. 앞으로는 geocode · places-at 이 카페로 돌려줍니다(_shared/food-kind.ts).
-- 이미 쌓인 기록 · 위시는 이름으로만 고를 수 있어서, 헷갈리지 않는 이름만 옮깁니다.
-- 「빵」 · 「떡」은 빵빵치킨 · 떡볶이 같은 식당에도 걸려서 뺐습니다 — 남은 곳은 기록 고치기에서 직접 바꿀 수 있습니다.
--
-- 적용 전에 고를 곳을 보려면:
--   select id, name, kind, category from public.restaurants
--   where kind = 'restaurant' and name ~* '(배스킨|베스킨|젤라또|젤라토|젤라떼리아|젤라테리아|아이스크림|빙수|파리바게|뚜레쥬르|던킨|크리스피\s*크림|베이커리|제과|도넛|와플)';

update public.restaurants
set kind = 'cafe',
    category = case when name ~* '(파리바게|뚜레쥬르|던킨|크리스피\s*크림|베이커리|제과|도넛)' then '베이커리' else '디저트' end
where kind = 'restaurant'
  and name ~* '(배스킨|베스킨|젤라또|젤라토|젤라떼리아|젤라테리아|아이스크림|빙수|파리바게|뚜레쥬르|던킨|크리스피\s*크림|베이커리|제과|도넛|와플)';

-- 위시는 kind 칸이 없고 종류(category)가 카페 어휘면 카페로 봅니다(src/lib/types.ts wishKind).
update public.wishes
set category = case when name ~* '(파리바게|뚜레쥬르|던킨|크리스피\s*크림|베이커리|제과|도넛)' then '베이커리' else '디저트' end
where coalesce(category, '') not in ('커피', '디저트', '베이커리', '차')
  and name ~* '(배스킨|베스킨|젤라또|젤라토|젤라떼리아|젤라테리아|아이스크림|빙수|파리바게|뚜레쥬르|던킨|크리스피\s*크림|베이커리|제과|도넛|와플)';
