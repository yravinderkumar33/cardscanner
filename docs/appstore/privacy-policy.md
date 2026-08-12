# CardScanner Privacy Policy

**Effective date: 12 August 2026**

CardScanner is made by Ravinder Kumar, an individual developer. This policy explains what the app does with your information. It is written to be read, not to be survived.

The short version: CardScanner has no account system and no server, and the developer receives nothing from the app. Your card photos, the text read from them, and the contact fields stay on your iPhone. The one exception to "nothing leaves the phone" is a download counter run by the open-source AI library the app is built on, which is told that a model was downloaded. It is described in full in Section 5.

---

## 1. What CardScanner does

You photograph a paper business card, or import a photo of one. The app reads the text on the card and turns it into contact fields you can review and edit, then hands those fields to Apple's New Contact form so you can save the contact.

All of that reading and structuring happens on your iPhone, using two AI models stored inside the app. Nothing is sent anywhere to be processed. After the one-time model download described in Section 5, the app works with no network connection at all, including in airplane mode.

## 2. Information the app collects about you

Nothing that identifies you, and nothing about your cards.

There is no sign-up, no login, no account, no profile, and no user identifier. The developer has no server and receives no data from the app. The developer cannot see your scans, your contacts, or how you use the app, because there is no mechanism that would send that information anywhere.

One piece of information does leave the device, and it is not about you: when the app downloads its AI models, the open-source library that manages the download tells its maintainer's counter that a model was downloaded. The full contents of that message are listed in Section 5. Because a third party receives it, it is declared on this app's App Store privacy label as "Usage Data — Product Interaction", not linked to your identity and not used for tracking. Nothing else is collected, by anyone.

## 3. Information stored on your device

When you complete a scan, CardScanner saves the following in the app's own storage area on your iPhone:

- the photo of the card
- a small thumbnail of that photo
- the contact fields extracted from the card (such as name, job title, company, phone, email, website, address)
- the raw text the on-device reader found on the card
- the date and time of the scan

This is your local History. It is stored only in the app's Documents directory on the device. It is not uploaded, not synced, not backed up to any service run by the developer, and not shared with anyone. It is included in your own iPhone backups only to the extent that iOS backs up app data under settings you control.

The app also stores your preferences, such as appearance (light, dark, or system) and whether you have completed onboarding, plus the downloaded AI model files.

## 4. Permissions, and what each one is for

CardScanner asks for two permissions, and only at the moment a feature needs them. iOS asks you first, and you can change your answer at any time in the iOS Settings app.

- **Camera** — used only to photograph a business card. The camera preview and the captured photo stay on the device. If you decline, you can still use the app by importing an existing photo instead.
- **Photo Library** — used only to let you pick an existing photo of a card to scan. The app reads only the photo you choose. It does not browse, index, or upload your library. If you decline, you can still use the camera instead.

Both are optional. Declining one removes the feature it powers; the rest of the app keeps working.

**Contacts access is not requested.** CardScanner does not ask for permission to use your contacts, and you will never see a contacts prompt from it. When you save a card, the app hands the fields you reviewed to Apple's own New Contact form, pre-filled. That form belongs to iOS and is presented to you, not to the app: iOS shows it without granting CardScanner any access to your address book, and you are the one who taps Save. So the app cannot read, list, search, or modify the contacts you already have — that is enforced by iOS, not merely promised here. iOS does not tell the app whether you saved or cancelled, so the app cannot know either.

## 5. The only thing the app uses the network for

CardScanner needs its two AI models before it can scan: an on-device text reader (about 37 MB) and a small on-device language model (about 493 MB). These files are not bundled in the app download. On first launch, the app downloads them once from Hugging Face, a public model host. Wi-Fi is recommended. After that download completes, the app does not need the network again.

The open-source library the app is built on, [react-native-executorch](https://github.com/software-mansion/react-native-executorch), maintains a download counter for its models. When those model files are fetched, the library sends a request to a counter operated by its maintainer, Software Mansion, containing:

- the app's bundle identifier (`com.ravinderkumar.cardscanner`)
- the platform (iOS)
- the version of the library
- the name of the model being downloaded
- a country code derived from your device's locale setting
- a true/false flag for whether the app is running in a simulator

That is the complete list. It contains nothing about you, your cards, your photos, your contacts, or anything you scan. It does not include a device identifier, an advertising identifier, an account, a name, or an email address. It happens only when model files are fetched — first launch, or if you delete the models in Settings and download them again. It never happens during a scan.

This is stated here because it is true, and a privacy policy that omitted it would be wrong. Apart from these model downloads, the app makes no network requests.

## 6. What is never transmitted

Card photos, thumbnails, extracted contact fields, raw recognized text, your saved contacts, your History, and your settings never leave your iPhone. They are not sent to the developer, to Hugging Face, to the model download counter, or to any other party.

## 7. No advertising, no tracking, no analytics about how you use the app

CardScanner contains no advertising SDKs, no crash-reporting SDKs, no attribution or tracking SDKs, and no social media SDKs. Nothing measures which screens you open, how many cards you scan, how long you spend in the app, or what a scan produced. It does not use the Advertising Identifier, does not track you across apps or websites, and does not build a profile of you.

The single exception is the model-download counter described in Section 5. Its stated purpose is analytics — counting how often the library's models are downloaded — so this policy will not pretend the app has "no analytics of any kind". What it counts is a model download, not you.

## 8. No selling, no sharing

The developer does not sell, rent, trade, or share your information, because the developer never receives it. There are no advertising partners, data brokers, or third-party recipients of any kind.

## 9. Third parties involved

Two, and both only in connection with the one-time model download:

- **Hugging Face** hosts the AI model files that the app downloads once. Like any website you connect to, it receives the network request needed to serve those files, which necessarily includes your device's IP address. It receives no content from the app. Its own privacy practices are published at https://huggingface.co/privacy.
- **Software Mansion**, the maintainer of the open-source AI library, receives the download-counter message listed in Section 5, at an endpoint on its own domain. Like any server, it sees the IP address the request arrives from. It receives no card, photo, contact or usage information.

There are no other recipients. Nothing is sent to the developer of this app, because the developer runs no server.

Apple's Contacts framework is part of iOS and runs on your device; the New Contact form is provided by iOS, not by a third-party service.

## 10. Deleting your data

You are always in control, and deletion is immediate and local.

- **Delete one scan:** open History, swipe the scan, and delete it. The photo, thumbnail, extracted fields, and raw text for that scan are removed from the device.
- **Delete the AI models:** open Settings, tap **AI models**, and delete them to reclaim the space. You can download them again later from the same screen.
- **Delete everything:** delete the CardScanner app from your iPhone. iOS removes the app and all of its stored data, including all scans and models.

Contacts you already saved through Apple's New Contact form live in your address book, not in CardScanner. Delete those in the Contacts app if you no longer want them.

There is nothing for the developer to delete on your behalf, and no data deletion request to file, because no copy of your data exists outside your device.

## 11. Children's privacy

CardScanner is a business tool intended for general audiences and is not directed at children. It does not knowingly collect personal information from anyone, including children under 13 (or the equivalent age in your country). Since the app collects no personal information at all and has no account system, there is no children's data for the developer to hold, review, or delete.

## 12. Your rights

Privacy laws such as the GDPR and the CCPA give you rights over personal data a company holds about you — access, correction, deletion, portability, and the right to opt out of sale. The developer holds no personal data about you, so there is nothing to access, correct, export, or delete on the developer's side, and nothing is ever sold. Your data lives on your device, where you can view it in History, edit it before saving, and delete it at any time as described in Section 10.

## 13. Security

Your scans are stored in the app's own container on your iPhone, protected by iOS app sandboxing and the device encryption that applies when your iPhone is locked with a passcode, Face ID, or Touch ID. Using a passcode and keeping iOS up to date is the most effective way to protect this data. Because your scans are never transmitted and no copy of them is stored remotely, there is no server holding your data that can be breached and no account that can be taken over.

## 14. Changes to this policy

If this policy changes, the updated version will be published at this URL with a new effective date at the top. Material changes — for example, if the app ever began transmitting something it does not transmit today — will also be described in the app's release notes for the version that introduces the change. Continuing to use the app after an update is subject to the policy then posted. Previous versions are superseded by the current one.

## 15. Contact

Questions about this policy or about how the app handles data:

**yravinderkumar33@gmail.com**

Developer: Ravinder Kumar (individual)
App: CardScanner, version 1.0.0
Bundle identifier: com.ravinderkumar.cardscanner
