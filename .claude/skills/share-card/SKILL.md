---
name: share-card
description: Rules for the Screen Passport share card and the scene postcard. Use when editing ShareCard, PostcardMaker or anything users share to Instagram.
---

# Share card and postcard

## Passport card (story format)
- Size 1080×1920, generated in the browser with html-to-image; share via the Web Share API (files) with download as fallback.
- Content, top to bottom: "Screen Passport" wordmark + city edition; optional display name; big number "N filming places" + "from your films near <city>"; dot map of the user's places coloured by title (plain SVG, no map tiles, so it renders offline); one stamp per watched title (dashed circle, title, place count; gold fill when visited); closest place line; collection progress line ("Cold War Berlin 2/4"); footer "Find yours at <link>".
- Look: deep navy #16213A, cream text #F4EFE4, gold accent #E3B04B; Space Grotesk headings, Inter body. Text contrast at least 4.5:1.
- Never posters, stills or logos.

## Scene postcard
- User picks or takes a photo; compose on a canvas in the browser (4:5 and 9:16 versions).
- Frame: bottom band with title, place name, "Filmed here", small Screen Passport mark and link.
- Only offer the postcard for a location after a successful check-in or when the user confirms they are there.
- Don't upload the photo. Fire `postcard_made` without image data.

## Share copy
- Pre-filled text: "My Screen Passport: N places from my films near <city>. Find yours: <link>"
- Every shared image carries the link.
