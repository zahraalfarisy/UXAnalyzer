# Typography and layout

Implementation: `src/index.css` and shared role classes in `src/components/ui.jsx`.
Scope: the existing research workspace. This is a type, spacing and palette refinement, preserving routes, recording and screenshot-heatmap workflows.

## Typography

One family: Onest, self-hosted from `@fontsource-variable/onest` (OFL-1.1). The Latin variable WOFF2 is 33,760 bytes; it is the only font asset emitted by the build. License copy: `public/Onest-OFL.txt`. Source: https://fontsource.org/fonts/onest/about.

Use 400 for copy, 500 for controls/labels, 600 for sections and metrics, and 650 for page titles. Font loading uses `swap`; Segoe UI and Arial provide immediate fallback. Controls inherit the family. No runtime font CDN.

| Role | Size at default browser settings | Leading | Implementation |
| --- | --- | --- | --- |
| Page title | 32px; 28px on narrow phones | 1.2 | `.page-title` |
| Section title | 20px | 1.35 | `.section-title` |
| Card title | 16px | 1.45 | `.card-title` |
| Body copy | 16px | 1.65 | `.body-copy` |
| Supporting copy / labels | 14px | 1.65 / 1.5 | `.supporting-copy`, controls |
| Metadata | 13px | 1.55 | `.metadata` |
| Metric | 28px | 1.2 | `.stat-value` |

Sizes use rem so browser text settings and zoom remain available. Ordinary paragraphs use a 68ch maximum measure. Titles balance and paragraphs use pretty wrapping as progressive enhancements. Numeric roles use tabular lining numerals. Long session IDs and event details wrap instead of hiding useful data.

## Palette

The user requested blue-ish inspiration from the supplied dashboard image, with a simpler and quieter composition.

| Role | Value |
| --- | --- |
| Accent | #4852CD |
| Accent hover / selected text | #3943B6 |
| Accent surface | #ECEEFD |
| Canvas | #F5F6FC |
| Panel | #FFFFFF |
| Primary ink | #22273D |
| Secondary ink | #4D546E |
| Metadata ink | #656D85 |
| Divider | #E0E4F0 |

Use accent for actions, focus and selection. Keep red/amber/green for semantic status and actual heatmap evidence. Panels use a border without stacked decorative shadows. Existing `--ios-*` names are compatibility aliases, not a second theme.

## Spatial rhythm

- 8px control/icon gap; 16px related-content gap; 24px panel inset; 32px major-section gap.
- Main shell and top bar share an 88rem maximum and the same gutter token, using more of wide screens.
- Calibration/recording use a two-column setup layout at a content width of 50rem or more: exclusive native step disclosures left, a compact guide/capture summary and controls right. Below that width, DOM order remains steps then summary and action. No fixed panel height clips content.
- The first step starts open. Each summary is keyboard-operable, and selecting another step closes the previous one through native `details` grouping.
- Home uses a contrasting navy landing section with one headline, one sentence and a session CTA. The real calibrate-record-review links sit alongside it. Totals are an inline definition list, followed by the latest three sessions; the complete library remains in Sessions.
- Four-column metrics only activate when the actual content container is at least 42rem wide. Smaller containers use two columns.
- Accuracy thresholds and recording capture details use compact definition rows instead of metric cards.
- Recent sessions use dividers within one collection rather than nested floating cards.
- Workflow numbers communicate the real calibrate-record-review sequence. Step numbers in disclosures communicate calibration/recording instructions rather than decorative section numbering.
- Sidebar scrolls on short screens. Bottom navigation appears at 800px and below and reserves safe-area space.
- Screenshot controls wrap; tabs and thumbnails have intentional horizontal scrolling.

## Verification and limits

Source assessment identified global utility overrides, tiny shell text, inconsistent reading measures, viewport-triggered compressed grids, and a non-scrolling fixed sidebar. These were addressed by role classes, container queries and shared rhythm tokens.

Both Impeccable type and layout scoped scans returned no findings before and after the implementation. The detector did not flag the source-level hierarchy problems; its clean result is not a visual or accessibility certification.

Production build confirms one local variable font asset and no additional family. Gaze/timeline regression tests remain intact. Live desktop/phone rendering, 200% zoom and font-swap layout stability remain unverified: this session has no available browser surface (`iab` reported unavailable). No rendered verification is claimed.
