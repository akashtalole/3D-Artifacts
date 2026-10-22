/**
 * The build: a list of placed parts on a baseplate, with an occupancy grid for collisions and
 * stud ↔ anti-stud connections for snapping, stability and instructions.
 * A placed part: { uid, part, color, x, y, z, r } with x, z the stud cell of its footprint's
 * minimum corner, y its bottom in plates (0 = on the baseplate) and r quarter turns about +y.
 */
import { PART, COLOR, rotCell, dims } from './catalog.js';

const key = (x, y, z) => `${x},${y},${z}`;
export class Build {
  constructor(size = 32) { this.size = size; this.base = 'green'; this.parts = []; this.occ = new Map(); this.nextUid = 1; this.undo = []; this.redo = []; this.listeners = []; }
  on(f) { this.listeners.push(f); }
  emit(what) { for (const f of this.listeners) f(what); }
  // ── geometry of a placed part ──
  /** World cells of the footprint (and studs / anti-studs) for a part at (x, z) with rotation r. */
  cells(p, x, z, r, list = p.cells) { return list.map((c) => { const [i, j] = rotCell(c, p, r); return [x + i, z + j]; }); }
  occCells(pp) {
    const p = PART[pp.part], out = [];
    for (let l = 0; l < p.h; l++) { const lvl = p.occ ? p.occ(l) : null; for (const [cx, cz] of this.cells(p, pp.x, pp.z, pp.r, lvl || p.cells)) out.push([cx, pp.y + l, cz]); }
    return out;
  }
  studCells(pp) { const p = PART[pp.part]; return this.cells(p, pp.x, pp.z, pp.r, p.studs).map(([x, z]) => [x, pp.y + p.h, z]); }
  antiCells(pp) { const p = PART[pp.part]; return this.cells(p, pp.x, pp.z, pp.r, p.anti).map(([x, z]) => [x, pp.y, z]); }
  // ── validity ──
  inBounds(pp) { const [fw, fd] = dims(PART[pp.part], pp.r); return pp.x >= 0 && pp.z >= 0 && pp.x + fw <= this.size && pp.z + fd <= this.size && pp.y >= 0; }
  collides(pp, ignore) { for (const [x, y, z] of this.occCells(pp)) { const o = this.occ.get(key(x, y, z)); if (o && (!ignore || !ignore.has(o))) return true; } return false; }
  /** How many studs this part would connect through (baseplate counts). */
  connections(pp, ignore) {
    let n = 0;
    for (const [x, y, z] of this.antiCells(pp)) { if (y === 0) { n++; continue; } const below = this.occ.get(key(x, y - 1, z)); if (below && (!ignore || !ignore.has(below)) && this.hasStudAt(below, x, y, z)) n++; }
    for (const [x, y, z] of this.studCells(pp)) { const above = this.occ.get(key(x, y, z)); if (above && (!ignore || !ignore.has(above)) && this.hasAntiAt(above, x, y, z)) n++; }
    return n;
  }
  hasStudAt(uid, x, y, z) { const pp = this.byUid(uid); return pp && this.studCells(pp).some((c) => c[0] === x && c[1] === y && c[2] === z); }
  hasAntiAt(uid, x, y, z) { const pp = this.byUid(uid); return pp && this.antiCells(pp).some((c) => c[0] === x && c[1] === y && c[2] === z); }
  canPlace(pp, { free = false, ignore } = {}) { return this.inBounds(pp) && !this.collides(pp, ignore) && (free || this.connections(pp, ignore) > 0); }
  byUid(uid) { return this.index?.get(uid) || this.parts.find((p) => p.uid === uid); }
  reindex() { this.index = new Map(this.parts.map((p) => [p.uid, p])); this.occ.clear(); for (const pp of this.parts) for (const [x, y, z] of this.occCells(pp)) this.occ.set(key(x, y, z), pp.uid); }
  // ── edits (all undoable) ──
  snapshot() { return JSON.stringify({ size: this.size, base: this.base, parts: this.parts }); }
  commit(label) { this.undo.push(this._before); if (this.undo.length > 120) this.undo.shift(); this.redo = []; this._before = null; this.emit(label || 'edit'); }
  begin() { this._before = this.snapshot(); }
  restore(s) { const o = JSON.parse(s); this.size = o.size; this.base = o.base; this.parts = o.parts; this.nextUid = Math.max(1, ...this.parts.map((p) => p.uid + 1)); this.reindex(); }
  doUndo() { if (!this.undo.length) return; this.redo.push(this.snapshot()); this.restore(this.undo.pop()); this.emit('undo'); }
  doRedo() { if (!this.redo.length) return; this.undo.push(this.snapshot()); this.restore(this.redo.pop()); this.emit('redo'); }
  addPart(pp, record = true) {
    if (record) this.begin();
    const n = { uid: this.nextUid++, part: pp.part, color: pp.color, x: pp.x, y: pp.y, z: pp.z, r: pp.r & 3 };
    this.parts.push(n); this.index?.set(n.uid, n);
    for (const [x, y, z] of this.occCells(n)) this.occ.set(key(x, y, z), n.uid);
    if (record) this.commit('add');
    return n;
  }
  addMany(list, label = 'add') { this.begin(); const out = list.map((pp) => this.addPart(pp, false)); this.commit(label); return out; }
  remove(uids, record = true) {
    const set = new Set(uids); if (!set.size) return;
    if (record) this.begin();
    this.parts = this.parts.filter((p) => !set.has(p.uid)); this.reindex();
    if (record) this.commit('remove');
  }
  paint(uids, color) { this.begin(); for (const u of uids) { const p = this.byUid(u); if (p) p.color = color; } this.commit('paint'); }
  replaceColor(from, to) { this.begin(); let n = 0; for (const p of this.parts) if (p.color === from) { p.color = to; n++; } this.commit('paint'); return n; }
  clear() { this.begin(); this.parts = []; this.reindex(); this.commit('clear'); }
  /** Move / rotate / mirror a selection as a block. Returns false if it would collide or leave the plate. */
  transformSel(uids, { dx = 0, dy = 0, dz = 0, rot = 0, mirror = null }, { free = true } = {}) {
    const set = new Set(uids), sel = this.parts.filter((p) => set.has(p.uid)); if (!sel.length) return false;
    // pivot = centre of the selection's footprint
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const p of sel) { const [fw, fd] = dims(PART[p.part], p.r); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x + fw); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z + fd); }
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const moved = sel.map((p) => {
      const part = PART[p.part]; let [fw, fd] = dims(part, p.r); let px = p.x, pz = p.z, r = p.r;
      for (let k = 0; k < ((rot % 4) + 4) % 4; k++) { // quarter turn about the pivot: (x, z) → (cx + (cz − z), cz + (x − cx))
        const nx = cx + (cz - (pz + fd)), nz = cz + (px - cx); px = nx; pz = nz; r = (r + 1) & 3; [fw, fd] = [fd, fw];
      }
      // mirroring flips parts that face across the mirror axis (slopes etc.); symmetric parts don't care
      if (mirror === 'x') { px = 2 * cx - (px + fw); if (r & 1) r = (r + 2) & 3; }
      if (mirror === 'z') { pz = 2 * cz - (pz + fd); if (!(r & 1)) r = (r + 2) & 3; }
      return { ...p, x: Math.round(px + dx), y: p.y + dy, z: Math.round(pz + dz), r };
    });
    const ok = moved.every((m) => this.inBounds(m) && !this.collides(m, set)) && (free || moved.some((m) => this.connections(m, set) > 0));
    if (!ok) return false;
    this.begin();
    for (const m of moved) Object.assign(this.byUid(m.uid), m);
    this.reindex(); this.commit('move');
    return true;
  }
  /** Copies of a selection, offset; returns the new uids or null if blocked. */
  duplicate(uids, dx, dy, dz) {
    const set = new Set(uids), list = this.parts.filter((p) => set.has(p.uid)).map((p) => ({ ...p, x: p.x + dx, y: p.y + dy, z: p.z + dz }));
    if (!list.every((m) => this.inBounds(m) && !this.collides(m))) return null;
    return this.addMany(list, 'duplicate').map((p) => p.uid);
  }
  // ── analysis ──
  /** Connection graph: uid → [{ uid, n studs }] plus the set of parts on the baseplate. */
  graph() {
    const adj = new Map(this.parts.map((p) => [p.uid, new Map()])), ground = new Set();
    for (const pp of this.parts) {
      for (const [x, y, z] of this.antiCells(pp)) {
        if (y === 0) { ground.add(pp.uid); continue; }
        const b = this.occ.get(key(x, y - 1, z));
        if (b && b !== pp.uid && this.hasStudAt(b, x, y, z)) { const m = adj.get(pp.uid), m2 = adj.get(b); m.set(b, (m.get(b) || 0) + 1); m2.set(pp.uid, (m2.get(pp.uid) || 0) + 1); }
      }
    }
    return { adj, ground };
  }
  /** Floating parts (not connected to the baseplate) and weak parts (held by a single stud). */
  stability() {
    const { adj, ground } = this.graph(), seen = new Set(), q = [...ground];
    for (const u of q) seen.add(u);
    while (q.length) { const u = q.shift(); for (const v of adj.get(u).keys()) if (!seen.has(v)) { seen.add(v); q.push(v); } }
    const floating = this.parts.filter((p) => !seen.has(p.uid)).map((p) => p.uid);
    const weak = this.parts.filter((p) => { if (ground.has(p.uid)) return false; let n = 0; for (const c of adj.get(p.uid).values()) n += c; return n === 1; }).map((p) => p.uid);
    // centre of mass (studs, from the plate corner) and height
    let m = 0, mx = 0, mz = 0, top = 0;
    for (const p of this.parts) { const P = PART[p.part], [fw, fd] = dims(P, p.r); m += P.grams; mx += P.grams * (p.x + fw / 2); mz += P.grams * (p.z + fd / 2); top = Math.max(top, p.y + P.h); }
    // connected groups that are not on the plate (for the drop test)
    const comps = []; const left = new Set(floating);
    for (const u of floating) { if (!left.has(u)) continue; const c = [u]; left.delete(u); for (let i = 0; i < c.length; i++) for (const v of adj.get(c[i]).keys()) if (left.has(v)) { left.delete(v); c.push(v); } comps.push(c); }
    return { floating, weak, comps, mass: m, com: m ? [mx / m, mz / m] : [this.size / 2, this.size / 2], height: top };
  }
  /** Drop every floating group straight down until it lands. Returns [{uids, dy}]. */
  dropPlan() {
    const st = this.stability(), plan = [];
    const occ = new Map(this.occ);
    for (const comp of st.comps.sort((a, b) => Math.min(...a.map((u) => this.byUid(u).y)) - Math.min(...b.map((u) => this.byUid(u).y)))) {
      const cells = comp.flatMap((u) => this.occCells(this.byUid(u)));
      for (const c of cells) occ.delete(key(...c));
      let dy = 0;
      for (;;) { const ok = cells.every(([x, y, z]) => y - dy - 1 >= 0 && !occ.has(key(x, y - dy - 1, z))); if (!ok) break; dy++; }
      for (const [x, y, z] of cells) occ.set(key(x, y - dy, z), comp[0]);
      if (dy > 0) plan.push({ uids: comp, dy });
    }
    return plan;
  }
  applyDrop(plan) { this.begin(); for (const { uids, dy } of plan) for (const u of uids) this.byUid(u).y -= dy; this.reindex(); this.commit('drop'); }
  /** Parts list grouped by part and colour. */
  bom() {
    const m = new Map();
    for (const p of this.parts) { const k = `${p.part}|${p.color}`; m.set(k, (m.get(k) || 0) + 1); }
    const rows = [...m].map(([k, n]) => { const [part, color] = k.split('|'); return { part: PART[part], color: COLOR[color], n }; });
    rows.sort((a, b) => a.part.cat.localeCompare(b.part.cat) || a.part.name.localeCompare(b.part.name) || b.n - a.n);
    const tot = { parts: this.parts.length, grams: rows.reduce((s, r) => s + r.n * r.part.grams, 0), price: rows.reduce((s, r) => s + r.n * r.part.price, 0), kinds: rows.length, studs: this.parts.reduce((s, p) => s + PART[p.part].studs.length, 0) };
    return { rows, tot };
  }
  /**
   * Building order: breadth-first from the baseplate through the connections (so every part
   * attaches to something already built), then grouped into steps.
   */
  instructions(maxPerStep = 8) {
    const { adj, ground } = this.graph(), order = [], seen = new Set();
    let frontier = [...ground].map((u) => this.byUid(u)).sort((a, b) => a.y - b.y || a.z - b.z || a.x - b.x).map((p) => p.uid);
    const depth = new Map(); frontier.forEach((u) => depth.set(u, 0));
    while (frontier.length) {
      for (const u of frontier) { if (!seen.has(u)) { seen.add(u); order.push(u); } }
      const next = [];
      for (const u of frontier) for (const v of adj.get(u).keys()) if (!seen.has(v) && !next.includes(v)) { next.push(v); depth.set(v, depth.get(u) + 1); }
      frontier = next.map((u) => this.byUid(u)).sort((a, b) => a.y - b.y || a.z - b.z || a.x - b.x).map((p) => p.uid);
    }
    for (const p of this.parts) if (!seen.has(p.uid)) order.push(p.uid);   // floating parts last
    // group: same bottom level and depth, up to maxPerStep, keep a stable spatial order
    const steps = []; let cur = [];
    for (const u of order) {
      const p = this.byUid(u), prev = cur.length && this.byUid(cur[0]);
      if (cur.length >= maxPerStep || (prev && (prev.y !== p.y || depth.get(cur[0]) !== depth.get(u)))) { steps.push(cur); cur = []; }
      cur.push(u);
    }
    if (cur.length) steps.push(cur);
    return steps;
  }
  // ── files ──
  toJSON() { return { app: 'brick-studio', version: 1, size: this.size, base: this.base, parts: this.parts.map(({ uid, ...p }) => p) }; }
  load(o, label = 'open') {
    this.begin();
    this.size = o.size || 32; this.base = o.base || 'green'; this.parts = []; this.nextUid = 1;
    for (const p of o.parts || []) if (PART[p.part] && COLOR[p.color]) this.parts.push({ uid: this.nextUid++, part: p.part, color: p.color, x: p.x, y: p.y, z: p.z, r: p.r & 3 });
    this.reindex(); this.commit(label);
  }
  /** LDraw model (.ldr): 20 LDU per stud, 8 LDU per plate, −y is up; part origin at the top centre. */
  toLDraw(name = 'Brick Studio model') {
    const L = [`0 ${name}`, '0 Name: model.ldr', '0 Author: Brick Studio', '0 Generated by Brick Studio (approximate part orientations for slopes and specials)'];
    const R = [[1, 0, 0, 0, 1, 0, 0, 0, 1], [0, 0, 1, 0, 1, 0, -1, 0, 0], [-1, 0, 0, 0, 1, 0, 0, 0, -1], [0, 0, -1, 0, 1, 0, 1, 0, 0]];
    for (const p of this.parts) {
      const P = PART[p.part], [fw, fd] = dims(P, p.r);
      const x = (p.x + fw / 2 - this.size / 2) * 20, z = (p.z + fd / 2 - this.size / 2) * 20, y = -(p.y + P.h) * 8;
      L.push(`1 ${COLOR[p.color].ldraw} ${x} ${y} ${z} ${R[p.r].join(' ')} ${P.ldraw}.dat`);
    }
    return L.join('\r\n') + '\r\n';
  }
  fromLDraw(text) {
    const byLd = new Map(Object.values(PART).map((p) => [p.ldraw.toLowerCase(), p])), byCol = new Map(Object.values(COLOR).map((c) => [c.ldraw, c]));
    const out = []; let skipped = 0;
    for (const line of text.split(/\r?\n/)) {
      const t = line.trim().split(/\s+/); if (t[0] !== '1' || t.length < 15) continue;
      const file = t[14].toLowerCase().replace(/\.dat$/, ''), P = byLd.get(file) || byLd.get(file.replace(/[a-z]$/, ''));
      const col = byCol.get(+t[1]) || COLOR.lbg; if (!P) { skipped++; continue; }
      const a = +t[5], c = +t[7];   // rotation about y from the matrix
      const r = Math.round(Math.atan2(c, a) / (Math.PI / 2)) & 3;
      const [fw, fd] = dims(P, r);
      out.push({ part: P.id, color: col.id, r, x: Math.round(+t[2] / 20 + this.size / 2 - fw / 2), z: Math.round(+t[4] / 20 + this.size / 2 - fd / 2), y: Math.round(-+t[3] / 8 - P.h) });
    }
    return { parts: out, skipped };
  }
  toBrickLinkXML() {
    const { rows } = this.bom();
    return `<INVENTORY>\n${rows.map((r) => `  <ITEM><ITEMTYPE>P</ITEMTYPE><ITEMID>${r.part.ldraw.replace(/[a-z]$/, '')}</ITEMID><COLOR>${r.color.bl}</COLOR><MINQTY>${r.n}</MINQTY></ITEM>`).join('\n')}\n</INVENTORY>\n`;
  }
  toCSV() {
    const { rows, tot } = this.bom();
    const esc = (s) => `"${String(s).replace(/"/g, '""')}"`;
    return ['Part,Part number,Colour,LDraw colour,BrickLink colour,Quantity,Grams each,Est. ₹ each', ...rows.map((r) => [esc(r.part.name), r.part.ldraw, esc(r.color.name), r.color.ldraw, r.color.bl, r.n, r.part.grams, r.part.price].join(',')), `Total,,,,,${tot.parts},${tot.grams.toFixed(1)},${tot.price.toFixed(0)}`].join('\n');
  }
}
