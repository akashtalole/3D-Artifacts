/**
 * Reads a diagram (nodes + directed edges) and answers questions about it:
 * what is connected to what, which group a service sits in, whether a path
 * survives losing an Availability Zone, and what it costs.
 */
import { SVC } from './catalog.js';

export const TILE = { w: 80, h: 84 };
const arr = (k) => (Array.isArray(k) ? k : [k]);

export function analyze(nodes, edges, failedAz = null) {
  const svcs = nodes.filter((n) => n.type === 'svc');
  const groups = nodes.filter((n) => n.type === 'group');
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const center = (n) => [n.x + TILE.w / 2, n.y + TILE.h / 2];
  const inside = (g, [x, y]) => x >= g.x && x <= g.x + g.w && y >= g.y && y <= g.y + g.h;
  const containers = new Map();       // svc id → groups that contain it (innermost first)
  for (const s of svcs) containers.set(s.id, groups.filter((g) => inside(g, center(s))).sort((a, b) => a.w * a.h - b.w * b.h));
  const groupOf = (s, kind) => containers.get(s.id)?.find((g) => g.kind === kind) || null;
  const of = (k) => svcs.filter((s) => arr(k).includes(s.kind));
  const out = new Map(svcs.map((s) => [s.id, []]));
  for (const e of edges) if (out.has(e.from) && byId.has(e.to)) out.get(e.from).push(e.to);
  const azBlocked = (az) => new Set(svcs.filter((s) => groupOf(s, 'az')?.id === az).map((s) => s.id));

  function reach(fromKinds, blocked = new Set()) {
    const seen = new Set(), q = of(fromKinds).filter((s) => !blocked.has(s.id)).map((s) => s.id);
    q.forEach((id) => seen.add(id));
    while (q.length) { const id = q.shift(); for (const t of out.get(id) || []) if (!seen.has(t) && !blocked.has(t)) { seen.add(t); q.push(t); } }
    return seen;
  }

  const api = {
    nodes, edges, svcs, groups, byId,
    count: (k) => of(k).length,
    has: (k, n = 1) => of(k).length >= n,
    groupCount: (kind) => groups.filter((g) => g.kind === kind).length,
    /** direct edge a → b */
    edge: (a, b) => edges.some((e) => arr(a).includes(byId.get(e.from)?.kind) && arr(b).includes(byId.get(e.to)?.kind)),
    /** edge either way */
    linked: (a, b) => api.edge(a, b) || api.edge(b, a),
    /** number of edges a → b */
    edgeCount: (a, b) => edges.filter((e) => arr(a).includes(byId.get(e.from)?.kind) && arr(b).includes(byId.get(e.to)?.kind)).length,
    /** directed path from any a to any b */
    path: (a, b, blocked) => { const r = reach(a, blocked); return of(b).some((s) => r.has(s.id)); },
    /** every service of kind k sits inside a group of kind gk (and there is at least one) */
    allIn: (k, gk) => of(k).length > 0 && of(k).every((s) => groupOf(s, gk)),
    anyIn: (k, gk) => of(k).some((s) => groupOf(s, gk)),
    /** services of kind k are spread over at least n different AZ groups */
    spreadAZ: (k, n = 2) => new Set(of(k).map((s) => groupOf(s, 'az')?.id).filter(Boolean)).size >= n,
    /** a path from a to b still exists whichever single AZ fails */
    survivesAZ: (a, b) => {
      const azs = groups.filter((g) => g.kind === 'az');
      if (azs.length < 2 || !api.path(a, b)) return false;
      return azs.every((az) => api.path(a, b, azBlocked(az.id)));
    },
    groupOf,
    cost: svcs.reduce((s, n) => s + (SVC[n.kind]?.cost || 0), 0),
  };
  // Live reachability for the traffic animation (honours a failed AZ)
  const blocked = failedAz ? azBlocked(failedAz) : new Set();
  api.blocked = blocked;
  api.live = reach(['users', 'mobile', 'internet', 'office'], blocked);
  return api;
}
