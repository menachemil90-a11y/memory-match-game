# Promo videos — brief (v1)

Short vertical ads for Meta (Instagram/Facebook Reels), TikTok and YouTube Shorts.
Audience: parents and grandparents, first in **Israel (Hebrew)**, plus an **English** version
of every video. Goal: installs of the Android app and plays of the web game.

## Rules (non-negotiable)

- **Everything shown is real.** Only features the game really has, real screens, real
  numbers (levels: 3, 6, 8, 10, 12, 18 pairs — `src/game/levels.ts`). No fake stats,
  ratings, reviews, "#1", "millions of players", and no claims about brain development or
  learning benefits.
- **No store badges** — no Google Play, no App Store, no iPhone. Distribution may stay
  outside Google Play: the CTA is "Free for Android" + the web address.
- **No third-party music** (licensing). Use the game's own sound effects (flip, match,
  win). Menachem adds music in the Meta/TikTok editors.
- **People in the videos:** only the fictional AI family in `promo/photos/` (see its
  README) and the built-in boards. Never real people's photos in this public repo.
- No tracking, no personal data, nothing secret in the repo.

## Format

- 1080×1920 (9:16), 30 fps, H.264 (yuv420p, high profile), AAC 48 kHz. 15–22 s each.
- After all 9:16 versions are done: 1080×1350 (4:5) feed versions of the same videos.
- **Safe zones:** keep text and key action out of the top 270 px, the bottom 380 px and
  the right 120 px (Reels/TikTok UI covers them).
- **Hook in the first 1.5 s**, motion from the very first frame (no static logo intro).
- **Sound-off friendly:** big captions, 2–6 words each, max 2 lines, readable on a small
  phone (white, dark outline/shadow). Fredoka like the game — check it renders **Hebrew**
  glyphs; if not, use an OFL Hebrew-capable rounded font (e.g. Rubik). Hebrew must be
  correct RTL (punctuation and emoji on the right side of the sentence).
- Captions pop in with the game's motion style (`src/ui/animation/motion.ts` — no wobbly
  springs).
- Gameplay either full-bleed or inside a **generic** phone frame (no brand device) on the
  game's purple gradient.
- **End card (2.5 s), same for all:** the logo cards + "Memory Match" +
  HE: "חינם לאנדרואיד" / "משחקים אונליין גם מהדפדפן" ·
  EN: "Free for Android" / "Play online in your browser too" ·
  - `memorymatch-online.pages.dev`.

## The 5 videos (captions: HE / EN)

### 1. `family-photos` — your family on the cards (the main ad)

1. Hook — a card flips and reveals Grandma's face:
   **הפכו את תמונות המשפחה למשחק זיכרון** / **Turn your family photos into a memory game**
2. Photos fly from a gallery grid into cards: **בוחרים תמונות מהגלריה** / **Pick photos from your gallery**
3. The board deals (real deal animation, the 8 family photos, "medium"):
   **כל משחק — ערבוב חדש** / **A new shuffle every game**
4. A flip misses, then the Grandma pair is found:
   **איפה סבתא? 👵** → **מצאתם! 🎉** / **Where's Grandma? 👵** → **Found her! 🎉**
5. End card.

### 2. `play-with-grandma` — online with family far away

1. Hook — two phones side by side (or split screen):
   **סבתא גרה רחוק? שחקו איתה עכשיו** / **Grandma lives far away? Play with her now**
2. A **generic** chat bubble (no WhatsApp branding) with the invite link:
   **שולחים לה קישור** / **Send her a link**
3. The link opens the web game in a browser, straight into the room:
   **היא משחקת מהדפדפן — בלי להוריד כלום** / **She plays in her browser — nothing to download**
4. Turns alternate on both screens, family photos on the cards:
   **התור שלך… התור של סבתא…** / **Your turn… Grandma's turn…**
5. **וסבתא מנצחת 🏆** / **And Grandma wins 🏆** → end card.

### 3. `kids-vs-parents` — 2 players, 1 phone

1. Hook: **למי יש זיכרון יותר טוב — לכם או לילדים?** / **Who has the better memory — you or your kids?**
2. **2 שחקנים, טלפון אחד** / **2 players, 1 phone**
3. A player finds a pair and goes again: **מצאתם זוג? ממשיכים לשחק** / **Found a pair? Go again**
4. Results screen: **הילדים ניצחו. שוב. 😅** / **The kids won. Again. 😅** → end card.

### 4. `grows-with-kids` — difficulty levels

1. Hook: **משחק זיכרון שגדל עם הילדים** / **A memory game that grows with your kids**
2. The 3-pair board: **3 זוגות לקטנטנים** / **3 pairs for little ones**
3. Boards grow fast through the levels to 18 pairs: **ועד 18 זוגות לאלופים** / **Up to 18 pairs for champions**
4. **6 רמות קושי** / **6 difficulty levels** → end card.

### 5. `20-second-challenge` — satisfying speed run

1. Hook with a big countdown timer: **מצליחים לנקות את הלוח ב-20 שניות?** / **Can you clear the board in 20 seconds?**
2. A fast, real, perfect run (the finder of a pair keeps playing, so one player can clear
   the board alone) with the timer on top.
3. Board cleared with time left: **נסו לנצח את הזמן הזה** / **Try to beat this time** → end card.

## Footage

- **Prefer real recordings of the real game.** The live web game
  (https://memorymatch-online.pages.dev) gives online play, invites and — through an
  online photo room created via the API like the photo-room E2E test — real gameplay with
  the family photos. Two browser contexts give the two-phone shots.
- Playwright's built-in video recording is low quality: capture sharp frames (CDP
  screencast or screenshot sequences at device scale) so the 1080×1920 output is crisp.
- Screens that only exist in the app (gallery pick, crop, Solo, 2 Players on one phone):
  either a **local capture-only build** behind a build flag (never deployed, no change to
  the shipped product), or write the exact shots to `promo/SHOTLIST-PHONE.md` and I'll
  record them on Menachem's phone (real app, these demo photos on the phone).
- Remotion or ffmpeg — your choice. Keep the promo tooling in `promo/` with its own
  `package.json`, so the app's dependencies and CI don't change. Captions, timings and
  languages as data (one file), so a new language or a copy change is a re-render.

## Delivery

- `promo/STORYBOARD.md` first (scenes, timings, captions per language), then render
  all 5 × HE/EN in 9:16 without waiting for approval — iterating is cheap.
- Renders do **not** go into git. Upload them to a GitHub release `promo-v1` as a
  **pre-release that is not "latest"** (`gh release create promo-v1 --prerelease --latest=false`)
  — a normal release would become "latest" and break
  `releases/latest/download/memory-match.apk`, the app's download link.
- Names: `<video>.<he|en>.9x16.mp4`, later `.4x5.mp4`, plus a contact sheet per video
  (6 frames in one PNG) for quick review.
- Report: the list of files with links, what's real footage vs. motion graphics, and
  anything you couldn't do.
