# DINARY external beta readiness audit

Date: 2026-10-25. Updated after remediation: **source fixes implemented; backend deployment, store configuration and signed-device acceptance still required**.

## Remediation status

| Finding | Implemented change | Remaining external work |
| --- | --- | --- |
| Background location | Explicit cancellable disclosure; sequential permission checks; denied-state UI; settings-return resync | Google declaration/eligibility decision and device geofence test |
| Photo permissions | System picker, no thumbnail library scan, blocked broad media/microphone reads, scoped Android saves | Inspect final merged binary and test supported OS versions |
| Apple deletion | Fresh Apple confirmation; server exchange, signature/audience/subject verification, revocation before deletion | Configure Apple secrets; deploy function; real Apple-account test |
| External deletion | Public deletion-request page and app/privacy/site links | GitHub Pages publication and staffed request processing; Play URL field |
| Alert toggle | Permission before persistence, error handling and explicit sync | Device denial/settings tests |
| Notification taps | Validated targets/recipients, shared-book selection, consumed responses, read-on-open behavior | APNs/FCM and cold/warm launch tests |
| Deletion cleanup | Upload pause, duplicate guard, errors, local queue/photos/recommendation cleanup, expanded server photo references | Apply migration and exercise disposable production-like accounts |
| Moderation | Server text filtering across posts/comments/profiles; existing reporting/blocking/admin tools retained | Apply migration; staff photo/report moderation and verify RLS |
| Signing | Environment-driven Apple team ID; version/runtime bumped to 0.1.2 | Actual team ID, credentials, store builds and console forms |
| Completeness | Removed Kakao placeholder and production tutorial-debug overlay; avatar processing standardized; unavailable-record UI | Remaining device/accessibility matrix |

See [beta-release-operations.md](beta-release-operations.md) for deployment order, required secrets and tests. The findings below preserve the original audit evidence; they are not a claim that the remediated source is still unchanged.

This is a source/configuration audit with automated checks, not a certification or a completed device test. No Apple App Store Connect, Play Console, EAS signing configuration, or deployed database settings were inspected. No production users/data were changed. Approval belongs to Apple and Google.

## Verified and corrected

- `npm run check`: TypeScript passed; 74 tests passed; ESLint exited successfully with **165 warnings, zero errors**. Existing tests cover recommendation/reliability logic, not every UI control or native permission.
- Expo native configuration introspection succeeded before and after the fixes.
- Release JavaScript export completed for iOS and Android (`expo export --platform all`, artifacts in `/tmp/dinary-beta-export`). This does not compile or sign native binaries. The export began before the configuration edits; post-edit validation separately confirmed the native settings and TypeScript.
- Post-edit TypeScript passed; focused ESLint on `app/capture.tsx` reported zero errors and three existing warnings; `git diff --check` passed.
- Public privacy and terms URLs both returned HTTP 200 using curl:
  - https://dinary-org.github.io/dinary-app/privacy/
  - https://dinary-org.github.io/dinary-app/terms/
- Fixed `app.json`: enabled iOS location background mode. The installed `expo-location/ios/LocationModule.swift` explicitly checks that mode in `startGeofencingAsync`; the previous generated Info.plist only contained `fetch`.
- Fixed `app.json`: disabled microphone access in camera/image-picker plugins and restricted media-library permissions to photos. Introspection previously contained `RECORD_AUDIO`, `READ_MEDIA_AUDIO`, `READ_MEDIA_VIDEO`, and a generic English microphone purpose string. After correction those active Android permissions and the iOS microphone string are absent.
- Fixed `app/capture.tsx`: photo-library permission checks/requests explicitly use the photo scope, matching the plugin configuration.
- Unified photo-library purpose strings. Previously the media-library plugin overrode the app's fuller explanation with a thumbnail-only explanation.
- These native changes require a **new binary**; an OTA update alone is insufficient. Final merged release manifests still need inspection because introspection does not merge every native dependency.

## Original findings and rationale (see remediation status above)

### 1. Background location disclosure and eligibility — high review risk

Evidence: `src/features/notify/geofence.ts:44`, `app/wish/[id].tsx:49`, `app/wish/new.tsx:244`.

`askWishPermissions()` requests notifications, foreground location, and background location without first showing a prominent in-app disclosure with an affirmative choice. The Korean Info.plist purpose string and privacy webpage do not substitute for Google's in-app disclosure.

Add a dialog explaining that DINARY uses location even when closed/not in use to notify about saved restaurants nearby, that background processing is on-device, and that this is optional. Present it before location permission requests, provide cancel/continue, and explain the Android settings step. Stop requesting further permissions when a required permission is denied.

Google also evaluates whether background location is essential to the app's core purpose. An optional nearby-restaurant alert is a review risk, not guaranteed to qualify. Either justify it with the required declaration/demo video, or deliberately remove the feature and permission from the beta. This product decision was not made automatically.

Source: https://support.google.com/googleplay/android-developer/answer/9799150

### 2. Broad Android photo access remains — high review risk

Evidence: `app.json` still includes `READ_MEDIA_IMAGES`; `app/capture.tsx:133` reads the newest photo for a thumbnail. Most selection already uses the system image picker through `src/lib/photos.ts`.

Removing audio/video access does not resolve the photo policy. Evaluate removing broad image access too, replacing the camera's recent-photo thumbnail with a generic picker button, and keeping save-to-gallery compatible across supported Android versions. A custom thumbnail is not a strong justification for broad photo access. If retained, complete Google's declaration and substantiate why a system picker is insufficient.

Source: https://support.google.com/googleplay/android-developer/answer/14115180?hl=en-CA

### 3. Sign in with Apple authorization is not revoked on deletion — high review risk

Evidence: `app/login.tsx` uses the Apple identity token but does not exchange/store the authorization code for revocation. `supabase/functions/account-delete/index.ts` removes photo objects and the Supabase user; it does not call Apple's token revocation endpoint.

Implement server-side Apple authorization-code exchange and token revocation as part of deletion, with a reauthorization path for existing accounts if necessary. Never embed the Apple private key in the app. Verify the full flow with a disposable Apple account. Supabase account removal alone does not implement Apple revocation.

Source: https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple

### 4. External account-deletion request path missing from this site's pages

Evidence: `site/privacy/index.html` describes deletion inside the app and lists a general contact email; there is no clearly identified outside-app deletion request process/page in `site/`.

Publish a DINARY-branded web resource that lets users initiate deletion without reinstalling the app, explains identity verification and what is removed/retained, and provide its URL in Play Console. A clearly labeled support/email request process can be appropriate; an unexplained general contact email is insufficient evidence of a deletion pathway. A separately hosted existing process was not ruled out.

Source: https://support.google.com/googleplay/android-developer/answer/13327111?hl=en

### 5. Nearby-alert switch can claim success without permission or database success

Evidence: `app/wish/[id].tsx:49` writes `notify` before requesting permission, ignores the update error, and discards the permission result. The new-wish save path also persists `notify` before asking. Geofence sync in `app/_layout.tsx:155` depends on session/wishes, not permission completion.

A denied permission can leave the bell enabled despite no alerts. A successful permission request may not trigger geofence registration until another relevant update. Gate enabling on permission success, handle save errors, and explicitly resync after authorization/settings return. Keep turning alerts off available without additional permission requests.

### 6. Remote notification taps do not open partner records

Evidence: `supabase/functions/push-send/index.ts` sends `data: { recordId }`; `app/_layout.tsx:158` handles only `wishId` and `drafts`.

Add a validated record-ID route handler. Clear/consume handled responses to prevent repeated navigation when session state changes, and handle deleted/inaccessible records. Test cold launch, warm launch, and logged-out receipt.

The sender marks a poke `seen_at` once Expo accepts a push ticket. Acceptance is not proof of delivery or reading; this can suppress the in-app fallback even when delivery fails. Check receipts separately and mark read based on user interaction. Comment/friend remote push delivery is not implemented by the reviewed sender; distinguish in-app notifications from remote push in product claims.

### 7. Account deletion has incomplete local cleanup/error handling

Evidence: `app/(tabs)/account.tsx:148` calls `apiFetch` inside an async dialog callback without try/catch or a submission lock. Offline/network failure can reject without a user-facing error; repeated taps can duplicate work.

The deletion path does not purge the deleted user's SQLite pending records and document-folder photos (`src/features/queue/db.ts`). Owner scoping prevents ordinary cross-account listing, but retained files still need cleanup after confirmed deletion. Preserve another account's queue and do not erase uploads merely on ordinary logout.

Server photo cleanup uses storage ownership plus record/profile references. Migrated ownerless wish captures/board attachments are not included in the explicit reference scan (`supabase/migrations/20261021104425_account_photo_paths.sql`). Verify whether such objects actually exist before claiming a leak. Also test shared/copied photos, orphan uploads, partial failures, and user deletion after Apple revocation.

### 8. User-generated content protection needs an operational test

Good foundation: terms acceptance, report/block controls, admin hiding/sanctions, and a 24-hour report-review commitment exist. No proactive objectionable-content filtering mechanism was identified in the reviewed post/photo submission paths. Admin hiding after reports alone should not be assumed to satisfy all of Apple's filtering expectations.

Demonstrate filtering/moderation, reporting, blocking, and timely responses with two non-admin test accounts and an admin. Confirm controls for posts, comments, gallery photos, and friend posts. Validate deployed RLS and private storage; migration files do not prove the production database matches them. Confirm public contact information and complete the applicable social-app/child-safety declarations and age ratings in Play Console.

Source: https://developer.apple.com/app-store/review/guidelines/ (1.2)

### 9. Native release/signing still unverified

The apple-targets plugin warns that `ios.appleTeamId` is missing and iOS builds may fail. Confirm the real team ID and signing for the app, widget, and share extension, including `group.app.dinary`. Do not infer it from the bundle ID.

`eas.json` production is the store build profile. Preview is internal/ad-hoc distribution, not the appropriate artifact for TestFlight/Play upload. Confirm production environment variables, Apple/Google OAuth provider settings and `dinary://auth` redirect allowlist, NAVER package/bundle registrations, APNs key/provisioning, and FCM v1 server credentials. `google-services.json` alone does not verify push delivery.

Inspect the final AAB target SDK and native libraries (including 16 KB page compatibility), IPA SDK/toolchain, aggregated privacy manifests/required-reason APIs, release entitlements, version/build numbers, and extension signing. Local introspection's development APS value is not evidence that a release archive has the wrong entitlement.

Current published upload requirements checked during this audit: Google Play new apps/updates target API 36 or later; Apple uploads require Xcode 26 or later with the relevant 26 SDK or later. Verify against the actual uploaded artifact and any console-specific exemptions.

Sources:
- https://support.google.com/googleplay/android-developer/answer/11926878?hl=en-en
- https://developer.apple.com/news/upcoming-requirements/?id=02032026a

### 10. Smaller completeness/privacy issues

- `app/community/people.tsx:132` shows Kakao friend import as “준비 중”. Hide unfinished features for review or explain the beta limitation accurately.
- Friend invitation links use a custom app scheme. Test delivery in common messengers and provide separate installation instructions for testers without the app.
- The privacy policy says photos are resized to 900px; profile-photo upload calls `uploadPhoto` directly rather than `uploadAlbumPhoto`. Make processing consistent or narrow the policy claim. Verify EXIF handling with actual uploaded files.
- Existing 165 lint warnings include refs/render and effect/state warnings. They are not automatic rejection grounds, but automated success is not evidence that every screen works.

## Submission checklist outside this repository

Apple TestFlight:

- Use a store-signed build; complete processing and export compliance.
- Provide beta description, feedback email, review contact and precise review instructions. Give reviewers a working way through authentication and access to all relevant features; third-party login/OTP must not block them.
- Supply “What to Test,” create the external tester group, submit the first external build for Beta App Review, then invite testers after approval.
- Prepare privacy disclosures, support/privacy URLs, applicable age rating and content information accurately. Do not claim all production App Store metadata is necessarily a prerequisite for every TestFlight beta step.

Source: https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers

Google Play:

- Upload a signed AAB to the appropriate closed/open testing track; configure testers, countries and opt-in URL. Confirm developer identity/account setup and Play App Signing.
- Complete applicable App content declarations: Data safety, privacy policy, account deletion URL, app access, ads, target audience/content rating, and sensitive permissions. Disclosures must cover actual collected/transmitted data and SDK behavior, not just persistent storage.
- If the personal developer account was created after November 13, 2023, the 12 testers continuously opted in for 14 days requirement applies before applying for production access. It is not a prerequisite to starting that closed beta.

Sources:
- https://support.google.com/googleplay/android-developer/answer/9845334?hl=en
- https://support.google.com/googleplay/android-developer/answer/14151465?hl=en-PN

## Required physical-device acceptance matrix — not executed here

No adb or Xcode device tooling was available. Run on signed release builds on both iOS and Android, including Android 13+ and supported older versions:

| Flow | Required cases |
| --- | --- |
| Install/start | Fresh install, upgrade, relaunch, airplane mode, slow connection, expired session |
| Login/consent | Google; Apple on iOS; cancel/error; returning user; hidden email; terms links; nickname; logout/account switch |
| Camera/location | Allow/deny/permanently deny; approximate location; location services off; settings return; capture/retake/save; gallery cancel/limited access |
| Records | Create/edit/delete; extra photos; offline enqueue/retry; drafts; calendar/day/detail; export/share; duplicates after retry |
| Map/wishes | Search, map taps, link import/share extension, wish groups, enable/disable alerts, permissions denied, actual geofence entry in background |
| Notifications | Draft reminder, partner push; foreground/background/terminated; tap destination; permission revoke/re-enable; no previous-account notifications after logout |
| Community | Publish/edit/delete, gallery, comments/replies, report/block, admin moderation, friend accept/decline/remove; cross-user privacy |
| Couple | Invite/join, switch books, permissions, shared records, poke, unlink, account deletion with shared data |
| Other controls | Recommendations/games, labels/recap, tutorial, characters, ranking opt-out, widgets, native back navigation |
| Account deletion | Disposable Google and Apple users, offline/server failure, double tap, remote data/files removed, local queue purged, no stale-session access |
| Accessibility | VoiceOver/TalkBack, larger text, small-screen clipping, tap targets, modal/back dismissal |

Do not mark a row passed solely because a handler exists or TypeScript compiles. Capture results, build number, device/OS, and screenshots/video of failures. Run store pre-launch reports and inspect crash logs before expanding tester access.
