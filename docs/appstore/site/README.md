# CardScanner support site — deployment

Two static pages. App Store Connect will not let you submit without both of them live:

| File | Becomes | App Store Connect field |
|------|---------|-------------------------|
| `index.html` | the support page | **Support URL** (required) |
| `privacy.html` | the privacy policy | **Privacy Policy URL** (required, separate field) |

No build step, no dependencies, no JavaScript. Each file carries its own `<style>` block and
loads nothing from any other server, so it works anywhere that can serve a file over HTTPS.

---

## 1. Fill in the two placeholders first

Both pages ship with exactly two placeholder tokens, highlighted in a dashed amber box so you
cannot miss them in a browser:

| Token | Appears in | Replace with |
|-------|-----------|--------------|
| `CONTACT_EMAIL_PLACEHOLDER` | `index.html`, `privacy.html` | the email address you will actually monitor, e.g. `support@yourdomain.com` |
| `EFFECTIVE_DATE_PLACEHOLDER` | `privacy.html` | the date the policy goes live, e.g. `12 August 2026` |

Find and replace across both files:

```sh
cd docs/appstore/site
grep -n "PLACEHOLDER" index.html privacy.html   # see every occurrence first

# macOS / BSD sed
sed -i '' 's/CONTACT_EMAIL_PLACEHOLDER/support@example.com/g' index.html privacy.html
sed -i '' 's/EFFECTIVE_DATE_PLACEHOLDER/12 August 2026/g'      privacy.html

grep -n "PLACEHOLDER" index.html privacy.html   # must print nothing
```

(Grep the two HTML files by name, not the whole folder — this README mentions the token
names itself, so a recursive search will always match.)

Then remove the highlight markup so the replaced values read as normal text: delete the
`<mark class="todo">` and `</mark>` tags wrapping each value (three occurrences in total — one
date and two email addresses). Leaving them in is not fatal, but the amber dashed box makes a
finished page look unfinished to a reviewer.

Optional: once the email is real, you can turn the address on the support page into a link —
`<a href="mailto:you@example.com">you@example.com</a>`.

**Do not** invent a company name, postal address or phone number for these pages. Everything on
them is written for an individual developer, and every factual claim matches
`docs/appstore/privacy-policy.md` exactly. If you change a fact on one page, change it in the
policy source and in the in-app Privacy screen too.

---

## 2. Publish on GitHub Pages

GitHub Pages can only serve from a repository root or from a `/docs` folder, and Pages on a
**private** repository requires a paid GitHub plan. Both URLs must be reachable by anyone with no
login, so the simplest reliable route is a small public repository that contains nothing but these
pages.

### Recommended: a dedicated public repo

1. Create a new **public** repository named `cardscanner-support` (any name works; it becomes part
   of the URL).
2. Copy the two HTML files to the repository root — not into a subfolder:

   ```sh
   cp docs/appstore/site/index.html docs/appstore/site/privacy.html /path/to/cardscanner-support/
   cd /path/to/cardscanner-support
   git add index.html privacy.html
   git commit -m "CardScanner support and privacy pages"
   git push origin main
   ```

3. In that repository on github.com: **Settings** → **Pages** (left sidebar, under "Code and
   automation").
4. Under **Build and deployment**, set **Source** to `Deploy from a branch`.
5. Set **Branch** to `main` and the folder to `/ (root)`, then click **Save**.
6. Wait about a minute. Reload the Settings → Pages screen; it will show
   *"Your site is live at …"* with the URL.

The resulting URLs are:

```
https://<user>.github.io/<repo>/              →  the support page  (index.html is served automatically)
https://<user>.github.io/<repo>/privacy.html  →  the privacy policy
```

With the names above and the GitHub account `ravinderkumar`, that would be
`https://ravinderkumar.github.io/cardscanner-support/` and
`https://ravinderkumar.github.io/cardscanner-support/privacy.html`.

### Alternative: serve from this repository

Only if this repository is (or becomes) **public**. GitHub Pages cannot be pointed at
`docs/appstore/site/`, so at step 5 choose the folder `/docs` instead of `/ (root)`, and the pages
land at:

```
https://<user>.github.io/<repo>/appstore/site/
https://<user>.github.io/<repo>/appstore/site/privacy.html
```

Those URLs are valid but expose the whole `docs/` tree — including `listing.md`,
`review-notes.md` and `app-privacy-answers.md`, which are internal working documents. Prefer the
dedicated repo.

### Custom domain (optional)

If you own a domain, add it under **Settings** → **Pages** → **Custom domain**, create the DNS
records GitHub shows you, and tick **Enforce HTTPS**. The URLs then become
`https://yourdomain.com/` and `https://yourdomain.com/privacy.html`. Everything below works the
same way; just paste the custom-domain URLs instead.

---

## 3. Verify before you submit

Apple's reviewer will open both URLs. Check, in a **private / incognito window** so you are not
signed in to anything:

- [ ] `https://<user>.github.io/<repo>/` loads the support page over HTTPS, with no login prompt.
- [ ] `https://<user>.github.io/<repo>/privacy.html` loads the policy over HTTPS, with no login prompt.
- [ ] The **Privacy policy** link on the support page works, and the **support and FAQ** link at the
      bottom of the policy comes back.
- [ ] No `PLACEHOLDER` text and no amber dashed boxes remain on either page.
- [ ] Both pages read correctly on an iPhone-width screen, in both light and dark appearance
      (they follow the system setting).
- [ ] The contact address is one you actually monitor — the support page promises a reply within
      two to three business days, so either honour that or edit the sentence.

A page that 404s, redirects to a login, or is still building is the single most common reason a
submission is rejected at the metadata stage. Both URLs must be live **before** you hit Submit for
Review, and must stay live for as long as the app is on the store.

---

## 4. Paste the URLs into App Store Connect

**Support URL** — App Store Connect → **My Apps** → CardScanner → the version under **iOS App**
(e.g. *1.0 Prepare for Submission*). Support URL sits with the other version metadata, below
Description and Keywords. Paste:

```
https://<user>.github.io/<repo>/
```

**Privacy Policy URL** — App Store Connect → **My Apps** → CardScanner → **App Privacy** in the
left sidebar → the **Privacy Policy** section → **Edit**. This one is set once for the app, not
per version. Paste:

```
https://<user>.github.io/<repo>/privacy.html
```

**Marketing URL** — leave blank. `docs/appstore/listing.md` §6 explains why: a thin or dead
marketing page is a review risk with no upside.

Both fields take a plain `https://` URL. A `mailto:` address is not accepted for the Support URL.

---

## 5. Keeping the pages honest

These pages are the public copy of `docs/appstore/privacy-policy.md`. If the app ever starts doing
something the policy does not describe — a new permission, a new network request, any analytics —
update, in the same change:

1. `docs/appstore/privacy-policy.md` (the source of truth),
2. `privacy.html` here, with a new effective date at the top,
3. `components/PrivacyScreen.tsx` (the in-app explainer),
4. the App Store description and the App Privacy answers in App Store Connect.

Section 14 of the policy promises that material changes also appear in the release notes of the
version that introduces them.
