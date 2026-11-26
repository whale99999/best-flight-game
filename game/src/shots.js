// Skyline Courier — deterministic staged scenes for the screenshots.
//
// ?shot=start|play|landing|storm&seed=1 builds the world from the seed, then
// flies it forward with the autopilot demo pilot in fixed 1/60 s steps until
// the scene's framing condition is met. Every shot is therefore a real
// render of the game's own code at a fixed seed — nothing is posed by hand.
// Once staged, the world is frozen: the screenshot shows exactly this moment.

import { createWorld, stepWorld, autopilotInput } from './world.js';

const DT = 1 / 60;
const MAX_STEPS = 900;

// Step the world until `ready(world)` is true (or the step budget runs out),
// then freeze it for the screenshot.
function stage(world, ready) {
  world.autopilot = true;
  let steps = 0;
  while (steps < MAX_STEPS && !ready(world)) {
    stepWorld(world, autopilotInput(world), DT);
    steps++;
    if (world.missionFailed) break;
  }
  world.autopilot = false;
  return { world, steps, failed: world.missionFailed };
}

function nextRingAhead(world) {
  const p = world.plane;
  return world.rings.find((r) => !r.passed && !r.missed && r.z > p.z - 10) ?? null;
}

export function setupShot(name, seed) {
  if (name === 'start') {
    // Title screen: the Courier on the water at the start of the island
    // chain, the runway far ahead, islands on both sides.
    const world = createWorld(seed, 1);
    world.plane.y = 10;
    return { world, screen: 'title', frozen: true, missionId: 1, steps: 0 };
  }

  if (name === 'play') {
    // Mid-flight: stop while the next glowing ring is just ahead, so the
    // shot shows the plane flying through the ring with the HUD lit.
    const world = createWorld(seed, 1);
    const staged = stage(world, (w) => {
      const ring = nextRingAhead(w);
      if (!ring) return true;
      const dz = ring.z - w.plane.z;
      return dz > 30 && dz < 95;
    });
    return { world, screen: 'playing', frozen: true, missionId: 1, steps: staged.steps };
  }

  if (name === 'landing') {
    // Final approach: on the glide path to the runway threshold, gear down,
    // runway lights filling the view.
    const world = createWorld(seed, 2);
    world.plane.z = world.runway.zStart - 520;
    world.plane.y = 48;
    world.plane.throttle = 0.35;
    const staged = stage(world, (w) => {
      const dz = w.runway.zStart - w.plane.z;
      return dz > 40 && dz < 150 && w.plane.y < 14;
    });
    return { world, screen: 'playing', frozen: true, missionId: 2, steps: staged.steps };
  }

  if (name === 'storm') {
    // In the storm belt: stop with a dark storm cloud looming just ahead.
    const world = createWorld(seed, 3);
    const staged = stage(world, (w) => {
      const p = w.plane;
      return w.clouds.some((c) => {
        if (!c.storm || c.hit) return false;
        const dz = c.z - p.z;
        return dz > 45 && dz < 130 && Math.abs(c.x - p.x) < 70 && Math.abs(c.y - p.y) < 55;
      });
    });
    return { world, screen: 'playing', frozen: true, missionId: 3, steps: staged.steps };
  }

  return null;
}
