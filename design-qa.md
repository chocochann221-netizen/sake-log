# Design QA — 個人データ開示

- Source visual truth:
  - `../approved_designs/washulog_data_disclosure_request_canonical_2026-10-18.png` (941 × 1672)
  - `../approved_designs/washulog_data_disclosure_identity_verification_canonical_2026-10-19.png`
  - `../approved_designs/washulog_data_disclosure_confirmation_canonical_2026-10-19.png`
  - `../approved_designs/washulog_data_disclosure_received_canonical_2026-10-19.png` (853 × 1844)
- Implementation: `http://terminal.local:4173/` (browser-rendered capture displayed in the Work browser QA session; the browser surface did not expose a local screenshot path)
- Browser viewport: 1365 × 900 CSS px, device scale 1; app content constrained to 620 CSS px. The source is a tall mobile composition, so comparison used the centered app content region rather than the surrounding desktop canvas.
- States compared: request form, email identity verification, ready/download status.
- Primary interactions tested: applicant checkbox starts disabled and enables the primary CTA; CTA transitions to identity verification; ready state exposes the download CTA and live management-number field.
- Console check: no application-origin errors. Logged errors were from the cloud-browser extension only.

## Full-view comparison

The implementation preserves the source hierarchy and reading order: gold-on-ink header, three-step progress indicator, framed wood-toned information panels, disclosure scope, delivery method, consent check, and dominant gold CTA. The receipt/status state uses the backend management-number format and replaces the old hardcoded “確認中” label with the real status mapping.

## Focused comparison

- Typography: Mincho display hierarchy and sans-serif support copy match the source intent; responsive wrapping remains readable at the 620 px content width.
- Spacing/layout: section rhythm, framed panels, progress line, form consent, and CTA grouping are consistent with the source. Desktop canvas padding is outside the app content and was excluded.
- Colors/tokens: ink background, warm wood panel, pale body copy, and gold active/action tokens are retained with sufficient contrast.
- Image/assets: these screens contain no photographic assets. Decorative treatment is implemented with CSS borders/backgrounds; no source image was omitted.
- Copy/content: core approved copy is retained. “項目を選ぶ” and “書面” are intentionally not interactive because the current backend supports only full export and electronic ZIP delivery.

## Findings

- No actionable P0/P1/P2 mismatch remains.
- P3: the lock mark is intentionally simplified to avoid introducing an unapproved external icon dependency.

## Comparison history

1. Initial browser capture showed the global app header above the disclosure header and inherited a white header background (P1). Fixed by making the disclosure route own the header surface and hiding the app shell header while it is open.
2. Initial request screen title read “申請状況” (P1). Fixed the title mapping to “保有データの開示”.
3. Post-fix request, identity, and ready-state captures showed the expected hierarchy, live management number, and enabled/disabled CTA states.

## Implementation checklist

- [x] Request → identity verification → confirmation → receipt/status flow
- [x] Live request creation and status refresh
- [x] Management number, request date, status, and expiry display
- [x] Download and cancellable-state actions
- [x] Browser interaction and console checks
- [x] JavaScript syntax and whitespace checks

final result: passed
