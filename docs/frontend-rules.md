# Frontend Rules

## MVVM Pattern

Every component must be split into a ViewModel file and a View file:

- **`component.tsx` (ViewModel)**: `useState`, `useEffect`, `useCallback`, `useRouter`, data fetching, event handlers, auth checks, business logic. Returns `<ComponentView ...allComputedProps />`.
- **`component.view.tsx` (View)**: styled-components, `useTranslations` (display-only, acceptable), and the JSX `return`. No data fetching, no state, no handlers.

### Rules

- The ViewModel computes all values and passes them as props to the View.
- The View receives props and renders. No business logic allowed in the View.
- `useTranslations` may live in the View since it is purely display-related.
- All other hooks (`useState`, `useEffect`, `useCallback`, etc.) must be in the ViewModel.

## Atomic Design

Follow Atomic Design strictly:

- **atoms/**: Smallest reusable units (Button, Input, Tag). No business logic. No data fetching.
- **molecules/**: Composed of atoms. Single-purpose UI groups (ShopCard, SortBar, SearchBar).
- **organisms/**: Composed of molecules and atoms. Feature-level blocks (ShopList, MypagePanel). Must follow MVVM split.
- **templates/**: Page layout shells.

Do not put everything in organisms. Extract repeated primitives into atoms or molecules.

## Styling

- Use styled-components.
- Do not mix styling systems without a clear reason.
- Store colors in `color.ts` and import them.
- Do not hardcode color values inside components.
- Extract repeated styles into shared styles or reusable styled components.

## Constants and Types

- Store enums in separate files.
- Store constants in separate files.
- Minimize magic numbers and hardcoded strings.
- Import reusable values from shared constant or enum files.

## State

- Use Redux only for state shared across screens or required globally.
- Keep local state local.
- Separate global state from UI-only state.

## Domain Data

- Treat shop location data and gacha item data as separate concerns.
- Use collected data or admin-verified data as the basis for location data.
- Do not assume gacha item availability is permanently accurate.

## DB Rules

- Treat database schema and data contracts carefully.
- Check `docs/db-schema.md` before schema-related changes.
- Explain schema changes, migrations, or destructive queries before doing them.
- Keep collected raw data and normalized data separate.
- Do not change field meanings or response contracts silently.
