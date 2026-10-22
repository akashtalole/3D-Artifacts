/** Robot program: compile (IK, reachability, timing) and playback. */
import { solve, ik, fk, toRad, isLinear, MOTORS, norm, sub, add, scale } from './robot.js';

export const OPS = { movej: 'MoveJ', movel: 'MoveL', tool: 'Tool', wait: 'Wait' };
const LIN_V = 0.7;   // m/s at 100 %
const ease = (u) => u * u * (3 - 2 * u);

export function compile(robot, steps, qStart) {
  const segs = []; let q = qStart.slice(), cycle = 0, bad = 0;
  for (const st of steps) {
    const seg = { step: st, kind: st.op, q0: q.slice(), ok: true, dur: 0, msg: '' };
    if (st.op === 'movej' || st.op === 'movel') {
      let target = st.q && st.q.length === robot.modules.length ? st.q.slice() : null;
      if (st.op === 'movej') {
        if (!target) { const r = solve(robot, { p: st.p, axis: st.axis }, q); target = r.q; if (!r.ok) { seg.ok = false; seg.msg = r.posErr > 0.003 ? `out of reach by ${(r.posErr * 1000).toFixed(0)} mm` : 'tool orientation not achievable'; } }
        const d = robot.modules.map((m, i) => Math.abs(target[i] - q[i]) / (isLinear(m) ? MOTORS[m.size].lin : (MOTORS[m.size].speed * Math.PI) / 180));
        seg.dur = Math.max(0.2, Math.max(...d) * 1.5 * (100 / (st.speed || 100)));
        seg.q1 = target; seg.path = null;
      } else {
        // linear: IK along the straight line, warm-started
        const F0 = fk(robot, q), p0 = F0.tcp, p1 = st.p || fk(robot, target).tcp, axis = st.axis || F0.toolAxis;
        const dist = norm(sub(p1, p0)), n = Math.max(2, Math.ceil(dist / 0.015));
        const path = [q.slice()]; let qc = q.slice(), worst = 0;
        for (let k = 1; k <= n; k++) {
          const p = add(p0, scale(sub(p1, p0), k / n));
          const r = ik(robot, { p, axis }, qc, { iters: 40 });
          worst = Math.max(worst, r.posErr); qc = r.q; path.push(qc);
        }
        if (worst > 0.004) { seg.ok = false; seg.msg = `path leaves the workspace (${(worst * 1000).toFixed(0)} mm off)`; }
        // joint speed check
        let jmax = 0;
        for (let k = 1; k < path.length; k++) robot.modules.forEach((m, i) => { const v = isLinear(m) ? MOTORS[m.size].lin : (MOTORS[m.size].speed * Math.PI) / 180; jmax = Math.max(jmax, Math.abs(path[k][i] - path[k - 1][i]) / v); });
        const tLin = dist / (LIN_V * ((st.speed || 50) / 100));
        seg.dur = Math.max(0.15, tLin * 1.25, jmax * path.length * 0.5);
        if (jmax * (path.length - 1) > tLin * 1.25 * 1.05 && dist > 0.01) seg.msg ||= 'slowed down: a joint hits its speed limit (near a singularity?)';
        seg.q1 = qc; seg.path = path; seg.p0 = p0; seg.p1 = p1;
      }
      // floor check
      const F1 = fk(robot, seg.q1);
      if (F1.tcp[2] < 0.005 || F1.joints.some((j) => j.end[2] < 0.0)) { seg.ok = false; seg.msg = 'hits the floor'; }
      q = seg.q1;
    } else if (st.op === 'tool') { seg.dur = 0.35; seg.q1 = q.slice(); }
    else if (st.op === 'wait') { seg.dur = +st.t || 0.5; seg.q1 = q.slice(); }
    if (!seg.ok) bad++;
    seg.t0 = cycle; cycle += seg.dur; segs.push(seg);
  }
  return { segs, cycle, bad, qEnd: q };
}
/** Joint values at time t within a compiled program. */
export function sample(prog, t) {
  const segs = prog.segs; if (!segs.length) return null;
  t = Math.max(0, Math.min(prog.cycle - 1e-6, t));
  let i = segs.findIndex((s) => t < s.t0 + s.dur); if (i < 0) i = segs.length - 1;
  const s = segs[i], u = ease(Math.min(1, (t - s.t0) / s.dur));
  let q;
  if (s.path) { const f = u * (s.path.length - 1), k = Math.min(s.path.length - 2, Math.floor(f)), w = f - k; q = s.path[k].map((v, j) => v + (s.path[k + 1][j] - v) * w); }
  else q = s.q0.map((v, j) => v + (s.q1[j] - v) * u);
  return { q, i, seg: s, u };
}
export function stepLabel(robot, st) {
  if (st.op === 'tool') return `Tool ${st.tool}`;
  if (st.op === 'wait') return `Wait ${(+st.t || 0.5).toFixed(1)} s`;
  const p = st.p ? `(${st.p.map((v) => (v * 1000).toFixed(0)).join(', ')}) mm` : 'taught joints';
  return `${OPS[st.op]} ${p} · ${st.speed || (st.op === 'movel' ? 50 : 100)}%`;
}
export { toRad };
