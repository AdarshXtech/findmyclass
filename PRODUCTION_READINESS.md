# Production Readiness Report

Audit date: 2026-08-12

## Scope

This report describes the current repository after its production-foundation refactor. It does not certify an external hosting environment. College launch still requires a staging deployment, load test, backup restore exercise, privacy review, and operator sign-off.

## Feature Connection Table

| Feature | Frontend | API / service | Primary data | Status |
| --- | --- | --- | --- | --- |
| Student name + phone lookup | `LandingPage`, `ResultPage` | `POST /api/student/lookup` | `students`, `timetable_entries`, `faculty`, `section_coordinators` | Verified |
| Admin session | `AdminLoginPage`, `ProtectedRoute` | login/session/logout + cookie/CSRF middleware | `admins` | Verified |
| Student administration | `AdminStudentsPage` | paginated student CRUD/import | `students` | Verified; SUPER_ADMIN only |
| Timetable management | `AdminTimetablePage` | preview/validate/save/edit/delete/shift | `timetable_entries` | Verified |
| Faculty directory | `AdminFacultyPage`, `FacultyView` | timetable derivation + optional contacts | `faculty`, `section_coordinators` | Verified |
| Classroom and subject administration | Admin pages | CRUD endpoints | `classrooms`, `subjects` | Verified |
| Campus map and local routing | `CampusMapView`, `CampusPathEditor` | client-side graph | campus location/path source files | Verified by unit/build tests |

## Implemented Production Controls

- Additive, idempotent migrations tracked in `schema_migrations`.
- PostgreSQL production configuration validation before startup.
- Repository boundaries for student lookup, timetable retrieval, classroom retrieval, and faculty persistence.
- Timetable-derived faculty identities with optional contact metadata and direct section coordinators.
- HttpOnly admin session cookie, CSRF protection, role checks, bcrypt passwords, and failed-login throttling.
- Per-student-identity failed lookup limiting so a shared campus IP does not lock out unrelated students.
- Exact-origin credentialed CORS, request IDs, security headers, body limits, upload limits, and file-signature checks.
- Student response `no-store`, response compression, paginated admin student listing, transactions, and chunked imports.
- Liveness and database readiness endpoints.
- Graceful shutdown for process supervisors and container orchestrators.
- SQLite and PostgreSQL-adapter integration tests, frontend behavior tests, production build, and CI workflow.
- Runtime dependency audits currently report zero known vulnerabilities.

## Verified Results

| Check | Result |
| --- | --- |
| Server tests, SQLite | 44 passed |
| Server tests, PostgreSQL adapter | 44 passed |
| Frontend tests | 81 passed |
| Frontend production build | Passed with Vite 6.4.3 |
| Server runtime audit | 0 vulnerabilities |
| Client runtime audit | 0 vulnerabilities |
| Compression integration check | About 92.5% smaller for the tested JSON payload |

## Remaining Launch Gates

- Replace transitional runtime base-schema creation with a migration-only bootstrap after the first controlled college cutover.
- Decide whether the college will synchronize through read-only views, scheduled ETL, or its own upstream integration service.
- Put failed-attempt counters and revocable admin sessions in shared storage before running multiple API instances.
- Configure centralized logs, metrics, alerting, retention, and personally identifiable information redaction.
- Run realistic staging load tests at the college's expected peak login burst and database latency.
- Define backup retention, point-in-time recovery, recovery objectives, and complete a documented restore drill.
- Review all published faculty/coordinator phone numbers and student privacy notices with college owners.
- Create individual admin accounts; never share one production credential.
- Establish a subject/classroom historical-data rule before adding foreign-key cascades or rename propagation.
- Verify accessibility and browser behavior with the college-supported browser/device matrix.

## Explicit Boundary

Name plus phone number is the college-required timetable access method. It is suitable only for low-sensitivity schedule and explicitly published contact data. It must not authorize access to attendance, grades, fees, documents, addresses, or other private records.

## Release Commands

```sh
npm ci --prefix server
npm test --prefix server
npm run test:postgres --prefix server
npm audit --omit=dev --prefix server

npm ci --prefix client
npm test --prefix client
npm run build --prefix client
npm audit --omit=dev --prefix client
```

For deployment, migration, database mapping, backup, rollback, and troubleshooting procedures, use `docs/college-deployment-guide.md` and the generated `college-deployment-and-database-integration-guide.pdf`.
