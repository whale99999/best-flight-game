// Skyline Courier — tuning constants.
//
// One place for every number that shapes the flight model, the missions and
// the look, so balancing never means hunting through the game code.

export const CFG = {
  canvasWidth: 1280,
  canvasHeight: 720,
  focal: 620, // perspective focal length, in pixels
  horizonRatio: 0.42, // horizon line as a fraction of canvas height
  cruiseAltitude: 70, // altitude the plane drifts toward at neutral throttle
  minAltitude: 2, // sea level: touching it outside the runway ends the flight
  maxAltitude: 180,
  baseSpeed: 46, // units per second at zero throttle
  topSpeed: 150, // units per second at full throttle
  turnRate: 1.35, // radians per second at full steer
  climbRate: 26, // altitude units per second toward the target altitude
  fuelCapacity: 100,
  fuelDrain: 1.15, // per second at full throttle, scaled by (0.35 + throttle)
  fuelRingRefill: 26, // fuel a ring gives back
  hullMax: 100,
  cloudDamage: 22,
  invulnerableSeconds: 1.6, // grace after a cloud hit
  ringScore: 500,
  starScore: 50,
  comboMax: 5,
  ringRadius: 13,
  starRadius: 3.5,
  drawDistance: 900, // world units: nothing farther is drawn
  mission1Rings: 10, // rings to pass in Ring Run
  mission3Duration: 90, // seconds to survive in Storm Dash
  runway: { x: 0, zStart: 1500, length: 420, width: 16 },
  colors: {
    skyTop: '#5fb2ef',
    skyHorizon: '#cfeefb',
    seaDeep: '#0d4d7a',
    seaNear: '#1b7fa8',
    sand: '#e8d29a',
    islandGreen: '#3f9e4d',
    islandDark: '#2c7a38',
    ring: '#39d5ff',
    ringPassed: '#7dff8a',
    star: '#ffd94a',
    stormCloud: '#4c4a5e',
    stormCloudDark: '#35334a',
    planeBody: '#eef3f7',
    planeRed: '#d8443c',
  },
};

// The three sorties, in the order the title screen lists them.
export const MISSIONS = [
  {
    id: 1,
    name: 'Ring Run',
    short: 'Fly through 10 glowing rings',
    goal: 'Pass 10 rings before your fuel runs out. Rings refill fuel.',
    rings: 10,
  },
  {
    id: 2,
    name: 'Island Hop',
    short: 'Land on the island runway',
    goal: 'Follow the guide rings down and land gently on the runway.',
    rings: 4,
  },
  {
    id: 3,
    name: 'Storm Dash',
    short: 'Survive the storm belt for 90 seconds',
    goal: 'Stay alive for 90 seconds in dense storm clouds. Rings refuel.',
    rings: 6,
  },
];

export function missionById(id) {
  return MISSIONS.find((m) => m.id === id) ?? MISSIONS[0];
}
