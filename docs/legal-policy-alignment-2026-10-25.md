# Legal-page alignment review — 2026-10-25

Reviewed app source on main at `93a8090` and connected Supabase project metadata/schema. Updated `site/privacy/`, `site/terms/` and `site/delete-account/` together so their statements agree. This review documents code and operational evidence; it does not certify legal compliance or store approval.

## Corrections

- Expanded privacy coverage: login identifiers/sessions, profile/terms acceptance, photos/visits/wishes, couple/friend/community interactions, personalized recommendation sessions/candidates/events, support/moderation records, technical provider data, local cache/queue and widget storage.
- Distinguished camera GPS from stored restaurant coordinates, visit timestamps/accuracy, and location-related request/cache data. Removed the implication that no location data is ever stored.
- Described system photo selection, optional add-only photo saving, and upload image processing without guaranteeing all originals/exports are EXIF-free.
- Described the full record details exposed by board/comment/course attachments. Distinguished friend-post note from the private record review. Did not claim selected-photo UI is a security boundary: the friend feed includes the record's photo reference list.
- Distinguished gallery-only exposure from a separate board attachment of the same record, and ranking opt-out from deletion of public profiles/posts.
- Added local draft/geofence notifications, remote partner push content, Expo/APNs/FCM processing, token removal failure/offline caveats, lock-screen visibility and widget data.
- Added external sharing/export limitations, YouTube device-side oEmbed, server-side blog/link previews and persistent cache semantics. A cache freshness TTL is not a deletion schedule.
- Added Expo EAS Update technical data and provider policy links. Confirmed main Supabase database region is `ap-northeast-2` (Seoul); did not equate that with every provider processing all data only in Korea.
- Distinguished logout, provider unlink, couple unlink, app uninstall, individual deletion and account deletion. Removed promises of unconditional immediate cleanup, complete exports and total deletion of third-party copies.
- Removed the unsupported implication that a partner can use DINARY's copy-to-personal feature to copy the other person's record: the RPC checks `src.user_id = auth.uid()`.
- Removed the blanket free-service liability exclusion. Added proportionate responsibility, reporting/appeal contact, and notice of important service/terms/privacy changes.

## Live deployment discrepancy — verified read-only

Supabase project: `dinary-app` (Seoul). No user content was queried.

`list_migrations` and a read-only schema query show:

- `public.contains_objectionable_text(text)` is **not installed**.
- Current `account_photo_paths(uuid)` does **not** scan `capture_path` or `photo_refs`.
- The repository's `beta_content_filter` and `beta_account_cleanup` migrations are not in deployed migration history.

Accordingly, public terms no longer claim all new text is proactively filtered. The pages describe reporting and human review and do not state that undeployed safeguards are already active. The previous beta deployment runbook remains applicable. Fixing legal copy does not fix incomplete deployed photo cleanup or deploy Apple revocation.

## Operator facts still requiring confirmation

Asked the owner for the legal/business operator name and actual support-mail/server-log retention periods. Do not invent these or publish sample names/durations as facts.

Before claiming the policy is complete for Korean legal requirements or store submission, confirm and fill in where applicable:

1. Actual operator/controller and privacy-responsible person's legal or business name and contact. Public pages currently identify “DINARY 운영자” and the existing support email.
2. Actual support/deletion-mail, security/moderation-log and backup retention periods, their deletion processes and any specific statutory retention basis. The source does not configure these periods. The pages describe purposes and limits rather than fabricate a 7/30/90-day schedule.
3. Provider contracts/subprocessors and actual cross-border countries, recipients, data items, timing/method, basis, retention and any required refusal/consent guidance. A Seoul project and links to vendor policies are not a complete country-by-country transfer disclosure.
4. Supported audience/regions and any children's consent process; the code does not verify age or parental consent. No unsupported age gate has been added to the public terms.
5. Staffing for the pre-existing 24-hour report review commitment and for manual email deletion requests. Confirm actual deployed deletion behavior with disposable accounts.
6. If new purposes or data processing require fresh consent, implement/version that process separately. Current `agree_terms()` stores an initial timestamp; editing the webpage does not record consent to a new policy version.

## Evidence

Repository:

- `app/capture.tsx`, `src/lib/photos.ts`, `src/lib/supabase.ts`, `src/data/profile.ts`
- `src/features/recommend/log.ts`, `src/lib/rec/snapshot.ts`
- `src/lib/widget.ts`, `src/features/notify/`, `supabase/functions/push-send/index.ts`
- `src/lib/sourceLink.ts`, `supabase/functions/link-meta/index.ts`
- `supabase/migrations/20261025233000_board_record_detail.sql`
- `supabase/migrations/20261016000200_friend_posts.sql`, `20261016000000_copy_couple_record.sql`
- `app/(tabs)/account.tsx`, `supabase/functions/account-delete/index.ts`

Current official guidance/provider notices consulted:

- Google Play User Data: https://support.google.com/googleplay/android-developer/answer/10144311?hl=en
- Apple App Review Guidelines, privacy: https://developer.apple.com/app-store/review/guidelines/
- Supabase privacy notice (distinguishes its own controller activity from customer-data processing): https://supabase.com/privacy
- Expo privacy notice (end-user push tokens and EAS Update OS/random tokens): https://expo.dev/privacy
- GitHub privacy statement: https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement

## Validation

Validate HTML structure, local links/anchors, UTF-8, page titles/language, shared contact details and dates. Serve the static site and check each legal route. No app behavior, schema, deployed function, existing users, or consent record is changed by these legal-page edits.
