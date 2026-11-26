// Skyline Courier — the world: terrain, rings, stars, clouds, missions,
// and the flight-model step that moves the plane through them.
//
// Coordinates: x is lateral (the runway sits at x = 0), y is altitude above
// the sea (y = 0), z is distance flown forward. Heading 0 means straight
// ahead along +z. Everything is generated from one seed so a staged
// screenshot replays the same sky every time.

import { CFG, MISSIONS, missionById } from './config.js';
import { makeRng, range, pick, clamp, lerp, approach } from './random.js';

export function createWorld(seed, missionId) {
  const rng = makeRng(seed);
  const mission = missionById(missionId);
  const world = {
    seed,
    missionId: mission.id,
    rng,
    time: 0,
    storm: mission.id === 3,
    stormFlash: 0,
    nextFlashIn: 3.5,
    shake: 0,
    invulnerable: 0,
    message: '',
    messageTimer: 0,
    missionDone: false,
    missionFailed: false,
    failReason: '',
    autopilot: false,
    landed: false,
    goArounds: 0,
    lowFuelWarned: false,
    plane: {
      x: 0,
      y: 8,
      z: 0,
      heading: 0,
      bank: 0,
      speed: 0,
      throttle: 0.55,
      fuel: CFG.fuelCapacity,
      hull: CFG.hullMax,
      score: 0,
      combo: 0,
      comboBest: 0,
      ringsPassed: 0,
      starsGot: 0,
      distance: 0,
    },
    rings: [],
    stars: [],
    clouds: [],
    islands: [],
    particles: [],
    runway: { ...CFG.runway },
  };
  generateTerrain(world, rng);
  return world;
}

function generateTerrain(world, rng) {
  const mission = missionById(world.missionId);
  const runway = world.runway;

  // Islands: green blobs in the sea, kept clear of the runway corridor.
  for (let i = 0; i < 26; i++) {
    const z = 150 + i * 105 + range(rng, -35, 35);
    const x = range(rng, -380, 380);
    if (Math.abs(x) < 70 && z > runway.zStart - 120 && z < runway.zStart + runway.length + 120) continue;
    world.islands.push({
      x,
      z,
      rx: range(rng, 42, 125),
      rz: range(rng, 30, 90),
      kind: pick(rng, ['green', 'green', 'green', 'town', 'lighthouse']),
      trees: Math.floor(range(rng, 3, 8)),
    });
  }

  // Rings: a winding line of glowing gates. Mission 2's rings descend in a
  // straight line onto the runway threshold instead.
  if (world.missionId === 2) {
    const guide = [
      { z: 700, x: 0, y: 92 },
      { z: 950, x: 0, y: 62 },
      { z: 1200, x: 0, y: 36 },
      { z: 1400, x: 0, y: 18 },
    ];
    for (const g of guide) world.rings.push({ ...g, r: CFG.ringRadius, passed: false, missed: false });
  } else {
    let x = 0;
    let z = 320;
    const count = world.missionId === 1 ? 12 : 6;
    for (let i = 0; i < count; i++) {
      x = clamp(x + range(rng, -95, 95), -200, 200);
      world.rings.push({ x, y: range(rng, 45, 125), z, r: CFG.ringRadius, passed: false, missed: false });
      z += range(rng, 150, 240);
    }
  }

  // Stars: small pickups clustered near the rings, plus a trail down the
  // Island Hop approach.
  for (const ring of world.rings) {
    for (let i = 0; i < 3; i++) {
      world.stars.push({
        x: ring.x + range(rng, -26, 26),
        y: clamp(ring.y + range(rng, -12, 12), 20, 160),
        z: ring.z + range(rng, -30, 30),
        r: CFG.starRadius,
        taken: false,
        spin: range(rng, 0, Math.PI * 2),
      });
    }
  }
  if (world.missionId === 3) {
    for (let i = 0; i < 40; i++) {
      world.stars.push({
        x: range(rng, -260, 260),
        y: range(rng, 40, 140),
        z: range(rng, 400, 2400),
        r: CFG.starRadius,
        taken: false,
        spin: range(rng, 0, Math.PI * 2),
      });
    }
  }

  // Clouds: scattered puffs in missions 1 and 2; a dense storm belt in 3.
  const cloudCount = world.missionId === 3 ? 55 : world.missionId === 2 ? 8 : 14;
  for (let i = 0; i < cloudCount; i++) {
    const storm = world.missionId === 3;
    world.clouds.push({
      x: range(rng, -320, 320),
      y: storm ? range(rng, 40, 145) : range(rng, 60, 155),
      z: storm ? range(rng, 500, 2450) : range(rng, 200, 2600),
      r: storm ? range(rng, 18, 38) : range(rng, 14, 30),
      storm,
      hit: false,
      drift: range(rng, -2, 2),
    });
  }
}

// A burst of sparks at a world position (ring passes, cloud hits).
function burst(world, x, y, z, color, count, speed) {
  for (let i = 0; i < count; i++) {
    const angle = world.rng() * Math.PI * 2;
    const up = (world.rng() - 0.4) * speed;
    world.particles.push({
      x, y, z,
      vx: Math.cos(angle) * speed * 0.6,
      vy: up,
      vz: Math.sin(angle) * speed * 0.6 - 12,
      life: 0.9,
      maxLife: 0.9,
      color,
      size: 2 + world.rng() * 3,
    });
  }
}

function setMessage(world, text, seconds = 2.2) {
  world.message = text;
  world.messageTimer = seconds;
}

// One simulation step. Returns the events of this frame (ring, star, hit,
// miss, complete, fail) so the main loop can play sounds and messages.
export function stepWorld(world, input, dt) {
  const events = [];
  const p = world.plane;
  const runway = world.runway;
  world.time += dt;

  if (world.messageTimer > 0) {
    world.messageTimer -= dt;
    if (world.messageTimer <= 0) world.message = '';
  }
  if (world.invulnerable > 0) world.invulnerable -= dt;
  if (world.shake > 0) world.shake = Math.max(0, world.shake - dt * 1.4);

  // Throttle: the autopilot sets it directly; the pilot nudges it.
  if (input.throttleSet !== undefined) {
    p.throttle = clamp(input.throttleSet, 0.15, 1);
  } else {
    p.throttle = clamp(p.throttle + (input.throttleDelta || 0) * 0.7 * dt, 0.15, 1);
  }

  // Steering: heading turns, the wings bank into it.
  const steer = input.steer || 0;
  const speedFactor = 0.55 + 0.45 * (p.speed / CFG.topSpeed);
  p.heading += steer * CFG.turnRate * speedFactor * dt;
  p.bank = lerp(p.bank, steer * 0.85, Math.min(1, dt * 6));

  // Speed eases toward the throttle's target; an empty tank glides to a stop.
  const targetSpeed = CFG.baseSpeed + p.throttle * (CFG.topSpeed - CFG.baseSpeed);
  p.speed = lerp(p.speed, targetSpeed, Math.min(1, dt * 0.9));
  if (p.fuel <= 0) p.speed = lerp(p.speed, 0, Math.min(1, dt * 0.5));

  // Altitude: the plane drifts toward a cruise height set by throttle and
  // pitch, and glides down when the tank is dry. On the Island Hop final
  // the approach itself pulls the plane down to the runway.
  let targetAlt = CFG.cruiseAltitude + p.throttle * 35 + (input.climb || 0) * 45;
  if (p.fuel <= 0) targetAlt = 0;
  if (world.missionId === 2 && p.z > runway.zStart - 600) {
    const t = clamp((p.z - (runway.zStart - 600)) / 600, 0, 1);
    targetAlt = Math.min(targetAlt, lerp(42, 3, t));
  }
  targetAlt = clamp(targetAlt, 0, CFG.maxAltitude);
  p.y = approach(p.y, targetAlt, CFG.climbRate * dt);

  // Position along the heading.
  const prevZ = p.z;
  p.x += Math.sin(p.heading) * p.speed * dt;
  p.z += Math.cos(p.heading) * p.speed * dt;
  p.x = clamp(p.x, -420, 420);
  p.distance += p.speed * dt;
  p.score += p.speed * dt * 0.1;

  // Fuel burns with throttle; a ring is the only way to get it back.
  p.fuel = Math.max(0, p.fuel - CFG.fuelDrain * (0.35 + p.throttle) * dt);
  if (p.fuel <= 0 && !world.lowFuelWarned) {
    world.lowFuelWarned = true;
    setMessage(world, 'OUT OF FUEL — glide her down!', 3);
    events.push({ type: 'lowfuel' });
  }

  const overRunway =
    Math.abs(p.x - runway.x) < runway.width / 2 &&
    p.z > runway.zStart &&
    p.z < runway.zStart + runway.length;

  // Rings and stars are scored as the plane's nose crosses their z plane.
  for (const ring of world.rings) {
    if (ring.passed || ring.missed) continue;
    if (prevZ < ring.z && p.z >= ring.z) {
      const d = Math.hypot(p.x - ring.x, p.y - ring.y);
      if (d < ring.r + 5) {
        ring.passed = true;
        p.ringsPassed++;
        p.combo = Math.min(CFG.comboMax, p.combo + 1);
        p.comboBest = Math.max(p.comboBest, p.combo);
        const points = CFG.ringScore * p.combo;
        p.score += points;
        p.fuel = Math.min(CFG.fuelCapacity, p.fuel + CFG.fuelRingRefill);
        burst(world, ring.x, ring.y, ring.z, '#ffd94a', 22, 26);
        events.push({ type: 'ring', points, combo: p.combo });
        setMessage(world, `RING! +${points}  (combo x${p.combo})`);
        if (world.missionId === 1 && p.ringsPassed >= CFG.mission1Rings) {
          world.missionDone = true;
          p.score += 1000;
          events.push({ type: 'complete', bonus: 1000 });
        }
      } else {
        ring.missed = true;
        if (p.combo > 0) p.combo = 0;
        events.push({ type: 'miss' });
        setMessage(world, 'Ring missed — combo lost');
      }
    }
  }
  for (const star of world.stars) {
    if (star.taken) continue;
    if (prevZ < star.z && p.z >= star.z) {
      if (Math.hypot(p.x - star.x, p.y - star.y) < 9) {
        star.taken = true;
        p.starsGot++;
        p.combo = Math.min(CFG.comboMax, p.combo + 1);
        p.score += CFG.starScore;
        burst(world, star.x, star.y, star.z, '#ffe98a', 8, 14);
        events.push({ type: 'star' });
      }
    }
  }

  // Clouds drift slowly and hurt when flown through.
  for (const cloud of world.clouds) {
    cloud.x += cloud.drift * dt;
    if (cloud.hit) continue;
    const dz = cloud.z - p.z;
    if (dz < -40 || dz > 60) continue;
    const d = Math.hypot(p.x - cloud.x, p.y - cloud.y, dz);
    if (d < cloud.r + 6) {
      cloud.hit = true;
      if (world.invulnerable <= 0) {
        p.hull -= CFG.cloudDamage;
        p.combo = 0;
        world.shake = 0.6;
        world.invulnerable = CFG.invulnerableSeconds;
        burst(world, p.x, p.y, p.z + 10, '#9aa3b2', 16, 20);
        events.push({ type: 'hit' });
        setMessage(world, cloud.storm ? 'STORM HIT! Hull damaged' : 'Cloud hit! Hull damaged');
        if (p.hull <= 0) {
          p.hull = 0;
          world.missionFailed = true;
          world.failReason = 'The Courier broke apart in the clouds.';
          events.push({ type: 'fail', reason: world.failReason });
        }
      }
    }
  }

  // Storm lightning flashes on a slow random timer.
  if (world.storm) {
    world.nextFlashIn -= dt;
    if (world.nextFlashIn <= 0) {
      world.stormFlash = 0.28;
      world.nextFlashIn = 3 + world.rng() * 6;
    }
  }
  if (world.stormFlash > 0) world.stormFlash = Math.max(0, world.stormFlash - dt);

  // Particles age and fade.
  for (let i = world.particles.length - 1; i >= 0; i--) {
    const pt = world.particles[i];
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.z += pt.vz * dt;
    pt.life -= dt;
    if (pt.life <= 0) world.particles.splice(i, 1);
  }

  // Mission 2: a gentle touchdown on the runway wins; overshoot and the
  // tower sends the plane around for another try.
  if (world.missionId === 2 && !world.missionDone && !world.missionFailed) {
    if (overRunway && p.y <= CFG.minAltitude + 1 && p.speed < 75) {
      world.landed = true;
      world.missionDone = true;
      p.score += 1000;
      events.push({ type: 'land' });
      events.push({ type: 'complete', bonus: 1000 });
    } else if (p.z > runway.zStart + runway.length + 320) {
      p.z = runway.zStart - 420;
      p.y = 42;
      p.heading = 0;
      p.speed = 60;
      p.throttle = 0.5;
      world.goArounds++;
      setMessage(world, 'Overshot! Go around — line up again', 3);
      events.push({ type: 'goaround' });
    }
  }

  // Mission 3: survive the clock.
  if (world.missionId === 3 && !world.missionDone && !world.missionFailed && world.time >= CFG.mission3Duration) {
    world.missionDone = true;
    p.score += 1000;
    events.push({ type: 'complete', bonus: 1000 });
  }

  // Touching the sea anywhere but the runway ends the flight.
  if (p.y <= CFG.minAltitude) {
    if (world.missionId === 2 && overRunway && p.speed < 75) {
      // handled above as a landing
    } else if (world.missionId === 2 && overRunway) {
      p.y = CFG.minAltitude;
      p.speed = Math.max(30, p.speed - 60 * dt);
      setMessage(world, 'Too fast — braking on the runway!');
    } else if (!world.missionFailed) {
      world.missionFailed = true;
      world.failReason = p.fuel <= 0 ? 'Out of fuel — ditched into the sea.' : 'Ditched into the sea.';
      events.push({ type: 'fail', reason: world.failReason });
    }
  }

  return events;
}

// The demo pilot: steers toward the next ring (or the runway on Island Hop),
// climbs or descends to meet it, and dodges the nearest storm cloud ahead.
// The staged screenshot scenes fly the game with this pilot, so every shot
// is a real render of the game's own code.
export function autopilotInput(world) {
  const p = world.plane;
  const runway = world.runway;
  let target = null;

  if (world.missionId === 2) {
    if (p.z < runway.zStart - 100) {
      const t = clamp((p.z - (runway.zStart - 600)) / 600, 0, 1);
      target = { x: 0, y: Math.max(6, lerp(42, 6, t)), z: runway.zStart };
    } else {
      target = { x: 0, y: 4, z: runway.zStart + 200 };
    }
  } else {
    const ring = world.rings.find((r) => !r.passed && !r.missed && r.z > p.z - 10);
    target = ring ?? { x: 0, y: 80, z: p.z + 300 };
  }

  const desiredHeading = Math.atan2(target.x - p.x, 120);
  let steer = clamp((desiredHeading - p.heading) * 2.2, -1, 1);
  let climb = clamp((target.y - p.y) / 25, -1, 1);

  // Dodge the nearest cloud directly ahead: slip sideways and away from it.
  for (const cloud of world.clouds) {
    if (cloud.hit) continue;
    const dz = cloud.z - p.z;
    if (dz < 0 || dz > 150) continue;
    const dx = p.x - cloud.x;
    const dy = p.y - cloud.y;
    if (Math.abs(dx) < cloud.r + 24 && Math.abs(dy) < cloud.r + 20) {
      steer += (dx >= 0 ? 1 : -1) * 0.9;
      climb += (dy >= 0 ? 1 : -1) * 0.55;
    }
  }

  return {
    steer: clamp(steer, -1, 1),
    throttleDelta: 0,
    climb: clamp(climb, -1, 1),
    throttleSet: world.missionId === 2 ? 0.3 : 0.62,
  };
}

export { MISSIONS };
