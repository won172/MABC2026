---
version: alpha
name: Youth Housing Eligibility Workspace
description: "A calm, trustworthy decision-support workspace that helps young applicants understand which public housing notices they may apply for, why, and what still needs verification."
colors:
  primary: "#1D4ED8"
  primary-hover: "#1E40AF"
  on-primary: "#FFFFFF"
  background: "#F6F8FB"
  surface: "#FFFFFF"
  surface-subtle: "#FBFCFE"
  surface-selected: "#EFF6FF"
  text-primary: "#172033"
  text-secondary: "#556176"
  text-muted: "#667085"
  border: "#D9E1EA"
  border-strong: "#C0CAD6"
  focus: "#2563EB"
  eligible: "#166534"
  eligible-background: "#F0FDF4"
  eligible-border: "#BBF7D0"
  needs-review: "#92400E"
  needs-review-background: "#FFFBEB"
  needs-review-border: "#FDE68A"
  ineligible: "#991B1B"
  ineligible-background: "#FEF2F2"
  ineligible-border: "#FECACA"
typography:
  display:
    fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, Segoe UI, Noto Sans KR, sans-serif"
    fontSize: 32px
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: -0.02em
  page-title:
    fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, Segoe UI, Noto Sans KR, sans-serif"
    fontSize: 24px
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: -0.015em
  section-title:
    fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, Segoe UI, Noto Sans KR, sans-serif"
    fontSize: 20px
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: -0.01em
  card-title:
    fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, Segoe UI, Noto Sans KR, sans-serif"
    fontSize: 17px
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: -0.005em
  body-large:
    fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, Segoe UI, Noto Sans KR, sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.625
    letterSpacing: 0em
  body:
    fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, Segoe UI, Noto Sans KR, sans-serif"
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: 0em
  body-strong:
    fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, Segoe UI, Noto Sans KR, sans-serif"
    fontSize: 15px
    fontWeight: 600
    lineHeight: 1.6
    letterSpacing: 0em
  caption:
    fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, Segoe UI, Noto Sans KR, sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0em
  label:
    fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, Segoe UI, Noto Sans KR, sans-serif"
    fontSize: 13px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 0em
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 20px
  2xl: 24px
  3xl: 32px
  4xl: 40px
  5xl: 48px
  6xl: 64px
rounded:
  xs: 6px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 20px
  full: 999px
components:
  app-canvas:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body}"
  surface:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "{spacing.xl}"
  surface-subtle:
    backgroundColor: "{colors.surface-subtle}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.sm}"
    padding: "{spacing.lg}"
  surface-selected:
    backgroundColor: "{colors.surface-selected}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "{spacing.xl}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.sm}"
    height: 44px
    padding: 12px
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.on-primary}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.sm}"
    height: 44px
    padding: 12px
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    height: 44px
    padding: 12px
  link:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.focus}"
    typography: "{typography.body-strong}"
  meta-text:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-muted}"
    typography: "{typography.caption}"
  divider:
    backgroundColor: "{colors.border}"
    height: 1px
  divider-strong:
    backgroundColor: "{colors.border-strong}"
    height: 1px
  eligible-badge:
    backgroundColor: "{colors.eligible-background}"
    textColor: "{colors.eligible}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    height: 28px
    padding: 8px
  eligible-border:
    backgroundColor: "{colors.eligible-border}"
    height: 1px
  needs-review-badge:
    backgroundColor: "{colors.needs-review-background}"
    textColor: "{colors.needs-review}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    height: 28px
    padding: 8px
  needs-review-border:
    backgroundColor: "{colors.needs-review-border}"
    height: 1px
  ineligible-badge:
    backgroundColor: "{colors.ineligible-background}"
    textColor: "{colors.ineligible}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    height: 28px
    padding: 8px
  ineligible-border:
    backgroundColor: "{colors.ineligible-border}"
    height: 1px
  chat-composer:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    height: 52px
    padding: 16px
---

# Youth Housing Eligibility Workspace

## Overview

Youth Housing Eligibility Workspace is a decision-support product for young people who need to find and assess public housing notices without manually comparing every requirement. It is not a generic AI chatbot. The conversation is an input and guidance surface; the structured eligibility result is the primary product surface.

### Product character

The interface should feel calm, reliable, modern, and information-led. It combines the clarity of a financial product, the stability of a public service, and the efficiency of a professional SaaS workspace. It must never look like an old government portal or a decorative AI demo.

The product should answer three questions in this order:

1. Can I apply?
2. Why can or cannot I apply?
3. What do I still need to verify?

### Product principles

**Decision before AI.** The eligibility decision, requirement comparison, evidence, and next action must be visually stronger than the assistant identity or generated prose.

**Honest uncertainty.** Missing user data, incomplete notice content, an unresolved applicant category, or an unknown reference date must result in Needs review. Needs review is a normal product state, not an error or a weaker form of Eligible.

**Evidence beside the result.** Every decision should expose the notice criterion, the user's known value, the row-level outcome, and a verifiable source location when available. Never invent a page number, section label, correction notice, or source URL.

**Ask only what is required.** Request only information used by the current notice. If a clear mandatory failure already determines the result, do not continue requesting sensitive income, asset, vehicle, or household information unless the user asks for a complete review.

**Separate independent concepts.** Eligibility, application period, parsing completeness, applicant priority, bonus points, and selection probability are different concepts. A closed application may still be eligibility-compatible. A priority tier must not be presented as an eligibility result.

**Fail closed.** Eligible is allowed only when every applicable mandatory requirement has been checked, no mandatory requirement fails, and every required user value is known under the correct reference date and applicant category.

### Product scope

The P0 experience consists of profile setup, chat-based discovery, a housing notice list, individual notice assessment, a three-state eligibility result, a one-to-one requirement comparison, evidence, follow-up items, notice source, and the final-agency-review notice.

The two-panel desktop workspace is the preferred presentation for the final demo. A map, notice comparison, favorites, history, alerts, and complete mobile optimization are P1. A map must never displace the list or eligibility detail before the P0 flow is complete.

### Voice and copy

Product copy is localized for Korean users, but the writing principles are language-independent: use short sentences, plain terms, explicit dates, exact units, and action-oriented labels. Avoid probabilistic language such as "probably eligible," "almost eligible," or "high chance." Do not use "match score," "approval probability," or "selection probability" unless a separately validated product capability exists.

Every detailed result must end with a clearly visible localized equivalent of:

> This assessment is a preliminary review based on the housing notice. Final eligibility is determined by the administering agency.

## Colors

The palette uses restrained blue for navigation and actions, neutral surfaces for dense information, and dedicated semantic colors for eligibility. The visual system must rely on semantic token names rather than raw color values in component code.

### Brand and neutral palette

`primary` is used for links, selected states, focus accents, and the single primary action in a region. `background` is the application canvas. `surface` is the default panel and card. `surface-subtle` supports secondary explanations, while `surface-selected` marks an active housing notice or navigation target.

Primary text uses `text-primary`. Supporting information uses `text-secondary`; `text-muted` is reserved for timestamps and non-critical metadata. Critical requirements, errors, evidence, or legal guidance must never use the muted token.

### Eligibility palette

The eligibility system has exactly three final states:

| Internal state | Meaning | Required visual treatment |
|---|---|---|
| `eligible` | Every applicable mandatory requirement is verified and met | Check icon, explicit label, eligible foreground/background/border |
| `needs_review` | No confirmed mandatory failure, but information or notice interpretation is incomplete | Alert icon, explicit label, needs-review foreground/background/border |
| `ineligible` | At least one applicable mandatory requirement is clearly not met | X icon, explicit label, ineligible foreground/background/border |

Color must never carry the state alone. Every state uses an icon, a label, and a text explanation. Do not introduce a fourth final label such as "conditionally eligible," "almost eligible," or "pending." `Unassessed` and `processing` are workflow states, not eligibility results.

### Independent status axes

Application period uses a separate neutral or informational treatment: Open, Upcoming, Closed, or Unknown. Closed must not use the Ineligible visual treatment. Parsing completeness and system errors also use separate status patterns and must never be mapped to Ineligible.

### Contrast

All rendered foreground/background pairs must meet WCAG 2.2 AA: at least 4.5:1 for normal text and 3:1 for large text. Interactive boundaries and focus indicators must remain visually distinguishable from adjacent colors. Validate actual component combinations, not palette swatches in isolation.

Dark mode is outside the final MVP. Keep tokens semantic so a later theme is possible, but do not invent an untested dark palette during P0 implementation.

## Typography

Pretendard is the preferred typeface for Korean interface copy, with system fallbacks for reliable rendering. Typography is quiet and functional. Hierarchy comes from size, weight, line height, and spacing rather than decorative color changes.

### Hierarchy

Use `display` only for the landing value proposition. Use `page-title` for screen titles and housing notice names, `section-title` for major result sections, and `card-title` for notice cards. Long explanations use `body-large` or `body`; controls and table emphasis use `body-strong` or `label`. `caption` is limited to dates, source metadata, and secondary notes.

Do not reduce essential eligibility criteria, error messages, evidence, privacy explanations, or agency-review guidance below the base body size.

### Korean text behavior

Allow generous line height and natural wrapping. Housing notice names may wrap to two or more lines where necessary; do not hide essential titles behind a single-line ellipsis. Preserve semantic units in dates, amounts, thresholds, and ranges. Distinguish precisely between inclusive and exclusive thresholds and retain the original monetary unit.

Use tabular numerals for amounts, dates, D-day values, and requirement counts. Avoid monospace type outside technical identifiers. Never use all caps for Korean interface labels.

### Writing hierarchy

A decision detail should read in this order: final decision, one-line explanation, requirement comparison, items to verify, evidence, pre-application checklist, notice source, and final-agency-review guidance. Typography must reinforce this reading order without relying on oversized status text or decorative display type.

## Layout

### Desktop workspace

The primary desktop view is a two-panel workspace beneath a 64px top navigation bar.

```text
┌──────────────────────────────────────────────────────────────────┐
│ Product                Current context             Edit profile │
├──────────────────────────┬───────────────────────────────────────┤
│ Conversation             │ Information workspace                 │
│                          │                                       │
│ Questions and short      │ Recommendation list                   │
│ explanations             │ or eligibility detail                │
│                          │                                       │
├──────────────────────────┤                                       │
│ Persistent composer      │                                       │
└──────────────────────────┴───────────────────────────────────────┘
            38–42%                         58–62%
```

At a 1440px reference width, the conversation panel occupies approximately 40% and the information workspace 60%. The conversation panel has a 360px minimum and a recommended 520px maximum. The information workspace has a 560px minimum. Each panel scrolls independently; the composer remains sticky inside the conversation panel.

Workspace content uses a maximum width of 960px, with 32px horizontal padding and 24px vertical padding on desktop. Long explanatory prose should not exceed a 720px reading width. Eligibility tables require approximately 720px before converting to a structured list.

### Information hierarchy

The right panel is the primary information surface. It can display a recommendation list, a selected notice, an eligibility detail, or a meaningful empty/error state. Long requirement tables and evidence must never be placed entirely inside chat bubbles or modal dialogs.

Selecting a notice in chat selects the same item in the workspace. Selecting a card opens the detail without clearing the conversation. Back navigation returns to the previous list and preserves scroll and conversation context. When a new user value changes the decision, announce the change and highlight the affected requirement rather than resetting the entire workspace.

### Responsive behavior

At 1024px and above, retain the two-panel layout. Between 768px and 1023px, prefer one focused panel with an explicit Conversation/Results switch; use a narrower split only when both panels remain usable. Below 768px, use top-level Conversation and Results tabs rather than stacking two compressed panels.

Results arriving on mobile must not force-switch the user away from the composer. Show a clear "View results" action with the result count. Convert the eligibility table into a semantic description list per requirement. Sticky bottom actions must respect the device safe area.

Validate at 1440px, 1280px, 1024px, 768px, 430px, 375px, and 320px. Test long Korean notice names, large amounts, many requirements, unknown values, and 200% text zoom.

### Spacing

Spacing follows a 4px scale with an 8px visual rhythm. Default control gaps are 8–12px, card padding is 20px, section spacing is 24–32px, desktop workspace padding is 32px, and mobile page padding is 20–24px. Use token references before adding a new value. If an exceptional value repeats, promote it to a token.

### Motion

Use 120ms for hover and pressed feedback, 180ms for tabs or small transitions, and no more than 240ms for dialogs or panel changes. Prefer opacity and small transforms. Never animate eligibility colors with pulsing, celebration, confetti, sparkles, or bouncing assistant graphics. Respect `prefers-reduced-motion`; use an instant transition for scroll and non-essential motion when reduction is requested.

## Elevation & Depth

Depth is created with surface contrast, spacing, and thin borders rather than prominent shadows. The default card has no shadow and uses `surface` against `background` with a 1px `border` edge.

Use the following elevation levels:

- Level 0: no shadow; page, panel, card, table, and static summary content.
- Level 1: `0 1px 2px rgba(23, 32, 51, 0.06)`; sticky composer or a control that must separate from scrolling content.
- Level 2: `0 8px 24px rgba(23, 32, 51, 0.10)`; dropdown, popover, and modal dialog only.

Nested cards are discouraged. Use a divider or `surface-subtle` block inside a card instead of adding another elevated container. A shadow must communicate a real layer that can overlap content; it is not decoration.

The top navigation and panel divider use a 1px border. Selected cards use a primary border or inset accent together with a programmatic selected/current state. Focus uses a visible 2px ring with a 2px offset and must never depend on shadow alone.

## Shapes

The shape system is restrained. Rectangles with modest corners support trustworthy, information-dense content. The standard control radius is 8px; the standard card radius is 12px; the eligibility summary and onboarding group may use 16px. A 20px radius is reserved for modal surfaces.

Use a full pill only for true badges, compact status labels, switches, or avatars. Do not turn every button, card, input, filter, and navigation item into a pill. When containers are nested, reduce the inner radius or use dividers to preserve hierarchy.

Icons come from one consistent outline set at 16px, 20px, or 24px with a 1.75–2px stroke. Eligibility icons are stable: circle-check for Eligible, alert-triangle or circle-question for Needs review, and circle-x for Ineligible. Decorative emoji are not product icons. Every icon-only control requires an accessible name.

## Components

### App shell and top navigation

The app shell owns the top navigation, conversation panel, information workspace, dialogs, toasts, and accessibility live regions. Use semantic landmarks and provide a skip link before navigation.

The 64px top navigation contains the product identity, the current page or context, and an always-available profile summary/edit action. Do not expose sensitive income, asset, vehicle, or household values in global navigation. The identity should be wordmark-led and must not use an AI sparkle motif.

### Conversation panel

The conversation panel is a control surface for natural-language questions, notice selection, clarification, and missing-data collection. It contains a small conversation header, message list, optional current-context notice, and persistent composer.

User messages may use a restrained selected-surface treatment and an 82% maximum width. Assistant messages should look like readable content blocks, not oversized messenger bubbles. Avoid repeated avatars, bubble tails, decorative typing indicators, or timestamps unless they provide functional value.

An assistant response should contain a short answer or progress statement, only the necessary follow-up question, and a link to the structured workspace result. If three notices are displayed on the right, the message should state that succinctly rather than repeating all three cards in the conversation.

Quick replies are real buttons used for high-value answers such as No change, I do not know yet, or applicant-category selection. Previously verified data must not be requested again. For time-sensitive fields, ask only whether relevant values have changed and only when the current notice uses those values.

### Chat composer

The composer has an optional context chip, an auto-sizing text area, optional file attachment, a send button, and concise helper text. The default height is 52px and it expands to five lines before scrolling. Support Enter to send and Shift+Enter for a new line, with an accessible instruction.

During submission, prevent duplicate sends without erasing the draft. On failure, restore the user's text. If notice files are accepted, show supported formats and limits before selection. Upload success must not imply parse success.

### Onboarding

Onboarding should feel like progressive profile preparation, not a long government form. Group information into five compact steps:

1. Basic information: date of birth or age, current region, residence duration.
2. Housing status: homeownership or housing-status requirement.
3. Current situation: student, job seeker, early-career worker, worker, or other.
4. Household and marriage: marital status, household composition, household size.
5. Income and assets: monthly income under the notice definition, total assets, vehicle ownership and assessed value.

Show the current step and total count in text. Preserve values when moving backward. Explain why sensitive information is used and when it is saved. Allow users to skip non-required fields and finish onboarding with unknown values.

Unknown is a first-class value for income, assets, vehicle value, and any reference-date state the user cannot verify. Never serialize unknown as zero, false, or an empty string. Choosing "I do not know yet" should reveal a concise explanation and a verification path without blocking onboarding.

### User profile summary

The collapsed profile summary shows the number of stored values, the number still unknown, and the last update date. The expanded summary displays only relevant conditions and provides Edit profile. Stale, time-sensitive values should be surfaced as values to reconfirm, not silently reused or globally invalidated.

### Housing card

A housing card contains, in order: Eligibility badge, housing notice title, administering institution, housing type, region, independent application-period status, requirement breakdown, the most important caution, and a clear View eligibility detail action.

The breakdown states exact counts for Met, Needs review, and Not met. It must not convert mandatory requirements into a match percentage. Seven met requirements and one failed mandatory requirement is not an 87% match.

Supported card states are Eligible, Needs review, Ineligible, Unassessed, and Selected. Unassessed uses a neutral workflow label and is not a fourth final decision. A selected card changes border/background and exposes the correct selected or current semantic state.

### Application period status

Application period is independent from eligibility:

- Open: show an absolute end date and optional D-day.
- Upcoming: show the opening date.
- Closed: show the closing date in a neutral style.
- Unknown: state that the period needs verification.

Never use the Ineligible color or label for a closed notice. Always pair countdowns with an absolute date.

### Eligibility badge

The badge combines the fixed eligibility icon, localized text label, semantic foreground, subtle background, and border. The list and detail view must use the same internal value and concept. The badge is descriptive by default; if it acts as a filter, implement it as a real button with hover, focus, pressed, and selected states.

### Eligibility summary

The eligibility summary is the first and strongest element in a notice detail. It contains the final state, a one-line reason, exact requirement counts, assessment date, relevant user-data freshness, and one state-specific primary action.

- Eligible: review pre-application items; secondary action opens the source notice.
- Needs review: provide the missing value or resolve the ambiguity; secondary action opens verification guidance.
- Ineligible: jump to the failed mandatory requirement; secondary action returns to other notices.

Use a subtle semantic background with border and icon, not a saturated green, amber, or red panel. Do not celebrate an Eligible result: it is a preliminary assessment, not final legal approval.

### Eligibility table and requirement row

On desktop, the table uses four immediately visible columns: Requirement, Notice criterion, My information, and Result. A row may additionally disclose whether it is mandatory or priority/bonus, its applicant category, reference date, evidence source, and source location.

Group mandatory requirements separately from priority or bonus criteria. Preserve AND, OR, exception, tier, and applicant-category structure. Never merge criteria from different applicant categories. Omit requirements not present in the notice rather than rendering blank rows.

Use exact threshold operators and units. A missing user value reads as Not verified yet rather than a dash. A failed row must explain the notice threshold, the user's value, and the difference. On mobile, convert each row into a semantic description list while keeping the same information and reading order.

### Needs-review card

Each needs-review card contains the unresolved item, why it affects the decision, the exact value or document needed, a general verification path when appropriate, and a Provide information action.

General income, asset, or vehicle verification guidance must be visually distinguished from notice evidence. The product must say that a value obtained through a general service may not match the notice's definition and that the user must confirm it. The model and UI must not imply that the service calculated or looked up these values on the user's behalf.

If the applicant category is unresolved, ask for that category before requesting category-specific financial details. If the notice itself is unclear or incomplete, recommend source re-upload or agency confirmation rather than a user data field.

### Evidence and source card

Evidence may be grouped into Met, Not met, and Needs review. Quote only short, verified notice text. Show a page, table, or section location only when the source actually provides it. If the user supplied an original notice and correction notice, mark the corrected condition explicitly. Do not search for or assume an unseen correction notice.

The source card contains institution, notice title, notice date, correction date if supplied, document type, parse completeness, source link if known, and assessment timestamp. A partial or failed parse must be visible and must prevent an Eligible result.

### Final-review notice

Every eligibility detail includes the final-agency-review guidance after the source and pre-application checklist. It uses normal body-sized text on a visible informational surface. It must not be hidden as fine-print footer copy and must never be omitted from an Eligible result.

### Empty states

Empty states explain the current condition and offer one relevant action.

- Before onboarding: explain that only necessary information is requested and unknown values are allowed.
- Before the first question: offer two or three realistic query examples.
- No stored notices: state that notice data is unavailable; do not claim no eligible housing exists.
- No matches in the checked set: show the checked data scope and applied conditions.
- No filter results: offer Clear filters without changing the saved user profile.

No stored data, API failure, parse failure, and no condition match are different states and require different copy.

### Loading and progress

When real pipeline stages exist, use truthful labels such as Reading notice, Structuring requirements, Comparing my information, and Preparing result. Do not mark an incomplete step as complete or show an unsupported time estimate. Skeletons should match the final layout.

Processing must not display an eligibility color or badge. Commit the final result atomically; never expose streamed partial text as the final decision. For a long operation, show the current stage and a safe retry or cancel path.

### Errors and partial data

Network failure preserves the draft and provides retry. File parse failure requests a clearer original and produces Needs review rather than Ineligible. An unsupported file explains supported formats. An eligibility-engine failure produces no final eligibility state. Data-source unavailability must not become an empty recommendation result. Validation errors appear beside the field with correction guidance.

Partial data identifies what was checked, what was not checked, its impact on the result, and the next action. It must never produce Eligible.

### Accessibility behavior

Use semantic HTML landmarks, headings, buttons, form labels, table headers, and description lists. Every interactive component must support keyboard use and a visible focus state. Dialogs trap focus, close with Escape, and return focus to their trigger. Tabs use proper tab/tabpanel relationships and arrow-key behavior.

Announce assessment start, completion, result changes, and errors through a polite live region. Do not announce every streaming token. When a result changes after new information, announce the previous and new state and identify the affected requirement.

Form labels, descriptions, and errors must be programmatically connected. Submission moves focus to the first invalid field. A disabled action must have a nearby explanation. Toasts may confirm a save but must not be the only place where a critical error or decision change appears.

## Do's and Don'ts

### Do

- Read the PRD, eligibility skill, and this file before implementing or modifying UI.
- Treat the eligibility skill as the source of truth for decision meaning and the PRD as the source of truth for product scope.
- Put the final eligibility decision at the top of the detail view.
- Show notice criterion, user information, and row result one-to-one.
- Keep eligibility, application period, parse completeness, and priority/bonus criteria in separate data fields.
- Preserve unknown as a typed state and show the action needed to resolve it.
- Reuse semantic tokens and existing components before adding a new token or pattern.
- Extract repeated anatomy and behavior into shared components.
- Use semantic HTML, visible focus, keyboard navigation, accessible names, and live regions.
- Test every component in default, hover, focus-visible, pressed, disabled, loading, error, empty, partial-data, and long-content states where applicable.
- Test Korean copy, exact dates, large amounts, inclusive/exclusive thresholds, and monetary units.
- Preserve user input and conversation context after network or validation errors.
- Keep the final MVP complete without a map.
- Keep the competition runtime constrained to Solar Pro 4 as required by the PRD; do not add another model provider, hidden fallback, or arbitrary provider route.

### Don't

- Do not design a generic messenger-style AI chatbot.
- Do not make assistant prose visually stronger than the structured result.
- Do not place long eligibility tables or evidence inside chat bubbles or modal dialogs.
- Do not introduce gradients, glassmorphism, neon, heavy shadows, excessive pills, decorative AI sparkles, or unnecessary illustration.
- Do not represent eligibility by color alone.
- Do not add a fourth final eligibility state.
- Do not render Eligible when a required value, applicant category, reference date, source section, or parse result is uncertain.
- Do not map parser, API, database, network, or model failures to Ineligible or No results.
- Do not treat a closed application period as an eligibility failure.
- Do not merge mandatory requirements with priority, tier, score, or bonus conditions.
- Do not invent match percentages, ranking logic, source locations, correction notices, coverage claims, or selection probabilities.
- Do not infer missing region, age, income, asset, vehicle, marriage, household, or housing-status data.
- Do not treat salary or take-home pay as notice-defined monthly income without verification.
- Do not calculate or claim to retrieve the user's income, assets, or assessed vehicle value.
- Do not hard-code mock notices, profile values, model names, or final decisions inside visual components.
- Do not recalculate final eligibility in the frontend. Render a validated decision contract from the eligibility engine.
- Do not add raw hex values, arbitrary spacing, radii, shadows, or z-index values inside feature components when a token exists.
- Do not add dark mode, maps, comparison, favorites, alerts, or decorative motion before the P0 assessment flow is complete.

### Agent implementation contract

Use typed, independent values for eligibility status, application-period status, parse status, and requirement kind. `Unassessed` is a workflow value, not a final eligibility result. Unknown must not collapse to zero, false, or an empty string. The frontend may map an internal status to tokens and localized labels, but it must not derive or override the final decision.

Before coding, inspect the existing framework, tokens, components, layouts, and responsive behavior. Make the smallest compatible change. Do not add a dependency for a minor visual effect. If a requested UI change would alter the eligibility meaning defined by the skill, report the conflict before implementation.

After each change, verify the affected screen at desktop and mobile widths, complete the relevant keyboard path, inspect focus order, test 200% zoom and reduced motion, and exercise loading, empty, partial, error, Eligible, Needs review, and Ineligible states. A static screenshot is not sufficient verification for an interactive or semantic change.
