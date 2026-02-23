<h1 align="center">Okey Score Tracker</h1>

This repo hosts the Next.js web app, NestJS API, and shared packages used to power the Okey scoreboard experience described in `plan.md`.

## Environment Setup

1. Copy `.env.example` to `.env` in the repo root.
2. Update any secrets for your environment (dev defaults are safe to keep locally).

| Variable | Purpose | Default |
| --- | --- | --- |
| `DATABASE_URL` | Postgres connection string used by Prisma + Nest API. | `postgresql://postgres:postgres@localhost:5433/okey?schema=public` |
| `JWT_ACCESS_SECRET` | Signs 15-minute access tokens returned by the API. | `dev-access-secret-change-me` |
| `JWT_REFRESH_SECRET` | Signs 7-day refresh tokens returned by the API. | `dev-refresh-secret-change-me` |
| `RESET_TOKEN_SECRET` | Signs password reset links emailed to users. | `dev-reset-secret-change-me` |
| `EMAIL_FROM` | Default “from” address for password/reset emails. | `no-reply@okeyscore.local` |
| `EMAIL_API_KEY` | API key for your transactional email provider (stubbed in dev). | `dev-email-api-key` |
| `WEB_BASE_URL` | Public URL for the Next.js frontend. | `http://localhost:3000` |
| `API_BASE_URL` | Public URL for the Nest API (used by the web proxy routes). | `http://localhost:4000` |

## Local Development

```bash
# boots ui-kit/domain builds, API, and Web via turborepo pipeline
pnpm start:dev
```

### Optional: Dev database via Docker

If you prefer running the Postgres dependency in Docker while keeping hot reload through `pnpm start:dev`, spin it up with:

```bash
docker compose -f infra/docker-compose.dev.yml up -d
```

This starts a dev-only Postgres 15 container (`okey-postgres-dev`) listening on `localhost:5433` so the API/web apps can connect via the `DATABASE_URL` defined in `.env`.

Before submitting changes, sync `tasks.md` to reflect progress across Epics so the backlog mirrors the work described in `plan.md`.
