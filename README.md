# Smart Classroom Locator (findmyclass)

QR-based classroom locator for students with an admin panel for managing students, subjects, and classroom assignments.

## Tech Stack

- Frontend: React + Vite + Tailwind CSS
- Backend: Node.js + Express
- Database: sql.js (file-based SQLite at `server/database.sqlite`)
- Auth: JWT (admin only)

## Project Structure

- `client/` - student and admin web app
- `server/` - REST API and data layer

## Local Setup

### 1) Backend

1. Copy `server/.env.example` to `server/.env` and set values.
2. Install dependencies:
   - `cd server`
   - `npm install`
3. Seed sample data:
   - `npm run seed`
4. Start API:
   - `npm run dev` (or `npm start`)

### 2) Frontend

1. Copy `client/.env.example` to `client/.env` if you need custom API URL.
2. Install dependencies:
   - `cd client`
   - `npm install`
3. Start app:
   - `npm run dev`

By default in local development:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:5000`
- Vite proxy forwards `/api` to backend.

## Environment Variables

### Backend (`server/.env`)

- `PORT`: API server port (default `5000`)
- `JWT_SECRET`: JWT signing secret (required in production)
- `CLIENT_ORIGIN`: comma-separated allowed frontend origins for CORS

### Frontend (`client/.env`)

- `VITE_API_BASE_URL`: optional absolute backend origin (for production/reverse-proxy setups).  
  Example: `https://api.college-domain.in`

## Production Notes

- Set `NODE_ENV=production` on server.
- Always set a strong `JWT_SECRET` in production.
- Set `CLIENT_ORIGIN` to trusted frontend domain(s).
- Build frontend with `npm run build` in `client/`.
- Serve `client/dist` from your preferred web server and run backend with `npm start`.

## Admin Credentials (Seed Data)

- Username: `admin`
- Password: `admin123`
