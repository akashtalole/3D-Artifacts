/**
 * Modular robot model: kinematics (FK, numerical damped-least-squares IK), static joint loads,
 * workspace sampling, rated payload, cost and URDF export. Robot frame: metres, Z up.
 *
 * A robot is a base pedestal followed by modules. Each module is a joint plus the link after it:
 *   joint  'yaw' (about local Z) · 'pitch' (about local Y) · 'roll' (about the link direction) · 'slide' (along it)
 *   dir    'up' (+Z) · 'fwd' (+X) · 'side' (+Y) · 'down' (−Z) — direction of the link
 *   len    link length (m) · size S/M/L/XL (motor + link section) · min/max limits (deg or m)
 */
export const DIRS = { up: [0, 0, 1], fwd: [1, 0, 0], side: [0, 1, 0], down: [0, 0, -1] };
export const MOTORS = {
  S: { torque: 30, force: 400, mass: 1.8, speed: 225, lin: 1.0, link: 4, r: 0.045, cost: 90000 },
  M: { torque: 160, force: 1500, mass: 5.5, speed: 180, lin: 0.8, link: 9, r: 0.065, cost: 220000 },
  L: { torque: 650, force: 5000, mass: 14, speed: 130, lin: 0.6, link: 19, r: 0.1, cost: 550000 },
  XL: { torque: 2200, force: 15000, mass: 32, speed: 90, lin: 0.5, link: 38, r: 0.15, cost: 1100000 },
  XXL: { torque: 7500, force: 40000, mass: 70, speed: 80, lin: 0.4, link: 60, r: 0.2, cost: 2400000 },
};
export const TOOLS = {
  gripper: { name: 'Two-finger gripper', len: 0.16, mass: 1.1, cost: 120000, ops: ['grip', 'release'] },
  vacuum: { name: 'Vacuum cup gripper', len: 0.13, mass: 0.7, cost: 80000, ops: ['grip', 'release'] },
  torch: { name: 'MIG welding torch', len: 0.30, mass: 2.2, cost: 260000, ops: ['arc on', 'arc off'] },
  screw: { name: 'Screwdriver spindle', len: 0.22, mass: 1.6, cost: 180000, ops: ['spin on', 'spin off'] },
};
const m = (joint, dir, len, size, min, max) => ({ joint, dir, len, size, min, max });
export const PRESETS = {
  six: { name: '6-axis industrial arm', desc: 'Classic articulated arm: waist, shoulder, elbow and a three-axis wrist.', color: '#f08a24', base: 0.3, tool: 'gripper',
    modules: [m('yaw', 'up', 0.45, 'L', -170, 170), m('pitch', 'up', 0.70, 'L', -90, 120), m('pitch', 'fwd', 0.12, 'L', -150, 75), m('roll', 'fwd', 0.62, 'M', -190, 190), m('pitch', 'fwd', 0.10, 'S', -125, 125), m('roll', 'fwd', 0.02, 'S', -350, 350)], home: [0, 15, 10, 0, 65, 0] },
  cobot: { name: '7-axis collaborative arm', desc: 'Redundant 7-DOF cobot: lighter motors, a straight-up zero pose and extra freedom for the elbow.', color: '#e9edf2', base: 0.75, tool: 'vacuum',
    modules: [m('yaw', 'up', 0.34, 'L', -170, 170), m('pitch', 'up', 0.0, 'L', -120, 120), m('roll', 'up', 0.40, 'M', -170, 170), m('pitch', 'up', 0.0, 'M', -120, 120), m('roll', 'up', 0.40, 'S', -170, 170), m('pitch', 'up', 0.0, 'S', -120, 120), m('roll', 'up', 0.10, 'S', -175, 175)], home: [0, 40, 0, 90, 0, 50, 0] },
  scara: { name: 'SCARA', desc: 'Selective-compliance arm: two horizontal links and a vertical quill — fast and rigid for flat pick-and-place.', color: '#2f80ed', base: 0.62, tool: 'vacuum',
    modules: [m('yaw', 'up', 0.42, 'M', -150, 150), m('yaw', 'fwd', 0.40, 'M', -150, 150), m('yaw', 'fwd', 0.32, 'S', -150, 150), m('slide', 'down', 0.08, 'S', 0, 0.32), m('roll', 'down', 0.02, 'S', -360, 360)], home: [0, 40, -60, 0.05, 0] },
  palletizer: { name: '5-axis palletizer', desc: 'Long-reach, high-payload arm for stacking: big L/XL motors, wrist pitch keeps the tool vertical.', color: '#f2c94c', base: 0.0, tool: 'vacuum',
    modules: [m('yaw', 'up', 0.75, 'XL', -180, 180), m('pitch', 'up', 1.10, 'XXL', -45, 95), m('pitch', 'fwd', 1.30, 'XL', -110, 20), m('pitch', 'fwd', 0.20, 'L', -120, 120), m('roll', 'down', 0.05, 'M', -360, 360)], home: [0, 10, -20, 10, 0] },
  gantry: { name: 'Cartesian gantry', desc: 'Three linear axes on an overhead frame plus a rotary wrist — simple, accurate and easy to program.', color: '#27ae60', base: 2.0, tool: 'gripper',
    modules: [m('slide', 'fwd', 0.0, 'M', -1.0, 1.0), m('slide', 'side', 0.0, 'M', -1.0, 1.0), m('slide', 'down', 0.15, 'M', 0, 1.15), m('roll', 'down', 0.05, 'S', -360, 360)], home: [0.3, -0.2, 0.6, 0] },
};
export function clonePreset(id) { const p = PRESETS[id]; return { preset: id, name: p.name, color: p.color, base: p.base, tool: p.tool, modules: p.modules.map((x) => ({ ...x })), home: [...p.home] }; }
export const isLinear = (mod) => mod.joint === 'slide';
export const toRad = (mod, v) => (isLinear(mod) ? v : (v * Math.PI) / 180);
export const fromRad = (mod, v) => (isLinear(mod) ? v : (v * 180) / Math.PI);

// ── tiny rigid-transform algebra: { R: 3×3 row-major, p: [x,y,z] } ──
const I3 = () => [1, 0, 0, 0, 1, 0, 0, 0, 1];
const mulR = (A, B) => { const C = new Array(9); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i * 3 + j] = A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j]; return C; };
const mulV = (R, v) => [R[0] * v[0] + R[1] * v[1] + R[2] * v[2], R[3] * v[0] + R[4] * v[1] + R[5] * v[2], R[6] * v[0] + R[7] * v[1] + R[8] * v[2]];
export const compose = (A, B) => ({ R: mulR(A.R, B.R), p: add(mulV(A.R, B.p), A.p) });
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const norm = (a) => Math.hypot(a[0], a[1], a[2]);
export const unit = (a) => { const n = norm(a) || 1; return [a[0] / n, a[1] / n, a[2] / n]; };
function axisAngle(ax, t) {
  const [x, y, z] = ax, c = Math.cos(t), s = Math.sin(t), C = 1 - c;
  return [c + x * x * C, x * y * C - z * s, x * z * C + y * s, y * x * C + z * s, c + y * y * C, y * z * C - x * s, z * x * C - y * s, z * y * C + x * s, c + z * z * C];
}
export const localAxis = (mod) => (mod.joint === 'yaw' ? [0, 0, 1] : mod.joint === 'pitch' ? [0, 1, 0] : DIRS[mod.dir]);

/** Forward kinematics. q in internal units (rad / m). */
export function fk(robot, q) {
  let T = { R: I3(), p: [0, 0, robot.base] };
  const joints = [];
  robot.modules.forEach((mod, i) => {
    const a = localAxis(mod);
    const origin = T.p, axis = mulV(T.R, a);
    const M = mod.joint === 'slide' ? { R: I3(), p: scale(a, q[i] || 0) } : { R: axisAngle(a, q[i] || 0), p: [0, 0, 0] };
    const J = compose(T, M);
    const end = compose(J, { R: I3(), p: scale(DIRS[mod.dir], mod.len) });
    joints.push({ origin, axis, frame: J, start: J.p, end: end.p, T: end });
    T = end;
  });
  const tool = TOOLS[robot.tool];
  const tdir = DIRS[robot.modules.at(-1)?.dir || 'up'];
  const tcp = compose(T, { R: I3(), p: scale(tdir, tool.len) });
  return { joints, flange: T, tcp: tcp.p, R: tcp.R, toolAxis: mulV(T.R, tdir) };
}

/** Damped-least-squares IK on position + tool-axis direction (roll about the tool axis is free). */
export function ik(robot, target, q0, opts = {}) {
  const n = robot.modules.length, iters = opts.iters ?? 120, wO = opts.orient === false ? 0 : (opts.wO ?? 0.35);
  const lim = robot.modules.map((mod) => [toRad(mod, mod.min), toRad(mod, mod.max)]);
  let q = q0.slice();
  const tAxis = target.axis ? unit(target.axis) : null;
  const errOf = (F) => { const ep = sub(target.p, F.tcp); const eo = tAxis && wO ? scale(cross(F.toolAxis, tAxis), wO) : [0, 0, 0]; return [...ep, ...eo]; };
  let F = fk(robot, q), e = errOf(F), en = Math.hypot(...e), lambda = 0.05;
  for (let k = 0; k < iters && en > 2e-4; k++) {
    // numerical Jacobian (6 × n)
    const J = Array.from({ length: 6 }, () => new Array(n).fill(0));
    for (let j = 0; j < n; j++) {
      const d = isLinear(robot.modules[j]) ? 1e-4 : 1e-4;
      const qd = q.slice(); qd[j] += d;
      const Fd = fk(robot, qd);
      const dp = scale(sub(Fd.tcp, F.tcp), 1 / d);
      const dw = tAxis && wO ? scale(cross(F.toolAxis, Fd.toolAxis), wO / d) : [0, 0, 0];
      for (let r = 0; r < 3; r++) { J[r][j] = dp[r]; J[r + 3][j] = dw[r]; }
    }
    // Δq = Jᵀ (J Jᵀ + λ² I)⁻¹ e
    const A = Array.from({ length: 6 }, (_, r) => Array.from({ length: 6 }, (_, c) => { let s = 0; for (let j = 0; j < n; j++) s += J[r][j] * J[c][j]; return s + (r === c ? lambda * lambda : 0); }));
    const y = solve6(A, e);
    const dq = new Array(n).fill(0);
    for (let j = 0; j < n; j++) { let s = 0; for (let r = 0; r < 6; r++) s += J[r][j] * y[r]; dq[j] = s; }
    // limit step
    const mx = Math.max(...dq.map((v, j) => Math.abs(v) / (isLinear(robot.modules[j]) ? 0.1 : 0.35)));
    const k2 = mx > 1 ? 1 / mx : 1;
    const qn = q.map((v, j) => Math.min(lim[j][1], Math.max(lim[j][0], v + dq[j] * k2)));
    const Fn = fk(robot, qn), En = errOf(Fn), enn = Math.hypot(...En);
    if (enn < en) { q = qn; F = Fn; e = En; en = enn; lambda = Math.max(0.005, lambda * 0.6); }
    else lambda = Math.min(2, lambda * 3);
  }
  const posErr = norm(sub(target.p, F.tcp)), angErr = tAxis ? Math.acos(Math.min(1, Math.max(-1, dot(F.toolAxis, tAxis)))) : 0;
  return { q, ok: posErr < 0.003 && angErr < 0.03, posErr, angErr };
}
function solve6(A, b) {
  const n = 6, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const d = M[c][c] || 1e-12;
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / d; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((r, i) => r[n] / (r[i] || 1e-12));
}
/** Robust IK: try the warm start, then a few deterministic seeds. */
export function solve(robot, target, q0, opts = {}) {
  let best = ik(robot, target, q0, opts);
  if (best.ok) return best;
  const seeds = opts.seeds ?? 6;
  for (let s = 0; s < seeds; s++) {
    const qs = robot.modules.map((mod, j) => { const lo = toRad(mod, mod.min), hi = toRad(mod, mod.max); const f = ((s * 0.618 + j * 0.37) % 1); return lo + (hi - lo) * (0.2 + 0.6 * f); });
    const r = ik(robot, target, qs, opts);
    if (r.ok) return r;
    if (r.posErr + r.angErr * 0.2 < best.posErr + best.angErr * 0.2) best = r;
  }
  return best;
}

// ── masses, loads, capability ──
export function massItems(robot, F, payload = 0) {
  const items = [];   // { m, p, after } — `after` = index of the first joint the mass is downstream of
  robot.modules.forEach((mod, i) => {
    const M = MOTORS[mod.size];
    items.push({ m: M.mass, p: F.joints[i].origin, after: i - 1 });     // motor sits at its joint, carried by the joints before it
    const L = Math.max(0.0, mod.len);
    if (L > 0) items.push({ m: M.link * L + 0.4, p: scale(add(F.joints[i].start, F.joints[i].end), 0.5), after: i });
  });
  const tool = TOOLS[robot.tool];
  items.push({ m: tool.mass + payload, p: F.tcp, after: robot.modules.length - 1 });
  return items;
}
const G = [0, 0, -9.81];
/** Static gravity load on each joint: torque (N·m) for revolute, force (N) for linear. */
export function loads(robot, q, payload = 0) {
  const F = fk(robot, q), items = massItems(robot, F, payload);
  return robot.modules.map((mod, i) => {
    const o = F.joints[i].origin, a = F.joints[i].axis;
    let t = 0;
    for (const it of items) {
      if (it.after < i) continue;
      const f = scale(G, it.m);
      t += isLinear(mod) ? dot(a, f) : dot(a, cross(sub(it.p, o), f));
    }
    const rating = isLinear(mod) ? MOTORS[mod.size].force : MOTORS[mod.size].torque;
    return { load: Math.abs(t), rating, ratio: Math.abs(t) / rating };
  });
}
function rnd(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function sampleQ(robot, r) { return robot.modules.map((mod) => { const lo = toRad(mod, mod.min), hi = toRad(mod, mod.max); return lo + (hi - lo) * r(); }); }
/** Workspace samples and headline specs. */
export function analyse(robot, nSamples = 1400) {
  const r = rnd(42), pts = [];
  let reach = 0, reachH = 0, zMin = Infinity, zMax = -Infinity, payload = Infinity;
  const n = robot.modules.length;
  let selfOk = 0;
  for (let s = 0; s < nSamples; s++) {
    const q = sampleQ(robot, r), F = fk(robot, q);
    const p = F.tcp; if (p[2] < 0) continue;
    pts.push(p);
    reachH = Math.max(reachH, Math.hypot(p[0], p[1]));
    reach = Math.max(reach, norm(sub(p, [0, 0, robot.base])));
    zMin = Math.min(zMin, p[2]); zMax = Math.max(zMax, p[2]);
    if (s % 4 === 0) {
      const l0 = loads(robot, q, 0), l1 = loads(robot, q, 1);
      let cap = Infinity;
      for (let j = 0; j < n; j++) { const unitLoad = l1[j].load - l0[j].load; const room = l0[j].rating * 0.8 - l0[j].load; if (room < 0) cap = -1; else if (unitLoad > 1e-6) cap = Math.min(cap, room / unitLoad); }
      if (cap >= 0) selfOk++;
      payload = Math.min(payload, cap);
    }
  }
  // rated payload = worst case over the envelope, ignoring the worst 3 % of poses (near limits)
  const mass = massItems(robot, fk(robot, robot.modules.map(() => 0)), 0).reduce((s, it) => s + it.m, 0) + 25 + robot.base * 60;
  const cost = robot.modules.reduce((s, mod) => s + MOTORS[mod.size].cost + mod.len * 40000, 0) + TOOLS[robot.tool].cost + 350000;
  const maxSpeed = Math.min(...robot.modules.filter((x) => !isLinear(x)).map((x) => MOTORS[x.size].speed), 999);
  return { pts, reach, reachH, zMin, zMax, payload: Number.isFinite(payload) ? payload : 0, dof: n, mass, cost, maxSpeed, selfHolds: selfOk > 0 };
}
/** Payload rating computed with a percentile instead of the absolute worst pose. */
export function ratedPayload(robot, n = 500) {
  const r = rnd(7), caps = [];
  for (let s = 0; s < n; s++) {
    const q = sampleQ(robot, r), F = fk(robot, q); if (F.tcp[2] < 0) continue;
    const l0 = loads(robot, q, 0), l1 = loads(robot, q, 1);
    let cap = Infinity;
    for (let j = 0; j < robot.modules.length; j++) { const u = l1[j].load - l0[j].load; const room = l0[j].rating * 0.85 - l0[j].load; if (room < 0) { cap = 0; break; } if (u > 1e-6) cap = Math.min(cap, room / u); }
    caps.push(Math.min(cap, 2000));
  }
  caps.sort((a, b) => a - b);
  return caps.length ? caps[Math.floor(caps.length * 0.05)] : 0;
}

// ── URDF ──
export function toURDF(robot, name = 'robot_cell_studio_arm') {
  const f = (v) => (+v.toFixed(5)).toString();
  const v3 = (a) => a.map(f).join(' ');
  const cyl = (r, l) => `<cylinder radius="${f(r)}" length="${f(Math.max(l, 0.001))}"/>`;
  const inertia = (mass, r, l) => { const ixx = (mass * (3 * r * r + l * l)) / 12, izz = (mass * r * r) / 2; return `<inertia ixx="${f(ixx)}" ixy="0" ixz="0" iyy="${f(ixx)}" iyz="0" izz="${f(izz)}"/>`; };
  const rpyFor = (d) => (d === 'fwd' ? '0 1.5708 0' : d === 'side' ? '-1.5708 0 0' : d === 'down' ? '3.14159 0 0' : '0 0 0');
  const lines = [`<?xml version="1.0"?>`, `<!-- Generated by Robot Cell Studio. Masses and inertias are estimates. -->`, `<robot name="${name}">`];
  lines.push(`  <link name="world"/>`, `  <link name="base_link">`, `    <visual><origin xyz="0 0 ${f(robot.base / 2)}"/><geometry>${cyl(0.22, robot.base)}</geometry></visual>`, `    <collision><origin xyz="0 0 ${f(robot.base / 2)}"/><geometry>${cyl(0.22, robot.base)}</geometry></collision>`, `    <inertial><mass value="${f(25 + robot.base * 60)}"/>${inertia(25 + robot.base * 60, 0.22, robot.base || 0.1)}</inertial>`, `  </link>`, `  <joint name="world_fixed" type="fixed"><parent link="world"/><child link="base_link"/></joint>`);
  let parent = 'base_link', origin = [0, 0, robot.base];
  robot.modules.forEach((mod, i) => {
    const M = MOTORS[mod.size], ln = `link_${i + 1}`, ax = localAxis(mod), dir = DIRS[mod.dir];
    const lin = isLinear(mod), lo = toRad(mod, mod.min), hi = toRad(mod, mod.max);
    const lm = M.link * mod.len + 0.4 + M.mass;
    lines.push(`  <joint name="joint_${i + 1}" type="${lin ? 'prismatic' : 'revolute'}">`, `    <parent link="${parent}"/><child link="${ln}"/>`, `    <origin xyz="${v3(origin)}" rpy="0 0 0"/>`, `    <axis xyz="${v3(ax)}"/>`, `    <limit lower="${f(lo)}" upper="${f(hi)}" effort="${lin ? M.force : M.torque}" velocity="${f(lin ? M.lin : (M.speed * Math.PI) / 180)}"/>`, `  </joint>`);
    const c = scale(dir, mod.len / 2);
    lines.push(`  <link name="${ln}">`, `    <visual><origin xyz="${v3(c)}" rpy="${rpyFor(mod.dir)}"/><geometry>${cyl(M.r * 0.75, mod.len)}</geometry></visual>`, `    <collision><origin xyz="${v3(c)}" rpy="${rpyFor(mod.dir)}"/><geometry>${cyl(M.r * 0.75, mod.len)}</geometry></collision>`, `    <inertial><origin xyz="${v3(c)}"/><mass value="${f(lm)}"/>${inertia(lm, M.r * 0.75, mod.len || 0.05)}</inertial>`, `  </link>`);
    parent = ln; origin = scale(dir, mod.len);
  });
  const t = TOOLS[robot.tool], tdir = DIRS[robot.modules.at(-1).dir];
  lines.push(`  <joint name="tool_fixed" type="fixed"><parent link="${parent}"/><child link="tool0"/><origin xyz="${v3(origin)}"/></joint>`, `  <link name="tool0">`, `    <visual><origin xyz="${v3(scale(tdir, t.len / 2))}" rpy="${rpyFor(robot.modules.at(-1).dir)}"/><geometry>${cyl(0.035, t.len)}</geometry></visual>`, `    <inertial><mass value="${f(t.mass)}"/>${inertia(t.mass, 0.035, t.len)}</inertial>`, `  </link>`);
  lines.push(`  <joint name="tcp_fixed" type="fixed"><parent link="tool0"/><child link="tcp"/><origin xyz="${v3(scale(tdir, t.len))}"/></joint>`, `  <link name="tcp"/>`, `</robot>`, '');
  return lines.join('\n');
}
