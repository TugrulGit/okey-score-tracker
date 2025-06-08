# Okey Score Tracker

This project is organized for structured containerization:

- `frontend/` — React + Vite app (all UI code)
- `backend/` — Backend code (Java MVC structure suggested)
- `database/` — Database scripts/configuration
- `mlm/` — Machine learning models/scripts

## Frontend

See `frontend/README.md` for setup and usage.

## Backend

Java MVC structure is scaffolded. See `backend/README.md` and `pom.xml` for details.

## Database

Place DB scripts, migrations, or configs in `database/`.

## MLM

Place machine learning models/scripts in `mlm/`.

## Docker

To build and run the app with Docker (update Dockerfile/docker-compose.yml as needed for new structure):

1. Build the Docker image:
   ```sh
   docker compose build
   ```
2. Run the container:
   ```sh
   docker compose up
   ```

---

This project was bootstrapped with [Vite](https://vitejs.dev/) and uses React + TypeScript for the frontend.
