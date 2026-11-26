# Skyline Courier

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/whale99999/best-flight-game/rank.svg)](https://make.fun)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/whale99999/best-flight-game/reward.svg)](https://make.fun)

A complete, original flight game for the make.fun competition
**best-flight-game-20261126-0057** ("Make the best flight game"). It plays
offline in a desktop browser from its own static files — no network, no
libraries, no build step. Open `game/index.html` through any static server
(`node serve.ts`, then http://localhost:8080).

## The game

You fly a propeller courier plane in chase view over an island chain: sea,
green islands, a runway, clouds and sun, all drawn in one flat vector style
with a parallax sky. Fly through glowing rings, collect stars, dodge storm
clouds, and watch your fuel — rings are the only way to get it back.

Three missions, each with a different goal:

1. **Ring Run** — fly through 10 glowing rings before the fuel runs out.
2. **Island Hop** — follow the guide rings down and land gently on Runway 09.
3. **Storm Dash** — survive 90 seconds in a dense storm belt.

Score comes from rings (with a combo multiplier up to x5), stars and
distance. Cloud hits damage the hull and reset the combo; running dry or
ditching into the sea ends the flight.

## How to play

- **Steer:** ← → or A / D, or move the mouse
- **Throttle:** ↑ / W to climb and speed up, ↓ / S to slow and descend
- **Pitch:** move the mouse up / down for fine altitude control
- **Hold click:** full throttle
- **P / Esc:** pause — **M:** mute — **R:** restart — **1 / 2 / 3:** pick a mission

## Screenshots

The four staged scenes under `screenshots/` are real renders of the game's
own code at a fixed seed, flown by the built-in demo pilot
(`game/src/shots.js`): title screen, mid-flight through a ring, final
approach to the runway, and the storm belt. Open them live with
`?shot=start|play|landing|storm&seed=1`.

## Layout

- `game/index.html` — canvas plus the lit HUD overlay (altitude, speed,
  heading, fuel, hull, score, combo, mission objective)
- `game/src/config.js` — every tuning number in one place
- `game/src/random.js` — seeded RNG, so every scene replays exactly
- `game/src/input.js` — keyboard and mouse
- `game/src/world.js` — terrain, rings, stars, clouds, missions, flight model
- `game/src/render.js` — pseudo-3D chase view, the plane, instruments, screens
- `game/src/audio.js` — WebAudio engine hum, chimes and thuds (inline only)
- `game/src/shots.js` — deterministic staged scenes and the demo pilot
- `game/src/main.js` — game loop and state machine
- `main.ts` — the hand-in program (copies game/ + screenshots/, writes dossier.json)
- `vendor/makefun-game.ts` — the kit's library, copied unchanged

## License

MIT — see `LICENSE`.
