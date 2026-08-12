# App Store Connect listing — CardScanner 1.0.0

Every string below is final copy, ready to paste into the matching App Store Connect field.
Character counts are exact (spaces, punctuation and line breaks included) and were counted, not estimated.

Localization: English (U.S.), primary.

---

## 1. App Name — 30 characters max

`CardScanner` on its own is almost certainly taken. Every option below is the brand plus a
qualifier, which keeps the brand while making the full name unique. If the exact string is
rejected as too similar to an existing app, move down the list. Option 5 drops the
`CardScanner` token entirely and is the fallback if the brand word itself is contested.

| # | Name | Chars | Notes |
|---|------|-------|-------|
| 1 | **CardScanner: Card to Contact** | 28 | **Recommended.** Says the whole job in four words. Indexes `card` and `contact`, the two highest-intent words a user types. |
| 2 | CardScanner: Offline Card AI | 28 | Leads with the differentiator instead of the job. Good if the subtitle ends up carrying the job description. |
| 3 | CardScanner — On-Device AI | 26 | Em dash reads cleanly on the product page but is harder to type in search. Indexes `on-device`, a low-volume term. |
| 4 | CardScanner: Business Cards | 27 | Safest, most literal. Indexes `business`, which frees a slot in the keyword field. |
| 5 | Card to Contact: Offline AI | 27 | Brand-free fallback. Use only if `CardScanner` cannot be used at all. |

## ✅ CHOSEN: `CardScanner: Card to Contact` (28 characters)

This is the name to enter in App Store Connect. The alternatives above are kept only as
fallbacks in case Apple rejects it as too similar to an existing app.

**This is the App Store listing name, not the home-screen name.** They are separate fields
and they differ here on purpose:

| Field | Value | Where it shows |
|---|---|---|
| App Store Connect → App Name | `CardScanner: Card to Contact` | Search results, the product page |
| `app.json` → `expo.name` → `CFBundleDisplayName` | `CardScanner` | Under the icon on the Home Screen |

Leave `app.json` alone. iOS truncates Home Screen labels at roughly 12 characters, so
`CardScanner` (11) fits exactly and `CardScanner: Card to Con…` would not. Apple permits
the listing name to be longer than the bundle display name, and expects it: the extra words
are what get indexed for search.

The keyword field below assumes this name and subtitle option A, because Apple already
indexes every word in both — repeating them in keywords wastes the 100 characters.
Verified: the keyword string contains no standalone `card` or `contact` token.

---

## 2. Subtitle — 30 characters max

| # | Subtitle | Chars | Notes |
|---|----------|-------|-------|
| A | **Offline AI, no account needed** | 29 | **Recommended.** The name says what it does, so the subtitle says why it is different. Both claims are literally true. |
| B | On-device AI. Works offline. | 28 | Same idea, more technical. Drops `account`, which is a word real users search for. |
| C | Photo in, contact out. Offline | 30 | Describes the flow, but repeats `contact` from the name and wastes indexing. |

**Recommended: `Offline AI, no account needed` (29 characters).**

Words now claimed by name + subtitle, which must therefore not be repeated in Keywords:
`card`, `scanner`, `cardscanner`, `to`, `contact`, `offline`, `ai`, `no`, `account`, `needed`.

---

## 3. Promotional Text — 170 characters max

Can be changed at any time without submitting a new build. Use it for the strongest single claim.

```
Snap a business card, check the fields, save it to Contacts. The AI reads the card on your iPhone. One model download on first launch, then it works in airplane mode.
```

**166 characters.**

Do not shorten this to "no connection" or "never goes online": the app downloads its models on
first launch, and metadata that denies it contradicts the privacy policy and the App Privacy label.

Alternate, for after the first update ships (**148 characters**):

```
Scan a business card and get an iOS contact, with the AI running on your phone. First launch downloads the models. After that, no connection needed.
```

---

## 4. Description — 4000 characters max

**3032 characters.** Paste exactly as written, including the blank lines.

```
CardScanner turns a paper business card into an iOS contact. No account, no sign-up, no server. The AI runs on your iPhone, so there is nothing to log into and nowhere for your cards to go. The two AI models are downloaded once on first launch; after that, no connection is needed.

HOW IT WORKS

1. Photograph the card, or import a photo you already have.
2. The app reads the text on the card, then a small language model on the phone sorts that text into name, job title, company, phone, email, website and address. You watch it happen: the recognized text first, then the fields as the model writes them.
3. Check the result, fix anything that looks wrong, and save. iOS opens its own New Contact form with the fields already filled in, and you confirm it.

RUNS ON THE PHONE

Both AI models live on your device. The reader that finds text in the photo is about 37 MB. The language model that structures it is about 493 MB. A typical scan takes around three seconds.

Once the models are on the phone, turn on airplane mode and scan a card. It still works.

WHERE YOUR DATA STAYS

The photo is processed inside the app and saved only to your local History.

Scans stay in the app's own storage on this iPhone: the card photo, a thumbnail, the extracted fields and the raw recognized text. Nothing syncs anywhere.

No account. No sign-up. No ads. No analytics about your scans.

The app never reads your address book, and never asks for permission to. It only hands a filled-in form to iOS, which you confirm. iOS does not tell the app whether you tapped Done or Cancel, so the app does not claim to know.

ONE DOWNLOAD, THEN OFFLINE

The two models are downloaded once on first launch, about 530 MB together. Wi-Fi is recommended. The download can be paused and resumed, and the models can be deleted or downloaded again later in Settings. After that first download, the app works with no connection at all.

An honest note: the open-source AI library this app is built on counts that model download. It sends the app's bundle id, the platform, the library version, the model name and a country code derived from your device language settings. It contains nothing about you or your cards. The Privacy screen inside the app says the same thing.

REVIEW AND EDIT

Every field the AI filled in is marked, so you can see what was read off the card and what was inferred. Emails, phone numbers and websites are checked for obvious mistakes. If a card is unusual and the model cannot structure it, the app hands you the recognized lines and lets you assign them to fields yourself instead of failing.

HISTORY

Every scan is kept on the device. Search it, open a scan to see the photo and the fields, save it to Contacts again, share it as a .vcf file, or swipe to delete it.

APPEARANCE AND ACCESSIBILITY

Light, dark and system appearance. VoiceOver labels throughout, with spoken updates while the AI works. Large touch targets, and layouts that hold up at bigger text sizes.

Requires iPhone with iOS 17.0 or later. Portrait only.
```

Notes for review:

- The description makes no pricing claim, names no other platform, names no competitor, and
  uses no beta or test language.
- The model-download counter is disclosed here in the same terms as the in-app Privacy screen
  and the privacy policy. Keep the three consistent. Never edit this into "no network activity
  ever" or "no telemetry".

---

## 5. Keywords — 100 characters max

Comma separated, no spaces after commas, singular forms, no word repeated from the app name or
subtitle. Apple already indexes the name and subtitle, so repeating those words wastes the field.

```
business,vcard,ocr,namecard,visiting,networking,conference,email,phone,address,private,local,llm,crm
```

**Exactly 100 characters.** 14 terms.

Why these:

- `business` — the biggest search term for this category, and free here because it is not in the name.
- `vcard`, `ocr`, `llm` — precise technical terms with low competition and high intent.
- `namecard`, `visiting` — how a large part of the world says "business card". `visiting` combines
  with the indexed `card` to cover "visiting card".
- `networking`, `conference` — the situations where a stack of cards happens.
- `email`, `phone`, `address` — the fields people search by.
- `private`, `local` — the differentiator, in words the name and subtitle do not already use.
- `crm` — captures the "get these into my system" intent.

Deliberately excluded: `scan`, `scanner`, `reader` (covered by the name token `CardScanner`),
`free` and any pricing word (against Apple's metadata rules), and any competitor name.

Fallback string if a future name change reclaims `business` (**96 characters**):

```
vcard,ocr,namecard,visiting,networking,conference,lead,email,phone,address,private,local,llm,crm
```

---

## 6. Support URL and Marketing URL

**Support URL — required.** Must be a live, publicly reachable page, not a mailto link and not a
login-walled page. Apple review will open it. It must contain:

- What the app does, in one paragraph.
- A monitored contact address for support requests, and a realistic response time.
- An FAQ that answers the questions this app will actually generate:
  - Why is there a 530 MB download on first launch, and can it be paused or resumed?
  - How do I free up that space? (Settings, delete models, re-download later.)
  - Does it work offline? (Yes, after the first download.)
  - Why did nothing appear in Contacts? (iOS presents the New Contact form; the contact is
    saved only when the user taps Done in that form.)
  - Why is there no Contacts permission prompt? (The app does not request Contacts access;
    the pre-filled New Contact form is presented by iOS and confirmed by the user.)
  - Which languages of card text are recognized? (English text recognition.)
  - Where are my scans stored, and how do I delete them?
- A link to the privacy policy.

**Privacy Policy URL — required, separate field.** It must disclose the model-download counter in
the same terms as the app and this description: bundle id, platform, library version, model name
and a locale-derived country code, sent by the AI library when models are fetched, containing
nothing about the user or their cards. It must also state that card photos, extracted fields and
raw recognized text are stored only on the device, and that the app requests no Contacts access and
does not read the address book.

**Marketing URL — optional.** Leave it blank rather than pointing it at a placeholder; a dead or
thin marketing page is a review risk with no upside. If used, it must be a real product page that
matches this listing, mentions no other platform, makes no pricing claim, and contains no "coming
soon" or beta language. The support site and the marketing site may be the same domain, different
pages.

---

## 7. Copyright, Categories

**Copyright field:**

```
2026 Ravinder Kumar
```

Format is year of first publication followed by the copyright holder. App Store Connect renders
the © itself, so do not type the symbol. The holder is the individual developer, matching the
Apple Developer Program account name.

**Primary category: Business.**
The job the app does is a business job: turning the cards collected at a meeting or a conference
into contacts. Users browsing Business are looking for work tools and convert well for this kind
of app. Business is also a less crowded top-chart than Productivity, so a small app has a real
chance of ranking.

**Secondary category: Productivity.**
It is genuinely a "do a repetitive task faster" tool, so the category is honest, and it picks up
browse traffic from a much larger audience. Secondary category affects browse placement, not
search ranking, so there is no keyword cost to it.

**Utilities was considered and rejected.** It fits the mechanics (a single-purpose tool that does
one conversion) but it is where apps go to be found by nobody, and it signals "system helper"
rather than "work tool". Use it only if Apple pushes back on Business.

---

## 8. Age Rating questionnaire

Answer every question as below. Result: **4+**.

**App capabilities and controls**

| Question | Answer |
|---|---|
| Made for Kids (Kids Category) | No |
| Unrestricted web access (in-app browser or link-out to arbitrary web) | No |
| Built-in ability for users to communicate, chat or message | No |
| User-generated content shared with other users | No |
| Ability to share the user's current location with others | No |
| In-app purchases | No |
| Advertising shown in the app | No |
| Third-party advertising or ad tracking | No |
| Gambling or real-money gaming | No |
| Contests, sweepstakes or prizes | No |
| Loot boxes or randomized paid items | No |
| Age assurance or age verification implemented in the app | No |
| Parental controls required | Not applicable |

**Content frequency and intensity** — every answer is **None**:

| Question | Answer |
|---|---|
| Cartoon or Fantasy Violence | None |
| Realistic Violence | None |
| Prolonged Graphic, Sadistic or Realistic Violence | None |
| Violent Sexual Content | None |
| Sexual Content or Nudity | None |
| Graphic Sexual Content or Nudity | None |
| Profanity or Crude Humor | None |
| Alcohol, Tobacco or Drug Use or References | None |
| Mature or Suggestive Themes | None |
| Horror or Fear Themes | None |
| Simulated Gambling | None |
| Medical or Treatment Information | None |
| Health, Wellness or Body-Image Topics | None |
| Weapons or Weapon Use | None |
| Discriminatory or Hateful Content | None |
| Content that may be disturbing to some users | None |

**Expected rating: 4+ in all territories.**

Note on the honest edge case: the app displays whatever text is printed on the card the user
photographs. That content is supplied by the user's own camera, is never shared with anyone, and
is not user-generated content in Apple's sense, which covers content shared between users. Answer
"No" to the user-generated content question.

---

## 9. What's New in This Version — 4000 characters max

For 1.0.0. **386 characters.**

```
First release.

Photograph a business card and get an iOS contact. Text recognition and the language model that sorts the text into fields both run on your iPhone, so after the one-time model download the app works with no connection.

Review and edit every field before saving. Keep a searchable local History, re-save any scan, or share it as a .vcf file.

Requires iOS 17.0 or later.
```

Apple accepts "First release" style text for a 1.0. Do not write "initial beta" or "test build";
beta language is a rejection risk.

---

## Field checklist

| Field | Value | Limit | Used |
|---|---|---|---|
| App Name | CardScanner: Card to Contact | 30 | 28 |
| Subtitle | Offline AI, no account needed | 30 | 29 |
| Promotional Text | see section 3 | 170 | 166 |
| Description | see section 4 | 4000 | 3032 |
| Keywords | see section 5 | 100 | 100 |
| What's New | see section 9 | 4000 | 386 |
| Copyright | 2026 Ravinder Kumar | — | — |
| Primary category | Business | — | — |
| Secondary category | Productivity | — | — |
| Age rating | 4+ | — | — |

---

## Related fields, not part of this document but blocking submission

- **App Privacy (nutrition label).** The app itself collects nothing. The model download counter
  is third-party SDK activity and must still be declared: **Usage Data → Product Interaction**,
  purpose Analytics, not linked to the user's identity, not used for tracking. This matches the
  SDK's own `PrivacyInfo.xcprivacy`, which declares `NSPrivacyCollectedDataTypeProductInteraction`.
  See `app-privacy-answers.md`, which is the authority for this field. Do not file "Data Not
  Collected", and do not file it under Diagnostics.
- **Permission purpose strings.** Camera and Photo Library are the only two the user is ever
  prompted for, and both must match the reasons given in this description. The app requests no
  Contacts access, so `NSContactsUsageDescription` is never shown; it is retained deliberately as a
  defensive measure — see `review-notes.md`, R3 detail.
- **Review notes.** Tell the reviewer that first launch downloads about 530 MB of models over
  Wi-Fi before scanning is possible, and that saving a contact opens the system New Contact form
  which must be confirmed — with no Contacts permission prompt, because none is requested. Without
  this, a reviewer on a slow connection may report the app as broken.
- **Screenshots.** Portrait only, at whatever iPhone display sizes App Store Connect requires at
  submission time (currently a 6.9" set, from which Apple scales the rest; confirm in the console
  rather than trusting this line). No iPad screenshots; the app is iPhone only.
