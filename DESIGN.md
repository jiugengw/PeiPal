---
name: Count Me In
description: A gentle care companion for older adults and the family members who support them.
colors:
  ink: "#17211d"
  muted: "#66736d"
  soft: "#f5f1e7"
  panel: "#fffdf8"
  line: "#d9ded4"
  green: "#2f6f4f"
  green-dark: "#204d38"
  blue: "#335c81"
  coral: "#c85f4d"
  gold: "#d69f34"
typography:
  display:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "clamp(2rem, 4vw, 3.15rem)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "normal"
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.8rem, 4vw, 3rem)"
    fontWeight: 700
    lineHeight: 1.05
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.02rem"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.78rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "normal"
rounded:
  md: "8px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "14px"
  md: "18px"
  lg: "28px"
  xl: "46px"
components:
  button-primary:
    backgroundColor: "{colors.green}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "0 22px"
    height: "50px"
  button-secondary:
    backgroundColor: "#ffffff"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 22px"
    height: "50px"
  field:
    backgroundColor: "#ffffff"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "52px"
  card:
    backgroundColor: "#ffffff"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "20px"

# Design System: Count Me In

## Overview

**Creative North Star: "The Gentle Care Companion"**

The incumbent interface expresses Count Me In as a calm, warm setup space for a family member helping an older adult. It combines a deep green progress rail with a softly tinted paper-like canvas, generous copy, and friendly circular avatars. The tone is human and reassuring, with practical information presented in approachable steps.

The current palette, 8px card geometry, and Inter-only type system are documented as the existing implementation, not as permanent brand commitments. Future visual work may evolve them while preserving the product's warmth, clarity, dignity, and low-pressure support model.

**Key Characteristics:**

- Warm paper surfaces against a calm green anchor.
- Clear step-by-step progression and large readable headings.
- Softly lifted cards with restrained borders.
- Human support represented through circles, initials, and orbit motifs.

## Colors

The current palette is earthy and supportive: green carries trust and action, cream and white create a gentle base, blue supports secondary information, and coral/gold provide human accents.

### Primary

- **Garden Green** (`#2f6f4f`): Primary actions, approval cues, progress states, and the main trust signal.
- **Deep Green** (`#204d38`): Hover state and darker anchor surfaces.

### Secondary

- **Quiet Blue** (`#335c81`): Informational accents and secondary avatar color.

### Tertiary

- **Warm Coral** (`#c85f4d`): Human accent, emphasis, and caution-adjacent support cues.
- **Soft Gold** (`#d69f34`): Progress completion and warm highlight.

### Neutral

- **Ink** (`#17211d`): Primary text.
- **Muted Sage** (`#66736d`): Supporting text and descriptions.
- **Warm Paper** (`#f5f1e7`): Soft note and background surface.
- **Panel Cream** (`#fffdf8`): Main content surface.
- **Quiet Line** (`#d9ded4`): Borders and dividers.

### Named Rules

**The Low-Pressure Accent Rule.** Accent colors should clarify trust, support, or state; they should not make the experience feel urgent or promotional.

## Typography

**Display Font:** Inter (with system sans-serif fallbacks)

**Body Font:** Inter (with system sans-serif fallbacks)

**Character:** A single sans-serif family keeps the setup practical and legible. Weight and scale create hierarchy rather than decorative type, which supports older-adult readability and family-member scanability.

### Hierarchy

- **Display** (700, `clamp(2rem, 4vw, 3.15rem)`, `1`): Large sidebar statement and product-level orientation.
- **Headline** (700, `clamp(1.8rem, 4vw, 3rem)`, `1.05`): Main screen titles and decisive setup moments.
- **Title** (700, `1.05rem`, default line-height): Card and subsection labels.
- **Body** (400, `1.02rem`, `1.65`): Explanations, reassurance, and practical context.
- **Label** (800, `0.78rem`, uppercase): Kicker labels, metadata, and approval state.

### Named Rules

**The Readable Step Rule.** Keep explanatory copy comfortable and spacious; the interface should feel easy to follow aloud as well as on screen.

## Layout

The desktop setup uses a centered two-column shell, with a 340px green sidebar and a flexible content panel inside a maximum 1180px frame. The shell has a minimum height of `min(760px, calc(100vh - 56px))` and is surrounded by 28px page padding. Content screens use 46px padding and generous gaps between sections.

The information architecture is progressive: one setup screen is visible at a time, while the sidebar shows six named steps. Forms use two-column grids where space allows. At 920px and below, the layout becomes a full-width stacked flow, the progress steps become a compact grid, and form/content grids collapse to one column. At 520px and below, padding tightens, steps use two columns, and action buttons stack full-width.

## Elevation & Depth

The incumbent system is softly lifted rather than flat. The main shell uses an ambient `0 24px 60px rgba(42, 52, 46, 0.16)` shadow; the central avatar uses a smaller green-tinted lift. Cards rely on white tonal contrast and quiet borders first, with shadow reserved for the overall frame and signature visual.

### Shadow Vocabulary

- **Shell ambient:** `0 24px 60px rgba(42, 52, 46, 0.16)` for the page-level setup frame.
- **Avatar lift:** `0 12px 28px rgba(47, 111, 79, 0.22)` for the primary profile avatar.

### Named Rules

**The Soft Lift Rule.** Use depth to establish a calm container or meaningful focal point; do not make every card float.

## Shapes

Most panels, fields, buttons, rows, and progress items use a consistent 8px radius. Avatars, status marks, and orbit elements use fully circular geometry (`999px`) to provide the human counterpoint to the practical rectangular surfaces. Borders are quiet and slightly green-tinted or neutral. On mobile, the outer shell loses its radius and border to become a full-bleed experience.

## Components

### Buttons

- **Shape:** Dependable medium radius (`8px`), minimum height `50px`.
- **Primary:** Garden Green background, white text, `0 22px` horizontal padding, heavy weight.
- **Hover / Focus:** Primary darkens to Deep Green on hover. Visible focus uses a blue translucent 3px outline with 2px offset.
- **Secondary:** White background, ink text, quiet border, same dimensions as primary.

### Cards / Containers

- **Corner Style:** Medium 8px radius; circular geometry is reserved for people and completion states.
- **Background:** White cards on Panel Cream or soft tinted surfaces.
- **Shadow Strategy:** Shell and central avatar only; most cards use border and tonal contrast.
- **Border:** `1px solid #d9ded4` for standard cards and rows.
- **Internal Padding:** Common values are 14px, 18px, 20px, 22px, 24px, and 46px according to component scale.

### Inputs / Fields

- **Style:** White fill, `1px solid #cfd7ce`, 8px radius, minimum height 52px, 14px horizontal padding.
- **Focus:** 3px translucent blue outline with 2px offset.
- **Error:** Warm red/coral text with a persistent message area to avoid layout jumps.

### Navigation

- **Style:** The sidebar's six-step list is the primary navigation. Steps are outlined, rounded rows with circular markers. Active and completed states receive a translucent light surface; completed markers use gold.
- **Mobile treatment:** The sidebar becomes a top section and the steps become a compact grid without visible markers.

### Support Circle Visual

The welcome preview uses a central initial-based avatar, orbit rings, and smaller surrounding avatars to make the trusted-circle concept immediately legible without relying on photography or fabricated people imagery.

## Do's and Don'ts

### Do:

- **Do** keep hierarchy explicit through scale, weight, and one-screen-at-a-time progression.
- **Do** use warm, plain-language explanations alongside controls.
- **Do** preserve strong visible focus states and large touch-friendly controls.
- **Do** use circles and initials to express people, trust, and support.
- **Do** treat the current palette and 8px radius as documented incumbent choices that may be refined later.

### Don't:

- **Don't** introduce urgency, gamification, or promotional visual language into care-support flows.
- **Don't** hide important approval or sharing boundaries behind decorative UI.
- **Don't** rely on color alone to communicate progress, permission, or errors.
- **Don't** replace readable supporting copy with dense menus or unexplained icons.
- **Don't** fabricate testimonials, customer proof, or live integrations in the interface.
