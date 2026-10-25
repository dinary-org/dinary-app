# Beta release operations

The source fixes do not configure store dashboards or deploy Supabase functions/migrations. Do these before distributing the new **0.1.2** native build. The app-version runtime was bumped so the main-branch OTA workflow cannot send the changed native-permission assumptions to 0.1.1 installations.

## Backend

1. Apply the new `beta_account_cleanup` and `beta_content_filter` migrations to the intended Supabase project. The photo cleanup query covers storage ownership, records, avatars, wish captures, board attachments and gallery references; it preserves files referenced by another user's records.
2. Set **server-only** Edge Function secrets: `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` (Sign in with Apple .p8 key), and `APPLE_CLIENT_ID=app.dinary`. Never use EXPO_PUBLIC variables for these secrets. The native client ID must match the Apple identifier for the authorization code.
3. Deploy `account-delete` including `_shared/apple-revoke.ts`, and `push-send`. The function validates the signed Apple subject against the authenticated Supabase identity before revoking. Missing credentials or failed revocation leaves the account intact and returns an error. Reauthorization at deletion also covers accounts created before this change, so no Apple refresh-token database is needed.
4. Test Apple cancellation, a different Apple account, expired/replayed codes, missing credentials, revocation failure, photo-removal failure and successful deletion with disposable users. Retry after partial server failures by signing in again. Test Google deletion separately.
5. Run database advisors and inspect deployed RLS/storage policies. Confirm filtered text is rejected through RPC and direct table writes, while normal Korean/English restaurant names remain accepted. The filter is a small baseline, not an image classifier or a substitute for human moderation.

## Apple / EAS

- Set `APPLE_TEAM_ID` in the EAS production environment; app.config.js uses it for iOS extension signing. Only the team ID belongs in the app configuration; keep the private key in Supabase secrets.
- Verify app/widget/share-extension provisioning, App Group, Apple provider, OAuth redirect, APNs and NAVER configuration.
- Build new store binaries with the production EAS profile. Check the signed IPA/AAB manifests and SDK requirements in the audit; OTA alone cannot change permissions.
- Complete beta review information, reviewer access and feedback contact in App Store Connect. Test the full device matrix from the audit.

## Google Play

- Broad photo/audio/video/microphone read access is blocked. Image selection uses the system picker; optional saving requests only write access where the OS needs it. Test save-to-gallery on older Android versions as well as Android 13+.
- Background location remains an intentional optional feature. The disclosure explains background use and requires affirmative consent before permission prompts. Existing installations with old permissions must also accept the versioned disclosure before geofences resume. Prepare the background-location declaration and a video showing disclosure → permission → actual alert; **Google alone decides whether this feature qualifies**. If not, remove both the permission and nearby-alert feature in a later build.
- Enter the published deletion URL: `https://dinary-org.github.io/dinary-app/delete-account/`.
- Complete Data safety/app access/content rating/target audience/social-app declarations based on the actual production behavior.

## Support and moderation

- Monitor `contact.dinary@gmail.com`. The public deletion page initiates an email request without requiring the app. Verify identity without asking for passwords/OTP/ID documents, delete through the same cleanup/revocation process, and reply with the result. Monitor requests through completion; publishing a mailto link does not perform deletion automatically.
- Review content reports within the 24-hour commitment in the terms. Test report/block/admin hide/sanction for all community surfaces, including photos, using separate non-admin and admin accounts. Review photos manually; text filtering cannot detect objectionable imagery.
- Confirm GitHub Pages published `/delete-account/`, privacy and terms after the push. No email is sent by this implementation until the user chooses to send one.

## Device checks that cannot be replaced by compilation

Check permission denial/permanent denial/settings return; foreground/background/killed notification taps; shared-book switching; deleted/inaccessible records; Apple deletion; offline/double-tap deletion; local queue cleanup; logout/account switching; picker cancellation; gallery saving; share extension; widgets; accessibility. Record the build number, phone/OS and result.

## Automated verification

- `npm run check`: TypeScript, app regression tests and lint.
- `npm run test:beta-db`: isolated PGlite PostgreSQL tests; no production database access.
- `npx deno test --node-modules-dir=none --allow-env supabase/functions/_shared/apple-revoke.test.ts`: mock Apple endpoints with real JWT signature verification. No real Apple account is revoked.
- `npx deno check --node-modules-dir=none supabase/functions/account-delete/index.ts`: Edge Function type check.
- `npx expo config --type introspect` and `npx expo export --platform all`: native configuration and release JavaScript checks; these do not compile native binaries.
