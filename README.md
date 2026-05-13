# The Bench Vimeo Transcript Archive

This app is now intentionally focused on one reliable workflow: authenticated Vimeo archive ingest, local SQLite/Prisma storage, and transcript search.

## What was removed or bypassed

The old public URL and multi-source experiment has been removed from the running app path. The server now mounts only the Vimeo archive routes, and the UI no longer exposes public scraping, source management, social handles, trend discovery, or analysis tabs. Package dependencies for cron-driven public archive scraping and `yt-dlp` were also removed.

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment template:

   ```bash
   cp .env.example .env
   ```

3. Edit `.env` and set:

   ```bash
   DATABASE_URL="file:./dev.db"
   VIMEO_ACCESS_TOKEN="your-token-goes-here"
   VIMEO_USER_ID="optional-vimeo-user-id"
   VIMEO_ACCOUNT_URI="optional-account-uri-like-/users/123456"
   VIMEO_SYNC_ON_START=false
   VIMEO_SYNC_LIMIT=
   VIMEO_FORCE_REFRESH=false
   ```

   Use either `VIMEO_ACCOUNT_URI`, `VIMEO_USER_ID`, or neither. If both account values are empty, the app syncs `/me/videos` for the authenticated token.

4. Prepare Prisma/SQLite:

   ```bash
   npm run prisma:sync
   ```

5. Start the local app:

   ```bash
   npm run dev
   ```

6. Open the Vite URL shown in your terminal, then click **Sync Vimeo Archive**.

## Vimeo token setup

Create a personal access token in Vimeo developer settings for the account that can access The Bench archive. Grant read access for videos and text tracks/captions. Store the token only in your local `.env` as `VIMEO_ACCESS_TOKEN`. Do not paste the token into source code, docs, screenshots, logs, or commits.

The app never logs the full token. If sync fails with a Vimeo authorization error, verify that the token belongs to the correct account and has permission to read the archive videos and their text tracks.

## Test steps

```bash
npm run prisma:sync
npm run build
npm run start
curl http://localhost:8787/api/health
```

Without a token, `POST /api/vimeo/sync` should return a clear `VIMEO_ACCESS_TOKEN is required` error. With a valid token, clicking **Sync Vimeo Archive** or posting to `/api/vimeo/sync` ingests Vimeo metadata and captions idempotently.
