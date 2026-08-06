---
name: Count Me In
description: A calm metallic care companion for older adults and the people who support them.
colors:
  royal-blue: "#3D52A0"
  cornflower-blue: "#7091E6"
  steel-blue: "#8697C4"
  pale-blue-grey: "#ADBBDA"
  light-lavender: "#EDE8F5"
  dark-navy: "#252C40"
  white: "#FFFFFF"
typography:
  display:
    fontFamily: "Arial, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "clamp(3.5rem, 8vw, 7.7rem)"
    fontWeight: 700
    lineHeight: 0.9
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Arial, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.2rem, 5vw, 4.8rem)"
    fontWeight: 700
    lineHeight: 0.95
    letterSpacing: "-0.035em"
  body:
    fontFamily: "Arial, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Arial, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9rem"
    fontWeight: 800
    lineHeight: 1.2
rounded:
  sm: "7px"
  md: "12px"
  lg: "16px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "20px"
  lg: "30px"
  xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.royal-blue}"
    textColor: "{colors.white}"
    rounded: "{rounded.md}"
    padding: "0 22px"
    height: "60px"
  button-secondary:
    backgroundColor: "{colors.white}"
    textColor: "{colors.dark-navy}"
    rounded: "{rounded.md}"
    padding: "0 22px"
    height: "60px"
  field:
    backgroundColor: "{colors.white}"
    textColor: "{colors.dark-navy}"
    rounded: "{rounded.md}"
    padding: "0 18px"
    height: "68px"
  surface:
    backgroundColor: "{colors.white}"
    textColor: "{colors.dark-navy}"
    rounded: "{rounded.lg}"
    padding: "30px"
---

# Design System: Count Me In

## Overview

**Creative North Star: "The Calm Metallic Companion"**

Count Me In uses a cool, metallic-inspired visual system that feels calm, credible, and contemporary without becoming clinical. White space and dark navy typography keep tasks readable, while a controlled family of softened blues communicates action, interaction, and support.

The experience remains designed first for older adults: large type, generous touch targets, plain language, obvious state changes, and one clear decision at a time. Family coordination should feel visible and practical without taking agency away from the older adult.

**Key Characteristics:**

- White reading surfaces with soft lavender or pale blue-grey atmosphere.
- Deep royal blue actions with quiet cornflower and steel-blue interaction states.
- Oversized, highly legible headings balanced by spacious body copy.
- Fine borders, restrained depth, and gently rounded controls.
- Privacy and approval boundaries stated directly in text.

**The Calm Clarity Rule.** Visual expression may feel polished and modern, but it must never compete with the current task or make support feel urgent.

## Colors

The frontmatter palette is normative. Do not substitute legacy green, coral, gold, beige, or unrelated accent colors.

### Primary

- **Deep Royal Blue:** Primary buttons, decisive actions, active navigation, and strong accents.
- **Dark Navy:** All headings, body text, and high-contrast structure.

### Secondary

- **Cornflower Blue:** Secondary accents, interactive highlights, and prominent selected states. Pair with dark navy text when used as a surface.
- **Muted Steel Blue:** Supporting controls, secondary labels, and lower-priority structural accents.

### Neutral and Surface

- **White:** Main page and elevated reading surfaces.
- **Pale Blue-Grey:** Borders, dividers, soft surfaces, and gentle left-side gradient starts.
- **Very Light Lavender:** Quiet section backgrounds and alternate left-side gradient starts.

### Gradient Rule

Use only soft left-to-right gradients from Pale Blue-Grey or Very Light Lavender into White. Keep the transition broad and understated; do not use strong gradients, multiple saturated stops, gradient text, or unrelated hues.

**The Closed Palette Rule.** Every interface color must come from the seven approved tokens. Opacity variations are allowed only when they preserve contrast and do not appear as a new accent.

**The Semantic Contrast Rule.** Color can reinforce state but never carry meaning alone; pair selection, approval, errors, and completion with text, icons, borders, or position.

## Typography

Use a clear workhorse sans-serif stack. Hierarchy comes from scale and weight rather than decorative type.

- **Display:** Reserved for decisive page-level questions and opening statements; keep copy short and balanced.
- **Headline:** Section headings and major task transitions.
- **Body:** Minimum comfortable reading size is approximately 18px on desktop, with spacious line height and a maximum measure near 65 characters.
- **Label:** Strong, concise metadata and control labels; avoid long uppercase passages.

**The Read-Aloud Rule.** Copy and line breaks should remain comfortable when a user reads the interface aloud or follows it while listening.

## Layout

Prefer strong editorial grouping over dense dashboards. Use generous white space, fine dividers, and a clear top-to-bottom task sequence. Large screens may use a slim navigation or progress spine beside a broad reading column. Forms and activity lists should remain visually aligned and easy to compare.

At tablet and mobile widths, collapse split layouts into one column, remove decorative side structures, and make primary task buttons full-width where helpful. Never shrink touch targets below 48px or body copy below a comfortable reading size.

**The One Decision Rule.** Each viewport should make its current question and primary action obvious within seconds.

## Elevation & Depth

The system is mostly tonal and flat. Use borders and background changes for everyday grouping. Reserve a soft, downward ambient shadow for one meaningful focal surface, such as a privacy explanation or active plan; do not float every section.

**The Restrained Lift Rule.** A surface may use a border or a shadow according to its role, not both as decoration.

## Shapes

Controls and practical surfaces use gently rounded corners between 12px and 16px. Small tags may use a tighter 7px radius. Avoid excessive pills; reserve fully rounded shapes for avatars or genuinely compact status controls.

Borders use Pale Blue-Grey or Muted Steel Blue. Corners should feel precise and modern rather than playful or bubbly.

## Components

### Buttons

- Primary buttons use Deep Royal Blue with White text and a minimum height near 60px.
- Primary hover or pressed states may deepen to Dark Navy.
- Secondary buttons use White with Dark Navy text and a Muted Steel Blue border.
- Cornflower Blue may mark a selected secondary action, paired with Dark Navy text.
- Every button requires a visible Dark Navy focus outline with clear offset.

### Inputs

- Inputs use White, Dark Navy text, Muted Steel Blue borders, and large internal padding.
- Placeholder text must remain readable and should not be the only label.
- Errors must identify the problem and the recovery in persistent text.

### Surfaces and Lists

- Prefer ruled lists and grouped bands over grids of equal cards.
- Use Very Light Lavender or Pale Blue-Grey for quiet section separation.
- Selected items require a written state or visible mark in addition to a color change.

### Navigation

- Keep the number of visible destinations small and labels literal.
- On mobile, transform side navigation into a compact top control rather than preserving a narrow rail.

## Do's and Don'ts

### Do:

- **Do** use only the approved metallic blue, lavender, navy, and white palette.
- **Do** use soft left-to-right lavender/blue-grey-to-white gradients for atmosphere.
- **Do** preserve large controls, obvious focus states, and high text contrast.
- **Do** make privacy, sharing, and approval states explicit in words.
- **Do** let White and Dark Navy carry most reading surfaces and text.

### Don't:

- **Don't** reintroduce green, coral, gold, beige, neon, or unrelated semantic colors.
- **Don't** use harsh, multicolor, radial, or high-contrast gradients.
- **Don't** rely on pale blue text over white or white text over Cornflower Blue without checking contrast.
- **Don't** turn the interface into a dense dashboard or decorative card mosaic.
- **Don't** use urgency, gamification, or promotional language in care-support flows.
- **Don't** hide consent or sharing boundaries behind icons or color alone.
