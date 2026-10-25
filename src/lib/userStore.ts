import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * 계정마다 따로 두는 기기 저장값(튜토리얼 본 기록 · 한 번만 묻는 창 …) — 탈퇴 뒤 새로 가입하거나 다른 계정으로 들어오면 다시 뜹니다.
 * 예전엔 기기에 하나만 두었습니다. 그 값은 이 기기에서 처음 읽는 계정이 물려받고 지웁니다(이미 본 사람에게 다시 띄우지 않게).
 */
export const userKey = (userId: string, key: string) => `${key}:${userId}`;

export async function getUserItem(userId: string, key: string): Promise<string | null> {
  const own = await AsyncStorage.getItem(userKey(userId, key));
  if (own != null) return own;
  const legacy = await AsyncStorage.getItem(key);
  if (legacy == null) return null;
  await AsyncStorage.setItem(userKey(userId, key), legacy);
  await AsyncStorage.removeItem(key);
  return legacy;
}

export const setUserItem = (userId: string, key: string, value: string) => AsyncStorage.setItem(userKey(userId, key), value);
