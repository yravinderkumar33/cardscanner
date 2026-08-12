# Getting CardScanner into TestFlight

TestFlight comes before the App Store submission and uses the same binary. Do this first —
it is how you find out whether the things that could not be checked on a simulator actually
work.

Read this with `SUBMIT.md`; that file covers the store listing, this one covers the build.

---

## Already prepared

| Item | State |
|---|---|
| EAS project | Linked — `@yravinderkumar33/card-scanner` (`9be9e192-a820-4cd5-9afc-a0232629df8c`), written into `app.json` |
| Build profile | `eas.json` → `build.production`, store distribution, `autoIncrement` on |
| Submit profile | `eas.json` → `submit.production.ios`, team `Z7UCX6HB7G` |
| Version / build | `1.0.0` / `1` — EAS bumps the build number itself on each subsequent build |
| Export compliance | `ITSAppUsesNonExemptEncryption: false` in the built `Info.plist`, so TestFlight will not ask on every upload |
| Release build | Archives cleanly for device (`xcodebuild archive`, verified) |
| Permission strings | Camera and photo library written for review; Contacts is never requested |

## Needs your Apple login

Everything below prompts for your Apple ID with 2FA, or an App Store Connect API key.
No Apple credentials are stored in this repo and none should be.

### 1. The bundle ID and app record — `eas submit` creates both

You do **not** need to pre-create anything in App Store Connect. Verified in the eas-cli
source (`build/submit/ios/AppProduce.js`): on submit it registers the bundle identifier on
the Apple Developer portal, creates the App Store Connect app record, and creates an
internal TestFlight group (that last step is non-fatal if it fails).

It runs because our submit profile deliberately omits `ascAppId` — the eas.json reference
says setting it "results in skipping the app creation step". `sku` is likewise generated
unless provided.

**It does not prompt for the app name.** The resolution order in eas-cli is
`appName ?? exp.name ?? prompt`, and `app.json` sets `expo.name` to `CardScanner`, so that
is what it tries — not the listing name chosen in `listing.md`. `CardScanner` is already
taken on the App Store (Zoho ships a "Card Scanner"), so EAS generated a unique record name
with a random suffix and carried on.

**That is harmless, and expected.** The App Store Connect record name is not the app name
users see, not the bundle ID, and not the Home Screen label. It only has to be unique so the
record can exist. Nothing about the build is affected.

**Rename it before submitting for App Store review** (not needed for TestFlight):

1. appstoreconnect.apple.com → **My Apps** → the generated `CardScanner (…)` app
2. Sidebar → **App Information** (under *General*)
3. **Localizable Information** → **Name**, with the language set to **English (U.S.)**
4. Enter `CardScanner: Card to Contact`
5. **Save**. Apple checks uniqueness on save, so a clash surfaces immediately.

Do this while the app has no approved version — the Name is freely editable until then. Once
the app is live, changing it requires submitting a new version. Uploading TestFlight builds
in the meantime does not lock it.

A public App Store search finds no app using that exact string, so it should be accepted.
If Apple rejects it as too similar to something existing, change that one field — nothing in
the codebase depends on it.

Do **not** "fix" this by changing `expo.name` in `app.json` — that is `CFBundleDisplayName`,
the label under the icon on the Home Screen, which iOS truncates near 12 characters.
`CardScanner` is correct there.

Once the record exists, copy its **Apple ID** (a 10-digit number, App Information → General
Information) into `eas.json` as `submit.production.ios.ascAppId`. That makes every later
submit target the existing record directly and skip app creation entirely.

Prefer to do it by hand anyway? appstoreconnect.apple.com → Apps → **+**, with bundle ID
`com.ravinderkumar.cardscanner`, language English (U.S.), SKU `cardscanner-001`. Then put
the resulting app ID in `eas.json` as `ascAppId` to skip the automatic step.

### 2. Build

```bash
npx eas build --platform ios --profile production
```

First run generates the distribution certificate and provisioning profile in EAS's cloud —
this is the step that needs 2FA. Expect roughly 15–25 minutes in the queue plus build time.

### 3. Upload to TestFlight

```bash
npx eas submit --platform ios --profile production --latest
```

Then wait for the "processing" state in App Store Connect to clear — usually 5–15 minutes.

### 4. Beta metadata — paste these

Note: creating the app record does **not** create the store listing. Description, keywords,
screenshots, category, age rating and App Privacy still have to be entered in the web UI
before you can submit for App Store review — none of that is needed for TestFlight
*internal* testing.

**Feedback email:** `yravinderkumar33@gmail.com`

**Beta App Description:**

```
CardScanner turns a photo of a paper business card into an iOS contact. The AI runs
entirely on your iPhone: on-device text recognition reads the card, and a small language
model on the phone sorts that text into name, company, title, phone, email, website and
address. You check the result and save it through Apple's own New Contact form.

There is no account and no server. After a one-time model download on first launch, the
app works with no connection at all.
```

**What to Test (first build):**

```
FIRST LAUNCH DOWNLOADS ~530 MB
The two AI models download once, on first launch. Please stay on Wi-Fi and let it
finish — a few minutes — before using the app. This is why the app is not usable the
second you open it. Nothing is uploaded; the download only comes in.

Then please try:
1. Scan a real printed business card with the camera. This is the main thing I need
   tested — every scan so far has gone through the Photos import path.
2. Check the extracted fields. Tell me what it got wrong, and roughly what the card
   looked like (glossy, dark background, unusual layout, two languages).
3. Save it. Apple's New Contact form should open already filled in. You should NOT be
   asked for permission to access your contacts at any point — tell me if you are.
4. Turn on Airplane Mode and scan again. It should work exactly the same.
5. Look at History, delete a scan, share one as a .vcf.
6. Settings → AI models: check the sizes look right, and that appearance switching
   (light / dark / system) holds after you reopen the app.

Known and not worth reporting:
- The first launch download is large; that is by design.
- Odd or heavily stylised cards can confuse the model. If it cannot structure a card it
  shows you the raw text to assign by hand — I would like to know when that happens.
```

### 5. Internal vs external testers

- **Internal** — up to 100 people who are members of your App Store Connect team. No Beta
  App Review, builds appear within minutes. Start here.
- **External** — up to 10,000 people by email or public link, but the first build needs
  **Beta App Review**, which is a real review and can reject. The beta description and
  "What to Test" above are what that reviewer reads; the ~530 MB download is the thing most
  likely to confuse them, which is why it is the first line.

---

## What to actually check on the device

These are the things a simulator could not verify, so they carry the real risk:

- **The live camera.** Every scan tested so far used the Photos import path, because a
  simulator has no camera. Capture, the card guide, the steady hint and the flash toggle
  are unproven against real optics.
- **Haptics.** No simulator hardware. The shutter tick, the success notification and the
  selection feedback in Settings have never fired.
- **Real inference speed.** Every number in the README came from the simulator on an Apple
  Silicon Mac, which is not iPhone hardware. Scan latency and tokens/sec on a real device
  are unmeasured. Note them from the processing screen.
- **Thermals and memory.** A 493 MB model held in memory on a real phone, several scans in
  a row. Watch for pressure warnings or the app being killed in the background.
- **The download on cellular**, and what happens when it is interrupted — background the
  app mid-download, lose signal, come back.
- **A real printed card**, ideally a few: matte, glossy, dark, two-column, non-English.

## If the upload is rejected

Common first-upload stoppers, all already handled here — verify rather than assume:

- Missing export-compliance answer → declared in `Info.plist`.
- Missing 1024×1024 icon, or an icon with alpha → the icon is 1024×1024 with no alpha.
- Bundle version already used → `autoIncrement` prevents it.
- Missing purpose strings → camera and photo library are set; Contacts is not requested.

---

## Over-the-air updates (EAS Update)

The app now bundles `expo-updates`, so **JavaScript-only** fixes can ship without a new
build or an App Store review.

**The limit, stated plainly:** OTA only reaches builds that already contain the updates
runtime. Every build made before this was added — including anything already on a device —
**cannot** receive an update. Those need a fresh build. The same is true of any change that
touches native code, a native dependency, `app.json` native config, or the app icon.

Runtime versioning uses the **fingerprint** policy: EAS hashes the native project and only
serves a JS bundle to a binary whose native side matches. This app links ExecuTorch and
several native modules, so the looser `appVersion` policy would happily push a bundle onto a
mismatched binary and crash it. Fingerprint makes that impossible — the cost is that adding
or removing any native dependency starts a new runtime, and older builds stop receiving
updates, which is the correct outcome.

Channels are wired in `eas.json`: `production`, `preview`, `development`.

### Shipping a JS fix

```bash
npx eas update --branch production --message "Fix the flashlight toggle"
```

Devices pick it up on the next cold start. To check what a build would receive:

```bash
npx eas update:list --branch production
```

### What can and cannot go OTA

| Change | OTA? |
|---|---|
| Screen logic, copy, styling, prompts, validation — anything in `components/`, `lib/`, `hooks/`, `theme/` | Yes |
| Adding or removing a native module, editing `app.json` native config, app icon, permission strings | No — new build |
| Bumping the app version for the store | No — new build |
