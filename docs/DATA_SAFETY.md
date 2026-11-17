# Google Play — App content answers (draft)

These answers match the current code. Re-check them whenever online features change.

## Data safety form

**Does your app collect or share any of the required user data types?** → **Yes**
(only when the player uses **Play Online**; everything else stays on the device).

**Is all of the user data collected by your app encrypted in transit?** → **Yes** (HTTPS/WSS to Supabase).

**Do you provide a way for users to request that their data is deleted?** → **Yes** —
online game data is deleted automatically (rooms within hours, anonymous IDs after
30 days of inactivity); players can also ask by email (address in the privacy policy).

| Data type (Play category)                                           | Collected? | Shared? | Why               | Optional?                       | Notes                                                                                                                                                     |
| ------------------------------------------------------------------- | ---------- | ------- | ----------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Personal info → **Name**                                            | Yes        | No      | App functionality | Optional (only for online play) | The **nickname** a player types (no real name needed). Filtered for bad words.                                                                            |
| App info and performance → none                                     | No         | —       | —                 | —                               | No analytics or crash SDKs.                                                                                                                               |
| **App activity → Other user-generated content / In-app actions**    | Yes        | No      | App functionality | Optional (online only)          | Moves in an online game (which card was flipped). Deleted with the room.                                                                                  |
| **Device or other IDs**                                             | Yes        | No      | App functionality | Optional (online only)          | Random anonymous ID created by Supabase Auth so the server knows which seat is yours.                                                                     |
| Photos and videos                                                   | **No**     | —       | —                 | —                               | Custom-board photos are processed and stored **only on the device** and never uploaded. Google counts data as "collected" only when it leaves the device. |
| Location, contacts, messages, audio, financial, health, web history | No         | —       | —                 | —                               | —                                                                                                                                                         |

"Shared" means transferred to a third party. Supabase acts as our **service
provider** (processor), which Google does not count as sharing.

## Other App content declarations

| Question                                       | Answer                                                                                                                                                                              |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ads                                            | **No ads**                                                                                                                                                                          |
| In-app purchases                               | None (v1)                                                                                                                                                                           |
| Target audience                                | Choose age groups incl. children (e.g. 5 & under, 6–8, 9–12, 13–15, 16–17, 18+). This puts the app under the **Families policy**.                                                   |
| Appeal to children                             | Yes                                                                                                                                                                                 |
| Families policy                                | No ads/ad SDKs, no tracking, no location, no broad media permissions (system photo picker), no free-text chat ✅                                                                    |
| Teacher Approved                               | Optional, can apply later                                                                                                                                                           |
| Account creation / account deletion URL        | No user accounts (online play uses an anonymous ID).                                                                                                                                |
| Content rating (IARC questionnaire)            | Puzzle/board game, no violence, no user communication (no chat — nicknames are filtered), no data sharing → expected rating **Everyone / PEGI 3**                                   |
| Permissions                                    | `CAMERA` (take a photo for a custom board, asked only when tapping "Take a photo"), `INTERNET`, `VIBRATE`. Broad photo/media permissions and microphone are explicitly **blocked**. |
| News / COVID / Government / Financial / Health | No                                                                                                                                                                                  |
| Privacy policy URL                             | **Required** — host `docs/PRIVACY_POLICY.md` and paste the URL (also set `PRIVACY_POLICY_URL` in `src/lib/appInfo.ts`).                                                             |
