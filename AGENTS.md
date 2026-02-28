# AGENTS.md

This file provides guidance to AI coding agents when working with code in this repository.

## Commands

- `npm run build` — bundle with tsup (src/index.ts → dist/index.js, ESM)
- `npm test` — run all tests in watch mode (run after every refactoring or code change)
- `npm run test:run` — single-pass test run (CI)
- `npx vitest run src/api/client.test.ts` — run a single test file
- `npm run dev` — run from source via ts-node
- `npx prettier --write .` — format all files (run before completing any task)

## Code Quality

- Write small, focused functions that do one thing (Single Responsibility)
- Name functions and variables to reveal intent — avoid abbreviations and generic names
- Keep functions short; extract when a block needs a comment to explain _what_ it does
- No dead code, no commented-out code — delete it (git has history)
- Avoid magic numbers/strings — use named constants
- Prefer early returns over deeply nested conditionals
- Keep function arguments to 3 or fewer; group related args into an object
- Don't repeat yourself — but only extract shared logic when duplication is real, not speculative

## TDD Workflow

Follow Red-Green-Refactor for all code changes:

1. **Red** — Write a failing test that defines the expected behavior
2. **Green** — Write the minimum code to make the test pass
3. **Refactor** — Clean up while keeping tests green

Rules:

- Never write production code without a failing test first
- Run `npm test` after every change — never leave tests red
- One logical assertion per test; test names describe the behavior, not the implementation
- When fixing a bug, first write a test that reproduces it, then fix

## Testing

- Tests use Vitest with ESM imports and `globals: true` (no need to import `describe`/`it`/`expect`)
- Test files live next to source files with a `.test.ts` suffix
- System dependencies (fetch) are mocked via `vi.mock()` / `vi.fn()`
- Vitest config: `restoreMocks: true`, `clearMocks: true` — mocks auto-reset between tests

## Commits

- Use [Conventional Commits](https://www.conventionalcommits.org/) for all commit messages
- Format: `<type>(<optional scope>): <description>` (e.g., `feat: add PDF support`, `fix(mailer): handle timeout`)
- Common types: `feat`, `fix`, `refactor`, `test`, `chore`, `docs`, `style`, `perf`, `ci`, `build`

## Formatting

- Prettier is configured via `.prettierrc` (printWidth: 100, singleQuote, trailingComma: all)
- All `.ts` files must be formatted with Prettier

## Architecture

**CLI tool for the Anytype local API** (`http://127.0.0.1:31009`). Anytype Desktop must be running. Auth via `Authorization: Bearer <api_key>` header. ESM throughout (`"type": "module"`).

### Entry Point & Command Registration

`src/index.ts` — Commander.js program with global flags (`--verbose`, `--no-color`, `--space`, `--dry-run`). Each command is registered via `program.addCommand(create*Command())`.

### Command Pattern

Every command module in `src/cli/commands/` exports a `create*Command(): Command` factory. The `.action()` handler calls an async action function wrapped in `try/catch → handleError()`. Commands: `init`, `types`, `list`, `get`, `create`, `update`, `search`, `alias`, `fields`, `templates`.

### API Client (`src/api/client.ts`)

`AnytypeClient` class wraps all HTTP calls using native `fetch`. Handles both wrapped (`{ object: {...} }`) and unwrapped response shapes since the Anytype API is inconsistent. Type filtering routes through the search endpoint because the objects endpoint doesn't support type query params.

### Config (`src/config/index.ts`)

Singleton `ConfigManager` backed by `conf` package. Stores in `~/.anytype-cli/config.json`: `apiKey`, `defaultSpace`, `aliases`, `typeFields`, `baseURL`. Alias resolution maps short names to actual type keys before API calls.

### Output (`src/cli/output.ts`)

Formatters for markdown tables, JSON, and text views. `resolveFieldValue()` resolves display values across top-level fields, the properties array, and computed fields (`link_count`, `backlink_count`). `resolveRawFieldValue()` returns typed values (Date/number/string/null) for sorting.

### Utilities

- `src/utils/errors.ts` — Typed error classes (`CLIError`, `ConfigError`, `ConnectionError`, `NotFoundError`, `ValidationError`) with exit codes (0-5)
- `src/utils/date.ts` — `parseDateFilter()`: `"today"`, relative (`"7d"`, `"2w"`, `"1m"`), ISO dates
- `src/utils/properties.ts` — Property flag parsing with type auto-detection (checkbox, number, url, email, date, text). Schema-based detection uses type property definitions when available. Explicit `key:type=value` syntax overrides auto-detection

### Key Conventions

- **ESM with `.js` extensions**: All internal imports use `.js` extensions even though source is `.ts` (required for ESM at runtime)
- **Stdin support**: `create` and `update` detect piped stdin via `process.stdin.isTTY`; `--body -` explicitly reads from stdin
- **Object name resolution**: Commands resolve object-type property IDs to human-readable names via parallel `getObject()` calls, passing a `Map<id, name>` to formatters
- **`--where` filtering**: `field=value` (includes), `field=` (empty), `field!=` (not empty)
- **`--sort` syntax**: `field:asc` or `field:desc` with typed comparisons; nulls sort last
- **`--fields` defaults**: Per-type default columns persisted via `anytype fields set/remove/list`
- **Test mocking**: `client.test.ts` mocks `global.fetch`; utility tests are pure functions with no mocks
