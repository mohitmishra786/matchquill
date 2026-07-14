# Job Board Selectors Maintenance Guide

This document describes how to maintain and update the job extraction selectors used in the MatchQuill Chrome Extension.

## Location
Selectors are defined in `extension/content/job-extractor.js` in the `JOB_SELECTORS` constant.

## Structure
```javascript
const JOB_SELECTORS = {
    linkedin: {
        description: ['.selector-1', '.selector-2'], // Priority order
        title: ['.title-selector'],
        company: ['.company-selector']
    },
    // ...
};
```

## How to Update
1. **Identify Breakage**: If extraction fails for a specific site, `extraction_failed` telemetry will be sent.
2. **Inspect Page**: Open the job page in Chrome, right-click the job description/title, and select "Inspect".
3. **Find Selector**: Look for a stable class name or ID. Avoid dynamic classes (e.g., `css-12345`).
4. **Test Console**: Run `document.querySelector('YOUR_SELECTOR').innerText` in the console to verify.
5. **Update Code**: Add the new selector to the *beginning* of the array in `JOB_SELECTORS`.
6. **Verify**: Run the automated tests: `node extension/tests/run_tests.js`.

## Adding a New Job Board
1. Add a new key to `JOB_SELECTORS`.
2. Update `detectJobBoard` function to recognize the hostname.
3. Add selectors for description, title, and company.

## Testing
Run the selector syntax validation tests:
```bash
node extension/tests/run_tests.js
```
Note: This requires `jsdom` (installed in `extension/node_modules` via `npm ci`
inside `extension/`). This is the suite CI actually runs
(`.github/workflows/ci.yml`, job `extension-test`).

There is also `extension/tests/job-extractor.test.js`, written against
`vitest`, with per-site coverage tests. `vitest` is not currently an
installed devDependency of `extension/package.json`, so this file cannot be
run as-is in this package. Treat it as the canonical place to add new
per-site tests, but verify any change against it manually (e.g. run the same
JSDOM-harness pattern with plain `node`+`assert`) until `vitest` is wired up
here.

## Marking selectors as unverified
When adding a new job board without being able to confirm selectors against
live, rendered DOM (common for JS-heavy SPAs or auth-walled pages), prefix the
board's block with a comment starting `UNVERIFIED — needs live DOM check` and
explain why (e.g. "CSS-modules hashed class names", "could not fetch
rendered markup"). Include multiple fallback selectors, ordered from most to
least specific, and prefer loose `[class*=...]`/`[data-*=...]` attribute
selectors as the last fallback so hash rotations don't break extraction
entirely. Remove the annotation once someone has confirmed the selectors
against a real job page.

## ATS-aware output
`extractJobDescription()` returns `atsType` (currently identical to
`jobBoard`) so downstream consumers (background script → backend `/compile`
and `/cover-letter`) can key off the hiring platform explicitly. When adding
a new job board, no extra wiring is needed here — `atsType` is derived
automatically from `detectJobBoard()`'s return value.

## Same-origin iframe hosting (e.g. iCIMS)
Some ATS platforms (iCIMS is the known case) render job content inside a
same-origin iframe rather than the top-level document. For those hosts, add
a separate `content_scripts` entry in `manifest.json` scoped to that host
with `"all_frames": true`, rather than setting `all_frames` on the shared
block — the shared block's `createFloatingButton()` is only meant to render
once per page, and `all_frames: true` would duplicate it into every matching
iframe. The content script's `init()` guards this with
`window.self === window.top`: only the top frame gets the floating
button/notifications; every matched frame still runs extraction so it can
find content wherever it lives.
