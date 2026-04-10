# Frontend Rules

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
