# App Store screenshots

Six captioned marketing frames, **1320 × 2868** — the 6.9" iPhone size App Store Connect
requires. Upload in this order; only the first two or three appear in search results, so they
carry the pitch on their own.

| # | File | Caption | Screen shown |
|---|---|---|---|
| 1 | `01-turn-cards-into-contacts.png` | Turn paper cards into contacts — *One photo, about three seconds.* | Capture, card in the guide |
| 2 | `02-ai-runs-on-your-phone.png` | The AI runs on your phone — *Watch every field appear.* | Processing, live token stream at ~24 tok/s |
| 3 | `03-you-check-every-field.png` | You check every field — *Edit anything before it saves.* | Review & edit, AI-filled sparkles |
| 4 | `04-scans-stay-on-device.png` | Past scans stay on the device | History |
| 5 | `05-no-account-no-signup.png` | No account, no sign-up — *Cards never leave the device.* | Privacy explainer |
| 6 | `06-works-with-no-connection.png` | Works with no connection — *After the one-time model download.* | Capture in airplane mode |

## Where these came from

Designed in Claude Design from `../screenshot-design-prompt.md`, then rendered to PNG at exact
size. They are **composed marketing frames**: a caption over a faithful reproduction of the
app's UI in its own design tokens, not raw device captures.

That is normal for App Store screenshots and is why the set looks consistent, but it carries
one obligation — **the frames must keep matching the shipping app.** If a screen changes
materially, regenerate the frame. Apple's metadata rules require screenshots to represent the
app accurately.

## Claim safety

Every caption was checked against what the app actually does:

- Frame 6 says "Works with no connection" and immediately qualifies it with *"After the
  one-time model download"* — the app is not network-free on first launch, and the screenshots
  must not imply otherwise.
- Frame 2 shows a real tokens-per-second figure rather than an invented benchmark.
- No accuracy percentage, no competitor comparison, no pricing claim.
- All demo data is fictional and uses IANA-reserved values: `example.com`, `example.org`,
  `+91 90000 000xx`. No real person, company, domain or phone line appears.

## If you regenerate

Keep 1320 × 2868. The design source lives in the Claude Design project *CardScanner App Store
Frames*; the brief that produced it is `../screenshot-design-prompt.md`. Re-render each frame
element at CSS scale so the pixel size comes out exact.
