Write or update tests for: $ARGUMENTS

Goal:
Create practical tests that protect current MVP behavior in `gacha-map`.

Project priorities:
- Map view
- List view
- Map/list synchronization
- Stable user-facing behavior
- Clear empty, loading, and error states

Instructions:
1. Read `CLAUDE.md`, `docs/workflow.md`, `docs/architecture.md`, and `docs/features.md` first.
2. Inspect the target files and any related tests.
3. Do not create overly broad test coverage. Focus on the highest-value behavior first.
4. Prefer updating existing tests over creating duplicate test files.
5. Follow existing project testing patterns if they already exist.
6. If no testing pattern exists, use a simple, maintainable structure.

Coverage priorities:
- Happy path
- State synchronization
- Empty state
- Error state
- Regressions caused by recent changes

For map/list related code, focus on:
- marker selection updates list state
- list selection updates selected shop state
- map and list use the same source data
- selected state remains consistent after rerender or prop updates

Output format before writing tests:
- Request summary
- Target files
- Existing test coverage
- Proposed test cases
- Files to create or update
- Risks or open questions

Output format after writing tests:
- Changed files
- Test coverage added
- Remaining gaps
- Recommended follow-up checks
- Suggested commit message
