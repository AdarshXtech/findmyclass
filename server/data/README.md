# CSAI 2B Data Notes

The `csai2b-2026.json` dataset was transcribed from the files supplied on 2026-07-21:

- `CSAI 2B.pdf`: student roster with class roll number, university roll number, name, and section.
- `WhatsApp Image 2026-07-19 at 7.31.43 PM.jpeg`: weekly timetable and course/faculty legend for academic session 2026-27.

## Verified Decisions

- The PDF contains 58 rows labelled `CSAI2B`; all 58 are included.
- PDF row 59, Pratik Singh (`1250439494`), is labelled `CSAI2D` and is excluded.
- The timetable image prints `CSAI1-2B`. The canonical section is `CSAI2B`, based on the roster and the user's explicit statement that the class is CSAI 2B. The original image label remains in `sourceSectionLabels`.
- University roll number is the sole public lookup identifier.
- Tuesday is blank in the source image and is represented as a day with no timetable entries.
- The dataset contains 58 students, 24 teaching sessions, and five weekday lunch breaks.

Run `npm run load-csai2b` from `server` to idempotently add/update this roster and replace only the CSAI 2B timetable for academic session 2026-27.
