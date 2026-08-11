# Visiting Card Scanner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An iPhone POC app that photographs a business card, extracts contact fields fully on-device (OCR → LLM), lets the user review/edit them, and saves via the native iOS "New Contact" form.

**Architecture:** Lean state machine in one root component. The two AI hooks (`useOCR`, `useLLM`) live in a root-level custom hook and never unmount (unmounting `useLLM` mid-generation is a documented crash). All extraction logic is pure, dependency-injected TypeScript in `lib/` — unit-testable on the Mac with no React Native imports. Screens are dumb components selected by the state machine: `loading-models → capture → processing → review → done`.

**Tech Stack:** Expo SDK 55 (TypeScript, New Architecture, custom dev build — no Expo Go), `react-native-executorch@0.9.3` (pinned exact), `react-native-executorch-expo-resource-fetcher`, `expo-camera`, `expo-image-picker`, `expo-contacts`, `zod` v4, `jsonrepair`, Jest + ts-jest.

**Spec:** `docs/superpowers/specs/2026-08-11-card-scanner-design.md`

## Global Constraints

- Expo SDK **55** — NOT the current SDK 57. react-native-executorch 0.9.x supports Expo SDK 54–55 / RN 0.81–0.85 only.
- `react-native-executorch` pinned to exactly **0.9.3** (`--save-exact`); model URLs behind library constants have 404'd in other releases.
- No Expo Go. Build with `npx expo run:ios --device` (custom dev build). New Architecture only (`newArchEnabled: true`).
- `initExecutorch({ resourceFetcher: ExpoResourceFetcher })` must run at app entry (module scope of `App.tsx`) before any other library API.
- The components owning `useOCR`/`useLLM` must NEVER unmount while `isGenerating` is true (documented app crash). Root-level hooks + cancel protocol handle this.
- OCR model: `models.ocr.craft({ language: 'en' })`. LLM: `models.llm.qwen3_0_6b()` (quantized variant is the factory default; 0.47 GB).
- Files in `lib/` must import ONLY from `zod`, `jsonrepair`, or other `lib/` files — never from `react-native`, `expo-*`, or `react-native-executorch` (keeps Jest config trivial; ts-jest cannot parse RN imports). NOTE: this is a deliberate deviation from the spec's mention of the library's `getStructuredOutputPrompt`/`fixAndValidateStructuredOutput` helpers — we implement the same behavior with `jsonrepair` + `zod` directly so it is unit-testable.
- Package manager: npm. Test runner: `npm test` (Jest via ts-jest, tests in `lib/__tests__/`).
- Steps marked **MANUAL** need the user's physical iPhone plugged in — pause and ask the user to run/observe those.
- **Xcode 26.4 ruling (user-approved 2026-08-11):** this Mac has Xcode 26.4 (Clang 21), which breaks RN builds via fmt consteval errors (react-native-executorch#1081). Approved workaround instead of downgrading: an Expo config plugin (`plugins/withFmtConstevalPatch.js`, added in Task 3) injects `FMT_USE_CONSTEVAL=0` + C++17 into the `fmt`/`RCT-Folly` pods inside the generated Podfile's `post_install` hook. Do NOT stop on the Xcode version check; if the Task 3 device build still fails after the patch, THEN stop and escalate (fallback: user downgrades Xcode).

---

### Task 1: Scaffold Expo SDK 55 app at repo root

**Files:**
- Create: entire Expo template (`App.tsx`, `index.ts`, `app.json`, `package.json`, `tsconfig.json`, `assets/`, …) at repo root
- Modify: `package.json`, `app.json` (rename app), `.gitignore`

**Interfaces:**
- Consumes: nothing (repo currently holds only `docs/`)
- Produces: a bootable Expo SDK 55 TypeScript app; `npx tsc --noEmit` passes

- [ ] **Step 1: Verify environment**

```bash
node --version          # expect >= 20
xcodebuild -version     # expect Xcode <= 26.3 — Xcode 26.4/Clang 21 breaks RN builds (react-native-executorch issue #1081)
npm view expo-template-blank-typescript dist-tags --json
```

Expected: dist-tags JSON contains an `"sdk-55"` key. Xcode 26.4 is present and APPROVED per the Global Constraints ruling (Podfile patch lands in Task 3) — do not stop on it. If `sdk-55` tag is missing, STOP and report (fall back to `sdk-54` only with user approval).

- [ ] **Step 2: Scaffold via temp dir (repo root is not empty — it has docs/ and .git/)**

```bash
cd /Users/ravinderkumar/personal/pocs/executorch
npx create-expo-app@latest scaffold-tmp --template blank-typescript@sdk-55 --no-install
rsync -a --exclude='.git' scaffold-tmp/ .
rm -rf scaffold-tmp
npm install
```

- [ ] **Step 3: Rename app and ignore native dirs**

In `package.json` set `"name": "card-scanner"`. In `app.json` set `"name": "CardScanner"`, `"slug": "card-scanner"`. Append to `.gitignore` (if not already present):

```
/ios
/android
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
npm ls expo
```

Expected: tsc exits 0; `expo@55.x.x`.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore: scaffold Expo SDK 55 blank-typescript app"
```

---

### Task 2: Pinned dependencies, ExecuTorch init, app config

**Files:**
- Modify: `package.json` (deps), `app.json` (plugins, iOS config), `App.tsx` (init call)

**Interfaces:**
- Consumes: Task 1 scaffold
- Produces: `initExecutorch` wired at module scope of `App.tsx`; all runtime deps installed; camera/contacts permission strings configured

- [ ] **Step 1: Install dependencies**

```bash
npm install --save-exact react-native-executorch@0.9.3
npm install react-native-executorch-expo-resource-fetcher
npx expo install expo-file-system expo-asset expo-camera expo-image-picker expo-contacts expo-dev-client
npm install zod jsonrepair
npm install -D jest ts-jest @types/jest
```

- [ ] **Step 2: Configure app.json**

Merge into the `"expo"` object (keep existing keys):

```json
{
  "newArchEnabled": true,
  "ios": {
    "bundleIdentifier": "com.ravinderkumar.cardscanner",
    "supportsTablet": false
  },
  "plugins": [
    ["expo-camera", { "cameraPermission": "CardScanner uses the camera to photograph business cards." }],
    ["expo-contacts", { "contactsPermission": "CardScanner saves scanned business cards to your contacts." }]
  ]
}
```

- [ ] **Step 3: Wire initExecutorch at app entry**

Replace `App.tsx` with:

```tsx
import { initExecutorch } from 'react-native-executorch';
import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

// Must run before any other react-native-executorch API (module scope = app entry).
initExecutorch({ resourceFetcher: ExpoResourceFetcher });

export default function App() {
  return (
    <View style={styles.container}>
      <Text>CardScanner — ExecuTorch initialized</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
});
```

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit
npm ls react-native-executorch   # expect exactly 0.9.3
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add pinned executorch deps, init call, iOS permissions config"
```

---

### Task 3: MANUAL — iOS device smoke test

**Files:**
- Create: `plugins/withFmtConstevalPatch.js` (Xcode 26.4 workaround — see Global Constraints ruling)
- Modify: `app.json` (register the plugin)

**Interfaces:**
- Consumes: Tasks 1–2
- Produces: confirmed working native build chain (Xcode 26.4 + patched pods, New Arch, ExecuTorch init) on the user's iPhone

- [ ] **Step 0: Add the fmt-consteval Podfile patch plugin**

Create `plugins/withFmtConstevalPatch.js`:

```js
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Xcode 26.4 / Apple Clang 21 breaks fmt's consteval formatting in RN pods
// (react-native-executorch#1081, facebook/react-native#55601). Same workaround
// the library's own example app uses, injected into the generated Podfile's
// post_install hook so it survives `expo prebuild --clean`.
const PATCH = `    # Xcode 26.4 fmt-consteval workaround (react-native-executorch#1081)
    installer.pods_project.targets.each do |target|
      if target.name == 'fmt' || target.name == 'RCT-Folly'
        target.build_configurations.each do |config|
          config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
          config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] ||= ['$(inherited)']
          config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] << 'FMT_USE_CONSTEVAL=0'
        end
      end
    end
`;

module.exports = function withFmtConstevalPatch(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf8');
      if (!contents.includes('FMT_USE_CONSTEVAL')) {
        // Insert inside the existing post_install block (a second post_install
        // block would be a CocoaPods error).
        contents = contents.replace(/post_install do \|installer\|\n/, (m) => m + PATCH);
        fs.writeFileSync(podfilePath, contents);
      }
      return cfg;
    },
  ]);
};
```

In `app.json`, append `"./plugins/withFmtConstevalPatch"` to the `"plugins"` array.

Also set the iOS deployment target to 17.0 — react-native-executorch 0.9.3's podspec
requires `:ios => '17.0'` and the generated Podfile otherwise defaults to 15.1,
failing pod install (discovered during execution; the user's iPhone must run iOS 17+):

```bash
npx expo install expo-build-properties
```

and add to the app.json `"plugins"` array:

```json
["expo-build-properties", { "ios": { "deploymentTarget": "17.0" } }]
```

Then verify the plugin fires and the patch lands:

```bash
npx expo prebuild -p ios --clean
grep -n 'FMT_USE_CONSTEVAL' ios/Podfile
grep -n 'deploymentTarget' ios/Podfile.properties.json
```

Expected: pod install succeeds; grep finds the patch inside the Podfile's `post_install`
block; deploymentTarget is 17.0. (Note: prebuild also rewrites package.json's
`ios`/`android` scripts to `expo run:*` — commit that too.) Commit:

```bash
git add plugins/ app.json package.json package-lock.json && git commit -m "fix: Podfile patch for Xcode 26.4 fmt consteval break (config plugin)"
```

- [ ] **Step 1: MANUAL — build and run on the user's iPhone**

Ask the user to plug in their iPhone (unlocked, developer mode enabled), then run:

```bash
npx expo run:ios --device
```

First build takes 5–10 minutes. If Xcode signing fails, the user selects their personal team in the generated `ios/*.xcworkspace` once, then re-runs.

- [ ] **Step 2: MANUAL — verify**

Expected on device: screen shows "CardScanner — ExecuTorch initialized". Metro console shows NO `ResourceFetcherAdapterNotInitialized` error and no crash.

- [ ] **Step 3: Commit (any incidental config changes)**

```bash
git add -A && git commit -m "chore: device smoke test config" --allow-empty
```

---

### Task 4: Jest setup + contact fields schema (TDD)

**Files:**
- Create: `jest.config.js`, `lib/schema.ts`, `lib/__tests__/schema.test.ts`
- Modify: `package.json` (test script)

**Interfaces:**
- Consumes: zod
- Produces: `contactFieldsSchema` (Zod schema), `type RawContactFields`, `interface ContactFields { firstName?: string; lastName?: string; company?: string; jobTitle?: string; phones: string[]; emails: string[]; website?: string; address?: string }`, `normalizeContactFields(raw: RawContactFields): ContactFields`, `emptyContactFields(): ContactFields`

- [ ] **Step 1: Jest config**

Create `jest.config.js`:

```js
/** Tests cover only pure logic in lib/ — no React Native imports allowed there. */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/lib'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      { tsconfig: { module: 'commonjs', moduleResolution: 'node', esModuleInterop: true, strict: true, target: 'es2020' } },
    ],
  },
};
```

In `package.json` add `"test": "jest"` to `"scripts"`.

- [ ] **Step 2: Write the failing test**

Create `lib/__tests__/schema.test.ts`:

```ts
import { contactFieldsSchema, normalizeContactFields, emptyContactFields } from '../schema';

describe('contactFieldsSchema', () => {
  it('accepts a full payload', () => {
    const raw = contactFieldsSchema.parse({
      firstName: 'Jane', lastName: 'Doe', company: 'Acme', jobTitle: 'CTO',
      phones: ['+91 98765 43210'], emails: ['jane@acme.com'],
      website: 'https://acme.com', address: '1 Main St, Pune',
    });
    expect(raw.firstName).toBe('Jane');
  });

  it('accepts nulls for absent fields (the prompt tells the model to use null)', () => {
    const raw = contactFieldsSchema.parse({ firstName: 'Jane', lastName: null, phones: null, emails: null });
    expect(raw.lastName).toBeNull();
  });

  it('accepts missing keys', () => {
    expect(() => contactFieldsSchema.parse({})).not.toThrow();
  });

  it('rejects wrong shapes', () => {
    expect(() => contactFieldsSchema.parse({ phones: 'not-an-array' })).toThrow();
    expect(() => contactFieldsSchema.parse({ firstName: 42 })).toThrow();
  });
});

describe('normalizeContactFields', () => {
  it('maps null/missing to undefined and null arrays to []', () => {
    const f = normalizeContactFields({ firstName: 'Jane', lastName: null, phones: null });
    expect(f.firstName).toBe('Jane');
    expect(f.lastName).toBeUndefined();
    expect(f.phones).toEqual([]);
    expect(f.emails).toEqual([]);
  });

  it('preserves provided arrays', () => {
    const f = normalizeContactFields({ phones: ['123'], emails: ['a@b.c'] });
    expect(f.phones).toEqual(['123']);
    expect(f.emails).toEqual(['a@b.c']);
  });
});

describe('emptyContactFields', () => {
  it('returns all-empty fields', () => {
    expect(emptyContactFields()).toEqual({ phones: [], emails: [] });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- schema`
Expected: FAIL — cannot find module '../schema'.

- [ ] **Step 4: Implement**

Create `lib/schema.ts`:

```ts
import { z } from 'zod';

// All fields nullable AND optional: the prompt instructs the model to use null
// for absent fields, so the schema must accept null (spec §5).
export const contactFieldsSchema = z.object({
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  jobTitle: z.string().nullable().optional(),
  phones: z.array(z.string()).nullable().optional(),
  emails: z.array(z.string()).nullable().optional(),
  website: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
});

export type RawContactFields = z.infer<typeof contactFieldsSchema>;

export interface ContactFields {
  firstName?: string;
  lastName?: string;
  company?: string;
  jobTitle?: string;
  phones: string[];
  emails: string[];
  website?: string;
  address?: string;
}

const str = (v: string | null | undefined): string | undefined => (v == null || v === '' ? undefined : v);

export function normalizeContactFields(raw: RawContactFields): ContactFields {
  const out: ContactFields = {
    phones: raw.phones ?? [],
    emails: raw.emails ?? [],
  };
  const firstName = str(raw.firstName);
  if (firstName) out.firstName = firstName;
  const lastName = str(raw.lastName);
  if (lastName) out.lastName = lastName;
  const company = str(raw.company);
  if (company) out.company = company;
  const jobTitle = str(raw.jobTitle);
  if (jobTitle) out.jobTitle = jobTitle;
  const website = str(raw.website);
  if (website) out.website = website;
  const address = str(raw.address);
  if (address) out.address = address;
  return out;
}

export function emptyContactFields(): ContactFields {
  return { phones: [], emails: [] };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- schema`
Expected: PASS (all tests).

- [ ] **Step 6: Commit**

```bash
git add jest.config.js package.json package-lock.json lib/
git commit -m "feat: contact fields schema with null-tolerant normalization (TDD)"
```

---

### Task 5: OCR post-processing (TDD)

**Files:**
- Create: `lib/ocrToText.ts`, `lib/__tests__/ocrToText.test.ts`

**Interfaces:**
- Consumes: nothing (pure; defines its own structural `Detection` type, deliberately NOT imported from react-native-executorch — structurally compatible with its `OCRDetection`)
- Produces: `interface Detection { bbox: { x1: number; y1: number; x2: number; y2: number }; text: string; score: number }`, `ocrToText(detections: Detection[], opts?: { minScore?: number; maxChars?: number }): string`

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/ocrToText.test.ts`:

```ts
import { ocrToText, Detection } from '../ocrToText';

const d = (x1: number, y1: number, x2: number, y2: number, text: string, score = 0.9): Detection => ({
  bbox: { x1, y1, x2, y2 }, text, score,
});

describe('ocrToText', () => {
  it('orders lines top to bottom', () => {
    const out = ocrToText([d(0, 100, 50, 120, 'second'), d(0, 10, 50, 30, 'first')]);
    expect(out).toBe('first\nsecond');
  });

  it('orders words left to right within a line even if input is scrambled (library issue #1159 regression)', () => {
    // Same y-band, deliberately out of x order:
    const out = ocrToText([d(200, 10, 260, 30, 'jane@acme.com'), d(0, 12, 60, 32, 'Email:')]);
    expect(out).toBe('Email: jane@acme.com');
  });

  it('groups slightly misaligned boxes into one line (y-centers within half box height)', () => {
    const out = ocrToText([d(0, 10, 50, 30, 'Jane'), d(60, 14, 120, 34, 'Doe'), d(0, 60, 80, 80, 'Acme Corp')]);
    expect(out).toBe('Jane Doe\nAcme Corp');
  });

  it('drops low-confidence detections (default minScore 0.3)', () => {
    const out = ocrToText([d(0, 10, 50, 30, 'keep', 0.9), d(60, 10, 120, 30, 'noise', 0.1)]);
    expect(out).toBe('keep');
  });

  it('caps output length (default 1500 chars, context-overflow guard)', () => {
    const long = Array.from({ length: 300 }, (_, i) => d(0, i * 40, 100, i * 40 + 20, 'wordwordword'));
    expect(ocrToText(long).length).toBeLessThanOrEqual(1500);
  });

  it('returns empty string for no usable detections', () => {
    expect(ocrToText([])).toBe('');
    expect(ocrToText([d(0, 0, 10, 10, 'x', 0.05)])).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- ocrToText`
Expected: FAIL — cannot find module '../ocrToText'.

- [ ] **Step 3: Implement**

Create `lib/ocrToText.ts`:

```ts
// Structurally compatible with react-native-executorch's OCRDetection —
// defined locally so lib/ stays free of React Native imports (testability).
export interface Detection {
  bbox: { x1: number; y1: number; x2: number; y2: number };
  text: string;
  score: number;
}

const centerY = (det: Detection) => (det.bbox.y1 + det.bbox.y2) / 2;
const height = (det: Detection) => Math.abs(det.bbox.y2 - det.bbox.y1);

export function ocrToText(
  detections: Detection[],
  opts: { minScore?: number; maxChars?: number } = {}
): string {
  const { minScore = 0.3, maxChars = 1500 } = opts;

  const kept = detections.filter((det) => det.score >= minScore);
  const sorted = [...kept].sort((a, b) => centerY(a) - centerY(b));

  // Band into lines: a detection joins the current line if its y-center is
  // within half a box height of the line's first box. Defensive re-sort within
  // each line: the library once returned scrambled within-line order (#1159).
  const lines: Detection[][] = [];
  for (const det of sorted) {
    const current = lines[lines.length - 1];
    if (current && Math.abs(centerY(det) - centerY(current[0])) <= height(current[0]) / 2) {
      current.push(det);
    } else {
      lines.push([det]);
    }
  }

  const text = lines
    .map((line) => [...line].sort((a, b) => a.bbox.x1 - b.bbox.x1).map((det) => det.text).join(' '))
    .join('\n');

  return text.slice(0, maxChars);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- ocrToText`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/ && git commit -m "feat: OCR detections to ordered text with score filter and length cap (TDD)"
```

---

### Task 6: Model JSON parsing (TDD)

**Files:**
- Create: `lib/parseModelJson.ts`, `lib/__tests__/parseModelJson.test.ts`

**Interfaces:**
- Consumes: `jsonrepair`; `contactFieldsSchema`, `normalizeContactFields`, `ContactFields` from `lib/schema.ts`
- Produces: `parseModelJson(text: string): ContactFields` — throws `Error` with a descriptive message when the text cannot be turned into valid fields

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/parseModelJson.test.ts`:

```ts
import { parseModelJson } from '../parseModelJson';

describe('parseModelJson', () => {
  it('parses clean JSON', () => {
    const f = parseModelJson('{"firstName":"Jane","lastName":"Doe","phones":["123"],"emails":null}');
    expect(f.firstName).toBe('Jane');
    expect(f.phones).toEqual(['123']);
    expect(f.emails).toEqual([]);
  });

  it('strips markdown code fences', () => {
    const f = parseModelJson('```json\n{"firstName":"Jane"}\n```');
    expect(f.firstName).toBe('Jane');
  });

  it('strips <think> blocks (Qwen reasoning leakage)', () => {
    const f = parseModelJson('<think>the name is Jane</think>{"firstName":"Jane"}');
    expect(f.firstName).toBe('Jane');
  });

  it('repairs almost-JSON (trailing commas, single quotes)', () => {
    const f = parseModelJson("{'firstName': 'Jane', 'phones': ['123',],}");
    expect(f.firstName).toBe('Jane');
    expect(f.phones).toEqual(['123']);
  });

  it('extracts the JSON object from surrounding prose', () => {
    const f = parseModelJson('Here is the contact: {"firstName":"Jane"} Hope this helps!');
    expect(f.firstName).toBe('Jane');
  });

  it('throws on unusable text', () => {
    expect(() => parseModelJson('I could not read the card, sorry.')).toThrow();
  });

  it('throws on schema-violating JSON', () => {
    expect(() => parseModelJson('{"phones": "12345"}')).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- parseModelJson`
Expected: FAIL — cannot find module '../parseModelJson'.

- [ ] **Step 3: Implement**

Create `lib/parseModelJson.ts`:

```ts
import { jsonrepair } from 'jsonrepair';
import { ContactFields, contactFieldsSchema, normalizeContactFields } from './schema';

// Same job as the library's fixAndValidateStructuredOutput (jsonrepair + schema
// validation), reimplemented here so lib/ has no react-native-executorch import.
export function parseModelJson(text: string): ContactFields {
  let cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/```(?:json)?/g, '')
    .trim();

  // Isolate the outermost {...} if the model wrapped it in prose.
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1) throw new Error('No JSON object found in model output');
  cleaned = cleaned.slice(start, end === -1 ? undefined : end + 1);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonrepair(cleaned));
  } catch (e) {
    throw new Error(`Could not repair model output into JSON: ${(e as Error).message}`);
  }

  const result = contactFieldsSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Model output does not match contact schema: ${result.error.message}`);
  }
  return normalizeContactFields(result.data);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- parseModelJson`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/ && git commit -m "feat: repair-and-validate parser for LLM JSON output (TDD)"
```

---

### Task 7: Prompt builders (TDD)

**Files:**
- Create: `lib/prompt.ts`, `lib/__tests__/prompt.test.ts`

**Interfaces:**
- Consumes: nothing (pure strings)
- Produces: `buildSystemPrompt(): string`, `buildUserMessage(rawText: string): string`, `buildRetryUserMessage(rawText: string, errorMessage: string): string`

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/prompt.test.ts`:

```ts
import { buildSystemPrompt, buildUserMessage, buildRetryUserMessage } from '../prompt';

describe('buildSystemPrompt', () => {
  const prompt = buildSystemPrompt();

  it('describes every schema field', () => {
    for (const key of ['firstName', 'lastName', 'company', 'jobTitle', 'phones', 'emails', 'website', 'address']) {
      expect(prompt).toContain(key);
    }
  });

  it('instructs null for absent fields and forbids invention', () => {
    expect(prompt).toContain('null');
    expect(prompt.toLowerCase()).toContain('do not invent');
  });

  it('ends with /no_think (Qwen 3 reasoning off)', () => {
    expect(prompt.trimEnd().endsWith('/no_think')).toBe(true);
  });
});

describe('buildUserMessage', () => {
  it('embeds the OCR text', () => {
    expect(buildUserMessage('ACME CORP\nJane Doe')).toContain('ACME CORP\nJane Doe');
  });
});

describe('buildRetryUserMessage', () => {
  it('embeds OCR text and the validation error', () => {
    const msg = buildRetryUserMessage('ACME', 'phones must be an array');
    expect(msg).toContain('ACME');
    expect(msg).toContain('phones must be an array');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- prompt`
Expected: FAIL — cannot find module '../prompt'.

- [ ] **Step 3: Implement**

Create `lib/prompt.ts`:

```ts
const JSON_SHAPE = `{
  "firstName": string | null,
  "lastName": string | null,
  "company": string | null,
  "jobTitle": string | null,
  "phones": string[] | null,
  "emails": string[] | null,
  "website": string | null,
  "address": string | null
}`;

export function buildSystemPrompt(): string {
  return [
    'You extract contact information from the OCR text of a business card.',
    'Respond with ONLY a single JSON object — no explanations, no markdown fences — matching exactly this shape:',
    JSON_SHAPE,
    'Rules: use null for any field not present on the card. Do not invent data.',
    'Keep phone numbers and emails exactly as written. Put the person\'s given name in firstName and family name in lastName.',
    '/no_think',
  ].join('\n\n');
}

export function buildUserMessage(rawText: string): string {
  return `Business card OCR text:\n\n${rawText}`;
}

export function buildRetryUserMessage(rawText: string, errorMessage: string): string {
  return [
    `Business card OCR text:\n\n${rawText}`,
    `Your previous answer was not valid JSON for the required shape (error: ${errorMessage}).`,
    'Respond again with ONLY the JSON object.',
  ].join('\n\n');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- prompt`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/ && git commit -m "feat: system/user/retry prompt builders (TDD)"
```

---

### Task 8: Extraction orchestrator with injected deps (TDD)

**Files:**
- Create: `lib/extraction.ts`, `lib/__tests__/extraction.test.ts`

**Interfaces:**
- Consumes: `ocrToText`, `Detection` (Task 5); `parseModelJson` (Task 6); prompt builders (Task 7); `ContactFields` (Task 4)
- Produces:
  - `interface Msg { role: 'system' | 'user'; content: string }`
  - `interface ExtractionDeps { ocrForward(imageUri: string): Promise<Detection[]>; llmGenerate(messages: Msg[]): Promise<string> }`
  - `type ExtractionResult = { status: 'ok'; fields: ContactFields; rawText: string } | { status: 'no-text' } | { status: 'unparsed'; rawText: string }`
  - `extractContact(deps: ExtractionDeps, imageUri: string): Promise<ExtractionResult>`

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/extraction.test.ts`:

```ts
import { extractContact, ExtractionDeps } from '../extraction';
import { Detection } from '../ocrToText';

const det = (text: string, index: number): Detection => ({
  bbox: { x1: 0, y1: index * 40, x2: 100, y2: index * 40 + 20 }, text, score: 0.9,
});
const CARD = [det('Jane Doe', 0), det('CTO, Acme Corp', 1), det('jane@acme.com', 2)];
const GOOD_JSON = '{"firstName":"Jane","lastName":"Doe","company":"Acme Corp","jobTitle":"CTO","phones":null,"emails":["jane@acme.com"],"website":null,"address":null}';

describe('extractContact', () => {
  it('happy path: ocr → llm → validated fields', async () => {
    const llmCalls: { role: string; content: string }[][] = [];
    const deps: ExtractionDeps = {
      ocrForward: async () => CARD,
      llmGenerate: async (msgs) => { llmCalls.push(msgs); return GOOD_JSON; },
    };
    const result = await extractContact(deps, 'file:///card.jpg');
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.fields.firstName).toBe('Jane');
      expect(result.fields.emails).toEqual(['jane@acme.com']);
      expect(result.rawText).toContain('Jane Doe');
    }
    expect(llmCalls).toHaveLength(1);
    expect(llmCalls[0][0].role).toBe('system');
    expect(llmCalls[0][1].content).toContain('Jane Doe');
  });

  it('returns no-text when OCR yields nothing usable', async () => {
    const deps: ExtractionDeps = {
      ocrForward: async () => [],
      llmGenerate: async () => { throw new Error('must not be called'); },
    };
    expect((await extractContact(deps, 'x')).status).toBe('no-text');
  });

  it('retries once with the validation error, then succeeds', async () => {
    let call = 0;
    const contents: string[] = [];
    const deps: ExtractionDeps = {
      ocrForward: async () => CARD,
      llmGenerate: async (msgs) => {
        contents.push(msgs[1].content);
        call += 1;
        return call === 1 ? 'garbage, no json here' : GOOD_JSON;
      },
    };
    const result = await extractContact(deps, 'x');
    expect(result.status).toBe('ok');
    expect(call).toBe(2);
    expect(contents[1]).toContain('previous answer was not valid');
  });

  it('degrades to unparsed (with rawText) after two failures', async () => {
    const deps: ExtractionDeps = {
      ocrForward: async () => CARD,
      llmGenerate: async () => 'still garbage',
    };
    const result = await extractContact(deps, 'x');
    expect(result.status).toBe('unparsed');
    if (result.status === 'unparsed') expect(result.rawText).toContain('Jane Doe');
  });

  it('treats a thrown llmGenerate as a failed attempt (e.g. context overflow error 18)', async () => {
    const deps: ExtractionDeps = {
      ocrForward: async () => CARD,
      llmGenerate: async () => { throw new Error('Failed to generate text, error code: 18'); },
    };
    expect((await extractContact(deps, 'x')).status).toBe('unparsed');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- extraction`
Expected: FAIL — cannot find module '../extraction'.

- [ ] **Step 3: Implement**

Create `lib/extraction.ts`:

```ts
import { ContactFields } from './schema';
import { Detection, ocrToText } from './ocrToText';
import { parseModelJson } from './parseModelJson';
import { buildRetryUserMessage, buildSystemPrompt, buildUserMessage } from './prompt';

export interface Msg {
  role: 'system' | 'user';
  content: string;
}

export interface ExtractionDeps {
  ocrForward(imageUri: string): Promise<Detection[]>;
  llmGenerate(messages: Msg[]): Promise<string>;
}

export type ExtractionResult =
  | { status: 'ok'; fields: ContactFields; rawText: string }
  | { status: 'no-text' }
  | { status: 'unparsed'; rawText: string };

export async function extractContact(deps: ExtractionDeps, imageUri: string): Promise<ExtractionResult> {
  const detections = await deps.ocrForward(imageUri);
  const rawText = ocrToText(detections);
  if (rawText.trim() === '') return { status: 'no-text' };

  const system: Msg = { role: 'system', content: buildSystemPrompt() };

  let lastError = '';
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const user: Msg = {
      role: 'user',
      content: attempt === 0 ? buildUserMessage(rawText) : buildRetryUserMessage(rawText, lastError),
    };
    try {
      const response = await deps.llmGenerate([system, user]);
      return { status: 'ok', fields: parseModelJson(response), rawText };
    } catch (e) {
      lastError = (e as Error).message;
    }
  }
  return { status: 'unparsed', rawText };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- extraction`
Expected: PASS.

- [ ] **Step 5: Run the whole suite and commit**

Run: `npm test` — expected: all suites pass.

```bash
git add lib/ && git commit -m "feat: extraction orchestrator with retry and graceful degradation (TDD)"
```

---

### Task 9: Contact mapping (TDD)

**Files:**
- Create: `lib/contactMapping.ts`, `lib/__tests__/contactMapping.test.ts`

**Interfaces:**
- Consumes: `ContactFields` (Task 4)
- Produces: `interface ExpoContactShape { contactType: 'person'; firstName?: string; lastName?: string; company?: string; jobTitle?: string; phoneNumbers?: { number: string; label: string }[]; emails?: { email: string; label: string }[]; urlAddresses?: { url: string; label: string }[]; addresses?: { street: string; label: string }[] }`, `toExpoContact(fields: ContactFields): ExpoContactShape` (pure — the expo-contacts side-effect wrapper comes in Task 13)

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/contactMapping.test.ts`:

```ts
import { toExpoContact } from '../contactMapping';

describe('toExpoContact', () => {
  it('maps all fields with work labels', () => {
    const c = toExpoContact({
      firstName: 'Jane', lastName: 'Doe', company: 'Acme', jobTitle: 'CTO',
      phones: ['+91 98765', '020 123'], emails: ['jane@acme.com'],
      website: 'https://acme.com', address: '1 Main St',
    });
    expect(c).toEqual({
      contactType: 'person',
      firstName: 'Jane', lastName: 'Doe', company: 'Acme', jobTitle: 'CTO',
      phoneNumbers: [{ number: '+91 98765', label: 'work' }, { number: '020 123', label: 'work' }],
      emails: [{ email: 'jane@acme.com', label: 'work' }],
      urlAddresses: [{ url: 'https://acme.com', label: 'work' }],
      addresses: [{ street: '1 Main St', label: 'work' }],
    });
  });

  it('omits empty arrays and undefined fields entirely', () => {
    const c = toExpoContact({ firstName: 'Jane', phones: [], emails: [] });
    expect(c).toEqual({ contactType: 'person', firstName: 'Jane' });
    expect(c).not.toHaveProperty('phoneNumbers');
    expect(c).not.toHaveProperty('emails');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- contactMapping`
Expected: FAIL — cannot find module '../contactMapping'.

- [ ] **Step 3: Implement**

Create `lib/contactMapping.ts`:

```ts
import { ContactFields } from './schema';

// Shape accepted by expo-contacts' presentFormAsync contact argument.
// Typed locally so lib/ has no expo import; 'person' === Contacts.ContactTypes.Person.
export interface ExpoContactShape {
  contactType: 'person';
  firstName?: string;
  lastName?: string;
  company?: string;
  jobTitle?: string;
  phoneNumbers?: { number: string; label: string }[];
  emails?: { email: string; label: string }[];
  urlAddresses?: { url: string; label: string }[];
  addresses?: { street: string; label: string }[];
}

export function toExpoContact(fields: ContactFields): ExpoContactShape {
  const contact: ExpoContactShape = { contactType: 'person' };
  if (fields.firstName) contact.firstName = fields.firstName;
  if (fields.lastName) contact.lastName = fields.lastName;
  if (fields.company) contact.company = fields.company;
  if (fields.jobTitle) contact.jobTitle = fields.jobTitle;
  if (fields.phones.length > 0) {
    contact.phoneNumbers = fields.phones.map((number) => ({ number, label: 'work' }));
  }
  if (fields.emails.length > 0) {
    contact.emails = fields.emails.map((email) => ({ email, label: 'work' }));
  }
  if (fields.website) contact.urlAddresses = [{ url: fields.website, label: 'work' }];
  if (fields.address) contact.addresses = [{ street: fields.address, label: 'work' }];
  return contact;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- contactMapping`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/ && git commit -m "feat: pure ContactFields to expo-contacts mapping (TDD)"
```

---

### Task 10: Scanner pipeline hook + model loading screen + app shell

**Files:**
- Create: `hooks/useScannerPipeline.ts`, `components/ModelLoadingScreen.tsx`, `components/Scanner.tsx`
- Modify: `App.tsx`

**Interfaces:**
- Consumes: `useOCR`, `useLLM`, `models` from react-native-executorch; `extractContact`, `Msg` (Task 8); `ContactFields`, `emptyContactFields` (Task 4)
- Produces (used by Tasks 11–13):
  - `type Phase = 'loading-models' | 'capture' | 'processing' | 'review' | 'done'`
  - `type Stage = 'ocr' | 'llm'`
  - `useScannerPipeline(): { phase: Phase; stage: Stage; ocrProgress: number; llmProgress: number; modelError: string | null; streamText: string; fields: ContactFields; rawText: string; degraded: boolean; scanError: string | null; scanCard(imageUri: string): Promise<void>; cancel(): void; rescan(): void; finishSave(): void; reset(): void }`
  - `ModelLoadingScreen({ ocrProgress, llmProgress, error, onRetry }: { ocrProgress: number; llmProgress: number; error: string | null; onRetry(): void })`
  - `Scanner({ onRetryModels }: { onRetryModels(): void })`

- [ ] **Step 1: Implement the pipeline hook**

Create `hooks/useScannerPipeline.ts`:

```ts
import { useEffect, useRef, useState } from 'react';
import { models, useLLM, useOCR } from 'react-native-executorch';
import { extractContact, Msg } from '../lib/extraction';
import { ContactFields, emptyContactFields } from '../lib/schema';

export type Phase = 'loading-models' | 'capture' | 'processing' | 'review' | 'done';
export type Stage = 'ocr' | 'llm';

export function useScannerPipeline() {
  // Root-level model hooks — they must never unmount (documented crash if
  // unmounted while generating). Scanner is rendered for the app's lifetime.
  const ocr = useOCR({ model: models.ocr.craft({ language: 'en' }) });
  const llm = useLLM({ model: models.llm.qwen3_0_6b() });

  const [phase, setPhase] = useState<Phase>('loading-models');
  const [stage, setStage] = useState<Stage>('ocr');
  const [fields, setFields] = useState<ContactFields>(emptyContactFields());
  const [rawText, setRawText] = useState('');
  const [degraded, setDegraded] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (phase === 'loading-models' && ocr.isReady && llm.isReady) {
      setPhase('capture');
    }
  }, [phase, ocr.isReady, llm.isReady]);

  const scanCard = async (imageUri: string) => {
    cancelledRef.current = false;
    setScanError(null);
    setDegraded(false);
    setStage('ocr');
    setPhase('processing');
    try {
      const result = await extractContact(
        {
          ocrForward: async (uri) => {
            const detections = await ocr.forward(uri);
            if (!cancelledRef.current) setStage('llm');
            return detections;
          },
          llmGenerate: (messages: Msg[]) => llm.generate(messages),
        },
        imageUri
      );
      if (cancelledRef.current) return; // cancel() already set the phase
      if (result.status === 'no-text') {
        setScanError("Couldn't read the card. Try a sharper, closer photo.");
        setPhase('capture');
      } else {
        setFields(result.status === 'ok' ? result.fields : emptyContactFields());
        setRawText(result.rawText);
        setDegraded(result.status === 'unparsed');
        setPhase('review');
      }
    } catch (e) {
      if (cancelledRef.current) return;
      setScanError(`Scan failed: ${(e as Error).message}`);
      setPhase('capture');
    }
  };

  const cancel = () => {
    cancelledRef.current = true;
    if (llm.isGenerating) llm.interrupt(); // in-flight generate() settles after this
    setPhase('capture');
  };

  return {
    phase,
    stage,
    ocrProgress: ocr.downloadProgress,
    llmProgress: llm.downloadProgress,
    modelError: ocr.error ? String(ocr.error) : llm.error ? String(llm.error) : null,
    streamText: llm.response,
    fields,
    rawText,
    degraded,
    scanError,
    scanCard,
    cancel,
    rescan: () => setPhase('capture'),
    finishSave: () => setPhase('done'),
    reset: () => {
      setFields(emptyContactFields());
      setRawText('');
      setDegraded(false);
      setScanError(null);
      setPhase('capture');
    },
  };
}
```

- [ ] **Step 2: Implement the model loading screen**

Create `components/ModelLoadingScreen.tsx`:

```tsx
import { Button, StyleSheet, Text, View } from 'react-native';

function Bar({ label, progress }: { label: string; progress: number }) {
  return (
    <View style={styles.barBlock}>
      <Text style={styles.barLabel}>
        {label} {Math.round(progress * 100)}%
      </Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>
    </View>
  );
}

export function ModelLoadingScreen({
  ocrProgress,
  llmProgress,
  error,
  onRetry,
}: {
  ocrProgress: number;
  llmProgress: number;
  error: string | null;
  onRetry(): void;
}) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Preparing on-device AI</Text>
      <Text style={styles.subtitle}>One-time download (~0.5 GB) — cached after this.</Text>
      <Bar label="Text reader (OCR)" progress={ocrProgress} />
      <Bar label="Language model" progress={llmProgress} />
      {error != null && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>Download failed: {error}</Text>
          <Button title="Retry" onPress={onRetry} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 24 },
  barBlock: { marginBottom: 16 },
  barLabel: { fontSize: 14, marginBottom: 6 },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: '#eee', overflow: 'hidden' },
  barFill: { height: 8, backgroundColor: '#2563eb' },
  errorBox: { marginTop: 24 },
  errorText: { color: '#b91c1c', marginBottom: 8 },
});
```

- [ ] **Step 3: Implement the Scanner shell (placeholders for later screens)**

Create `components/Scanner.tsx`:

```tsx
import { StyleSheet, Text, View } from 'react-native';
import { useScannerPipeline } from '../hooks/useScannerPipeline';
import { ModelLoadingScreen } from './ModelLoadingScreen';

export function Scanner({ onRetryModels }: { onRetryModels(): void }) {
  const pipeline = useScannerPipeline();

  switch (pipeline.phase) {
    case 'loading-models':
      return (
        <ModelLoadingScreen
          ocrProgress={pipeline.ocrProgress}
          llmProgress={pipeline.llmProgress}
          error={pipeline.modelError}
          onRetry={onRetryModels}
        />
      );
    default:
      // Placeholder — replaced by real screens in Tasks 11–13.
      return (
        <View style={styles.placeholder}>
          <Text>phase: {pipeline.phase}</Text>
        </View>
      );
  }
}

const styles = StyleSheet.create({
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
});
```

- [ ] **Step 4: Wire App.tsx (retry-by-remount for failed model downloads)**

Replace `App.tsx` with:

```tsx
import { useState } from 'react';
import { initExecutorch } from 'react-native-executorch';
import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet } from 'react-native';
import { Scanner } from './components/Scanner';

// Must run before any other react-native-executorch API (module scope = app entry).
initExecutorch({ resourceFetcher: ExpoResourceFetcher });

export default function App() {
  // Remounting Scanner re-triggers model download on retry. Safe: retry is only
  // offered while phase === 'loading-models', i.e. nothing is generating.
  const [attempt, setAttempt] = useState(0);
  return (
    <SafeAreaView style={styles.root}>
      <Scanner key={attempt} onRetryModels={() => setAttempt((a) => a + 1)} />
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: '#fff' } });
```

- [ ] **Step 5: Typecheck and tests**

Run: `npx tsc --noEmit && npm test`
Expected: both pass.

- [ ] **Step 6: MANUAL — device check**

Ask the user to run `npx expo run:ios --device`. Expected: progress bars fill (first run downloads ~45 MB OCR + ~470 MB LLM — Wi-Fi recommended), then the screen shows "phase: capture". Second launch: bars jump straight to 100% (cached).

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: scanner pipeline hook, model loading screen, app shell"
```

---

### Task 11: Capture screen (camera + gallery)

**Files:**
- Create: `components/CaptureScreen.tsx`
- Modify: `components/Scanner.tsx` (replace placeholder for `capture` phase)

**Interfaces:**
- Consumes: `expo-camera` (`CameraView`, `useCameraPermissions`), `expo-image-picker`
- Produces: `CaptureScreen({ onImage, banner }: { onImage(uri: string): void; banner: string | null })`

- [ ] **Step 1: Implement CaptureScreen**

Create `components/CaptureScreen.tsx`:

```tsx
import { useRef, useState } from 'react';
import { Button, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';

export function CaptureScreen({ onImage, banner }: { onImage(uri: string): void; banner: string | null }) {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [busy, setBusy] = useState(false);

  const takePhoto = async () => {
    if (!cameraRef.current || !cameraReady || busy) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      if (photo?.uri) onImage(photo.uri);
    } finally {
      setBusy(false);
    }
  };

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (!result.canceled && result.assets[0]?.uri) onImage(result.assets[0].uri);
  };

  if (!permission) return <View style={styles.container} />;

  return (
    <View style={styles.container}>
      {banner != null && <Text style={styles.banner}>{banner}</Text>}
      {permission.granted ? (
        <CameraView ref={cameraRef} style={styles.camera} facing="back" onCameraReady={() => setCameraReady(true)} />
      ) : (
        <View style={styles.denied}>
          <Text style={styles.deniedText}>Camera access is needed to photograph cards.</Text>
          {permission.canAskAgain ? (
            <Button title="Allow camera" onPress={requestPermission} />
          ) : (
            <Button title="Open Settings" onPress={() => Linking.openSettings()} />
          )}
          <Text style={styles.deniedHint}>You can still pick a card photo from your gallery below.</Text>
        </View>
      )}
      <View style={styles.controls}>
        <Button title="Gallery" onPress={pickFromGallery} />
        <TouchableOpacity
          style={[styles.shutter, (!permission.granted || !cameraReady || busy) && styles.shutterDisabled]}
          onPress={takePhoto}
          disabled={!permission.granted || !cameraReady || busy}
        />
        <View style={styles.controlSpacer} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  banner: { backgroundColor: '#fef3c7', color: '#92400e', padding: 10, textAlign: 'center' },
  camera: { flex: 1 },
  denied: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  deniedText: { fontSize: 16, textAlign: 'center', marginBottom: 12 },
  deniedHint: { fontSize: 13, color: '#666', marginTop: 12, textAlign: 'center' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 24, backgroundColor: '#111' },
  shutter: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#fff', borderWidth: 4, borderColor: '#bbb' },
  shutterDisabled: { opacity: 0.4 },
  controlSpacer: { width: 60 },
});
```

- [ ] **Step 2: Wire into Scanner**

In `components/Scanner.tsx`, add the import and a `capture` case before `default`:

```tsx
import { CaptureScreen } from './CaptureScreen';
// inside the switch:
    case 'capture':
      return <CaptureScreen onImage={(uri) => pipeline.scanCard(uri)} banner={pipeline.scanError} />;
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit` — expected: pass.

- [ ] **Step 4: MANUAL — device check**

`npx expo run:ios --device`. Expected: camera preview appears after permission prompt; tapping shutter or picking a gallery image flips the screen to "phase: processing" (placeholder). Deny-permission path shows the explanation with the gallery still usable.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: capture screen with camera and gallery"
```

---

### Task 12: Processing screen + end-to-end extraction wiring

**Files:**
- Create: `components/ProcessingScreen.tsx`
- Modify: `components/Scanner.tsx` (add `processing` case; temporary debug view for `review`)

**Interfaces:**
- Consumes: `Stage` (Task 10)
- Produces: `ProcessingScreen({ stage, streamText, onCancel }: { stage: 'ocr' | 'llm'; streamText: string; onCancel(): void })`

- [ ] **Step 1: Implement ProcessingScreen**

Create `components/ProcessingScreen.tsx`:

```tsx
import { ActivityIndicator, Button, ScrollView, StyleSheet, Text, View } from 'react-native';

export function ProcessingScreen({
  stage,
  streamText,
  onCancel,
}: {
  stage: 'ocr' | 'llm';
  streamText: string;
  onCancel(): void;
}) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" />
      <Text style={styles.title}>{stage === 'ocr' ? 'Reading the card…' : 'Understanding the details…'}</Text>
      {stage === 'llm' && streamText !== '' && (
        <ScrollView style={styles.stream}>
          <Text style={styles.streamText}>{streamText}</Text>
        </ScrollView>
      )}
      <Button title="Cancel" onPress={onCancel} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 18, marginVertical: 16 },
  stream: { maxHeight: 160, alignSelf: 'stretch', marginBottom: 16, backgroundColor: '#f4f4f5', borderRadius: 8, padding: 12 },
  streamText: { fontFamily: 'Menlo', fontSize: 12, color: '#444' },
});
```

- [ ] **Step 2: Wire into Scanner (plus a temporary review debug view)**

In `components/Scanner.tsx` add:

```tsx
import { ProcessingScreen } from './ProcessingScreen';
// inside the switch:
    case 'processing':
      return <ProcessingScreen stage={pipeline.stage} streamText={pipeline.streamText} onCancel={pipeline.cancel} />;
    case 'review':
      // Temporary debug view — replaced by ReviewScreen in Task 13.
      return (
        <View style={styles.placeholder}>
          <Text>{JSON.stringify(pipeline.fields, null, 2)}</Text>
          <Text>degraded: {String(pipeline.degraded)}</Text>
        </View>
      );
```

- [ ] **Step 3: Typecheck and tests**

Run: `npx tsc --noEmit && npm test` — expected: pass.

- [ ] **Step 4: MANUAL — device check (first real end-to-end extraction)**

`npx expo run:ios --device`, then photograph a real business card. Expected: "Reading the card…" (~1–2 s) → "Understanding the details…" with streaming tokens (~10–30 s for the 0.6B model) → debug JSON showing plausible fields. Also verify: Cancel during LLM streaming returns to capture without crashing; a photo of a blank wall returns to capture with the "Couldn't read the card" banner.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: processing screen and end-to-end OCR-to-LLM extraction"
```

---

### Task 13: Review screen + save to contacts + done screen

**Files:**
- Create: `components/ReviewScreen.tsx`, `lib/contacts.ts`
- Modify: `components/Scanner.tsx` (real `review` case + `done` case)

**Interfaces:**
- Consumes: `ContactFields` (Task 4), `toExpoContact` (Task 9), `expo-contacts`
- Produces:
  - `saveToContacts(fields: ContactFields): Promise<'saved' | 'denied'>` in `lib/contacts.ts` (NOTE: this file wraps expo-contacts and is the ONE lib/ exception to the no-RN-imports rule — it is excluded from Jest by not having a test file; the pure mapping it uses was tested in Task 9)
  - `ReviewScreen({ fields, rawText, degraded, onSave, onRescan }: { fields: ContactFields; rawText: string; degraded: boolean; onSave(edited: ContactFields): void; onRescan(): void })`

- [ ] **Step 1: Implement the contacts side-effect wrapper**

Create `lib/contacts.ts`:

```ts
import * as Contacts from 'expo-contacts';
import { ContactFields } from './schema';
import { toExpoContact } from './contactMapping';

export async function saveToContacts(fields: ContactFields): Promise<'saved' | 'denied'> {
  const { status } = await Contacts.requestPermissionsAsync();
  if (status !== 'granted') return 'denied';
  // Native prefilled "New Contact" form; the user taps Save/Cancel there.
  await Contacts.presentFormAsync(null, toExpoContact(fields) as Contacts.Contact, { isNew: true });
  return 'saved';
}
```

- [ ] **Step 2: Implement ReviewScreen**

Create `components/ReviewScreen.tsx`:

```tsx
import { useState } from 'react';
import { Button, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ContactFields } from '../lib/schema';

function Field({ label, value, onChange }: { label: string; value: string; onChange(v: string): void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} value={value} onChangeText={onChange} autoCapitalize="none" autoCorrect={false} />
    </View>
  );
}

export function ReviewScreen({
  fields,
  rawText,
  degraded,
  onSave,
  onRescan,
}: {
  fields: ContactFields;
  rawText: string;
  degraded: boolean;
  onSave(edited: ContactFields): void;
  onRescan(): void;
}) {
  const [firstName, setFirstName] = useState(fields.firstName ?? '');
  const [lastName, setLastName] = useState(fields.lastName ?? '');
  const [company, setCompany] = useState(fields.company ?? '');
  const [jobTitle, setJobTitle] = useState(fields.jobTitle ?? '');
  const [phones, setPhones] = useState(fields.phones.join(', '));
  const [emails, setEmails] = useState(fields.emails.join(', '));
  const [website, setWebsite] = useState(fields.website ?? '');
  const [address, setAddress] = useState(fields.address ?? '');

  const splitList = (v: string) => v.split(',').map((s) => s.trim()).filter((s) => s !== '');

  const save = () =>
    onSave({
      firstName: firstName.trim() || undefined,
      lastName: lastName.trim() || undefined,
      company: company.trim() || undefined,
      jobTitle: jobTitle.trim() || undefined,
      phones: splitList(phones),
      emails: splitList(emails),
      website: website.trim() || undefined,
      address: address.trim() || undefined,
    });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Check the details</Text>
      {degraded && (
        <Text style={styles.degradedNote}>
          The AI couldn't structure this card — the raw text it read is below. Fill the fields manually.
        </Text>
      )}
      <Field label="First name" value={firstName} onChange={setFirstName} />
      <Field label="Last name" value={lastName} onChange={setLastName} />
      <Field label="Company" value={company} onChange={setCompany} />
      <Field label="Job title" value={jobTitle} onChange={setJobTitle} />
      <Field label="Phones (comma-separated)" value={phones} onChange={setPhones} />
      <Field label="Emails (comma-separated)" value={emails} onChange={setEmails} />
      <Field label="Website" value={website} onChange={setWebsite} />
      <Field label="Address" value={address} onChange={setAddress} />
      <View style={styles.buttons}>
        <Button title="Add to Contacts" onPress={save} />
        <Button title="Rescan" onPress={onRescan} />
      </View>
      {rawText !== '' && (
        <View style={styles.rawBlock}>
          <Text style={styles.rawTitle}>Text read from the card</Text>
          <Text style={styles.rawText}>{rawText}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, paddingBottom: 48 },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 12 },
  degradedNote: { backgroundColor: '#fef3c7', color: '#92400e', padding: 10, borderRadius: 8, marginBottom: 12 },
  field: { marginBottom: 12 },
  label: { fontSize: 13, color: '#555', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 16 },
  buttons: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 16 },
  rawBlock: { backgroundColor: '#f4f4f5', borderRadius: 8, padding: 12 },
  rawTitle: { fontWeight: '600', marginBottom: 6 },
  rawText: { fontFamily: 'Menlo', fontSize: 12, color: '#444' },
});
```

- [ ] **Step 3: Wire review + done into Scanner**

Replace the temporary `review` case in `components/Scanner.tsx` and add `done` (also add the imports and `Alert`, `Button` from react-native):

```tsx
import { Alert, Button } from 'react-native';
import { ReviewScreen } from './ReviewScreen';
import { saveToContacts } from '../lib/contacts';
// inside the switch:
    case 'review':
      return (
        <ReviewScreen
          fields={pipeline.fields}
          rawText={pipeline.rawText}
          degraded={pipeline.degraded}
          onRescan={pipeline.rescan}
          onSave={async (edited) => {
            const result = await saveToContacts(edited);
            if (result === 'denied') {
              Alert.alert(
                'Contacts access needed',
                'Allow contacts access in Settings to save this card. Your edits are kept.',
                [{ text: 'Open Settings', onPress: () => Linking.openSettings() }, { text: 'Cancel' }]
              );
              return; // stay on review — data preserved
            }
            pipeline.finishSave();
          }}
        />
      );
    case 'done':
      return (
        <View style={styles.placeholder}>
          <Text style={styles.doneTitle}>Done!</Text>
          <Text style={styles.doneSub}>Contact handed to iOS.</Text>
          <Button title="Scan another card" onPress={pipeline.reset} />
        </View>
      );
```

Add `Linking` to the react-native import and these styles:

```tsx
  doneTitle: { fontSize: 26, fontWeight: '700', marginBottom: 6 },
  doneSub: { fontSize: 15, color: '#666', marginBottom: 20 },
```

- [ ] **Step 4: Typecheck and tests**

Run: `npx tsc --noEmit && npm test` — expected: pass.

- [ ] **Step 5: MANUAL — device check (full happy path)**

Scan a real card → edit a field on review → "Add to Contacts" → native iOS New Contact form appears prefilled → tap Save → "Done!" → open the iOS Contacts app and confirm the contact exists with the edited values. Also: "Scan another card" restarts cleanly at capture.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: review screen, native contact save, done state"
```

---

### Task 14: Final verification + README

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: everything
- Produces: verified POC + setup docs

- [ ] **Step 1: Full automated verification**

```bash
npx tsc --noEmit && npm test
```

Expected: clean typecheck, all Jest suites pass.

- [ ] **Step 2: MANUAL — full device checklist (from spec §9)**

Walk the user through, on the iPhone:

1. Happy path: real card → correct contact saved. ✅/❌
2. Rotated/angled card → still extracts (or degrades gracefully). ✅/❌
3. Non-card photo (wall/desk) → "Couldn't read the card" banner, no crash. ✅/❌
4. Camera permission denied → explanation + Settings link, gallery still works. ✅/❌
5. Contacts permission denied → alert, review data preserved. ✅/❌
6. **Airplane mode** (models already cached) → full scan works offline. ✅/❌
7. Cancel mid-generation → back to capture, no crash; immediate rescan works. ✅/❌

Record any failure as a bug to fix before calling the POC done.

- [ ] **Step 3: Write README.md**

```markdown
# CardScanner — on-device visiting card scanner (POC)

Photographs a business card, extracts contact fields **fully on-device**
(OCR → LLM via [react-native-executorch](https://docs.swmansion.com/react-native-executorch/)),
and saves them through the native iOS "New Contact" form. Works offline after a
one-time ~0.5 GB model download. No cloud APIs.

## Stack
- Expo SDK 55 (custom dev build — Expo Go is NOT supported), New Architecture
- react-native-executorch 0.9.3 (pinned): `useOCR` (CRAFT+CRNN, en) + `useLLM` (Qwen 3 0.6B quantized)
- expo-camera / expo-image-picker / expo-contacts

## Run (physical iPhone required)
    npm install
    npx expo run:ios --device

First launch downloads models (~45 MB OCR + ~470 MB LLM) — use Wi-Fi.

## Test
    npm test          # pure extraction logic (Jest, runs on the Mac)
    npx tsc --noEmit

## Notes
- Design spec: docs/superpowers/specs/2026-08-11-card-scanner-design.md
- Implementation plan: docs/superpowers/plans/2026-08-11-card-scanner.md
- Known constraint: release builds cannot target the iOS simulator (ExecuTorch).
- Xcode 26.4 / Apple Clang 21 breaks stock RN builds (upstream issue); this repo
  carries the workaround in `plugins/withFmtConstevalPatch.js` (FMT_USE_CONSTEVAL=0).
```

- [ ] **Step 4: Commit**

```bash
git add README.md && git commit -m "docs: README with setup, run, and test instructions"
```
