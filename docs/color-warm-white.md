# 색 기록: 「조금 따뜻한 흰색」 바탕 (보관용)

2026-10-25 에 바탕을 아이보리 → 흰색(3a, `af022db`) → 조금 따뜻한 흰색(`0332b49`)으로 바꿨다가,
같은 날 원래 아이보리로 되돌렸습니다. 나중에 다시 쓸 수 있게 마지막 톤을 남겨 둡니다.

## 되살리는 법

아이보리로 되돌린 커밋을 다시 되돌리면 두 커밋이 그대로 돌아옵니다(이 문서는 따로 커밋해서 남습니다).

```
git log --oneline --grep "원래 아이보리로 되돌리기"   # 되돌린 커밋 찾기
git revert <그 커밋>
```

두 커밋이 한 일: 화면마다 박아 둔 따뜻한 회백색을 `C` 토큰(아래 새 키)으로 모으고,
`rgba(251,250,246,…)` 오버레이를 `rgba(255,255,255,…)` 로, `app.json` 바탕 · 안드로이드 위젯 색도 바꿨습니다.

## 톤 (`src/theme/index.ts` 의 `C`)

각 값은 흰색(3a) 값을 원래 아이보리 쪽으로 40% 되돌린 것입니다.

| 키 | 원래 아이보리 | 흰색 3a | 조금 따뜻한 흰색 (마지막) |
|---|---|---|---|
| paper | `#f6f3ec` | `#ffffff` | `#fbfaf7` |
| card | `#fbfaf6` | `#ffffff` | `#fdfdfb` |
| brickSoft | `#f7ece5` | `#f8ede7` | `#f8ede6` |
| line | `#d8d3c8` | `#dfdcd7` | `#dcd8d1` |
| lineSoft | `#e2ddd2` | `#ece9e5` | `#e8e4dd` |
| map | `#e7e3d8` | `#efedea` | `#ece9e3` |
| mapGrid | `#dcd7c9` | `#e3e0db` | `#e0dcd4` |
| mapRoad | `#f1ede2` | `#fbfaf8` | `#f7f5ef` |
| mapPark | `#dfe4d6` | `#e3e8de` | `#e1e6db` |
| line2 (새 키) | `#ded8cb` | `#e3e0db` | `#e1ddd5` |
| lineStrong (새 키) | `#cfc8ba` | `#d1cdc6` | `#d0cbc1` |
| ghost (새 키) | `#c4bdb0` | `#c6c2bb` | `#c5c0b7` |
| dim (새 키) | `#a29a8c` | `#a29d95` | `#a29c91` |
| seg (새 키) | `#efebe2` | `#f3f1ee` | `#f1efe9` |
| chip (새 키) | `#efe9dc` | `#f2efeb` | `#f1ede5` |
| brickLine (새 키) | `#e0c3b1` | `#e6c9b8` | `#e4c7b5` |

그대로 둔 것: `ink` · `brick` · `heart` · `muted` · `faint` · `dark` · 핀/카테고리 색 · `SHADOW`.

## 그 밖 (마지막 톤 기준)

- `app.json` `backgroundColor`: `#fbfaf7`
- `src/features/widget/android.tsx`: `paper #fbfaf7`, `line #e8e4dd`, `dayPast #e8e4dd`, `dayAhead #f1efea`, `faint #d4cfc6`
- 토큰으로 모은 인라인 색: `#e4dfd3` · `#e6e0d3` → `line2`, `#ece7dc` · `#ece6da` · `#efeae0` · 커뮤니티 `#ebe6db` → `lineSoft`,
  `#f3efe6` → `seg`, 커뮤니티 `#f3ecdc` → `chip`, 점선 테두리 `#cdc6b8` · `#d6d0c4` → `lineStrong`, `#fdf9f3` → `card`
- 바꾸지 않은 것: 네이버 지도 타일(NCP 콘솔 커스텀 스타일), iOS 위젯(`targets/widget`), 어두운 배경 위 글씨색, `characters.ts` · `seasons.ts`
