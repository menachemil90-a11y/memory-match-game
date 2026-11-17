# Release plan — from "account approved" to "live on Google Play"

_Written on Tuesday, November 17, 2026. Dates are estimates; Google's review times vary._

This guide assumes you have never published an app before. Every step says **who** does
it: **👤 You** or **🤖 Claude**. Google's screens change names now and then — if a button
looks slightly different, look for the closest match, or send Claude a screenshot.

---

## 1. The plan in one minute

1. **Now → ~Dec 8 (while Google checks your account):** you test the app on your phone,
   Claude fixes every bug and sends a new test build. In parallel we finish everything the
   store needs, so that later nothing is left to prepare.
2. **~Dec 8, account approved:** you create the app in the Play Console (≈ 1–2 hours with
   this guide), and upload the first version to a **closed test**.
3. **~Dec 11 → ~Dec 25:** at least **12 testers** (family and friends) use the app for
   **14 days in a row**. This is a Google rule for new personal accounts.
4. **~Dec 26:** you ask Google for **production access** (a short form; Claude drafts the answers).
5. **Early January:** Google approves → you publish → **the game is live**. Target: **around
   Monday, January 11, 2027**, with a few days of buffer for holiday slowdowns.

So: **the first upload happens in about 3 weeks** (as you planned). The public launch is
**about 8 weeks from today**, because the 14-day test and Google's reviews can't be
shortened for a new personal account.

---

## 2. Words you'll meet

| Word                         | What it means                                                                                                                                                     |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Play Console**             | Google's website for developers: play.google.com/console. Everything happens there. There's also a Play Console phone app.                                        |
| **Package ID**               | The app's permanent technical name, e.g. `com.something.memorymatch`. **It can never be changed** after the first upload.                                         |
| **AAB** (Android App Bundle) | The file you upload to Google Play. (An **APK** is the installable file we use for side-loaded test builds.)                                                      |
| **Track**                    | A "lane" for releases: **Internal testing** (up to 100 people, fast), **Closed testing** (invited testers), **Open testing** (anyone), **Production** (everyone). |
| **Closed test**              | A private version of your store page that only people on your tester list can see and install.                                                                    |
| **Opt-in link**              | A web link for testers. They open it, tap "Become a tester", and then they can install the app from Google Play.                                                  |
| **Production access**        | Permission from Google to publish to everyone. New personal accounts must earn it with the 14-day closed test.                                                    |
| **Review**                   | Google checks every release (also test releases) before it becomes available. Usually hours to a few days.                                                        |
| **EAS**                      | Expo's build service. It builds the AAB on Expo's computers and keeps the app's signing key safe.                                                                 |

---

## 3. Timeline with dates

| When (approx.)        | What                                                                                      | Who                          |
| --------------------- | ----------------------------------------------------------------------------------------- | ---------------------------- |
| **Nov 17 → Dec 8**    | Test on your phone, report bugs → fixes + new test APK links                              | 👤 test · 🤖 fix             |
| **by Tue Dec 1**      | Decide the **final app name and package ID** (section 4, step A3)                         | 👤                           |
| **by Tue Dec 1**      | Expo account + access token; first EAS builds (section 10)                                | 👤 10 min · 🤖 builds        |
| **by Fri Dec 4**      | Public contact email · privacy policy hosted · 15–20 tester emails collected              | 👤 · 🤖 helps                |
| **~Dec 1–8**          | Make the GitHub repository private again (after EAS builds work — section 10)             | 👤 one click · 🤖 checks     |
| **~Tue Dec 8**        | **Account approved** → create the app, fill in the forms, upload to the closed test       | 👤 1–2 h · 🤖 builds the AAB |
| **~Dec 9 → 11**       | Google reviews the closed-test release                                                    | Google                       |
| **~Fri Dec 11**       | Closed test is live → send the opt-in link; all testers join **the same day if possible** | 👤 + testers                 |
| **Dec 11 → Dec 25**   | 14 days of testing; we keep fixing and uploading improvements                             | everyone                     |
| **~Sat Dec 26**       | Apply for production access                                                               | 👤 · 🤖 drafts answers       |
| **~Dec 26 → Jan 4**   | Google reviews the application (usually up to 7 days; holidays can slow it)               | Google                       |
| **~Jan 4 → 8**        | Create the production release; Google reviews it                                          | 👤 · 🤖                      |
| **~Mon Jan 11, 2027** | 🎉 **Live on Google Play** (target with buffer)                                           |                              |

If anything slips (account approval takes longer, review is slow), every later date moves
by the same amount — nothing is lost.

---

## 4. Phase A — now until the account is approved (Nov 17 → ~Dec 8)

**A1 · 👤 Finish the account registration.** Google verifies your identity (this is the ~3
weeks you mentioned). For new **personal** accounts there's also a small extra step:
**verify that you own an Android phone** — install the **Play Console** app on an Android
10+ phone, sign in, and tap **Verify** when the Play Console website asks (takes a minute).

**A2 · 👤 Test the app, 🤖 fix bugs.** Use the test APK on your phone. For each problem,
send Claude: what you did, what happened, what you expected, and a screenshot or screen
recording if possible. Claude fixes it and sends a link to a new test build. Things to try
are listed in `docs/PROGRESS.md` → "Never tested on a real device".

**A3 · 👤 Decide the final name and package ID (by Dec 1).**

- **App name** (shown under the icon, max 30 characters on the store). It _can_ be changed later.
- **Package ID** — **can never be changed**. Format: `com.<something>.<app>`, lowercase,
  letters/numbers/dots only, e.g. `com.happyfamilygames.memorymatch`. It is visible to
  everyone (it's in the store link), so you may prefer a brand word instead of your name.
- 🤖 Claude then replaces the placeholders (`app.json`, scheme, docs) and rebuilds.

**A4 · 👤 Create a public contact email.** Google shows the developer contact email
**publicly** on the store page. A separate Gmail address just for the app (for example
`<your-game-name>.app@…`) keeps your personal inbox private.

**A5 · 👤 Host the privacy policy (🤖 text is ready).** Google requires a public web page.
Because the repository is public, your name and email must **not** go into the repo — only
into the hosted page.

1. Go to **sites.google.com** → **Blank site**. Name it neutrally (e.g. "Memory Match privacy").
2. Copy the text of `docs/PRIVACY_POLICY.md` (without the comment at the top) into the page.
3. Replace `[PUBLISHER NAME]` with your name (or developer name), `[CONTACT EMAIL]` with the
   email from A4, and `[DATE]` with today's date.
4. **Publish** → copy the link (it looks like `https://sites.google.com/view/...`). Send it to Claude.
5. 🤖 Claude adds the link to the app's Settings → Privacy screen (a link is fine to commit;
   just make sure the site address itself doesn't contain your name).

**A6 · 👤 Collect testers' emails** — see section 7. Aim for **15–20 people**.

**A7 · 👤 Apply the small database fix.** Claude found that Supabase's default settings give
the app's public roles more table rights than the design intends (no data is exposed — the
security rules still block it — but we want the extra lock). Open Supabase → **SQL Editor** →
New query → paste `supabase/migrations/20261117000005_harden_table_grants.sql` → **Run**.
Tell Claude; Claude re-checks it (read-only).

**A8 · 👤 + 🤖 Move builds to EAS** (needed for the store file anyway) — see section 10.

**A9 · 🤖 Already prepared (nothing for you to do):**

| Store item                        | Where                                                                            |
| --------------------------------- | -------------------------------------------------------------------------------- |
| Store texts (title, short + full) | `docs/STORE_LISTING.md`                                                          |
| App icon, feature graphic         | `docs/store/play-icon-512.png`, `docs/store/feature-graphic.png`                 |
| 6 phone screenshots with captions | `docs/store/screenshots/phone-1.png` … `phone-6.png`                             |
| Data safety answers               | `docs/DATA_SAFETY.md`                                                            |
| Content rating questionnaire      | `docs/DATA_SAFETY.md` → "Content rating questionnaire"                           |
| Production build settings         | `eas.json` (AAB, automatic version numbers, draft uploads)                       |
| Android requirements              | Checked on the real build: targets Android 16 (API 36) ✅, 16 KB memory pages ✅ |

Still to come: 2 screenshots of a **photo board** taken on your phone (see
`docs/STORE_LISTING.md`), and the final name/package (A3).

---

## 5. Phase B — the day your account is approved (~Dec 8)

Set aside 1–2 hours. Do the steps in this order. 🤖 Claude builds the AAB file meanwhile.

**B1 · Create the app.** Play Console → **Create app**:
App name · Default language **English (United States)** · **Game** · **Free** (⚠️ a free app
can never become paid — fine for us) · tick the declarations → **Create app**.

**B2 · App content** (left menu → **Policy** → **App content**; answer each card):

| Card                                   | Answer                                                                                                                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Privacy policy                         | The Google Sites link from A5                                                                                                                                            |
| App access                             | **All functionality is available without special access** (no login)                                                                                                     |
| Ads                                    | **No, my app does not contain ads**                                                                                                                                      |
| Content rating                         | Fill in the questionnaire exactly as in `docs/DATA_SAFETY.md`                                                                                                            |
| Target audience                        | Tick the age groups incl. children (e.g. 5 and under → 18+). Appeals to children: **Yes**. This puts the app under Google's **Families** rules — we already follow them. |
| Data safety                            | Exactly as in `docs/DATA_SAFETY.md`                                                                                                                                      |
| Government / financial / health / news | **No** for each                                                                                                                                                          |

**B3 · Store listing** (left menu → **Grow users** → **Store presence** → **Main store
listing**): paste the texts from `docs/STORE_LISTING.md`, upload the icon, feature graphic
and screenshots in the listed order. **Store settings:** category **Game → Board** (or
**Puzzle**), contact email from A4.

**B4 · Closed test.** Left menu → **Test and release** → **Testing** → **Closed testing** →
the default track (often called "Alpha") → **Manage track**:

1. **Countries/regions**: add every country where your testers live (e.g. Israel + others).
2. **Testers** tab → **Create email list** → name it "Family" → paste the testers' Gmail
   addresses (comma-separated) → Save. Also fill in the **feedback** email/URL.
3. **Releases** → **Create new release** → upload the **AAB** from Claude → release name and
   notes are suggested by Claude → **Next** → **Save**.
4. Left menu → **Publishing overview** → **Send changes for review**.

**B5 · Wait for the review** (often 1–3 days for a first release; can be longer). When it's
approved, the **Testers** tab shows the **opt-in link** (looks like
`https://play.google.com/apps/testing/com.your.package`). Send it to all testers right away
(message in section 7).

---

## 6. Phase C — the 14-day closed test (~Dec 11 → ~Dec 25)

### The rule

For personal developer accounts created after **November 13, 2023**, Google requires:
**at least 12 testers opted in to a closed test, continuously, for the 14 days before you
apply for production access.** Until then, the **Production** button stays locked.
(The number was 20 until December 2024; it is now 12.)

### How testers join

1. You put their Gmail address on the tester list (B4).
2. They open the **opt-in link** while signed in with **that same Gmail**, and tap
   **Become a tester**. ← _This_ moment counts as "opted in", not the invitation.
3. They tap **Download it on Google Play** and install the app like any other app.
4. Updates arrive automatically through Google Play.

### What counts

- Only the **closed** test counts. Internal testing and open testing **don't**.
- A tester counts from the day they opt in, as long as they **stay** opted in.
- Day 14 is counted from when you had **12 testers opted in at the same time**.
- Google also looks at **engagement**: in the application form it asks how testers used the
  app and what feedback you got. Testers who install and play a few times make a stronger case.
- Uploading **new versions** during the test is fine (and shows Google you act on feedback);
  as far as Google's rules describe, it doesn't restart the 14 days.

### Common mistakes that reset or break the 14 days

| Mistake                                                                             | How we avoid it                                                           |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| A tester taps **"Leave the program"** — if you drop below 12, the count starts over | Recruit **15–20**, not exactly 12; tell testers not to leave              |
| A tester opts in with a **different Google account** than the one on the list       | Ask for the Gmail **used in the Play Store on their phone**               |
| Counting from the **invitation** instead of the opt-in                              | Send the link the moment it's live; check the tester count in the Console |
| Removing people / replacing the email list in the middle                            | Only **add** testers during the 14 days                                   |
| Using **internal** or **open** testing                                              | Use **Closed testing** only                                               |
| Pausing or deleting the closed-test track                                           | Leave it running until production is live                                 |
| Tester's **country** not selected                                                   | Add all testers' countries in B4                                          |
| Testers with **iPhones**                                                            | Android only — iPhone owners can't take part                              |

**What if Google says "not yet"?** If the production-access application is declined, Google
usually asks you to keep testing (often another 14 days) and reapply. Keep the testers
opted in until the game is live.

### During the test

- 👤 Forward every piece of feedback to Claude (WhatsApp screenshots are fine).
- 🤖 Claude fixes, builds and uploads improvements, and keeps a short log of "feedback →
  change" — that log becomes your answers in Phase D.
- 👤 Open the Play Console every few days: **Closed testing → Testers** shows how many
  people have opted in.

---

## 7. Finding 12+ testers and what to send them

**Who:** family and friends with an **Android** phone and a Google account (Gmail). Aim for
**15–20** so one or two dropping out doesn't matter. Teenagers in the family count too (they
need their own Google account on their own phone).

**Message 1 — asking (send now):**

> Hi! I made a memory game for families 🃏 and I'll publish it on Google Play soon. Google
> requires 12 people to test it for 2 weeks first — could you help? You need an Android
> phone. Just send me the Gmail address you use for the Play Store on your phone. It's free,
> no ads, and takes 2 minutes to join. Thank you! ❤️

> היי! בניתי משחק זיכרון למשפחות 🃏 ובקרוב אעלה אותו ל-Google Play. גוגל דורשת ש-12
> אנשים יבדקו אותו במשך שבועיים לפני הפרסום — תוכל/י לעזור? צריך טלפון אנדרואיד. פשוט
> שלח/י לי את כתובת ה-Gmail שמחוברת ל-Play Store בטלפון שלך. זה חינם, בלי פרסומות,
> ולוקח 2 דקות להצטרף. תודה! ❤️

**Message 2 — joining (send the day the opt-in link works):**

> Thanks for helping! 🙏 How to join (2 minutes):
>
> 1. On your Android phone, open this link (signed in with the Gmail you sent me):
>    [OPT-IN LINK]
> 2. Tap **"Become a tester"**.
> 3. Tap **"Download it on Google Play"** and install the game.
> 4. Play a few times over the next 2 weeks — Solo, 2 players, a board with your own
>    photos, and an online game with me!
>
> Important: please **don't tap "Leave the program"** (that restarts the 2-week count for
> everyone 😅) and keep the game installed until **[END DATE]**.
> Found a bug or have an idea? Just reply here.

> תודה שעזרת! 🙏 ככה מצטרפים (2 דקות):
>
> 1. בטלפון האנדרואיד, פתח/י את הקישור הזה (מחובר/ת עם ה-Gmail ששלחת לי):
>    [OPT-IN LINK]
> 2. לחץ/י על **"Become a tester"**.
> 3. לחץ/י על **"Download it on Google Play"** והתקן/י את המשחק.
> 4. שחק/י כמה פעמים בשבועיים הקרובים — סולו, 2 שחקנים, לוח עם תמונות שלך, ומשחק
>    אונליין איתי!
>
> חשוב: בבקשה **לא ללחוץ על "Leave the program"** (זה מאפס את ספירת השבועיים לכולם 😅)
> ולהשאיר את המשחק מותקן עד **[END DATE]**.
> מצאת באג או יש רעיון? פשוט תענה/י כאן.

**Message 3 — halfway reminder (~day 7):**

> Halfway there! 🎉 Thanks for testing. If you have 2 minutes, play one more game — and
> tell me one thing you liked and one thing to improve.

---

## 8. Phase D — apply for production access (~Dec 26)

1. 👤 Play Console → **Dashboard** → **Apply for production** (appears once the 14 days are met).
2. The form has three parts: **about your closed test** (how you found testers, how they
   used the app, what feedback you got and what you changed), **about your app** (who it's
   for, what makes it useful), and **production readiness** (why you're confident it's ready).
3. 🤖 Claude drafts all answers from the feedback log — you review and paste them.
4. Google usually answers **within 7 days** (maybe longer around Christmas/New Year).

---

## 9. Phase E — going live (~early January)

1. 👤 **Test and release → Production → Create new release** → **Add from library** →
   pick the last closed-test build (🤖 Claude tells you which) → release notes → **Next**.
2. **Countries/regions**: choose where the game is available (all countries is fine; Claude
   can translate the store text later).
3. **Publishing overview → Send changes for review.** Usually hours to a few days.
4. 🎉 When approved, the store page goes live: `https://play.google.com/store/apps/details?id=<package>`.
5. Afterwards: 👤 keep an eye on **Ratings and reviews**, 🤖 Claude watches crash reports
   (**Android vitals**) and ships fixes — small fixes arrive instantly as over-the-air updates
   (no review), bigger ones as new store versions.

---

## 10. Making the repository private again — what changes and how we build

### What happens when you switch to private

| Thing                                     | Public (now)        | Private                                                                                                                                              |
| ----------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub Actions minutes                    | Unlimited, free     | Comes out of your free monthly allowance (GitHub Free: about 2,000 Linux minutes/month — check GitHub → Settings → Billing). One APK build ≈ 22 min. |
| If there's a billing problem              | No effect           | **Every job fails within ~2 seconds** — exactly what happened before you made the repo public                                                        |
| Test-APK download links (GitHub Releases) | Anyone can download | **Only you** (signed in). Family testers would get "404 Not Found"                                                                                   |
| The app itself, Supabase, your phone      | —                   | No change                                                                                                                                            |

So we **won't depend on GitHub Actions** for anything important once the repo is private.

### How we'll build instead: EAS (Expo's build service)

- Builds run on **Expo's computers**, not GitHub's — GitHub billing can't block them.
- **Free plan:** 15 Android builds per month, in a lower-priority queue (a build can wait an
  hour or more at busy times). The free plan can't charge you anything.
- **Store builds (AAB):** EAS creates and safely stores the app's **upload key**, which
  Google needs on every future update. 👤 You'll download one backup copy and keep it in a
  safe place (never in the repo).
- **Test builds (APK):** EAS gives each build an **install page link** that works for anyone
  with the link — no GitHub account needed. Once the closed test runs, testers simply get
  updates through Google Play.

### Order of steps (so nothing breaks)

1. 👤 Create a free account at **expo.dev**. Pick a username **without your real name** —
   it appears in the project settings.
2. 👤 expo.dev → **Account settings → Access tokens → Create token**. When Claude shows a
   **secure credential form**, paste it there (never in the chat, never in the repo). This
   also lets Claude's cloud session reach Expo's servers.
3. 🤖 Claude links the project (`eas init`), turns on over-the-air updates, and makes one test
   APK and one store AAB on EAS — and checks both.
4. 👤 Make the repo private: GitHub → repository → **Settings → General → Danger Zone →
   Change visibility → Private**.
5. 🤖 Claude checks that everything still works and updates the docs. The old GitHub APK
   workflow stays as a backup.

**Good to know:** the scheduled "Supabase keep-alive" job (section 11) uses about 1 minute of
GitHub time per run (~10 minutes a month). If GitHub Actions stops after going private,
players' activity will usually keep the database awake anyway; otherwise switch the
keep-alive to another scheduler or move Supabase to a paid plan.

---

## 11. Other things worth knowing

- **Supabase free plan pauses idle projects.** If the database gets too little activity in a
  week, Supabase pauses it and online play stops until someone presses "Restore". A small
  scheduled job (`.github/workflows/supabase-keepalive.yml`) now makes one read-only request
  every 3 days. Paid Supabase plans ($25/month) never pause — only needed if the game grows.
- **Personal account visibility:** Google shows your **developer name** and **contact email**
  publicly. That's why A4 suggests a separate email.
- **Families rules:** because children are in the target audience, Google checks the app
  against its Families policy: no ads, no tracking, a privacy policy, honest Data safety
  answers. We already comply.
- **Costs:** Google Play $25 once (paid) · Expo free · Supabase free · GitHub free.
- **iPhone version:** not part of this plan (needs an Apple Developer account, $99/year).

---

## 12. Personal account vs. organization account

You're registering a **personal** account. Here's what would change with an **organization**
account:

|                               | Personal (your choice)               | Organization                                                                                                 |
| ----------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Who can register              | Any adult                            | A registered organization or business                                                                        |
| Extra paperwork               | ID verification, Android phone check | A **D-U-N-S number** (free from Dun & Bradstreet, can take **up to 30 days**) plus organization verification |
| **12 testers × 14 days rule** | **Yes**                              | **No** — production can be requested right away                                                              |
| Shown publicly                | Developer name, contact email        | Organization name and contact details                                                                        |
| Cost                          | $25                                  | $25                                                                                                          |

**Recommendation: stay personal.** Getting a D-U-N-S number takes about as long as the closed
test it would skip, needs a registered business, and your account is already in progress.
An existing personal account can't simply be switched to an organization one — that would
mean a new registration — but apps can later be **transferred** to another developer
account if you ever form a company.

---

## 13. Checklist

**Before the account is approved**

- [ ] 👤 Device verification in the Play Console app (when asked)
- [ ] 👤 Final app name + package ID → Claude (by Dec 1)
- [ ] 👤 Public contact email created
- [ ] 👤 Privacy policy hosted on Google Sites, link → Claude
- [ ] 👤 15–20 tester Gmail addresses collected
- [ ] 👤 Expo account + token (secure form) · 🤖 first EAS builds
- [ ] 👤 Migration 05 pasted in the Supabase SQL Editor · 🤖 re-verified
- [ ] 👤 2 photo-board screenshots → Claude · 🤖 framed
- [ ] 👤 Repo made private (after EAS works) · 🤖 checked

**Approval day** — B1 → B5 above. **Testing** — 14 days, ≥ 12 opted in. **Apply** — Phase D.
**Live** — Phase E.
