import { sweetCategory } from "./food-kind.ts";

function eq(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) throw new Error(`${label}: ${String(actual)} !== ${String(expected)}`);
}

Deno.test("음식점 그룹의 간식 · 카페는 카페 종류로, 식사는 그대로", () => {
  eq(sweetCategory("음식점 > 간식 > 아이스크림 > 배스킨라빈스", "배스킨라빈스 합정점"), "디저트", "배스킨라빈스");
  eq(sweetCategory("음식점 > 간식 > 아이스크림", "젤라떼리아"), "디저트", "아이스크림");
  eq(sweetCategory("음식점 > 간식 > 제과,베이커리", "동네빵집"), "베이커리", "베이커리");
  eq(sweetCategory("음식점 > 간식 > 도넛 > 던킨", "던킨 홍대점"), "베이커리", "도넛");
  eq(sweetCategory("음식점 > 간식 > 떡,한과", "떡집"), "디저트", "떡");
  eq(sweetCategory("음식점 > 카페 > 커피전문점", "어느카페"), "커피", "카페");
  eq(sweetCategory("음식점 > 양식 > 이탈리안", "젤라또 공방"), "디저트", "이름 보조");
  eq(sweetCategory("음식점 > 한식 > 냉면", "평양면옥"), null, "냉면");
  eq(sweetCategory("음식점 > 분식", "떡볶이집"), null, "분식");
  eq(sweetCategory("음식점 > 술집 > 호프,요리주점", "맥주집"), null, "술집");
});
