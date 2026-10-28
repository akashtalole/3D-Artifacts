/**
 * Shared with projects/polyhouse-vertical-farm and projects/maharashtra-grid, with a year axis option.
 * Small line charts on canvas: one y-axis, a shaded target band, a legend for two or more
 * series with end-of-line labels, and a crosshair tooltip that reads every series at that time.
 */
export const SERIES = ['#3987e5', '#d95926', '#199e70', '#c98500'];   // dark-surface categorical slots 1–4
const INK = '#eef1f4', MUTED = '#9aa4b0', GRID = 'rgba(255,255,255,0.07)', BAND = 'rgba(63,207,142,0.12)';
const hh = (t) => { const h = ((t % 24) + 24) % 24; return `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`; };

export function lineChart(host, opts) {
  host.classList.add('chart');
  const head = document.createElement('div'); head.className = 'chead';
  const title = document.createElement('b'); title.textContent = opts.title; head.appendChild(title);
  const legend = document.createElement('span'); legend.className = 'legend'; head.appendChild(legend);
  const cv = document.createElement('canvas'); const tip = document.createElement('div'); tip.className = 'ctip';
  host.append(head, cv, tip);
  let data = null, hover = null;
  function renderLegend() {
    legend.textContent = '';
    if (opts.series.length < 2 && !opts.band) return;
    for (const [i, s] of opts.series.entries()) { const k = document.createElement('i'); k.style.background = s.color || SERIES[i]; legend.append(k, document.createTextNode(s.name)); }
    if (opts.band) { const k = document.createElement('i'); k.className = 'bandkey'; legend.append(k, document.createTextNode(opts.bandName || 'Target')); }
  }
  renderLegend();
  function draw() {
    if (!data || !host.offsetParent) return;
    const dpr = Math.min(2, devicePixelRatio || 1), W = host.clientWidth, H = opts.h || 120;
    cv.width = W * dpr; cv.height = H * dpr; cv.style.height = `${H}px`;
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const L = 34, R = opts.endLabels === false ? 8 : 44, T = 6, B = 18, pw = W - L - R, ph = H - T - B;
    const t = data.t; if (t.length < 2) return;
    let lo = Infinity, hi = -Infinity;
    for (const s of opts.series) for (const v of data[s.key]) if (Number.isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    if (opts.band) { lo = Math.min(lo, opts.band[0]); hi = Math.max(hi, opts.band[1]); }
    if (opts.yMin !== undefined) lo = Math.min(lo, opts.yMin); if (opts.yMax !== undefined) hi = Math.max(hi, opts.yMax);
    const pad = (hi - lo) * 0.08 || 1; lo -= pad; hi += pad; if (opts.yMin === 0) lo = Math.max(0, lo);
    const step = niceStep((hi - lo) / 4); lo = Math.floor(lo / step) * step; if (opts.yMin === 0) lo = Math.max(0, lo); hi = Math.ceil(hi / step) * step;
    const t0 = t[0], t1 = t[t.length - 1], X = (v) => L + ((v - t0) / (t1 - t0 || 1)) * pw, Y = (v) => T + (1 - (v - lo) / (hi - lo)) * ph;
    g.font = '10.5px Inter, system-ui, sans-serif'; g.fillStyle = MUTED; g.textBaseline = 'middle'; g.textAlign = 'right';
    for (let v = lo; v <= hi + 1e-9; v += step) { g.strokeStyle = GRID; g.lineWidth = 1; g.beginPath(); g.moveTo(L, Y(v) + 0.5); g.lineTo(L + pw, Y(v) + 0.5); g.stroke(); g.fillText(fmt(v, step), L - 5, Y(v)); }
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    if (opts.ticks) for (const h of opts.ticks) g.fillText(String(h), X(h), H - 4); else for (let h = Math.ceil(t0 / 6) * 6; h <= t1; h += 6) g.fillText(hh(h).slice(0, 5), X(h), H - 4);
    if (opts.band) { g.fillStyle = BAND; g.fillRect(L, Y(opts.band[1]), pw, Y(opts.band[0]) - Y(opts.band[1])); }
    opts.series.forEach((s, i) => {
      const ys = data[s.key]; g.strokeStyle = s.color || SERIES[i]; g.lineWidth = 2; g.lineJoin = 'round'; g.beginPath(); let on = false;
      ys.forEach((v, k) => { if (!Number.isFinite(v)) { on = false; return; } const x = X(t[k]), y = Y(v); if (on) g.lineTo(x, y); else { g.moveTo(x, y); on = true; } });
      g.stroke();
      if (opts.endLabels !== false && opts.series.length <= 4) { const v = ys[ys.length - 1]; if (Number.isFinite(v)) { g.fillStyle = INK; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(fmt(v, step / 10), L + pw + 5, Y(v) + (i ? 6 * i : 0)); } }
    });
    if (hover !== null) {
      const k = Math.round(((hover - L) / pw) * (t.length - 1)); if (k >= 0 && k < t.length) {
        const x = X(t[k]); g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + 0.5, T); g.lineTo(x + 0.5, T + ph); g.stroke();
        tip.textContent = ''; const hd = document.createElement('div'); hd.className = 'ctime'; hd.textContent = opts.xfmt ? opts.xfmt(t[k]) : hh(t[k]); tip.appendChild(hd);
        opts.series.forEach((s, i) => {
          const v = data[s.key][k]; if (!Number.isFinite(v)) return;
          g.fillStyle = s.color || SERIES[i]; g.beginPath(); g.arc(x, Y(v), 4, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#1c2026'; g.lineWidth = 2; g.stroke();
          const row = document.createElement('div'); const key = document.createElement('i'); key.style.background = s.color || SERIES[i];
          const val = document.createElement('b'); val.textContent = `${fmt(v, step / 10)} ${opts.unit || ''}`; const nm = document.createElement('span'); nm.textContent = s.name;
          row.append(key, val, nm); tip.appendChild(row);
        });
        tip.style.display = 'block'; const tw = tip.offsetWidth; tip.style.left = `${Math.min(W - tw - 4, Math.max(4, x + 10))}px`; tip.style.top = `${T + 18}px`;
      }
    } else tip.style.display = 'none';
  }
  cv.addEventListener('pointermove', (e) => { const r = cv.getBoundingClientRect(); hover = e.clientX - r.left; draw(); });
  cv.addEventListener('pointerleave', () => { hover = null; draw(); });
  return { update(d) { data = d; draw(); }, draw, set(o) { Object.assign(opts, o); renderLegend(); } };
}
function niceStep(raw) { const p = 10 ** Math.floor(Math.log10(raw)), f = raw / p; return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p; }
function fmt(v, step) { const d = step >= 1 ? 0 : step >= 0.1 ? 1 : 2; return v.toFixed(d); }

/**
 * Stacked area of generation by source over the day, with demand as a line on the same axis.
 * series: [{name, key, color}], line: {name, key}; x is the hour of day.
 */
export function stackChart(host, opts) {
  host.classList.add('chart');
  const head = document.createElement('div'); head.className = 'chead';
  const title = document.createElement('b'); title.textContent = opts.title; head.appendChild(title);
  const legend = document.createElement('span'); legend.className = 'legend';
  for (const s of opts.series) { const k = document.createElement('i'); k.className = 'box'; k.style.background = s.color; legend.append(k, document.createTextNode(s.name)); }
  if (opts.line) { const k = document.createElement('i'); k.style.background = '#ffffff'; legend.append(k, document.createTextNode(opts.line.name)); }
  head.appendChild(legend);
  const cv = document.createElement('canvas'), tip = document.createElement('div'); tip.className = 'ctip'; host.append(head, cv, tip);
  let data = null, hover = null;
  function draw() {
    if (!data || !host.offsetParent) return;
    const dpr = Math.min(2, devicePixelRatio || 1), W = host.clientWidth, H = opts.h || 170;
    cv.width = W * dpr; cv.height = H * dpr; cv.style.height = `${H}px`;
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const L = 38, R = 8, T = 6, B = 18, pw = W - L - R, ph = H - T - B, n = data.t.length; if (n < 2) return;
    const tot = data.t.map((_, k) => opts.series.reduce((a, s) => a + Math.max(0, data[s.key][k]), 0));
    let hi = Math.max(...tot, ...(opts.line ? data[opts.line.key] : [0])) * 1.08; const step = niceStep(hi / 4); hi = Math.ceil(hi / step) * step;
    const lo = Math.min(0, ...opts.series.flatMap((s) => data[s.key].map((v) => Math.min(0, v))));
    const x0 = opts.x0 ?? 0, x1 = opts.x1 ?? 24, X = (k) => L + ((data.t[k] - x0) / (x1 - x0)) * pw, Y = (v) => T + (1 - (v - lo) / (hi - lo)) * ph;
    g.font = '10.5px Inter, system-ui, sans-serif'; g.fillStyle = MUTED; g.textAlign = 'right'; g.textBaseline = 'middle';
    for (let v = 0; v <= hi + 1e-9; v += step) { g.strokeStyle = GRID; g.beginPath(); g.moveTo(L, Y(v) + 0.5); g.lineTo(L + pw, Y(v) + 0.5); g.stroke(); g.fillText(v >= 1000 ? `${(v / 1000).toFixed(v % 1000 ? 1 : 0)}k` : `${v}`, L - 5, Y(v)); }
    g.textAlign = 'center'; g.textBaseline = 'alphabetic'; for (const h of opts.ticks || [0, 6, 12, 18, 24]) g.fillText(opts.ticks ? String(h) : `${String(h).padStart(2, '0')}:00`, L + ((h - x0) / (x1 - x0)) * pw, H - 4);
    const base = new Float64Array(n);
    for (const s of opts.series) {
      g.fillStyle = s.color; g.beginPath();
      for (let k = 0; k < n; k++) { const v = Math.max(0, data[s.key][k]); const x = X(k), y = Y(base[k] + v); if (k) g.lineTo(x, y); else g.moveTo(x, y); }
      for (let k = n - 1; k >= 0; k--) g.lineTo(X(k), Y(base[k]));
      g.closePath(); g.fill(); g.strokeStyle = '#1c2026'; g.lineWidth = 1; g.stroke();
      for (let k = 0; k < n; k++) base[k] += Math.max(0, data[s.key][k]);
    }
    if (opts.line) { g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.beginPath(); data[opts.line.key].forEach((v, k) => { if (k) g.lineTo(X(k), Y(v)); else g.moveTo(X(k), Y(v)); }); g.stroke(); }
    if (opts.now !== undefined) { const x = L + ((opts.now - x0) / (x1 - x0)) * pw; g.strokeStyle = 'rgba(255,255,255,0.5)'; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(x, T); g.lineTo(x, T + ph); g.stroke(); g.setLineDash([]); }
    if (hover !== null) {
      const k = Math.max(0, Math.min(n - 1, Math.round(((hover - L) / pw) * (n - 1)))); const x = X(k);
      g.strokeStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.moveTo(x + 0.5, T); g.lineTo(x + 0.5, T + ph); g.stroke();
      tip.textContent = ''; const hd = document.createElement('div'); hd.className = 'ctime'; const hh = data.t[k]; hd.textContent = opts.xfmt ? opts.xfmt(hh) : `${String(Math.floor(hh)).padStart(2, '0')}:${String(Math.round((hh % 1) * 60)).padStart(2, '0')}`; tip.appendChild(hd);
      const rows = opts.line ? [{ ...opts.line, color: '#ffffff' }, ...[...opts.series].reverse()] : [...opts.series].reverse();
      for (const s of rows) { const v = data[s.key][k]; if (!v || Math.abs(v) < 1) continue; const row = document.createElement('div'), key = document.createElement('i'), val = document.createElement('b'), nm = document.createElement('span'); key.style.background = s.color; val.textContent = `${Math.round(v).toLocaleString('en-IN')} ${opts.unit || 'MW'}`; nm.textContent = s.name; row.append(key, val, nm); tip.appendChild(row); }
      tip.style.display = 'block'; const tw = tip.offsetWidth; tip.style.left = `${Math.min(W - tw - 4, Math.max(4, x + 10))}px`; tip.style.top = `${T + 10}px`;
    } else tip.style.display = 'none';
  }
  cv.addEventListener('pointermove', (e) => { const r = cv.getBoundingClientRect(); hover = e.clientX - r.left; draw(); });
  cv.addEventListener('pointerleave', () => { hover = null; draw(); });
  return { update(d, now) { data = d; opts.now = now; draw(); }, draw };
}
