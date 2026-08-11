# Application Execution Flow

This document describes execution paths verified from the current codebase. Update it whenever an application path changes.

## 1. Entry Points

### Browser application

```text
client/index.html
-> client/src/main.jsx
-> React.StrictMode
-> BrowserRouter
-> client/src/App.jsx
-> React Router route
-> page component
```

Student routes are loaded directly:

- `/` -> `LandingPage`
- `/result` -> `ResultPage`

Admin pages are lazy-loaded inside `Suspense`:

- `/admin/login` -> `AdminLoginPage`
- `/admin/*` -> `ProtectedRoute` -> `AdminLayout` -> selected admin page

### Backend development entry

```text
npm run dev
-> node --watch server/server.js
-> loadEnvironment()
-> Express app and middleware
-> startServer()
-> initDatabase()
-> app.listen()
```

### Backend production entry

```text
npm run start:production
-> server/config/validate-production.js
-> reject unsafe or incomplete production configuration
-> server/config/start-production.js
-> loadEnvironment()
-> LOAD_BUNDLED_DATA=true?
   -> yes: loadScheduleData() for an explicit transition import
   -> no: initDatabase()
-> create base schema and run versioned migrations
-> startServer()
-> app.listen()
```

Normal production startup never reloads repository student or timetable data. `LOAD_BUNDLED_DATA=true` is an explicit transition option, and `timetable_seed_state` prevents that loader from restoring a timetable deliberately changed or deleted by an admin unless replacement is requested.

## 2. Application Startup Flow

### Frontend

1. Vite loads `client/src/main.jsx`.
2. Geist, Geist Mono, Space Grotesk, and global CSS are loaded.
3. React mounts `App` in `#root` inside `BrowserRouter`.
4. `App` resolves the route.
5. Student pages load immediately; admin pages load through `React.lazy` and `Suspense`.

### Backend

1. `server/config/env.js` loads `server/.env` through `process.loadEnvFile`.
2. `server/server.js` creates the Express application.
3. Optional proxy trust, exact-origin credentialed CORS, compression, request IDs, security headers, and bounded body parsers are configured.
4. `/api/student` is marked `no-store`; student and admin routers are registered.
5. `/api/health`, database-backed `/api/ready`, and API 404 handlers are registered.
6. A built client is served from `client/dist` when that directory exists.
7. `startServer()` initializes the database and applies pending migrations before listening.

### Database selection

```text
initDatabase()
-> DATABASE_URL present?
   -> yes: PostgreSQL Pool (or pg-mem for tests)
   -> no: sql.js database loaded from DATABASE_PATH or server/database.sqlite
-> create the compatibility base schema
-> run each missing migration recorded in schema_migrations
-> expose queryAll(), queryOne(), execute(), insertMany(), and withTransaction()
```

PostgreSQL operations pass through `CircuitBreaker` for dependency timeouts, failure thresholds, and concurrency limits. SQLite writes export the in-memory database back to its file.

## 3. Function Call Flow

### Student lookup and timetable display

```text
LandingPage.handleSubmit()
-> normalizeStudentName() and normalizePhoneNumber()
-> lookupStudentSchedule()
-> POST /api/student/lookup
-> server/routes/student.js
-> normalize identity again at the trust boundary
-> hash normalized name + phone for a per-identity failed-attempt key
-> hashPhoneNumber()
-> studentRepository.findVerifiedStudent()
-> query classrooms, timetable entries, and timetable-derived faculty in parallel
-> facultyForStudent() joins faculty directory contacts and section coordinator
-> parseClassroomLocation() for every timetable entry
-> response returns student, classrooms, derived facultyContacts, coordinator, and timetable
-> navigate('/result', { state: { lookupData } })
-> ResultPage
-> useCurrentTime()
-> useTimetableStatus()
-> NextClassHero + DailySchedule, WeeklySchedule, CampusMapView, or FacultyView
```

`lookupStudentSchedule()` retries once after 1.5 seconds only for network failures or transient HTTP statuses. The result payload is held in React Router location state; opening or refreshing `/result` without that state returns the user to student verification.

`getTimetableStatus()` groups and sorts entries, removes breaks from teaching-class calculations, chooses the current or next class, and assigns `current`, `next`, `completed`, `upcoming`, `break`, or `cancelled` status to each entry. Daily and weekly views share these calculated statuses.

### Admin authentication

```text
AdminLoginPage.handleSubmit()
-> adminApi.post('/login')
-> POST /api/admin/login
-> adminLoginLimiter.check()
-> query admin by username
-> bcrypt.compare()
-> adminLoginLimiter.clear() on success
-> jwt.sign(admin id, role, and CSRF claim; expires in 24h)
-> set an HttpOnly, Secure production session cookie
-> return the admin summary and CSRF token
-> setAdminSession() stores only non-secret UI state in sessionStorage
-> navigate to requested protected route or /admin
```

For protected admin API calls:

```text
adminApi request interceptor
-> sends cookies with credentials
-> adds X-CSRF-Token for state-changing requests
-> authenticateToken middleware
-> reads and verifies the signed session cookie
-> validates the CSRF header for cookie-authenticated writes
-> authorizeRoles() enforces SUPER_ADMIN-only student operations
-> protected route handler
```

`ProtectedRoute` restores the server session through `GET /api/admin/session` before rendering. The server remains the security boundary and verifies the signed cookie, CSRF token, and role on protected requests. Bearer tokens remain accepted temporarily for staged compatibility and tests, but production login does not return one.

### Faculty contact management

```text
AdminFacultyPage
-> GET /api/admin/faculty?section=<class>
-> POST or PUT /api/admin/faculty
-> authenticateToken
-> syncTimetableFaculty(section) derives unique identities from timetable teacher names
-> facultyForStudent(section) combines derived identities with optional directory contacts
-> normalizeFacultyName() matches only conservative formatting variants
-> saveFaculty() updates optional phone, designation, and department
-> section_coordinators stores the one explicit coordinator assignment per section
-> admin_audit_log records faculty and coordinator changes
-> DELETE clears optional contact metadata without deleting timetable-derived identity
```

Faculty names are derived from the selected section's timetable. Contact details are optional, separately managed, and shown only after a verified student lookup for that section. The coordinator is a direct section assignment rather than a special faculty-contact role.

### Student spreadsheet import

```text
AdminImportPage.handleSubmit()
-> FormData(file)
-> POST /api/admin/import/students
-> authenticateToken
-> SUPER_ADMIN authorization
-> Multer memory upload bounded by UPLOAD_LIMIT_BYTES
-> extension, MIME, and file-signature checks for CSV/XLS/XLSX
-> readStudentRows() using @e965/xlsx
-> normalize and validate each row
-> hash optional phone numbers
-> reject duplicates within the file and existing database
-> withTransaction()
-> chunked insertMany()
-> return imported/skipped counts and row errors
-> AdminImportPage renders results
```

The first worksheet is used. Required headers are `Name`, `University Roll Number`, `Course`, `Branch`, `Year`, and `Section`. Phone Number and Class Roll Number are optional.

### Admin timetable import and save

```text
AdminTimetablePage.importTimetable()
-> POST /api/admin/timetables/import with image or text
-> authenticateToken
-> image: extractTimetableImage() via Tesseract
   or text: parseTimetableText()
-> validateRows()
-> detect unique faculty names and match the faculty directory
-> return editable preview and faculty verification list; nothing saved
-> AdminTimetablePage.revalidatePreview()
-> POST /api/admin/timetables/validate
-> user confirms save mode
-> POST /api/admin/timetables
-> validateTimetableRequest()
-> withTransaction()
-> optional replace delete + chunked insertMany()
-> timetable_entries updated
-> syncTimetableFaculty(section) updates derived faculty links
```

Manual add, edit, delete, full-class delete, and timetable shifting use separate protected endpoints. Shifts are previewed and validated before `confirm: true` writes updated times.

### Campus map and local routing

```text
ResultPage selects ?view=map
-> lazy CampusMapView
-> searchCampusLocations(query, CAMPUS_LOCATIONS)
-> user selects destination
-> useGeolocation() or manual start selection
-> findCampusRoute(start, destination, CAMPUS_PATH_NODES, CAMPUS_PATH_EDGES)
-> nearest path nodes + local shortest-path search
-> network route or straight-line fallback
-> CampusMap renders tiles, markers, and route polyline
-> routeSteps() + getIndoorGuidance() render text directions
```

Map rendering uses React Leaflet with Esri satellite and OpenStreetMap street tiles. Routing does not call a directions API. `CAMPUS_PATH_NODES` and `CAMPUS_PATH_EDGES` contain the surveyed campus walkway graph. The path editor displays destination pins separately, reuses nodes within three metres, and connects nearby trace junctions during export. Destinations farther than 60 metres from the graph retain the straight-line fallback until their entrances are surveyed.

## 4. Major Modules

| Module | Responsibility | Inputs | Outputs | Called by / Calls |
| --- | --- | --- | --- | --- |
| `client/src/App.jsx` | Route composition and admin code splitting | Browser URL | Selected page | Called by `main.jsx`; calls page/layout components |
| `client/src/pages/LandingPage.jsx` | Student verification form | Name and phone | Router state for `/result` or error | Calls `lookupStudentSchedule()` |
| `client/src/pages/ResultPage.jsx` | Coordinates student context, schedule views, menu, and map | Lookup payload in router state | Daily, weekly, or map UI | Calls timetable hooks and shared components |
| `client/src/hooks/useTimetableStatus.js` | Time-dependent timetable priority and status | Timetable and current `Date` | Current/next entries, grouped days, status map | Called by `ResultPage`; calls timetable utilities |
| `client/src/admin/api.js` | Credentialed admin HTTP client | Request config and CSRF token | Axios responses | Called by admin pages; calls `/api/admin` |
| `client/src/pages/AdminTimetablePage.jsx` | Timetable CRUD, validation, import preview, and shifts | Admin form/image/text input | Preview state and saved timetable | Calls protected timetable endpoints |
| `client/src/components/map/CampusMapView.jsx` | Destination/start workflow and route state | Search, GPS/manual start | Route summary and map props | Calls location search, geolocation, and route graph |
| `server/server.js` | Express composition and process startup | Environment and port | HTTP server | Calls database initialization and route modules |
| `server/routes/student.js` | Student identity verification and schedule response | Name and phone request | Normalized student/timetable/faculty payload | Calls repositories, faculty service, identity helper, classroom parser |
| `server/routes/admin.js` | Admin auth and management APIs | Cookie/CSRF-protected requests and uploads | CRUD/import/validation responses | Calls repositories, services, validators, OCR, spreadsheet parser |
| `server/config/db.js` | SQLite/PostgreSQL adapter, migrations, transactions, circuit breaker | SQL and parameters | Rows or write metadata | Called by startup, repositories, and routes |
| `server/repositories/` | Stable application data-access boundaries | Normalized identifiers and filters | Domain rows | Called by student routes and faculty services |
| `server/services/faculty-service.js` | Timetable-derived faculty and coordinator composition | Section or faculty form | Student-facing faculty and saved directory data | Calls faculty repository |
| `server/config/load-schedule-data.js` | Transitional roster/timetable/access synchronization | JSON datasets and environment access records | Seeded database state | Called by CLI or explicit production flag |
| `server/utils/classroom-location.js` | One source of truth for room/floor/wing parsing | Room value and entry context | Normalized location or validation error | Called by student and admin routes |
| `server/utils/timetable-manager.js` | Timetable normalization, validation, parsing, and shifting | Imported or edited rows | Validated/formatted rows | Called by admin timetable endpoints |

## 5. Data Flow

### Student identity data

```text
Full phone entered by student/admin
-> normalized to a 10-digit number
-> HMAC-SHA256 using PHONE_LOOKUP_SECRET
-> phone_lookup_hash stored/queried
-> only phone_last_four returned to admin/student UI
```

### Timetable data

```text
JSON seed, admin form, pasted text, or timetable image
-> server normalization and validation
-> timetable_entries table
-> student lookup by section
-> classroom location normalization
-> API response
-> React Router state
-> status calculation from current day/time
-> shared timetable cards
```

### Admin mutations

```text
Admin form state
-> frontend validation
-> credentialed request with CSRF header
-> cookie, CSRF, role, and payload validation
-> transaction or single database operation
-> API response
-> frontend refresh/reconciliation
```

## 6. AI Changes During Current Session

## AI Session: 2026-08-11 11:43 +05:30

### Files Created

- `AGENTS.md`
- `decisions.md`
- `flow.md`

### Files Modified

- None.

### Files Deleted

- None.

### Functions Added

- None.

### Functions Modified

- None.

### Functions Removed

- None.

### Execution Flow Changed

No runtime execution path changed. This session documented the current verified frontend, backend, database, authentication, import, timetable, and map flows.

### Behaviour Changed

No user-visible or backend behavior changed. Repository governance now requires meaningful decisions and substantial AI sessions to be documented.

### Decisions Added

- `Maintain repository decision and execution-flow records` in `decisions.md`.
- `Use one parser for CSV, XLS, and XLSX student imports` in `decisions.md`.

### Potential Risks

- The documents will become inaccurate if future architecture or behavior changes are not recorded.
- The map section must be updated when surveyed path nodes and edges are added.

### Recommended Tests

- Review links, paths, and named functions whenever related source files move.
- During substantial changes, run the relevant frontend/server tests and compare the implemented flow with this document.

## AI Session: 2026-08-11 11:52 +05:30

### Files Created

- None.

### Files Modified

- `client/src/pages/LandingPage.jsx`
- `flow.md`

### Files Deleted

- None.

### Functions Added

- None.

### Functions Modified

- `LandingPage` presentation markup only.

### Functions Removed

- None.

### Execution Flow Changed

No execution path changed.

### Behaviour Changed

The student login page now shows only academic session 2026-27 and no longer displays a semester label.

### Decisions Added

- None; this was a small copy-only UI change.

### Potential Risks

- None beyond verifying the revised labels at mobile and desktop widths.

### Recommended Tests

- Render the student login page and confirm no semester wording remains.
- Run the LandingPage component tests.

## AI Session: 2026-08-11 12:12 +05:30

### Files Created

- `client/src/components/faculty/FacultyView.jsx`
- `client/src/pages/AdminFacultyPage.jsx`

### Files Modified

- `client/src/App.jsx`
- `client/src/admin/components/AdminLayout.jsx`
- `client/src/components/timetable/ScheduleNavigation.jsx`
- `client/src/pages/ResultPage.jsx`
- `client/src/pages/ResultPage.test.jsx`
- `client/src/test/fixtures.js`
- `server/config/db.js`
- `server/routes/admin.js`
- `server/routes/student.js`
- `server/test/api.test.js`
- `decisions.md`
- `flow.md`

### Files Deleted

- None.

### Functions Added

- `normalizeFacultyContact()` and `formatFacultyContact()` in the admin API.
- `FacultyView`, `FacultyContact`, and `ContactCall` in the student UI.
- `AdminFacultyPage` and its contact management handlers.

### Functions Modified

- Database schema creation now creates and indexes `faculty_contacts`.
- Student lookup now returns contacts belonging to the verified section.
- `ResultPage` and `ScheduleNavigation` now coordinate the Faculty view.

### Execution Flow Changed

Successful student lookup performs one additional indexed faculty-contact query. Admins manage those records through protected `/api/admin/faculty` routes, and students open them through `/result?view=faculty` without selecting a class again.

### Behaviour Changed

Students can see a highlighted coordinator first, call explicitly published numbers, and see honest empty states. Admins can create, edit, delete, and replace class coordinators with normalized phone validation.

### Decisions Added

- `Publish class-scoped faculty contacts through verified lookup` in `decisions.md`.

### Potential Risks

- Existing deployments contain no faculty contacts until an admin enters them.
- A frontend deployed before the backend migration renders empty states because `facultyContacts` is absent.

### Recommended Tests

- Add contacts for each real section, then verify students see only their own class.
- Test call links on a physical phone and long names at 360px and 1440px.
- Verify coordinator replacement requires confirmation and leaves the prior coordinator listed as faculty.
- Run server tests, all client tests, and the client production build.

## AI Session: 2026-08-11 12:30 +05:30

### Files Created

- None.

### Files Modified

- `client/src/components/timetable/StudentContext.jsx`
- `client/src/pages/ResultPage.jsx`
- `client/src/pages/ResultPage.test.jsx`
- `flow.md`

### Files Deleted

- None.

### Functions Added

- None.

### Functions Modified

- `StudentContext` now renders an explicitly published coordinator name and call link.
- `ResultPage` selects the coordinator from the verified section's `facultyContacts` payload.

### Execution Flow Changed

`ResultPage` passes the section coordinator from verified lookup data into the shared student context shown beside every student view.

### Behaviour Changed

When a coordinator has been published for the student's class, their name and phone number appear below Course, Year, and Class. The number wraps safely and is tappable on mobile. Nothing is shown when no coordinator exists.

### Decisions Added

- None; this reuses the class-scoped faculty data decision from the preceding session.

### Potential Risks

- Long coordinator names and formatted numbers should be checked on narrow phones.

### Recommended Tests

- Verify the coordinator block at 360px and desktop widths.
- Verify the phone link opens the device call prompt without placing a call automatically.

## AI Session: 2026-08-11 13:02 +05:30

### Files Created

- None.

### Files Modified

- `client/src/components/map/CampusMapView.jsx`
- `client/src/components/map/CampusMapView.test.jsx`
- `flow.md`

### Files Deleted

- None.

### Functions Added

- `removePath()` in `CampusMapView`.

### Functions Modified

- `CampusMapView` now displays a map-overlay Remove Path button while a route is visible.

### Execution Flow Changed

Selecting Remove Path stops geolocation, clears the starting point and route state, preserves the destination, and recenters the map on that destination.

### Behaviour Changed

Students can remove either a preview or active path directly from the map and then choose a new starting point without searching for the destination again.

### Decisions Added

- None; this extends the existing local campus-routing interaction.

### Potential Risks

- The student must choose a starting point again after removing a path.

### Recommended Tests

- Verify Remove Path appears for preview and active routes at mobile and desktop widths.
- Verify the destination remains selected after path removal.

## AI Session: 2026-08-11 14:18 +05:30

### Files Created

- `client/src/components/map/CampusPathEditor.test.jsx`

### Files Modified

- `client/src/components/map/CampusPathEditor.jsx`
- `decisions.md`
- `flow.md`

### Files Deleted

- None.

### Functions Added

- `readDraft()` restores a valid locally saved path draft.

### Functions Modified

- `CampusPathEditor` autosaves edits and displays Save path file prominently beside its counters.

### Execution Flow Changed

Editor startup reads `findmyclass-campus-path-draft` from browser storage. Node or edge changes write the current graph back to that draft. Save path file downloads the graph as `campusPaths.js` for source replacement.

### Behaviour Changed

Path edits survive page refreshes in the same browser, and the source-file save action is visible before the editing controls.

### Decisions Added

- `Preserve campus path drafts locally and export source data explicitly` in `decisions.md`.

### Potential Risks

- Browser drafts do not synchronize across devices or browsers.
- Reset also replaces the saved draft with the currently deployed graph.

### Recommended Tests

- Add nodes, refresh, and verify the draft reappears.
- Download the path file and verify it exports both node and edge arrays.

## AI Session: 2026-08-11 23:52 +05:30

### Files Created

- None.

### Files Modified

- `client/src/components/map/CampusPathEditor.jsx`
- `flow.md`

### Files Deleted

- None.

### Functions Added

- None.

### Functions Modified

- `CampusPathEditor` presentation markup for the path export button.

### Functions Removed

- None.

### Execution Flow Changed

No execution path changed. The path export still downloads `campusPaths.js` from the current editor nodes and edges.

### Behaviour Changed

The Save path file button now uses the same visible admin theme tokens as the surrounding controls, so it does not blend into the toolbar.

### Decisions Added

- None; this was a small visual fix to an existing control.

### Potential Risks

- None beyond confirming the button remains visible after Vercel cache refresh.

### Recommended Tests

- Open `/admin/paths` and verify Save path file is visible between the segment counter and Stop chain.
- Click Save path file after tracing a path and verify `campusPaths.js` downloads.

## AI Session: 2026-08-12 00:22 +05:30

### Files Created

- None.

### Files Modified

- `client/src/components/map/CampusPathEditor.jsx`
- `client/src/components/map/CampusPathEditor.test.jsx`
- `client/src/services/campusPathGraph.js`
- `client/src/services/campusPathGraph.test.js`
- `client/src/services/campusPaths.js`
- `decisions.md`
- `flow.md`

### Files Deleted

- None.

### Functions Added

- `connectNearbyPathNodes()` in `campusPathGraph.js`.

### Functions Modified

- `CampusPathEditor` now displays destination references and reuses nearby path nodes.
- `serializeCampusPaths()` now adds missing edges between nodes within three metres.

### Execution Flow Changed

The student map now loads the imported 104-node campus graph. Path export repairs near-duplicate tracing junctions before generating `campusPaths.js`; routing continues to use the existing 60-metre endpoint snap threshold and straight-line fallback.

### Behaviour Changed

The editor shows yellow destination pins from `campusLocations.js`, near-identical clicks no longer create disconnected nodes, and the imported graph is one connected component. Management Building and the stadium still use the fallback until paths are extended to their entrances.

### Decisions Added

- `Keep destination pins separate from the pedestrian path graph` in `decisions.md`.

### Potential Risks

- Two physically separate paths within three metres could be connected during export; the threshold is intentionally small.
- A browser draft created before deployment remains preferred over the imported source graph until the admin presses Reset.

### Recommended Tests

- Press Reset once in `/admin/paths` to load the deployed graph instead of an older browser draft.
- Confirm yellow pins match destination markers and extend paths to Management Building and the stadium entrance.
- Test a route between distant covered destinations and confirm it follows the wine-red path rather than the straight fallback.

## AI Session: 2026-08-12 00:42 +05:30

### Files Created

- None.

### Files Modified

- `client/src/services/campusLocations.js`
- `client/src/services/campusLocations.test.js`
- `flow.md`

### Files Deleted

- None.

### Functions Added

- None.

### Functions Modified

- None; the shared campus location dataset and its coverage tests changed.

### Execution Flow Changed

Map search, destination markers, manual starting points, and Path Editor reference pins continue to consume `CAMPUS_LOCATIONS`, which no longer contains the Central Instrument Lab or classroom-related university-building aliases.

### Behaviour Changed

Labs, classroom terms, UGF, and LGF are no longer exposed as map destinations. Campus buildings and facilities remain available.

### Decisions Added

- None; this is a narrowly scoped destination-list cleanup.

### Potential Risks

- Searching for UGF, LGF, or Central Instrument Lab now intentionally returns no destination.

### Recommended Tests

- Search the Map view for `lab`, `classroom`, `UGF`, and a room number and confirm no destination appears.
- Confirm buildings, hostels, canteens, the library, and other campus facilities remain searchable.

## AI Session: 2026-08-12 00:50 +05:30

### Files Created

- None.

### Files Modified

- `client/src/services/campusLocations.js`
- `client/src/services/campusLocations.test.js`
- `flow.md`

### Files Deleted

- None.

### Functions Added

- None.

### Functions Modified

- None; two shared campus destination records were added.

### Execution Flow Changed

The existing map search, markers, manual starting-point selector, and Path Editor reference layer now consume University Main Gate and Campus Main Gate through `CAMPUS_LOCATIONS`.

### Behaviour Changed

Students can search for and navigate to both named gates using the supplied coordinates.

### Decisions Added

- None; this is a campus data addition using the existing location model.

### Potential Risks

- University Main Gate remains outside the current 60-metre path snap threshold until its walkway is surveyed.

### Recommended Tests

- Search for each gate and confirm its marker lands at the supplied coordinate.
- Trace a walkway to University Main Gate before expecting network routing instead of direct guidance.

## AI Session: 2026-08-12 01:05 +05:30

### Files Created

- None.

### Files Modified

- `client/src/services/campusLocations.js`
- `client/src/services/campusLocations.test.js`
- `flow.md`

### Files Deleted

- None.

### Functions Added

- None.

### Functions Modified

- None; the shared university-building destination data changed.

### Execution Flow Changed

Map search, map markers, routing destinations, and Path Editor references continue to consume the shared university-building record and coordinate.

### Behaviour Changed

The BBD University Building pin now uses the corrected coordinate. Searches for `Babu Banarasi Das University` resolve to that destination.

### Decisions Added

- None; this is a corrected coordinate and search-alias update within the existing data model.

### Potential Risks

- Central Library shares the university-building coordinate and therefore moves with the corrected building pin.

### Recommended Tests

- Search for the full university name and confirm BBD University Building is returned.
- Confirm the university and Central Library markers use the corrected coordinate.

## AI Session: 2026-08-12 01:45 +05:30

### Files Created

- None.

### Files Modified

- `client/src/services/campusLocations.js`
- `client/src/services/campusLocations.test.js`
- `flow.md`

### Files Deleted

- None.

### Functions Added

- None.

### Functions Modified

- None; the shared BBDU building coordinate changed.

### Execution Flow Changed

The map marker, destination search, routing endpoint, Central Library location, and Path Editor reference pin continue to read `UNIVERSITY_BUILDING_COORDINATES`.

### Behaviour Changed

The BBDU building and Central Library pin now use the latest user-supplied coordinate.

### Decisions Added

- None; this is a coordinate correction within the existing map data model.

### Potential Risks

- Central Library intentionally follows the shared BBDU building coordinate.

### Recommended Tests

- Search for Babu Banarasi Das University and confirm the marker uses the corrected coordinate.
- Confirm routes to both main gates use the surveyed graph where a nearby connected path exists.

## AI Session: 2026-08-12 02:05 +05:30

### Files Created

- None.

### Files Modified

- `client/src/services/campusPathGraph.js`
- `client/src/services/campusPathGraph.test.js`
- `client/src/services/campusPaths.js`
- `decisions.md`
- `flow.md`

### Files Deleted

- None.

### Functions Added

- `nodeComponents()` in `campusPathGraph.js`.
- `nearestNodesByComponent()` in `campusPathGraph.js`.

### Functions Modified

- `nearbyNodes()` replaces the single-nearest-node lookup.
- `findCampusRoute()` now selects the shortest reachable entrance component.

### Execution Flow Changed

Route calculation groups nearby path nodes by connected component, chooses the nearest start and destination node on each shared component, and uses the shortest reachable result. The student map now consumes the 108-node, 116-edge graph exported as `campusPaths (1).js`.

### Behaviour Changed

Routes from University Main Gate reach BBDU through entrance `n0108`, while routes from Campus Main Gate reach BBDU through entrance `n0067`. The entrances remain physically separate and are not joined through the building.

### Decisions Added

- `Select a reachable entrance per path component` in `decisions.md`.

### Potential Risks

- Travel between endpoints that share no surveyed component still uses straight-line fallback.
- The imported graph contains two intentional components until an exterior connecting walkway is surveyed.

### Recommended Tests

- Route from University Main Gate to BBDU and confirm it ends at `n0108`.
- Route from Campus Main Gate to BBDU and confirm it ends at `n0067`.
- Confirm ordinary routes on the original main component remain network routes.

## AI Session: 2026-08-12 02:15 +05:30

### Files Created

- None.

### Files Modified

- `client/src/services/campusLocations.js`
- `client/src/services/campusLocations.test.js`
- `client/src/services/campusPathGraph.js`
- `client/src/services/campusPathGraph.test.js`
- `client/src/services/campusPaths.js`
- `decisions.md`
- `flow.md`

### Files Deleted

- None.

### Functions Added

- None.

### Functions Modified

- `nearestNodesByComponent()` can restrict candidates to declared entrance node IDs.
- `findCampusRoute()` passes endpoint entrance metadata into component selection.

### Execution Flow Changed

The BBDU destination declares entrances `n0108` and `n0067`. Routing considers only those nodes when BBDU is an endpoint, while other campus locations continue using nearby nodes. The student map now consumes the 110-node, 119-edge graph exported as `campusPaths (3).js`.

### Behaviour Changed

University Main Gate routes to BBDU through `n0108`, Campus Main Gate routes to BBDU through `n0067`, and the newly surveyed exterior path enables network routing between both gates. Nearby node `n0109` is no longer mistaken for a BBDU entrance.

### Decisions Added

- Extended `Select a reachable entrance per path component` in `decisions.md` with explicit entrance-node metadata.

### Potential Risks

- Entrance node IDs must remain valid when future path exports rename or delete nodes.

### Recommended Tests

- Route from each gate to BBDU and verify the expected entrance node is used.
- Route between both gates and confirm the path follows the exterior network.
- Search for BBDU and confirm the destination remains selectable.

## AI Session: 2026-08-12 03:55 +05:30

### Files Created

- `.github/workflows/ci.yml`
- `server/config/migrate.js`
- `server/config/validate-production.js`
- `server/migrations/001-production-foundation.js`
- `server/repositories/student-repository.js`
- `server/repositories/timetable-repository.js`
- `server/repositories/classroom-repository.js`
- `server/repositories/faculty-repository.js`
- `server/services/faculty-service.js`
- `server/utils/faculty-identity.js`
- `server/utils/logger.js`
- `server/test/faculty-identity.test.js`
- `server/test/production-config.test.js`
- `client/src/components/faculty/FacultyView.test.jsx`
- `client/src/pages/AdminFacultyPage.test.jsx`
- `docs/college-deployment-guide.md`
- `tmp/pdfs/build_college_guide.py`
- `college-deployment-and-database-integration-guide.pdf`

### Files Modified

- `README.md`, `PRODUCTION_READINESS.md`, `decisions.md`, `flow.md`, `render.yaml`, `vercel.json`, and `client/vercel.json`
- `server/.env.example`, `server/package.json`, `server/config/db.js`, `server/config/create-admin.js`, and `server/config/start-production.js`
- `server/server.js`, `server/middleware/auth.js`, `server/middleware/rate-limit.js`, `server/routes/student.js`, and `server/routes/admin.js`
- `server/utils/student-identity.js` and `server/test/api.test.js`
- `client/package.json`, `client/package-lock.json`, admin session/API/layout components, faculty/student context components, relevant admin pages, and test setup/expectations

### Functions and Boundaries Added or Modified

- Versioned migration execution through `runMigrations()` and migration `001-production-foundation`.
- Faculty normalization, repository synchronization, `facultyForStudent()`, and `saveFaculty()`.
- Student, timetable, classroom, and faculty repository boundaries.
- Per-identity `hashStudentLookupIdentity()` and keyed failed-attempt limiting.
- Cookie/CSRF authentication, `authorizeRoles()`, session restore, and logout.
- Production configuration validation, readiness checks, request IDs, security headers, structured logging, and graceful shutdown.
- Student pagination, upload content checks, detected-faculty import preview, and timetable faculty synchronization.

### Execution Flow Changed

Normal production startup validates environment safety, initializes PostgreSQL, and applies pending migrations without loading bundled class data. Student lookup now uses repositories and parallel section queries, derives faculty from timetable entries, and joins optional contacts/coordinator data. Admin sessions use an HttpOnly cookie plus CSRF token and role checks. Timetable imports expose detected faculty before save, and timetable mutations resynchronize faculty links. CI runs both server adapters, frontend tests/build, and runtime dependency audits.

### Behaviour Changed

- Faculty names appear once from timetable data even when no phone is configured; contacts remain optional.
- Coordinators are assigned directly to sections and displayed separately without duplication.
- One failed student identity cannot lock out other students on a shared network.
- Production login no longer returns a browser-stored bearer token.
- Student lists are paginated, unsafe uploads are rejected earlier, and bundled data is opt-in.
- Liveness and database readiness are separate, and production errors are logged with request IDs without public stack traces.

### Decisions Added

- Derive faculty identities from timetable data.
- Use additive migrations and repository boundaries for college integration.
- Move production admin authentication to cookies with CSRF and roles.
- Fail production startup on unsafe configuration and bundled data loading.
- Limit failed student lookups by hashed identity.

### Potential Risks and Remaining Work

- Failed-attempt counters and admin sessions need shared storage/revocation before horizontal API scaling.
- The legacy admin route still contains SQL and should be extracted behind repositories incrementally.
- A college staging load test, privacy review, backup restore drill, and browser/device matrix remain external launch gates.
- Existing hosts must configure the new production variables before restarting.

### Tests Run

- Server Node tests on SQLite: 44 passed.
- Server Node tests on PostgreSQL adapter: 44 passed.
- Frontend Vitest suite: 81 passed across 16 files.
- Vite production build: passed.
- Fresh migration validation and production configuration validation: passed.
- Client and server runtime dependency audits: zero reported vulnerabilities.
- PDF rendered to 15 A4 pages and visually reviewed at representative cover, contents, diagram, table, command, and troubleshooting pages.

### Recommended Manual Tests

- In staging, verify Student A can fail lookup repeatedly without blocking Student B on the same public IP.
- Log in as each admin role and confirm student operations are visible only to `SUPER_ADMIN`.
- Import a timetable with an existing and a new faculty name, save it, add only one phone number, and verify the student Faculty page.
- Replace a coordinator and confirm the old coordinator remains as faculty without duplicate display.
- Test cookie login/logout and CSRF from the exact production frontend origin over HTTPS.
- Restore a production-like backup into staging and verify lookup, timetable, faculty, coordinator, and admin flows.
