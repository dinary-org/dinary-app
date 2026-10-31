/**
 * 카카오 음식점 그룹(FD6)에 든 디저트 가게 — 「음식점 > 간식 > 아이스크림」(배스킨라빈스 · 젤라또),
 * 「음식점 > 간식 > 제과,베이커리」, 「음식점 > 카페」 같은 곳은 앱에서 카페로 봅니다.
 * 추천의 NOT_A_MEAL(src/lib/rec/categories.ts)과 같은 둘째 칸 기준에, 이름 보조 규칙을 더했습니다.
 */
const SWEET_TOP = /^(간식|카페|제과|아이스크림|디저트)/;
const SWEET_NAME = /배스킨|젤라또|젤라토|젤라떼리아|젤라테리아|아이스크림|빙수/;

/** 카페로 옮길 가게면 앱 종류(베이커리 · 커피 · 디저트), 아니면 null. category_group_code 가 FD6 일 때만 부르세요. */
export function sweetCategory(categoryName: string | undefined, placeName = ""): "베이커리" | "커피" | "디저트" | null {
  const parts = (categoryName ?? "").split(">").map((v) => v.trim());
  if (!SWEET_TOP.test(parts[1] ?? "") && !SWEET_NAME.test(placeName)) return null;
  const rest = parts.slice(1).join(" ");
  if (/제과|베이커리|빵|도넛/.test(rest)) return "베이커리";
  if (parts[1]?.startsWith("카페") && !/디저트|아이스크림|빙수/.test(rest)) return "커피";
  return "디저트";
}
