# Frontend Agent Guide

This file applies to all work inside `frontend/`.

## Purpose

The frontend is the browser interface for Count Me In, a service that helps older adults discover activities and involve trusted family or friends. Build for clarity, confidence, and ease of use. Preserve the user's existing work and keep changes focused on the requested task.

## Technology

- React and TypeScript
- Vite
- React Router
- TanStack Query
- Tailwind CSS
- Vitest and Testing Library
- ESLint

Use the existing tools and configuration unless the task explicitly requires a change. Do not introduce another router, styling framework, state library, form library, or component system without a clear need and user approval.

## Source Structure

Use this structure as the application grows:

```text
src/
|-- app/          # App shell, router, layouts, providers, error boundaries
|-- assets/       # Images, icons, and local fonts imported by source code
|-- components/   # Components reused across features or pages
|   |-- layout/   # Navigation, headers, containers, and page structure
|   `-- ui/       # Generic controls such as buttons, inputs, cards, and dialogs
|-- features/     # Business capabilities grouped by product domain
|-- hooks/        # Hooks genuinely reused across multiple features
|-- lib/          # Foundational helpers and configured third-party libraries
|-- pages/        # Route-level components
|-- services/     # API client, environment, Supabase, and browser integrations
|-- styles/       # Global CSS, design tokens, and themes
|-- test/         # Shared test setup, fixtures, and render helpers
|-- types/        # Types shared by multiple features
|-- utils/        # Small, reusable, side-effect-free functions
|-- main.tsx
`-- vite-env.d.ts
```

Do not create empty folders for symmetry. Add a folder when real code needs it.

### Placement Rules

1. Put code tied to one business capability in `features/<feature>/`.
2. Put components connected directly to routes in `pages/`. Keep pages thin: they should compose features and handle route-level state.
3. Put reusable visual components in `components/`. Do not move a component there until it is useful outside its original feature.
4. Put global application wiring in `app/`, not in a feature or page.
5. Put external boundaries in `services/`. Generic HTTP behavior belongs in `services/api/`; feature-specific requests belong in `features/<feature>/api/` once that feature grows.
6. Prefer colocated tests, for example `ActivityCard.test.tsx` beside `ActivityCard.tsx`.
7. Avoid catch-all files or folders named `helpers`, `common`, or `misc`. Choose a specific owner.
8. Split into smaller logical components as much as possible. Each component should ideally be in its own file.

There is intentionally no `shared/` folder. Use the top-level `components`, `hooks`, `lib`, `types`, and `utils` folders when code is genuinely cross-feature.

## Routing

Routes are defined in `src/app/router.tsx` with React Router. The shared shell renders child pages through an `Outlet`.

- Add route-level components to `src/pages/`.
- Use `Link` or `NavLink` for internal navigation instead of plain anchors.
- Preserve the fallback route and provide a clear way back to a known page.
- Remember that production hosting must fall back to `index.html` for client-side routes.

## Design and Accessibility

Use `../DESIGN.md` as the source of truth for visual direction and theme tokens. Prefer existing CSS custom properties over repeating hexadecimal values in components.

The primary palette is:

- Royal blue: `#3D52A0`
- Cornflower blue: `#7091E6`
- Steel blue: `#8697C4`
- Pale blue-grey: `#ADBBDA`
- Light lavender: `#EDE8F5`
- Dark navy: `#252C40`
- White: `#FFFFFF`

Do not introduce unrelated colors or strong gradients. The approved background treatment is a subtle pale blue-grey or light-lavender transition into white.

The interface is intended to be comfortable for older adults:

- Use plain, direct language and clear action labels.
- Maintain strong text contrast and visible keyboard focus.
- Use semantic HTML and native controls whenever possible.
- Keep interactive targets comfortably large; aim for at least 44 by 44 CSS pixels.
- Do not rely on color alone to convey meaning.
- Avoid tiny text, dense layouts, hidden navigation, time-limited interactions, and unnecessary animation.
- Respect reduced-motion preferences.
- Ensure layouts work at narrow mobile widths and at browser zoom up to 200%.

## TypeScript and React

- Keep TypeScript strict. Do not bypass errors with `any`, broad casts, or `@ts-ignore` unless the reason is documented and unavoidable.
- Prefer small function components and explicit interfaces at module boundaries.
- Keep state close to where it is used. Add global state only when several unrelated routes truly require it.
- Use TanStack Query for asynchronous server state. Keep temporary form values, disclosure controls, and other local UI state in React.
- Define feature-specific query keys, query options, and mutations inside the owning feature. Do not duplicate query results into local state.
- Handle loading, empty, error, and success states for asynchronous UI.
- Keep secrets and service-role credentials out of browser code. Only `VITE_` variables intended to be public may enter the frontend bundle.

## API Boundary

During local development, Vite proxies `/api` and `/health` to the FastAPI backend. Prefer relative API paths so the proxy and same-origin deployments work consistently.

- Keep generic request and error handling in the service layer.
- Validate or narrow unknown response data before using it.
- Pass `AbortSignal` where requests may be cancelled.
- Show understandable user-facing errors; do not expose raw internal error messages.
- Supabase browser configuration is a future boundary only. Never place `SUPABASE_SERVICE_ROLE_KEY` in this project.

## Styling

- Use Tailwind utilities as the default for component and page styling, including layout, spacing, typography, responsive behavior, and interaction states.
- Use global CSS only for design tokens, resets, typography defaults, and genuinely application-wide behavior.
- Use a CSS Module only when a component requires styling that Tailwind cannot express cleanly. Document the reason in the component and do not use CSS Modules merely to shorten class lists.
- Prefix project-authored CSS and CSS Module class names with `cln` (for example, `clnShell`) so they are easy to distinguish from Tailwind utilities.
- Reuse theme variables such as `--primary`, `--foreground`, and `--border`.
- Avoid inline style objects unless values must be calculated at runtime.
- Preserve visible focus states and adequate hover, active, disabled, and error states.

## Testing and Verification

For normal frontend changes, run from `frontend/`:

```powershell
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

Add or update tests when behavior changes. Prefer queries based on accessible roles and labels rather than implementation details or CSS classes. Test important user outcomes, routing behavior, API mapping, validation, and failure states.

Before handing work back:

1. Confirm lint, tests, and the production build pass.
2. Check the changed-file list and avoid unrelated edits.
3. Report any verification that could not be completed.
4. Mention dependency or security warnings without applying breaking automated fixes unless requested.

## Change Discipline

- Do not edit the legacy HTML prototypes outside `frontend/` unless explicitly asked.
- Do not commit generated `dist/`, coverage, local `.env`, or `node_modules/` content.
- Update `.env.example` when adding a public environment variable.
- Update this guide when an architectural convention changes.
- Prefer incremental refactors tied to the active task over speculative abstractions.
