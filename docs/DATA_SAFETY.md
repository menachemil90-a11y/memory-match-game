# Google Play — App content answers (draft)

These answers match the current code. Re-check them whenever online features change.

## Data safety form

**Does your app collect or share any of the required user data types?** → **Yes**
(only when the player uses **Play Online**; everything else stays on the device).

**Is all of the user data collected by your app encrypted in transit?** → **Yes** (HTTPS/WSS to Supabase).

**Do you provide a way for users to request that their data is deleted?** → **Yes** —
online game data is deleted automatically (rooms within hours, anonymous IDs after
30 days of inactivity); players can also ask by email (address in the privacy policy).

| Data type (Play category)                                           | Collected? | Shared? | Why               | Optional?                       | Notes                                                                                                                                                                          |
| ------------------------------------------------------------------- | ---------- | ------- | ----------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Personal info → **Name**                                            | Yes        | No      | App functionality | Optional (only for online play) | The **nickname** a player types (no real name needed). Filtered for bad words.                                                                                                 |
| App info and performance → none                                     | No         | —       | —                 | —                               | No analytics or crash SDKs.                                                                                                                                                    |
| **App activity → Other user-generated content / In-app actions**    | Yes        | No      | App functionality | Optional (online only)          | Moves in an online game (which card was flipped). Deleted with the room.                                                                                                       |
| **Device or other IDs**                                             | Yes        | No      | App functionality | Optional (online only)          | Random anonymous ID created by Supabase Auth for this install (like a Firebase installation ID) so the server knows which seat is yours. Not linked to a name, email or phone. |
| Photos and videos                                                   | **No**     | —       | —                 | —                               | Custom-board photos are processed and stored **only on the device** and never uploaded. Google counts data as "collected" only when it leaves the device.                      |
| Location, contacts, messages, audio, financial, health, web history | No         | —       | —                 | —                               | —                                                                                                                                                                              |

"Shared" means transferred to a third party. Supabase acts as our **service
provider** (processor), which Google does not count as sharing.

## Other App content declarations

| Question                                       | Answer                                                                                                                                                                                                                                                                                                                        |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ads                                            | **No ads**                                                                                                                                                                                                                                                                                                                    |
| In-app purchases                               | None (v1)                                                                                                                                                                                                                                                                                                                     |
| Target audience                                | Choose age groups incl. children (e.g. 5 & under, 6–8, 9–12, 13–15, 16–17, 18+). This puts the app under the **Families policy**.                                                                                                                                                                                             |
| Appeal to children                             | Yes                                                                                                                                                                                                                                                                                                                           |
| Families policy                                | No ads/ad SDKs, no tracking, no location, no broad media permissions (system photo picker), no free-text chat ✅                                                                                                                                                                                                              |
| Teacher Approved                               | Optional, can apply later                                                                                                                                                                                                                                                                                                     |
| Account creation / account deletion URL        | No user accounts (online play uses an anonymous ID).                                                                                                                                                                                                                                                                          |
| Content rating (IARC questionnaire)            | See **Content rating questionnaire** below → expected **PEGI 3 / ESRB Everyone / USK 0**, with the interactive element "Users Interact" (online play)                                                                                                                                                                         |
| Permissions                                    | Verified in the built APK (build 10): `CAMERA` (only when tapping "Take a photo"), `INTERNET`, `ACCESS_NETWORK_STATE`, `VIBRATE`, `WAKE_LOCK`, `MODIFY_AUDIO_SETTINGS`. Broad photo/media permissions, microphone and the Play install-referrer service (pulled in by `expo-application`, unused) are explicitly **blocked**. |
| News / COVID / Government / Financial / Health | No                                                                                                                                                                                                                                                                                                                            |
| Privacy policy URL                             | **Required** — host `docs/PRIVACY_POLICY.md` and paste the URL (also set `PRIVACY_POLICY_URL` in `src/lib/appInfo.ts`).                                                                                                                                                                                                       |

## Content rating questionnaire (IARC)

Play Console → Policy → App content → **Content rating** → Start questionnaire.
Enter the contact email you'll use for the store listing.

| Question (wording may differ slightly)                                                     | Answer   | Why                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Category                                                                                   | **Game** | It's a game (not reference/news/social).                                                                                                                                   |
| Violence, blood, gore                                                                      | **No**   | Only picture cards (animals, fruit, vehicles…).                                                                                                                            |
| Fear / horror                                                                              | **No**   |                                                                                                                                                                            |
| Sexuality or nudity                                                                        | **No**   |                                                                                                                                                                            |
| Bad language / crude humour                                                                | **No**   | No user text is shown except filtered nicknames.                                                                                                                           |
| Drugs, alcohol, tobacco                                                                    | **No**   | (Yummy Food board has no drinks with alcohol.)                                                                                                                             |
| Gambling, simulated gambling, real-money betting                                           | **No**   | Matching pairs isn't gambling; no loot boxes.                                                                                                                              |
| Hate symbols / discrimination                                                              | **No**   | Nickname filter also blocks hate words.                                                                                                                                    |
| **Can users interact or exchange information** (chat, messages, sharing with other users)? | **Yes**  | In online play the other player sees your nickname, avatar and moves. Answer honestly: there is **no chat**, no free text besides the filtered nickname, no photo sharing. |
| Does the app share the user's **location** with other users?                               | **No**   |                                                                                                                                                                            |
| Can users **buy digital goods**?                                                           | **No**   | No in-app purchases.                                                                                                                                                       |
| Unrestricted internet / web browser                                                        | **No**   |                                                                                                                                                                            |
| Is the app a social / communication app?                                                   | **No**   |                                                                                                                                                                            |

**Expected result:** PEGI 3, ESRB Everyone, USK 0 (and the equivalents elsewhere), plus
the interactive element **"Users Interact"**. The rating certificate arrives by email;
nothing to upload. Re-do the questionnaire if you ever add chat, ads or purchases.
