import { Sim, DT } from './sim.js';
import { createScene, AMR_COLORS } from './scene.js';
import { SCENARIOS, LIMITS, DEFAULTS, DESTS, CATS } from './config.js';
import { ZONES, OFFICE } from './layout.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = (v) => `${Math.round(v * 100)}%`;
let toastT;
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2400); }

// ── State from URL ─────────────────────────────────────────────────────────
const q = new URLSearchParams(location.hash.slice(1));
let scenario = SCENARIOS[q.get('s')] ? q.get('s') : 'normal';
const overrides = {};
for (const k of Object.keys(DEFAULTS)) if (q.has(k)) overrides[k] = isNaN(+q.get(k)) ? q.get(k) : +q.get(k);
let params = { ...DEFAULTS, ...SCENARIOS[scenario].p, ...overrides };
const sim = new Sim(params);
const S = { speed: +(q.get('speed') || 60), playing: q.get('pause') !== '1', sel: null };

const sc = createScene($('#scene'), $('#labels'));
window.__twin = { sim, sc };   // handle for automated browser tests

// ── Controls ───────────────────────────────────────────────────────────────
for (const [k, v] of Object.entries(SCENARIOS)) $('#scenario').insertAdjacentHTML('beforeend', `<option value="${k}">${esc(v.name)}</option>`);
$('#scenario').value = scenario;
$('#scenario').addEventListener('change', (e) => { scenario = e.target.value; params = { ...DEFAULTS, ...SCENARIOS[scenario].p }; sim.reset(params); sc.clearHeat(); syncControls(); updateHash(); toast(`Scenario: ${SCENARIOS[scenario].name}`); });
const SPEEDS = [1, 10, 60, 300];
$('.speeds').innerHTML = SPEEDS.map((s) => `<button data-speed="${s}">${s}×</button>`).join('');
document.querySelectorAll('[data-speed]').forEach((b) => b.addEventListener('click', () => { S.speed = +b.dataset.speed; markSpeed(); updateHash(); }));
function markSpeed() { document.querySelectorAll('[data-speed]').forEach((b) => b.classList.toggle('active', +b.dataset.speed === S.speed)); }
$('#play').addEventListener('click', togglePlay);
function togglePlay() { S.playing = !S.playing; $('#play-ico').setAttribute('d', S.playing ? 'M6 5h4v14H6zM14 5h4v14h-4z' : 'M8 5v14l11-7z'); }
document.querySelectorAll('.ctl[data-k]').forEach((el) => {
  const k = el.dataset.k, [min, max, step] = LIMITS[k]; const r = el.querySelector('input');
  Object.assign(r, { min, max, step });
  r.addEventListener('input', () => { el.querySelector('output').textContent = fmtParam(k, +r.value); });
  r.addEventListener('change', () => { setParam(k, +r.value); });
});
document.querySelectorAll('.seg2').forEach((g) => g.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setParam(g.dataset.k, b.dataset.v); }));
function fmtParam(k, v) { return k === 'inboundPerHour' ? v.toFixed(2) : k === 'ordersPerHour' ? `${v} (≈${Math.round(v * 24 * 0.98).toLocaleString('en-IN')}/day)` : String(v); }
function setParam(k, v) { params[k] = v; sim.setParams({ [k]: v }); syncControls(); updateHash(); }
function syncControls() {
  document.querySelectorAll('.ctl[data-k]').forEach((el) => { const k = el.dataset.k; el.querySelector('input').value = params[k]; el.querySelector('output').textContent = fmtParam(k, params[k]); });
  document.querySelectorAll('.seg2').forEach((g) => g.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.v === params[g.dataset.k])));
  document.querySelector('.ctl[data-k=batch]').classList.toggle('off', params.pickMode !== 'batch');
  $('#scen-desc').innerHTML = `<b>${esc(SCENARIOS[scenario].name)}</b>${esc(SCENARIOS[scenario].desc)}`;
}
function updateHash() {
  const p = new URLSearchParams({ s: scenario, speed: S.speed });
  const base = { ...DEFAULTS, ...SCENARIOS[scenario].p };
  for (const k of Object.keys(DEFAULTS)) if (params[k] !== base[k]) p.set(k, params[k]);
  history.replaceState(null, '', `#${p}`);
}
$('#reset').addEventListener('click', () => { sim.reset(params); sc.clearHeat(); S.sel = null; sc.select(null); $('#inspector').hidden = true; toast('Restarted the day at 06:00'); });
$('#share').addEventListener('click', () => { updateHash(); navigator.clipboard?.writeText(location.href).then(() => toast('Link copied with these settings'), () => toast('Link is in the address bar')); });
document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => { document.querySelectorAll('[data-view]').forEach((x) => x.classList.toggle('active', x === b)); sc.view(b.dataset.view); }));
const tog = (id, fn, init) => { const b = $(id); let v = init; b.classList.toggle('active', v); b.addEventListener('click', () => { v = !v; b.classList.toggle('active', v); fn(v); }); };
tog('#t-heat', (v) => sc.setHeat(v), false);
tog('#t-labels', (v) => sc.setLabels(v), true);
tog('#t-roof', (v) => sc.setRoof(v), false);
window.addEventListener('keydown', (e) => {
  if (e.target.closest('input, select')) return;
  if (e.key === ' ') { e.preventDefault(); togglePlay(); }
  else if (e.key === 'Escape') { S.sel = null; sc.select(null); $('#inspector').hidden = true; }
  else if (/^[1-4]$/.test(e.key)) { S.speed = SPEEDS[+e.key - 1]; markSpeed(); }
});

// legend
$('#legend').innerHTML = [['travel', 'robot to pick'], ['pick', 'picking'], ['toPack', 'to packing'], ['charging', 'charging'], ['idle', 'idle']].map(([k, l]) => `<span><i style="background:${AMR_COLORS[k]}"></i>${l}</span>`).join('') + `<span><i style="background:#f2b632"></i>reach truck</span>`;

// ── Picking & inspector ────────────────────────────────────────────────────
let downAt = null;
$('#scene').addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
$('#scene').addEventListener('pointerup', (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return;
  const hit = sc.pick(e, sim);
  if (!hit) return;
  S.sel = hit; sc.select(hit.kind === 'floor' ? null : hit);
  $('#hint').style.opacity = 0;
  renderInspector();
});
$('#inspector').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.act === 'close') { S.sel = null; sc.select(null); $('#inspector').hidden = true; }
  if (b.dataset.act === 'follow') { sc.follow(!sc.state.follow); renderInspector(); }
  if (b.dataset.act === 'focus') { const o = selObj(); if (o) sc.focus(o.x, o.y, S.sel.kind === 'truck' ? 60 : 22); }
});
function selObj() {
  const s = S.sel; if (!s) return null;
  if (s.kind === 'amr') return sim.amrs[s.id]; if (s.kind === 'fork') return sim.forks[s.id];
  if (s.kind === 'truck') return sim.trucks.find((t) => t.id === s.id);
  return null;
}
const STATE_N = { idle: 'Idle — waiting for work', travel: 'Driving to a pick face', pick: 'Picker loading items', toPack: 'Taking the tote to packing', drop: 'Handing over at pack station', toCharge: 'Driving to a charger', charging: 'Charging', park: 'Parked (fleet reduced)', toPick: 'Driving to the pallet', lift: 'Lifting the pallet', toDrop: 'Carrying the pallet', place: 'Placing the pallet', scheduled: 'Scheduled', arriving: 'Arriving / reversing to dock', docked: 'At the dock', waiting: 'Waiting in the yard', leaving: 'Departing' };
function renderInspector() {
  const el = $('#inspector'), s = S.sel;
  if (!s) { el.hidden = true; return; }
  let h = '';
  const row = (a, b) => `<dt>${esc(a)}</dt><dd>${b}</dd>`;
  if (s.kind === 'amr') {
    const a = sim.amrs[s.id]; if (!a) { el.hidden = true; return; }
    const b = Math.max(0, a.battery);
    h = `<div class="k">Autonomous mobile robot</div><h4>AMR-${String(a.id + 1).padStart(2, '0')}</h4><dl>${row('Status', esc(STATE_N[a.state] || a.state))}${row('Orders on board', a.orders.map((o) => `#${o.id}`).join(' ') || '—')}${row('Stop', a.stops.length ? `${Math.min(a.si + 1, a.stops.length)} of ${a.stops.length}` : '—')}${row('Next SKU', a.stops[a.si] ? esc(sim.skus[a.stops[a.si].face.sku].name) : '—')}${row('Distance today', `${(a.dist / 1000).toFixed(2)} km`)}${row('Battery', `${b.toFixed(0)}%`)}</dl><div class="batt"><i style="width:${b}%;background:${b < 25 ? '#ff5b5b' : b < 50 ? '#ffb020' : '#3fd0a0'}"></i></div>`;
  } else if (s.kind === 'fork') {
    const f = sim.forks[s.id]; if (!f) { el.hidden = true; return; }
    h = `<div class="k">Reach truck</div><h4>RT-${f.id + 1}</h4><dl>${row('Status', esc(STATE_N[f.state] || f.state))}${row('Task', f.task ? (f.task.kind === 'putaway' ? 'Putaway' : 'Replenish pick face') : '—')}${row('Pallet', f.load ? esc(sim.skus[f.load.sku].name) : f.task ? esc(sim.skus[f.task.sku].name) : '—')}${row('Lift height', `${(f.lift || 0).toFixed(1)} m`)}${row('Distance today', `${(f.dist / 1000).toFixed(2)} km`)}</dl>`;
  } else if (s.kind === 'truck') {
    const t = sim.trucks.find((x) => x.id === s.id); if (!t) { el.hidden = true; return; }
    h = `<div class="k">${t.kind === 'in' ? 'Inbound supplier truck' : `Outbound line-haul · ${esc(DESTS[t.dest].name)}`}</div><h4>${esc(t.plate)}</h4><dl>${row('Carrier', esc(t.carrier))}${row('Status', esc(STATE_N[t.phase] || t.phase))}${row('Door', t.door ? `${t.kind === 'in' ? 'I' : 'O'}${t.door.id + 1}` : 'yard')}`
      + (t.kind === 'in' ? `${row('Pallets left', `${t.cargo.length} / ${t.pallets}`)}${row('In yard since', sim.clock(t.tArrive))}` : `${row('Loaded', `${t.load} / ${t.cap} parcels`)}${row('Departs', sim.clock(t.dep))}${row('Distance', `${DESTS[t.dest].km} km`)}`) + '</dl>';
  } else if (s.kind === 'floor') h = floorInfo(s.x, s.y);
  if (s.kind !== 'floor') h += `<div class="btnrow"><button class="btn ${sc.state.follow ? 'primary' : ''}" data-act="follow">${sc.state.follow ? 'Following' : 'Follow'}</button><button class="btn" data-act="focus">Zoom to</button></div>`;
  el.innerHTML = `<button class="x" data-act="close" title="Close">×</button>${h}`;
  el.hidden = false;
}
function floorInfo(x, y) {
  let best = null, bd = 2.2;
  for (const f of sim.faces) { const d = Math.hypot(f.x - x, (f.side === 'N' ? f.y + 0.3 : f.y - 0.3) - y); if (d < bd) { bd = d; best = f; } }
  if (best) {
    const s = sim.skus[best.sku];
    return `<div class="k">Pick face · ${'AB'[best.block]}${best.row + 1}-${String(best.bay + 1).padStart(2, '0')}${best.side}</div><h4>${esc(s.name)}</h4><dl><dt>SKU</dt><dd>${s.code}</dd><dt>Category</dt><dd>${esc(CATS[s.cat].name)}</dd><dt>Velocity class</dt><dd>${s.cls} · ${(s.w * 100).toFixed(2)}% of lines</dd><dt>Units on face</dt><dd>${best.qty} / 60</dd><dt>Reserve pallets</dt><dd>${(s.pallets || []).length}</dd><dt>Replenishment</dt><dd>${best.replen === 'stockout' ? 'no stock' : best.replen ? 'requested' : '—'}</dd></dl>`;
  }
  const rs = sim.res.filter((r) => Math.abs(r.x - x) < 1.2 && Math.abs(r.y - y) < 1.4);
  if (rs.length) {
    const r0 = rs[0];
    return `<div class="k">Reserve bay · R${r0.row + 1}${r0.side}-${String(r0.bay + 1).padStart(2, '0')}</div><h4>${rs.filter((r) => r.pallet).length} of ${rs.length} positions full</h4><dl>${rs.map((r) => `<dt>Level ${r.level + 1}</dt><dd>${r.pallet ? esc(sim.skus[r.pallet.sku].name) : r.reserved ? 'reserved' : 'empty'}</dd>`).reverse().join('')}</dl>`;
  }
  const z = ZONES.reduce((b, zz) => (Math.hypot(zz.x - x, zz.y - y) < Math.hypot(b.x - x, b.y - y) ? zz : b));
  const inOffice = x < OFFICE.x1 && y > OFFICE.y0;
  return `<div class="k">Floor</div><h4>${esc(inOffice ? 'Office' : z.name)}</h4><p class="note">Click a rack face to see its SKU, or a robot, reach truck or truck to follow it.</p>`;
}

// ── Dashboard ──────────────────────────────────────────────────────────────
function cls(v, good, bad, higherBetter = true) { return higherBetter ? (v >= good ? 'good' : v <= bad ? 'bad' : 'warn') : (v <= good ? 'good' : v >= bad ? 'bad' : 'warn'); }
function renderDashboard() {
  const k = sim.kpis();
  $('#clock').textContent = sim.clock(); $('#day').textContent = `Day ${sim.day()} · ${sim.hour() >= 22 || sim.hour() < 6 ? 'night shift' : sim.hour() < 14 ? 'morning shift' : 'evening shift'}`;
  const tiles = [
    ['Shipped / hour', k.shippedHr, '', ''], ['Open orders', k.backlog, '', cls(k.statuses.queued, 20, 150, false)],
    ['Order to packed', k.cycleMin.toFixed(1), 'min', cls(k.cycleMin, 10, 45, false)], ['On-time shipped', pct(k.onTime), '', cls(k.onTime, 0.97, 0.9)],
    ['Fill rate', `${(k.fill * 100).toFixed(1)}%`, '', cls(k.fill, 0.995, 0.97)], ['Cost per order', `₹${k.costPerOrder.toFixed(0)}`, '', ''],
    ['Robot travel', k.travelPerOrder.toFixed(0), 'm/order', ''], ['Dock to stock', k.d2sMin.toFixed(0), 'min', cls(k.d2sMin, 30, 90, false)],
  ];
  $('#kpis').innerHTML = tiles.map(([l, v, u, c]) => `<div class="kpi ${c}"><small>${l}</small><b>${v}</b><i>${u}</i></div>`).join('');
  const st = k.statuses, mx = Math.max(...Object.values(st));
  $('#flow').innerHTML = [['queued', 'to pick'], ['picking', 'picking'], ['packing', 'packing'], ['sorting', 'sorter'], ['staged', 'at dock']].map(([s, l]) => `<div class="${s !== 'staged' && st[s] === mx && mx > 40 ? 'hot' : ''}"><b>${st[s]}</b><small>${l}</small></div>`).join('');
  $('#flow-total').textContent = `${sim.stats.shipped.toLocaleString('en-IN')} shipped today`;
  const ub = (l, v, extra = '') => `<div class="ubar"><span>${l}</span><div class="bar"><i class="${v > 0.9 ? 'bad' : v > 0.75 ? 'warn' : ''}" style="width:${Math.min(100, v * 100)}%"></i></div><span>${pct(v)}</span></div>${extra}`;
  const docksBusy = sim.inDoors.filter((d) => d.open && d.truck).length / Math.max(1, params.inboundDoors);
  $('#util').innerHTML = ub(`AMRs (${params.amrs})`, k.amrUtil) + ub(`Pack (${params.packStations})`, k.packUtil) + ub(`Reach trucks (${params.forklifts})`, k.forkUtil) + ub(`Inbound doors (${params.inboundDoors})`, docksBusy) + ub('Racking full', k.inv)
    + `<p class="note">${k.charging} robots charging · ${k.yardWaiting} trucks waiting in yard · ${k.staged} pallets staged · ${k.stockouts} empty pick faces · running cost ₹${Math.round(k.costHr).toLocaleString('en-IN')}/h</p>`;
  const ins = sim.insights(k);
  $('#insights').innerHTML = ins.map((i, n) => `<li class="${i.sev}">${esc(i.msg)}${i.fix ? `<button data-fix="${n}">Apply: ${esc(i.fixLabel)}</button>` : ''}</li>`).join('');
  $('#insights').fixes = ins;
  $('#log').innerHTML = sim.log.slice(0, 30).map((e) => `<li class="${e.kind}"><span>${sim.clock(e.t)}</span>${esc(e.msg)}</li>`).join('');
  drawCharts();
  if (S.sel && S.sel.kind !== 'floor') renderInspector();
}
$('#insights').addEventListener('click', (e) => {
  const b = e.target.closest('[data-fix]'); if (!b) return;
  const fix = $('#insights').fixes[+b.dataset.fix].fix;
  for (const [k, v] of Object.entries(fix)) params[k] = v;
  sim.setParams(fix); syncControls(); updateHash(); toast(`Applied: ${$('#insights').fixes[+b.dataset.fix].fixLabel}`);
});
function drawCharts() {
  const ser = sim.series.slice(-48);
  const c1 = $('#chart1'), g = c1.getContext('2d'), W = c1.width, H = c1.height;
  g.clearRect(0, 0, W, H);
  const pad = [34, 10, 10, 22];
  const axes = (g, max, unit) => { g.strokeStyle = 'rgba(255,255,255,.07)'; g.fillStyle = '#8b98a7'; g.font = '18px Inter'; for (let i = 0; i <= 2; i++) { const y = pad[2] + (H - pad[2] - pad[3]) * (1 - i / 2); g.beginPath(); g.moveTo(pad[0], y); g.lineTo(W - pad[1], y); g.stroke(); g.fillText(String(Math.round(max * i / 2)) + unit, 2, y + 6); } };
  if (ser.length < 2) { g.fillStyle = '#8b98a7'; g.font = '20px Inter'; g.fillText('Collecting data — first point after 15 sim-minutes', 20, H / 2); }
  else {
    const max = Math.max(10, ...ser.map((s) => Math.max(s.in, s.out)));
    axes(g, max, '');
    const bw = (W - pad[0] - pad[1]) / ser.length;
    ser.forEach((s, i) => {
      const x = pad[0] + i * bw, hh = (v) => (v / max) * (H - pad[2] - pad[3]);
      g.fillStyle = 'rgba(65,182,255,.75)'; g.fillRect(x + 1, H - pad[3] - hh(s.in), bw / 2 - 1, hh(s.in));
      g.fillStyle = 'rgba(63,208,160,.85)'; g.fillRect(x + bw / 2, H - pad[3] - hh(s.out), bw / 2 - 1, hh(s.out));
      if (i % 8 === 0) { g.fillStyle = '#8b98a7'; g.font = '16px Inter'; g.fillText(sim.clock(s.t), x, H - 4); }
    });
    g.font = '17px Inter'; g.fillStyle = '#41b6ff'; g.fillText('■ orders in', W - 230, 22); g.fillStyle = '#3fd0a0'; g.fillText('■ shipped', W - 110, 22);
  }
  const c2 = $('#chart2'), h2 = c2.getContext('2d'), H2 = c2.height;
  h2.clearRect(0, 0, W, H2);
  if (ser.length >= 2) {
    const max = Math.max(50, ...ser.map((s) => s.backlog));
    const X = (i) => pad[0] + (i / (ser.length - 1)) * (W - pad[0] - pad[1]), Y = (v, m) => pad[2] + (H2 - pad[2] - pad[3]) * (1 - v / m);
    h2.strokeStyle = 'rgba(255,255,255,.07)'; for (let i = 0; i <= 2; i++) { const y = Y(max * i / 2, max); h2.beginPath(); h2.moveTo(pad[0], y); h2.lineTo(W - pad[1], y); h2.stroke(); h2.fillStyle = '#8b98a7'; h2.font = '18px Inter'; h2.fillText(String(Math.round(max * i / 2)), 2, y + 6); }
    const line = (key, m, color, fill) => { h2.beginPath(); ser.forEach((s, i) => (i ? h2.lineTo(X(i), Y(s[key] * (m === 1 ? max : 1), max)) : h2.moveTo(X(i), Y(s[key] * (m === 1 ? max : 1), max)))); h2.strokeStyle = color; h2.lineWidth = 2.5; h2.stroke(); if (fill) { h2.lineTo(X(ser.length - 1), Y(0, max)); h2.lineTo(X(0), Y(0, max)); h2.fillStyle = fill; h2.fill(); } };
    line('backlog', 0, '#ff9f43', 'rgba(255,159,67,.15)'); line('amr', 1, '#3fd0a0'); line('pack', 1, '#a77bff');
    h2.font = '17px Inter'; h2.fillStyle = '#ff9f43'; h2.fillText('— open orders', W - 380, 22); h2.fillStyle = '#3fd0a0'; h2.fillText('— AMR util', W - 240, 22); h2.fillStyle = '#a77bff'; h2.fillText('— pack util', W - 120, 22);
  }
}

// ── Loop ───────────────────────────────────────────────────────────────────
function resize() { sc.resize(); }
new ResizeObserver(resize).observe($('.view'));
let last = performance.now(), acc = 0, uiAcc = 1;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (S.playing) { acc += dt * S.speed; let n = 0; while (acc >= DT && n < 1200) { sim.step(); acc -= DT; n++; } if (n >= 1200) acc = 0; }
  sc.animateCamera(dt);
  sc.update(sim, dt, now / 1000);
  uiAcc += dt; if (uiAcc > 0.4) { uiAcc = 0; renderDashboard(); }
  requestAnimationFrame(frame);
}
syncControls(); markSpeed(); if (!S.playing) { S.playing = true; togglePlay(); }
sc.view(q.get('view') || 'overview', true);
if (q.get('view')) document.querySelectorAll('[data-view]').forEach((x) => x.classList.toggle('active', x.dataset.view === q.get('view')));
resize();
if (q.has('warm')) sim.run(+q.get('warm') * 3600);
requestAnimationFrame(frame);
setTimeout(() => $('#loader').classList.add('done'), 200);
setTimeout(() => { $('#hint').style.opacity = 0; }, 9000);
