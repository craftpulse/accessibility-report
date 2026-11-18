# Accessibility Report Generator

A WCAG 2.2 AA report (WCAG 2.1 by switching `version`) over a list of pages,
using [Pa11y](https://pa11y.org) with the axe-core and HTML_CodeSniffer runners.

## Install

Needs Node.js 22.13 or later (pa11y 10).

```bash
npm ci
```

On linux/arm64 (Docker on Apple silicon, for instance) PhantomJS, which the PDF
step needs, has no build: install with `npm ci --ignore-scripts` and set
`NO_PDF=1` and `CHROME_PATH` (below).

## Run

Feed the pages in; nothing is hard-coded:

```bash
node accessibility-report.js https://example.com/ https://example.com/about   # URLs as arguments
node accessibility-report.js pages.json      # or URLS_FILE=pages.json
node accessibility-report.js                 # urls.json if present, else urls.example.json
```

A list file is JSON, `[{ "url": "...", "label": "..." }]` (or plain URL strings),
or plain text with one URL per line (`#` starts a comment).

| Variable | Default | What it does |
|---|---|---|
| `OUT_DIR` | `.` | Where `accessibility-report.md`, the two JSON files and the PDF go |
| `WAIT_MS` | `0` | Wait after load, for pages that render client-side |
| `IGNORE` | | Pa11y codes to ignore, separated by `\|` (codes contain commas) |
| `CHROME_PATH` | | Use a system Chrome or Chromium (adds `--no-sandbox`, for containers) |
| `NO_PDF` | | `1` skips the PDF |
| `ALL_TYPES` | | `1` lets notices and warnings decide status too (by default only errors do) |

## Output

- `accessibility-report.md` (and `.pdf`): every WCAG success criterion, Met,
  Partially Met or Not Met, with the failing pages. Only errors decide the
  status: notices and warnings are prompts for manual checks. axe findings map
  to their criterion through axe-core's own `wcagNNN` tags.
  A "Check by hand" section follows the table (below).
- `accessibility-issues.json`: every error with its page, runner, code, message
  and selector, for fixing.
- `accessibility-check-by-hand.json`: `{ "counts": { code: n }, "checkByHand": [...] }`,
  every item with its page, url, runner, code, message and selector.

## Check by hand

axe reports some checks as "incomplete": it could not decide, so a person has
to (text over a background image or gradient, for instance). pa11y 10 marks
these with `runnerExtras.needsFurtherReview`, and the report runs with
`levelCapWhenNeedsReview: 'warning'`, so they are never errors and never
change a criterion's status. They are not dropped either: every one is listed
under "Check by hand" in the markdown, with counts per code, and in
`accessibility-check-by-hand.json`. Real violations stay errors.

Automated testing finds part of what WCAG asks; keyboard use, focus order and
content on hover still need a manual pass.
