# Promo videos — storyboard

Five short ads, Hebrew and English, 9:16 (1080×1920) first, then 4:5 (1080×1350).
30 fps, H.264 high / yuv420p, AAC 48 kHz, 15–22 s each. The scene data (timings,
captions, which footage) is in [`content.json`](content.json): this file describes it.

**Legend:** 🎥 = real recording of the real game (Playwright, phone size 360×640 at
2× → 720×1280 frames) · ✨ = motion graphics built from the game's own art (card backs,
cream card border, colors, Fredoka, logo, the demo photos).

Everything sits on the game's purple gradient, the footage inside a generic phone
frame (no brand). Captions: Fredoka Bold, white with a dark purple outline, 2–6 words,
max 2 lines, pop in with the game's timed motion (a short scale-up with a small
overshoot — no springs). Sound: only the game's own effects (flip, deal, match, miss,
win, turn), placed on the moments they happen in the footage. No music.

Safe zones (9:16): nothing important in the top 270 px, bottom 380 px or right 120 px —
captions sit at y 300–570, the phone below them, centered at x 500.

The game's interface is English only (the app has no Hebrew yet), so the footage is the
same in both languages; player names typed in the game follow the language
(נועה / אבא, סבתא).

## End card (all videos, 2.5 s) ✨

The logo cards pop in (the app icon's art: two tilted cards with "?") → **Memory Match**
→ HE **חינם לאנדרואיד** / **משחקים אונליין גם מהדפדפן** · EN **Free for Android** /
**Play online in your browser too** → the address pill **memorymatch-online.pages.dev**.
No store badges.

---

## 1. `family-photos` — your family on the cards (≈ 15.9 s)

| #   | Time      | Picture                                                                                                            | Caption HE / EN                                                                 | Source                         |
| --- | --------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- | ------------------------------ |
| 1   | 0–2.2     | A game card (grape-stars back) already moving, flips at 0.35 s and shows Grandma baking (02). Flip + match sound.  | הפכו את תמונות המשפחה למשחק זיכרון / Turn your family photos into a memory game | ✨                             |
| 2   | 2.2–5.0   | A gallery grid of the demo photos; checks appear one by one, then the photos fly into cards with the cream border. | בוחרים תמונות מהגלריה / Pick photos from your gallery                           | ✨ (real version: shot list A) |
| 3   | 5.0–7.8   | A real online photo room ("medium", the 8 photos): the board deals.                                                | כל משחק — ערבוב חדש / A new shuffle every game                                  | 🎥 `family-photos`             |
| 4   | 7.8–10.4  | A flip misses (two different photos turn back).                                                                    | איפה סבתא? 👵 / Where's Grandma? 👵                                             | 🎥                             |
| 5   | 10.4–13.4 | The Grandma pair is found (slow push-in).                                                                          | מצאתם! 🎉 / Found her! 🎉                                                       | 🎥                             |
| 6   | 13.4–15.9 | End card.                                                                                                          |                                                                                 | ✨                             |

## 2. `play-with-grandma` — online with family far away (≈ 19.1 s)

Two real phones: Mom in the app, Grandma in a browser (the web game, nothing installed),
playing one real online photo room ("tiny", family photos) through the live game server.

| #   | Time      | Picture                                                                                                  | Caption HE / EN                                                                      | Source                               |
| --- | --------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------ |
| 1   | 0–2.4     | Both phones side by side, mid-game; Grandma's turn.                                                      | סבתא גרה רחוק? שחקו איתה עכשיו / Grandma lives far away? Play with her now           | 🎥 `grandma-mom` + `grandma-browser` |
| 2   | 2.4–5.0   | A generic chat bubble (no app branding) with the game's real invite message, link and link-preview card. | שולחים לה קישור / Send her a link                                                    | ✨ (real text and image)             |
| 3   | 5.0–9.2   | The link opens in the browser: the invitation screen, she types her name, picks an avatar, taps Join.    | היא משחקת מהדפדפן — בלי להוריד כלום / She plays in her browser — nothing to download | 🎥 browser                           |
| 4   | 9.2–13.8  | Turns alternate on both screens.                                                                         | התור שלך… → התור של סבתא… / Your turn… → Grandma's turn…                             | 🎥 both                              |
| 5   | 13.8–16.6 | Grandma takes the last pair; the result. Win sound.                                                      | וסבתא מנצחת 🏆 / And Grandma wins 🏆                                                 | 🎥 both                              |
| 6   | 16.6–19.1 | End card.                                                                                                |                                                                                      | ✨                                   |

## 3. `kids-vs-parents` — 2 players, 1 phone (≈ 16.1 s)

A real 2-player game on one phone (Animals, Easy, 6 pairs), Noa vs Dad / נועה vs אבא.

| #   | Time      | Picture                                                      | Caption HE / EN                                                                         | Source           |
| --- | --------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------- | ---------------- |
| 1   | 0–2.4     | Mid-turn: two cards open.                                    | למי יש זיכרון יותר טוב — לכם או לילדים? / Who has the better memory — you or your kids? | 🎥 `two-players` |
| 2   | 2.4–5.8   | "Who is playing?": the two names typed, avatars, Let's play. | 2 שחקנים, טלפון אחד / 2 players, 1 phone                                                | 🎥               |
| 3   | 5.8–10.8  | Noa finds a pair and plays again, finds another.             | מצאתם זוג? ממשיכים לשחק / Found a pair? Go again                                        | 🎥               |
| 4   | 10.8–13.6 | The results screen: the kid wins. Win sound.                 | הילדים ניצחו. שוב. 😅 / The kids won. Again. 😅                                         | 🎥               |
| 5   | 13.6–16.1 | End card.                                                    |                                                                                         | ✨               |

## 4. `grows-with-kids` — difficulty levels (≈ 15.7 s)

| #   | Time      | Picture                                                                         | Caption HE / EN                                                      | Source             |
| --- | --------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------ |
| 1   | 0–2.6     | Picking the Animals board → the level screen.                                   | משחק זיכרון שגדל עם הילדים / A memory game that grows with your kids | 🎥 `levels-picker` |
| 2   | 2.6–6.0   | The Tiny board (3 pairs) being played.                                          | 3 זוגות לקטנטנים / 3 pairs for little ones                           | 🎥 `tiny-play`     |
| 3   | 6.0–10.6  | Fast cuts of the real boards dealing: 6 → 8 → 10 → 12 → 18 pairs.               | ועד 18 זוגות לאלופים / Up to 18 pairs for champions                  | 🎥 `level-*`       |
| 4   | 10.6–13.2 | The level screen: Tiny 3 · Easy 6 · Medium 8 · Tricky 10 · Hard 12 · Expert 18. | 6 רמות קושי / 6 difficulty levels                                    | 🎥 `levels-picker` |
| 5   | 13.2–15.7 | End card.                                                                       |                                                                      | ✨                 |

## 5. `20-second-challenge` — speed run (≈ 15–18 s, set by the real run)

A real online room (Animals, Easy, 12 cards). Pairs found keep the turn, so one player
clears the board alone. The run is real-time and uncut; the timer above the phone is
the run's real elapsed time counting down from 20.

| #   | Time          | Picture                                                                                   | Caption HE / EN                                                            | Source                   |
| --- | ------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------ |
| 1   | 0–2.6         | Big countdown timer pill (yellow, red under 5 s) above the phone; the run starts at once. | מצליחים לנקות את הלוח ב-20 שניות? / Can you clear the board in 20 seconds? | ✨ timer + 🎥 `speedrun` |
| 2   | 2.6–end       | The perfect run: every flip a match. Flip/match sounds.                                   | —                                                                          | 🎥                       |
| 3   | after the run | Timer turns green and stops with the time left. Win sound.                                | נסו לנצח את הזמן הזה / Try to beat this time                               | ✨ + 🎥                  |
| 4   | last 2.5 s    | End card.                                                                                 |                                                                            | ✨                       |

---

## 4:5 versions (1080×1350)

Same scenes and timings; the caption sits at the top (y 40–260), the phone below it,
centered; two phones side by side at 440 px screens. No top/bottom UI zones to avoid
in feeds, so the layout uses the full height.
