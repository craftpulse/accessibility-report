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
or plain text with one URL per line (`#` starts a comment). A JSON entry may
carry a `cookie`, sent as the page request's Cookie header (a signed-in
session), and the `userAgent` that session was opened with.

| Variable | Default | What it does |
|---|---|---|
| `OUT_DIR` | `.` | Where `accessibility-report.md`, the two JSON files and the PDF go |
| `WAIT_MS` | `0` | Wait after load, for pages that render client-side |
| `IGNORE` | | Pa11y codes to ignore, separated by `\|` (codes contain commas) |
| `CHROME_PATH` | | Use a system Chrome or Chromium (adds `--no-sandbox`, for containers) |
| `IGNORE_CERT_ERRORS` | on | A certificate the browser does not trust (a local one) is accepted; `0` refuses it |
| `NO_PDF` | | `1` skips the PDF |
| `ALL_TYPES` | | `1` lets notices and warnings decide status too (by default only errors do) |
| `RESOLVE_CONTRAST` | on | `0` turns off measuring the color contrast axe could not decide (below) |

## Output

- `accessibility-report.md` (and `.pdf`): every WCAG success criterion, Met,
  Partially Met or Not Met, with the failing pages. Only errors decide the
  status: notices and warnings are prompts for manual checks. axe findings map
  to their criterion through axe-core's own `wcagNNN` tags.
  A "Check by hand" section follows the table (below).
- axe runs through `runners/axe-wcag22.js`, with the WCAG 2.2 A and AA rules
  (Pa11y's own axe runner stops at 2.1): a violation of a rule that names a WCAG
  criterion is an error whatever its impact, while a result axe says needs
  review, and a best-practice rule that names no criterion, is a warning.
- `accessibility-issues.json`: every error with its page, runner, code, message
  and selector, for fixing.
- `accessibility-failures.json`: the pages that did not load, with the error.
  The run goes on without them, and they neither pass nor fail a criterion.
- `accessibility-check-by-hand.json`: `{ "counts": { code: n }, "checkByHand": [...] }`,
  every item with its page, url, runner, code, message and selector.
- `accessibility-contrast-measured.json`: `{ "enabled", "counts", "measured": [...] }`,
  every color contrast item the report measured (below), with its status
  (`pass`, `fail` or `undecided`), ratio, required ratio, text color, worst,
  lightest and darkest background pixel, axe's reason and, when undecided, why.

## Check by hand

axe reports some checks as "incomplete": it could not decide, so a person has
to (text over a background image or gradient, for instance). pa11y 10 marks
these with `runnerExtras.needsFurtherReview`, and the report runs with
`levelCapWhenNeedsReview: 'warning'`, so they are never errors and never
change a criterion's status. They are not dropped either: every one is listed
under "Check by hand" in the markdown, with counts per code, and in
`accessibility-check-by-hand.json`. Real violations stay errors.

## Measured by the report

Most of what axe could not decide is color contrast: text over a gradient, an
image, a semi-transparent layer, an overlap or a pseudo-element, where axe
cannot work out the background. The text is still on screen, so the report
measures it from the pixels, on the same page pa11y just tested
(`contrast-resolver.js`):

1. Waits for animations and transitions to finish (`document.getAnimations()`),
   then emulates `prefers-reduced-motion: reduce` if some still run.
2. Scrolls the element into view and takes its glyph boxes (the client rects
   of its own text nodes; the content box for a form field), minus whatever
   the viewport and overflow-clipping ancestors cut off.
3. Draws its text transparent (`color`, `-webkit-text-fill-color`,
   `text-shadow`, `caret-color`, `text-decoration-color`), screenshots the glyph boxes and restores it,
   so the screenshot holds the real background.
4. Composites the text color, with the opacity of every ancestor, over every
   background pixel inside the glyph boxes and takes the worst contrast, not
   the average, against 4.5:1, or 3:1 for large text (24px, or 18.66px at
   weight 700 or more; WCAG 2.2 SC 1.4.3).

A failure is an error like any other (code `color-contrast`, runner
`resolver`, the measured ratio in the message) and counts toward SC 1.4.3. A
pass leaves the list. Before measuring, the text is also painted solid white
and solid black: if less of it reaches the screen than its own opacity
allows, something translucent lies on top (a scrim behind a dialog, which
hit testing cannot see when it takes no pointer events), and the element
counts as covered. What cannot be measured stays under "Check by hand",
with the reason: element not found, zero size, off screen, clipped by an
ancestor, covered by another element, animation not settled, text painted
with a gradient or image, filter or blend mode on the text, text is
transparent, fails without its text shadow, icon characters only, or empty
field. The markdown's "Measured by the report" section counts passed, failed
and still undecided, by reason, and lists the failures.

`test/contrast.html` holds known cases (white on a light gradient fails, dark
text on a gradient passes, text over a dark and a light image, a
semi-transparent card on a scrim, large text at 3:1, text under the scrim,
an animation that never settles).

Automated testing finds part of what WCAG asks; keyboard use, focus order and
content on hover still need a manual pass.
