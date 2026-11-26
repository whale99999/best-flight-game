// Skyline Courier — the game loop and state machine.
//
// States: title -> playing <-> paused -> over / complete -> (R) title's
// mission again. A ?shot= URL stages a deterministic scene instead of the
// title screen, freezes the world once staged, and keeps rendering it so a
// screenshot captures exactly that moment.

import { CFG, missionById } from './config.js';
import { Input } from './input.js';
import { SoundBank } from './audio.js';
import { createWorld, stepWorld, autopilotInput } from './world.js';
import { render } from './render.js';
import { setupShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const hud = document.getElementById('hud');

const params = new URLSearchParams(location.search);
const seedParam = Number(params.get('seed'));
const seed = Number.isFinite(seedParam) ? Math.floor(seedParam) : (Date.now() % 2147483647);
const shotName = params.get('shot');

const input = new Input(canvas);
const sound = new SoundBank();

let screen = 'title'; // title | playing | paused | over | complete
let selectedMission = 1;
let world = createWorld(seed, selectedMission);
let frozen = false;
let shotInfo = null;

if (shotName) {
  const shot = setupShot(shotName, seed);
  if (shot) {
    world = shot.world;
    screen = shot.screen;
    frozen = shot.frozen;
    selectedMission = shot.missionId;
    shotInfo = shot;
    console.log(`[skyline] shot=${shotName} seed=${seed} steps=${shot.steps} failed=${shot.failed}`);
  }
}

function startMission(missionId) {
  selectedMission = missionId;
  world = createWorld(seed, missionId);
  screen = 'playing';
  frozen = false;
  sound.resume();
}

function restartMission() {
  startMission(selectedMission);
}

function handleEvents(events) {
  for (const event of events) {
    if (event.type === 'ring') sound.ring();
    else if (event.type === 'star') sound.star();
    else if (event.type === 'hit') sound.hit();
    else if (event.type === 'land') sound.land();
    else if (event.type === 'complete') {
      screen = 'complete';
      sound.land();
    } else if (event.type === 'fail') {
      screen = 'over';
      sound.hit();
    }
  }
}

function handleStateKeys() {
  const now = performance.now();
  if (screen === 'title') {
    if (input.consume('Digit1')) { selectedMission = 1; world = createWorld(seed, 1); sound.resume(); }
    if (input.consume('Digit2')) { selectedMission = 2; world = createWorld(seed, 2); sound.resume(); }
    if (input.consume('Digit3')) { selectedMission = 3; world = createWorld(seed, 3); sound.resume(); }
    if (input.consume('Enter') || input.consume('Space')) startMission(selectedMission);
    if (input.consume('KeyM')) sound.toggleMute();
    return;
  }
  if (screen === 'playing') {
    if (input.consume('KeyP') || input.consume('Escape')) screen = 'paused';
    if (input.consume('KeyM')) sound.toggleMute();
    return;
  }
  if (screen === 'paused') {
    if (input.consume('KeyP') || input.consume('Escape') || input.consume('Enter')) screen = 'playing';
    if (input.consume('KeyR')) restartMission();
    return;
  }
  // over / complete
  if (input.consume('KeyR')) restartMission();
  if (input.consume('Digit1')) startMission(1);
  if (input.consume('Digit2')) startMission(2);
  if (input.consume('Digit3')) startMission(3);
}

function headingDegrees() {
  return ((world.plane.heading * 180) / Math.PI % 360 + 360) % 360;
}

function compassPoint(deg) {
  const points = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return points[Math.round(deg / 45) % 8];
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el && el.textContent !== text) el.textContent = text;
}

function syncHud() {
  const p = world.plane;
  const mission = missionById(world.missionId);
  const showHud = screen === 'playing' || screen === 'paused';
  hud.classList.toggle('hidden', !showHud);
  if (!showHud) return;

  const knots = Math.round(p.speed * 2.2);
  const deg = headingDegrees();
  setText('hud-alt', `${Math.round(p.y * 12)} ft`);
  setText('hud-spd', `${knots} kt`);
  setText('hud-hdg', `${String(Math.round(deg)).padStart(3, '0')}° ${compassPoint(deg)}`);
  setText('hud-score', String(Math.floor(p.score)));
  setText('hud-combo', p.combo > 1 ? `COMBO x${p.combo}` : '');
  const fuelBar = document.getElementById('hud-fuel-fill');
  if (fuelBar) fuelBar.style.width = `${Math.max(0, p.fuel)}%`;
  const hullBar = document.getElementById('hud-hull-fill');
  if (hullBar) hullBar.style.width = `${Math.max(0, p.hull)}%`;
  const fuelEl = document.getElementById('hud-fuel-fill');
  if (fuelEl) fuelEl.classList.toggle('low', p.fuel < 25);
  const hullEl = document.getElementById('hud-hull-fill');
  if (hullEl) hullEl.classList.toggle('low', p.hull < 35);

  let objective = mission.goal;
  if (world.missionId === 1) objective = `Rings ${p.ringsPassed} / ${CFG.mission1Rings} — ${mission.name}`;
  if (world.missionId === 2) objective = world.landed ? 'Landed!' : `Land on Runway 09 — ${mission.name}`;
  if (world.missionId === 3) objective = `Survive ${Math.max(0, Math.ceil(CFG.mission3Duration - world.time))}s — ${mission.name}`;
  setText('hud-objective', objective);
  setText('hud-mission', mission.name.toUpperCase());
}

let lastTime = performance.now();

function frame(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  handleStateKeys();

  if (!frozen && screen === 'playing') {
    const flight = world.autopilot ? autopilotInput(world) : input.poll(now);
    const events = stepWorld(world, flight, dt);
    handleEvents(events);
    sound.setEngine(world.plane.throttle, true);
  } else {
    sound.setEngine(0, false);
  }

  render(ctx, world, screen, now / 1000, selectedMission);
  syncHud();
  input.endFrame();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
