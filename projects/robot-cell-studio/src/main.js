import * as THREE from 'three';
import { PRESETS, MOTORS, TOOLS, DIRS, clonePreset, fk, solve, analyse, ratedPayload, loads, toRad, fromRad, isLinear, toURDF } from './robot.js';
import { TASKS, buildTask, homeQ } from './tasks.js';
import { compile, sample, stepLabel, OPS } from './program.js';
import { createScene } from './scene.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let toastT; function toast(m, ms = 2600) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms); }
const COLORS = ['#f08a24', '#e9edf2', '#2f80ed', '#f2c94c', '#27ae60', '#d64545', '#7d5fff', '#3b4048'];
const JOINT_N = { yaw: 'Yaw', pitch: 'Pitch', roll: 'Roll', slide: 'Slide' };
const DIR_N = { up: 'link up', fwd: 'link forward', side: 'link sideways', down: 'link down' };

// ── state ──
const S = { robot: null, task: 'palletize', steps: [], prog: null, spec: null, payload: 0, q: [], t: 0, playing: false, speed: 1, loop: true, segI: -1, tool: { closed: false, arc: false, spin: false }, jog: 'joints', tab: 'specs', held: null, built: null, sel: -1, env: false };
const sc = createScene($('#scene'));
window.__cell = { S, sc };   // handle for automated browser tests

// ── setup controls ──
for (const [k, p] of Object.entries(PRESETS)) $('#preset').insertAdjacentHTML('beforeend', `<option value="${k}">${esc(p.name)}</option>`);
for (const [k, t] of Object.entries(TASKS)) $('#task').insertAdjacentHTML('beforeend', `<option value="${k}">${esc(t.name)}</option>`);
for (const [k, t] of Object.entries(TOOLS)) $('#tool').insertAdjacentHTML('beforeend', `<option value="${k}">${esc(t.name)}</option>`);
$('#colors').innerHTML = COLORS.map((c) => `<button data-col="${c}" style="background:${c}" title="${c}"></button>`).join('');
const SPEEDS = [0.25, 0.5, 1, 2, 4];
$('.speeds').innerHTML = SPEEDS.map((s) => `<button data-speed="${s}">${s}×</button>`).join('');
const markSpeed = () => document.querySelectorAll('[data-speed]').forEach((b) => b.classList.toggle('active', +b.dataset.speed === S.speed));
document.querySelectorAll('[data-speed]').forEach((b) => b.addEventListener('click', () => { S.speed = +b.dataset.speed; markSpeed(); }));

function loadFromHash() {
  const h = new URLSearchParams(location.hash.slice(1));
  let robot = null;
  if (h.get('r')) { try { robot = JSON.parse(decodeURIComponent(escape(atob(h.get('r').replace(/-/g, '+').replace(/_/g, '/'))))); } catch { robot = null; } }
  const preset = PRESETS[h.get('p')] ? h.get('p') : 'six';
  S.robot = robot && robot.modules?.length ? robot : clonePreset(preset);
  S.task = TASKS[h.get('task')] ? h.get('task') : 'palletize';
  if (h.get('speed')) S.speed = +h.get('speed');
  return h;
}
function shareHash() {
  const r = btoa(unescape(encodeURIComponent(JSON.stringify(S.robot)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `#task=${S.task}&r=${r}`;
}

// ── rebuild pipeline ──
let rebuildT = null;
function scheduleRebuild(regen = true) { clearTimeout(rebuildT); rebuildT = setTimeout(() => rebuild(regen), 120); }
function rebuild(regen = true) {
  const r = S.robot;
  S.spec = analyse(r); S.payload = ratedPayload(r); S.spec.payload = S.payload;
  sc.buildRobot(r);
  if (S.q.length !== r.modules.length) S.q = homeQ(r);
  S.q = S.q.map((v, i) => clampJ(i, v));
  if (regen && !(S.task === 'teach' && S.built)) generateTask();
  else { if (S.built) sc.buildCell(S.built.layout, r, S.spec); compileProg(); }
  sc.setEnvelope(S.spec.pts, S.env);
  renderModules(); renderJog(); renderPanel(); syncTop();
  pose();
}
function generateTask() {
  const r = S.robot, T = TASKS[S.task];
  if (T.tools && !T.tools.includes(r.tool)) { r.tool = T.tools[0]; sc.buildRobot(r); toast(`Tool changed to ${TOOLS[r.tool].name} for this task`); }
  const out = buildTask(r, S.task, { reachH: S.spec.reachH, payload: S.payload });
  S.built = out; S.steps = out.steps.map((s) => ({ ...s }));
  sc.buildCell(out.layout, r, S.spec);
  if (out.failed) toast(out.notes[0], 4000);
  compileProg(); rewind();
}
function compileProg() {
  S.prog = compile(S.robot, S.steps, homeQ(S.robot));
  const b = $('#badge'); b.textContent = S.prog.bad ? `${S.prog.bad} ✕` : S.steps.length ? '✓' : ''; b.className = S.prog.bad ? 'bad' : 'good';
  $('#cyc').textContent = `${S.prog.cycle.toFixed(1)} s`;
  const parts = S.built?.parts;
  $('#cyc-sub').textContent = parts && S.prog.cycle ? `cycle · ${Math.round((3600 / S.prog.cycle) * parts).toLocaleString('en-IN')} boxes/h` : 'cycle';
}
const clampJ = (i, v) => { const m = S.robot.modules[i]; return Math.min(toRad(m, m.max), Math.max(toRad(m, m.min), v)); };

// ── builder panel ──
function renderModules() {
  const r = S.robot, L = loads(r, S.q, S.held ? S.built?.layout.box?.mass || 0 : 0);
  $('#base').value = r.base; $('#base-o').textContent = `${r.base.toFixed(2)} m`;
  $('#tool').value = r.tool;
  document.querySelectorAll('[data-col]').forEach((b) => b.classList.toggle('on', b.dataset.col === r.color));
  $('#preset-desc').textContent = PRESETS[r.preset]?.desc || 'Custom robot.';
  $('#modules').innerHTML = r.modules.map((m, i) => {
    const lin = isLinear(m), u = lin ? 'm' : '°';
    const ratio = L[i]?.ratio || 0;
    return `<div class="mod ${ratio > 1 ? 'over' : ''}" data-i="${i}">
      <div class="mh"><b>J${i + 1}</b><select data-f="joint">${Object.entries(JOINT_N).map(([k, n]) => `<option value="${k}" ${k === m.joint ? 'selected' : ''}>${n}</option>`).join('')}</select><select data-f="dir">${Object.entries(DIR_N).map(([k, n]) => `<option value="${k}" ${k === m.dir ? 'selected' : ''}>${n}</option>`).join('')}</select>
        <button class="ic" data-act="up" title="Move up">↑</button><button class="ic" data-act="down" title="Move down">↓</button><button class="ic" data-act="del" title="Remove">✕</button></div>
      <div class="mb"><label class="full">Link length <span class="mono">${(m.len * 1000).toFixed(0)} mm</span><input type="range" data-f="len" min="0" max="1.6" step="0.01" value="${m.len}" /></label>
        <label>Motor<select data-f="size">${Object.keys(MOTORS).map((k) => `<option value="${k}" ${k === m.size ? 'selected' : ''}>${k} · ${lin ? `${MOTORS[k].force} N` : `${MOTORS[k].torque} N·m`}</option>`).join('')}</select></label>
        <label>Range (${u})<span style="display:flex;gap:4px"><input type="number" data-f="min" value="${m.min}" step="${lin ? 0.05 : 5}" /><input type="number" data-f="max" value="${m.max}" step="${lin ? 0.05 : 5}" /></span></label></div>
      <div class="load" title="Static load now: ${(ratio * 100).toFixed(0)}% of rating"><i class="${ratio > 1 ? 'bad' : ratio > 0.8 ? 'warn' : ''}" style="width:${Math.min(100, ratio * 100)}%"></i></div></div>`;
  }).join('');
  $('#add-mod').disabled = r.modules.length >= 9;
}
$('#modules').addEventListener('input', (e) => {
  const t = e.target, card = t.closest('[data-i]'); if (!card) return;
  const i = +card.dataset.i, m = S.robot.modules[i], f = t.dataset.f;
  if (f === 'len') { m.len = +t.value; card.querySelector('.mono').textContent = `${(m.len * 1000).toFixed(0)} mm`; markCustom(); sc.buildRobot(S.robot); pose(); scheduleRebuild(); }
});
$('#modules').addEventListener('change', (e) => {
  const t = e.target, card = t.closest('[data-i]'); if (!card) return;
  const i = +card.dataset.i, m = S.robot.modules[i], f = t.dataset.f;
  if (f === 'joint') { const wasLin = isLinear(m); m.joint = t.value; if (isLinear(m) !== wasLin) { if (isLinear(m)) { m.min = 0; m.max = 0.5; } else { m.min = -170; m.max = 170; } S.q[i] = 0; } }
  else if (f === 'dir' || f === 'size') m[f] = t.value;
  else if (f === 'min' || f === 'max') m[f] = +t.value;
  else return;
  markCustom(); rebuild();
});
$('#modules').addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const i = +b.closest('[data-i]').dataset.i, mods = S.robot.modules;
  if (b.dataset.act === 'del') { if (mods.length <= 2) return toast('A robot needs at least two joints'); mods.splice(i, 1); S.robot.home.splice(i, 1); S.q.splice(i, 1); }
  if (b.dataset.act === 'up' && i > 0) { [mods[i - 1], mods[i]] = [mods[i], mods[i - 1]]; [S.q[i - 1], S.q[i]] = [S.q[i], S.q[i - 1]]; [S.robot.home[i - 1], S.robot.home[i]] = [S.robot.home[i], S.robot.home[i - 1]]; }
  if (b.dataset.act === 'down' && i < mods.length - 1) { [mods[i + 1], mods[i]] = [mods[i], mods[i + 1]]; [S.q[i + 1], S.q[i]] = [S.q[i], S.q[i + 1]]; [S.robot.home[i + 1], S.robot.home[i]] = [S.robot.home[i], S.robot.home[i + 1]]; }
  markCustom(); rebuild();
});
$('#add-mod').addEventListener('click', () => { S.robot.modules.push({ joint: 'roll', dir: S.robot.modules.at(-1).dir, len: 0.08, size: 'S', min: -180, max: 180 }); S.robot.home.push(0); S.q.push(0); markCustom(); rebuild(); });
$('#base').addEventListener('input', (e) => { S.robot.base = +e.target.value; $('#base-o').textContent = `${S.robot.base.toFixed(2)} m`; markCustom(); sc.buildRobot(S.robot); pose(); scheduleRebuild(); });
$('#tool').addEventListener('change', (e) => { S.robot.tool = e.target.value; markCustom(); rebuild(); });
$('#colors').addEventListener('click', (e) => { const b = e.target.closest('[data-col]'); if (!b) return; S.robot.color = b.dataset.col; sc.buildRobot(S.robot); pose(); renderModules(); });
$('#preset').addEventListener('change', (e) => { S.robot = clonePreset(e.target.value); S.q = homeQ(S.robot); rebuild(); sc.view(curView, S.spec.reachH); toast(PRESETS[e.target.value].name); });
$('#reset-robot').addEventListener('click', () => { const id = PRESETS[S.robot.preset] ? S.robot.preset : 'six'; S.robot = clonePreset(id); S.q = homeQ(S.robot); rebuild(); });
$('#task').addEventListener('change', (e) => { S.task = e.target.value; generateTask(); renderPanel(); renderModules(); syncTop(); setTab('program'); });
function markCustom() { if (!S.robot.name.endsWith('(custom)')) S.robot.name = `${S.robot.name} (custom)`; }
function syncTop() { $('#preset').value = PRESETS[S.robot.preset] ? S.robot.preset : 'six'; $('#task').value = S.task; markSpeed(); }

// ── jog ──
function renderJog() {
  $('#jog-sliders').innerHTML = S.robot.modules.map((m, i) => {
    const lin = isLinear(m);
    return `<div class="js"><b>J${i + 1}</b><input type="range" data-j="${i}" min="${m.min}" max="${m.max}" step="${lin ? 0.005 : 0.5}" value="${fromRad(m, S.q[i])}" /><output>${fmtJ(m, S.q[i])}</output></div>`;
  }).join('');
}
const fmtJ = (m, v) => (isLinear(m) ? `${(v * 1000).toFixed(0)} mm` : `${fromRad(m, v).toFixed(1)}°`);
function syncJog() { document.querySelectorAll('[data-j]').forEach((el) => { const i = +el.dataset.j, m = S.robot.modules[i]; if (document.activeElement !== el) el.value = fromRad(m, S.q[i]); el.nextElementSibling.textContent = fmtJ(m, S.q[i]); }); }
$('#jog-sliders').addEventListener('input', (e) => { const el = e.target.closest('[data-j]'); if (!el) return; pause(); const i = +el.dataset.j; S.q[i] = toRad(S.robot.modules[i], +el.value); pose(); });
document.querySelectorAll('[data-jog]').forEach((b) => b.addEventListener('click', () => { S.jog = b.dataset.jog; document.querySelectorAll('[data-jog]').forEach((x) => x.classList.toggle('active', x === b)); const on = S.jog === 'tcp'; sc.tc.enabled = on; sc.tcHelper.visible = on; sc.target.visible = on; if (on) { pause(); placeTarget(); toast('Drag the arrows: the arm follows with inverse kinematics'); } }));
function placeTarget() { const F = fk(S.robot, S.q); sc.target.position.set(...F.tcp); }
sc.tc.addEventListener('objectChange', () => {
  const p = sc.target.position, F = fk(S.robot, S.q);
  const r = solve(S.robot, { p: [p.x, p.y, p.z], axis: F.toolAxis }, S.q, { seeds: 0 });
  S.q = r.q; pose();
  setStatus(r.ok ? null : `Target out of reach by ${(r.posErr * 1000).toFixed(0)} mm`);
});
$('#tool-down').addEventListener('click', () => { pause(); const F = fk(S.robot, S.q); const r = solve(S.robot, { p: F.tcp, axis: [0, 0, -1] }, S.q); if (r.ok) { S.q = r.q; pose(); placeTarget(); } else toast('This arm cannot point its tool straight down here'); });
$('#go-home').addEventListener('click', () => { pause(); S.q = homeQ(S.robot); pose(); placeTarget(); });
function teach(op) {
  const F = fk(S.robot, S.q);
  S.steps.push({ op, q: S.q.slice(), p: F.tcp.slice(), axis: F.toolAxis.slice(), speed: op === 'movel' ? 40 : 100 });
  compileProg(); setTab('program'); toast(`${OPS[op]} taught as step ${S.steps.length}`);
}
$('#teach-j').addEventListener('click', () => teach('movej'));
$('#teach-l').addEventListener('click', () => teach('movel'));
$('#add-tool').addEventListener('click', () => { const ops = TOOLS[S.robot.tool].ops; const last = [...S.steps].reverse().find((s) => s.op === 'tool'); const next = last && last.tool === ops[0] ? ops[1] : ops[0]; S.steps.push({ op: 'tool', tool: next }); compileProg(); setTab('program'); });
$('#add-wait').addEventListener('click', () => { S.steps.push({ op: 'wait', t: 0.5 }); compileProg(); setTab('program'); });

// ── right panel ──
function setTab(t) { S.tab = t; document.querySelectorAll('.tabs [data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === t)); renderPanel(); }
document.querySelectorAll('.tabs [data-tab]').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
function renderPanel() {
  const el = $('#panel'), st = el.scrollTop;
  el.innerHTML = S.tab === 'specs' ? specsHtml() : S.tab === 'program' ? programHtml() : exportHtml();
  el.scrollTop = st;
}
function issuesFor() {
  const out = [], sp = S.spec, r = S.robot;
  if (!sp.selfHolds || S.payload <= 0.05) out.push(['bad', 'The motors cannot hold the arm itself over much of its range. Use bigger motors near the base or shorten the links.']);
  else if (S.payload < 1) out.push(['warn', `Rated payload is only ${S.payload.toFixed(2)} kg — upgrade the shoulder/elbow motors.`]);
  const nRot = r.modules.filter((m) => !isLinear(m)).length;
  if (r.modules.length < 4) out.push(['warn', 'Fewer than 4 axes: the tool cannot reach most positions with a chosen orientation.']);
  if (r.modules.length > 6 && nRot >= 7) out.push(['ok', `${r.modules.length} axes: redundant — infinitely many arm poses reach the same tool pose, which helps avoid obstacles.`]);
  const hm = fk(r, homeQ(r)); if (hm.joints.some((j) => j.end[2] < 0)) out.push(['bad', 'Part of the arm goes through the floor in the home pose — raise the pedestal.']);
  if (S.built?.notes?.length) for (const n of S.built.notes) out.push([S.built.failed ? 'bad' : 'warn', n]);
  if (S.prog?.bad) out.push(['bad', `${S.prog.bad} program step${S.prog.bad > 1 ? 's are' : ' is'} not reachable — see the Program tab.`]);
  if (!out.length) out.push(['ok', 'The arm holds its own weight everywhere, carries its payload and reaches every program point.']);
  return out;
}
function specsHtml() {
  const sp = S.spec, r = S.robot;
  const L = loads(r, S.q, S.held ? S.built?.layout.box?.mass || 0 : 0);
  const tiles = [['Axes (DOF)', r.modules.length, ''], ['Horizontal reach', (sp.reachH * 1000).toFixed(0), 'mm'], ['Rated payload', S.payload >= 100 ? S.payload.toFixed(0) : S.payload.toFixed(1), 'kg'], ['Arm mass', sp.mass.toFixed(0), 'kg'], ['Working height', `${(Math.max(0, sp.zMin) * 1000).toFixed(0)}–${(sp.zMax * 1000).toFixed(0)}`, 'mm'], ['Slowest joint', sp.maxSpeed === 999 ? '—' : sp.maxSpeed, '°/s'], ['Est. cost', `₹${(sp.cost / 1e5).toFixed(1)}`, 'lakh'], ['Payload/mass', ((S.payload / sp.mass) * 100).toFixed(1), '%']];
  return `<h3 style="margin-top:2px">${esc(r.name)}</h3><div class="specs">${tiles.map(([a, b, c]) => `<div class="spec"><small>${a}</small><b>${b}</b><i>${c}</i></div>`).join('')}</div>
    <h3>Joint loads now <small>static gravity load vs motor rating</small></h3>${L.map((l, i) => `<div class="jl"><b>J${i + 1}</b><div class="bar"><i class="${l.ratio > 1 ? 'bad' : l.ratio > 0.8 ? 'warn' : ''}" style="width:${Math.min(100, l.ratio * 100)}%"></i></div><span>${l.load.toFixed(0)} / ${l.rating} ${isLinear(r.modules[i]) ? 'N' : 'N·m'}</span></div>`).join('')}
    <h3>Checks</h3><ul class="issues">${issuesFor().map(([c, m]) => `<li class="${c}">${esc(m)}</li>`).join('')}</ul>
    <p class="note">Rated payload is the mass the arm can hold at the tool flange in 95% of its working range while every motor stays under 85% of its torque. Costs are illustrative.</p>`;
}
function programHtml() {
  const T = TASKS[S.task], p = S.prog;
  let h = `<div class="taskbox"><b>${esc(T.name)}</b><span class="muted">${esc(T.desc)}</span></div>`;
  h += `<div class="btnrow"><button class="btn primary" data-act="run">${S.playing ? '❚❚ Pause' : '▶ Run'}</button><button class="btn" data-act="loop">${S.loop ? '⟳ Loop on' : '⟳ Loop off'}</button>${S.task !== 'teach' ? '<button class="btn" data-act="regen">Re-generate</button>' : ''}<button class="btn" data-act="clear">Clear</button></div>`;
  h += `<p class="muted">${S.steps.length} steps · cycle ${p.cycle.toFixed(1)} s${p.bad ? ` · <span style="color:#ff9b9b">${p.bad} unreachable</span>` : ''}. Click a step to preview it.</p>`;
  h += `<ol class="steps">${p.segs.map((s, i) => `<li class="${i === S.segI ? 'cur' : ''} ${s.ok ? '' : 'bad'}" data-step="${i}"><span class="n">${i + 1}</span><span><span class="op ${s.step.op}">${OPS[s.step.op]}</span>${esc(s.step.label || stepLabel(S.robot, s.step).replace(/^\w+ /, ''))}${!s.ok || s.msg ? `<small>${s.ok ? '' : '✕ '}${esc(s.msg)}</small>` : ''}</span><span class="t">${s.dur.toFixed(1)}s</span><button class="x" data-del="${i}" title="Delete step">✕</button></li>`).join('')}</ol>`;
  if (!S.steps.length) h += '<p class="note">Jog the arm with the sliders (or drag the TCP) and press <b>Teach MoveJ</b> / <b>Teach MoveL</b> to record points. Add tool and wait steps between them.</p>';
  return h;
}
function exportHtml() {
  return `<h3 style="margin-top:2px">URDF robot description</h3><p class="muted">Load into ROS 2, MoveIt, Gazebo, Isaac Sim or any URDF viewer. Masses and inertias are estimates.</p>
    <div class="btnrow"><button class="btn primary" data-act="urdf">Download .urdf</button><button class="btn" data-act="urdf-copy">Copy</button></div>
    <h3>Robot program</h3><p class="muted">Generic, vendor-neutral script: joint targets in degrees, TCP targets in millimetres in the base frame.</p>
    <div class="btnrow"><button class="btn primary" data-act="prog">Download .rcs</button><button class="btn" data-act="prog-copy">Copy</button></div>
    <pre class="code">${esc(programText().split('\n').slice(0, 26).join('\n'))}${S.steps.length > 18 ? '\n…' : ''}</pre>
    <h3>Project</h3><div class="btnrow"><button class="btn" data-act="save">Save .json</button><button class="btn" data-act="open">Open .json</button><button class="btn" data-act="link">Copy share link</button></div>
    <input type="file" id="file" accept=".json" hidden />`;
}
function programText() {
  const r = S.robot, T = TASKS[S.task];
  const lines = [`# Robot Cell Studio program — ${T.name}`, `# Robot: ${r.name} · ${r.modules.length} axes · tool: ${TOOLS[r.tool].name}`, `# Units: joints in degrees (linear axes in mm); TCP positions in mm in the robot base frame.`, `# Cycle time ${S.prog.cycle.toFixed(1)} s`, '', `PROGRAM ${S.task.toUpperCase()}`];
  S.prog.segs.forEach((s) => {
    const st = s.step;
    if (st.op === 'movej') lines.push(`  MOVEJ  J[${s.q1.map((v, i) => (isLinear(r.modules[i]) ? (v * 1000).toFixed(1) : fromRad(r.modules[i], v).toFixed(2))).join(', ')}]  SPEED ${st.speed || 100}%${st.label ? `   # ${st.label}` : ''}${s.ok ? '' : '   # UNREACHABLE'}`);
    else if (st.op === 'movel') { const F = fk(r, s.q1); lines.push(`  MOVEL  P[${F.tcp.map((v) => (v * 1000).toFixed(1)).join(', ')}]  AXIS[${F.toolAxis.map((v) => v.toFixed(3)).join(', ')}]  SPEED ${st.speed || 50}%${st.label ? `   # ${st.label}` : ''}${s.ok ? '' : '   # UNREACHABLE'}`); }
    else if (st.op === 'tool') lines.push(`  TOOL   ${st.tool.toUpperCase()}`);
    else lines.push(`  WAIT   ${(+st.t || 0.5).toFixed(2)}`);
  });
  lines.push('END', '');
  return lines.join('\n');
}
function download(name, text, type = 'text/plain') { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 800); }
$('#panel').addEventListener('click', (e) => {
  const d = e.target.closest('[data-del]'); if (d) { e.stopPropagation(); S.steps.splice(+d.dataset.del, 1); compileProg(); renderPanel(); return; }
  const li = e.target.closest('[data-step]'); if (li) { pause(); const s = S.prog.segs[+li.dataset.step]; S.t = s.t0 + s.dur - 1e-3; S.q = s.q1.slice(); S.segI = +li.dataset.step; pose(); renderPanel(); return; }
  const b = e.target.closest('[data-act]'); if (!b) return;
  const a = b.dataset.act, fname = S.robot.name.replace(/\W+/g, '_').toLowerCase();
  if (a === 'run') togglePlay();
  else if (a === 'loop') { S.loop = !S.loop; renderPanel(); }
  else if (a === 'regen') { generateTask(); renderPanel(); }
  else if (a === 'clear') { S.steps = []; compileProg(); renderPanel(); }
  else if (a === 'urdf') download(`${fname}.urdf`, toURDF(S.robot), 'application/xml');
  else if (a === 'urdf-copy') navigator.clipboard?.writeText(toURDF(S.robot)).then(() => toast('URDF copied'));
  else if (a === 'prog') download(`${S.task}.rcs`, programText());
  else if (a === 'prog-copy') navigator.clipboard?.writeText(programText()).then(() => toast('Program copied'));
  else if (a === 'save') download(`${fname}.json`, JSON.stringify({ robot: S.robot, task: S.task, steps: S.steps }, null, 1), 'application/json');
  else if (a === 'open') $('#file').click();
  else if (a === 'link') { history.replaceState(null, '', shareHash()); navigator.clipboard?.writeText(location.href).then(() => toast('Link copied — it contains the robot design'), () => toast('Link is in the address bar')); }
});
$('#panel').addEventListener('change', async (e) => {
  if (e.target.id !== 'file') return;
  const f = e.target.files[0]; if (!f) return;
  try { const d = JSON.parse(await f.text()); S.robot = d.robot; S.task = d.task || 'teach'; S.q = homeQ(S.robot); rebuild(true); if (d.steps) { S.steps = d.steps; compileProg(); } renderPanel(); toast(`Opened ${f.name}`); } catch (err) { toast(`Could not open: ${err.message}`); }
});

// ── playback ──
function togglePlay() { if (S.playing) pause(); else play(); }
function play() { if (!S.steps.length) return toast('The program is empty — teach some points first'); if (S.t >= S.prog.cycle - 0.01) rewind(); S.playing = true; $('#play-ico').setAttribute('d', 'M6 5h4v14H6zM14 5h4v14h-4z'); if (S.jog === 'tcp') document.querySelector('[data-jog=joints]').click(); if (S.tab === 'program') renderPanel(); }
function pause() { if (!S.playing) return; S.playing = false; $('#play-ico').setAttribute('d', 'M8 5v14l11-7z'); if (S.tab === 'program') renderPanel(); }
function rewind() {
  S.t = 0; S.segI = -1; S.tool = { closed: false, arc: false, spin: false }; S.held = null;
  const L = S.built?.layout;
  if (L?.kind === 'palletize') { for (const p of sc.S.parts) sc.cellG.remove(p.mesh); sc.S.parts = []; const p = sc.spawnPart(L, 0); p.state = 'ready'; p.t = 99; p.mesh.position.set(L.conv.end[0], L.conv.end[1], p.z); }
  if (L?.kind === 'screw') L.screwMeshes?.forEach((m) => { m.visible = false; });
  sc.clearBead();
  S.q = homeQ(S.robot); pose();
}
$('#play').addEventListener('click', togglePlay);
$('#rewind').addEventListener('click', () => { pause(); rewind(); renderPanel(); });
function onSegment(seg) {
  const st = seg.step, L = S.built?.layout;
  if (st.op !== 'tool') return;
  const F = fk(S.robot, S.q);
  if (st.tool === 'grip') {
    S.tool.closed = true;
    const part = sc.S.parts.find((p) => p.state === 'ready' && Math.hypot(p.mesh.position.x - F.tcp[0], p.mesh.position.y - F.tcp[1]) < 0.12 && Math.abs(p.mesh.position.z - F.tcp[2]) < 0.25);
    if (part) { part.state = 'held'; part.off = [part.mesh.position.x - F.tcp[0], part.mesh.position.y - F.tcp[1], part.mesh.position.z - F.tcp[2]]; S.held = part; if (L?.kind === 'palletize') { const n = sc.spawnPart(L, 0.6); n.state = 'arriving'; } }
  } else if (st.tool === 'release') { S.tool.closed = false; if (S.held) { S.held.state = 'placed'; S.held = null; } }
  else if (st.tool === 'arc on') S.tool.arc = true;
  else if (st.tool === 'arc off') S.tool.arc = false;
  else if (st.tool === 'spin on') S.tool.spin = true;
  else if (st.tool === 'spin off') { S.tool.spin = false; if (L?.kind === 'screw') { let bi = -1, bd = 0.05; L.holes.forEach((h, k) => { const d = Math.hypot(h[0] - F.tcp[0], h[1] - F.tcp[1]); if (d < bd) { bd = d; bi = k; } }); if (bi >= 0) L.screwMeshes[bi].visible = true; } }
}
function updateParts(dt) {
  const L = S.built?.layout; if (!L || L.kind !== 'palletize') return;
  for (const p of sc.S.parts) {
    if (p.state === 'arriving') { p.t += dt; const u = Math.min(1, Math.max(0, p.t / 2.2)); p.mesh.position.set(p.from[0] + (p.to[0] - p.from[0]) * u, p.from[1] + (p.to[1] - p.from[1]) * u, p.z); if (u >= 1) p.state = 'ready'; }
  }
}

// ── pose & status ──
let lastF = null;
function pose() {
  lastF = sc.pose(S.robot, S.q, S.tool);
  if (S.held && lastF) S.held.mesh.position.set(lastF.tcp[0] + S.held.off[0], lastF.tcp[1] + S.held.off[1], lastF.tcp[2] + S.held.off[2]);
  syncJog();
}
let statusMsg = null;
function setStatus(m) { statusMsg = m; }
function renderStatus() {
  const F = lastF; if (!F) return;
  const p = F.tcp.map((v) => (v * 1000).toFixed(0)).join(', ');
  const bits = [`<span>TCP ${p} mm</span>`, `<span>${S.playing ? `▶ step ${S.segI + 1}/${S.steps.length} · ${S.t.toFixed(1)} s` : 'Paused'}</span>`];
  if (S.held) bits.push(`<span class="ok">Holding ${S.built.layout.box.mass} kg</span>`);
  if (statusMsg) bits.push(`<span class="bad">${esc(statusMsg)}</span>`);
  $('#status').innerHTML = bits.join('');
}

// ── top-bar toggles & views ──
let curView = 'iso';
document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => { curView = b.dataset.view; document.querySelectorAll('[data-view]').forEach((x) => x.classList.toggle('active', x === b)); sc.view(curView, S.spec.reachH); }));
const tog = (id, fn, init) => { const b = $(id); let v = init; b.classList.toggle('active', v); b.addEventListener('click', () => { v = !v; b.classList.toggle('active', v); fn(v); }); };
tog('#t-env', (v) => { S.env = v; sc.setEnvelope(S.spec.pts, v); }, false);
tog('#t-frames', (v) => sc.showFrames(v), false);
tog('#t-fence', (v) => sc.showFence(v), true);
window.addEventListener('keydown', (e) => { if (e.target.closest('input, select')) return; if (e.key === ' ') { e.preventDefault(); togglePlay(); } });

// ── loop ──
new ResizeObserver(() => sc.resize()).observe($('.view'));
let last = performance.now(), uiAcc = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (S.playing && S.prog.segs.length) {
    S.t += dt * S.speed;
    if (S.t >= S.prog.cycle) { if (S.loop) { rewind(); S.playing = true; } else { S.t = S.prog.cycle; pause(); } }
    const r = sample(S.prog, S.t);
    if (r) {
      if (r.i !== S.segI) { for (let k = S.segI + 1; k <= r.i; k++) { S.segI = k; onSegment(S.prog.segs[k]); } if (S.tab === 'program') { const el = document.querySelector(`[data-step="${S.segI}"]`); document.querySelectorAll('.steps li.cur').forEach((x) => x.classList.remove('cur')); el?.classList.add('cur'); el?.scrollIntoView({ block: 'nearest' }); } }
      S.q = r.q; pose();
      setStatus(r.seg.ok ? null : `Step ${r.i + 1}: ${r.seg.msg}`);
    }
  }
  updateParts(dt * (S.playing ? S.speed : 1));
  if (lastF) sc.effects(lastF, S.playing ? S.tool : {}, dt * (S.playing ? S.speed : 1));
  sc.setLight(S.prog?.bad ? 'error' : S.playing ? 'running' : 'paused');
  uiAcc += dt;
  if (uiAcc > 0.3) { uiAcc = 0; renderStatus(); if (S.tab === 'specs') { const L = loads(S.robot, S.q, S.held ? S.built.layout.box.mass : 0); document.querySelectorAll('.jl .bar i').forEach((el, i) => { const l = L[i]; if (!l) return; el.style.width = `${Math.min(100, l.ratio * 100)}%`; el.className = l.ratio > 1 ? 'bad' : l.ratio > 0.8 ? 'warn' : ''; el.parentElement.nextElementSibling.textContent = `${l.load.toFixed(0)} / ${l.rating} ${isLinear(S.robot.modules[i]) ? 'N' : 'N·m'}`; }); } }
  sc.frame(dt);
  requestAnimationFrame(frame);
}

// ── boot ──
$('#jog-toggle').addEventListener('click', () => { const j = $('#jog'); j.classList.toggle('mini'); $('#jog-toggle span').textContent = j.classList.contains('mini') ? '▸' : '▾'; });
if (innerWidth < 860) $('#jog-toggle').click();
const h = loadFromHash();
S.q = homeQ(S.robot);
rebuild(true);
sc.resize(); sc.view('iso', S.spec.reachH, true);
markSpeed();
if (h.get('tab')) setTab(h.get('tab'));
if (h.get('run') !== '0') play();
requestAnimationFrame(frame);
setTimeout(() => $('#loader').classList.add('done'), 200);
void THREE; void DIRS;
