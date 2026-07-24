# Smart Classroom Locator (findmyclass)

Class schedule locator for students with an authenticated admin panel for managing students, subjects, room assignments, and student imports. Students verify their timetable with their full name and phone number.

## Tech Stack

- Frontend: React 18, React Router 7, Vite 6, Tailwind CSS 3
- Backend: Node.js 20.12+, Express 4
- Database: PostgreSQL in production, with file-backed SQLite for local development
- Authentication: server-verified JWTs for admin routes
- Imports: ExcelJS for `.xlsx` and `.csv` files

## Local Setup

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

`npm run load-csai2b` loads the supplied 58-student CSAI 2B roster and its 2026-27 timetable without deleting unrelated records. The API runs at `http://localhost:5000` by default.

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

## Free Deployment

The deployment is split across three services so database changes persist without a paid disk:

- Neon hosts PostgreSQL.
- Render runs the Express API from `server/` using `render.yaml`.
- Vercel builds the React app from `client/` using `client/vercel.json`.

Create a Neon project and copy its pooled connection string. When creating the Render Blueprint, provide `DATABASE_URL`, the final Vercel origin as `CLIENT_ORIGIN`, and the private `STUDENT_ACCESS_RECORDS_JSON` value. Render generates `JWT_SECRET` and `PHONE_LOOKUP_SECRET`; changing the phone lookup secret requires reloading the access records. In Vercel, set the project root to `client` and set `VITE_API_BASE_URL` to the Render service origin. The backend loads both confirmed schedules and applies the private student access mappings idempotently on startup.

To enable the admin panel, set `ADMIN_USERNAME` and `ADMIN_PASSWORD` for a local shell connected to the production `DATABASE_URL`, then run:

```sh
npm run create-admin --prefix server
```

After deployment, verify the Vercel URL with an authorized student name and phone number from `STUDENT_ACCESS_RECORDS_JSON`.
