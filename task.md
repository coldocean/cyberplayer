# MEGA BUILD TASK

## Architecture
- **Frontend**: Static `index.html` with inline JS/CSS (3022 lines)
- **Backend**: Vercel serverless functions in `/api/` directory
  - `_db.js` — Turso HTTP helper
  - `coins.js`, `ban.js`, `spin.js` — existing endpoints
  - `[[...route]].ts` — catch-all routing to Hono app (better-auth + tracks CRUD)
- **DB**: Turso (libsql) — tables: bans, coins, attempts
- **Deploy**: Vercel static + serverless, `dist-static/` as output

## What to Build

### 1. Radio in Playlist Dropdown
- Add RADIO 📻 as a collapsible section inside each mode's playlist area
- Shows all genres/stations inline within the playlist panel

### 2. Track Name & Duration Display
- Show current track name and elapsed time in the player UI
- Use audio element's metadata for duration when available

### 3. RECORD Feature
- Server-side recording to S3
- New API endpoint: `/api/record` — start/stop recording
- Records radio stream or current mix for up to 2hrs
- Saves to S3, creates track entry

### 4. User Registration & Auth
- Use better-auth (already configured) with Turso
- New tables: user, session, account, verification (better-auth schema)
- Resend for email verification & password reset
- Migrate 3 admins to DB with hashed passwords
- Non-registered users see "Jesus thumbs down" crying — must register
- Frontend: registration/login forms in the player

### 5. Jesus Animation (New)
- Keep existing coin-to-Jesus animation
- ADD: Jesus rises from bottom of screen with thumbs up on play/stop/next
- Deducts 1 coin per action
- Shows coin flying up to sky

### 6. Mode 5: Voting (NEW label)
- Custom voting in Turso
- New table: `votes` (track_id, user_id, vote, created_at)
- All uploaded songs go to voting
- Users vote to keep/remove tracks
- deemaah (superadmin) can override — always add/delete
- rastix/robbmobb are limited admins

### 7. Role System
- superadmin (deemaah): full control, add/delete anything
- admin (rastix, robbmobb): limited powers (manage own playlists)
- registered user: can vote, play with coins
- guest: sees Jesus crying, must register

## Execution Order
1. Create DB tables (users, votes, recordings)
2. Create API endpoints (auth, register, vote, record)
3. Update index.html (radio in playlist, track info, record UI, voting mode, auth UI, Jesus animations)
4. Copy to all targets, deploy
