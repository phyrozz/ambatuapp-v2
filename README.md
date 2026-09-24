# AmbatuApp · Revamp

A complete web and mobile rebuild of the Flutter app in `../legacy`, using Next.js App Router, React, TypeScript, and Capacitor. The new visual identity uses warm cream, orange, custom arcade illustrations, bundled Kanit type, and the original character artwork.

## Run locally

Requires Node.js 22 or newer (developed with Node 24).

```sh
npm ci
npm run dev
```

Open **http://localhost:3000**. For a production preview:

```sh
npm run build
npm start
```

Next.js exports the entire application to `out/`. Deploy that directory to a static host, or package it with Capacitor. No Next.js server is needed at runtime. Every character and game route is generated at build time; configure your host to serve directory `index.html` files.

## Features

### Chat

Set `NEXT_PUBLIC_CHAT_WS_URL` to the deployed `wss://` endpoint printed by `chat-service/deploy.ps1`, then rebuild the static app. In the Cognito player app client, allow the `aws.cognito.signin.user.admin` OAuth scope alongside `openid` and `email`; chat uses this scope to validate the access token with Cognito. Existing sessions must sign in again to gain the new scope. Chat uses the admin public API at `NEXT_PUBLIC_CHARACTER_API_URL` for username search. The chat page supports direct messages, groups, text, uploaded images and videos up to 5 MB, Giphy/Tenor media links, and reports. Uploader and signed-in commenter names in AmbatuWatch, plus commenter names in lore, open direct chats. Editorial lore entries have no player author.

Players can share a direct chat link and QR code from their profile. Groups can generate seven-day invite links from Manage members; visitors sign in and explicitly accept before joining. Share URLs use the current website origin in browsers and `https://www.ambatu.fun` in the native app. Set `NEXT_PUBLIC_SHARE_BASE_URL` when the public site uses another origin, then rebuild.

Chat resolves participant names from the player profiles API (`POST /api/public/players/names`) when conversations load and every 30 seconds while the chat page is visible. This keeps direct-message titles, group member lists, and message names current after a player changes their MyDreamy username. Deploy the admin API and revamp together for this behavior.

See [chat-service/README.md](../chat-service/README.md) for deployment and admin report setup.

- **Discover:** redesigned home, responsive sidebar/bottom navigation, quick access to sounds, characters, and games.
- **Soundboard:** all 26 original clips, text search, categories, up to ten simultaneous sounds, stop-all, volume, and persistent favorites. Playback stops when the app goes into the background.
- **Characters:** all 13 original entries, artwork, available archive copy, and original profile links. The legacy fictional biographies are explicitly marked as community meme lore. Previously unfinished entries use a collection description rather than an empty construction page.
- **AmbatuTap:** click/touch/keyboard input, one-second combos, and saved best score.
- **AmbatuSnake:** increasing speed, keyboard/swipe/direction controls, pause/resume, collision detection, and saved best score.
- **Ambatublou:** 8×8/10×10/12×12 boards with 10/20/30 mines, safe first move, flood reveal, mouse/touch flags, win/loss states, and saved best safe-tile count.
- **Flappy Bus:** four original characters, tap/Space controls, collision/scoring, pause/resume, and saved best score.
- **AmbatuWatch:** YouTube discovery/search by default; optional live video feed with loading, empty, retry, and error states.
- **MyDreamy:** local activity and game scores, optional Supabase email/password signup/login/logout, optional live Dreamy profile stats.
- **Native:** Android back handling, native external video browsing, light haptics, safe-area layouts, branded icons and splash artwork.

## Optional services

Copy `.env.example` to `.env.local` and supply your own values. Everything except account access and live feeds works without services. Public variables are embedded during the build; rebuild and synchronize after changing them.

### Supabase

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-or-publishable-key
```

Google-only sign-in uses a Cognito User Pool managed-login domain. Set `NEXT_PUBLIC_COGNITO_DOMAIN`, `NEXT_PUBLIC_COGNITO_CLIENT_ID`, and `NEXT_PUBLIC_COGNITO_CALLBACK_URL` (for example, `https://ambatu.fun/auth/callback/`). In the Cognito app client, enable Google, the OAuth authorization-code flow, and the `openid`, `email`, and `aws.cognito.signin.user.admin` scopes, then add that same callback URL. The app client must not have a client secret because this static browser app uses PKCE.

Google sessions are renewed in the browser with Cognito refresh tokens. Configure the player app client's refresh-token validity to the desired persistent-login period (Cognito supports up to 10 years) and enable token revocation. Refresh-token rotation is recommended; the app saves the replacement token returned by Cognito. Signing out revokes the stored refresh token and clears the browser session. As with any static web app, persistent browser tokens require strong XSS protections.

Favorites, volume, play counts, and game scores are local to this browser or app installation, including for signed-in users. They are **not cloud-synced**. There is no database migration or score table requirement. Flutter SharedPreferences are not imported automatically.

### Leaderboards

The browser never writes leaderboard data directly to Firestore. The existing admin public API serves `GET` and Cognito-verified `POST` requests at `/api/public/leaderboards/{gameId}`. It shares `NEXT_PUBLIC_CHARACTER_API_URL`, so point that variable at the deployed admin API origin and deploy the admin project after adding the leaderboard route. Configure that API with the revamp player pool's server-only `COGNITO_PLAYER_USER_POOL_ID` and `COGNITO_PLAYER_CLIENT_ID`; do not reuse the admin console's Cognito variables. The API stores one best score per player per game without exposing email addresses.

### Firebase Firestore characters

Create a `.env.local` with the Firebase **Web app** configuration values shown in `.env.example`, then rebuild the app. The Characters screens read the `characters` collection directly from Firestore; the document ID is the URL slug, such as `dreamy` for `/characters/dreamy/`.

Each document requires `name` and can include the following optional fields:

```json
{
  "name": "DreamybullXXX",
  "description": ["First biography paragraph.", "Second biography paragraph."],
  "image": "/assets/dreamy.jpg",
  "header": "/assets/dreamybull_header.jpg",
  "links": ["https://example.com/original-profile"],
  "soundIds": ["ambatukam", "ambasing"]
}
```

`description` may alternatively be a single string. Image and header values may be bundled `/assets/...` paths or HTTPS URLs. Ensure your Firestore security rules allow public reads of this collection (and restrict writes to trusted administrators); Firebase configuration values are public identifiers, not credentials.

### Live feeds

Provide public **HTTPS** JSON endpoints that allow cross-origin requests from your web deployment, Android's `https://localhost`, and iOS's `capacitor://localhost`. Put any authenticated scraper calls behind your own server. These URLs must not contain secret API tokens.

`NEXT_PUBLIC_VIDEO_FEED_URL` returns an array:

```json
[
  {
    "title": "A community clip",
    "url": "https://www.youtube.com/watch?v=VIDEO_ID",
    "thumbnail": "https://i.ytimg.com/vi/VIDEO_ID/hqdefault.jpg",
    "channel": "Channel name"
  }
]
```

The legacy `thumbnailUrl` and `channelName` fields are also supported. Invalid or non-HTTPS video links are discarded.

`NEXT_PUBLIC_PROFILE_FEED_URL` returns an object (or an array with one object):

```json
{
  "name": "Dreamybull",
  "handle": "dreamybullxxx",
  "bio": "Profile description",
  "followers": 0,
  "following": 0,
  "image": "https://example.com/avatar.jpg"
}
```

Legacy `username`, `handleName`, `description`, `followersCount`, `friendsCount`, and `profileImage` fields are accepted. No scraped statistics or video popularity numbers are fabricated when a feed is missing.

**Migration note:** the legacy Dart sources contain a hardcoded scraper API token. It was not copied into the revamp. Revoke/rotate it with its provider if it is still active.

## Android and iOS

Both native projects are already included. Capacitor uses `out/` as its `webDir`, with the legacy package ID `com.example.ambatuapp` retained. Confirm your production application identifier and signing credentials before distributing an update.

```sh
npm run cap:sync
npm run cap:android
# On macOS:
npm run cap:ios
```

- Android: install Android Studio, JDK 21+, and the Android SDK required by the checked-in Gradle configuration (compile/target SDK 36). Open `android/`, let Gradle sync, then run on a device or generate an APK/AAB.
- iOS: open `ios/App/App.xcodeproj` on macOS with a Capacitor 8 compatible Xcode toolchain. Resolve the included Swift packages, select your signing team, and run/archive.
- The native bundle includes fonts, images, audio, game logic, and character pages, so these work offline. Browser offline caching/service-worker support is not included. Live feeds, video links, and account operations need internet access.
- Run `npm run native:artwork` to regenerate the checked-in native icon and splash assets from the repository SVG artwork.

Native project generation and Capacitor sync were verified on Windows. An APK/IPA was not compiled or tested on a physical device in this environment (only Java 8 and no Android SDK were available; iOS builds require macOS).

## Verification

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run format:check
```

The browser suite uses installed Microsoft Edge by default, with desktop and mobile viewport/touch emulation. For CI or another OS, install Chromium (`npx playwright install chromium`) and run with `PLAYWRIGHT_CHANNEL=chromium`.

Tests cover game rules (including first-move safety, flood reveal, collisions, and full boards), feed validation, exported routes, audio controls, favorites persistence, game interactions, and responsive overflow. Mobile browser emulation does not replace physical iOS/Android testing. Live Supabase and external feeds need your configuration for end-to-end service validation.

## Project map

```text
src/app/                  Static routes and global styles
src/components/           Navigation, libraries, game players, account and feeds
src/lib/                  Catalog, pure game rules, service adapters, native helpers
src/data/legacy.json       Migrated character and sound metadata
public/assets/            Bundled original images and audio
public/fonts/             Bundled original Kanit fonts
android/ + ios/           Capacitor native projects
scripts/                 Content migration and native artwork generation
tests/ + e2e/            Unit and browser tests
```

`scripts/migrate-content.mjs` can regenerate the checked-in content catalog from the sibling legacy folder. The app itself has no runtime or build dependency on that folder. Original assets remain subject to their original ownership and licensing.

Legacy ad SDK integration is not included in this rebuild. There are no ad credentials, scraper credentials, or fabricated live services. The `xcode → uuid` dependency override selects the patched CommonJS-compatible UUID release; Capacitor's Xcode integration uses its compatible `v4` API.

Architecture follows the official [Next.js static export guide](https://nextjs.org/docs/app/guides/static-exports) and [Capacitor installation workflow](https://capacitorjs.com/docs/getting-started).
