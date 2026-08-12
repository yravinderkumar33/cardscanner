# App Privacy answers — CardScanner 1.0.0

For the App Store Connect **App Privacy** questionnaire (the privacy nutrition label).
Bundle id `com.ravinderkumar.cardscanner`. Developer: Ravinder Kumar (individual).

These answers are legally binding. Everything below is written against what the shipping
code actually does. Read the reasoning sections before entering the answers, so the
answers can be defended if App Review asks.

---

## 1. The first question

> Do you or your third-party partners collect data from this app?

**Answer: Yes.**

Not because of anything the app itself sends — the app has no backend and transmits no
card data — but because the on-device AI library (`react-native-executorch`) sends one
model-download event to its maintainer when the models are fetched. Apple requires
declaring data collected by third-party SDKs bundled in the app. See section 3(b).

---

## 2. What the app does with data, in one paragraph

The user photographs a business card. The photo is read by an on-device OCR model, the
text is structured into fields by an on-device language model, the user reviews and edits
the result, and the fields are handed to Apple's own New Contact form for the user to
confirm. The photo, the thumbnail, the extracted fields and the raw OCR text are written
to the app's Documents directory on the device. There is no server, no account, no sync,
no ad SDK and no analytics about scans. The only outbound network activity in the whole
product is the one-time model download on first launch (and again if the user deletes and
re-downloads the models from Settings).

---

## 3. The two subtleties, with reasoning

### (a) Card photos and extracted contact fields are NOT "collected"

Apple defines *collect* in the App Privacy questionnaire as transmitting data off the
device in a way that allows the developer and/or their third-party partners to access it
for a period longer than what is necessary to service the transmitted request in real
time. Apple states explicitly that data processed **only on the device** and not sent off
the device is **not** collected, and does not have to be declared.

CardScanner's card photos, thumbnails, raw OCR text and extracted contact fields:

- are produced on the device by models running on the device (ExecuTorch);
- are stored in the app's own Documents directory;
- are never uploaded, never synced, never backed up to any service the developer runs —
  there is no developer-operated server of any kind;
- are shared off the device only when the *user* deliberately exports a scan as a `.vcf`
  through the iOS share sheet, which is a user-initiated action into a destination the
  user picks, and still does not send anything to the developer;
- reach the Contacts database only through Apple's native New Contact form, which the
  user confirms — the app holds no Contacts authorization and never reads the address
  book. See the Contacts entry in section 4.

**Therefore: Contact Info, User Content, Contacts and Sensitive Info are all answered
"No" — not because the app does not touch that data, but because it never leaves the
device and the developer never receives it.** That is the correct application of Apple's
definition, not a loophole. Local storage on the user's own device is not collection.

If App Review asks, the defense is one sentence: *there is no endpoint that card data
could be sent to; the only URLs the binary contacts are the model host and the library's
download counter, and neither request carries card data.*

### (b) The third-party model-download counter IS collection, and must be declared

`react-native-executorch` (version 0.9.3 in this build) fires two requests the first time
each model is actually downloaded, once per model, from
`src/utils/ResourceFetcherUtils.ts`:

1. A `POST` to `https://ai.swmansion.com/telemetry/downloads/api/downloads` with a JSON
   body containing exactly:
   - `bundleId` — the app's bundle identifier (`com.ravinderkumar.cardscanner`)
   - `countryCode` — a two-letter region tag derived from the device locale
     (`Intl.DateTimeFormat().resolvedOptions().locale`), or `UNKNOWN`
   - `isEmulator` — a boolean
   - `libVersion` — the library's own version string
   - `modelName` — which model was downloaded
   - `system` — the platform string (`ios`)
2. A `HEAD` request to the model's Hugging Face repo, which increments Hugging Face's
   public download counter for that repo.

There is no user identifier, no device identifier, no advertising identifier, no account,
no IDFA, no persistent random id, and nothing derived from the user's cards, photos,
contacts or usage of the scanning features. The payload describes *an app version
downloading a model*, not a person.

**Which category?** Apple's taxonomy has no "SDK download event" type. The correct
placement is **Usage Data → Product Interaction**, whose definition covers app launches
and other information about how the user interacts with the app; a first-launch model
fetch is app-usage information. This is also exactly how the library classifies itself:
its own `PrivacyInfo.xcprivacy` declares `NSPrivacyCollectedDataTypeProductInteraction`,
not linked, not tracking, purpose Analytics. Matching the SDK's own privacy manifest is
the most defensible choice, and it keeps the nutrition label consistent with the
aggregated privacy report Xcode generates for the build.

**Purpose: Analytics.** The maintainer uses it to count model downloads. It is not used
for advertising or marketing — the app has no ads and no marketing pipeline.

**Linked to the user's identity: No.** Nothing in the payload identifies a user or a
device. The bundle id identifies the *app*, and is identical for every install. The
country code is a coarse, locale-derived string shared by everyone in a region. There is
no account to link to, because the app has no accounts.

**Used for tracking: No.** Apple defines tracking as linking data with third-party data
for targeted advertising or advertising measurement, or sharing data with a data broker.
None of that happens. The library's manifest also sets `NSPrivacyTracking` to false and
declares no tracking domains. The app must therefore answer **No** to the tracking
question and must not include App Tracking Transparency.

**Not Coarse Location.** The `countryCode` is read from the device's locale/region format
settings, not from Core Location, not from GPS, and not from IP geolocation. It is
device-configuration data, not a location measurement — it reports the region the user
formats dates in, which may have nothing to do with where the phone is. Declaring
Location here would misdescribe the app; the label must be accurate in both directions,
so over-declaring is not the "safe" option. Keep it under Usage Data and keep this
paragraph as the written justification.

**Not Identifiers.** Apple's Identifiers category means User ID and Device ID. A bundle
identifier is neither; it is constant across all installs and cannot distinguish devices
or users.

**IP address.** Any HTTPS request necessarily exposes an IP address to the receiving
server, here Software Mansion's endpoint and Hugging Face's CDN. The app does not collect,
store, transmit or use the IP address, and it is used only to service the request in real
time. Under Apple's definition that is not collection and needs no declaration. Do not
volunteer an "Other Data" entry for it.

---

## 4. Every data type, one by one

For each Apple data type: collected yes/no; if yes, purpose, linked to identity, used for
tracking.

### Contact Info
(name, email address, phone number, physical address, other user contact info)

**Collected: No.**
The app extracts exactly this kind of data from a photographed card — name, job title,
company, phone, email, website, address — but it is produced on the device, stored on the
device, and handed to Apple's New Contact form on the device. It is never transmitted to
the developer or to any third party. Per section 3(a), on-device-only data is not
collected.

### Health & Fitness
**Collected: No.** The app has no HealthKit entitlement and no health features.

### Financial Info
**Collected: No.** No payments, no in-app purchases, no payment info, no credit info.
The app is free with no in-app purchases.

### Location
(precise location, coarse location)

**Collected: No.**
The app requests no location permission and links no location APIs. The only geographic
signal anywhere in the product is the SDK's locale-derived two-letter country code, which
is device-configuration data rather than a location measurement, and is declared under
Usage Data. See section 3(b).

### Sensitive Info
(racial or ethnic data, sexual orientation, pregnancy, disability, religious or
philosophical beliefs, trade union membership, political opinion, genetic or biometric
data)

**Collected: No.**
A business card can incidentally contain, say, a trade-union or religious employer's name.
That text still never leaves the device, so it is not collected. The app performs no
biometric identification — the OCR and language models read text, they do not recognise
faces or people.

### Contacts
(the user's address book, phone book or list of social graph contacts)

**Collected: No.**
The app never reads the address book, and it has no access to read it: it requests no
Contacts permission at all. Saving hands the reviewed fields to
`Contacts.presentFormAsync(null, contact, { isNew: true })`, which presents
`CNContactViewController(forNewContact:)` — a user-mediated system form that iOS shows
without granting the app any Contacts authorization, and which the user confirms. Writing
goes one way, through Apple's UI, and iOS does not report back whether the user tapped
Done or Cancel. Nothing is read and nothing is transmitted. (`NSContactsUsageDescription`
remains in the Info.plist as a defensive measure; nothing in the app triggers it, so the
user never sees a Contacts prompt.)

### User Content
(photos or videos, audio data, gameplay content, customer support, other user content)

**Collected: No.**
Card photos and thumbnails are captured or imported, processed in memory, and saved to the
app's Documents directory on the device. They are never uploaded. The `.vcf` share is a
user-initiated export through the iOS share sheet to a destination the user chooses, and
delivers nothing to the developer.

### Browsing History
**Collected: No.** The app has no browser and no web content.

### Search History
**Collected: No.**
History has a local search field. The query is used to filter locally stored scans in
memory and is never transmitted or persisted off the device.

### Identifiers
(user ID, device ID)

**Collected: No.**
No accounts, no user IDs, no device IDs, no IDFA, no IDFV, no advertising identifiers, no
persistent installation identifiers. The only identifier in the SDK's download event is
the app's bundle id, which identifies the app, not the user or the device, and is
identical across every install. See section 3(b).

### Purchases
**Collected: No.** No in-app purchases, no subscriptions, no purchase history.

### Usage Data
(product interaction, advertising data, other usage data)

**Collected: Yes — Product Interaction only.**
Source: the bundled `react-native-executorch` library's model-download event, fired once
per model when the models are first downloaded (and again if the user deletes and
re-downloads them in Settings). Payload: bundle id, platform, library version, model name,
locale-derived country code, emulator flag.

- **Purpose: Analytics.**
- **Linked to the user's identity: No.**
- **Used for tracking: No.**
- Advertising Data: **not collected.** There are no ads and no ad SDKs.
- Other Usage Data: **not collected.** Nothing about scans, screens, taps, session length
  or feature use is transmitted.

### Diagnostics
(crash data, performance data, other diagnostic data)

**Collected: No.**
No crash reporting SDK, no performance monitoring SDK, no logging service. Timings such as
the scan duration are shown in the app and stay on the device. Crash and analytics data
that users choose to share with developers through Apple's own iOS settings is collected
by Apple, not by this app, and Apple does not require it to be declared here.

### Other Data
**Collected: No.**
Nothing falls outside the categories above. The IP address inherent to the model download
is not declared, for the reason given in section 3(b).

---

## 5. Recommended final answer set — enter this

**Do you or your third-party partners collect data from this app?** → **Yes**

**Data types to select:** exactly one.

| Field | Answer |
| --- | --- |
| Category | Usage Data |
| Data type | Product Interaction |
| Purpose | Analytics |
| Linked to the user's identity? | No |
| Used for tracking? | No |

**Leave unselected:** Contact Info, Health & Fitness, Financial Info, Location, Sensitive
Info, Contacts, User Content, Browsing History, Search History, Identifiers, Purchases,
Diagnostics, Other Data — and, within Usage Data, Advertising Data and Other Usage Data.

**Tracking:** the app does not track. Do not enable App Tracking Transparency and do not
add tracking domains.

**Resulting label:** "Data Not Linked to You — Usage Data". No "Data Used to Track You"
section.

**Privacy policy:** must state, in plain words, that scans stay on the device and that the
AI library reports a model download containing app id, platform, library version, model
name and a locale-derived country code. The in-app Privacy screen already says this. Never
write "no telemetry of any kind" or "zero network activity" anywhere — description,
policy, screenshots or release notes. That claim would be false and would contradict this
label.

---

## 6. Re-verify when the AI library changes

This label is pinned to `react-native-executorch` **0.9.3**, whose privacy manifest
declares Product Interaction, not linked, not tracking, purpose Analytics, and whose
download event sends the six fields listed above and nothing else.

Before shipping any build that upgrades or replaces that library — or adds any other
third-party SDK — do all of the following again:

1. Read the SDK's `ios/PrivacyInfo.xcprivacy` and compare its `NSPrivacyCollectedDataTypes`
   and `NSPrivacyTracking` values against this document.
2. Re-read the code that builds the telemetry payload (currently
   `node_modules/react-native-executorch/src/utils/ResourceFetcherUtils.ts`,
   `triggerDownloadEvent`) and confirm no user or device identifier has been added.
3. Generate the privacy report in Xcode (Organizer → the archive → Generate Privacy
   Report) and check the aggregated data types match this label.
4. Update this file and the App Store Connect answers together, in the same change.

Do not confuse the two halves of a privacy manifest. `NSPrivacyAccessedAPITypes` —
declared by both this app (UserDefaults, file timestamp, disk space, system boot time)
and the SDK (file timestamp) — is the required-reason API declaration. It is a build-time
manifest requirement and has no bearing on the App Store Connect questionnaire; none of
those entries is a data type to select on the label.

The app's own `ios/CardScanner/PrivacyInfo.xcprivacy` correctly declares an empty
`NSPrivacyCollectedDataTypes` array and `NSPrivacyTracking` false: the app's own code
collects nothing. The Product Interaction entry comes from the SDK's manifest, and Xcode
merges the two into the privacy report. The App Store Connect label must reflect the
merged result, which is why it says Yes while the app's own manifest says nothing.
