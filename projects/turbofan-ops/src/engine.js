/**
 * Generic two-spool, high-bypass turbofan (≈ 130 kN / 29,000 lbf class, like the engines on
 * current narrow-body airliners). Illustrative numbers, not any certified engine.
 *
 * The model has three layers:
 *  1. spool dynamics: N2 (core) accelerates when fuel flow exceeds what the core needs at its
 *     current speed, plus air-starter torque during a start; N1 (fan) follows N2 with a lag
 *  2. FADEC: thrust lever → N1 target, fuel schedule with acceleration / deceleration limits,
 *     the automatic start sequence and protections
 *  3. a quasi-steady Brayton cycle: station temperatures, pressures, airflow and thrust from
 *     the current spool speeds, fuel flow and flight condition
 */

export const LIMITS = { N1: 104, N2: 105, EGT: 1060, EGT_START: 725, OILP_LO: 13, VIB: 6 };
export const DESIGN = { W: 395, LHV: 43.1e6, N1RPM: 4380, N2RPM: 16645, BPR: 10.5 };

// ── atmosphere ──
export function isa(alt, dT = 0) {
  const h = Math.max(0, alt);
  const Tstd = h < 11000 ? 288.15 - 0.0065 * h : 216.65;
  const P = h < 11000 ? 101325 * Math.pow(Tstd / 288.15, 5.2559) : 22632 * Math.exp(-(h - 11000) / 6341.6);
  const T = Tstd + dT;
  return { T, P, rho: P / (287.05 * T), a: Math.sqrt(1.4 * 287.05 * T) };
}

const CP_A = 1005, CP_G = 1150, GA = 1.4, GG = 1.333;
const comp = (Tin, pr, eta) => Tin * (1 + (Math.pow(pr, (GA - 1) / GA) - 1) / eta);
const turbPR = (Tin, Tout, eta) => Math.pow(Math.max(0.05, 1 - (1 - Tout / Tin) / eta), GG / (GG - 1));
const jet = (T, Pt, P0, cp, g) => { const pr = Math.max(1, Pt / P0); return Math.sqrt(Math.max(0, 2 * cp * T * (1 - Math.pow(1 / pr, (g - 1) / g)))); };

/** Steady fuel flow (kg/s, corrected) needed to hold a corrected core speed n2c (%). */
export function ffSteadyC(n2c) {
  if (n2c >= 58) return 0.085 + 0.96 * Math.pow((n2c - 58) / 42, 2.3);
  return 0.085 * Math.pow(Math.max(0, n2c) / 58, 1.6);
}
/** Fan speed the core settles to at a corrected core speed. */
export function n1Steady(n2c) {
  if (n2c >= 58) return 19.5 + 80.5 * Math.pow((n2c - 58) / 42, 1.55);
  return 19.5 * Math.pow(Math.max(0, n2c) / 58, 2.2);
}
function n2ForN1(n1c) { if (n1c <= 19.5) return 58 * Math.pow(Math.max(0, n1c) / 19.5, 1 / 2.2); return 58 + 42 * Math.pow((n1c - 19.5) / 80.5, 1 / 1.55); }

/** Quasi-steady cycle from spool speeds, fuel flow and flight condition. */
export function cycle(st) {
  const A = isa(st.alt, st.dT), M = st.mach, V0 = M * A.a;
  const T2 = A.T * (1 + 0.2 * M * M), P2 = A.P * Math.pow(1 + 0.2 * M * M, 3.5) * 0.995;
  const th = T2 / 288.15, de = P2 / 101325;
  const n1c = st.N1 / Math.sqrt(th), n2c = st.N2 / Math.sqrt(th);
  const n1 = Math.max(0, n1c / 100);
  // airflow: a windmilling / motoring fan still pumps a little air
  // the core's airflow follows the core spool, the bypass airflow follows the fan
  const n2f = Math.max(0, n2c / 100), ram = de / Math.sqrt(th) * (1 + 0.12 * M);
  const Wc = Math.max(0.05, (n2f >= 0.58 ? 38.5 * Math.pow(n2f, 3) : 7.51 * Math.pow(n2f / 0.58, 1.5)) * ram);
  const Wb = Math.max(0.2, 352 * Math.pow(n1, 1.25) * ram);
  const W = Wb + Wc, bpr = Wb / Wc;
  const prFan = 1 + 0.6 * Math.pow(n1, 2.2), prFanRoot = 1 + 0.38 * Math.pow(n1, 2), prBoost = 1 + 0.8 * Math.pow(n1, 2);
  const n2 = n2f, prHPC = 1 + 16.5 * Math.pow(n2, 4.2);
  const T13 = comp(T2, prFan, 0.91), P13 = P2 * prFan;
  const T25 = comp(comp(T2, prFanRoot, 0.9), prBoost, 0.89), P25 = P2 * prFanRoot * prBoost;
  const T3 = comp(T25, prHPC, 0.87), P3 = P25 * prHPC;
  const burning = st.lit && st.FF > 0;
  const f = burning ? st.FF / Math.max(0.5, Wc) : 0;
  const T4 = burning ? T3 + (f * DESIGN.LHV * 0.99) / (CP_G * (1 + f)) : T3;
  const P4 = P3 * 0.955;
  const hpcWork = Wc * CP_A * (T3 - T25);
  const T45 = Math.max(T2, T4 - hpcWork / (Wc * (1 + f) * CP_G));
  const lpWork = Wb * CP_A * (T13 - T2) + Wc * CP_A * (T25 - T2);
  const T5 = Math.max(T2, T45 - lpWork / (Wc * (1 + f) * CP_G));
  const P45 = P4 * turbPR(T4, T45, 0.9), P5 = Math.max(A.P * 1.001, P45 * turbPR(T45, T5, 0.91));
  const EGT = T45 - 0.45 * (T45 - T5);   // measured between LPT stages, °K
  const V19 = jet(T13, P13 * 0.985, A.P, CP_A, GA), V9 = jet(T5, P5, A.P, CP_G, GG);
  // with the reverser deployed the translating sleeve blocks the bypass duct and the cascades turn the fan air forwards
  const rv = st.revPos || 0, Fb = Wb * (V19 * (1 - 1.5 * rv) - V0), Fc = Wc * ((1 + f) * V9 - V0);
  return { T0: A.T, P0: A.P, V0, T2, P2, T13, P13, T25, P25, T3, P3, T4, P4, T45, P45, T5, P5, EGT, W, Wb, Wc, bpr, f, V19, V9, Fb, Fc, F: Fb + Fc, opr: P3 / P2, n1c, n2c, th, de };
}

export const PHASES = {
  ground: { name: 'Ground', alt: 0, mach: 0, wow: true },
  takeoff: { name: 'Take-off roll', alt: 0, mach: 0.2, wow: true },
  climb: { name: 'Climb FL150', alt: 4570, mach: 0.6, wow: false },
  cruise: { name: 'Cruise FL350', alt: 10670, mach: 0.78, wow: false },
  descent: { name: 'Descent FL200', alt: 6100, mach: 0.7, wow: false },
  landing: { name: 'Landing roll', alt: 0, mach: 0.18, wow: true },
};
export const FAULTS = {
  none: { name: 'No fault' },
  hotstart: { name: 'Hot start', desc: 'Fuel metering valve over-fuels during the start: EGT climbs past the 725 °C start limit.' },
  hung: { name: 'Hung start', desc: 'Weak starter air: N2 stops accelerating below idle and EGT creeps up.' },
  nolight: { name: 'No light-off (igniter A failed)', desc: 'Igniter A is dead: no light-off on the first attempt; the FADEC re-tries with both igniters.' },
  stall: { name: 'Compressor stall', desc: 'HPC stall on a rapid throttle advance: bang, EGT spike, N1/N2 fluctuation.' },
  bird: { name: 'Bird strike', desc: 'A large bird hits the fan at take-off: damaged blade, high N1 vibration, a stall.' },
  fire: { name: 'Engine fire', desc: 'A fuel leak ignites in the core compartment: fire warning.' },
  oil: { name: 'Oil leak', desc: 'Oil quantity drains; pressure falls below the red line; bearings eventually seize.' },
  flameout: { name: 'Flameout (heavy rain)', desc: 'Heavy rain ingestion at low power puts the flame out; the engine can be relit.' },
};

export class Engine {
  constructor() { this.reset(); }
  reset(phase = 'ground') {
    Object.assign(this, {
      t: 0, N1: 0, N2: 0, FF: 0, FFcmd: 0, lit: false, EGTc: 15, oilT: 20, oilQty: 18, oilP: 0, vib1: 0, vib2: 0,
      master: false, mode: 'norm', apuBleed: false, starterValve: false, ignA: false, ignB: false, contIgn: false,
      tla: 0, rev: 0, revPos: 0, fireHandle: false, agent1: false, agent2: false, fire: false, fireOut: false,
      startPhase: 'off', startT: 0, lightT: 0, attempts: 0, abort: '', fault: 'none', faultActive: false,
      stall: 0, stallT: 0, bladeDamage: 0, seized: false, msgs: [], log: [], dT: 0, autoStart: true, maxEGTstart: 0,
      fuelValve: false, hist: [], histT: 0, stallCount: 0, relightT: 0, seizeT: 0,
    });
    this.setPhase(phase);
    this.c = cycle(this);
  }
  setPhase(p) { const P = PHASES[p]; this.phase = p; this.alt = P.alt; this.mach = P.mach; this.wow = P.wow; if (!this.wow) this.rev = 0; }
  /** Windmilling: in flight the ram air keeps the spools turning even with no fuel. */
  windmill() { if (this.wow) return { n1: 0, n2: 0 }; return { n1: 4 + 38 * this.mach, n2: 6 + 22 * this.mach }; }
  /** Rated N1 for a thrust lever position (0..1 forward; reverse handled separately). */
  n1Target() {
    const A = isa(this.alt, this.dT), th = (A.T * (1 + 0.2 * this.mach ** 2)) / 288.15;
    const idle = this.wow ? 19.5 : 24 + 6 * Math.min(1, this.alt / 10000);
    // flat-rated TOGA: constant corrected N1 up to ISA+15, then limited by EGT margin
    const flat = this.dT > 15 ? 1 - (this.dT - 15) * 0.004 : 1;
    const toga = Math.min(LIMITS.N1 - 4, 97.5 * Math.sqrt(th) * flat * (this.alt > 3000 ? 0.985 : 1));
    if (this.revPos > 0.05) return idle + (Math.min(toga, 78) - idle) * this.rev * Math.min(1, this.revPos);
    return idle + (toga - idle) * Math.pow(this.tla, 1.15);
  }
  // ── pilot actions ──
  action(a, v) {
    const L = (m) => this.log.push({ t: this.t, m });
    switch (a) {
      case 'apu': this.apuBleed = v; L(`APU bleed ${v ? 'ON' : 'OFF'}`); break;
      case 'mode': this.mode = v; L(`Engine mode ${v === 'start' ? 'IGN/START' : v === 'crank' ? 'CRANK' : 'NORM'}`); if (v === 'norm' && this.startPhase !== 'run') this.abortStart('mode set to NORM', true); break;
      case 'master': this.master = v; L(`Engine master ${v ? 'ON' : 'OFF'}`); if (!v) { this.fuelValve = false; this.lit && L('Fuel cut off — the engine runs down'); this.lit = false; if (this.startPhase !== 'off' && this.startPhase !== 'run') this.startPhase = 'cool'; } break;
      case 'tla': this.tla = Math.max(0, Math.min(1, v)); if (this.tla > 0.05 && this.revPos > 0) this.rev = 0; break;
      case 'rev': if (this.wow && this.tla < 0.05) { this.rev = Math.max(0, Math.min(1, v)); } break;
      case 'fireHandle': this.fireHandle = true; this.master = false; this.fuelValve = false; this.lit = false; L('Fire handle pulled: fuel and bleed valves closed, agents armed'); break;
      case 'agent1': case 'agent2': if (!this.fireHandle || this[a]) break; this[a] = true; L(`Agent ${a.slice(-1)} discharged`); if (this.fire && (a === 'agent2' || Math.random() < 0.8)) { this.fireOutT = this.t + 6; } break;
      case 'fault': this.fault = v; this.faultActive = v !== 'none'; this.faultT = this.t; L(`Fault injected: ${FAULTS[v].name}`);
        if (v === 'bird') { this.bladeDamage = 1; this.triggerStall(1.4); }
        if (v === 'fire') { this.fire = true; }
        if (v === 'flameout' && this.lit) { this.flameout('heavy rain'); }
        if (v === 'stall' && this.lit) this.triggerStall(1);
        break;
      case 'contIgn': this.contIgn = v; break;
    }
  }
  abortStart(why, quiet) {
    if (this.startPhase === 'off' || this.startPhase === 'run') return;
    this.fuelValve = false; this.lit = false; this.ignA = this.ignB = false;
    this.abort = why; this.startPhase = 'cool'; this.startT = this.t;
    if (!quiet) this.log.push({ t: this.t, m: `START ABORTED: ${why}${this.autoStart ? ' — dry cranking to clear fuel and cool the engine' : ''}` });
  }
  flameout(why) { this.lit = false; this.log.push({ t: this.t, m: `FLAMEOUT (${why})` }); this.flameoutT = this.t; }
  triggerStall(sev = 1) { this.stall = Math.max(this.stall, sev); this.stallT = this.t; this.stallCount++; this.log.push({ t: this.t, m: 'COMPRESSOR STALL — loud bang, EGT spike' }); this.bang = (this.bang || 0) + 1; }

  // ── simulation step ──
  step(dt) {
    this.t += dt;
    const c0 = this.c, th = c0.th, sq = Math.sqrt(th), de = c0.de;
    // —— start sequence (FADEC auto start) ——
    const airForStarter = this.apuBleed && !this.fireHandle;
    if (this.mode === 'start' && this.master && this.startPhase === 'off' && this.N2 < 50) { this.startPhase = 'motor'; this.startT = this.t; this.attempts++; this.maxEGTstart = 0; this.abort = ''; this.log.push({ t: this.t, m: 'Start: starter valve open, N2 accelerating' }); }
    if (this.mode === 'crank' && !this.master && this.startPhase === 'off' && this.N2 < 40) { this.startPhase = 'crank'; this.startT = this.t; this.log.push({ t: this.t, m: 'Dry crank (no fuel, no ignition)' }); }
    if (this.mode === 'crank' && this.startPhase === 'crank' && this.master) this.startPhase = 'off';
    if (this.startPhase === 'crank' && this.mode !== 'crank') this.startPhase = 'off';
    this.starterValve = (this.startPhase === 'motor' || this.startPhase === 'light' || this.startPhase === 'accel' || this.startPhase === 'crank' || (this.startPhase === 'cool' && this.autoStart && this.t - this.startT < 30)) && airForStarter && this.N2 < 52;
    if (this.startPhase === 'motor') {
      if (this.N2 > 16 && !this.ignA) { this.ignA = true; this.ignB = this.attempts > 1; this.log.push({ t: this.t, m: `Igniter${this.ignB ? 's A+B' : ' A'} on` }); }
      if (this.N2 > 22 && !this.fuelValve) { this.fuelValve = true; this.startPhase = 'light'; this.lightT = this.t; this.log.push({ t: this.t, m: 'Fuel on (HP valve open) — waiting for light-off' }); }
      if (this.t - this.startT > 40 && this.N2 < 22) this.abortStart('N2 not reaching 22% for fuel-on (starter air?)');
    }
    if (this.startPhase === 'light') {
      const ignOK = (this.ignA && !(this.fault === 'nolight' && this.attempts === 1)) || this.ignB;
      if (!this.lit && ignOK && this.t - this.lightT > 2.2) { this.lit = true; this.log.push({ t: this.t, m: 'Light-off: EGT rising' }); this.startPhase = 'accel'; }
      if (!this.lit && this.t - this.lightT > 15) this.abortStart('no light-off within 15 s');
    }
    if (this.startPhase === 'accel') {
      if (this.N2 > 50 && this.starterValve === false && !this.cutout) { this.cutout = true; }
      if (this.N2 > 50 && !this.cutoutLogged) { this.cutoutLogged = true; this.log.push({ t: this.t, m: 'Starter cut-out at 50% N2, igniters off' }); this.ignA = this.ignB = false; }
      if (this.N2 > 57.5 && this.EGTc < this.maxEGTstart - 30) { this.startPhase = 'run'; this.cutoutLogged = false; this.log.push({ t: this.t, m: `Engine stable at idle (start took ${Math.round(this.t - this.startT)} s, peak EGT ${Math.round(this.maxEGTstart)} °C)` }); }
      if (this.EGTc > LIMITS.EGT_START && this.autoStart) this.abortStart(`EGT ${Math.round(this.EGTc)} °C over the ${LIMITS.EGT_START} °C start limit (hot start)`);
      if (this.t - this.startT > 60 && this.N2 < 55) this.abortStart('N2 stagnating below idle (hung start)');
    }
    if (this.startPhase === 'cool' && (this.t - this.startT > 32 || !airForStarter)) { this.startPhase = 'off'; }
    if (this.startPhase === 'run' && !this.lit && !this.flameoutT) this.startPhase = 'off';
    // ignition in flight / continuous ignition for relight
    if (this.lit === false && this.master && this.fuelValve && (this.contIgn || this.mode === 'start') && this.startPhase !== 'light' && this.startPhase !== 'cool' && this.N2 > 12 && this.fault !== 'flameout_hold') {
      if (!this.relightT) this.relightT = this.t;
      if (this.t - this.relightT > 4 && !this.wow) { this.lit = true; this.relightT = 0; this.flameoutT = 0; this.startPhase = 'run'; this.log.push({ t: this.t, m: 'Relight: the flame is back' }); if (this.fault === 'flameout') { this.fault = 'none'; this.faultActive = false; } }
    }
    if (this.startPhase === 'run' || this.lit) { if (this.master && !this.fireHandle) this.fuelValve = true; }

    // —— FADEC fuel control ——
    const n2c = this.N2 / sq;
    const ffss = ffSteadyC(n2c) * de * sq;          // fuel the core needs to hold its speed
    let ffcmd = 0;
    if (this.fuelValve && this.master && !this.fireHandle) {
      if (this.startPhase === 'light' || this.startPhase === 'accel') {
        // start schedule: a little more than steady, more for a hot start, less if starter is weak
        ffcmd = (Math.max(0.03, ffSteadyC(n2c) * 1.28 + 0.008) * de * sq) * (this.fault === 'hotstart' && this.attempts === 1 ? 2.4 : 1);
        if (!this.lit) ffcmd = 0.02;
      } else {
        const n1t = this.n1Target(), n2t = n2ForN1(n1t / sq) * sq;
        const fft = ffSteadyC(n2t / sq) * de * sq;
        ffcmd = fft + 0.02 * (n2t - this.N2) * de * sq;
        ffcmd = Math.min(ffcmd, ffss * 1.5 + 0.02, ffss + 0.45 * de);     // acceleration schedule (surge margin)
        ffcmd = Math.max(ffcmd, ffss * 0.55);                              // deceleration schedule (lean blow-out margin)
        if (this.EGTc > LIMITS.EGT - 10) ffcmd *= 0.97;                   // EGT limiter
        if (this.N2 > LIMITS.N2 - 1 || this.N1 > LIMITS.N1 - 1) ffcmd = Math.min(ffcmd, ffss);
        if (this.stall > 0.3) ffcmd = Math.min(ffcmd, ffss * 0.75);        // stall recovery: cut fuel
      }
    }
    this.FFcmd = ffcmd;
    this.FF += (ffcmd - this.FF) * Math.min(1, dt / 0.25);
    if (!this.fuelValve) this.FF = Math.max(0, this.FF - dt * 2);
    // —— spool dynamics ——
    const wm = this.windmill();
    let dN2 = 0;
    const starter = this.starterValve ? (this.fault === 'hung' && this.N2 > 30 ? 1.2 : 3.6) * Math.max(0, 1 - this.N2 / 58) : 0;
    const drag = 0.065 * Math.max(0, this.N2 - wm.n2) + (this.seized ? 25 : 0);
    if (this.lit && this.FF > 0) {
      const r = this.FF / Math.max(0.004, ffss);
      dN2 = (this.N2 < 58 ? 6 : 24) * (r - 1) * Math.max(0.3, this.N2 / 100) + starter * 0.8;
      if (this.N2 < 58) dN2 = Math.max(dN2, starter * 0.6 + 0.4 * (r - 1)) ;
      // lean blow-out
      if (r < 0.42 && this.N2 > 30) this.flameout('lean blow-out');
    } else dN2 = starter - drag;
    if (this.fault === 'hung' && this.attempts === 1 && this.N2 > 38 && this.N2 < 50 && this.lit) dN2 = Math.min(dN2, 0.02);
    if (this.stall > 0) { dN2 -= 6 * this.stall; this.stall = Math.max(0, this.stall - dt * (this.fault === 'stall' ? 0.25 : 0.5)); }
    this.N2 = Math.max(0, Math.min(108, this.N2 + dN2 * dt));
    if (this.seized) this.N2 = Math.max(0, this.N2 - 30 * dt);
    const n1t = this.lit ? n1Steady(this.N2 / sq) * sq : Math.max(wm.n1, n1Steady(this.N2 / sq) * sq * 0.85);
    const tau = this.lit ? 1.4 : 3.5;
    this.N1 += (n1t - this.N1) * Math.min(1, dt / tau);
    if (this.stall > 0.2) this.N1 -= this.stall * 3 * dt;
    if (this.seized) this.N1 = Math.max(wm.n1 * 0.2, this.N1 - 8 * dt);
    // stall triggers: big fast throttle slam with damaged fan, or the injected fault
    if (this.fault === 'stall' && this.lit && this.tla > 0.6 && this.N2 > 75 && this.stallCount < 3 && this.t - this.stallT > 6) this.triggerStall(1);
    // —— cycle, temperatures, oil, vibration ——
    this.c = cycle(this);
    const egtTarget = this.lit ? this.c.EGT - 273.15 + (this.stall > 0 ? 160 * this.stall : 0) : Math.max(isa(this.alt, this.dT).T - 273.15, this.EGTc - 0);
    const tauE = this.lit ? 1.6 : 12;
    this.EGTc += (egtTarget - this.EGTc) * Math.min(1, dt / tauE);
    if (!this.lit) this.EGTc += (this.c.T0 - 273.15 - this.EGTc) * Math.min(1, dt / (this.starterValve ? 8 : 40));
    if (this.startPhase === 'light' || this.startPhase === 'accel') this.maxEGTstart = Math.max(this.maxEGTstart, this.EGTc);
    const leak = this.fault === 'oil' ? 0.12 : 0;
    this.oilQty = Math.max(0, this.oilQty - leak * dt * (this.N2 / 100));
    const oilFactor = this.oilQty > 6 ? 1 : this.oilQty / 6;
    this.oilP = (this.N2 > 5 ? (12 + 58 * Math.pow(this.N2 / 100, 2)) : this.N2 * 1.5) * oilFactor;
    const oilTt = 20 + (this.lit ? 50 + 60 * this.N2 / 100 : 0) + (1 - oilFactor) * 60;
    this.oilT += (oilTt - this.oilT) * Math.min(1, dt / 60);
    if (this.oilQty < 2 && this.N2 > 30 && !this.seized) { this.seizeT = (this.seizeT || 0) + dt; if (this.seizeT > 25) { this.seized = true; this.flameout('bearing seizure'); this.log.push({ t: this.t, m: 'ENGINE SEIZED — bearings failed without oil' }); } }
    this.vib1 = 0.3 + 0.6 * this.N1 / 100 + this.bladeDamage * 4.2 * (this.N1 / 100) + this.stall * 1.5 + (this.seized ? 2 : 0);
    this.vib2 = 0.2 + 0.5 * this.N2 / 100 + (this.oilQty < 4 ? (4 - this.oilQty) * 0.6 : 0) + this.stall;
    // flameout fault at low power / descent
    if (this.fault === 'flameout' && this.lit && this.t - this.faultT > 2) { this.flameout('heavy rain ingestion'); }
    // fire
    if (this.fire && this.fireOutT && this.t > this.fireOutT) { this.fire = false; this.fireOut = true; this.log.push({ t: this.t, m: 'Fire extinguished' }); this.fault = 'none'; this.faultActive = false; }
    // thrust reverser doors / translating sleeve
    const revCmd = this.rev > 0.02 && this.wow;
    this.revPos += ((revCmd ? 1 : 0) - this.revPos) * Math.min(1, dt / 1.2);
    this.EGT = this.EGTc;
    this.messages();
    this.histT += dt; if (this.histT > 0.25) { this.histT = 0; this.hist.push([this.t, this.N1, this.N2, this.EGT, this.FF * 3600]); if (this.hist.length > 720) this.hist.shift(); }
  }
  /** Warning / caution messages (ECAM-style), most important first. */
  messages() {
    const m = [];
    if (this.fire) m.push({ lvl: 'warn', txt: 'ENG 1 FIRE', act: ['THR LEVER ……… IDLE', 'ENG MASTER ……… OFF', 'FIRE P/B ……… PUSH', 'AGENT 1 (after 10 s) ……… DISCH', 'If fire after 30 s: AGENT 2 ……… DISCH'] });
    if (this.seized) m.push({ lvl: 'warn', txt: 'ENG 1 SEIZED', act: ['ENG MASTER ……… OFF'] });
    if (this.oilP < LIMITS.OILP_LO && this.N2 > 50) m.push({ lvl: 'warn', txt: 'ENG 1 OIL LO PR', act: ['THR LEVER ……… IDLE', 'ENG MASTER ……… OFF (when safe)'] });
    if (this.EGT > LIMITS.EGT) m.push({ lvl: 'warn', txt: 'ENG 1 EGT OVER LIMIT', act: ['THR LEVER ……… REDUCE'] });
    if (this.abort && this.startPhase === 'cool') m.push({ lvl: 'caut', txt: 'ENG 1 START FAULT', act: [this.abort, 'Dry crank 30 s, then retry'] });
    if (this.stall > 0.1) m.push({ lvl: 'caut', txt: 'ENG 1 STALL', act: ['THR LEVER ……… IDLE (if stall persists)'] });
    if (!this.lit && this.flameoutT && !this.wow && this.master) m.push({ lvl: 'caut', txt: 'ENG 1 FLAME OUT', act: ['ENG MODE ……… IGN', 'Relight within the windmill envelope'] });
    if (this.vib1 > LIMITS.VIB - 2 || this.vib2 > 3.5) m.push({ lvl: 'caut', txt: 'ENG 1 HI VIBRATION', act: ['THR LEVER ……… REDUCE to keep VIB below advisory'] });
    if (this.oilQty < 6) m.push({ lvl: 'caut', txt: 'ENG 1 OIL QTY LO' });
    if (this.revPos > 0.9) m.push({ lvl: 'memo', txt: 'REV — thrust reverser deployed' });
    if (this.startPhase === 'motor' || this.startPhase === 'light' || this.startPhase === 'accel') m.push({ lvl: 'memo', txt: `ENG 1 START: ${this.startPhase === 'motor' ? 'motoring' : this.startPhase === 'light' ? 'waiting for light-off' : 'accelerating to idle'}` });
    if (this.fireOut) m.push({ lvl: 'memo', txt: 'ENG 1 FIRE OUT' });
    this.msgs = m;
  }
}
