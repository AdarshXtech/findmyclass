# Engineering Decision Log

This file records meaningful technical and workflow decisions. Add new entries; do not rewrite earlier entries. If a decision changes, mark the old entry as superseded and reference the replacement.

## Decision: Maintain repository decision and execution-flow records

Date: 2026-08-11
Session: Repository governance initialization
Status: Active

### Problem

The repository had no durable record explaining why technical choices were made or how the current frontend and backend execute. That makes future AI-assisted changes harder to review and easier to misunderstand.

### Considered Approaches

1. Keep decisions and execution details only in chat history.
2. Put all architecture and session notes in the existing `README.md`.
3. Maintain separate root-level `decisions.md` and `flow.md` files.

### Chosen Approach

Maintain `decisions.md` for meaningful engineering choices and `flow.md` for verified execution paths and AI session records.

### Why This Approach?

The two documents have different purposes: decisions explain why, while execution flow explains how. Keeping them in the repository makes them versioned, reviewable, and available to every developer and coding agent.

### Why Not the Alternatives?

Chat history is not a reliable repository artifact and may not be available in later sessions. Adding all information to `README.md` would mix operational setup, product documentation, architecture, and session history into one file.

### Libraries / Dependencies Used

None.

### Why This Library?

No library is required. Markdown files are supported directly by GitHub and local development tools.

### Trade-offs

- Advantages: durable context, clearer reviews, and reduced architectural guesswork.
- Disadvantages: documentation must be updated during substantial coding sessions.
- Technical debt: stale entries become misleading if the workflow is not followed.
- Performance implications: none at runtime.
- Security implications: secrets and personal data must never be copied into these files.
- Maintainability implications: changes affecting architecture or behavior now require a small documentation update.

### Files Affected

- `AGENTS.md`
- `decisions.md`
- `flow.md`

## Decision: Use one parser for CSV, XLS, and XLSX student imports

Date: 2026-08-10
Session: Student spreadsheet import improvement
Status: Active

### Problem

The admin student importer supported CSV and XLSX through ExcelJS but rejected legacy XLS files. Imported phone numbers also needed to enter the same hashed lookup system used by manually created students.

### Considered Approaches

1. Keep ExcelJS and continue rejecting XLS files.
2. Keep ExcelJS and add a second dependency only for XLS files.
3. Replace ExcelJS in the student import path with one parser that reads CSV, XLS, and XLSX.

### Chosen Approach

Use `@e965/xlsx` as the single student spreadsheet parser and immediately normalize and hash optional phone numbers before database insertion.

### Why This Approach?

One parser keeps the upload path and row conversion consistent across all requested formats. It also removed the old ExcelJS dependency tree from the server and reduced the server audit result to zero known vulnerabilities at the time of the change.

### Why Not the Alternatives?

Rejecting XLS did not meet the required workflow. Running two spreadsheet parsers would increase package size, maintenance, and format-specific branching without improving the user experience.

### Libraries / Dependencies Used

- `@e965/xlsx` 0.20.x
- Existing Multer upload middleware
- Existing Node.js crypto-based student identity helper

### Why This Library?

`@e965/xlsx` reads CSV, binary XLS, and XLSX buffers through one API. Node.js has no built-in Excel workbook parser. ExcelJS did not read XLS, and adding a separate XLS-only parser would duplicate responsibilities.

### Trade-offs

- Advantages: all requested formats, one parsing path, fewer installed server packages, and batched database writes remain unchanged.
- Disadvantages: spreadsheet parsing still depends on a third-party package and only the first worksheet is imported.
- Technical debt: header aliases are not inferred; files must use the documented column names.
- Performance implications: files are parsed in memory and limited to 5 MB.
- Security implications: uploads are extension- and size-limited; phone numbers are stored only as a keyed hash and last four digits.
- Maintainability implications: parser upgrades must be tested against CSV, XLS, malformed XLSX, duplicate rows, and batch imports.

### Files Affected

- `server/routes/admin.js`
- `server/package.json`
- `server/package-lock.json`
- `server/test/api.test.js`
- `client/src/pages/AdminImportPage.jsx`
- `client/src/pages/AdminStudentsPage.jsx`

## Decision: Publish class-scoped faculty contacts through verified lookup

Date: 2026-08-11
Session: Faculty contacts
Status: Active

### Problem

Students need public faculty phone numbers for their own class, while timetable entries contain only names and must not be treated as permission to publish private contact details.

### Considered Approaches

1. Infer the faculty directory from timetable teacher names and hard-code phone numbers in React.
2. Add a public endpoint that accepts any requested section.
3. Store intentionally published contacts by section and include only the verified student's section contacts in the existing lookup response.

### Chosen Approach

Add `faculty_contacts`, manage it through authenticated admin routes, and return matching contacts inside `POST /api/student/lookup` after student verification.

### Why This Approach?

The existing lookup is already the verified boundary and determines the student's section. Reusing it keeps contacts class-specific without a second student token or an arbitrary public section query.

### Why Not the Alternatives?

Timetable names do not prove a phone number is public, and hard-coded contacts cannot be maintained safely. A public section parameter would permit contact-list enumeration and duplicate class-selection logic.

### Libraries / Dependencies Used

None. Existing Express, database helpers, React Router state, React Icons, and confirmation dialog are reused.

### Trade-offs

- Advantages: explicit publication, section isolation, one coordinator per class, and no new dependency.
- Disadvantages: contacts are available only after verified lookup and must be entered by an admin.
- Technical debt: there is no bulk faculty import.
- Performance implications: one indexed section query is added to successful lookups.
- Security implications: only numbers saved in `faculty_contacts` are returned; student and admin numbers remain excluded.
- Maintainability implications: coordinator replacement and validation remain centralized in the admin API.

### Files Affected

- `server/config/db.js`
- `server/routes/admin.js`
- `server/routes/student.js`
- `client/src/components/faculty/FacultyView.jsx`
- `client/src/pages/AdminFacultyPage.jsx`
- `client/src/pages/ResultPage.jsx`

## Decision: Preserve campus path drafts locally and export source data explicitly

Date: 2026-08-11
Session: Path editor save control
Status: Active

### Problem

Campus paths existed only in React memory, and the export control was not visible in the deployed editor. Refreshing or closing the page could discard extensive tracing work.

### Considered Approaches

1. Keep paths in memory and rely only on a download button.
2. Save path drafts to the backend database.
3. Autosave the editor draft in browser storage and keep an explicit source-file download.

### Chosen Approach

Autosave nodes and edges to `localStorage`, restore them when the editor opens, and place a prominent Save path file button beside the counters.

### Why This Approach?

It prevents accidental refresh loss without adding an API, migration, or server write permissions. Export remains necessary because the student routing bundle reads `campusPaths.js` at build time.

### Why Not the Alternatives?

Memory-only editing already caused avoidable data loss. Backend persistence would add authentication, validation, storage, and deployment complexity while the final artifact still needs to become frontend source data.

### Libraries / Dependencies Used

None. Browser `localStorage` and the existing Blob download are sufficient.

### Trade-offs

- Advantages: refresh-safe drafts, no server dependency, and an obvious save action.
- Disadvantages: drafts stay in one browser and are not shared across devices.
- Technical debt: collaborative or multi-device editing would require backend persistence later.
- Performance implications: small JSON drafts are written after each edit.
- Security implications: the draft contains campus coordinates only, not personal data.
- Maintainability implications: exported files still require review, replacement, and deployment.

### Files Affected

- `client/src/components/map/CampusPathEditor.jsx`
- `client/src/components/map/CampusPathEditor.test.jsx`

## Decision: Keep destination pins separate from the pedestrian path graph

Date: 2026-08-12
Session: Campus path alignment
Status: Active

### Problem

The first exported path graph contained valid walkway coordinates, but destination pins were not visible while tracing and repeated chain starts created 19 disconnected graph components. Moving walkway nodes onto building-centre pins would misrepresent where students can actually walk.

### Considered Approaches

1. Move path nodes onto every destination coordinate.
2. Increase the routing snap distance until every destination uses the graph.
3. Keep path and destination coordinates separate, show destination pins in the editor, and connect trace junctions that land within three metres of each other.

### Chosen Approach

Keep the surveyed path geometry unchanged. Display defined campus destinations as yellow reference pins, reuse an existing node when a new click lands within three metres, and add missing edges between nearby trace junctions during export.

### Why This Approach?

Walkway nodes represent where a student can walk, while map pins often represent a building centre. Keeping those concepts separate preserves honest route geometry. The three-metre tolerance repairs accidental duplicate junctions without inventing long paths.

### Why Not the Alternatives?

Moving nodes to building centres can route through walls. Raising the snap distance would hide missing path coverage and create long straight connectors that look like surveyed routes.

### Libraries / Dependencies Used

None. The existing haversine distance helper and React Leaflet markers are reused.

### Trade-offs

- Advantages: visible alignment references, one connected imported graph, and fewer disconnected tracing mistakes.
- Disadvantages: destinations still need a traced entrance within the existing 60-metre routing threshold.
- Technical debt: Management Building and the stadium entrance still require additional surveyed segments.
- Performance implications: nearby-node checks are quadratic during export, but the campus graph is small and export is an explicit admin action.
- Security implications: none; only public campus coordinates are processed.
- Maintainability implications: destination coordinates remain owned by `campusLocations.js`, while walkable geometry remains owned by `campusPaths.js`.

### Files Affected

- `client/src/components/map/CampusPathEditor.jsx`
- `client/src/services/campusPathGraph.js`
- `client/src/services/campusPaths.js`

## Decision: Select a reachable entrance per path component

Date: 2026-08-12
Session: Multi-entrance campus routing
Status: Active

### Problem

BBD University Building has two valid entrances on separate surveyed path components. Selecting only the globally nearest node caused routing from one side of the building to ignore the reachable entrance on the traveller's component and fall back to a straight line.

### Considered Approaches

1. Draw an artificial edge between the two entrances through the building.
2. Continue using only the globally nearest node.
3. Find the nearest endpoint on each connected path component and choose the shortest component that can reach both journey endpoints.

### Chosen Approach

Group nearby route nodes by connected component, retain the nearest candidate per endpoint and component, and choose the shortest component with candidates for both endpoints. When a location declares `entranceNodeIds`, restrict its route candidates to those surveyed entrances.

### Why This Approach?

It supports multiple legitimate entrances without inventing a walkable segment through the building or treating a nearby through-path as a door. Existing locations without declared entrances keep their nearest-node behaviour.

### Why Not the Alternatives?

An artificial edge would display a path through the building that was not surveyed. Global nearest-node selection cannot represent a destination with entrances on disconnected sides.

### Libraries / Dependencies Used

None. The existing graph and shortest-path utilities are reused.

### Trade-offs

- Advantages: routes use the entrance reachable from the traveller's side, reject nearby non-entry nodes, and preserve surveyed geometry.
- Disadvantages: journeys whose endpoints share no surveyed component still use straight-line fallback.
- Technical debt: an exterior walkway must still be traced before routing can travel between the two components.
- Performance implications: routing evaluates one candidate pair per shared component; the campus graph is small.
- Security implications: none; only public campus path coordinates are processed.
- Maintainability implications: destination pins remain separate from graph nodes and can support additional entrances without destination-specific code.

### Files Affected

- `client/src/services/campusPathGraph.js`
- `client/src/services/campusPathGraph.test.js`
- `client/src/services/campusPaths.js`
- `client/src/services/campusLocations.js`
- `client/src/services/campusLocations.test.js`
