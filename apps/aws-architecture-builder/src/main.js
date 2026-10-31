import { SERVICES, SVC, CATS, GROUPS, GROUP } from './catalog.js';
import { LEVELS, SANDBOX } from './levels.js';
import { analyze, TILE } from './graph.js';

const $ = (s) => document.querySelector(s);
const GRID = 16;
const NS = 'http://www.w3.org/2000/svg';
const ALL_LEVELS = [...LEVELS, SANDBOX];
const KEY = 'cloud-bricks:v1';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const snap = (v) => Math.round(v / GRID) * GRID;

// ── State ──────────────────────────────────────────────────────────────────
const state = {
  level: null, nodes: [], edges: [], sel: null, view: { x: 40, y: 40, s: 1 },
  connect: false, pending: null, running: false, failedAz: null, celebrated: false, progress: {},
};
let nid = 1;
const newId = (p = 'n') => `${p}${Date.now().toString(36)}${(nid++).toString(36)}`;
try { state.progress = JSON.parse(localStorage.getItem(`${KEY}:progress`) || '{}'); } catch { state.progress = {}; }

// ── Icons: load the official SVGs once as data URIs (also makes PNG export self-contained) ──
const ICONS = {};
async function loadIcons() {
  const ids = [...SERVICES.map((s) => s.id), ...GROUPS.filter((g) => g.icon).map((g) => g.icon)];
  await Promise.all(ids.map(async (id) => {
    try { const t = await (await fetch(`./icons/${id}.svg`)).text(); ICONS[id] = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(t)}`; } catch { ICONS[id] = ''; }
  }));
  const defs = $('#defs');
  for (const s of SERVICES) defs.insertAdjacentHTML('beforeend', `<image id="i-${s.id}" href="${ICONS[s.id]}" width="48" height="48"/>`);
  for (const g of GROUPS) if (g.icon) defs.insertAdjacentHTML('beforeend', `<image id="i-${g.icon}" href="${ICONS[g.icon]}" width="28" height="28"/>`);
}

// ── Undo ───────────────────────────────────────────────────────────────────
const undoStack = [], redoStack = [];
const snapshot = () => JSON.stringify({ nodes: state.nodes, edges: state.edges });
function checkpoint() { undoStack.push(snapshot()); if (undoStack.length > 200) undoStack.shift(); redoStack.length = 0; syncButtons(); }
function restore(s) { const d = JSON.parse(s); state.nodes = d.nodes; state.edges = d.edges; state.sel = null; changed(); }
function undo() { if (!undoStack.length) return; redoStack.push(snapshot()); restore(undoStack.pop()); }
function redo() { if (!redoStack.length) return; undoStack.push(snapshot()); restore(redoStack.pop()); }
function syncButtons() { $('#undo').disabled = !undoStack.length; $('#redo').disabled = !redoStack.length; $('#delete').disabled = !state.sel; }

// ── Sound ──────────────────────────────────────────────────────────────────
let actx;
function sfx(kind) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain();
    const [f0, f1, d, v] = { snap: [1900, 650, 0.05, 0.12], link: [700, 1400, 0.08, 0.1], del: [420, 140, 0.09, 0.14], win: [520, 1560, 0.35, 0.12], bad: [200, 110, 0.15, 0.12] }[kind];
    o.type = kind === 'bad' ? 'square' : 'triangle';
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + d);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(actx.destination); o.start(t); o.stop(t + d + 0.02);
  } catch { /* no audio */ }
}
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2200); }

// ── Rendering ──────────────────────────────────────────────────────────────
const world = $('#world'), board = $('#board');
function applyView() {
  const { x, y, s } = state.view;
  world.setAttribute('transform', `translate(${x} ${y}) scale(${s})`);
  $('#zlabel').textContent = `${Math.round(s * 100)}%`;
}
function azLetters() {
  const azs = state.nodes.filter((n) => n.type === 'group' && n.kind === 'az').sort((a, b) => a.x - b.x || a.y - b.y);
  return new Map(azs.map((a, i) => [a.id, String.fromCharCode(65 + i)]));
}
function clipToRect(cx, cy, hw, hh, dx, dy) {
  const tx = dx ? hw / Math.abs(dx) : Infinity, ty = dy ? hh / Math.abs(dy) : Infinity;
  const t = Math.min(tx, ty);
  return [cx + dx * t, cy + dy * t];
}
let G = null;   // last analysis
function render() {
  const sel = state.sel;
  const live = state.running ? G.live : null;
  // groups, largest first
  const letters = azLetters();
  const groups = state.nodes.filter((n) => n.type === 'group').sort((a, b) => b.w * b.h - a.w * a.h);
  $('#l-groups').innerHTML = groups.map((n) => {
    const st = GROUP[n.kind];
    const label = n.kind === 'az' ? `Availability Zone ${letters.get(n.id) || ''}` : st.name;
    const failed = state.failedAz === n.id;
    const icon = st.icon ? `<rect x="0" y="0" width="28" height="28" fill="${st.color}"/><use href="#i-${st.icon}"/>` : '';
    return `<g class="group${sel?.id === n.id ? ' sel' : ''}" data-id="${n.id}" transform="translate(${n.x} ${n.y})">
      <rect class="gbody" width="${n.w}" height="${n.h}" fill="${st.fill}" stroke="${st.color}" stroke-width="${sel?.id === n.id ? 3 : 1.6}" ${st.dash ? `stroke-dasharray="${st.dash}"` : ''}/>
      ${failed ? `<rect width="${n.w}" height="${n.h}" fill="url(#hatch)"/><text x="${n.w / 2}" y="${n.h / 2}" text-anchor="middle" font-family="Inter, sans-serif" font-size="20" font-weight="800" fill="#DD344C">AZ OFFLINE</text>` : ''}
      <rect class="ghead" width="${Math.min(n.w, 260)}" height="28" fill="transparent"/>
      ${icon}
      <text x="${st.icon ? 36 : 8}" y="19" font-family="Inter, sans-serif" font-size="13" font-weight="600" fill="${st.color}">${esc(label)}</text>
      <rect class="handle" data-resize="${n.id}" x="${n.w - 14}" y="${n.h - 14}" width="14" height="14" fill="${st.color}" opacity="0.55" rx="2"/>
    </g>`;
  }).join('');
  // edges
  const byId = new Map(state.nodes.map((n) => [n.id, n]));
  $('#l-edges').innerHTML = state.edges.map((e) => {
    const a = byId.get(e.from), b = byId.get(e.to);
    if (!a || !b) return '';
    const ax = a.x + TILE.w / 2, ay = a.y + TILE.h / 2, bx = b.x + TILE.w / 2, by = b.y + TILE.h / 2;
    const L = Math.hypot(bx - ax, by - ay) || 1, dx = (bx - ax) / L, dy = (by - ay) / L;
    const [x1, y1] = clipToRect(ax, ay, TILE.w / 2 + 4, TILE.h / 2 + 4, dx, dy);
    const [x2, y2] = clipToRect(bx, by, TILE.w / 2 + 6, TILE.h / 2 + 6, -dx, -dy);
    const isLive = live && live.has(e.from) && live.has(e.to);
    const isSel = sel?.id === e.id;
    const d = `M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}`;
    const dots = isLive ? [0, 0.5].map((k) => `<circle r="4.5" fill="#ff9900" stroke="#fff" stroke-width="1.5"><animateMotion dur="1.4s" begin="${-k * 1.4}s" repeatCount="indefinite" path="${d}"/></circle>`).join('') : '';
    return `<g data-edge="${e.id}"><path class="edge${isLive ? ' live' : ''}${isSel ? ' sel' : ''}" d="${d}" fill="none" stroke="${isSel ? '#147EBA' : isLive ? '#ED7100' : '#232F3E'}" stroke-width="2" marker-end="url(#${isSel ? 'arrow-sel' : isLive ? 'arrow-live' : 'arrow'})"/>
      <path class="edge-hit" d="${d}" stroke="transparent" stroke-width="14" fill="none"/>${dots}</g>`;
  }).join('');
  // service bricks
  $('#l-nodes').innerHTML = state.nodes.filter((n) => n.type === 'svc').map((n) => {
    const s = SVC[n.kind], c = CATS[s.cat].color;
    const dim = (state.running && !live.has(n.id)) || G.blocked.has(n.id);
    const cls = `node${sel?.id === n.id ? ' sel' : ''}${dim ? ' dim' : ''}${state.pending === n.id ? ' pending' : ''}`;
    return `<g class="${cls}" data-id="${n.id}" transform="translate(${n.x} ${n.y})">
      <rect x="15" y="-6" width="16" height="8" rx="2.5" fill="${c}"/><rect x="49" y="-6" width="16" height="8" rx="2.5" fill="${c}"/>
      <rect class="body" width="${TILE.w}" height="${TILE.h}" rx="9" fill="#ffffff" stroke="${c}" stroke-width="1.6"/>
      <path d="M0 ${TILE.h - 9} h${TILE.w} v0 a9 9 0 0 1 -9 9 h${-(TILE.w - 18)} a9 9 0 0 1 -9 -9z" fill="${c}"/>
      <use href="#i-${n.kind}" x="16" y="7"/>
      <text x="${TILE.w / 2}" y="68" text-anchor="middle" font-family="Inter, sans-serif" font-size="10.5" font-weight="600" fill="#232F3E">${esc(s.short)}</text>
      <circle class="port" data-port="${n.id}" cx="${TILE.w}" cy="${TILE.h / 2}" r="7" fill="#ff9900" stroke="#fff" stroke-width="2"/>
    </g>`;
  }).join('');
  $('#empty-hint').classList.toggle('off', state.nodes.some((n) => n.type === 'svc' && !['users', 'mobile'].includes(n.kind)));
}

// ── Mission panel ──────────────────────────────────────────────────────────
function starsFor(g) {
  const L = state.level;
  if (!L.goals.length) return 0;
  const goals = L.goals.every((x) => x.test(g));
  if (!goals) return 0;
  const budget = L.budget == null || g.cost <= L.budget;
  const bonus = L.bonus.every((x) => x.test(g));
  return 1 + (budget ? 1 : 0) + (budget && bonus ? 1 : 0);
}
const starHtml = (n, of = 3) => Array.from({ length: of }, (_, i) => `<span class="${i < n ? 'on' : ''}">★</span>`).join('');
function panel() {
  const L = state.level, g = G;
  $('#goals').innerHTML = L.goals.map((x) => `<li class="${x.test(g) ? 'ok' : ''}"><i></i><span>${esc(x.text)}</span></li>`).join('') || '<li><span>Free build — no goals. Run traffic to see what’s reachable.</span></li>';
  $('#bonus').innerHTML = L.bonus.map((x) => `<li class="${x.test(g) ? 'ok' : ''}"><i></i><span>${esc(x.text)}</span></li>`).join('');
  $('#bonus-h').hidden = !L.bonus.length;
  $('#cost').textContent = `$${g.cost}`;
  const pct = L.budget ? Math.min(100, (g.cost / L.budget) * 100) : Math.min(100, g.cost / 10);
  $('#cost-bar').style.width = `${pct}%`;
  $('#cost-bar').classList.toggle('over', L.budget != null && g.cost > L.budget);
  $('#budget-label').textContent = L.budget != null ? `Budget $${L.budget}/mo · ${g.cost <= L.budget ? `$${L.budget - g.cost} left` : `$${g.cost - L.budget} over`}` : 'No budget in sandbox';
  const st = starsFor(g);
  $('#stars').innerHTML = L.goals.length ? starHtml(st) : '';
  $('#chaos').disabled = g.groupCount('az') < 1;
  // completion
  if (L.goals.length && st > 0) {
    const best = state.progress[L.id] || 0;
    if (st > best) { state.progress[L.id] = st; try { localStorage.setItem(`${KEY}:progress`, JSON.stringify(state.progress)); } catch { /* ignore */ } }
    if (!state.celebrated || st > state.celebrated) { state.celebrated = st; celebrate(st); }
  }
  inspector();
}
function inspector() {
  const box = $('#inspector'), s = state.sel;
  if (!s) { box.hidden = true; syncButtons(); return; }
  box.hidden = false;
  if (s.type === 'edge') {
    const e = state.edges.find((x) => x.id === s.id); if (!e) { box.hidden = true; return; }
    const a = state.nodes.find((n) => n.id === e.from), b = state.nodes.find((n) => n.id === e.to);
    box.innerHTML = `<b>Connection</b><p>${esc(SVC[a.kind].name)} → ${esc(SVC[b.kind].name)}</p><p><span>Press Delete to remove, or ⇄ to reverse.</span></p><p><button class="mini" id="reverse">⇄ Reverse direction</button></p>`;
    $('#reverse').onclick = () => { checkpoint(); [e.from, e.to] = [e.to, e.from]; changed(); };
  } else {
    const n = state.nodes.find((x) => x.id === s.id); if (!n) { box.hidden = true; return; }
    if (n.type === 'svc') {
      const sv = SVC[n.kind];
      const where = ['private', 'public', 'az', 'vpc', 'region'].map((k) => G.groupOf(n, k)).filter(Boolean).map((g) => GROUP[g.kind].name);
      box.innerHTML = `<div class="ih"><img src="${ICONS[n.kind]}" alt=""/><div><b>${esc(sv.name)}</b><span>${esc(CATS[sv.cat].name)} · $${sv.cost}/mo</span></div></div><p>${esc(sv.desc)}</p>${where.length ? `<p><span>Inside: ${esc(where.join(' › '))}</span></p>` : ''}`;
    } else {
      box.innerHTML = `<b>${esc(GROUP[n.kind].name)}</b><p><span>Drag the label to move it with everything inside; drag the corner to resize.</span></p>`;
    }
  }
  syncButtons();
}

let saveT;
function changed() {
  G = analyze(state.nodes, state.edges, state.failedAz);
  if (state.failedAz && !state.nodes.some((n) => n.id === state.failedAz)) { state.failedAz = null; G = analyze(state.nodes, state.edges); }
  render(); panel(); syncButtons();
  clearTimeout(saveT);
  saveT = setTimeout(() => { try { localStorage.setItem(`${KEY}:level:${state.level.id}`, snapshot()); } catch { /* ignore */ } }, 300);
}

// ── Celebration ────────────────────────────────────────────────────────────
function celebrate(st) {
  const L = state.level;
  $('#done-title').textContent = L.title;
  $('#done-stars').innerHTML = starHtml(st);
  const msgs = ['All goals met!', 'All goals met, within budget!', 'Perfect: goals, budget and every bonus!'];
  $('#done-text').textContent = `${msgs[st - 1]}${st < 3 ? ' Improve the design for more stars.' : ''}`;
  $('#done-learn').textContent = L.learn || '';
  const idx = LEVELS.findIndex((l) => l.id === L.id);
  $('#done-next').textContent = idx >= 0 && idx < LEVELS.length - 1 ? 'Next mission →' : 'All missions →';
  const burst = $('#burst'); burst.innerHTML = '';
  const cols = ['#ff9900', '#ED7100', '#8C4FFF', '#7AA116', '#C925D1', '#01A88D', '#E7157B'];
  for (let i = 0; i < 70; i++) burst.insertAdjacentHTML('beforeend', `<i style="left:${Math.random() * 100}%;background:${cols[i % cols.length]};animation-delay:${Math.random() * 0.5}s"></i>`);
  $('#done').hidden = false; sfx('win');
}
$('#done-stay').onclick = () => { $('#done').hidden = true; };
$('#done-next').onclick = () => {
  $('#done').hidden = true;
  const idx = LEVELS.findIndex((l) => l.id === state.level.id);
  if (idx >= 0 && idx < LEVELS.length - 1) startLevel(LEVELS[idx + 1]); else openMissions();
};

// ── Missions ───────────────────────────────────────────────────────────────
function openMissions() {
  $('#cards').innerHTML = ALL_LEVELS.map((L) => {
    const kinds = [...new Set(L.goals.flatMap((g) => g.kinds || []))].slice(0, 6);
    return `<button class="card" data-l="${L.id}"><div class="ct"><span class="lvl">${esc(L.tag)}</span>${L.goals.length ? `<span class="stars">${starHtml(state.progress[L.id] || 0)}</span>` : ''}</div>
      <b>${esc(L.title)}</b><p>${esc(L.story)}</p>
      <div class="icons">${kinds.map((k) => `<img src="${ICONS[k]}" alt="${esc(SVC[k].short)}"/>`).join('')}</div></button>`;
  }).join('');
  $('#missions').hidden = false;
}
$('#cards').addEventListener('click', (e) => { const c = e.target.closest('.card'); if (c) { startLevel(ALL_LEVELS.find((l) => l.id === c.dataset.l)); $('#missions').hidden = true; } });
$('#missions-close').onclick = () => { if (state.level) $('#missions').hidden = true; };
$('#mission-btn').onclick = openMissions;
$('#brand').onclick = openMissions;

function startLevel(L, { fresh = false } = {}) {
  state.level = L; state.sel = null; state.running = false; state.failedAz = null; state.pending = null; state.celebrated = 0;
  let data = null;
  if (!fresh) try { data = JSON.parse(localStorage.getItem(`${KEY}:level:${L.id}`) || 'null'); } catch { data = null; }
  data = data || JSON.parse(JSON.stringify(L.start));
  state.nodes = data.nodes; state.edges = data.edges;
  undoStack.length = redoStack.length = 0;
  $('#m-tag').textContent = L.tag; $('#m-title').textContent = L.title; $('#m-story').textContent = L.story;
  $('#mission-name').textContent = L.title;
  $('#budget-box').hidden = false;
  G = analyze(state.nodes, state.edges);
  state.celebrated = starsFor(G);      // don't re-celebrate a restored, already-solved build
  setRun(false); changed(); fit(false);
  try { localStorage.setItem(`${KEY}:last`, L.id); } catch { /* ignore */ }
}
$('#reset').onclick = () => { if (confirm('Reset this mission to its starting board?')) startLevel(state.level, { fresh: true }); };

// ── Palette ────────────────────────────────────────────────────────────────
function buildPalette(filter = '') {
  const f = filter.trim().toLowerCase();
  const match = (s) => !f || s.name.toLowerCase().includes(f) || s.short.toLowerCase().includes(f);
  let html = '';
  const groups = GROUPS.filter((g) => !f || g.name.toLowerCase().includes(f));
  if (groups.length) html += `<div class="pal-cat"><i style="--c:#232F3E"></i>Groups (baseplates)</div><div class="pal-grid">${groups.map((g) => `<div class="tile group" data-group="${g.id}" style="--c:${g.color}" title="${esc(g.name)}"><div class="gicon">${g.icon ? `<img src="${ICONS[g.icon]}" alt=""/>` : ''}</div><span>${esc(g.name)}</span></div>`).join('')}</div>`;
  for (const [cid, c] of Object.entries(CATS)) {
    const items = SERVICES.filter((s) => s.cat === cid && match(s));
    if (!items.length) continue;
    html += `<div class="pal-cat"><i style="--c:${c.color}"></i>${esc(c.name)}</div><div class="pal-grid">${items.map((s) => `<div class="tile" data-kind="${s.id}" style="--c:${c.color}" title="${esc(s.name)} — ${esc(s.desc)} ($${s.cost}/mo)"><img src="${ICONS[s.id]}" alt=""/><span>${esc(s.short)}</span></div>`).join('')}</div>`;
  }
  $('#pal-list').innerHTML = html || '<p style="color:#98a3b5;font-size:12px">No matches.</p>';
}
$('#search').addEventListener('input', (e) => buildPalette(e.target.value));

let pdrag = null;
$('#pal-list').addEventListener('pointerdown', (e) => {
  const t = e.target.closest('.tile'); if (!t) return;
  e.preventDefault();
  pdrag = { kind: t.dataset.kind, group: t.dataset.group, x: e.clientX, y: e.clientY, moved: false };
  const gh = $('#ghost');
  gh.style.setProperty('--c', t.style.getPropertyValue('--c'));
  gh.innerHTML = t.dataset.kind ? `<img src="${ICONS[t.dataset.kind]}" alt=""/>` : `<span style="font-size:10px;color:#232F3E;text-align:center">${esc(GROUP[t.dataset.group].name)}</span>`;
});
addEventListener('pointermove', (e) => {
  if (!pdrag) return;
  if (!pdrag.moved && Math.hypot(e.clientX - pdrag.x, e.clientY - pdrag.y) > 5) { pdrag.moved = true; $('#ghost').hidden = false; }
  if (pdrag.moved) { const gh = $('#ghost'); gh.style.left = `${e.clientX}px`; gh.style.top = `${e.clientY}px`; }
});
addEventListener('pointerup', (e) => {
  if (!pdrag) return;
  const d = pdrag; pdrag = null; $('#ghost').hidden = true;
  const r = board.getBoundingClientRect();
  let wx, wy;
  if (!d.moved) { [wx, wy] = toWorld(r.left + r.width / 2, r.top + r.height / 2); }
  else if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) [wx, wy] = toWorld(e.clientX, e.clientY);
  else return;
  checkpoint();
  if (d.kind) {
    const n = { id: newId(), type: 'svc', kind: d.kind, x: snap(wx - TILE.w / 2), y: snap(wy - TILE.h / 2) };
    if (!d.moved) nudgeFree(n);
    state.nodes.push(n); state.sel = { type: 'node', id: n.id };
  } else {
    const st = GROUP[d.group];
    const n = { id: newId('g'), type: 'group', kind: d.group, x: snap(wx - st.w / 2), y: snap(wy - 14), w: st.w, h: st.h };
    state.nodes.push(n); state.sel = { type: 'node', id: n.id };
  }
  sfx('snap'); changed();
});
function nudgeFree(n) {
  for (let k = 0; k < 40; k++) {
    if (!state.nodes.some((m) => m.type === 'svc' && Math.abs(m.x - n.x) < TILE.w && Math.abs(m.y - n.y) < TILE.h)) return;
    n.x += 96; if (k % 5 === 4) { n.x -= 480; n.y += 112; }
  }
}

// ── Board interaction ──────────────────────────────────────────────────────
function toWorld(cx, cy) { const r = board.getBoundingClientRect(); return [(cx - r.left - state.view.x) / state.view.s, (cy - r.top - state.view.y) / state.view.s]; }
const pointers = new Map();
let drag = null;
board.addEventListener('pointerdown', (e) => {
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  board.setPointerCapture(e.pointerId);
  if (pointers.size === 2) { const [a, b] = [...pointers.values()]; drag = { mode: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), s0: state.view.s, mid: [(a.x + b.x) / 2, (a.y + b.y) / 2], v0: { ...state.view } }; return; }
  const [wx, wy] = toWorld(e.clientX, e.clientY);
  const t = e.target;
  const start = { x: e.clientX, y: e.clientY, wx, wy, moved: false };
  if (e.button === 1 || e.button === 2) { drag = { mode: 'pan', ...start, v0: { ...state.view } }; board.classList.add('panning'); return; }
  const port = t.closest('[data-port]');
  if (port && !state.connect) { drag = { mode: 'link', from: port.dataset.port, ...start }; return; }
  const rs = t.closest('[data-resize]');
  if (rs) { const n = state.nodes.find((x) => x.id === rs.dataset.resize); drag = { mode: 'resize', n, w0: n.w, h0: n.h, ...start, snap: snapshot() }; return; }
  const node = t.closest('.node');
  if (node) {
    const n = state.nodes.find((x) => x.id === node.dataset.id);
    if (state.connect) { connectTap(n); return; }
    state.sel = { type: 'node', id: n.id };
    drag = { mode: 'move', items: [{ n, x0: n.x, y0: n.y }], ...start, snap: snapshot() };
    render(); inspector(); return;
  }
  const edge = t.closest('[data-edge]');
  if (edge) { state.sel = { type: 'edge', id: edge.dataset.edge }; render(); inspector(); return; }
  const head = t.closest('.ghead');
  if (head) {
    const g = state.nodes.find((x) => x.id === head.closest('.group').dataset.id);
    state.sel = { type: 'node', id: g.id };
    // carry everything sitting on this plate
    const inside = (m) => (m.type === 'svc' ? [m.x + TILE.w / 2, m.y + TILE.h / 2] : [m.x + 1, m.y + 1]);
    const contained = state.nodes.filter((m) => m !== g && (() => { const [cx, cy] = inside(m); return cx >= g.x && cx <= g.x + g.w && cy >= g.y && cy <= g.y + g.h && (m.type === 'svc' || (m.x + m.w <= g.x + g.w + 1 && m.y + m.h <= g.y + g.h + 1)); })());
    drag = { mode: 'move', items: [g, ...contained].map((n) => ({ n, x0: n.x, y0: n.y })), ...start, snap: snapshot() };
    render(); inspector(); return;
  }
  if (state.sel) { state.sel = null; render(); inspector(); }
  drag = { mode: 'pan', ...start, v0: { ...state.view } };
  board.classList.add('panning');
});
board.addEventListener('pointermove', (e) => {
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (!drag) return;
  if (drag.mode === 'pinch') {
    if (pointers.size < 2) return;
    const [a, b] = [...pointers.values()];
    const s = Math.min(2.5, Math.max(0.25, drag.s0 * Math.hypot(a.x - b.x, a.y - b.y) / drag.d0));
    const r = board.getBoundingClientRect(), mx = drag.mid[0] - r.left, my = drag.mid[1] - r.top;
    state.view.s = s; state.view.x = mx - (mx - drag.v0.x) * (s / drag.v0.s); state.view.y = my - (my - drag.v0.y) * (s / drag.v0.s);
    applyView(); return;
  }
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (!drag.moved && Math.hypot(dx, dy) > 3) drag.moved = true;
  if (!drag.moved) return;
  if (drag.mode === 'pan') { state.view.x = drag.v0.x + dx; state.view.y = drag.v0.y + dy; applyView(); }
  else if (drag.mode === 'move') {
    const ddx = snap(dx / state.view.s), ddy = snap(dy / state.view.s);
    for (const it of drag.items) { it.n.x = it.x0 + ddx; it.n.y = it.y0 + ddy; }
    render();
  } else if (drag.mode === 'resize') {
    drag.n.w = Math.max(128, snap(drag.w0 + dx / state.view.s)); drag.n.h = Math.max(96, snap(drag.h0 + dy / state.view.s));
    render();
  } else if (drag.mode === 'link') {
    const n = state.nodes.find((x) => x.id === drag.from);
    const [wx, wy] = toWorld(e.clientX, e.clientY);
    $('#l-fx').innerHTML = `<path d="M${n.x + TILE.w} ${n.y + TILE.h / 2} L${wx} ${wy}" stroke="#ff9900" stroke-width="2.5" stroke-dasharray="6 5" fill="none" marker-end="url(#arrow-live)"/>`;
  }
});
function endDrag(e) {
  pointers.delete(e.pointerId);
  board.classList.remove('panning');
  if (!drag) return;
  const d = drag; drag = null;
  if (d.mode === 'pinch') return;
  if (d.mode === 'link') {
    $('#l-fx').innerHTML = '';
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('.node');
    if (el && el.dataset.id !== d.from) addEdge(d.from, el.dataset.id);
    else if (!d.moved) { state.connect = true; $('#connect').classList.add('active'); connectTap(state.nodes.find((x) => x.id === d.from)); }
    return;
  }
  if ((d.mode === 'move' || d.mode === 'resize') && d.moved) {
    undoStack.push(d.snap); redoStack.length = 0; sfx('snap'); changed();
  }
}
board.addEventListener('pointerup', endDrag);
board.addEventListener('pointercancel', endDrag);
board.addEventListener('contextmenu', (e) => e.preventDefault());
board.addEventListener('wheel', (e) => {
  e.preventDefault();
  const r = board.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
  zoomAt(mx, my, Math.exp(-e.deltaY * 0.0015));
}, { passive: false });
function zoomAt(mx, my, k) {
  const s = Math.min(2.5, Math.max(0.25, state.view.s * k)), f = s / state.view.s;
  state.view.x = mx - (mx - state.view.x) * f; state.view.y = my - (my - state.view.y) * f; state.view.s = s;
  applyView();
}
$('#zin').onclick = () => { const r = board.getBoundingClientRect(); zoomAt(r.width / 2, r.height / 2, 1.2); };
$('#zout').onclick = () => { const r = board.getBoundingClientRect(); zoomAt(r.width / 2, r.height / 2, 1 / 1.2); };
function fit(animate = true) {
  const ns = state.nodes; const r = board.getBoundingClientRect();
  if (!ns.length || !r.width) { state.view = { x: 60, y: 60, s: 1 }; applyView(); return; }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const n of ns) { const w = n.type === 'svc' ? TILE.w : n.w, h = n.type === 'svc' ? TILE.h : n.h; x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y - 8); x1 = Math.max(x1, n.x + w); y1 = Math.max(y1, n.y + h); }
  const pad = 60;
  const s = Math.min(1.3, Math.max(0.25, Math.min((r.width - pad * 2) / (x1 - x0), (r.height - pad * 2) / (y1 - y0))));
  state.view = { s, x: (r.width - (x1 - x0) * s) / 2 - x0 * s, y: (r.height - (y1 - y0) * s) / 2 - y0 * s };
  applyView();
}
$('#fit').onclick = () => fit();

function addEdge(from, to) {
  if (from === to) return;
  const a = state.nodes.find((n) => n.id === from), b = state.nodes.find((n) => n.id === to);
  if (!a || !b || a.type !== 'svc' || b.type !== 'svc') return;
  if (state.edges.some((e) => e.from === from && e.to === to)) { toast('Already connected'); return; }
  checkpoint();
  state.edges.push({ id: newId('e'), from, to });
  sfx('link'); toast(`${SVC[a.kind].short} → ${SVC[b.kind].short}`); changed();
}
function connectTap(n) {
  if (!state.pending) { state.pending = n.id; render(); toast(`Connecting from ${SVC[n.kind].short}… tap the target`); return; }
  const from = state.pending; state.pending = null;
  if (from !== n.id) addEdge(from, n.id); else render();
}
$('#connect').onclick = () => { state.connect = !state.connect; state.pending = null; $('#connect').classList.toggle('active', state.connect); board.classList.toggle('connecting', state.connect); render(); };

function deleteSel() {
  const s = state.sel; if (!s) return;
  checkpoint();
  if (s.type === 'edge') state.edges = state.edges.filter((e) => e.id !== s.id);
  else { state.nodes = state.nodes.filter((n) => n.id !== s.id); state.edges = state.edges.filter((e) => e.from !== s.id && e.to !== s.id); }
  state.sel = null; sfx('del'); changed();
}
$('#delete').onclick = deleteSel;
$('#undo').onclick = undo; $('#redo').onclick = redo;

// ── Simulation ─────────────────────────────────────────────────────────────
function setRun(on) {
  state.running = on;
  $('#run').classList.toggle('on', on);
  $('#run span').textContent = on ? 'Stop traffic' : 'Run traffic';
}
$('#run').onclick = () => {
  setRun(!state.running);
  changed();
  if (state.running) {
    const n = G.live.size;
    const srcs = state.nodes.filter((x) => x.type === 'svc' && ['users', 'mobile', 'internet', 'office'].includes(x.kind)).length;
    toast(srcs ? `Requests reach ${Math.max(0, n - srcs)} service${n - srcs === 1 ? '' : 's'} · dimmed bricks are off the request path` : 'Add Users or a Mobile app as a traffic source');
  }
};
$('#chaos').onclick = () => {
  const azs = state.nodes.filter((n) => n.type === 'group' && n.kind === 'az').sort((a, b) => a.x - b.x);
  if (!azs.length) { toast('Add Availability Zones first'); return; }
  const i = state.failedAz ? azs.findIndex((a) => a.id === state.failedAz) : -1;
  state.failedAz = i + 1 < azs.length ? azs[i + 1].id : null;
  $('#chaos').classList.toggle('on', !!state.failedAz);
  $('#chaos span').textContent = state.failedAz ? `AZ ${String.fromCharCode(66 + i)} down · next` : 'Fail an AZ';
  if (state.failedAz) { setRun(true); sfx('bad'); }
  changed();
  if (state.failedAz) {
    const L = state.level, target = L.chaos ? 'rds' : null;
    if (target) toast(G.path(['users', 'mobile'], target, G.blocked) ? '✅ Still serving: the other AZ took over' : '❌ Outage: no path left to the database');
    else toast('AZ offline: dimmed services are unreachable');
  }
};
$('#hint').onclick = () => {
  const L = state.level;
  const next = L.goals.find((x) => !x.test(G)) || L.bonus.find((x) => !x.test(G));
  document.querySelectorAll('.tile.hint').forEach((t) => t.classList.remove('hint'));
  if (!next) { toast(L.goals.length ? 'Everything is done. Nice work!' : 'Sandbox: build anything you like'); return; }
  toast(next.hint || `Try: ${next.text}`);
  for (const k of next.kinds || []) { const t = document.querySelector(`.tile[data-kind="${k}"]`); if (t) { t.classList.add('hint'); t.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); setTimeout(() => t.classList.remove('hint'), 4000); } }
};

// ── Export / import ────────────────────────────────────────────────────────
function download(name, url) { const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
$('#export').onclick = () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify({ v: 1, level: state.level.id, nodes: state.nodes, edges: state.edges }, null, 1)], { type: 'application/json' }));
  download(`${state.level.id}.architecture.json`, url); setTimeout(() => URL.revokeObjectURL(url), 2000);
};
$('#import').onclick = () => $('#file').click();
$('#file').onchange = async (e) => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    const nodes = (d.nodes || []).filter((n) => n && typeof n.id === 'string' && ((n.type === 'svc' && SVC[n.kind]) || (n.type === 'group' && GROUP[n.kind])) && Number.isFinite(n.x) && Number.isFinite(n.y));
    const ids = new Set(nodes.map((n) => n.id));
    const edges = (d.edges || []).filter((x) => x && ids.has(x.from) && ids.has(x.to)).map((x) => ({ id: newId('e'), from: x.from, to: x.to }));
    checkpoint(); state.nodes = nodes; state.edges = edges; state.sel = null; changed(); fit(); toast(`Imported ${nodes.length} pieces`);
  } catch { toast('Could not read that file'); }
};
$('#png').onclick = () => {
  if (!state.nodes.length) return;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const n of state.nodes) { const w = n.type === 'svc' ? TILE.w : n.w, h = n.type === 'svc' ? TILE.h : n.h; x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y - 8); x1 = Math.max(x1, n.x + w); y1 = Math.max(y1, n.y + h); }
  const pad = 32, W = x1 - x0 + pad * 2, H = y1 - y0 + pad * 2;
  const clone = board.cloneNode(true);
  clone.setAttribute('viewBox', `${x0 - pad} ${y0 - pad} ${W} ${H}`);
  clone.setAttribute('width', W); clone.setAttribute('height', H);
  const w = clone.querySelector('#world'); w.removeAttribute('transform');
  w.querySelector('rect').setAttribute('fill', '#ffffff');
  clone.querySelectorAll('.port, .handle, animateMotion').forEach((el) => el.remove());
  clone.querySelectorAll('.node.dim').forEach((el) => el.setAttribute('opacity', '0.4'));
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }));
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas'); c.width = W * 2; c.height = H * 2;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.scale(2, 2); g.drawImage(img, 0, 0);
    download(`${state.level.id}-architecture.png`, c.toDataURL('image/png')); URL.revokeObjectURL(url);
  };
  img.onerror = () => toast('PNG export failed in this browser');
  img.src = url;
};

// ── Keyboard ───────────────────────────────────────────────────────────────
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
  if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (mod && k === 'y') { e.preventDefault(); redo(); return; }
  if (mod && k === 'd' && state.sel?.type === 'node') {
    e.preventDefault();
    const n = state.nodes.find((x) => x.id === state.sel.id);
    if (n?.type === 'svc') { checkpoint(); const m = { ...n, id: newId(), x: n.x + 96 }; state.nodes.push(m); state.sel = { type: 'node', id: m.id }; sfx('snap'); changed(); }
    return;
  }
  if (mod) return;
  if (k === 'delete' || k === 'backspace') { e.preventDefault(); deleteSel(); }
  else if (k === 'escape') { state.sel = null; state.pending = null; if (state.connect) $('#connect').click(); else changed(); $('#missions').hidden = !state.level ? false : true; $('#done').hidden = true; }
  else if (k === 'c') $('#connect').click();
  else if (k === 'f') fit();
  else if (k === 'r') $('#run').click();
  else if (k === '+' || k === '=') $('#zin').click();
  else if (k === '-') $('#zout').click();
});
addEventListener('resize', () => applyView());

// mobile: goals sheet toggle
$('#mission-btn').addEventListener('contextmenu', (e) => e.preventDefault());
if (matchMedia('(max-width: 760px)').matches) {
  const b = document.createElement('button'); b.className = 'mission-btn'; b.textContent = 'Goals';
  b.onclick = () => $('#side').classList.toggle('open');
  $('.top').insertBefore(b, $('.top .seg'));
}

// ── Start ──────────────────────────────────────────────────────────────────
await loadIcons();
buildPalette();
let last = null;
try { last = localStorage.getItem(`${KEY}:last`); } catch { /* ignore */ }
startLevel(ALL_LEVELS.find((l) => l.id === last) || LEVELS[0]);
if (!last) openMissions();
window.__arch = { state, startLevel, LEVELS, analyze, get G() { return G; }, addEdge, fit };
