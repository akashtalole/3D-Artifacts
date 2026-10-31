/**
 * Discrete-time simulation of the fulfilment centre. No rendering here: the scene reads the
 * entity positions. Time is in seconds since day 0, 00:00.
 */
import { DEFAULTS, DESTS, CARRIERS, HOURLY, COST, rng, makeSkus } from './config.js';
import { OUT_DOORS, IN_DOORS, PACK, CONVEYOR, CHARGERS, LANE, STAGE_Y, pickFaces, reservePositions, buildGrid } from './layout.js';
import { Planner, pathLength } from './path.js';

export const DT = 0.5;
const AMR_V = 1.5, FORK_V = 2.0, ROAD_V = 7, REV_V = 2.2;
const FACE_MAX = 60, FACE_MIN = 18, PALLET_UNITS = 40;
const TRAILER = 13.6;
let GRID = null, PLANNER = null;

export class Sim {
  constructor(params = {}, seed = 7) { this.reset(params, seed); }

  reset(params = {}, seed = 7) {
    this.p = { ...DEFAULTS, ...params };
    this.rand = rng(seed);
    GRID ||= buildGrid(); PLANNER ||= new Planner(GRID);
    this.plan = PLANNER;
    for (const c of CHARGERS) c.busy = null;
    this.t = 6 * 3600; this.t0 = this.t;
    this.skus = makeSkus(480, this.rand);
    this.faces = pickFaces();
    this.res = reservePositions();
    this.slot();
    // inventory
    for (const f of this.faces) { f.qty = Math.round(FACE_MAX * (0.45 + this.rand() * 0.55)); f.replen = false; }
    const order = [...this.res].sort(() => this.rand() - 0.5);
    let k = 0;
    for (const r of order) { if (k++ > this.res.length * 0.62) break; const s = this.pickSku(); this.store(r, s.id); }
    this.orders = []; this.queue = []; this.nextOrder = this.t;
    this.amrs = []; this.forks = []; this.packs = [];
    this.parcels = []; this.lanes = DESTS.map((d, i) => ({ id: i, orders: [], door: OUT_DOORS[i] }));
    this.trucks = []; this.inDoors = IN_DOORS.map((d) => ({ ...d, truck: null, staged: [] })); this.outDoors = OUT_DOORS.map((d) => ({ ...d, truck: null }));
    this.fTasks = []; this.nextIn = this.t + 1500; this.truckN = 0; this.orderN = 0; this.palletN = 0;
    this.stats = { ordersIn: 0, shipped: 0, onTime: 0, late: 0, lines: 0, unitsOrdered: 0, unitsPicked: 0, short: 0, amrDist: 0, forkDist: 0, palletsIn: 0, putaways: 0, replens: 0, trucksIn: 0, trucksOut: 0, cost: 0 };
    this.recent = { shipped: [], cycle: [], d2s: [], turn: [], travel: [] };
    this.series = []; this.bucket = this.newBucket(); this.log = [];
    this.heat = new Float32Array(132 * 84);
    this.sync();
    // outbound schedule: each destination departs every 4 h, staggered
    this.departures = DESTS.map((d, i) => ({ next: this.nextDeparture(i, this.t) }));
    for (let i = 0; i < DESTS.length; i++) this.callOutbound(i, this.departures[i].next);
    // two suppliers already at the dock when the shift starts
    for (const i of [1, 4]) { const d = this.inDoors[i]; const tr = this.newTruck('in', d); d.truck = tr; tr.door = d; tr.phase = 'docked'; tr.tArrive = this.t - 900; tr.tDock = this.t; tr.pallets = 22; tr.cargo = Array.from({ length: i === 1 ? 14 : 20 }, () => this.pickSkuForInbound()); tr.x = d.x; tr.y = 84.3; tr.h = Math.PI / 2; tr.next = this.t + 30 * i; tr.route = { pts: [], rev: [] }; this.stats.trucksIn++; }
    this.event('info', 'Shift started — 06:00');
  }
  /** Apply parameter changes without resetting state. */
  setParams(p) { const old = this.p; this.p = { ...this.p, ...p }; if (p.slotting && p.slotting !== old.slotting) { this.slot(); this.event('info', `Re-slotted pick faces (${p.slotting === 'abc' ? 'ABC: fast movers near packing' : 'random'})`); } this.sync(); }

  // ── master data helpers ──
  pickSku() { const r = this.rand(); let lo = 0, hi = this.skus.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (this.skus[m].cum < r) lo = m + 1; else hi = m; } return this.skus[lo]; }
  slot() {
    const packY = 22;
    const ranked = [...this.faces].sort((a, b) => (Math.abs(a.ax - 30) * 0.7 + (a.ay - packY)) - (Math.abs(b.ax - 30) * 0.7 + (b.ay - packY)));
    const skus = this.p.slotting === 'abc' ? this.skus : [...this.skus].sort(() => this.rand() - 0.5);
    const keepQty = this.faces.map((f) => ({ sku: f.sku, qty: f.qty }));
    ranked.forEach((f, i) => { f.sku = skus[i].id; skus[i].face = f.id; });
    if (keepQty[0].sku !== undefined) { const byS = new Map(keepQty.map((k) => [k.sku, k.qty])); for (const f of this.faces) f.qty = byS.get(f.sku) ?? f.qty; }
  }
  store(r, sku) { r.pallet = { sku, id: ++this.palletN }; (this.skus[sku].pallets ||= []).push(r.id); }
  hour() { return Math.floor(this.t / 3600) % 24; }
  clock(t = this.t) { const h = Math.floor(t / 3600) % 24, m = Math.floor(t / 60) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; }
  day(t = this.t) { return Math.floor(t / 86400) + 1; }
  event(kind, msg) { this.log.unshift({ t: this.t, kind, msg }); if (this.log.length > 60) this.log.pop(); }
  newBucket() { return { t: this.t, in: 0, out: 0, lines: 0, amrBusy: 0, forkBusy: 0, packBusy: 0, n: 0 }; }

  /** Grow or shrink fleets to match parameters. */
  sync() {
    while (this.amrs.length < this.p.amrs) { const c = CHARGERS[this.amrs.length % CHARGERS.length]; this.amrs.push({ id: this.amrs.length, x: 6 + (this.amrs.length % 8) * 1.2, y: 26 + Math.floor(this.amrs.length / 8) * 1.2, h: 0, state: 'idle', path: null, battery: 55 + this.rand() * 45, orders: [], stops: [], dist: 0, busy: 0, carry: 0, charger: null, home: c }); }
    for (const a of this.amrs) a.retired = a.id >= this.p.amrs;
    while (this.forks.length < this.p.forklifts) this.forks.push({ id: this.forks.length, x: 84 + this.forks.length * 2, y: 72, h: 0, state: 'idle', path: null, task: null, lift: 0, load: null, dist: 0 });
    for (const f of this.forks) f.retired = f.id >= this.p.forklifts;
    while (this.packs.length < PACK.length) { const s = PACK[this.packs.length]; this.packs.push({ ...s, queue: [], cur: null, until: 0, done: 0 }); }
    this.packs.forEach((s, i) => { s.open = i < this.p.packStations; });
    this.inDoors.forEach((d, i) => { d.open = i < this.p.inboundDoors; });
  }

  // ── main loop ──
  step(dt = DT) {
    this.t += dt;
    this.genOrders(); this.genInbound();
    for (const a of this.amrs) { this.amrStep(a, dt); if (a.path) this.heatAt(a.x, a.y, dt); }
    for (const f of this.forks) { this.forkStep(f, dt); if (f.path) this.heatAt(f.x, f.y, dt * 0.8); }
    for (const s of this.packs) this.packStep(s);
    this.conveyorStep(dt);
    for (const tr of [...this.trucks]) this.truckStep(tr, dt);
    this.dockStep(dt);
    // stats bucket
    const b = this.bucket; b.n++;
    const act = this.amrs.filter((a) => !a.retired), fk = this.forks.filter((f) => !f.retired), pk = this.packs.filter((s) => s.open);
    b.amrBusy += act.filter((a) => a.orders.length).length / Math.max(1, act.length);
    b.forkBusy += fk.filter((f) => f.task).length / Math.max(1, fk.length);
    b.packBusy += pk.filter((s) => s.cur).length / Math.max(1, pk.length);
    this.stats.cost += this.costPerHour() * dt / 3600;
    if (this.t - b.t >= 900) this.closeBucket();
  }
  heatAt(x, y, w) { const i = Math.floor(y) * 132 + Math.floor(x); if (i >= 0 && i < this.heat.length) this.heat[i] += w; }
  run(seconds) { const n = Math.round(seconds / DT); for (let i = 0; i < n; i++) this.step(); }
  closeBucket() {
    const b = this.bucket;
    this.series.push({ t: b.t, in: b.in, out: b.out, lines: b.lines, amr: b.amrBusy / b.n, fork: b.forkBusy / b.n, pack: b.packBusy / b.n, backlog: this.backlog(), inv: this.invPct(), stockouts: this.stockouts() });
    if (this.series.length > 96 * 3) this.series.shift();
    this.bucket = this.newBucket();
  }
  costPerHour() { const p = this.p; return p.amrs * COST.amr + Math.ceil(p.amrs / 3) * COST.picker + p.packStations * COST.packer + p.forklifts * COST.forklift + p.inboundDoors * COST.dockCrew * 0.5 + COST.fixed; }

  // ── demand ──
  genOrders() {
    while (this.nextOrder <= this.t) {
      const o = this.newOrder(this.nextOrder);
      this.orders.push(o); this.queue.push(o); this.stats.ordersIn++; this.bucket.in++;
      const rate = this.p.ordersPerHour * HOURLY[Math.floor(this.nextOrder / 3600) % 24] / 3600;
      this.nextOrder += -Math.log(1 - this.rand()) / Math.max(rate, 1e-4);
    }
    if (this.orders.length > 6000) this.orders = this.orders.filter((o) => o.status !== 'shipped' || this.t - o.tShip < 3600);
  }
  newOrder(t) {
    const r = this.rand(), n = r < 0.45 ? 1 : r < 0.75 ? 2 : r < 0.9 ? 3 : 4;
    const lines = [], used = new Set();
    for (let i = 0; i < n; i++) { let s = this.pickSku(); let g = 0; while (used.has(s.id) && g++ < 5) s = this.pickSku(); used.add(s.id); const q = this.rand(); lines.push({ sku: s.id, qty: q < 0.75 ? 1 : q < 0.95 ? 2 : 3, picked: 0 }); }
    let d = this.rand(), dest = 0; for (; dest < DESTS.length - 1; dest++) { d -= DESTS[dest].share; if (d < 0) break; }
    for (const l of lines) this.stats.unitsOrdered += l.qty;
    this.stats.lines += lines.length;
    return { id: ++this.orderN, t, due: t + this.p.slaHours * 3600, lines, dest, status: 'queued' };
  }

  // ── movement ──
  route(v, x, y, offset) {
    const pts = this.plan.find(v.x, v.y, x, y);
    if (offset && pts.length > 2) {   // keep right: shift interior points 0.45 m to the right of travel
      for (let i = 1; i < pts.length - 1; i++) {
        const [ax, ay] = pts[i - 1], [bx, by] = pts[i + 1]; const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
        pts[i] = [pts[i][0] - (dy / L) * 0.45, pts[i][1] + (dx / L) * 0.45];
      }
    }
    v.path = pts; v.pi = 1; v.pathLen = pathLength(pts);
  }
  /** Advance along the path. Returns true on arrival. */
  move(v, speed, dt) {
    if (!v.path) return true;
    let d = speed * dt;
    while (d > 0 && v.pi < v.path.length) {
      const [tx, ty] = v.path[v.pi]; const dx = tx - v.x, dy = ty - v.y, L = Math.hypot(dx, dy);
      if (L > 1e-3) v.h = Math.atan2(dy, dx);
      if (L <= d) { v.x = tx; v.y = ty; d -= L; v.dist += L; v.pi++; }
      else { v.x += (dx / L) * d; v.y += (dy / L) * d; v.dist += d; d = 0; }
    }
    if (v.pi >= v.path.length) { v.path = null; return true; }
    return false;
  }

  // ── AMRs ──
  amrStep(a, dt) {
    const moving = !!a.path;
    a.battery -= (moving ? 14 : a.state === 'pick' ? 8 : 2.5) * dt / 3600;
    if (a.state === 'charging') { a.battery = Math.min(100, a.battery + 70 * dt / 3600); if (a.battery >= 92 || (a.battery > 55 && this.queue.length > 4 && !a.retired)) { a.charger.busy = null; a.charger = null; a.state = 'idle'; } return; }
    if (a.state === 'idle') {
      if (a.retired) { if (!a.parked) { this.route(a, 4, 62 + (a.id % 6) * 1.2, false); a.state = 'park'; } return; }
      if (a.battery < 25 || (a.battery < 65 && !this.queue.length)) { const c = CHARGERS.find((c) => !c.busy); if (c) { c.busy = a.id; a.charger = c; this.route(a, c.access.x, c.access.y, true); a.state = 'toCharge'; return; } }
      if (this.queue.length) return this.assign(a);
      return;
    }
    if (a.state === 'park') { if (this.move(a, AMR_V, dt)) { a.parked = true; a.state = 'idle'; } if (!a.retired) { a.parked = false; a.state = 'idle'; a.path = null; } return; }
    if (a.state === 'toCharge') { if (this.move(a, AMR_V, dt)) { a.state = 'charging'; a.h = Math.PI; } return; }
    if (a.state === 'travel') {
      if (this.move(a, AMR_V, dt)) { const s = a.stops[a.si]; a.state = 'pick'; a.until = this.t + 6 + 4 * s.units; a.h = s.face.side === 'N' ? Math.PI / 2 : -Math.PI / 2; }
      return;
    }
    if (a.state === 'pick') {
      if (this.t < a.until) return;
      const s = a.stops[a.si], f = s.face;
      for (const ln of s.lines) { const take = Math.min(ln.qty - ln.picked, f.qty); f.qty -= take; ln.picked += take; this.stats.unitsPicked += take; if (take < ln.qty) this.stats.short += ln.qty - take; a.carry += take; this.bucket.lines++; }
      if (f.qty <= FACE_MIN && !f.replen) this.requestReplen(f);
      a.si++;
      if (a.si < a.stops.length) { const n = a.stops[a.si].face; this.route(a, n.ax, n.ay, true); a.state = 'travel'; }
      else { const st = this.bestPack(a); a.pack = st; this.route(a, st.access.x, st.access.y, true); a.state = 'toPack'; }
      return;
    }
    if (a.state === 'toPack') { if (this.move(a, AMR_V, dt)) { a.state = 'drop'; a.until = this.t + 8; a.h = -Math.PI / 2; } return; }
    if (a.state === 'drop') {
      if (this.t < a.until) return;
      for (const o of a.orders) { o.status = 'packing'; o.tPicked = this.t; a.pack.queue.push(o); }
      this.recent.travel.push({ t: this.t, m: a.dist - a.d0, n: a.orders.length });
      a.orders = []; a.stops = []; a.carry = 0; a.state = 'idle';
      if (this.queue.length && a.battery > 25 && !a.retired) this.assign(a);
    }
  }
  assign(a) {
    const n = this.p.pickMode === 'batch' ? this.p.batch : 1;
    a.orders = this.queue.splice(0, n);
    for (const o of a.orders) { o.status = 'picking'; o.amr = a.id; o.tStart = this.t; }
    const byFace = new Map();
    for (const o of a.orders) for (const ln of o.lines) { const f = this.faces[this.skus[ln.sku].face]; if (!byFace.has(f.id)) byFace.set(f.id, { face: f, lines: [], units: 0 }); const s = byFace.get(f.id); s.lines.push(ln); s.units += ln.qty; }
    // nearest-neighbour stop sequence (aisle-aware distance estimate)
    const left = [...byFace.values()], stops = []; let cx = a.x, cy = a.y;
    while (left.length) {
      let bi = 0, bd = Infinity;
      left.forEach((s, i) => { const f = s.face; const sameAisle = Math.abs(f.ay - cy) < 1; const d = sameAisle ? Math.abs(f.ax - cx) : Math.abs(f.ay - cy) + Math.min(Math.abs(f.ax - 40) + Math.abs(cx - 40), Math.abs(f.ax - 4) + Math.abs(cx - 4) + 6, Math.abs(f.ax - 77) + Math.abs(cx - 77) + 6); if (d < bd) { bd = d; bi = i; } });
      const s = left.splice(bi, 1)[0]; stops.push(s); cx = s.face.ax; cy = s.face.ay;
    }
    a.stops = stops; a.si = 0; a.d0 = a.dist;
    this.route(a, stops[0].face.ax, stops[0].face.ay, true); a.state = 'travel';
  }
  bestPack(a) {
    const open = this.packs.filter((s) => s.open);
    let best = open[0], bs = Infinity;
    for (const s of open) { const load = s.queue.length + (s.cur ? 1 : 0) + this.amrs.filter((x) => x.pack === s && x.state === 'toPack').length; const sc = load * 60 + Math.abs(s.access.x - a.x) * 0.6; if (sc < bs) { bs = sc; best = s; } }
    return best;
  }

  // ── Packing & sortation ──
  packStep(s) {
    if (s.cur && this.t >= s.until) {
      const o = s.cur; o.status = 'sorting'; o.tPacked = this.t; s.cur = null; s.done++;
      this.recent.cycle.push({ t: this.t, v: this.t - o.t });
      this.parcels.push({ o, x: s.x, y: CONVEYOR.y, dest: o.dest, lane: OUT_DOORS[o.dest].x });
    }
    if (!s.cur && s.queue.length && (s.open || s.queue.length)) { s.cur = s.queue.shift(); s.until = this.t + 34 + 7 * s.cur.lines.length; }
  }
  conveyorStep(dt) {
    for (const p of this.parcels) {
      if (p.x < p.lane) p.x = Math.min(p.lane, p.x + 1.3 * dt);
      else { p.y -= 1.5 * dt; if (p.y <= LANE.y1) { p.done = true; p.o.status = 'staged'; this.lanes[p.dest].orders.push(p.o); } }
    }
    this.parcels = this.parcels.filter((p) => !p.done);
  }

  // ── Forklifts: putaway and replenishment ──
  requestReplen(f) {
    const s = this.skus[f.sku];
    const srcs = (s.pallets || []).map((id) => this.res[id]).filter((r) => r.pallet && !r.reserved);
    if (!srcs.length) { f.replen = 'stockout'; return; }
    srcs.sort((a, b) => (a.x + a.z * 3) - (b.x + b.z * 3));
    const r = srcs[0]; r.reserved = true; f.replen = true;
    this.fTasks.push({ kind: 'replen', pri: f.qty <= 3 ? 0 : 1, from: r, to: f, sku: f.sku, t: this.t });
  }
  forkStep(f, dt) {
    if (f.state === 'idle') {
      if (f.retired || !this.fTasks.length) return;
      this.fTasks.sort((a, b) => a.pri - b.pri || a.t - b.t);
      const i = this.fTasks.findIndex(() => true);
      f.task = this.fTasks.splice(i, 1)[0];
      const src = f.task.from;
      this.route(f, src.ax, src.ay, false); f.state = 'toPick';
      return;
    }
    const tk = f.task;
    if (f.state === 'toPick') { if (this.move(f, FORK_V, dt)) { f.state = 'lift'; f.until = this.t + 18 + (tk.from.z || 0) * 4; f.liftTo = tk.from.z || 0; f.h = tk.kind === 'putaway' ? Math.PI / 2 : tk.from.side === 'W' ? 0 : Math.PI; } return; }
    if (f.state === 'lift') {
      f.lift = f.liftTo * Math.min(1, 1 - (f.until - this.t) / 18);
      if (this.t < f.until) return;
      // take the pallet
      if (tk.kind === 'putaway') { const d = tk.door; d.staged.splice(d.staged.indexOf(tk.pallet), 1); f.load = tk.pallet; }
      else { const r = tk.from; f.load = r.pallet; r.pallet = null; r.reserved = false; const s = this.skus[tk.sku]; s.pallets = s.pallets.filter((id) => id !== r.id); }
      f.lift = 0;
      const to = tk.kind === 'putaway' ? tk.to : tk.to;
      this.route(f, to.ax, to.ay, false); f.state = 'toDrop';
      return;
    }
    if (f.state === 'toDrop') { if (this.move(f, FORK_V * 0.85, dt)) { f.state = 'place'; f.until = this.t + 16 + (tk.to.z || 0) * 4; f.liftTo = tk.to.z || 0; f.h = tk.kind === 'replen' ? (tk.to.side === 'N' ? Math.PI / 2 : -Math.PI / 2) : tk.to.side === 'W' ? 0 : Math.PI; } return; }
    if (f.state === 'place') {
      f.lift = f.liftTo * Math.min(1, 1 - (f.until - this.t) / 16);
      if (this.t < f.until) return;
      if (tk.kind === 'putaway') {
        const r = tk.to; r.reserved = false; this.store(r, f.load.sku); this.stats.putaways++;
        this.recent.d2s.push({ t: this.t, v: this.t - f.load.tUnload });
        const face = this.faces[this.skus[f.load.sku].face];
        if (face.replen === 'stockout') { face.replen = false; this.requestReplen(face); }
      } else { const face = tk.to; face.qty = Math.min(FACE_MAX, face.qty + PALLET_UNITS); face.replen = false; this.stats.replens++; if (face.qty <= FACE_MIN) this.requestReplen(face); }
      f.load = null; f.lift = 0; f.task = null; f.state = 'idle';
    }
  }
  putawayTarget(sku) {
    const s = this.skus[sku];
    const free = this.res.filter((r) => !r.pallet && !r.reserved);
    if (!free.length) return null;
    if (this.p.slotting !== 'abc') return free[Math.floor(this.rand() * free.length)];
    const score = (r) => (r.x - 86) + r.level * 7 + Math.abs(r.y - 40) * 0.3;
    free.sort((a, b) => score(a) - score(b));
    const k = s.cls === 'A' ? 0 : s.cls === 'B' ? Math.floor(free.length * 0.35) : Math.floor(free.length * 0.7);
    return free[Math.min(free.length - 1, k + Math.floor(this.rand() * Math.min(8, free.length)))];
  }

  // ── Trucks ──
  nextDeparture(i, after) { const base = 7 * 3600 + i * 900; let t = Math.floor(after / 86400) * 86400 + base; while (t <= after + 1800) t += 2 * 3600; return t; }
  callOutbound(i, dep, extra = false) {
    const door = this.outDoors[i];
    const tr = this.newTruck('out', door); tr.dest = i; tr.dep = dep; tr.arriveAt = Math.max(this.t, dep - 80 * 60); tr.extra = extra; tr.phase = 'scheduled'; tr.load = 0; tr.orders = [];
    tr.cap = this.p.truckCap;
  }
  newTruck(kind, door) {
    const tr = { id: ++this.truckN, kind, door, carrier: CARRIERS[Math.floor(this.rand() * CARRIERS.length)], plate: `MH ${String(4 + Math.floor(this.rand() * 40)).padStart(2, '0')} ${String.fromCharCode(65 + Math.floor(this.rand() * 26))}${String.fromCharCode(65 + Math.floor(this.rand() * 26))} ${1000 + Math.floor(this.rand() * 8999)}`, x: 260, y: kind === 'in' ? 118 : -34, h: Math.PI, path: null, dist: 0 };
    this.trucks.push(tr); return tr;
  }
  genInbound() {
    if (this.t < this.nextIn) return;
    const tr = this.newTruck('in', null); tr.phase = 'arriving'; tr.tArrive = this.t;
    tr.pallets = Math.max(6, Math.round(this.p.palletsPerTruck + (this.rand() - 0.5) * 6));
    tr.cargo = Array.from({ length: tr.pallets }, () => this.pickSkuForInbound());
    tr.cat = this.skus[tr.cargo[0]].cat;
    this.stats.trucksIn++;
    const door = this.inDoors.find((d) => d.open && !d.truck);
    if (door) { door.truck = tr; tr.door = door; tr.route = inRoute(door.x); }
    else { tr.stall = this.freeStall(); tr.route = stallRoute(tr.stall); tr.waiting = true; this.event('warn', `Inbound truck ${tr.plate} waiting in the yard — no free door`); }
    tr.ri = 0; tr.path = tr.route.pts; tr.pi = 1;
    const gap = 3600 / this.p.inboundPerHour; this.nextIn = this.t + gap * (0.6 + this.rand() * 0.8);
  }
  pickSkuForInbound() {
    // weighted by demand, nudged towards SKUs that are short
    for (let i = 0; i < 4; i++) { const s = this.pickSku(); const cover = (s.pallets?.length || 0) + this.faces[s.face].qty / PALLET_UNITS; if (cover < 2 + 30 * s.w || this.rand() < 0.3) return s.id; }
    return this.pickSku().id;
  }
  freeStall() { const used = new Set(this.trucks.filter((t) => t.stall !== undefined && t.waiting).map((t) => t.stall)); for (let i = 0; i < 12; i++) if (!used.has(i)) return i; return 11; }
  truckStep(tr, dt) {
    if (tr.phase === 'scheduled') { if (this.t >= tr.arriveAt && !tr.door.truck) { tr.door.truck = tr; tr.phase = 'arriving'; tr.route = outRoute(tr.door.x); tr.path = tr.route.pts; tr.pi = 1; tr.x = tr.path[0][0]; tr.y = tr.path[0][1]; } return; }
    if (tr.phase === 'arriving' || tr.phase === 'leaving' || tr.phase === 'toStall') {
      const rev = tr.route.rev?.[tr.pi] ?? false;
      const v = rev ? REV_V : ROAD_V;
      const done = this.move(tr, v, dt);
      if (rev && tr.path) tr.h += Math.PI;   // reversing: the truck faces away from its travel direction
      tr.rev = rev;
      if (!done) return;
      if (tr.phase === 'leaving') { this.trucks.splice(this.trucks.indexOf(tr), 1); return; }
      if (tr.waiting) { tr.phase = 'waiting'; tr.h = -Math.PI / 2; return; }
      tr.phase = 'docked'; tr.tDock = this.t; tr.h = tr.kind === 'in' ? Math.PI / 2 : -Math.PI / 2; tr.next = this.t + 60;
      if (tr.kind === 'out') this.event('info', `Trailer for ${DESTS[tr.dest].name} docked at door O${tr.door.id + 1}`);
      return;
    }
    if (tr.phase === 'waiting') {
      const door = this.inDoors.find((d) => d.open && !d.truck);
      if (door) { door.truck = tr; tr.door = door; tr.waiting = false; tr.route = fromStallRoute(tr.stall, door.x); tr.path = tr.route.pts; tr.pi = 1; tr.phase = 'arriving'; tr.stall = undefined; }
      return;
    }
    if (tr.phase === 'docked' && tr.kind === 'out') {
      const lane = this.lanes[tr.dest];
      const loading = this.t >= tr.dep - 35 * 60 || lane.orders.length >= tr.cap - tr.load;
      tr.loading = loading;
      while (loading && this.t >= tr.next && lane.orders.length && tr.load < tr.cap) { const o = lane.orders.shift(); tr.orders.push(o); tr.load++; tr.next += 5; }
      if (this.t >= tr.next) tr.next = this.t + 2;
      if (this.t >= tr.dep || tr.load >= tr.cap) this.departOut(tr);
    }
  }
  departOut(tr) {
    const lane = this.lanes[tr.dest];
    for (const o of tr.orders) { o.status = 'shipped'; o.tShip = this.t; this.stats.shipped++; this.bucket.out++; if (this.t <= o.due) this.stats.onTime++; else this.stats.late++; this.recent.shipped.push({ t: this.t, v: this.t - o.t, late: this.t > o.due }); }
    this.stats.trucksOut++;
    this.event(tr.load >= tr.cap ? 'warn' : 'ok', `${DESTS[tr.dest].name} trailer departed ${tr.load >= tr.cap ? 'full' : 'on schedule'} with ${tr.load} parcels`);
    tr.phase = 'leaving'; tr.route = outLeave(tr.door.x); tr.path = tr.route.pts; tr.pi = 1; tr.door.truck = null;
    // next trailer
    const full = tr.load >= tr.cap;
    const dep = full ? this.t + 45 * 60 + (lane.orders.length > tr.cap * 0.6 ? 0 : 30 * 60) : this.nextDeparture(tr.dest, this.t);
    if (!full) this.departures[tr.dest].next = dep;
    this.callOutbound(tr.dest, full ? Math.min(dep + 90 * 60, this.nextDeparture(tr.dest, this.t)) : dep, full);
    if (full) this.trucks[this.trucks.length - 1].arriveAt = this.t + 20 * 60;
  }
  dockStep() {
    for (const d of this.inDoors) {
      const tr = d.truck; if (!tr || tr.phase !== 'docked') continue;
      if (tr.cargo.length && this.t >= tr.next && d.staged.length < 10) {
        const sku = tr.cargo.pop();
        const pallet = { sku, tUnload: this.t, id: ++this.palletN, slot: d.staged.length };
        d.staged.push(pallet); this.stats.palletsIn++;
        const to = this.putawayTarget(sku);
        if (to) { to.reserved = true; this.fTasks.push({ kind: 'putaway', pri: 2, from: { ax: d.x + (pallet.slot % 2 ? 1.4 : -1.4), ay: STAGE_Y - 2.2, z: 0 }, door: d, pallet, to, sku, t: this.t }); }
        tr.next = this.t + 95;
      }
      if (!tr.cargo.length && this.t >= tr.next) {
        this.recent.turn.push({ t: this.t, v: this.t - tr.tArrive });
        tr.phase = 'leaving'; tr.route = inLeave(d.x); tr.path = tr.route.pts; tr.pi = 1; d.truck = null;
      }
    }
  }

  // ── KPIs ──
  backlog() { return this.orders.filter((o) => o.status !== 'shipped').length; }
  invPct() { return this.res.filter((r) => r.pallet).length / this.res.length; }
  stockouts() { return this.faces.filter((f) => f.qty === 0).length; }
  kpis() {
    const win = (arr) => arr.filter((e) => this.t - e.t <= 3600);
    for (const k of Object.keys(this.recent)) this.recent[k] = this.recent[k].filter((e) => this.t - e.t <= 3 * 3600);
    const sh = win(this.recent.shipped), cy = win(this.recent.cycle), d2s = win(this.recent.d2s), tv = win(this.recent.travel);
    const mean = (a) => (a.length ? a.reduce((s, e) => s + e.v, 0) / a.length : 0);
    const act = this.amrs.filter((a) => !a.retired), fk = this.forks.filter((f) => !f.retired), pk = this.packs.filter((s) => s.open);
    const last = this.series.slice(-4);
    const avg = (k) => (last.length ? last.reduce((s, e) => s + e[k], 0) / last.length : 0);
    const st = this.stats;
    const statuses = { queued: 0, picking: 0, packing: 0, sorting: 0, staged: 0 };
    for (const o of this.orders) if (statuses[o.status] !== undefined) statuses[o.status]++;
    const elapsedH = Math.max(0.25, (this.t - this.t0) / 3600);
    const overdue = this.orders.filter((o) => o.status !== 'shipped' && o.due < this.t).length;
    return {
      shippedHr: sh.length, cycleMin: mean(cy) / 60, backlog: this.backlog(), statuses,
      onTime: (st.shipped + overdue) ? st.onTime / (st.shipped + overdue) : 1, overdue, fill: st.unitsOrdered ? Math.min(1, st.unitsPicked / Math.max(1, st.unitsPicked + st.short)) : 1,
      amrUtil: last.length ? avg('amr') : act.filter((a) => a.orders.length).length / Math.max(1, act.length),
      forkUtil: last.length ? avg('fork') : fk.filter((f) => f.task).length / Math.max(1, fk.length),
      packUtil: last.length ? avg('pack') : pk.filter((s) => s.cur).length / Math.max(1, pk.length),
      d2sMin: mean(d2s) / 60, travelPerOrder: tv.length ? tv.reduce((s, e) => s + e.m, 0) / tv.reduce((s, e) => s + e.n, 0) : 0,
      inv: this.invPct(), stockouts: this.stockouts(),
      yardWaiting: this.trucks.filter((t) => t.waiting).length, staged: this.inDoors.reduce((s, d) => s + d.staged.length, 0),
      packQueue: pk.reduce((s, x) => s + x.queue.length, 0), forkQueue: this.fTasks.length,
      lowBattery: act.filter((a) => a.battery < 25).length, charging: act.filter((a) => a.state === 'charging').length,
      costPerOrder: st.shipped ? st.cost / st.shipped : 0, costHr: this.costPerHour(), ordersPerHrAvg: st.shipped / elapsedH,
    };
  }
  /** Rule-based bottleneck finder. */
  insights(k = this.kpis()) {
    const out = [];
    if (k.packUtil > 0.9 && k.packQueue > 10) out.push({ sev: 'bad', area: 'pack', msg: `Packing is the bottleneck — ${k.packQueue} picked orders wait at ${this.p.packStations} stations.`, fix: { packStations: Math.min(12, this.p.packStations + 2) }, fixLabel: '+2 pack stations' });
    if (k.amrUtil > 0.88 && k.statuses.queued > 25) out.push({ sev: 'bad', area: 'pick', msg: `Robots are saturated (${Math.round(k.amrUtil * 100)}% busy) with ${k.statuses.queued} orders waiting to be picked.`, fix: this.p.pickMode === 'single' ? { pickMode: 'batch' } : { amrs: Math.min(60, this.p.amrs + 6) }, fixLabel: this.p.pickMode === 'single' ? 'Switch to batch picking' : '+6 AMRs' });
    if (k.forkUtil > 0.85 && (k.forkQueue > 12 || k.staged > 25)) out.push({ sev: 'warn', area: 'fork', msg: `Forklifts can't keep up: ${k.forkQueue} putaway/replenishment tasks queued.`, fix: { forklifts: Math.min(12, this.p.forklifts + 2) }, fixLabel: '+2 forklifts' });
    if (k.yardWaiting >= 2) out.push({ sev: 'warn', area: 'yard', msg: `${k.yardWaiting} inbound trucks are waiting in the yard for a free door.`, fix: { inboundDoors: Math.min(8, this.p.inboundDoors + 2) }, fixLabel: 'Open 2 more doors' });
    if (k.stockouts > 6) out.push({ sev: 'warn', area: 'stock', msg: `${k.stockouts} pick faces are empty — orders are short-picked (fill rate ${(k.fill * 100).toFixed(1)}%).`, fix: { inboundPerHour: +(this.p.inboundPerHour + 0.3).toFixed(2) }, fixLabel: 'More inbound trucks' });
    if (k.inv > 0.9) out.push({ sev: 'warn', area: 'space', msg: `Racking is ${Math.round(k.inv * 100)}% full — putaway space is running out.`, fix: { inboundPerHour: +Math.max(0.2, this.p.inboundPerHour - 0.3).toFixed(2) }, fixLabel: 'Fewer inbound trucks' });
    if (k.onTime < 0.95 && this.stats.shipped > 50) out.push({ sev: 'warn', area: 'sla', msg: `Only ${(k.onTime * 100).toFixed(1)}% of orders meet the ${this.p.slaHours} h ship promise — ${k.overdue} open orders are already late.` });
    if (k.lowBattery > Math.max(2, this.p.amrs * 0.25)) out.push({ sev: 'warn', area: 'battery', msg: `${k.lowBattery} robots are low on battery and only 10 chargers exist.` });
    if (!out.length) out.push({ sev: 'ok', msg: 'Flow is balanced — no bottleneck detected.' });
    return out;
  }
}

// ── Truck routes (trailer-rear reference point, building coordinates) ──
function bez(p0, p1, p2, n = 8) { const out = []; for (let i = 1; i <= n; i++) { const t = i / n, u = 1 - t; out.push([u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]); } return out; }
function mk(segs) { const pts = [], rev = []; for (const [list, r] of segs) for (const p of list) { pts.push(p); rev.push(r); } return { pts, rev }; }
const IN_ROAD = 118, OUT_ROAD = -34, DOCK_IN = 84.3, DOCK_OUT = -0.3;
function inRoute(x) { return mk([[[[260, IN_ROAD], [x + 22, IN_ROAD]], false], [bez([x + 22, IN_ROAD], [x, IN_ROAD], [x, 100]), true], [[[x, DOCK_IN]], true]]); }
function inLeave(x) { return mk([[[[x, DOCK_IN], [x, 104]], false], [bez([x, 104], [x, IN_ROAD], [x - 16, IN_ROAD]), false], [[[-80, IN_ROAD]], false]]); }
const stallXY = (i) => [150 + (i % 6) * 6, 100 - Math.floor(i / 6) * 0 + (i >= 6 ? 6 : 0)];
function stallRoute(i) { const [sx, sy] = stallXY(i); return mk([[[[260, IN_ROAD], [sx + 4, IN_ROAD]], false], [bez([sx + 4, IN_ROAD], [sx, IN_ROAD], [sx, sy + 4]), false], [[[sx, sy]], false]]); }
function fromStallRoute(i, x) { const [sx, sy] = stallXY(i); return mk([[[[sx, sy], [sx, sy - 0.1]], false], [bez([sx, sy], [sx, IN_ROAD], [sx - 16, IN_ROAD]), true], [[[x + 22, IN_ROAD]], false], [bez([x + 22, IN_ROAD], [x, IN_ROAD], [x, 100]), true], [[[x, DOCK_IN]], true]]); }
function outRoute(x) { return mk([[[[260, OUT_ROAD], [x + 22, OUT_ROAD]], false], [bez([x + 22, OUT_ROAD], [x, OUT_ROAD], [x, -18]), true], [[[x, DOCK_OUT]], true]]); }
function outLeave(x) { return mk([[[[x, DOCK_OUT], [x, -20]], false], [bez([x, -20], [x, OUT_ROAD], [x - 16, OUT_ROAD]), false], [[[-80, OUT_ROAD]], false]]); }
export { TRAILER, FACE_MAX };
