# Build Brief: Family Photo Memory Game (iOS + Android)

You are the lead developer and designer of a new mobile game. Read this whole brief before writing any code. Build it in phases (section 14). At the end of every phase, stop and give me a short summary, what you tested, and exact steps to run the current build on my Android phone.

---

## 1. Product in one paragraph

A family-friendly **memory (pairs / concentration) game** with a polished casual-game look and feel. What makes it different: **anyone can create their own board from their own photos**. They upload photos, crop them to fit the cards, and every card on that board is one of their photos. You can play solo, **2 players on the same phone**, or **1v1 online** by inviting a friend. A board is **never dealt in the same layout twice**. Kids, parents and grandparents should all be able to play happily. UI language: **English only for now.**

## 2. Platforms and tech stack

- **iOS + Android from one codebase.** First release goes to Google Play, then the App Store.
- **Expo (latest stable SDK) + React Native + TypeScript (strict)**, with Expo Router for navigation.
- Animation: `react-native-reanimated` + `react-native-gesture-handler`. Use `@shopify/react-native-skia` for particles/confetti if needed.
- Images: `expo-image`, `expo-image-picker` (it must use the **system photo picker**, with no broad media permissions), `expo-image-manipulator`, `expo-file-system`.
- Local data: `expo-sqlite`. Use a small state store such as Zustand.
- Sound and haptics: `expo-audio`, `expo-haptics`.
- Online multiplayer backend: **Supabase** (anonymous auth, Postgres with Row Level Security, Realtime).
- Builds and releases: **EAS Build / EAS Submit**. iOS gets built in the cloud, so no Mac is needed. Use **EAS Update** for over-the-air updates (section 12).
- Put all UI strings in an i18n layer (e.g. i18next) from day one so Hebrew/RTL can be added later. Ship English only.
- Use a development build (not Expo Go) if any native module requires it.

## 3. Core game rules (must feel like the real tabletop game)

- All cards start face down in a grid.
- On your turn you flip 2 cards.
  - **Match:** the pair lifts, glows, and **flies into that player's collected pile**. The cards are **removed from the board and leave empty gaps**. The grid never reflows, just like a real table. **The same player goes again**, and keeps going until they miss.
  - **No match:** both cards stay visible for a short delay (configurable, longer in "Kids" setting), flip back, and the **turn passes** to the other player. Tapping the board skips the remaining delay.
- Input is locked while cards animate. Tapping an already-open card, or a third card, does nothing.
- The game ends when all pairs are collected. The winner has the most pairs. Handle ties gracefully.
- Keep the game engine as a **pure TypeScript module** (state + actions + reducer, no UI, no React). The same rules power solo, local 2-player and online, and the engine must be fully unit-tested.

## 4. Shuffling: "never the same board twice"

- Shuffle with Fisher–Yates using a **cryptographically secure RNG** (`expo-crypto`). Never use `Math.random`.
- A **layout** is the ordered list of image IDs by grid position, for a given board and level. Hash it (SHA-256) and store the hashes of layouts already played per (board, level).
- If a new shuffle matches a stored hash, reshuffle. The player must never get a layout they already played.
- Math edge case: the smallest level has very few possible layouts (3 pairs = 6!/(2!)³ = **90** layouts if the board has exactly 3 images). When every possible layout of a (board, level) has been used, reset that history but still avoid the last 10. For bigger levels the space is astronomically large, but the check stays anyway.
- If a board has more images than the level needs, pick a **random subset** of images for each game.
- Online games: the **server** shuffles (section 11) and keeps its own hash history.

## 5. Difficulty levels (pairs-based, so small kids can play)

The player picks a level before each game. Each level has a friendly name, shows its pair count, and uses a square-card grid tuned for portrait phones:

| Level  | Pairs | Grid |
| ------ | ----- | ---- |
| Tiny   | 3     | 2×3  |
| Easy   | 6     | 3×4  |
| Medium | 8     | 4×4  |
| Tricky | 10    | 4×5  |
| Hard   | 12    | 4×6  |
| Expert | 18    | 6×6  |

- Card size is computed from the available screen area, with safe areas respected. Cards must stay large enough to tap comfortably on small Android phones, and the layout must scale nicely on tablets.
- On a custom board, levels that need more photos than the board has are shown **locked**, with a hint: "Add 2 more photos to unlock Hard".

## 6. Game modes

**Solo**

- HUD shows moves, a timer, and pairs found.
- End screen gives a 1–3 star rating based on moves relative to pairs, saves the best score per board + level, and plays a confetti celebration.

**2 Players, same phone (pass-and-play)**

- Enter player names (remembered for next time) and pick colors/avatars from presets.
- A clear turn banner ("Noa's turn"), with the active player's zone highlighted in their color.
- Each player has a visible collected-cards pile that grows with every match.
- **Tabletop mode** (toggle): the phone lies flat between two players. Player 2's HUD and pile sit at the top, rotated 180°.
- End screen shows the winner, both piles, "Play again" (new shuffle, other player starts), and "Change board".

**1v1 Online**

- Online play uses **built-in boards only**. Custom photo boards stay on the device.
- Full flow is in section 11.

## 7. Boards

### 7a. Built-in boards

- Ship 6–8 themed boards bundled in the app so they work offline: Animals, Fruits, Vehicles, Ocean, Space, Dinosaurs, Food, Sports. Each needs **at least 18 images** (24 is better, for variety at Expert level).
- All built-in art must share **one consistent, high-quality style** and must be **properly licensed**. Do not use copyrighted images or other games' assets. For v1, use an openly licensed illustration/emoji set (e.g. Twemoji, CC-BY 4.0) on colorful card backgrounds, with attribution on a Credits screen. Structure the asset pipeline so I can later swap in custom artwork per board.
- Each board has a cover image and its own card-back style.

### 7b. Custom photo boards (the key feature)

- "Create board" asks for a name, then the user picks photos (multi-select from gallery, or take a photo with the camera). Maximum 30 photos per board.
- **Crop flow (must be excellent):**
  - After picking, run a batch crop queue ("Photo 3 of 12").
  - Every photo is first **auto-cropped to the card shape** with a centered square crop, so the user can just tap "Done all".
  - The full-screen cropper supports pinch-to-zoom, drag-to-pan and rotate 90°, with a **live preview that looks exactly like the final card** (square, rounded corners, card border).
  - Users can re-crop any photo later from the board editor. To allow that, keep a downscaled source copy (~1600px longest side) as well as the final card image (~700×700 JPEG, ~80% quality) and a thumbnail.
- **Board editor:** rename, reorder, delete or add photos, choose a cover photo, choose a card back, and delete the board (with confirmation).
- All files go in the app's document directory. Handle low storage and missing files gracefully.
- Card shape is **square** across the whole game.

## 8. Visual design and game feel

The goal is a **premium casual-game look**, in the spirit of the best-looking memory/puzzle games on the stores. Use our **own identity**; never copy another app's branding or assets.

- Bright, cheerful, cohesive palette with soft gradient backgrounds. Define a design-token file for colors, radii, spacing and shadows, and use it everywhere.
- Chunky rounded cards with a soft shadow and a thick light border. Card backs have a polished pattern and logo.
- A rounded, friendly font (e.g. Fredoka or Baloo 2 via `@expo-google-fonts`, OFL licensed).
- Big pill-shaped buttons with a pressed-down 3D effect.
- **Juicy feedback everywhere:**
  - a real 3D card flip (rotateY with perspective) running at 60fps on the UI thread
  - a springy pop on match, a gentle shake on mismatch
  - pairs flying to the pile, the pile count bumping
  - confetti and a fanfare on win
  - staggered deal-in animation at game start
  - haptics on flip, match and win
- Sound effects for flip, match, miss, win and button taps, plus optional light background music, all CC0/licensed (e.g. Kenney audio), with licenses stored in the repo. Separate toggles for sound, music and haptics.
- Respect the OS "reduce motion" setting. Use large tap targets and good contrast, and never rely on color alone (show player names/icons too).
- Preload all images of a board before the deal so there is no flicker.

## 9. Screens

1. **Home:** big, playful buttons for Solo, 2 Players, Play Online and My Boards, plus a settings gear.
2. **Board picker:** a carousel/grid of built-in and custom boards with covers, plus a "+ Create board" tile.
3. **Level picker:** shows locked levels for small custom boards, and the best score/stars per level.
4. **Player setup** (2 players): names, colors/avatars, tabletop toggle.
5. **Game screen.**
6. **Results screen.**
7. **My Boards / Board editor / Cropper.**
8. **Online lobby:** create game, join by code, waiting room.
9. **Settings:** sound, music, haptics, flip-back speed (Normal / Kids), reset stats, Credits & licenses, Privacy policy link.

## 10. Data, privacy and store policies

- **Custom photos never leave the device** in v1. No account or signup is needed to play offline.
- Online play uses Supabase **anonymous auth** plus a nickname and a preset avatar. There is **no free-text chat**, because this is a family/kids audience. Filter nicknames for profanity.
- Design for **Google Play's Families / target-audience requirements** and Apple's equivalent: minimal data collection, no third-party ads or tracking SDKs in v1, and a privacy policy. Tell me anything I must declare in the Play Console Data Safety form.
- No ads and no in-app purchases in v1. Keep the code modular so premium board packs could be added later.

## 11. Online 1v1 architecture (Supabase)

- **Create game:** the host picks a built-in board + level and gets a 6-character room code with no ambiguous characters (no O/0/I/1). An **Invite** button opens the native share sheet (WhatsApp etc.) with a message containing the code and a join link.
- **Join game:** enter the code, or open the link. Use a custom URL scheme now. Plan https App Links / Universal Links, but **ask me for the domain** before implementing them.
- **The server is authoritative**, so no client can cheat by reading card positions:
  - The shuffled deck lives in a table clients cannot read (RLS).
  - Clients call RPCs / Edge Functions such as `flip_card(room_id, index)`. The server validates whose turn it is, reveals only flipped cards, applies the same rules as the local engine, and updates a public game-state table.
  - Both clients subscribe via Supabase Realtime, so both phones see every flip and animation in sync.
- **Who starts** is decided randomly, with a short coin-flip animation. Rematches alternate the starting player and use a new server-side shuffle that obeys the no-repeat rule.
- **Turn timer** (e.g. 30s, shown as a ring around the avatar): when it expires, the turn passes. Enforce it server-side, e.g. a `claim_timeout` RPC that checks server time against `turn_deadline`. Do not rely on client clocks.
- **Disconnects:** use presence for a connection indicator. Allow a 60s grace period to reconnect, then the opponent may claim the win or keep waiting.
- Keep the rules logic shared between the app and the server if practical. Otherwise mirror it and add tests that prove both behave identically.
- Add RLS on every table, a cleanup job for stale rooms, and a `min_supported_version` config value. The app checks it before online play and asks the user to update if their version is too old.
- Put all SQL in `supabase/migrations` and functions in `supabase/functions`, under version control.

## 12. Updates and releases (I must be able to update the game anytime)

- Configure **EAS Update** with `preview` and `production` channels and a proper `runtimeVersion` policy, so JS/asset fixes ship over the air without a store review.
- Native changes go through EAS Build and store releases with proper version/build-number bumps.
- Write a short `RELEASING.md` explaining both paths step by step.
- Prepare store readiness: app icon, adaptive icon, splash screen, screenshots plan, and a store listing text draft.

## 13. Code quality

- Folder structure by feature (`app/` routes, `src/game` engine, `src/features/boards`, `src/features/online`, `src/ui` design system, `src/lib`).
- Jest unit tests for the engine: shuffle uniqueness and history, turn rules, extra turn on match, scoring, end/tie conditions, level/grid mapping, locked levels.
- ESLint + Prettier, no `any`.
- Commit after each meaningful step with clear messages.
- Test performance on a low-end Android device profile. Large boards (36 cards) must stay smooth.

## 14. Phases

0. **Setup:** propose the folder structure and library list (versions compatible with the latest Expo SDK). Initialize the project, design tokens, fonts and navigation skeleton.
1. **Engine:** pure game engine + shuffle/no-repeat system + full unit tests.
2. **Play:** game screen with flip animations, one built-in board, Solo and 2-Players-same-phone modes, results screens, sounds and haptics.
3. **Boards:** all built-in boards, the board picker and the level picker.
4. **Custom boards:** photo picking, batch crop flow, board editor and local storage.
5. **Online:** Supabase schema, RPCs, lobby, invites, realtime play, timer, reconnects, rematch.
6. **Polish & release prep:** settings, credits, accessibility pass, performance pass, EAS Update/Build config, store assets, `RELEASING.md`.

## 15. Not in v1

Accounts/cloud backup of custom boards, sharing custom boards online, chat, ads, in-app purchases, Hebrew UI (only prepare i18n for it).

## 16. Ask me before you…

- choose the final app name and bundle/package ID (they can't be changed after publishing; use a placeholder until then)
- implement https invite links (needs a domain)
- create any paid service or anything that costs money
- deviate from the game rules above
