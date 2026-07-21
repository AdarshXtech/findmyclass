# Production Readiness Report

Audit date: 2026-07-21

## Feature Connection Table

| UI Feature | Frontend Component | API Endpoint | Backend Handler | Data Source | Status |
| --- | --- | --- | --- | --- | --- |
| Student roll lookup | `LandingPage`, `ResultPage` | `POST /api/student/lookup` | `server/routes/student.js` | `students`, `timetable_entries`, `classrooms` fallback | Fully functional |
| Admin login | `AdminLoginPage` | `POST /api/admin/login` | `server/routes/admin.js` | `admins`, bcrypt, JWT | Fully functional |
| Admin logout | `AdminLayout` | None (stateless JWT) | None | Browser session storage | Fully functional |
| Dashboard statistics | `AdminDashboardPage` | `GET /api/admin/stats` | `server/routes/admin.js` | Aggregate SQL queries | Fully functional |
| Student management | `AdminStudentsPage` | `GET/POST/PUT/DELETE /api/admin/students` | `server/routes/admin.js` | `students` | Fully functional |
| Subject management | `AdminSubjectsPage` | `GET/POST/PUT/DELETE /api/admin/subjects` | `server/routes/admin.js` | `subjects` | Partially functional |
| Classroom assignments | `AdminClassroomsPage` | `GET/POST/PUT/DELETE /api/admin/classrooms` | `server/routes/admin.js` | `classrooms`, subject/section suggestions | Fully functional |
| Student import | `AdminImportPage` | `POST /api/admin/import/students` | `server/routes/admin.js` | XLSX/CSV parser, `students` | Fully functional |
| QR entry point | Landing-page instructions | None | None | Externally generated QR/link | Unconfirmed |

Subject CRUD is marked partially functional because classroom assignments store subject names as text. Renaming or deleting a subject does not update or reject existing classroom assignments. The repository contains no product rule establishing cascade, restriction, or historical-name behavior.

## Findings

### Confirmed

- Admin credentials are checked against bcrypt hashes in the database.
- Every admin data route verifies the JWT on the server.
- Dashboard values come from live aggregate database queries.
- Student roll lookup, weekly timetable display, CRUD, imports, loading states, errors, empty states, and duplicate-request disabling are connected to real handlers.
- The supplied CSAI 2B source data is represented by 58 roster records and 24 timetable entries, with the non-matching CSAI 2D row excluded and the section-label discrepancy documented.
- `.env` is loaded before runtime configuration and route modules are initialized.
- Production startup rejects a missing `JWT_SECRET` or `CLIENT_ORIGIN`.
- Normal startup creates an empty database schema; it does not create sample users or records.
- Demo seeding is explicitly invoked, destructive, and blocked in production.
- Unsupported, oversized, and malformed import files receive explicit client errors.
- The visible Settings placeholder was removed.

### Inferred From Code

- "QR-based" appears to mean that an external QR code opens the public locator URL. There is no scanner, QR generator, or QR persistence logic in this repository.

### Unconfirmed

- Reverse-proxy behavior, TLS termination, backups, restore procedures, process supervision, and filesystem durability depend on the deployment platform.
- Browser coverage outside the locally controlled Chromium session was not run.

### Missing

- Login and public lookup rate limiting.
- Server-side JWT revocation before the 24-hour expiry.
- A schema-level relationship between `subjects` and `classrooms`.
- CI configuration and automated frontend component tests.

### Requires Credentials

- No third-party integration credentials are used by the current codebase.
- Production requires operator-provided `JWT_SECRET`, `CLIENT_ORIGIN`, `ADMIN_USERNAME`, and `ADMIN_PASSWORD` values.

### Requires External Verification

- Free-tier deployments rebuild the confirmed CSAI 2B dataset after restarts; admin accounts and admin changes require persistent storage.
- The deployed QR code must be tested against the final public URL.
- CORS must be checked against the exact deployed frontend origin.

`DO NOT MODIFY - REQUIRES FURTHER VERIFICATION`: Roll-number lookup identifies a schedule but is not strong student authentication. Adding access to private student data would require an identity/privacy requirement. Subject rename/delete propagation also requires an explicit data-retention rule.

## Verification Table

| Feature | Verification Performed | Result | Limitations |
| --- | --- | --- | --- |
| Student lookup | API integration tests for invalid, missing, and registered university roll numbers plus timetable response; browser submission | Pass | Uses local database |
| Admin authentication | Invalid login, valid login, unauthenticated rejection, browser dashboard navigation | Pass | No distributed token revocation test |
| Student CRUD | Create, validation, update, filter, delete against temporary SQLite | Pass | No concurrent-writer load test |
| Subject/classroom CRUD | Create, filter, update, delete against temporary SQLite | Pass | Subject/classroom referential rule remains undefined |
| CSV import | Valid and duplicate rows, persisted result and skipped-row detail | Pass | Maximum-volume performance not load-tested |
| XLSX import | Generated workbook import, malformed workbook, unsupported `.xls` | Pass | Complex styled/formula workbooks not required by the import contract |
| API fallback | Unknown `/api` route | Pass | None |
| Frontend build | `npm run build` with Vite 6.4.3 | Pass | Build is not a browser compatibility matrix |
| Dependency security | `npm audit --omit=dev` in client and server | Pass: zero reported vulnerabilities | Audit databases can change |
| Responsive layout | Browser checks at 390x844 and default desktop width; overflow and clipped-text measurements | Pass | Chromium only |
| Browser console | Error log inspection during dashboard flow | Pass: no errors | React Router emitted non-failing future-flag warnings on the public page |

## Dependency Research

The original upload route used `xlsx@0.18.5`. Internet research was required because uploads parse administrator-supplied files and npm reported security advisories.

- GitHub's reviewed advisory states that `xlsx` versions before 0.19.3 are vulnerable to prototype pollution while reading crafted files, and that no patched npm version exists: [GHSA-4r6h-8v6p-xvw6](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6).
- GitHub also records a SheetJS regular-expression denial-of-service advisory for the same npm package line: [GHSA-5pgg-2g8v-p4x9](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9).
- ExcelJS 4.4.0 documentation covers XLSX and CSV reading and does not document legacy binary XLS support: [ExcelJS v4.4.0 documentation](https://github.com/exceljs/exceljs/tree/v4.4.0).

Conclusion: the importer now uses `exceljs@4.4.0`, accepts `.xlsx` and `.csv`, rejects `.xls`, and pins patched `uuid@11.1.1` for the transitive UUID advisory. Runtime tests cover both supported formats. The current implementation and documentation are aligned; no unresolved conflict with the checked version-specific documentation was found.

The runtime requirement was also checked because `.env` loading now uses a Node built-in. The official Node.js documentation records `process.loadEnvFile(path)` as added in Node 20.12.0, matching the `engines.node` minimum: [Node.js process API](https://nodejs.org/api/process.html#processloadenvfilepath).
