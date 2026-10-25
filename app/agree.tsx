import { useQueryClient } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { BackHandler, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "@/components/Text";
import { CheckIcon } from "@/components/icons";
import { refreshAll } from "@/data/invalidate";
import { unregisterPushToken } from "@/features/notify/push";
import { supabase } from "@/lib/supabase";
import { PRIVACY_URL, TERMS_URL } from "@/lib/web";
import { C, F, SHADOW } from "@/theme";

/**
 * 약관 동의 — 첫 로그인 직후, 그리고 terms_agreed_at 이 빈 기존 계정은 다음 실행 때 한 번(Gate 가 보냄).
 * 둘 다 체크해야 시작할 수 있고, 동의하지 않고 나가면(「동의하지 않음」 · 안드로이드 뒤로가기) 로그아웃합니다.
 */
export default function Agree() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const ok = terms && privacy;

  async function leave() {
    await unregisterPushToken();
    await supabase.auth.signOut();
  }

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => { void leave(); return true; });
    return () => sub.remove();
  }, []);

  async function submit() {
    if (!ok || saving) return;
    setSaving(true);
    setError("");
    const { error: err } = await supabase.rpc("agree_terms");
    if (err) { setError("저장하지 못했습니다. 연결을 확인하고 다시 눌러 주세요."); setSaving(false); return; }
    // Gate 가 새 계정 정보를 받으면 닉네임(첫 로그인) 또는 홈으로 넘깁니다.
    await refreshAll(qc);
  }

  const item = (label: string, checked: boolean, toggle: () => void, url: string) => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, borderBottomWidth: 1, borderBottomColor: C.line }}>
      <Pressable onPress={toggle} accessibilityRole="checkbox" accessibilityState={{ checked }} hitSlop={6} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: checked ? C.brick : C.line, backgroundColor: checked ? C.brick : C.card, alignItems: "center", justifyContent: "center" }}>
          {checked && <CheckIcon size={13} stroke={C.card} />}
        </View>
        <Text style={{ flex: 1, fontFamily: F.sans, fontSize: 14, color: C.ink }}>{label}</Text>
      </Pressable>
      <Pressable onPress={() => WebBrowser.openBrowserAsync(url)} hitSlop={8} accessibilityRole="link">
        <Text style={{ fontFamily: F.sans, fontSize: 12.5, color: C.faint, textDecorationLine: "underline" }}>보기</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.paper, paddingHorizontal: 30, paddingTop: insets.top + 54, paddingBottom: insets.bottom + 20 }}>
      <Text style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: 1.8, color: C.faint }}>TERMS</Text>
      <Text style={{ marginTop: 12, fontFamily: F.serif, fontSize: 24, color: C.ink }}>시작하기 전에</Text>
      <Text style={{ marginTop: 10, fontFamily: F.sans, fontSize: 12.5, lineHeight: 22, color: C.faint }}>
        DINARY는 불쾌하거나 부적절한 글과 사진, 이를 올리는 이용자를 용납하지 않습니다. 아래 두 가지에 동의해야 이용할 수 있습니다.
      </Text>

      <View style={{ marginTop: 30, borderTopWidth: 1, borderTopColor: C.line }}>
        {item("이용약관에 동의합니다(필수)", terms, () => setTerms((v) => !v), TERMS_URL)}
        {item("개인정보 처리방침에 동의합니다(필수)", privacy, () => setPrivacy((v) => !v), PRIVACY_URL)}
      </View>
      {!!error && <Text style={{ marginTop: 12, fontFamily: F.sans, fontSize: 11.5, color: C.brick }}>{error}</Text>}

      <View style={{ flex: 1 }} />

      <Pressable
        onPress={submit} disabled={!ok || saving}
        style={[{ minHeight: 54, borderRadius: 16, backgroundColor: C.brick, alignItems: "center", justifyContent: "center", opacity: !ok || saving ? 0.6 : 1 }, SHADOW.card]}
      >
        <Text style={{ fontFamily: F.sansMd, fontSize: 15, color: C.card }}>{saving ? "저장하는 중…" : "동의하고 시작하기"}</Text>
      </Pressable>
      <Pressable onPress={() => void leave()} disabled={saving} hitSlop={6} style={{ marginTop: 14, alignSelf: "center", paddingVertical: 6 }}>
        <Text style={{ fontFamily: F.sans, fontSize: 12.5, color: C.faint }}>동의하지 않음 · 로그아웃</Text>
      </Pressable>
    </View>
  );
}
