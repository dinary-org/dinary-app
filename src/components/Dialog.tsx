import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { Modal, Pressable, View, useWindowDimensions } from "react-native";
import { Text } from "@/components/Text";
import { C, F, SHADOW } from "@/theme";

/** Alert.alert 와 같은 모양의 단추 — style: cancel(테두리) · destructive(벽돌색) · 그 밖(먹색). */
export type DialogButton = { text?: string; style?: "default" | "cancel" | "destructive"; onPress?: () => void };

type Dialog = { id: number; title: string; message?: string; buttons: DialogButton[] };

/*
 * 앱 안 알림창 — 시스템 Alert(안드로이드 Material · iOS 회색 창) 대신 DINARY 모양으로.
 * showDialog(제목, 내용, 단추들) 은 Alert.alert 와 인자가 같습니다. 단추가 없으면 「확인」 하나. 여러 개가 겹치면 차례로.
 *
 * iOS 는 Modal 을 가장 가까운 화면 컨트롤러에서 띄워서, 시트(BottomSheetModal)가 떠 있으면 앱 뿌리에서는 못 띄웁니다.
 * 그래서 뿌리와 시트마다 <DialogHost /> 를 두고, 가장 나중에 붙은(가장 안쪽) 하나만 창을 그립니다.
 * 시트가 닫히며 그 안의 자리가 빠지면 잠깐(HOLD) 기다렸다 바깥 자리에서 — 내려가는 중인 시트 위로는 iOS 가 못 띄웁니다.
 */
const HOLD = 420;
let holdUntil = 0;
let state: { queue: Dialog[]; hosts: string[] } = { queue: [], hosts: [] };
let seq = 0;
const listeners = new Set<() => void>();
const set = (next: Partial<typeof state>) => { state = { ...state, ...next }; listeners.forEach((l) => l()); };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const getState = () => state;

export function showDialog(title: string, message?: string, buttons?: DialogButton[]) {
  const d = { id: ++seq, title, message: message || undefined, buttons: buttons?.length ? buttons : [{ text: "확인" }] };
  set({ queue: [...state.queue, d] });
}

export function DialogHost() {
  const hostId = useId();
  const { queue, hosts } = useSyncExternalStore(subscribe, getState);
  const { width } = useWindowDimensions();

  useEffect(() => {
    set({ hosts: [...state.hosts, hostId] });
    return () => {
      holdUntil = Date.now() + HOLD;
      set({ hosts: state.hosts.filter((h) => h !== hostId) });
    };
  }, [hostId]);

  const [, wake] = useState(0);
  // eslint-disable-next-line react-hooks/purity -- 기다릴 시간은 그릴 때마다 다시 잽니다(타이머가 끝나면 wake 로 다시 그림)
  const wait = holdUntil - Date.now();
  const next = hosts[hosts.length - 1] === hostId ? queue[0] : undefined;
  useEffect(() => {
    if (!next || wait <= 0) return;
    const t = setTimeout(() => wake((n) => n + 1), wait);
    return () => clearTimeout(t);
  }, [next, wait]);

  const shown = wait > 0 ? undefined : next;
  if (!shown) return null;

  const close = (b?: DialogButton) => {
    set({ queue: state.queue.filter((d) => d.id !== shown.id) });
    b?.onPress?.();
  };
  // 취소는 왼쪽(맨 앞) — 시스템 창과 같은 자리.
  const buttons = [...shown.buttons].sort((a, b) => Number(b.style === "cancel") - Number(a.style === "cancel"));
  const cancel = buttons.find((b) => b.style === "cancel") ?? (buttons.length === 1 ? buttons[0] : undefined);
  const stacked = buttons.length > 2;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => cancel && close(cancel)}>
      <Pressable onPress={() => cancel && close(cancel)} accessibilityLabel="닫기" style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(28,26,23,0.42)", paddingHorizontal: 24 }}>
        <Pressable key={shown.id} accessibilityRole="alert" style={[{ width: Math.min(320, width - 48), borderRadius: 24, backgroundColor: C.paper, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 16 }, SHADOW.big]}>
          <Text style={{ fontFamily: F.serif, fontSize: 17, lineHeight: 25, color: C.ink }}>{shown.title}</Text>
          {!!shown.message && <Text style={{ marginTop: 8, fontFamily: F.sans, fontSize: 13, lineHeight: 20, color: C.muted }}>{shown.message}</Text>}
          <View style={{ marginTop: 20, flexDirection: stacked ? "column" : "row", gap: 8 }}>
            {buttons.map((b, i) => <DialogAction key={`${b.text}-${i}`} b={b} stacked={stacked} onPress={() => close(b)} />)}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function DialogAction({ b, stacked, onPress }: { b: DialogButton; stacked: boolean; onPress: () => void }) {
  const isCancel = b.style === "cancel";
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flex: stacked ? undefined : 1, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center",
        backgroundColor: isCancel ? "transparent" : b.style === "destructive" ? C.brick : C.ink,
        borderWidth: isCancel ? 1 : 0, borderColor: C.line, opacity: pressed ? 0.75 : 1,
      })}
    >
      <Text style={{ fontFamily: F.sansMd, fontSize: 13.5, color: isCancel ? C.muted : C.card }}>{b.text ?? "확인"}</Text>
    </Pressable>
  );
}
