# Google Play store listing (draft)

> "Memory Match" is a working title — final name to be decided before upload.

## App name (max 30)

Memory Match: Photo Pairs

## Short description (max 80)

Find the pairs! Play with cute pictures or make boards from your own photos.

## Full description (max 4000)

Flip, remember, match! Memory Match is the classic pairs game the whole family
knows — with a twist: **make your own boards from your own photos.** Grandma,
the dog, the kids, last summer's beach trip — every card is a photo you choose.

🃏 **Made for everyone**
• Six levels from Tiny (3 pairs, perfect for toddlers) to Expert (18 pairs)
• Big, friendly cards that are easy to tap
• "Kids" speed keeps cards open longer
• Never the same board twice — every game is freshly shuffled

📸 **Your photos, your game**
• Pick up to 30 photos from your gallery or take new ones
• Every photo is automatically cropped to fit — or zoom, move and rotate it yourself
• Choose a cover and a card back for each board
• Your photos stay on your phone. Always.

👨‍👩‍👧 **Play together**
• Solo with stars and best scores
• 2 players on one phone — or lay it flat with Tabletop mode
• Play online with a friend: send a code on WhatsApp and play live

🎨 **A joy to play**
• Smooth 3D card flips, confetti and happy sounds
• 8 colorful picture boards: Animals, Fruits, Vehicles, Ocean, Space, Dino World, Yummy Food and Sports

🔒 **Safe for families**
• No ads, no in-app purchases, no accounts
• No chat — online play uses nicknames and avatars only

## Category / tags

Game → Board (or Puzzle) · Tags: memory, family, kids, brain, matching

## Graphics

All files are ready to upload (Play requires JPEG or 24-bit PNG without alpha for the
feature graphic and screenshots; these are 24-bit PNGs).

| Asset                              | File                                                 | Status                        |
| ---------------------------------- | ---------------------------------------------------- | ----------------------------- |
| App icon 512×512                   | `docs/store/play-icon-512.png`                       | ✅                            |
| Feature graphic 1024×500           | `docs/store/feature-graphic.png`                     | ✅                            |
| Phone screenshots 1080×1920 (9:16) | `docs/store/screenshots/phone-1.png` … `phone-6.png` | ✅ 6 captioned shots          |
| Photo-board screenshots            | — (needs the owner's phone, see below)               | 📋 2 more recommended         |
| 7" / 10" tablet screenshots        | —                                                    | optional (can be added later) |

Upload order (the first 3 matter most — they show in search results):

1. `phone-1.png` — "Flip, remember, find the pairs!" (game in progress)
2. `phone-2.png` — "8 picture boards — or make your own" (board picker)
3. `phone-3.png` — "Play together on one phone" (2 players)
4. `phone-4.png` — "6 levels, from little kids to experts"
5. `phone-5.png` — "Earn stars and beat your best"
6. `phone-6.png` — "Solo, 2 players or online with family" (home)

**How they're made** (repeatable after UI changes): `e2e/store-screenshots.cjs` plays the
web build in a headless browser at 360×640 dp ×3 and saves raw shots to
`docs/store/screenshots/raw/`; `npm run store:screenshots` adds the captions. Native-only
effects (confetti) don't appear on web — the shots never claim them.

### Photo-board screenshots (from your phone)

Custom photo boards are the app's main selling point, but the web build can't import
photos, so these two must be taken on a phone:

1. A **photo board in play** (Medium level, two of your photos face up).
2. The **cropper** ("Photo 3 of 12" with the card-shaped frame).

Use photos you're happy to make public (pets, toys, food, landscapes — avoid faces of
children and anything with names or addresses). Take them with Power + Volume down and
send them to Claude; they'll be framed and captioned like the others
("Play with your own photos", "Every photo fits perfectly").
