# Sky Spotter ✈

A plane spotter web app that shows flights flying directly overhead your GPS location — ideal for photography. Runs as a persistent background service on macOS, accessible from an iPhone over Tailscale HTTPS.

## What it does

- Shows only flights that will pass within a configurable distance of your location (default 2 km)
- Highlights big planes (wide-body / narrow-body jets) — the most valuable photography targets
- Plane icons on the map are oriented in their direction of flight
- Click any flight row for a full detail panel (altitude, speed, heading, ETA overhead, aircraft type)
- Auto-refreshes every 5 seconds
- Dark map, altitude colour coding, pulsing ring for overhead passes

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- Leaflet + CartoDB dark tiles
- OpenSky Network free API (authenticated)

---

## First-time setup

### 1. Install dependencies

```bash
npm install
```

### 2. Set OpenSky credentials

Create `.env.local` in the project root:

```
OPENSKY_USER=your_opensky_username
OPENSKY_PASS=your_opensky_password
```

Register free at [opensky-network.org](https://opensky-network.org) — authenticated accounts get 1000 API requests/day vs ~100 anonymous.

### 3. Add credentials to the LaunchAgent

Edit `~/Library/LaunchAgents/com.peterkratochvil.sky-spotter.plist` and add your credentials to the `EnvironmentVariables` dict (they are already there if you followed setup):

```xml
<key>OPENSKY_USER</key>
<string>your_username</string>
<key>OPENSKY_PASS</key>
<string>your_password</string>
```

### 4. Build the aircraft database (optional but recommended)

Downloads the OpenSky aircraft registration CSV (~90 MB) and builds a local lookup table so aircraft types show up correctly instead of "unknown":

```bash
npm run build:db
```

This writes `data/aircraft-db.json`. Re-run occasionally to keep it fresh.

### 5. Register the LaunchAgent (runs automatically at login)

```bash
launchctl load ~/Library/LaunchAgents/com.peterkratochvil.sky-spotter.plist
```

---

## Daily use

The service starts automatically at login and is always available at:

- Local: `http://localhost:3001`
- iPhone (requires Tailscale): `https://peters-macbook-air.tail9dc925.ts.net`

> iOS Safari requires HTTPS for geolocation — always use the Tailscale address on iPhone.

---

## Service management

| Action | Command |
|--------|---------|
| Start | `launchctl start com.peterkratochvil.sky-spotter` |
| Stop | `launchctl stop com.peterkratochvil.sky-spotter` |
| Restart | `launchctl stop com.peterkratochvil.sky-spotter && launchctl start com.peterkratochvil.sky-spotter` |
| View logs | `tail -f ~/Library/Logs/sky-spotter.log` |
| View errors | `tail -f ~/Library/Logs/sky-spotter.error.log` |

---

## After a code change

```bash
./deploy.sh
```

This builds the production bundle and restarts the service. One command, that's it.

---

## Project structure

```
sky_spotter/
├── src/
│   ├── app/
│   │   ├── api/flights/route.ts    ← API route: enriches + filters flights
│   │   ├── layout.tsx              ← root layout
│   │   ├── page.tsx                ← renders SpotterMode
│   │   └── globals.css             ← touch-action fix, 44px tap targets
│   ├── components/
│   │   ├── SpotterMode.tsx         ← main UI, controls, detail panel
│   │   ├── FlightMap.tsx           ← Leaflet map, icon rotation
│   │   └── FlightTable.tsx         ← flight list with size badges
│   └── lib/
│       ├── types.ts                ← AircraftSize enum, FlightWithAirport
│       ├── opensky.ts              ← API client, auth, caching, geometry
│       ├── aircraftDb.ts           ← loads data/aircraft-db.json at runtime
│       └── typecodeToSize.ts       ← maps B738/A320/etc. → AircraftSize
├── scripts/
│   └── build-aircraft-db.ts       ← downloads CSV, builds data/aircraft-db.json
├── data/
│   └── aircraft-db.json           ← generated, not committed
├── deploy.sh                      ← build + restart in one command
└── ~/Library/LaunchAgents/
    └── com.peterkratochvil.sky-spotter.plist
```

---

## Known limitations

- OpenSky free tier: 1000 requests/day authenticated. With 15s server-side cache this covers ~4 hours of continuous use. The app backs off gracefully on rate limit (serves stale data, retries after 60s).
- Aircraft type shows "unknown" for aircraft not in the OpenSky registration DB, or before `npm run build:db` has been run.
- OpenSky data updates every ~10 seconds — no point polling faster than that.
