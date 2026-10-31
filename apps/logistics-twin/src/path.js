/** Grid A* with octile heuristic, line-of-sight smoothing and a result cache. */
export class Planner {
  constructor({ g, gw, gh }) {
    this.g = g; this.gw = gw; this.gh = gh;
    const n = gw * gh;
    this.gs = new Float32Array(n); this.from = new Int32Array(n); this.seen = new Uint32Array(n); this.closed = new Uint32Array(n);
    this.gen = 0; this.cache = new Map(); this.calls = 0;
    this.heap = new Int32Array(n * 2); this.hf = new Float32Array(n * 2);
  }
  free(x, y) { return x >= 0 && y >= 0 && x < this.gw && y < this.gh && !this.g[y * this.gw + x]; }
  nearestFree(x, y) {
    x = Math.floor(x); y = Math.floor(y);
    if (this.free(x, y)) return [x, y];
    for (let r = 1; r < 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (this.free(x + dx, y + dy)) return [x + dx, y + dy];
    return [x, y];
  }
  /** Path between world points → array of [x, y] waypoints (cell centres, smoothed). */
  find(ax, ay, bx, by) {
    const [sx, sy] = this.nearestFree(ax, ay), [tx, ty] = this.nearestFree(bx, by);
    const key = (sy * this.gw + sx) * 20000 + (ty * this.gw + tx);
    let cells = this.cache.get(key);
    if (!cells) {
      cells = this.astar(sx, sy, tx, ty);
      if (this.cache.size > 30000) this.cache.clear();
      this.cache.set(key, cells);
    }
    const pts = cells.map(([x, y]) => [x + 0.5, y + 0.5]);
    if (pts.length) { pts[0] = [ax, ay]; pts.push([bx, by]); } else pts.push([ax, ay], [bx, by]);
    return pts;
  }
  astar(sx, sy, tx, ty) {
    this.calls++;
    const { gw, g } = this; const gen = ++this.gen; const S = sy * gw + sx, T = ty * gw + tx;
    if (S === T) return [[sx, sy]];
    const heap = this.heap, hf = this.hf; let hn = 0;
    const push = (i, f) => { let k = hn++; while (k > 0) { const p = (k - 1) >> 1; if (hf[p] <= f) break; heap[k] = heap[p]; hf[k] = hf[p]; k = p; } heap[k] = i; hf[k] = f; };
    const pop = () => { const top = heap[0]; const li = heap[--hn], lf = hf[hn]; let k = 0; for (;;) { let c = 2 * k + 1; if (c >= hn) break; if (c + 1 < hn && hf[c + 1] < hf[c]) c++; if (hf[c] >= lf) break; heap[k] = heap[c]; hf[k] = hf[c]; k = c; } heap[k] = li; hf[k] = lf; return top; };
    const h = (i) => { const dx = Math.abs((i % gw) - tx), dy = Math.abs(((i / gw) | 0) - ty); return dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy); };
    this.gs[S] = 0; this.seen[S] = gen; this.from[S] = -1; push(S, h(S));
    const D8 = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
    let found = false;
    while (hn) {
      const c = pop(); if (this.closed[c] === gen) continue; this.closed[c] = gen;
      if (c === T) { found = true; break; }
      const cx = c % gw, cy = (c / gw) | 0;
      for (const [dx, dy, w] of D8) {
        const nx = cx + dx, ny = cy + dy; if (!this.free(nx, ny)) continue;
        if (dx && dy && (!this.free(cx + dx, cy) || !this.free(cx, cy + dy))) continue;
        const n = ny * gw + nx; if (this.closed[n] === gen) continue;
        const ng = this.gs[c] + w;
        if (this.seen[n] !== gen || ng < this.gs[n]) { this.seen[n] = gen; this.gs[n] = ng; this.from[n] = c; push(n, ng + h(n)); }
      }
    }
    if (!found) return [];
    const raw = []; for (let i = T; i !== -1; i = this.from[i]) raw.push([i % gw, (i / gw) | 0]);
    raw.reverse();
    // string pulling
    const out = [raw[0]]; let a = 0;
    while (a < raw.length - 1) {
      let b = raw.length - 1;
      while (b > a + 1 && !this.los(raw[a], raw[b])) b--;
      out.push(raw[b]); a = b;
    }
    void g;
    return out;
  }
  los([x0, y0], [x1, y1]) {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2.5);
    for (let i = 1; i < n; i++) {
      const t = i / n, x = x0 + (x1 - x0) * t + 0.5, y = y0 + (y1 - y0) * t + 0.5;
      for (const [ox, oy] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) if (!this.free(Math.floor(x + ox), Math.floor(y + oy))) return false;
    }
    return true;
  }
}
export function pathLength(p) { let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return L; }
