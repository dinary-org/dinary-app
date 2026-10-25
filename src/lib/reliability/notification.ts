/** Treat notification payloads as untrusted input; never navigate arbitrary URLs. */
export function notificationTarget(data: Record<string, unknown>, userId: string):
  | { kind: "record"; id: number }
  | { kind: "wish"; id: string }
  | { kind: "drafts" }
  | null {
  if (data.recipientId != null && data.recipientId !== userId) return null;
  if (typeof data.recordId === "number" && Number.isSafeInteger(data.recordId) && data.recordId > 0) return { kind: "record", id: data.recordId };
  if (typeof data.wishId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.wishId)) return { kind: "wish", id: data.wishId };
  if (data.drafts === true) return { kind: "drafts" };
  return null;
}
