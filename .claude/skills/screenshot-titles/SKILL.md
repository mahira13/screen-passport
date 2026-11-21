---
name: screenshot-titles
description: Contract for reading film and series titles from a streaming-app screenshot with Claude vision. Use when editing app/api/read-screenshot or ScreenshotUpload.
---

# Screenshot → titles

## Route
- `POST /api/read-screenshot` with form field `image` (png/jpeg/webp, max 5 MB). Server-side only.
- Send the image to Claude with this instruction: "This is a screenshot from a streaming app. List the film and series titles you can read, exactly as written. Return only JSON: {\"titles\": [\"...\"]}. If none, return {\"titles\": []}."
- Strip code fences, parse JSON, keep at most 30 titles, return `{titles}`.
- Never store the image or log its contents.

## After the route
- Run every title through `lib/match.ts` (normalise + aliases, German and English).
- Matched titles: mark as watched in the passport.
- Unmatched titles: POST to `/api/request`; show "We're adding these" with the list.
- No titles found: "Couldn't read any titles. Try tapping the films you've watched instead."

## Tests
- Keep 5 real screenshots (English and German UI) in `tests/fixtures/screenshots/` and check the matched IDs manually before the demo.
