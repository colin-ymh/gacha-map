# Architecture Rules

## Architecture
- Use Atomic Design.
- Use MVVM.
- Separate UI, state, and business logic.

## Directory Rules
- Put route files in `app/`.
- Put shared UI components in `components/`.
- Put shared logic and integrations in `lib/`.
- Put shared types in `types/`.
- Put reference documents in `docs/`.
- Do not create new top-level directories without a clear reason.

## Naming Rules
- Use kebab-case for files and folders unless framework rules require otherwise.
- Follow Next.js reserved filenames such as `page.tsx`, `layout.tsx`, and `not-found.tsx`.
- Declare components with arrow functions:
    - `const ComponentName = () =>`
- If ViewModel files are split, use:
    - `component-name.tsx`
    - `component-name.view.tsx`

## Component Folder Rules
- Inside each Atomic level (`atoms`, `molecules`, `organisms`, `templates`), separate:
    - `common/` for shared components
    - page-specific folders for page-level components
- Do not create a dedicated folder for every single component file.

## Component Rules
- Split reusable components and reuse them.
- Keep shared components and domain-specific components clearly separated.
- Keep each component focused on a single responsibility.
- Avoid over-fragmentation and unnecessary abstraction, especially at MVP stage.
