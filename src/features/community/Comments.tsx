import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { showDialog } from "@/components/Dialog";
import { Text } from "@/components/Text";
import { BottomSheetModal } from "@/components/ui";
import { useAccount } from "@/data/profile";
import { C, F } from "@/theme";
import { addComment, deleteComment, editComment, useComments, type Comment } from "./api";
import { Avatar, K, timeAgo } from "./ui";

/** 친구 소식 카드의 댓글 — 한 줄 120자, 링크 · 연락처는 넣을 수 없습니다. 내 댓글엔 「수정 · 삭제」 — 고치기는 아래 입력칸에서. */
export default function CommentsSheet({ recordId, onClose }: { recordId: number | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: comments = [] } = useComments(recordId);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: account } = useAccount();
  const [editing, setEditing] = useState<Comment | null>(null);
  const inputRef = useRef<TextInput>(null);

  const startEdit = (c: Comment) => { setEditing(c); setText(c.body); setError(""); inputRef.current?.focus(); };
  const stopEdit = () => { setEditing(null); setText(""); setError(""); };
  const close = () => { stopEdit(); onClose(); };

  function remove(c: Comment) {
    showDialog("댓글을 삭제할까요?", undefined, [
      { text: "취소", style: "cancel" },
      {
        text: "삭제", style: "destructive",
        onPress: async () => {
          try {
            await deleteComment(qc, c.record_id, c.id);
            if (editing?.id === c.id) stopEdit();
          } catch (e) {
            showDialog("잠시 뒤 다시 해 주세요", e instanceof Error ? e.message : "");
          }
        },
      },
    ]);
  }

  async function send() {
    if (!recordId || !text.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      if (editing) {
        await editComment(qc, recordId, editing.id, text);
        setEditing(null);
      } else {
        await addComment(qc, recordId, text);
      }
      setText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "댓글을 남기지 못했습니다");
    }
    setBusy(false);
  }

  return (
    <BottomSheetModal visible={recordId != null} onClose={close}>
      <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 1.6, color: C.faint }}>댓글 {comments.length}</Text>
      <ScrollView style={{ flexShrink: 1, maxHeight: 320, marginTop: 10 }} contentContainerStyle={{ gap: 12 }}>
        {comments.length === 0 && <Text style={{ paddingVertical: 20, textAlign: "center", fontFamily: F.sans, fontSize: 12, color: C.faint }}>아직 댓글이 없습니다.</Text>}
        {comments.map((c) => (
          <View key={c.id} style={{ flexDirection: "row", gap: 9 }}>
            <Avatar name={c.nickname ?? ""} url={c.avatar_url} size={26} seed={c.user_id} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={{ fontFamily: F.sansMd, fontSize: 12, color: C.ink }}>{c.nickname}</Text>
                <Text style={{ fontFamily: F.mono, fontSize: 10, color: K.inactive }}>{timeAgo(c.created_at)}</Text>
                {c.user_id === account?.userId && (
                  <View style={{ marginLeft: "auto", flexDirection: "row", gap: 10 }}>
                    <Pressable onPress={() => startEdit(c)} hitSlop={8} accessibilityLabel="댓글 수정">
                      <Text style={{ fontFamily: F.sans, fontSize: 11, color: editing?.id === c.id ? C.brick : C.faint }}>수정</Text>
                    </Pressable>
                    <Pressable onPress={() => remove(c)} hitSlop={8} accessibilityLabel="댓글 삭제">
                      <Text style={{ fontFamily: F.sans, fontSize: 11, color: C.faint }}>삭제</Text>
                    </Pressable>
                  </View>
                )}
              </View>
              <Text style={{ marginTop: 2, fontFamily: F.sans, fontSize: 12.5, lineHeight: 19, color: K.text2 }}>{c.body}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
      {editing && (
        <Pressable onPress={stopEdit} accessibilityLabel="수정 그만두기" style={{ marginTop: 12, alignSelf: "flex-start", borderRadius: 12, backgroundColor: C.brickSoft, paddingHorizontal: 9, paddingVertical: 3 }}>
          <Text style={{ fontFamily: F.sans, fontSize: 11, color: C.brick }}>댓글 수정 중 ✕</Text>
        </Pressable>
      )}
      <View style={{ marginTop: editing ? 8 : 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <TextInput
          ref={inputRef}
          value={text}
          onChangeText={(t) => setText(t.slice(0, 120))}
          placeholder="한 줄 남기기"
          placeholderTextColor={K.inactive}
          style={{ flex: 1, minHeight: 44, borderRadius: 14, borderWidth: 1, borderColor: C.lineSoft, backgroundColor: C.card, paddingHorizontal: 14, fontFamily: F.sans, fontSize: 13, color: C.ink }}
          onSubmitEditing={send}
          returnKeyType="send"
        />
        <Pressable onPress={send} disabled={!text.trim() || busy} style={{ minHeight: 44, borderRadius: 14, backgroundColor: C.ink, paddingHorizontal: 14, justifyContent: "center", opacity: !text.trim() || busy ? 0.4 : 1 }}>
          <Text style={{ fontFamily: F.sansMd, fontSize: 12.5, color: C.card }}>{editing ? "수정" : "남기기"}</Text>
        </Pressable>
      </View>
      <Text style={{ marginTop: 6, fontFamily: F.mono, fontSize: 10, color: K.inactive, textAlign: "right" }}>{text.length} / 120</Text>
      {!!error && <Text style={{ marginTop: 4, fontFamily: F.sans, fontSize: 11.5, color: C.brick }}>{error}</Text>}
    </BottomSheetModal>
  );
}
