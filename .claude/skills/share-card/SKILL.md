---
name: share-card
description: Rules for the Screen Passport share card and the scene postcard. Use when editing ShareCard, PostcardMaker or anything users share to Instagram.
---

# Share card and postcard

## Passport card (story format)
- Size 1080×1920, generated in the browser with html-to-image; share via the Web Share API (files) with download as fallback.
- Content, top to bottom: "Screen Passport" wordmark + city edition; optional display name; big number "N filming places" + "from your films near <city>"; dot map of the user's places coloured by title (plain SVG, no map tiles, so it renders offline); one stamp per watched title (dashed circle, title, place count; gold fill when visited); closest place line; collection progress line ("Cold War Berlin 2/4"); footer with a QR code and the short passport link (`host/p/<id>`).
- Look: deep navy #16213A, cream text #F4EFE4, gold accent #E3B04B; Space Grotesk headings, Inter body. Text contrast at least 4.5:1.
- Never posters, stills or logos.

## Scene postcard
- User picks or takes a photo; compose on a canvas in the browser (4:5 and 9:16 versions).
- Frame: bottom band with title, place name, "Filmed here", small Screen Passport mark, the place link (`host/location/<id>`) and its QR code at the top of the band (Instagram covers a story's bottom ~250 px).
- Only offer the postcard for a location after a successful check-in or when the user confirms they are there.
- Don't upload the photo. Fire `postcard_made` without image data.

## Share copy and links
- Pre-filled text: "My Screen Passport: N places from my films near <city>. Find yours:" with the passport link as the share's `url`.
- Every share (passport card, trip invite, postcard) sends the image AND the link (`/p/<id>`, `/trip/<id>`, `/location/<id>`) through the Web Share API; the link goes in `url`, not in the text. Fallback: download the image, plus a "Copy link" button.
- Every shared image carries the short link and a QR code (`components/QrCode.tsx`, `lib/qr.ts`), so the link survives Instagram.
- Next to every image share: "Instagram · Story: add a link sticker with your copied link." Tapping Share also copies the link.
