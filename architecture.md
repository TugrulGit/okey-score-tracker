# Architecture Overview

This monorepo (`okey-score-monorepo`) hosts every client, backend, and shared library for the Okey score tracker. It is managed with **pnpm workspaces** and orchestrated with **Turborepo** so packages can be developed, linted, and built together.

## Repository layout

- `apps/web` – Next.js front-end that consumes the shared UI kit.
- `apps/api` – NestJS HTTP API (currently only exposes a liveness route) prepared to consume the domain logic.
- `apps/mobile` – placeholder React Native/Expo workspace (folders exist but there is no package.json yet, so it is not part of the pnpm workspace build graph).
- `packages/ui-kit` – React component library (buttons, the score board widget, theme tokens).
- `packages/domain` – pure TypeScript domain model: players, scoreboards, services, and value objects.
- `infra` – Dockerfiles, docker-compose definition, and IaC placeholders for deploying `web` and `api`.
- `tests` – empty e2e/unit scaffolding, currently unused.

## Tooling & root configuration

- Root `package.json` declares pnpm workspaces (`apps/*`, `packages/*`) and exposes helper scripts:
  - `dev` runs `turbo run start:dev` with filters so `apps/web` and `apps/api` start together.
  - `build:dev` / `build:prod` ensure `domain` and `ui-kit` compile before running `turbo run build` for downstream apps.
  - `start:dev` / `start:prod` wrap install→build→serve into an interactive flow for local or production bring up.
- `turbo.json` configures caching rules: `build` depends on upstream package builds (`^build`) and captures `dist/**` plus Next’s `.next` output, while `lint` and the various `start:*` commands skip caching.
- `tsconfig.base.json` centralizes strict TS settings (ES2020 target, `react-jsx`, `esModuleInterop`, etc.), and every workspace extends it.
- pnpm resolves workspace dependencies via `workspace:*` semver ranges (see `packages/ui-kit/package.json` for `domain`).

## Package graph at a glance

```
packages/domain ─→ (value objects, services, entities)
        ↑
        │ (workspace dependency + TS path alias)
packages/ui-kit ───────┐
        ↑              │ transpiled + bundled into dist/
        │              │
apps/web (Next.js) ────┘ imports `ScoreBoard`, `Button`

apps/api (NestJS) has TS paths to `packages/domain`, though the current controllers do not yet consume the domain layer.
```

## Applications

### Web (`apps/web`)

- Next.js 14 (`apps/web/package.json`) with scripts for `dev`, `build`, and `start`. Dependencies are `next`, `react`, `react-dom`, and the UI kit via a `workspace:*` range so pnpm links directly to `packages/ui-kit` during local development.
- `tsconfig.json` maps `ui-kit` and `domain/*` into the source folders (`packages/ui-kit/src`, `packages/domain/src`) and includes those files so the editor/tsc see live TypeScript rather than prebuilt artifacts.
- `next.config.js`:
  - Enables `transpilePackages: ['ui-kit']` so Next transpiles the shared component library during bundling.
  - Sets `output: 'standalone'` for Docker image builds, `reactStrictMode: true`, and `experimental.externalDir` so files outside `apps/web` are allowed.
  - Adds a webpack alias that resolves `'ui-kit'` to `packages/ui-kit/src`, which (combined with the workspace link) enables hot reload when editing shared components.
- Runtime wiring:
  - `_app.tsx` loads `src/styles/global.css`, which defines CSS variables for the web container. Shared UI kit tokens live within `packages/ui-kit/src/themes/global.css` so the component library can ship defaults without reaching into the app.
  - `src/pages/index.tsx` imports `Button` from `ui-kit` to prove that cross-package components render on the homepage.
  - `src/pages/score_board.tsx` imports `ScoreBoard` from `ui-kit` and passes initial players, round scores, and penalty counts. The component handles its own React state and invokes `onStateChange` whenever the board mutates.

### API (`apps/api`)

- NestJS project with scripts for `start`, `start:dev` (via `nest start`), `build`, and Prisma helpers. Dependencies include `@nestjs/*`, `@prisma/client`, and `rxjs`.
- `tsconfig.json` extends the root config but switches the module system to `NodeNext` for Nest + ES modules, emits into `dist/`, and defines `paths` to `@okey-score/domain/* → packages/domain/src/*` to make the domain layer available to services.
- `src/app.module.ts` wires a single `GameController` that currently exposes `/` with `{ message: 'Okey Score Tracker API is up ✅' }`. No providers or Prisma modules are registered yet, but the scaffolding under `src/modules/{auth,game,user}` is where those would live.
- The API is packaged by `infra/api.Dockerfile` (see docker-compose) and can run alongside the web app via `docker-compose up`.

### Mobile (`apps/mobile`)

- Contains only `assets/` and `src/` directories with no configuration or source files checked in. Because there is no `apps/mobile/package.json`, pnpm ignores this folder even though `pnpm-workspace.yaml` matches `apps/*`. The folder is effectively a placeholder until a React Native/Expo app is added.

## Shared packages

### Domain (`packages/domain`)

- Exposes type-safe building blocks for the scoring logic: entities (`Player`, `ScoreEntry`, `Scoreboard`), value objects (`PlayerId`, `Points`, `RoundNumber`), and services (`scoreboard-service.ts`).
- `package.json` points both `main` and `types` to `src/index.ts` so consumers import the raw TS source during development. `build` emits `dist/` via `tsc --outDir dist` for production.
- `tsconfig.json` enables strict mode, React JSX, ESNext modules, and defines a `paths` alias `domain/* → ./src/*` so internal imports stay clean.
- Example flow (`services/scoreboard-service.ts`): `initializeScoreboard` turns simple DTOs into `Player`/`ScoreEntry` entities, `applyRoundScores` records round entries, and helpers like `getLeaderboard` or `getRounds` compute derived data. These utilities are ready to back both the API and UI when wiring occurs.

### UI Kit (`packages/ui-kit`)

- Provides reusable React components and CSS theme primitives.
- `package.json` declares `domain` as a workspace dependency, ensuring the component library can lean on shared types/value objects if needed. `build` runs `tsc --outDir dist` then `scripts/copy-static-assets.cjs` copies `.css` files (themes, component styles) into `dist/`. Even though the web app now consumes the `src/` directory directly for dev/hot reload, retaining the `dist` build keeps Docker (which copies `.next/standalone` built against `dist`) and any future external consumers working.
- `tsconfig.json` defines `paths` so TypeScript resolves `domain/*` imports against the actual source folder.
- `src/index.ts` re-exports `Button` and `ScoreBoard`. Consumers import from `'ui-kit'` rather than deep component paths.
- `src/components/score-board/scoreboard.tsx` renders the interactive scoreboard seen in `apps/web`. It pulls palette variables from `src/themes/palette.css` and component-specific styles from `scoreboard.css`. Internally it keeps the player list, rounds, penalties, and totals in React state while emitting snapshots via `onStateChange`.

## Styling & assets

- Global color tokens live in `apps/web/src/styles/global.css`, with a mirrored set (including typography values) under `packages/ui-kit/src/themes/{global,palette}.css`. UI kit components rely on those CSS custom properties for gradients, penalty colors, and player accents.
- The `copy-static-assets.cjs` build step guarantees CSS files next to components make it into `dist/`, so Next.js consumers can load them when importing from the built package.

## Infrastructure

- `infra/docker-compose.yml` builds two images from `infra/web.Dockerfile` and `infra/api.Dockerfile` and runs them together (`web` depends on `api`).
- `infra/k8s`, `infra/terraform`, and `infra/scripts` are placeholders for future deployment automation.

## Testing status

- `tests/e2e` and `tests/unit` currently have no specs. Turborepo has no `test` pipeline configured yet, so automated regression coverage is not in place.

Use this document as the canonical map for how packages are wired today—expand each section as new services, shared utilities, or deployment flows land in the repo.
