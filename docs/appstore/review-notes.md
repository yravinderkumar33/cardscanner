# App Review Notes — CardScanner 1.0.0

Bundle id: com.ravinderkumar.cardscanner
Developer: Ravinder Kumar (individual)
Platform: iPhone only, portrait, iOS 17.0 or later. No iPad build. No Android build.

This document holds four things: the exact text to paste into App Store Connect,
the rejection risk register, the export compliance answer, and the pre-submission
checklist.

---

## 1. Notes for Review — paste this into App Store Connect

Paste the block below verbatim into **App Store Connect → App Review Information →
Notes**. Leave the demo account fields empty and leave "Sign-in required" off.
The block below is 3,980 characters against the field's 4,000 limit — 20 characters of
headroom, so anything added here has to be paid for by deleting something else.

```text
NO ACCOUNT NEEDED
CardScanner has no sign-up, no login and no backend server. There are no demo
credentials to provide because there is nothing to sign in to. Everything the app
does happens on the iPhone.

PLEASE READ FIRST: ONE-TIME MODEL DOWNLOAD ON FIRST LAUNCH
The app turns a photo of a business card into a contact using AI that runs on the
device itself. Because nothing is sent to a server for processing, the AI models
have to live on the phone. On first launch the app downloads them once:

  - a text recognition model (about 37 MB)
  - a small language model (about 493 MB)
  - about 530 MB in total

Please keep the device on Wi-Fi and leave the app in the foreground until the
download manager reports both models ready. On a normal Wi-Fi connection this takes
a few minutes. The screen shows live progress for each model and can be paused and
resumed. If the download is interrupted, reopening the app resumes it. The app is
not usable for scanning until this finishes; that is expected and it happens only
once.

If the download stalls in the review environment, please tell us in the rejection
message rather than treating the app as incomplete. We can supply a demo video of
the full flow.

HOW TO TEST IN 60 SECONDS
1. Complete onboarding and wait for both models to show as ready.
2. Tap "Scan". If you have a paper business card, photograph it inside the on-screen
   guide. If you do not have one at hand, tap the Photos button on the camera screen
   and import any photo of a business card from the photo library.
3. The processing screen shows two stages: text recognition, then the language model
   writing out the fields. You can watch the text stream in. A scan takes about three
   seconds on an iPhone 17 Pro.
4. The review screen shows the extracted name, company, title, phone, email, website
   and address. Fields the AI filled are marked. Everything is editable.
5. Tap "Add to Contacts".

THE APP ASKS FOR NO CONTACTS PERMISSION
Tapping "Add to Contacts" presents Apple's own New Contact sheet, prefilled with the
reviewed fields. No Contacts permission is requested and no contacts prompt appears:
that sheet is user-mediated, so iOS presents it without giving the app any access to the
address book. You confirm or cancel it yourself; the app cannot write silently and
cannot read or list your contacts. iOS does not tell the app whether you tapped Done or
Cancel, so the app says the form was presented rather than claiming a save.

Camera and photo library are the only permissions the app ever asks for: the camera to
photograph a card, the photo library only for the "import an existing photo" path above.

IT WORKS OFFLINE — PLEASE VERIFY
After the one-time model download, the app needs no network at all. To confirm: turn
on Airplane Mode, open the app and run a scan. Capture, text recognition, the language
model, review and saving to Contacts all work with no connection.

WHERE DATA GOES
Scans are stored only in the app's own Documents directory on the device: the card
photo, a thumbnail, the extracted fields and the raw recognized text. Nothing syncs
anywhere. There is no analytics on scans, no ads and no user accounts. The app has a
Privacy screen in Settings that explains this, and it also discloses the one piece of
network activity we do not control: the open-source AI runtime we use
(react-native-executorch) pings its own download counter while the models are being
fetched on first launch. That request contains the bundle id, the platform, the
library version, the model name, a country code derived from the device locale and
a simulator flag. It contains nothing about the user, their photos or their cards.
It fires only while model files are being fetched — never during a scan — so it
happens on first launch and again only if the models are deleted and re-downloaded.

You can delete both models at any time under Settings → AI models, and download
them again from the same screen.

Thank you for reviewing.
```

**Attachments to add alongside the notes:** a short screen recording (60–90 seconds)
of onboarding → download complete → Photos import → processing → review → Apple's New
Contact sheet → airplane-mode scan. App Store Connect accepts a file attachment on the
review information; use it. It is the single strongest defence against a 2.1 rejection
caused by the download failing in the review lab.

---

## 2. Risk register

Likelihood is our honest estimate for this specific app, not a generic score.

| # | Risk | Guideline | Likelihood | Mitigation |
|---|------|-----------|------------|------------|
| R1 | Reviewer opens the app, sees a 530 MB download, and marks it incomplete or times out | 2.1 App Completeness | **Medium-high** | Notes text explains it up front; attach demo video; download is resumable and shows per-model progress |
| R2 | Download fails on the review network (proxy, captive portal, throttling) | 2.1 | Medium | Explicit failure state with a retry button; notes ask the reviewer to report the failure rather than reject; models are on a public CDN over HTTPS |
| R3 | Purpose strings judged vague | 5.1.1 | Low | Only two prompts are ever shown (camera, photo library) and both strings name the feature and the reason; already tightened in `app.json`; verify the built Info.plist carries them (see below) |
| R4 | Privacy policy or App Privacy label contradicts the download-counter ping | 5.1.1, 5.1.2 | Medium | Policy and in-app Privacy screen both name the ping and its contents; never claim "no network activity"; declare it as Usage Data → Product Interaction rather than filing "Data Not Collected" |
| R5 | Judged a thin utility or a wrapper around OCR | 4.2 Minimum Functionality | Low | Full pipeline, editing, validation, offline operation, local History with search, share as .vcf, manual-assign fallback. Point to these in an appeal if it happens |
| R6 | App name "CardScanner" is generic, already taken, or collides with a mark | 4.1 Copycats, 5.2.1 | **Medium-high** | Search the App Store and USPTO/EUIPO for the exact name before locking metadata; have a fallback name reserved in App Store Connect |
| R7 | Placeholder or incomplete metadata (support URL, privacy policy URL, description, keywords, category) | 2.1, 5.1.1 | Medium | Checklist item; every URL must resolve on a public browser with no login |
| R8 | Screenshots show non-final UI, mockups, or device frames with fake content | 2.3.3, 2.3.10 | Medium | Capture from a real device build at the final commit; no "coming soon", no marketing chrome that misrepresents the UI |
| R9 | Export compliance question answered wrong or asked on every build | 5.1 / trade rules | Low | Already declared: `ios.infoPlist.ITSAppUsesNonExemptEncryption: false` in `app.json` (section 3); confirm it reached the archive |
| R10 | Reviewer expects a Contacts prompt before a contact is written, sees none, and suspects a silent write | 5.1.1(i) | Low | The app requests no Contacts permission and needs none: the prefilled sheet is Apple's own user-mediated New Contact form. Notes say so; nothing is written unless the reviewer taps Done |
| R11 | Review device is low on storage and the download cannot complete | 2.1 | Low | The app has a low-storage state that names the shortfall instead of failing silently; notes mention the 530 MB requirement |
| R12 | App runs on iPad in compatibility mode during review and looks wrong | 2.4.1, 4.2 | Low | `supportsTablet` is already false; verify the layout does not break if opened on an iPad in iPhone mode |
| R13 | AI-generated contact fields are wrong on an unusual card and the reviewer sees a "broken" result | 2.1, 4.2 | Low-medium | Every field is editable before saving; the review screen marks AI-filled fields; there is a manual-assign mode when structuring fails. Say this in the notes if challenged |
| R14 | Claim of on-device AI treated as unverified | 2.3.1 Accurate Metadata | Low | Airplane-mode test is in the notes and takes 20 seconds |

### R3 detail — purpose strings

**The user is ever prompted for exactly two permissions: camera and photo library.** The
app requests no Contacts authorization at all. `lib/contacts.ts` calls
`Contacts.presentFormAsync(null, contact, { isNew: true })` directly, which presents
`CNContactViewController(forNewContact:)` — a user-mediated system form that needs no
Contacts authorization (expo-contacts' `ContactsModule.swift` performs no permission
check, and with Contacts access revoked on a device the prefilled form still appears with
no prompt). So "the app never reads your address book" is enforced by iOS, not merely
promised.

Current strings in `app.json`, verified against the file at the time of writing:

- Camera (`expo-camera` → `cameraPermission`): "CardScanner uses the camera to photograph
  business cards. Every photo is read on this iPhone and never uploaded."
- Contacts (`expo-contacts` → `contactsPermission`): "CardScanner opens Apple's New Contact
  form prefilled with the card you scanned, so you can save it. It never reads your existing
  contacts." **Retained deliberately, and never shown** — nothing in the app triggers a
  Contacts prompt. Do not "clean it up": `expo-contacts` is linked, and iOS terminates an
  app that reaches a Contacts API with no `NSContactsUsageDescription`, so the string is
  cheap insurance against a future code path or SDK update that does.
- Photos (`expo-image-picker` → `photosPermission`): "CardScanner imports card photos you
  choose. Every photo is processed on this iPhone only."

The two strings the user actually sees each name the feature and the reason. No rewrite is
needed. The remaining action is verification, not editing: after `prebuild`/archive, confirm
`NSCameraUsageDescription`, `NSContactsUsageDescription` and `NSPhotoLibraryUsageDescription`
in the built Info.plist match these strings exactly, and that no stale earlier string
survives in `ios/`.

### R4 detail — App Privacy label and the download counter

Do not answer "Data Not Collected" without thinking it through. The download-counter
request sends bundle id, platform, library version, model name and a locale-derived
country code from the user's device to a third party. It carries no user identity, no
device identifier, no photo and no card content, and it fires once, while the models
download.

The defensible and honest answer is to declare it rather than hide it: **Usage Data →
Product Interaction**, purpose **Analytics**, **not linked to the user's identity**,
**not used for tracking**. Everything else on the label is "Data Not Collected". This
is not a matter of taste: the SDK's own `PrivacyInfo.xcprivacy` declares
`NSPrivacyCollectedDataTypeProductInteraction` with purpose Analytics, so Xcode's
generated privacy report will show Product Interaction, and a label filed under
Diagnostics would not match it. `app-privacy-answers.md` is the authority for this
field; do not restate a different answer here.

The privacy policy, the in-app Privacy screen and the App Store description must all
describe the download counter and must not contradict each other. They do not need to
be word-for-word identical — the in-app screen is a short summary, the policy is the
full version — but no one of them may deny what another discloses. Never write "zero
network activity", "no telemetry" or "nothing ever leaves your phone" anywhere:
description, screenshots, policy or app copy.

---

## 3. Export compliance

**What the app actually does:** it downloads two model files over HTTPS on first
launch. It implements no cryptography of its own, ships no crypto libraries, and does
no encryption beyond what iOS provides for HTTPS and for local file protection.

**Answer to give:** in App Store Connect, when asked *"Does your app use encryption?"*
the app qualifies for the exemption for apps that only use encryption provided by the
operating system for standard HTTPS. Declare that it uses **no non-exempt encryption**.
No CCATS, no ERN, no annual self-classification report is required for this app.

**Already done — do not add it a second time.** `app.json` ships the declaration through
`ios.infoPlist`:

```json
"ios": {
  "bundleIdentifier": "com.ravinderkumar.cardscanner",
  "supportsTablet": false,
  "infoPlist": { "ITSAppUsesNonExemptEncryption": false }
}
```

which writes this into the built Info.plist:

```xml
<key>ITSAppUsesNonExemptEncryption</key>
<false/>
```

The alternative spelling `ios.config.usesNonExemptEncryption: false` produces the same key.
Use one, not both — this project already uses `infoPlist`. Verification only: open the
archive's Info.plist and confirm the key is present and `false`.

Re-check this if the app ever adds its own encryption of stored scans, a VPN, or any
custom crypto. Then the answer changes and this section must be rewritten.

---

## 4. Pre-submission QA checklist

Run this on a **physical iPhone**, from a **fresh install** (delete the app first so
the model download and all permission prompts start clean), on the exact build being
submitted.

**First run**
- [ ] Onboarding renders fully and can be completed.
- [ ] Model download starts, shows progress for both models, and completes.
- [ ] Pause and resume the download; it resumes rather than restarting from zero.
- [ ] Kill the app mid-download and reopen; it recovers.
- [ ] Turn Wi-Fi off mid-download; the failure state is readable and offers retry.

**Core flow**
- [ ] Camera scan of a real card produces sensible fields.
- [ ] Photos import path works and does not require camera permission.
- [ ] Processing screen shows both stages and the token stream.
- [ ] Review screen: AI-filled markers present, validation fires on a bad email and a bad phone number, every field is editable.
- [ ] "Add to Contacts" presents Apple's New Contact sheet, prefilled, with no permission prompt before it.
- [ ] Cancelling that sheet does not claim the contact was saved.
- [ ] Feed the app a deliberately bad image and confirm the manual-assign fallback appears instead of a crash.

**Offline**
- [ ] Airplane Mode: full scan end to end, including saving to Contacts.

**Permissions**
- [ ] Deny camera → the app explains and offers Settings, no dead end.
- [ ] Deny photo library → same.
- [ ] No Contacts prompt appears anywhere in the app, on a fresh install, at any point.
- [ ] If the app is listed under Settings → Privacy & Security → Contacts at all (it has no
      reason to be, since it never asks), switch it off and confirm "Add to Contacts" still
      presents the prefilled form and still saves when you tap Done.
- [ ] Both purpose strings the user sees (camera, photo library) read correctly on the
      system prompts and match `app.json`.

**History and settings**
- [ ] History search, swipe to delete, re-save, share as .vcf.
- [ ] Appearance: light, dark and system all render correctly on every screen.
- [ ] Settings → AI models: delete models, then re-download them successfully.
- [ ] Privacy screen text is consistent with the published privacy policy — same facts about
      the download counter, no claim in one that the other contradicts.

**Accessibility**
- [ ] VoiceOver pass over onboarding, camera, processing, review, history.
- [ ] Dynamic Type at the largest non-accessibility size does not clip or overlap.
- [ ] Touch targets on the camera and review screens are at least 44pt.

**Metadata and build**
- [ ] Version 1.0.0 and a build number higher than any previously uploaded build.
- [ ] No "beta", "test", "demo", "coming soon" or lorem text anywhere in the app or the listing.
- [ ] No mention of Android, other stores, or competitor names in any metadata.
- [ ] No pricing claims in the description.
- [ ] Support URL and privacy policy URL both load in a private browser window with no login.
- [ ] Screenshots captured from this build on a real device, at the display sizes App Store Connect currently requires for iPhone; no iPad set needed.
- [ ] App Privacy answers filled in exactly as `app-privacy-answers.md` section 5 specifies:
      Usage Data → Product Interaction, Analytics, not linked, not tracking; everything else
      not collected.
- [ ] `ITSAppUsesNonExemptEncryption` present in the built Info.plist (check the archive, not just `app.json`).
- [ ] Age rating, category and keywords completed.
- [ ] Review notes from section 1 pasted in, demo video attached, demo account fields left empty.
- [ ] Install the exact TestFlight build on a clean device one last time and repeat the 60-second test from the notes.
