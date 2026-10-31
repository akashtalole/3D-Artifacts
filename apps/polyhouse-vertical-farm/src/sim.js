/**
 * Climate models, controllers and anomaly detection. No three.js here, so it also runs in Node.
 *
 * The polyhouse model is a lumped energy, water-vapour and CO₂ balance per m² of floor:
 * solar gain through the cover and shade screen, conduction through the cover, natural
 * ventilation (wind and stack), fan-and-pad evaporative cooling, fogging, crop transpiration
 * and photosynthesis. The vertical-farm model balances LED heat, HVAC, dehumidification,
 * CO₂ dosing and lettuce growth. Both are deliberately simple; they behave the right way,
 * not to the decimal.
 */
import { PH, VF, SEASONS, TARIFF, WATER_COST } from './data.js';

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const med = (a) => { const s = [...a].sort((p, q) => p - q), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const mean = (a) => a.reduce((p, q) => p + q, 0) / a.length;
const jit = (t, i) => Math.sin(t * 97.3 + i * 12.9898) * 0.5 + Math.sin(t * 41.7 + i * 78.233) * 0.5;   // deterministic noise in [-1, 1]

// ── psychrometrics ──
export const es = (T) => 0.6108 * Math.exp((17.27 * T) / (T + 237.3));                      // kPa
export const xOf = (T, rh) => { const e = (es(T) * rh) / 100; return (622 * e) / (101.3 - e); };   // g/kg
export const rhOf = (T, x) => clamp((100 * ((x * 101.3) / (622 + x))) / es(T), 1, 100);
export const vpdOf = (T, rh) => es(T) * (1 - rh / 100);
export function twb(T, rh) {   // Stull (2011)
  return T * Math.atan(0.151977 * Math.sqrt(rh + 8.313659)) + Math.atan(T + rh) - Math.atan(rh - 1.676331) + 0.00391838 * rh ** 1.5 * Math.atan(0.023101 * rh) - 4.686035;
}

// ── weather (a typical day near Pune for each season) ──
export function weather(season, t, lead = 0) {
  const S = SEASONS[season], h = ((t % 24) + 24) % 24, d = Math.floor(t / 24);
  const wob = 0.6 * Math.sin(t * 0.37 + d * 1.3) + 0.4 * Math.sin(t * 1.13 + 2);
  const T = S.tmean + S.amp * Math.cos((2 * Math.PI * (h - 15)) / 24) + 0.5 * wob + (lead ? 0.12 * lead * Math.sin(d * 2.3 + 1) : 0);
  const x = xOf(S.tmean, S.rh) * (1 + 0.05 * Math.sin(t * 0.21 + d));
  const RH = clamp(rhOf(T, x), 8, 99);
  const u = (h - S.rise) / (S.set - S.rise), elev = u > 0 && u < 1 ? Math.sin(Math.PI * u) : 0;
  const cn = 0.5 + 0.5 * Math.sin(t * 2.7 + d * 0.9) * Math.sin(t * 0.83 + 1.7);
  const cloud = clamp(S.cloud * (0.4 + 1.2 * cn), 0, 1);
  const G = S.g * Math.pow(elev, 1.25) * (1 - 0.72 * cloud);
  const wind = S.wind * (0.55 + 0.45 * elev + 0.25 * Math.sin(t * 1.7));
  return { T, RH, x, G, wind, cloud, elev, u, h, rain: season === 'monsoon' && cloud > 0.72, co2: 420 };
}

// ════════════════════════ POLYHOUSE ════════════════════════
const TAU = 0.72, H = PH.vol / PH.area, AIR = 1.2;
export const P_VALUE = (crop) => (crop.yield * crop.price) / 4500;   // ₹ per g CO₂ fixed, from yield × price over a typical annual gross uptake

export function phInit(crop) {
  return {
    T: 23, x: xOf(23, 72), C: 480, theta: Array.from({ length: PH.beds }, (_, i) => 34 + (i % 3) - 1), ec: crop.ec, ph: 6.0, radSum: Array(PH.beds).fill(0),
    acc: newAcc(), wet: 0,
  };
}
const newAcc = () => ({ drip: 0, fog: 0, pad: 0, drain: 0, kwh: 0, cost: 0, P: 0, Ppot: 0, inT: 0, inV: 0, n: 0, wetH: 0, hot: 0 });

/** Instantaneous rates for state s under action a and weather w. */
export function phRates(s, a, w, crop, f = {}) {
  const Rin = w.G * TAU * (1 - 0.5 * a.shade);
  const rh = rhOf(s.T, s.x), V = vpdOf(s.T, rh);
  const achNat = 1.5 + a.vent * (9 + 5.5 * w.wind) + a.vent * 1.2 * Math.max(0, s.T - w.T);
  let ach = achNat, Tsup = w.T, xsup = w.x, padL = 0;
  const wet = a.fans > 0 && a.pad && !f.pad;
  if (a.fans > 0) {
    const fanACH = (a.fans * PH.fanFlow) / PH.vol;
    const Tpad = wet ? w.T - 0.8 * (w.T - twb(w.T, w.RH)) : w.T;
    const xpad = w.x + 0.402 * (w.T - Tpad);
    const short = a.vent * 0.6;   // open side vents short-circuit the pad wall
    ach = fanACH + achNat * 0.4; Tsup = Tpad * (1 - short) + w.T * short; xsup = xpad * (1 - short) + w.x * short;
    if (wet) padL = (a.fans * PH.fanFlow * AIR * (xpad - w.x)) / 1000 * 1.2;   // evaporation + 20% bleed, L/h
  }
  const Gv = (AIR * 1006 * H * ach) / 3600, Gc = 7;
  const E = 0.95 * (0.0009 * Rin + 0.05 * Math.min(V, 3)) * (V > 2.2 ? 0.7 : 1);   // transpiration, kg/m²/h
  const fogRate = a.fog * 0.12, fogEvap = fogRate * clamp((96 - rh) / 20, 0, 1), fogDrip = fogRate - fogEvap;
  const S = Rin * 0.42, sky = w.G < 5 ? -12 * (1 - w.cloud) : 0;
  const Teq = (Gv * Tsup + Gc * w.T + S + sky - fogEvap * 680) / (Gv + Gc);
  const xeq = xsup + ((E + fogEvap) * 1000) / Math.max(AIR * H * ach, 3);
  const PAR = Rin * 2.05, PARpot = w.G * TAU * 2.05;
  const fC = (1.875 * s.C) / (s.C + 350), fT = Math.exp(-(((s.T - 24) / 11) ** 2)), fV = clamp(1 - (V - 1.6) / 2.2, 0.35, 1);
  const P = 4.2 * (1 - Math.exp(-PAR / 750)) * fC * fT * fV, Ppot = 4.2 * (1 - Math.exp(-PARpot / 750));
  const resp = 0.3, dose = a.co2 ? 4.5 : 0;
  const Ceq = Math.max(150, w.co2 + (dose - P + resp) / (0.0018 * H * Math.max(ach, 0.5)));
  const nOpen = a.drip ? a.drip.filter(Boolean).length : 0;
  const kw = a.fans * PH.fanKW + (wet ? PH.padPumpKW : 0) + a.fog * PH.fogKW + (nOpen ? PH.dripKW * Math.min(1, nOpen / 4) : 0);
  return { Rin, ach, Tsup, Teq, xeq, Ceq, Gv, Gc, E, P, Ppot, fogEvap, fogDrip, padL, fogL: fogRate * PH.area, kw, rh, V, wet };
}

/** Advance s by dt seconds. Returns the rates used. */
export function phStep(s, a, w, crop, dt, f = {}, t = 0) {
  const r = phRates(s, a, w, crop, f), k = (tau) => 1 - Math.exp(-dt / tau);
  s.T += (r.Teq - s.T) * k(30000 / (r.Gv + r.Gc));
  s.x += (r.xeq - s.x) * k(Math.max(300, 3600 / Math.max(r.ach, 0.6)));
  s.x = Math.min(s.x, xOf(s.T, 97));
  s.C += (r.Ceq - s.C) * k(Math.max(240, 3600 / Math.max(r.ach, 0.5)));
  // substrate moisture per bed (beds are half the floor; 120 L/m² root zone at 100%)
  const hrs = dt / 3600;
  for (let i = 0; i < PH.beds; i++) {
    const micro = 1 + 0.08 * Math.sin(i * 1.7);
    let d = -r.E * micro * 1.67 * hrs;
    if (a.drip?.[i]) { const q = f.clog && i === 6 ? 0.33 : 1; d += 11 * q * hrs; s.acc.drip += 13.3 * 1 * PH.len * q * hrs; }
    s.theta[i] = s.theta[i] + d;
    if (s.theta[i] > 42) { const ex = (s.theta[i] - 42) * Math.min(1, dt / 900); s.theta[i] -= ex; s.acc.drain += ex * 1.2 * PH.len; }
    s.radSum[i] += (r.Rin * dt) / 1e6;
  }
  // fertigation
  if (a.drip?.some(Boolean)) s.ec = f.ec && !f.ecHold ? Math.min(4.6, s.ec + 0.9 * hrs * 6) : s.ec + (crop.ec - s.ec) * Math.min(1, dt / 600);
  s.ph = crop.ph + 0.08 * Math.sin(t * 0.7);
  // accounting
  const A = s.acc, band = w.G > 30 ? crop.day : crop.night;
  A.fog += r.fogL * hrs; A.pad += r.padL * hrs;
  A.kwh += r.kw * hrs; A.cost += r.kw * hrs * TARIFF(w.h);
  A.P += r.P * hrs; A.Ppot += r.Ppot * hrs; A.n += dt;
  if (s.T >= band[0] - 0.01 && s.T <= band[1] + 0.01) A.inT += dt;
  if (r.V >= crop.vpd[0] && r.V <= crop.vpd[1]) A.inV += dt;
  if (s.T > band[1] + 3) A.hot += dt;
  const leafWet = r.rh > 92 || r.fogDrip > 0.01;
  if (leafWet) A.wetH += hrs;
  s.wet = leafWet ? s.wet + hrs : Math.max(0, s.wet - hrs * 0.5);
  return r;
}
export const phWater = (A) => A.drip + A.fog + A.pad;
export const phCostTotal = (A) => A.cost + phWater(A) * WATER_COST;

/** Sensor readings: four climate nodes (TH-1 at the pad end … TH-4 at the fan end), 12 bed probes, fertigation. */
export function phSense(s, a, t, f = {}) {
  const fan = a.fans > 0 && a.pad && !f.pad, off = fan ? [-1.6, -0.5, 0.6, 1.7] : [-0.3, 0.1, 0.25, 0];
  const T = off.map((o, i) => s.T + o + 0.15 * jit(t, i));
  if (f.drift) T[2] += 3 * clamp((t - f.drift) / 0.5, 0, 1);
  const RH = T.map((Ti, i) => clamp(rhOf(Ti - (f.drift && i === 2 ? 3 * clamp((t - f.drift) / 0.5, 0, 1) : 0), s.x) + 0.8 * jit(t, i + 7), 5, 100));
  return { T, RH, C: s.C + 8 * jit(t, 3), theta: s.theta.map((v, i) => v + 0.3 * jit(t, i + 20)), ec: s.ec + 0.03 * jit(t, 40), ph: s.ph };
}
export function fuse(m, exclude = {}) {
  const ok = m.T.map((_, i) => i).filter((i) => !exclude[i]);
  return { T: med(ok.map((i) => m.T[i])), RH: med(ok.map((i) => m.RH[i])), naiveT: mean(m.T), naiveRH: mean(m.RH) };
}

// ── rule-based controller (thresholds with hysteresis, timer irrigation) ──
export function phRules(m, w, crop, prev, h) {
  const day = w.G > 30, T = m.naiveT, RH = m.naiveRH, band = day ? crop.day : crop.night;
  const a = { vent: 0.1, shade: prev.shade, fans: 0, pad: false, fog: prev.fog, co2: false, drip: Array(PH.beds).fill(false) };
  const cool = prev.fans > 0 ? T > 27 : T > 30;
  if (cool) { a.fans = PH.fans; a.pad = true; a.vent = 0; }
  else a.vent = T > band[1] - 1 ? 1 : T > band[0] + 1 ? 0.5 : RH > 90 ? 0.4 : 0.1;
  if (w.G > 650 || T > 30) a.shade = 1; else if (w.G < 450 && T < 28) a.shade = 0;
  if (RH < 55 && T > 26) a.fog = 1; else if (RH > 72) a.fog = 0;
  const hm = h % 24, slot = [8, 10, 12, 14, 16].some((s) => hm >= s && hm < s + 1 / 6);
  a.drip.fill(slot);
  return a;
}

// ── AI controller: model-predictive control over a one-hour horizon ──
const CANDS = (() => {
  const c = [];
  for (const vent of [0, 0.2, 0.5, 1]) for (const shade of [0, 0.5, 1]) for (const fog of [0, 0.5, 1]) c.push({ vent, shade, fans: 0, pad: false, fog });
  for (const fans of [3, 6]) for (const shade of [0, 0.5, 1]) for (const fog of [0, 0.5]) c.push({ vent: 0, shade, fans, pad: true, fog });
  for (const shade of [0, 0.5, 1]) c.push({ vent: 0, shade, fans: 6, pad: false, fog: 0 });
  return c;
})();
function stepCost(r, s, w, crop, dth, val) {
  const band = w.G > 30 ? crop.day : crop.night;
  const dT = Math.max(0, s.T - band[1]) + Math.max(0, band[0] - s.T);
  const dV = Math.max(0, r.V - crop.vpd[1]) + Math.max(0, crop.vpd[0] - r.V);
  const parts = {
    heat: w.G > 30 ? 160 * dT * dT + 30 * dT : 20 * dT * dT + 8 * dT, vpd: (300 * dV * dV + 40 * dV + (r.V < crop.vpd[0] ? 400 * dV * dV + 160 * dV : 0)) * (w.G > 30 ? 1 : 0.4), wet: (r.rh > 92 ? 400 : r.rh > 88 ? 80 : 0) + (r.fogDrip > 0.01 ? 300 : 0),
    power: r.kw * TARIFF(w.h), water: (r.padL + r.fogL) * WATER_COST, growth: -val * PH.area * r.P,
  };
  let c = 0; for (const k in parts) { parts[k] *= dth; c += parts[k]; }
  return [c, parts];
}
export function phPlan(s, m, t, season, crop, prev, known = {}) {
  const val = P_VALUE(crop), base = { T: m.T, x: xOf(m.T, m.RH), C: s.C, theta: s.theta, radSum: s.radSum, ec: s.ec, ph: s.ph, acc: newAcc(), wet: 0 };
  const steps = 6, dt = 600, res = [];
  for (const c of CANDS) {
    const st = { ...base, theta: base.theta.slice(), radSum: base.radSum.slice(), acc: newAcc() }, a = { ...c, co2: false, drip: null };
    let cost = 4 * Math.abs(c.vent - prev.vent) + 4 * Math.abs(c.shade - prev.shade) + 3 * Math.abs(c.fog - prev.fog) + (c.fans !== prev.fans ? 8 : 0);
    const sum = { heat: 0, vpd: 0, wet: 0, power: 0, water: 0, growth: 0 }; let path = [];
    for (let k = 1; k <= steps; k++) {
      const w = weather(season, t + (k * dt) / 3600, (k * dt) / 3600);
      const r = phStep(st, a, w, crop, dt, known, t);   // the planner knows only the faults it has detected
      const [cc, p] = stepCost(r, st, w, crop, dt / 3600, val); cost += cc; for (const q in p) sum[q] += p[q];
      path.push({ T: st.T, V: r.V });
    }
    res.push({ a: c, cost, sum, path });
  }
  res.sort((p, q) => p.cost - q.cost);
  const best = res[0], why = [];
  const dims = [['fans', (c) => c.fans + (c.pad ? 'p' : '')], ['shade', (c) => c.shade], ['vent', (c) => c.vent], ['fog', (c) => c.fog]];
  for (const [k, key] of dims) {   // the best plan that changes this one thing and keeps the rest
    const same = (r) => dims.every(([k2, f2]) => k2 === k || f2(r.a) === f2(best.a));
    const alt = res.find((r) => key(r.a) !== key(best.a) && same(r)); if (!alt) continue;
    why.push({ k, alt: alt.a, gain: alt.cost - best.cost });
  }
  why.sort((p, q) => q.gain - p.gain);
  return { best, why, res };
}
export function phAI(s, m, t, season, crop, prev, mem, f = {}) {
  const w = weather(season, t);
  const plan = phPlan(s, m, t, season, crop, prev, f);
  const a = { ...plan.best.a, co2: false, drip: Array(PH.beds).fill(false) };
  // irrigation: per-bed valves on the bed probe and the light sum since its last pulse
  mem.drip = mem.drip || Array(PH.beds).fill(0);
  const mid = (crop.theta[0] + crop.theta[1]) / 2;
  for (let i = 0; i < PH.beds; i++) {
    if (mem.drip[i] > 0) { a.drip[i] = true; continue; }
    const th = m.theta[i];
    if (th < crop.theta[0] + 1 || (w.G > 30 && s.radSum[i] > 0.5 && th < mid)) { mem.drip[i] = 240; s.radSum[i] = 0; a.drip[i] = true; }
  }
  return { a, plan };
}

// ── anomaly detection ──
export function phWatch(mem, m, s, a, t, crop, f, ai) {
  const out = [], c = (mem.c = mem.c || {}), seen = (mem.seen = mem.seen || {});
  const hit = (k, cond, n = 3) => { c[k] = cond ? (c[k] || 0) + 1 : 0; return c[k] >= n; };
  const raise = (k, sev, node, msg, act) => { if (!seen[k]) { seen[k] = true; out.push({ k, t, sev, node, msg, act }); } };
  const clear = (k) => { if (seen[k]) { delete seen[k]; out.push({ k, t, sev: 'ok', resolved: true }); } };
  if (!ai) {   // plain threshold alarms
    const T = mean(m.T);
    if (T > 35) raise('hiT', 'crit', 'House', `High temperature alarm: ${T.toFixed(1)} °C.`, 'Alarm only');
    else if (T < 33) clear('hiT');
    if (m.ec > 3.6) raise('hiEC', 'crit', 'Fertigation', `Feed EC alarm: ${m.ec.toFixed(2)} mS/cm.`, 'Alarm only'); else if (m.ec < 3.2) clear('hiEC');
    const lo = m.theta.findIndex((v) => v < 22); if (lo >= 0) raise('dry', 'crit', `SM-${lo + 1}`, `Bed ${lo + 1} is dry: ${m.theta[lo].toFixed(0)}%.`, 'Alarm only'); else clear('dry');
    if (f.gateway) raise('gw', 'crit', 'Gateway', 'No data from the gateway.', 'Alarm only'); else clear('gw');
    return out;
  }
  const fan = a.fans > 0 && a.pad, off = fan ? [-1.6, -0.5, 0.6, 1.7] : [-0.3, 0.1, 0.25, 0];
  mem.exclude = mem.exclude || {};
  for (let i = 0; i < 4; i++) {
    const others = m.T.filter((_, j) => j !== i).map((v, j) => v - off[j >= i ? j + 1 : j]);
    const dev = m.T[i] - off[i] - med(others);
    if (hit(`drift${i}`, Math.abs(dev) > 1.5)) { mem.exclude[i] = true; raise(`drift${i}`, 'warn', `TH-${i + 1}`, `TH-${i + 1} reads ${dev > 0 ? '+' : ''}${dev.toFixed(1)} °C off the other three nodes. Likely drift or a fouled radiation shield.`, 'Excluded from control; calibration ticket raised'); }
    if (!f.drift && seen[`drift${i}`] && Math.abs(dev) < 0.6) { delete mem.exclude[i]; clear(`drift${i}`); }
  }
  mem.fanOn = fan ? (mem.fanOn || 0) + 1 : 0;
  if (fan && mem.fanOn > 3) {
    const w = weather(mem.season, t), exp = phRates(s, a, w, crop, {}).Teq, T = fuse(m, mem.exclude).T;
    if (hit('pad', T - exp > 2.5)) raise('pad', 'crit', 'Pad wall', `Fan-and-pad cooling is under-performing: ${T.toFixed(1)} °C measured, ${exp.toFixed(1)} °C expected. Pad pump or water supply suspected.`, 'Maintenance alert sent; shade screen closed');
  }
  if (!f.pad) clear('pad');
  // clogged emitters: a bed either dries faster than its neighbours or needs its valve open far longer to stay wet
  const mt = med(m.theta), open = (mem.open = mem.open || Array(m.theta.length).fill(0));
  for (let i = 0; i < open.length; i++) open[i] = open[i] * 0.995 + (a.drip?.[i] ? 5 : 0);
  const mo = med(open);
  m.theta.forEach((v, i) => {
    const dry = v < mt - 4.5, long = open[i] > 30 && open[i] > 2.2 * Math.max(mo, 5);
    if (hit(`clog${i}`, dry || long)) raise(`clog${i}`, 'warn', `SM-${i + 1}`, dry ? `Bed ${i + 1} is drying ${(mt - v).toFixed(0)} points faster than its neighbours after the same irrigation. Emitters likely clogged.` : `Bed ${i + 1} needs its valve open ${(open[i] / Math.max(mo, 1)).toFixed(1)}× as long as the median bed to hold the same moisture. Emitters likely clogged.`, 'Flush and acid-clean bed ' + (i + 1));
    if (!f.clog && !dry && open[i] < 1.5 * Math.max(mo, 5)) clear(`clog${i}`);
  });
  if (hit('ec', m.ec > crop.ec + 0.6, 2)) raise('ec', 'crit', 'Fertigation', `Feed EC ${m.ec.toFixed(2)} mS/cm against a ${crop.ec.toFixed(1)} target. Dosing pump B is not following its command.`, 'Dosing paused; clear-water flush');
  if (!f.ec && m.ec < crop.ec + 0.3) clear('ec');
  if (f.gateway) raise('gw', 'warn', 'Gateway', 'Gateway uplink lost. The cloud model cannot reach the site.', 'Edge controller running local rules'); else clear('gw');
  return out;
}

// ════════════════════════ VERTICAL FARM ════════════════════════
const ROOM_V = 14 * 20 * 4.5, ROOM_M = ROOM_V * 1.2;
export function vfInit(crop) {
  const N = VF.racks * VF.tiers, tiers = [];
  for (let i = 0; i < N; i++) {
    const order = (i * 7) % N, age = (order / N) * crop.days;   // staggered planting: one tier harvested every day or so
    tiers.push({ age, fw: growTo(crop, age), health: 1, tip: 0 });
  }
  return { T: 22, x: xOf(22, 68), C: 900, ec: crop.ec, ecRead: crop.ec, ph: 6.0, wT: 20, tiers, acc: newVAcc(), harvests: [], harvested: 0 };
}
const newVAcc = () => ({ kwh: 0, led: 0, hvac: 0, other: 0, cost: 0, co2: 0, water: 0, recov: 0, growth: 0, inT: 0, inRH: 0, n: 0, kg: 0 });
const kDay = (crop) => Math.log((crop.g / 5 - 1) / 0.0526) / crop.days;
function growTo(crop, age) { const k = kDay(crop), g = crop.g * 1.05; return g / (1 + (g / 5 - 1) * Math.exp(-k * age)); }
export const cop = (Tout) => clamp(4.6 - 0.06 * (Tout - 15), 2.2, 4.6);

export function vfRates(s, a, w, crop, f = {}) {
  const lit = a.light * a.dim, ppfd = crop.ppfd * lit, tiersLit = VF.racks * VF.tiers - (f.led ? 1 : 0);
  const Qled = (ppfd * VF.area * (tiersLit / (VF.racks * VF.tiers))) / VF.efficacy / 1000;
  const rh = rhOf(s.T, s.x), V = vpdOf(s.T, rh);
  const E = 0.42 * Qled * (3600 / 2450) * clamp(0.6 + V, 0.6, 1.4) + 1.5;   // kg/h
  const fans = VF.fansKW + (a.rackFans ? 1.2 : 0) - (f.airflow ? 0.3 : 0), pumps = f.pump && !f.pumpFixed ? VF.pumpKW * 0.75 : VF.pumpKW;
  const dehumKW = a.dehum ? VF.dehumKW : 0;
  const sens = Qled * 0.58 + fans + pumps + dehumKW + 0.4 * (w.T - s.T);
  const Q = f.hvac ? 0 : clamp(sens + 6 * (s.T - a.set), 0, VF.hvacKW);
  const c = cop(w.T), Wc = (Q * 0.25) / 0.68, Wd = a.dehum ? 22 : 0, leak = (0.3 * ROOM_M * (s.x - w.x)) / 1000;
  const fC = ((s.C / (s.C + 350)) / (1000 / 1350)), fT = Math.exp(-(((s.T - (crop.temp[0] + crop.temp[1]) / 2) / 7) ** 2));
  const P = 2.4 * (1 - Math.exp(-ppfd / 350)) * ((1.875 * s.C) / (s.C + 350));
  const U = P * VF.area, R = 0.2 * VF.area;
  const dose = a.co2 && s.C < a.co2 ? Math.min(2500, (a.co2 - s.C) * 12 + U) : 0, Lk = 0.3 * ROOM_V * (s.C - w.co2) * 0.0018;
  const kw = Qled + Q / c + fans + pumps + dehumKW + 1.5;
  return { Qled, Q, E, Wc, Wd, leak, sens, U, R, dose, Lk, fC, fT, ppfd, kw, cop: c, rh, V, hvacKW: Q / c, other: fans + pumps + dehumKW + 1.5 };
}
export function vfStep(s, a, w, crop, dt, f = {}, t = 0) {
  const r = vfRates(s, a, w, crop, f), hrs = dt / 3600;
  s.T += ((r.sens - r.Q) * dt) / 20000;
  s.x += ((r.E - r.Wc - r.Wd - r.leak) * 1000 * hrs) / (ROOM_M * 4); s.x = Math.max(4, Math.min(s.x, xOf(s.T, 99)));
  s.C = Math.max(250, s.C + ((r.dose - r.U - r.Lk + (r.ppfd < 1 ? r.R : 0)) * hrs) / (ROOM_V * 0.0018));
  // nutrients: water uptake concentrates the solution; the doser holds the probe reading
  s.ec += 0.05 * hrs * (r.ppfd > 0 ? 1 : 0.2);
  s.ecRead = s.ec - (f.ec && !f.ecFixed ? clamp((t - f.ec) * 0.6, 0, 0.9) : 0);
  if (s.ecRead < crop.ec) s.ec += Math.min(crop.ec - s.ecRead, 0.6 * hrs * 6);
  else s.ec -= Math.min(s.ecRead - crop.ec, 0.3 * hrs * 6) * (f.ec && !f.ecFixed ? 0 : 1);
  s.ph = crop.ph + 0.06 * Math.sin(t * 0.9);
  // growth per tier
  const k = kDay(crop), g = crop.g * 1.05, lf = (1 - Math.exp(-r.ppfd / 300)) / (1 - Math.exp(-crop.ppfd / 300));
  const days = dt / 86400, perLit = 24 / crop.photo;
  let grown = 0;
  s.tiers.forEach((ti, i) => {
    const rack = Math.floor(i / VF.tiers), tier = i % VF.tiers;
    let light = lf; if (f.led && rack === 3 && tier === 2) light = 0;
    const eff = light * perLit * r.fC * r.fT * ti.health;
    const d = k * eff * ti.fw * (1 - ti.fw / g) * days; ti.fw += d; grown += d;
    ti.age += days;
    if (f.pump && !f.pumpFixed && rack === 1 && t - f.pump > 0.33) ti.health = Math.max(0.15, ti.health - 0.25 * hrs);
    if (f.airflow && rack === 2 && ti.fw > 30) ti.tip = Math.min(1, ti.tip + (d / days > 2 ? 0.5 : 0.15) * hrs);
  });
  // accounting
  const A = s.acc, tar = TARIFF(w.h);
  A.kwh += r.kw * hrs; A.led += r.Qled * hrs; A.hvac += r.hvacKW * hrs; A.other += r.other * hrs; A.cost += r.kw * hrs * tar + (r.dose * hrs / 1000) * 15;
  A.co2 += (r.dose * hrs) / 1000; A.water += r.E * hrs; A.recov += (r.Wc + r.Wd) * hrs; A.growth += grown * VF.channels * VF.holes / 1000; A.n += dt;
  if (s.T >= crop.temp[0] - 1 && s.T <= crop.temp[1] + 1) A.inT += dt;
  if (r.rh >= crop.rh[0] && r.rh <= crop.rh[1]) A.inRH += dt;
  return r;
}
/** Tiers at harvest weight are cut and replanted. Returns the indices harvested. */
export function vfHarvest(s, crop) {
  const out = [];
  s.tiers.forEach((ti, i) => {
    if (ti.fw >= crop.g || ti.age > crop.days + 6) {
      const kg = (ti.fw * ti.health * (1 - 0.5 * ti.tip) * VF.channels * VF.holes) / 1000;
      s.harvested += kg; s.acc.kg += kg; out.push({ i, kg, tip: ti.tip }); Object.assign(ti, { age: 0, fw: 5, health: 1, tip: 0 });
    }
  });
  return out;
}
export const vfDLI = (crop, dim = 1) => (crop.ppfd * dim * crop.photo * 3600) / 1e6;

// ── controllers ──
export function vfRules(m, w, crop, h) {
  const hm = h % 24, light = hm >= 6 && hm < 6 + crop.photo ? 1 : 0;
  return { light, dim: 1, set: (crop.temp[0] + crop.temp[1]) / 2, co2: light ? crop.co2 : 0, dehum: m.RH > crop.rh[1], rackFans: true, start: 6 };
}
/** AI: pick the photoperiod window that costs least (tariff and outdoor-temperature COP), DLI-matched dimming, night set-back. */
export function vfWindowCost(season, crop, st, day = 0) {
  let c = 0;
  for (let k = 0; k < 24; k++) {
    const h = (st + k) % 24, on = k < crop.photo, w = weather(season, day * 24 + h);
    const led = on ? (crop.ppfd * VF.area) / VF.efficacy / 1000 : 0, hv = (led * 0.58 + 5 + 0.4 * (w.T - 22)) / cop(w.T);
    c += TARIFF(h) * (led + Math.max(0, hv));
  }
  return c;
}
export function vfBestWindow(season, crop, day = 0) {
  let best = null;
  for (let st = 0; st < 24; st++) { const c = vfWindowCost(season, crop, st, day); if (!best || c < best.c) best = { st, c }; }
  return best;
}
export function vfAI(m, w, crop, h, mem) {
  const hm = h % 24, st = mem.start ?? 6, k = (hm - st + 24) % 24, light = k < crop.photo ? 1 : 0;
  const co2On = light && m.C < crop.co2 + 50;
  const dim = mem.dim ?? 1;
  const mid = (crop.temp[0] + crop.temp[1]) / 2;
  return { light, dim, set: light ? mid : crop.temp[0] - 0.5, co2: co2On ? crop.co2 : 0, dehum: m.RH > crop.rh[1] - 3, rackFans: true, start: st };
}
export function vfWatch(mem, s, r, a, t, crop, f, ai) {
  const out = [], c = (mem.c = mem.c || {}), seen = (mem.seen = mem.seen || {});
  const hit = (k, cond, n = 3) => { c[k] = cond ? (c[k] || 0) + 1 : 0; return c[k] >= n; };
  const raise = (k, sev, node, msg, act) => { if (!seen[k]) { seen[k] = true; out.push({ k, t, sev, node, msg, act }); } };
  const clear = (k) => { if (seen[k]) { delete seen[k]; out.push({ k, t, sev: 'ok', resolved: true }); } };
  mem.lastT = mem.lastT ?? s.T; const rate = (s.T - mem.lastT) * 12; mem.lastT = s.T;   // K/h from 5-minute samples
  if (!ai) {
    if (s.T > crop.temp[1] + 5) raise('hiT', 'crit', 'Room', `High temperature alarm: ${s.T.toFixed(1)} °C.`, 'Alarm only'); else if (s.T < crop.temp[1] + 3) clear('hiT');
    if (f.pump && t - f.pump > 1.5) raise('dry', 'crit', 'Rack 2', 'Rack 2 plants wilting (operator report).', 'Alarm only'); else if (!f.pump) clear('dry');
    return out;
  }
  if (hit('hvac', a.set < s.T - 0.8 && rate > 1.5, 2)) { raise('hvac', 'crit', 'HVAC', `Room warming ${rate.toFixed(1)} K/h with full cooling demand. Compressor trip suspected.`, 'LEDs dimmed to 40% to cut heat; technician called'); mem.dim = 0.4; }
  if (!f.hvac && seen.hvac) { clear('hvac'); mem.dim = undefined; }
  if (f.pump && !f.pumpFixed && t - f.pump > 0.08) { raise('pump', 'crit', 'FLOW-2', 'Rack 2 return flow fell to 0 L/min. NFT pump failure.', 'Switched to standby pump'); f.pumpFixed = true; }
  if (!f.pump && seen.pump) clear('pump');
  if (f.airflow && t - f.airflow > 0.1) raise('air', 'warn', 'RK-3', 'Air speed over rack 3 is 0.05 m/s (normal 0.4). Tipburn risk rises as heads bulk up.', 'Rack fan replacement scheduled');
  if (!f.airflow) clear('air');
  if (f.led && t - f.led > 0.05 && a.light) raise('led', 'warn', 'LED-4.3', 'Rack 4 tier 3 PAR reads 0 while lit; its LED driver has failed.', 'Driver swap ticket raised');
  if (!f.led) clear('led');
  if (f.ec && !f.ecFixed && t - f.ec > 0.4) { raise('ec', 'warn', 'NUT', `EC probe disagrees with the dosing balance by ${(s.ec - s.ecRead).toFixed(2)} mS/cm. Probe drift.`, 'Recalibrated against the reference probe'); f.ecFixed = true; }
  if (!f.ec) clear('ec');
  return out;
}

// ════════════════════════ 24-hour comparison ════════════════════════
export function runDay(fac, mode, season, crop, startH = 0) {
  if (fac === 'ph') {
    const s = phInit(crop), mem = {}; let a = { vent: 0.2, shade: 0, fans: 0, pad: false, fog: 0, co2: false, drip: Array(PH.beds).fill(false) };
    // warm up 6 h so the start state is not artificial
    for (let k = -360; k < 1440; k++) {
      const t = startH + k / 60, w = weather(season, t), m = phSense(s, a, t), fz = fuse(m);
      if (k % 10 === 0) {
        if (mode === 'ai') a = phAI(s, { ...m, T: fz.T, RH: fz.RH }, t, season, crop, a, mem).a;
        else a = phRules({ ...m, ...fz }, w, crop, a, t);
      } else if (mode === 'ai') { for (let i = 0; i < PH.beds; i++) { if (mem.drip[i] > 0) mem.drip[i] -= 60; a.drip[i] = mem.drip[i] > 0; } }
      else a = { ...a, drip: phRules({ ...m, ...fz }, w, crop, a, t).drip };
      if (k === 0) s.acc = newAcc();
      phStep(s, a, w, crop, 60, {}, t);
    }
    const A = s.acc;
    const value = A.P * P_VALUE(crop) * PH.area, cost = phCostTotal(A);
    return { inT: A.inT / A.n, inV: A.inV / A.n, water: phWater(A), drip: A.drip, cool: A.pad + A.fog, kwh: A.kwh, cost, P: A.P / A.Ppot, wetH: A.wetH, hot: A.hot / 3600, value, net: value - cost };
  }
  const s = vfInit(crop), mem = {};
  if (mode === 'ai') mem.start = vfBestWindow(season, crop).st;
  for (let k = 0; k < 1440; k++) {
    const t = startH + k / 60, w = weather(season, t), m = { RH: rhOf(s.T, s.x), C: s.C };
    const a = mode === 'ai' ? vfAI(m, w, crop, t, mem) : vfRules(m, w, crop, t);
    vfStep(s, a, w, crop, 60, {}, t);
  }
  const A = s.acc;
  return { inT: A.inT / A.n, inRH: A.inRH / A.n, kwh: A.kwh, cost: A.cost, growth: A.growth, kwhkg: A.kwh / Math.max(0.1, A.growth), co2: A.co2, water: A.water - A.recov };
}
