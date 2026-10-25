import type { QueryClient } from "@tanstack/react-query";
import { showDialog } from "@/components/Dialog";
import { cancelCoupleRequest, joinBook, type CoupleRequest } from "@/data/books";
import { dayCount } from "@/lib/anniversary";
import { dottedDate } from "@/lib/types";

const nameOf = (r: CoupleRequest) => r.inviter.nickname?.trim() || "상대";

/** 받은 연인 신청 「수락」 — 한 번 더 묻고 함께 쓰기 시작(지금 기록장이 연인 기록으로 바뀝니다). */
export function acceptCoupleRequest(qc: QueryClient, r: CoupleRequest, onDone?: () => void) {
  const since = r.started_on ? `${dottedDate(r.started_on)}부터 · D+${dayCount(r.started_on)}\n` : "";
  showDialog(`${nameOf(r)}님과 연인 기록을 함께 쓸까요?`, `${since}연인 기록장은 개인 기록과 따로 저장돼요. 내 개인 기록은 상대에게 보이지 않아요.`, [
    { text: "취소", style: "cancel" },
    {
      text: "함께 쓰기 시작",
      onPress: async () => {
        try {
          await joinBook(qc, r.code);
          onDone?.();
          showDialog("함께 쓰기 시작했어요", "지도의 기록장이 연인 기록으로 바뀌었어요.");
        } catch (e) {
          showDialog("함께 쓰기를 시작하지 못했어요", e instanceof Error ? e.message : undefined);
        }
      },
    },
  ]);
}

/** 받은 연인 신청 「거절」. */
export function declineCoupleRequest(qc: QueryClient, r: CoupleRequest) {
  showDialog(`${nameOf(r)}님의 신청을 거절할까요?`, undefined, [
    { text: "취소", style: "cancel" },
    {
      text: "거절",
      style: "destructive",
      onPress: async () => {
        try {
          await cancelCoupleRequest(qc, r.code);
        } catch (e) {
          showDialog("거절하지 못했어요", e instanceof Error ? e.message : undefined);
        }
      },
    },
  ]);
}
