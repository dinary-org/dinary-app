# Google Play — Background location declaration (DINARY)

Play Console → App content → Location permissions. Declared permissions: `ACCESS_BACKGROUND_LOCATION`, `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION`. Answers are in English for the policy reviewers. Each box allows 500 characters.

## App purpose (430 / 500)

```
DINARY is a personal restaurant diary. Users take a photo at a restaurant to record and verify their visit, then see their meals on a map and calendar. They can also save restaurants they want to visit in a wishlist, get nearby restaurant suggestions, and share records with a partner or friends. Location is used to find the restaurant the user is visiting, to show nearby places, and for optional alerts about saved restaurants.
```

## Location-based feature that needs background access (459 / 500)

```
Nearby alert for saved restaurants (optional, off by default). When the user turns it on for a wishlist restaurant, the app registers an on-device geofence (50 m, max 20 places) and shows a notification when the user comes near it, even when the app is closed or not in use. This needs background location because the user walks by with the app closed. Location is not sent to our server or stored. An in-app disclosure is shown before the permission request.
```

## Actual in-app flow (from `src/features/notify/geofence.ts`, `app/wish/[id].tsx`)

1. Wish detail screen → user taps the bell button next to 「여기 왔어요」 (the nearby-alert switch).
2. In-app prominent disclosure dialog, shown before any permission prompt:
   - Title: 「근처 알림을 켤까요?」 — *Turn on nearby alerts?*
   - Body: 「DINARY는 앱을 닫았거나 사용하지 않을 때도 위치를 사용하여 담아둔 가게 근처(50m)에 도착하면 알려드립니다. 백그라운드 위치는 기기 안에서만 확인하며 서버로 보내지 않습니다. 선택 기능이며 거절해도 기록과 지도는 계속 쓸 수 있습니다. 다음 위치 설정에서 '항상 허용'을 선택해 주세요.」
     — *DINARY uses your location even when the app is closed or not in use to notify you when you arrive near (50 m) a saved restaurant. Background location is checked only on the device and is not sent to the server. This is optional; if you decline, records and the map keep working. On the next location screen, choose "Allow all the time".*
   - Buttons: 「취소」 (Cancel) / 「계속」 (Continue)
3. Android notification permission → foreground location permission → background location ("Allow all the time" in the system location settings page). If any is denied, the app stops and explains how to enable it in settings.
4. Bell turns brick-red (alert on). A geofence is registered on the device.
5. Later, entering the 50 m radius with the app closed shows a notification:
   - 「{가게 이름}, 지금 앞에 계신가요?」 — *{Restaurant}, are you in front of it now?*
   - 「눌러서 사진을 찍으면 방문이 인증됩니다.」 — *Tap to take a photo and verify your visit.*
6. Tapping the notification opens the camera to verify the visit.

## Demo video checklist (30–60 s, YouTube unlisted)

- [ ] Wish detail → tap bell
- [ ] Disclosure dialog fully readable → tap 「계속」
- [ ] System permission prompts → "Allow all the time"
- [ ] Bell on
- [ ] App closed → notification appears near the restaurant
- [ ] Tap notification → camera opens

A real screen recording is strongest. Without a phone: Android Studio emulator + a preview APK (`eas build -p android --profile preview`), and set the location near the saved restaurant in Extended controls → Location to trigger the geofence.

## Prompt for Claude Design (walkthrough video from real screenshots)

Attach the real app screenshots (wish detail, disclosure dialog, bell on, notification, camera) before sending.

```
Make a 40–50 second vertical (1080×1920, 30fps) app walkthrough video for a Google Play background-location declaration. The app is DINARY, a Korean restaurant diary. Use ONLY the attached real app screenshots for app screens — do not redesign, restyle or invent UI. You may add a plain phone frame, a tap indicator (soft circle), simple transitions (crossfade/slide, 0.3s), and short English captions at the top of the frame. Keep everything honest: this is a walkthrough of real screens, not a fake live recording, so start with a title card: "DINARY — Nearby alert walkthrough (screens from the app)".

Scenes, in order:
1. (3s) Title card on ivory #f6f3ec, brick #b4552d text: "DINARY — Nearby alert for saved restaurants".
2. (5s) Wish detail screenshot. Tap indicator on the bell button next to 「여기 왔어요」. Caption: "User turns on the optional nearby alert for a saved restaurant."
3. (8s) Disclosure dialog screenshot 「근처 알림을 켤까요?」 — hold long enough to read; slowly zoom 110% on the body text. Caption: "Prominent disclosure before any permission request: location is used in the background, checked on-device, not sent to the server. Optional."
   Tap indicator on 「계속」.
4. (6s) Android permission screens (notification, location "While using the app", then location settings with "Allow all the time" selected). Use the attached screenshots if provided; if not, show a caption-only card: "Android asks for notification and location permissions, then the user selects 'Allow all the time'." Do not draw fake system dialogs.
5. (4s) Wish detail with the bell turned on (brick red). Caption: "Alert on. A 50 m geofence is registered on the device (max 20 places)."
6. (3s) Caption card: "Later — the app is closed. The user walks near the saved restaurant."
7. (6s) Notification screenshot: 「{restaurant}, 지금 앞에 계신가요?」 / 「눌러서 사진을 찍으면 방문이 인증됩니다.」 Caption: "Notification while the app is closed or not in use."
8. (5s) Tap the notification → camera screenshot. Caption: "Tapping opens the camera to verify the visit."
9. (4s) End card: "Background location is used only for this optional feature. It can be turned off in the app or in Android settings."

Style: calm, clean, no music needed (or very quiet), captions in Noto Sans 40–48px, white rounded caption box with 90% opacity, safe margins 64px. Export MP4 (H.264).
```

Note: Google expects the video to show the feature working in the real app. A screenshot walkthrough may be accepted, but if review asks for a real recording, record on a phone or emulator.
