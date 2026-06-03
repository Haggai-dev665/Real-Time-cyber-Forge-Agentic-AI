# CyberForge Mobile

Expo + React Native (TypeScript) mobile client for the CyberForge agentic
cybersecurity platform. It mirrors the security agent in real time and is built
from the design in [`design/`](design/) (the original HTML/CSS/JS mockup), wired
to the live backend.

## Stack

- **Expo SDK 52** + **expo-router** (file-based navigation, typed routes)
- **TypeScript** (strict)
- **react-native-svg** for the ported line-icon set, rings, and threat globe
- **react-native-sse** for the live Server-Sent-Events feed
- **expo-secure-store** for token persistence (keychain / keystore)
- Fonts: Space Grotesk + JetBrains Mono (`@expo-google-fonts/*`)

## Backend integration

The app talks to the same backend the desktop app uses. Base URL is configured
in `app.json` → `expo.extra.apiBaseUrl` (default: the deployed Heroku instance)
and can be overridden with `EXPO_PUBLIC_API_BASE_URL`.

| Screen | Endpoint(s) |
| --- | --- |
| Connect / health | `GET /health` |
| Auth | `POST /api/auth/login`, `POST /api/auth/register` |
| Live feed (all screens) | `GET /api/stream?token=` (SSE: `threat:new`, `alert:new`, `scan:update`, `agent:activity`, `metrics:update`) |
| Home | `GET /api/threats/stats` |
| Alerts | `GET /api/threats?status=active` + live alert events |
| Agent | `GET /api/orchestrator/stats` + `agent:activity` events |
| Globe | `GET /api/otx/threats/recent` + live threat events |
| Sandbox | `GET /api/sandbox/history` |
| Threat Intelligence | `GET /api/otx/pulses` |
| Browser Intelligence | `GET /api/browser-intelligence/snapshot` |
| Orchestrator | `GET /api/orchestrator/stats`, `/agents` |
| Tasks | `GET /api/orchestrator/recent` |
| Model Inference | `GET /api/cyberforge-ml/health`, `/models` |
| AI Assistance | `POST /api/cyberforge-ml/v2/security-chat` |

### Auth modes

- **Sign in / Register** — issues a JWT used as `Authorization: Bearer` and as
  the SSE `token` query param.
- **Guest** — skips auth and relies on the backend's public endpoints
  (orchestrator, OTX, sandbox, ML, health, global SSE events).

### No mock data

Every screen renders **real backend values or an honest loading / empty / error
state** — there is no placeholder data. Rate-limited (`429`) responses are caught
and surfaced as a "pull to refresh shortly" hint (the backend caps `/api/*` at
100 req / 15 min).

## Project layout

```
app/                      # expo-router routes
  _layout.tsx             # providers (Auth, LiveFeed, Alerts) + stack
  index.tsx               # onboarding / connect (real /health handshake)
  login.tsx               # sign in / register / guest
  (tabs)/                 # Home, Alerts, Agent, Globe, More
  alert/[id].tsx          # alert detail bottom sheet
  screen/[key].tsx        # Explore sub-screens
src/
  api/                    # client, endpoints, SSE, storage, config, types
  components/             # Icon, Ring, LiveDot, GlobeViz, ui primitives, Screen
  context/                # AuthContext, LiveFeedContext, AlertsContext
  sections/               # Explore section bodies
  data/sections.ts        # Explore catalog
  theme.ts                # design tokens ported from the mockup
assets/                   # app icon / splash / brand mark (from the desktop app)
```

## Run

```bash
cd mobile-app
npm install
npm run android        # or: npm start, then press "a"
```

> The editor will show "cannot find module" / `--jsx` errors until
> `npm install` populates `node_modules` (the TS config extends
> `expo/tsconfig.base`, which ships with the `expo` package).

Type-check: `npm run typecheck`

## Build an installable Android app

Using EAS (recommended):

```bash
npm install -g eas-cli
eas login
eas build -p android --profile preview     # produces an installable .apk
```

Or a local prebuild + Gradle build:

```bash
npx expo prebuild -p android
cd android && ./gradlew assembleRelease
```

The APK lands in `android/app/build/outputs/apk/release/`.
