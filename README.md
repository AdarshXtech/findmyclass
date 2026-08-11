# Find My Class

Class schedule locator for students with an authenticated admin panel for managing students, subjects, room assignments, and student imports. Students verify their timetable with their full name and phone number.

## Tech Stack

- Frontend: React 18, React Router 7, Vite 6, Tailwind CSS 3
- Backend: Node.js 20.12+, Express 4
- Database: PostgreSQL in production, with file-backed SQLite for local development
- Authentication: HttpOnly signed admin session cookies with CSRF and role checks
- Imports: `@e965/xlsx` for `.csv`, `.xls`, and `.xlsx` files; Tesseract.js for timetable images

## Documentation

The college deployment, database mapping, security, migration, backup, faculty, and operations guide is available at [docs/college-deployment-guide.md](docs/college-deployment-guide.md). The generated PDF is `college-deployment-and-database-integration-guide.pdf`.

## Quick Start and Development

### Backend

```powershell
cd server
Copy-Item .env.example .env
npm ci
npm run load-csai2b
npm run create-admin
npm run dev
```

Before `npm run create-admin`, replace every example secret in `.env`. `ADMIN_PASSWORD` must contain at least 12 characters. The command creates the configured admin or rotates its password if it already exists.

`npm run load-csai2b` is development/transition data loading. Normal production startup does not load repository datasets unless `LOAD_BUNDLED_DATA=true`. The API runs at `http://localhost:5000` by default.

### Frontend

```powershell
cd client
Copy-Item .env.example .env
npm ci
npm run dev
```

The app runs at `http://localhost:3000`. In development, Vite proxies `/api` to the backend.

## Environment Variables

Backend (`server/.env`):

- `PORT`: API port; defaults to `5000`.
- `JWT_SECRET`: JWT signing secret. Required when `NODE_ENV=production`.
- `CLIENT_ORIGIN`: optional comma-separated allowed frontend origins. Leave empty for the same-origin production deployment.
- `DATABASE_PATH`: SQLite file path; defaults to `server/database.sqlite`.
- `DATABASE_URL`: PostgreSQL connection string. When set, it takes precedence over local SQLite.
- `PHONE_LOOKUP_SECRET`: separate secret used to create keyed phone-number hashes. Required for student access records.
- `STUDENT_ACCESS_RECORDS_JSON`: private JSON array mapping verified students to roster roll numbers and sections.
- `TRUST_PROXY`: trusted proxy hop count. Use `1` on Render so rate limits use the originating client IP.
- `ADMIN_USERNAME`: used only by `npm run create-admin`.
- `ADMIN_PASSWORD`: used only by `npm run create-admin`; minimum 12 characters.
- `ADMIN_ROLE`: `SUPER_ADMIN` or `TIMETABLE_ADMIN`.
- `ENABLE_TEST_LOGIN`: development-only demo access; production must use `false`.
- `LOAD_BUNDLED_DATA`: opt-in repository schedule loading; normally `false` in production.
- `STUDENT_LOOKUP_WINDOW_MS` and `STUDENT_LOOKUP_MAX_FAILURES`: per-identity failed lookup protection.
- `UPLOAD_LIMIT_BYTES` and `JSON_BODY_LIMIT`: request limits.

Frontend (`client/.env`):

- `VITE_API_BASE_URL`: optional backend origin. Leave empty when using the development proxy or a same-origin production reverse proxy.

## Demo Data

Demo records are never created by normal application startup and the SQLite database is not committed. For local development only, `npm run seed` replaces all current database records with the repository's sample dataset. Seeding is blocked when `NODE_ENV=production`.

## CSAI 2B Source Data

The application dataset is stored in `server/data/csai2b-2026.json`. Its extraction decisions, section-label discrepancy, and excluded non-CSAI2B row are documented in `server/data/README.md`. University roll numbers identify roster records internally; the public lookup requires an exact normalized name and matching phone number.

## Verification

```powershell
cd server
npm test
npm run test:postgres
npm audit --omit=dev

cd ../client
npm run build
npm audit --omit=dev
```

See [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md) for the verified feature map, test evidence, known limitations, and deployment checks that still require an external environment.

## Production

The deployment is split across three services so database changes persist without a paid disk:

- Neon hosts PostgreSQL.
- A college VM, container service, or Render can run the Express API from `server/`.
- Vercel builds the React app from `client/` using `client/vercel.json`.

Configure PostgreSQL, exact HTTPS origins, separate secrets, and a reverse proxy. Run `npm run check:production --prefix server` and `npm run migrate --prefix server` before restarting the API. In Vercel, use either the root `vercel.json` from repository root or `client/vercel.json` with project root `client`, then set `VITE_API_BASE_URL` to the API origin.

To enable the admin panel, set `ADMIN_USERNAME` and `ADMIN_PASSWORD` for a local shell connected to the production `DATABASE_URL`, then run:

```sh
npm run create-admin --prefix server
```

After deployment, verify the Vercel URL with an authorized student name and phone number from `STUDENT_ACCESS_RECORDS_JSON`.
