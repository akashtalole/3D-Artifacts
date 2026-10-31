/**
 * Crowd and transport simulation for one mela day.
 * Pilgrims move in groups of GROUP people:
 *   arrive at an outer parking hub or railway station → shuttle bus (or walk) to a transfer
 *   point → walk through the pedestrian zone to a ghat → queue and bathe → optional darshan
 *   at Kalaram → walk back to the transfer point → shuttle back.
 * Walking speed on each street falls with crowd density (Weidmann's fundamental diagram).
 * Groups cannot enter a jammed street, so queues spill back upstream.
 */
import { NODES, LINKS_DEF, GHATS, HUBS, ROAD_NODES, ROADS, SCENARIOS, PROCESSION, DIP_RATE, DIP_MIN, BUS_SEATS, BUS_KMH, BUS_KMH_CARS, TURN_MIN, rng } from './data.js';

export const GROUP = 250;
const TICK = new Set(['detour', 'roadwalk', 'walk', 'dip', 'darshan']);
const V0 = 1.34, RHO_MAX = 5.4;
export const CRIT = 4;        // persons/m² treated as critical (crush risk)
const ENTER = 3.0;            // people stop stepping into a street this packed…
const JAM = 5.0;              // …unless the crowd behind is pushing (then up to this)
const HOLD_RHO = 2.2;         // holding areas release groups only below this density
const WALK_MS = 1.0;          // walking speed for long road walks (m/s)
const TEMPLE_CAP = 16000, TEMPLE_MIN = 20;
const PUSH_T = 180;           // after waiting this long, a blocked group pushes into a jammed street (counterflow)
const RHO_HARD = 6.0;         // physical limit for pushing in
export const PER_VEHICLE = 12; // pilgrims per parked vehicle (mix of cars, jeeps and buses)

export function speed(rho) {
  if (rho < 0.3) return V0;
  if (rho >= RHO_MAX) return 0.12;   // a packed crowd still shuffles forward
  return Math.max(0.12, V0 * (1 - Math.exp(-1.913 * (1 / rho - 1 / RHO_MAX))));
}

export class Sim {
  constructor(scKey, plan, opts = {}) {
    this.sc = SCENARIOS[scKey]; this.scKey = scKey; this.P = plan;
    this.crowd = (opts.crowd ?? this.sc.crowd) * 1e5;
    this.rand = rng(opts.seed ?? 11);
    this.t = 0; this.dt = opts.dt ?? 10; this.end = 24 * 3600;
    this.buildNetwork(); this.buildRoads(); this.spawnPlan();
    this.alerts = []; this.convoys = []; this.enRoute = {}; this.gates = {};
    this.H = Array.from({ length: 25 }, () => ({ arr: 0, dips: 0, present: 0, busQ: 0, ghatQ: 0, maxRho: 0, crit: 0, samples: 0 }));
    this.tot = { arrived: 0, dips: 0, done: 0, journey: 0, busWait: 0, busWaitN: 0, ghatWait: 0, ghatWaitN: 0, diverted: 0, walkedRoad: 0, critMin: 0, sat: 0, exposed: 0, peakPresent: 0, peakHighway: 0, darshan: 0, health: 0, dipLog: [] };
    this.present = 0;
  }
  // ── network ──
  buildNetwork() {
    const P = this.P;
    const active = (c) => !c || P[c];
    this.nodes = {};
    for (const [id, n] of Object.entries(NODES)) if (active(n.cand)) this.nodes[id] = { id, ...n, q: 0, rho: 0, crit: 0, waiting: 0 };
    this.ghats = {};
    for (const g of GHATS) {
      if (!active(g.cand)) continue;
      const F = g.F + (P.ghats[g.id] || 0);
      if (F <= 0) continue;
      this.ghats[g.id] = { ...g, F, cap: F * DIP_RATE, area: F * 26 + 600, queue: [], qPeople: 0, credit: 0, dipping: 0, served: 0, inbound: 0, rho: 0, crit: 0, waitSum: 0, waitN: 0 };
    }
    this.temple = { id: 'J_KAL', queue: [], qPeople: 0, credit: 0, inside: 0, served: 0 };
    this.links = []; this.adj = {};
    for (const [a, b, W, ow, name, ex = {}] of LINKS_DEF) {
      if (!this.nodes[a] || !this.nodes[b] || !active(ex.cand)) continue;
      if (NODES[a].kind === 'ghat' && !this.ghats[a] && !NODES[a].cand) continue;
      const A = this.nodes[a], B = this.nodes[b];
      // a link stands for a corridor of parallel lanes, so its usable width is larger than the main street's
      let w = W * (ex.bridge ? 1.3 : 2.0); if (ex.widen && P[ex.widen]) w += ex.widen === 'footbridge' ? 8 : 8;
      const L = Math.hypot(A.x - B.x, A.z - B.z) * (ex.bridge ? 1.0 : 1.12);
      const l = { id: this.links.length, a, b, W: w, L, ow, name, ex, n: 0, nd: { 1: 0, '-1': 0 }, nAB: 0, nBA: 0, rho: 0, crit: 0, maxRho: 0, closed: false, alertT: -1e9 };
      this.links.push(l);
      (this.adj[a] ||= []).push({ l, to: b, dir: 1 }); (this.adj[b] ||= []).push({ l, to: a, dir: -1 });
    }
    this.tps = Object.keys(this.nodes).filter((k) => this.nodes[k].kind === 'tp');
    for (const tp of this.tps) { const n = this.nodes[tp]; n.hold = []; n.ret = {}; n.retPeople = 0; if (P.holding) n.area *= 2.5; }
    this.paths = {};
  }
  allowed(e, closedOK) {
    if (!closedOK && e.l.closed) return false;
    if (!this.P.oneWay || e.l.ow === 0) return true;
    return e.l.ow === e.dir;
  }
  /** Shortest walking path; returns [{l, dir}] or null. */
  path(from, to, avoidClosed = false) {
    const key = `${from}>${to}>${avoidClosed && this.closureOn ? 'c' : ''}`;
    if (key in this.paths) return this.paths[key];
    const dist = { [from]: 0 }, prev = {}, done = new Set();
    for (;;) {
      let u = null, best = Infinity;
      for (const k in dist) if (!done.has(k) && dist[k] < best) { best = dist[k]; u = k; }
      if (u === null || u === to) break;
      done.add(u);
      for (const e of this.adj[u] || []) {
        if (!this.allowed(e, !avoidClosed)) continue;
        const through = e.to !== to && this.nodes[e.to].kind === 'ghat';   // walking along another ghat's promenade
        const d = best + e.l.L * (e.l.ex.bridge ? 1.05 : 1) * (through ? 1.4 : 1);
        if (d < (dist[e.to] ?? Infinity)) { dist[e.to] = d; prev[e.to] = e; }
      }
    }
    let res = null;
    if (dist[to] !== undefined) { res = []; let v = to; while (v !== from) { const e = prev[v]; res.unshift({ l: e.l, dir: e.dir }); v = e.dir === 1 ? e.l.a : e.l.b; } res.len = dist[to]; }
    this.paths[key] = res;
    return res;
  }
  // ── roads and shuttle buses ──
  buildRoads() {
    const P = this.P, pts = {};
    this.hubs = {};
    for (const [id, h] of Object.entries(HUBS)) if (!h.cand || P[h.cand]) { this.hubs[id] = { id, ...h, q: [], qPeople: 0, occ: 0, highway: [], highwayPeople: 0, buses: 0, idle: 0, waitSum: 0, waitN: 0, served: 0 }; pts[id] = [h.x, h.z]; }
    for (const tp of this.tps) pts[tp] = [this.nodes[tp].x, this.nodes[tp].z];
    for (const [k, v] of Object.entries(ROAD_NODES)) pts[k] = v;
    const adj = {};
    for (const [a, b, name] of ROADS) { if (!pts[a] || !pts[b]) continue; const L = Math.hypot(pts[a][0] - pts[b][0], pts[a][1] - pts[b][1]) * 1.15; (adj[a] ||= []).push({ to: b, L, name }); (adj[b] ||= []).push({ to: a, L, name }); }
    this.roadPts = pts; this.roadAdj = adj; this.routes = {};
    for (const h in this.hubs) for (const tp of this.tps) {
      const dist = { [h]: 0 }, prev = {}, done = new Set();
      for (;;) { let u = null, best = Infinity; for (const k in dist) if (!done.has(k) && dist[k] < best) { best = dist[k]; u = k; } if (u === null || u === tp) break; done.add(u); for (const e of adj[u] || []) { const d = best + e.L; if (d < (dist[e.to] ?? Infinity)) { dist[e.to] = d; prev[e.to] = u; } } }
      if (dist[tp] === undefined) continue;
      const poly = [tp]; while (poly[0] !== h) poly.unshift(prev[poly[0]]);
      this.routes[`${h}>${tp}`] = { km: dist[tp] / 1000, poly: poly.map((k) => pts[k]) };
    }
    // share the bus fleet between hubs by expected demand
    const sc = this.sc, road = Object.values(this.hubs).filter((h) => !h.rail), rail = Object.values(this.hubs).filter((h) => h.rail);
    const roadShare = road.reduce((s, h) => s + h.share, 0);
    for (const h of road) h.w = (h.share / roadShare) * (1 - sc.rail - sc.local);
    for (const h of rail) h.w = sc.rail * (h.id === 'H_DEO' ? 0.4 : rail.length > 1 ? 0.6 : 1);
    let left = P.buses;
    const list = Object.values(this.hubs);
    list.forEach((h, i) => { const n = i === list.length - 1 ? left : Math.round(P.buses * h.w / (1 - sc.local)); h.buses = h.idle = h.base = Math.max(0, Math.min(left, n)); left -= h.buses; });
    this.busKmh = P.carFree ? BUS_KMH : BUS_KMH_CARS;
  }
  ride(h, tp) { const r = this.routes[`${h}>${tp}`]; return r ? (r.km / this.busKmh) * 3600 : Infinity; }
  // ── demand ──
  spawnPlan() {
    const sc = this.sc, R = this.rand, n = Math.round(this.crowd / GROUP);
    const road = Object.values(this.hubs).filter((h) => !h.rail), rail = Object.values(this.hubs).filter((h) => h.rail);
    const cum = []; let acc = 0; for (const p of sc.profile) { acc += p; cum.push(acc); }
    const tpW = { TP_W: 0.3, TP_N: 0.25, TP_T: 0.15, TP_D: 0.2, TP_R: 0.1 };
    this.groups = [];
    for (let i = 0; i < n; i++) {
      const u = R(); let hr = cum.findIndex((c) => c >= u); if (hr < 0) hr = 23;
      const t0 = (hr + R()) * 3600;
      const m = R(); let hub = null, tp = null, mode;
      if (m < sc.local) { mode = 'local'; let v = R(), a = 0; for (const k in tpW) { a += tpW[k]; if (v <= a) { tp = k; break; } } tp ||= 'TP_W'; }
      else if (m < sc.local + sc.rail) { mode = 'rail'; hub = rail.length > 1 && R() < 0.4 ? 'H_DEO' : 'H_RLY'; }
      else { mode = 'road'; let v = R() * road.reduce((s, h) => s + h.share, 0); for (const h of road) { v -= h.share; if (v <= 0) { hub = h.id; break; } } hub ||= road[0].id; }
      this.groups.push({ id: i, t0, mode, hub, tp, ram: R() < sc.ramkund, darshan: R() < sc.darshan, state: 'pending', people: GROUP, hue: R(), jitter: R(), exp: 0, diverted: false, tWait: 0, tGhat: 0, tBus: 0 });
    }
    this.groups.sort((a, b) => a.t0 - b.t0);
    this.next = 0; this.active = []; this.woken = []; this.all = this.groups;
  }
  // ── decisions ──
  closureAt(t) { return this.sc.amrit && t >= PROCESSION.from * 3600 && t < PROCESSION.open * 3600; }
  ghatClosed(gid, t) { return this.closureAt(t) && this.ghats[gid]?.sacred; }
  queueWait(g) { return ((g.qPeople + g.inbound) / g.cap) * 60; }   // minutes
  /** Pick a ghat and a transfer point for a group arriving at a hub (or at a TP for locals). */
  decide(G) {
    const iccc = this.P.iccc, t = this.t, R = this.rand;
    const tps = G.mode === 'local' ? [G.tp] : this.tps;
    let best = null; const opts = [];
    for (const gid in this.ghats) {
      const g = this.ghats[gid];
      for (const tp of tps) {
        const p = (iccc && this.closureOn && this.path(tp, gid, true)) || this.path(tp, gid); if (!p) continue;
        const ride = G.mode === 'local' ? 0 : this.ride(G.hub, tp) / 60;
        if (!isFinite(ride)) continue;
        const walk = p.len / 1.1 / 60;
        let cost = ride + walk + (G.mode === 'local' ? 0 : TURN_MIN);
        if (iccc) { cost += this.queueWait(g); if (this.ghatClosed(gid, t + cost * 60)) cost += Math.max(0, PROCESSION.open * 3600 - t) / 60 - ride - walk; }
        const o = { gid, tp, cost, sacred: g.sacred, F: g.F };
        opts.push(o); if (!best || cost < best.cost) best = o;
      }
    }
    if (!opts.length) return null;
    const pickSoft = (list) => { const m = Math.min(...list.map((o) => o.cost)); const w = list.map((o) => Math.exp(-(o.cost - m) / 12) * Math.sqrt(o.F)); let v = R() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < list.length; i++) { v -= w[i]; if (v <= 0) return list[i]; } return list[0]; };
    if (G.ram) {
      // devotees who want Ramkund itself (or its neighbours in the same complex)
      const wish = R() < 0.6 ? 'G_RAM' : R() < 0.6 ? 'G_LAX' : 'G_GAD';
      const s = opts.filter((o) => o.gid === wish && this.ghats[o.gid]);
      const bestS = s.reduce((m, o) => (!m || o.cost < m.cost ? o : m), null);
      // without the ICCC, word of mouth still sends some people elsewhere when the queue is hours long
      const selfDivert = !iccc && bestS && this.queueWait(this.ghats[bestS.gid]) > 120 && R() < 0.5;
      if (bestS && !selfDivert && (!iccc || bestS.cost < best.cost + 75)) return bestS;
      if (bestS) { G.diverted = true; this.tot.diverted++; }
    }
    return pickSoft(opts.filter((o) => o.cost < best.cost + 45));
  }
  // ── main step ──
  step() {
    const t = this.t, dt = this.dt;
    const closure = this.closureAt(t);
    if (closure !== this.closureOn) {   // procession route closed to the public / reopened
      this.closureOn = closure;
      const pn = PROCESSION.nodes;
      const sacred = (id) => this.ghats[id]?.sacred;
      for (const l of this.links) l.closed = closure && (sacred(l.a) || sacred(l.b) || pn.some((a, i) => i < pn.length - 1 && ((l.a === a && l.b === pn[i + 1]) || (l.b === a && l.a === pn[i + 1]))));
      for (const k in this.paths) if (k.endsWith('>c')) delete this.paths[k];
    }
    // arrivals
    while (this.next < this.groups.length && this.groups[this.next].t0 <= t) { const G = this.groups[this.next++]; this.arrive(G); }
    // ICCC bus rebalancing every 15 minutes
    if (this.P.iccc && Math.floor(t / 900) !== Math.floor((t - dt) / 900)) this.rebalance();
    this.buses(t);
    // links: density and speed
    for (const l of this.links) {
      l.cf = l.nAB > 0 && l.nBA > 0;
      l.rho = l.n / (l.L * l.W); l.v = speed(l.rho) * (l.cf ? 0.85 : 1); l.nAB = l.nBA = 0;
      if (l.rho > l.maxRho) l.maxRho = l.rho;
    }
    this.gatesStep();
    // groups
    const still = [];
    for (const G of this.active) { this.update(G); if (TICK.has(G.state)) still.push(G); else G.ticking = false; }
    for (const G of this.woken) if (TICK.has(G.state) && !G.ticking) { G.ticking = true; still.push(G); }
    this.woken = [];
    this.active = still;
    // ghats: bathing
    for (const gid in this.ghats) {
      const g = this.ghats[gid];
      g.rho = g.qPeople / g.area;
      if (this.ghatClosed(gid, t)) { g.credit = 0; continue; }
      g.credit = Math.min(g.credit + g.cap * dt / 3600, Math.max(2 * GROUP, g.cap / 20));
      while (g.queue.length && g.credit >= GROUP) { const G = g.queue.shift(); g.qPeople -= G.people; g.credit -= G.people; G.state = 'dip'; G.timer = DIP_MIN * 60; this.wake(G); g.dipping += G.people; g.waitSum += t - G.tq; g.waitN++; this.tot.ghatWait += (t - G.tq) / 60; this.tot.ghatWaitN++; G.tGhat = (t - G.tq) / 60; }
    }
    // temple
    const T = this.temple; T.credit = Math.min(T.credit + TEMPLE_CAP * dt / 3600, Math.max(2 * GROUP, TEMPLE_CAP / 20));
    while (T.queue.length && T.credit >= GROUP) { const G = T.queue.shift(); T.qPeople -= G.people; T.credit -= G.people; G.state = 'darshan'; G.timer = TEMPLE_MIN * 60; this.wake(G); T.inside += G.people; }
    // TPs: crowding from holding and return queues
    for (const id in this.nodes) { const n = this.nodes[id]; n.wait = n.waiting; n.rho = n.kind === 'ghat' ? (this.ghats[id]?.rho || 0) : Math.min(6.5, (n.waiting + (n.retPeople || 0)) / n.area); n.waiting = 0; }
    this.monitor();
    this.t += dt;
  }
  arrive(G) {
    this.tot.arrived += G.people; this.present += G.people; this.H[Math.floor(this.t / 3600)].arr += G.people;
    G.tArr = this.t;
    if (G.mode === 'local') { const d = this.decide(G); if (!d) { G.state = 'done'; this.present -= G.people; return; } this.assign(G, d); this.startWalk(G, G.tp, G.ghat, 'in'); this.wake(G); return; }
    const H = this.hubs[G.hub];
    if (!H.rail && H.occ + G.people > H.cap * PER_VEHICLE) {
      // parking full: try the nearest hub with space, else wait on the highway
      const alt = Object.values(this.hubs).filter((h) => !h.rail && h.occ + G.people <= h.cap * PER_VEHICLE).sort((a, b) => Math.hypot(a.x - H.x, a.z - H.z) - Math.hypot(b.x - H.x, b.z - H.z))[0];
      if (alt) { G.hub = alt.id; G.state = 'detour'; G.timer = 25 * 60 + Math.hypot(alt.x - H.x, alt.z - H.z) / 8; this.wake(G); return; }
      G.state = 'highway'; H.highway.push(G); H.highwayPeople += G.people; this.wake(G); return;
    }
    this.atHub(G);
    this.wake(G);
  }
  wake(G) { this.woken.push(G); }
  atHub(G) {
    const H = this.hubs[G.hub];
    if (!H.rail) H.occ += G.people;
    const d = this.decide(G);
    if (!d) { G.state = 'done'; this.present -= G.people; return; }
    this.assign(G, d);
    // walk the whole way if the shuttle queue is longer than the walk
    const r = this.routes[`${G.hub}>${G.tp}`], walkMin = (r.km * 1000) / WALK_MS / 60;
    const thr = (H.buses * BUS_SEATS) / ((2 * this.ride(G.hub, G.tp) / 60 + 2 * TURN_MIN) || 1);   // people per minute
    const waitMin = H.qPeople / Math.max(thr, 1);
    const tpFull = this.P.holding && this.nodes[G.tp].rho > 1.5;   // police keep walkers out of a full holding area
    if (r.km < 7 && !tpFull && (H.buses === 0 || waitMin > walkMin * 0.9)) { G.state = 'roadwalk'; G.timer = walkMin * 60; G.rw = { from: G.hub, to: G.tp, T: walkMin * 60 }; this.tot.walkedRoad += G.people; return; }
    G.state = 'hubq'; G.tq = this.t; H.q.push(G); H.qPeople += G.people;
  }
  assign(G, d) { G.ghat = d.gid; G.tp = d.tp; this.ghats[d.gid].inbound += G.people; }
  startWalk(G, from, to, phase) {
    const p = (this.P.iccc && this.closureOn ? this.path(from, to, true) : null) || this.path(from, to);
    if (!p) { G.state = 'done'; this.present -= G.people; return; }
    G.path = p; G.pi = -1; G.pos = 0; G.phase = phase; G.dest = to; G.state = 'enter'; G.tq = this.t; G.blockT = 0;
    const s0 = p[0], key = `${s0.l.id}:${s0.dir}`;
    const gate = (this.gates[key] ||= { l: s0.l, dir: s0.dir, node: this.nodes[s0.dir === 1 ? s0.l.a : s0.l.b], list: [], people: 0 });
    gate.list.push(G); gate.people += G.people; G.gate = gate;
  }
  /** Admit waiting groups from each street entrance (holding areas, ghat exits, the temple). */
  gatesStep() {
    const t = this.t;
    for (const k in this.gates) {
      const gate = this.gates[k]; if (!gate.list.length) continue;
      const L = gate.list;
      for (let i = 0; i < L.length && i < 400;) {   // look past groups held for a busy ghat
        const G = L[i];
        if (G.phase === 'in' && this.P.holding) {   // metering: hold if the ghat is closed or its queue is long
          const g = this.ghats[G.ghat];
          if (this.ghatClosed(G.ghat, t + 1200) || (g && g.qPeople > g.cap * 0.75) || G.path.some((st) => st.l.rho > HOLD_RHO + 0.6)) { i++; continue; }
        }
        G.blockT = t - G.tq;
        if (!this.canEnter(G, gate.l, gate.node.rho, gate.dir)) break;
        L.splice(i, 1); gate.people -= G.people; G.gate = null;
        G.pi = 0; G.pos = 0; G.state = 'walk'; G.blockT = 0; this.occupy(gate.l, G, 1, gate.dir); this.wake(G);
      }
      gate.node.waiting += gate.people;
    }
  }
  /** Can the group step onto link e? */
  canEnter(G, l, pressure, dir) {
    if (l.closed) return false;
    // what matters for stepping in is the crowd going your way, plus part of the opposing flow
    const rho = (l.nd[dir] + 0.5 * l.nd[-dir]) / (l.L * l.W);
    return this.admit(G, l, rho, pressure);
  }
  admit(G, l, rhoIn, pressure) {
    if (G.pi === -1 && G.phase === 'in' && this.P.holding) return rhoIn < HOLD_RHO && l.rho < ENTER;
    if (rhoIn < ENTER && l.rho < JAM) return true;
    if (!this.P.holding && pressure >= ENTER && rhoIn < JAM && l.rho < RHO_HARD) return true;   // pushed in by the dense crowd behind (no barricades)
    return (G.blockT || 0) > PUSH_T && l.rho < ENTER + 0.5;                // eventually squeezing in
  }
  occupy(l, G, sign, dir) { l.n += sign * G.people; l.nd[dir] += sign * G.people; l.rho += sign * G.people / (l.L * l.W); }
  update(G) {
    const dt = this.dt, t = this.t;
    switch (G.state) {
      case 'detour': if ((G.timer -= dt) <= 0) this.atHub(G); break;
      case 'highway': break;   // released by buses()
      case 'hubq': G.tWait += dt; break;
      case 'ride': case 'rideback': break;   // carried by convoys
      case 'roadwalk': if ((G.timer -= dt) <= 0) { G.rw = null; this.startWalk(G, G.tp, G.ghat, 'in'); } break;
      case 'walk': {
        const s = G.path[G.pi], l = s.l;
        if (s.dir === 1) l.nAB += G.people; else l.nBA += G.people;
        if (l.rho >= CRIT) G.exp += dt / 60;
        G.pos = Math.min(l.L, G.pos + l.v * dt);
        if (G.pos >= l.L) {
          if (G.pi === G.path.length - 1) { this.reach(G); break; }
          const nx = G.path[G.pi + 1];
          if (!this.canEnter(G, nx.l, l.rho, nx.dir)) { G.blocked = true; G.blockT = (G.blockT || 0) + dt; break; }
          G.blocked = false; G.blockT = 0; this.occupy(l, G, -1, s.dir); this.occupy(nx.l, G, 1, nx.dir); G.pi++; G.pos = 0;
        }
        break;
      }
      case 'ghatq': G.tWait += dt; if (this.ghats[G.ghat].rho >= CRIT) G.exp += dt / 60; break;
      case 'dip': if ((G.timer -= dt) <= 0) {
        const g = this.ghats[G.ghat]; g.dipping -= G.people; g.served += G.people; this.tot.dips += G.people; this.H[Math.floor(t / 3600)].dips += G.people; this.tot.dipLog.push([t, G.people]);
        G.dipped = true;
        if (G.darshan && this.nodes.J_KAL && this.temple.qPeople < TEMPLE_CAP * 0.75 && this.path(G.ghat, 'J_KAL')) this.startWalk(G, G.ghat, 'J_KAL', 'temple');
        else this.startWalk(G, G.ghat, G.tp, 'out');
      } break;
      case 'templeq': G.tWait += dt; break;
      case 'darshan': if ((G.timer -= dt) <= 0) { this.temple.inside -= G.people; this.temple.served += G.people; this.tot.darshan += G.people; this.startWalk(G, 'J_KAL', G.tp, 'out'); } break;
      case 'tpq': G.tWait += dt; break;
    }
  }
  /** Arrived at the end of the walking path. */
  reach(G) {
    const s = G.path[G.pi], l = s.l;
    if (G.phase === 'in') {
      const g = this.ghats[G.ghat];
      if (this.ghatClosed(G.ghat, this.t) || g.rho >= (l.rho >= ENTER ? JAM : ENTER)) { G.blocked = true; return; }   // wait at the barricade
      this.occupy(l, G, -1, s.dir); G.blocked = false; g.rho += G.people / g.area; g.inbound -= G.people; g.queue.push(G); g.qPeople += G.people; G.state = 'ghatq'; G.tq = this.t;
    } else if (G.phase === 'temple') {
      this.occupy(l, G, -1, s.dir); this.temple.queue.push(G); this.temple.qPeople += G.people; G.state = 'templeq';
    } else {
      this.occupy(l, G, -1, s.dir);
      if (G.mode === 'local') { this.finish(G); return; }
      const n = this.nodes[G.tp]; (n.ret[G.hub] ||= []).push(G); n.retPeople += G.people; G.state = 'tpq'; G.tq = this.t;
    }
  }
  finish(G) {
    G.state = 'done'; this.present -= G.people; this.tot.done += G.people;
    const H = G.hub && this.hubs[G.hub]; if (H && !H.rail) H.occ -= G.people;
    const mins = (this.t - G.tArr) / 60; this.tot.journey += mins * G.people;
    if (G.exp > 1) this.tot.exposed += G.people;
    this.tot.sat += this.satisfaction(G) * G.people;
  }
  /** 0–100 for one group: long journeys, shuttle waits, being diverted from Ramkund and being crushed all count. */
  satisfaction(G) {
    const mins = (this.t - G.tArr) / 60;
    return Math.max(0, Math.min(100, 100 - Math.max(0, mins - 240) * 0.1 - (G.tBus || 0) * 0.08 - (G.diverted ? 8 : 0) - Math.min(30, G.exp * 1.5) - (G.dipped ? 0 : Math.min(40, mins / 9))));
  }
  // ── shuttle buses ──
  buses(t) {
    const need = Math.ceil(GROUP / BUS_SEATS);
    for (const id in this.hubs) {
      const H = this.hubs[id];
      // release highway backlog as parking frees up
      while (H.highway.length && H.occ + GROUP <= H.cap * PER_VEHICLE) { const G = H.highway.shift(); H.highwayPeople -= G.people; this.atHub(G); this.wake(G); }
      for (let i = 0; i < H.q.length && i < 24 && H.idle >= need;) {
        const G = H.q[i];
        // with holding areas, the control room stops sending shuttles to a transfer point that is filling up
        if (this.P.holding && this.nodes[G.tp].rho > 2.0) { i++; continue; }
        H.q.splice(i, 1); H.qPeople -= G.people; H.idle -= need;
        const w = (t - G.tq) / 60; G.tBus = w; H.waitSum += w; H.waitN++; this.tot.busWait += w; this.tot.busWaitN++;
        G.state = 'ride'; this.convoys.push({ k: need, hub: id, tp: G.tp, dir: 1, t0: t, t1: t + TURN_MIN * 60 + this.ride(id, G.tp), G });
      }
      // send idle buses to collect pilgrims waiting to come back
      if (H.idle >= need) for (const tp of this.tps) {
        const n = this.nodes[tp], wait = n.ret[id]; if (!wait || !wait.length) continue;
        const key = `${id}>${tp}`, want = wait.length - (this.enRoute[key] || 0);
        for (let i = 0; i < want && H.idle >= need; i++) { H.idle -= need; this.enRoute[key] = (this.enRoute[key] || 0) + 1; this.convoys.push({ k: need, hub: id, tp, dir: 1, t0: t, t1: t + this.ride(id, tp), G: null, fetch: key }); }
      }
    }
    const keep = [];
    for (const c of this.convoys) {
      if (c.t1 > t) { keep.push(c); continue; }
      if (c.fetch) { this.enRoute[c.fetch]--; c.fetch = null; }
      if (c.dir === 1) {   // arrived at the transfer point
        if (c.G) { const G = c.G; this.startWalk(G, c.tp, G.ghat, 'in'); this.wake(G); }
        const n = this.nodes[c.tp], wait = n.ret[c.hub];
        if (wait && wait.length) { const G = wait.shift(); n.retPeople -= G.people; G.state = 'rideback'; G.tBus += (t - G.tq) / 60; keep.push({ ...c, dir: -1, t0: t, t1: t + TURN_MIN * 60 + this.ride(c.hub, c.tp), G }); }
        else keep.push({ ...c, dir: -1, t0: t, t1: t + this.ride(c.hub, c.tp), G: null });
      } else {             // back at the hub
        if (c.G) this.finish(c.G);
        if (c.reposition) this.hubs[c.reposition].idle += c.k; else this.hubs[c.hub].idle += c.k;
      }
    }
    this.convoys = keep;
  }
  /** ICCC: move idle buses from quiet hubs to the hubs with the longest queues. */
  rebalance() {
    const hubs = Object.values(this.hubs);
    const busy = hubs.filter((h) => h.qPeople > 4 * GROUP).sort((a, b) => b.qPeople / (b.buses + 1) - a.qPeople / (a.buses + 1));
    if (!busy.length) return;
    for (const h of hubs) {
      if (h.qPeople > 0 || h.idle < 20 || h === busy[0] || h.buses < h.base * 0.5) continue;
      const give = Math.min(Math.floor(h.idle * 0.5), Math.floor(h.buses - h.base * 0.5)), to = busy[0];
      if (give <= 0) continue;
      h.idle -= give; h.buses -= give; to.buses += give;
      this.convoys.push({ k: give, hub: h.id, tp: null, dir: -1, t0: this.t, t1: this.t + 20 * 60, G: null, reposition: to.id });
    }
  }
  // ── monitoring ──
  monitor() {
    const t = this.t, h = this.H[Math.floor(t / 3600)];
    let maxRho = 0, crit = 0, busQ = 0, ghatQ = 0, hw = 0;
    const check = (o, name, rho) => {
      rho = Math.min(rho, 6.5);   // beyond this the crowd spills into side streets
      if (rho > maxRho) maxRho = rho;
      if (rho >= CRIT) { crit += this.dt / 60; o.crit += this.dt / 60; if (t - (o.alertT ?? -1e9) > 1800) { o.alertT = t; this.alerts.push({ t, name, rho }); } }
    };
    for (const l of this.links) check(l, l.name, l.rho);
    for (const gid in this.ghats) { const g = this.ghats[gid]; check(g, g.name, g.rho); ghatQ += g.qPeople; }
    for (const tp of this.tps) check(this.nodes[tp], this.nodes[tp].name, this.nodes[tp].rho);
    for (const id in this.hubs) { busQ += this.hubs[id].qPeople; hw += this.hubs[id].highwayPeople; }
    this.tot.critMin += crit;
    h.present += this.present; h.busQ += busQ; h.ghatQ += ghatQ; h.samples++; h.maxRho = Math.max(h.maxRho, maxRho); h.crit += crit;
    this.tot.peakPresent = Math.max(this.tot.peakPresent, this.present); this.tot.peakHighway = Math.max(this.tot.peakHighway, hw);
    this.now = { maxRho, busQ, ghatQ, highway: hw };
    // health: heat exhaustion and stomach upsets scale with people present, sanitation and crowding
    this.tot.health += (this.present / 1e5) * (this.dt / 3600) * 1.1 * (1 + 2 * (1 - this.sanitation())) * (1 + crit / 30);
  }
  sanitation() { return Math.min(1, this.P.toilets / Math.max(1, this.tot.peakPresent / 100)); }
  medicalResponse() { return (4 + 120 / Math.sqrt(Math.max(1, this.P.medical))) * (1 + Math.min(1, (this.now?.maxRho || 0) / 8)); }
  waterQuality() {
    const t = this.t; let recent = 0;
    for (let i = this.tot.dipLog.length - 1; i >= 0 && this.tot.dipLog[i][0] > t - 3 * 3600; i--) recent += this.tot.dipLog[i][1];
    return Math.max(5, Math.min(100, (this.P.release ? 90 : 76) - (recent / 1e5) * (this.P.release ? 2.2 : 4)));
  }
  run(untilT) { while (this.t < Math.min(untilT, this.end)) this.step(); }
  // ── summary for the dashboard ──
  kpis() {
    const T = this.tot, done = Math.max(1, T.done);
    return {
      arrived: T.arrived, dips: T.dips, present: this.present, done: T.done,
      journey: T.journey / done, busWait: T.busWait / Math.max(1, T.busWaitN), ghatWait: T.ghatWait / Math.max(1, T.ghatWaitN),
      critMin: T.critMin, alerts: this.alerts.length, maxRho: this.now?.maxRho || 0, highway: this.now?.highway || 0, peakHighway: T.peakHighway,
      sat: this.satAll(), sanitation: this.sanitation(), medical: this.medicalResponse(), water: this.waterQuality(),
      health: T.health, diverted: T.diverted * GROUP, walkedRoad: T.walkedRoad, exposed: T.exposed, peakPresent: T.peakPresent,
      dipCap: Object.values(this.ghats).reduce((s, g) => s + g.cap, 0), frontage: Object.values(this.ghats).reduce((s, g) => s + g.F, 0),
      busesIdle: Object.values(this.hubs).reduce((s, h) => s + h.idle, 0),
    };
  }
  satAll() {
    let s = this.tot.sat, n = this.tot.done;
    for (let i = 0; i < this.next; i++) { const G = this.groups[i]; if (G.state !== 'done') { s += this.satisfaction(G) * G.people; n += G.people; } }
    return n ? s / n : 0;
  }
  /** Plain-language advice from what happened so far. */
  insights() {
    const K = this.kpis(), out = [], sc = this.sc;
    const peakArr = Math.max(...this.H.slice(0, 24).map((h) => h.arr));
    if (K.dipCap < peakArr * 0.8) out.push({ lvl: 'bad', txt: `Ghats can bathe ${fmt(K.dipCap)} people an hour but up to ${fmt(peakArr)} arrive in an hour. Extend the ghats (Tapovan and Dasak have the most room) or open the Someshwar site.` });
    const worstGhat = Object.values(this.ghats).sort((a, b) => b.crit - a.crit)[0];
    const worstLink = [...this.links].sort((a, b) => b.crit - a.crit)[0];
    if (worstLink && worstLink.crit > 10) out.push({ lvl: 'bad', txt: `Critical crowding (over ${CRIT} people/m²) on ${worstLink.name} for ${Math.round(worstLink.crit)} min. ${!this.P.oneWay ? 'One-way circulation stops in- and out-flows meeting head on. ' : ''}${!this.P.holding ? 'Holding areas at the transfer points would meter people in. ' : ''}${worstLink.ex.widen && !this.P[worstLink.ex.widen] ? 'Widening it would help.' : ''}` });
    if (worstGhat && worstGhat.crit > 10) out.push({ lvl: 'bad', txt: `The waiting area at ${worstGhat.name} reached critical density for ${Math.round(worstGhat.crit)} min.${this.P.iccc ? '' : ' The ICCC could divert pilgrims to emptier ghats.'}` });
    if (sc.amrit && !this.P.iccc && !this.P.holding) out.push({ lvl: 'warn', txt: 'During the akhara procession (03:30–09:30) Ramkund is closed to the public, but pilgrims keep walking towards it and wait at the barricades. Use the ICCC to divert them, or holding areas to keep them at the transfer points.' });
    const hubs = Object.values(this.hubs).filter((h) => h.waitN).map((h) => ({ h, w: h.waitSum / h.waitN })).sort((a, b) => b.w - a.w);
    if (hubs.length && hubs[0].w > 45) out.push({ lvl: 'warn', txt: `Average wait for a shuttle at ${hubs[0].h.name} was ${Math.round(hubs[0].w)} min. Add buses${this.P.iccc ? '' : ', or let the ICCC move idle buses to the busiest hubs'}.` });
    if (K.peakHighway > 20000) out.push({ lvl: 'warn', txt: `Parking filled up: up to ${fmt(K.peakHighway)} pilgrims were stuck in vehicles on the highways. Open more parking hubs (Peth Road, Gangapur Road) or more special trains via Deolali.` });
    if (!this.P.carFree) out.push({ lvl: 'warn', txt: 'Private cars in the city slow the shuttles to about 11 km/h. Keeping the core vehicle-free doubles their speed.' });
    if (K.sanitation < 0.7) out.push({ lvl: 'warn', txt: `Sanitation covers ${Math.round(K.sanitation * 100)}% of the need (1 toilet per 100 people present). Add toilets to cut illness.` });
    if (K.water < 50) out.push({ lvl: 'warn', txt: `Godavari water quality at Ramkund fell to ${Math.round(K.water)}/100.${this.P.release ? '' : ' A release from the Gangapur dam keeps the river flowing.'}` });
    if (K.medical > 20) out.push({ lvl: 'warn', txt: `Medical teams take about ${Math.round(K.medical)} min to reach a patient. Add medical posts.` });
    if (!out.length && this.t > 6 * 3600) out.push({ lvl: 'good', txt: 'The plan is holding: no critical crowding, short queues and shuttles keeping up.' });
    return out;
  }
}
export const fmt = (n) => n >= 1e7 ? `${(n / 1e7).toFixed(2)} cr` : n >= 1e5 ? `${(n / 1e5).toFixed(1)} lakh` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n));
