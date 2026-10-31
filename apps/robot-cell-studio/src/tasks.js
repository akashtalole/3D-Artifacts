/**
 * Task templates. Each one lays out the work cell around the robot you built (searching for
 * positions the arm can actually reach) and writes a program for it.
 */
import { solve, toRad, TOOLS } from './robot.js';

const DOWN = [0, 0, -1];
const polar = (r, deg, z) => [r * Math.cos((deg * Math.PI) / 180), r * Math.sin((deg * Math.PI) / 180), z];
export const homeQ = (robot) => robot.home.map((v, i) => toRad(robot.modules[i], v));

function reachable(robot, pts, q0, axis = DOWN) {
  let q = q0;
  for (const p of pts) { const r = solve(robot, { p, axis }, q, { seeds: 4 }); if (!r.ok) return null; q = r.q; }
  return q;
}

export const TASKS = {
  palletize: { name: 'Palletize boxes', desc: 'Pick boxes off the end of a conveyor and stack them 2 × 2 × 2 on a pallet.', tools: ['vacuum', 'gripper'] },
  weld: { name: 'Weld a seam', desc: 'Run a MIG torch around a rectangular seam on a fixture with a pushing angle.', tools: ['torch'] },
  screw: { name: 'Drive screws', desc: 'Fasten six screws into a plate on a fixture table.', tools: ['screw'] },
  teach: { name: 'Teach your own', desc: 'Empty program — jog the arm and press Teach to record points.', tools: null },
};

export function buildTask(robot, id, spec) {
  if (id === 'palletize') return palletize(robot, spec);
  if (id === 'weld') return weld(robot, spec);
  if (id === 'screw') return screw(robot, spec);
  return { layout: { kind: 'teach' }, steps: [], notes: [] };
}

function palletize(robot, spec) {
  const R = spec.reachH, s = Math.min(1, Math.max(0.45, R / 1.5));
  const box = { w: 0.30 * s, d: 0.22 * s, h: 0.16 * s, mass: +(4 * s * s).toFixed(1) };
  const grab = robot.tool === 'gripper' ? -0.04 * s : 0;
  const q0 = homeQ(robot), notes = [];
  let pick = null, place = null;
  outer: for (const rf of [0.62, 0.55, 0.7, 0.48, 0.78, 0.4, 0.85]) for (const ch of [0.8, 0.65, 0.95, 0.5, 1.1, 0.35, 1.3, 0.2]) {
    const pp = polar(rf * R, -55, ch + box.h + grab);
    const qa = reachable(robot, [[pp[0], pp[1], pp[2] + 0.22 * s], pp], q0);
    if (qa) { pick = { r: rf * R, az: -55, top: ch, p: pp, q: qa }; break outer; }
  }
  if (!pick) return fail('No conveyor position is reachable with the tool pointing down. Lengthen the links or add a wrist pitch.');
  const slots = [];
  outer2: for (const rf of [pick.r / R, 0.62, 0.55, 0.7, 0.48, 0.78, 0.4]) for (const stand of [0.12, 0.3, 0.5, 0.7, 0.9, 1.1, 1.3]) {
    const c = polar(rf * R, 40, stand);
    const pts = [];
    for (let layer = 0; layer < 2; layer++) for (let ix = 0; ix < 2; ix++) for (let iy = 0; iy < 2; iy++) {
      const x = c[0] + (ix - 0.5) * (box.w + 0.01), y = c[1] + (iy - 0.5) * (box.d + 0.01), z = stand + 0.144 + (layer + 1) * box.h + grab;
      pts.push([x, y, z]);
    }
    const all = pts.flatMap((p) => [[p[0], p[1], p[2] + 0.2 * s], p]);
    if (reachable(robot, all, pick.q)) { slots.push(...pts); place = { r: rf * R, az: 40, stand, c }; break outer2; }
  }
  if (!place) return fail('The arm reaches the conveyor but no pallet position — it needs more reach or a lower minimum height.');
  const steps = [{ op: 'movej', q: homeQ(robot), speed: 100, label: 'Home' }];
  const up = (p, h = 0.22 * s) => [p[0], p[1], p[2] + h];
  slots.forEach((sl, k) => {
    steps.push({ op: 'movej', p: up(pick.p), axis: DOWN, speed: 100, label: `Box ${k + 1}: above conveyor` });
    steps.push({ op: 'movel', p: pick.p, axis: DOWN, speed: 45 }, { op: 'tool', tool: 'grip' }, { op: 'movel', p: up(pick.p), axis: DOWN, speed: 70 });
    steps.push({ op: 'movej', p: up(sl, 0.2 * s), axis: DOWN, speed: 100, label: `Box ${k + 1}: above pallet` });
    steps.push({ op: 'movel', p: sl, axis: DOWN, speed: 35 }, { op: 'tool', tool: 'release' }, { op: 'movel', p: up(sl, 0.2 * s), axis: DOWN, speed: 70 });
  });
  if (box.mass > spec.payload) notes.push(`Each box weighs ${box.mass} kg but the arm's rated payload is ${spec.payload.toFixed(1)} kg.`);
  return { layout: { kind: 'palletize', pick, place, box, s }, steps, notes, parts: slots.length };
}

function weld(robot, spec) {
  const R = spec.reachH, a = Math.min(0.5, 0.34 * R), b = a * 0.6;
  const q0 = homeQ(robot);
  const tilt = [[0, 0.42, -1], DOWN];
  for (const rf of [0.55, 0.62, 0.48, 0.7, 0.4, 0.78]) for (const th of [0.75, 0.9, 0.6, 1.05, 0.45, 1.2, 0.3]) for (const ax of tilt) {
    const c = polar(rf * R, 0, th + 0.02);
    const corners = [[c[0] - a / 2, c[1] - b / 2, c[2]], [c[0] + a / 2, c[1] - b / 2, c[2]], [c[0] + a / 2, c[1] + b / 2, c[2]], [c[0] - a / 2, c[1] + b / 2, c[2]]];
    const path = [];
    for (let i = 0; i < 4; i++) for (let k = 0; k < 4; k++) { const p = corners[i], q = corners[(i + 1) % 4]; path.push([p[0] + (q[0] - p[0]) * k / 4, p[1] + (q[1] - p[1]) * k / 4, p[2]]); }
    const qa = reachable(robot, [[corners[0][0], corners[0][1], c[2] + 0.12], ...path, corners[0]], q0, unitv(ax));
    if (!qa) continue;
    const axis = unitv(ax);
    const steps = [{ op: 'movej', p: [corners[0][0], corners[0][1], c[2] + 0.15], axis, speed: 100, label: 'Approach seam start' }, { op: 'movel', p: corners[0], axis, speed: 30 }, { op: 'tool', tool: 'arc on' }];
    for (let i = 1; i <= 4; i++) steps.push({ op: 'movel', p: corners[i % 4], axis, speed: 6, label: `Weld side ${i}` });
    steps.push({ op: 'tool', tool: 'arc off' }, { op: 'movel', p: [corners[0][0], corners[0][1], c[2] + 0.15], axis, speed: 60 });
    return { layout: { kind: 'weld', c, a, b, table: th, axis }, steps, notes: ax === DOWN ? ['Torch held vertical — this arm cannot tilt it to a pushing angle around the whole seam.'] : [] };
  }
  return fail('No fixture position lets the torch follow the whole seam. Try an arm with a wrist (pitch + roll).');
}
function screw(robot, spec) {
  const R = spec.reachH, a = Math.min(0.42, 0.3 * R);
  const q0 = homeQ(robot);
  for (const rf of [0.55, 0.62, 0.48, 0.7, 0.4]) for (const th of [0.75, 0.9, 0.6, 1.05, 0.45, 1.2]) {
    const c = polar(rf * R, 20, th + 0.03);
    const holes = []; for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) holes.push([c[0] + (i - 1) * a / 2.4, c[1] + (j - 0.5) * a / 2, c[2]]);
    if (!reachable(robot, holes.flatMap((h) => [[h[0], h[1], h[2] + 0.08], h]), q0)) continue;
    const steps = [];
    holes.forEach((h, k) => { steps.push({ op: 'movej', p: [h[0], h[1], h[2] + 0.08], axis: DOWN, speed: 100, label: `Screw ${k + 1}` }, { op: 'movel', p: h, axis: DOWN, speed: 20 }, { op: 'tool', tool: 'spin on' }, { op: 'wait', t: 0.8 }, { op: 'tool', tool: 'spin off' }, { op: 'movel', p: [h[0], h[1], h[2] + 0.08], axis: DOWN, speed: 60 }); });
    return { layout: { kind: 'screw', c, a, table: th, holes }, steps, notes: [] };
  }
  return fail('No fixture position is reachable with the tool pointing down.');
}
function fail(msg) { return { layout: { kind: 'teach' }, steps: [], notes: [msg], failed: true }; }
function unitv(v) { const n = Math.hypot(...v); return v.map((x) => x / n); }
export { TOOLS };
