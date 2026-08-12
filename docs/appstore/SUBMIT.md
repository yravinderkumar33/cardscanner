# Submitting CardScanner to the App Store

This is the runbook. Everything that could be prepared without your Apple credentials
has been prepared; the steps that need you are marked **YOU**.

Read `review-notes.md` before you submit — it contains the paste-ready "Notes for Review"
and the rejection-risk register.

---

## What is already done

| Item | State |
|---|---|
| App icon (1024×1024, no alpha, no transparency) | Done — `assets/icon.png`, baked into `ios/.../AppIcon.appiconset` |
| Splash mark | Done — `assets/splash-icon.png` on `#161826` |
| Version / build number | `1.0.0` / `1` in `app.json` |
| Export-compliance declaration | `ITSAppUsesNonExemptEncryption: false` — present in the built `Info.plist` |
| Permission purpose strings (camera, photos) | Written for App Review, in `app.json` |
| Contacts permission | **Not requested at all** — saving goes through Apple's own New Contact form, which needs no authorization (verified at runtime with access revoked). The usage string stays in `app.json` defensively; it is never shown. |
| iPhone-only, portrait, iOS 17.0 minimum | Set |
| Release build compiles for device | Verified — `xcodebuild archive` succeeded |
| EAS build + submit profiles | `eas.json`, team `Z7UCX6HB7G` |
| Listing copy (name, subtitle, description, keywords, category, age rating, What's New) | `listing.md` |
| Privacy policy | `privacy-policy.md` + **live** at https://yravinderkumar33.github.io/cardscanner/privacy.html |
| Support page | **live** at https://yravinderkumar33.github.io/cardscanner/ |
| Public repo | https://github.com/yravinderkumar33/cardscanner |
| App Privacy questionnaire answers | `app-privacy-answers.md` |
| Notes for Review + risk register | `review-notes.md` |
| Screenshots (6.9") | **Done** — six captioned frames at 1320×2868 in `docs/appstore/screenshots/` |

---

## Blockers only you can clear

1. ~~Pick the app name~~ — **chosen: `CardScanner: Card to Contact`** (28 of 30 characters).
   Enter that as the App Store Connect *App Name*. The Home Screen name stays `CardScanner`
   via `app.json`; see `listing.md §1` for why the two differ. Worth one App Store search
   for the exact string before you commit — the name is hard to change after release.
2. ~~Fill the placeholders~~ — **done.** The live pages carry the real contact address
   (`yravinderkumar33@gmail.com`) and effective date (12 August 2026). Both URLs return
   200 and are safe to paste into App Store Connect.
4. **YOU — Apple authentication.** Everything below needs either your Apple ID with 2FA
   or an App Store Connect API key. Nothing in this repo holds Apple credentials, and
   nothing should.

---

## The submission itself

You are already signed in to EAS (`yravinderkumar33`) and the Apple team is `Z7UCX6HB7G`,
so the cloud path is the short one.

### 1. Create the App Store Connect record — **YOU**

Either let EAS create it during the first submit, or do it by hand at
appstoreconnect.apple.com → Apps → **+** with:

- Platform: iOS
- Name: `CardScanner: Card to Contact`
- Primary language: English (U.S.)
- Bundle ID: `com.ravinderkumar.cardscanner` (register it under the team first if it does
  not exist yet)
- SKU: anything unique, e.g. `cardscanner-001`

### 2. Link the EAS project — **YOU** (one time)

```bash
npx eas init
```

This creates the project under your Expo account (`yravinderkumar33`) and writes
`extra.eas.projectId` into `app.json`. It was deliberately **not** run for you — it creates a
resource in your account, and the choice of account/owner is yours. Nothing else works until
it is done: `eas build`, `eas submit` and even `eas config` all fail with
"EAS project not configured" without it.

### 3. Build the production binary

```bash
npx eas build --platform ios --profile production
```

EAS will generate the distribution certificate and provisioning profile in the cloud on
first run — it will prompt for your Apple ID (2FA) or an API key. `autoIncrement` is on,
so the build number rises by itself on every subsequent build.

Prefer to build locally instead? The archive already succeeds; you would need a
Distribution certificate installed (only an *Apple Development* one is on this Mac today),
then Xcode → Product → Archive → Distribute App.

### 4. Upload to App Store Connect

```bash
npx eas submit --platform ios --profile production --latest
```

### 5. Fill the listing — **YOU**

Paste from `listing.md`: name, subtitle, promotional text, description, keywords,
category, age rating, copyright, "What's New". The two URL fields are:

- **Support URL** — `https://yravinderkumar33.github.io/cardscanner/`
- **Privacy Policy URL** — `https://yravinderkumar33.github.io/cardscanner/privacy.html`
Upload `docs/appstore/screenshots/` to the 6.9" iPhone slot.
Answer **App Privacy** using `app-privacy-answers.md` — that file is the single authority;
where any other document disagrees, it wins.
Paste the **Notes for Review** block from `review-notes.md`.

### 6. Submit for review — **YOU**

Test the build through TestFlight on a real iPhone first. Two things genuinely cannot be
verified on a simulator, and both are on the critical path:

- **Haptics** — no simulator hardware.
- **The live camera** — a simulator has no camera, so every scan tested so far went
  through the Photos-import path. Photograph a real card before you ship.

Also let the first launch download run to completion on a real device over cellular *and*
Wi-Fi at least once; ~530 MB is the single biggest review risk (see R1 in the risk
register).

---

## Honest assessment before you press submit

This app is genuinely functional and, unusually for an AI app, its privacy claims are
true and now precisely worded. The parts most likely to cost you a review cycle:

1. **The 530 MB first-launch download.** A reviewer who does not read the notes may
   conclude the app is broken while it downloads. The Notes for Review address this
   head-on; that text matters more than usual.
2. **The name.** Generic and probably contested.
3. **The privacy label.** It must say the app collects Usage Data (Product Interaction,
   not linked, not tracking) because of the AI library's download counter — even though
   nothing about the user or their cards is ever sent. Declaring "no data collected"
   would be false and is exactly the kind of mismatch that triggers 5.1.1 rejections.
