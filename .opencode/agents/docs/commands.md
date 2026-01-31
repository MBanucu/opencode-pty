# Commands

## Development/Run/Build

- `bun run dev` — Start Vite-based development server (frontend only)
- `bun run dev:server` — Start PTY Web UI/API in dev mode (test Web server)
- `bun run build` — Clean, typecheck, and build all assets
- `bun run build:dev` — Build assets in development mode
- `bun run build:prod` — Build assets in production mode
- `bun run build:plugin` — Build plugin for OpenCode consumption
- `bun run install:plugin:dev` — Build + install plugin to local .opencode
- `bun run install:web:dev` — Build web client in dev mode
- `bun run install:all:dev` — Build/install plugin & web client
- `bun run run:all:dev` — Full build/install workflow then run OpenCode (silent)
- `bun run preview` — Preview built UI site

## Lint/Format/Quality

- `bun run lint` — Run ESLint on all source (strict)
- `bun run lint:fix` — ESLint auto-fix
- `bun run format` — Prettier formatting (writes changes)
- `bun run format:check` — Prettier check only
- `bun run quality` — Lint, format check, and typecheck (all code-quality checks)

## Test & Typecheck

- `bun run typecheck` — Typescript strict check (no emit)
- `bun run typecheck:watch` — Typecheck in watch mode
- `bun run test` — Unit tests (Bun test runner, all but e2e/web)
- `bun run test:watch` — Unit tests in watch mode
- `bun run test:e2e` — Playwright end-to-end tests; ensure dev server built, use `PW_DISABLE_TS_ESM=1` for Bun
- `bun run test:all` — All unit + E2E tests
- Run single/filtered unit test: `bun test --match "<pattern>"`

## Other

- `bun run clean` — Remove build artifacts, test results, etc.
- `bun run ci` — Run quality checks and all tests (used by CI pipeline)

**Note:** Many scripts have special requirements or additional ENV flags; see inline package.json script comments for platform- or environment-specific details (e.g. Playwright+Bun TS support requires `PW_DISABLE_TS_ESM=1`).
