import * as THREE from 'three';

/**
 * Keyframe timeline for an EVA.
 *
 * Mission data (src/data/missions.js) is authored in minutes; everything here is
 * seconds. A mission has:
 *   tracks.ev1 / ev2  — crew body-centre keys  { t, p:[x,y,z], face?, up? }
 *   tracks.arm / era  — robotic arm end-effector keys
 *   scalars           — named numeric tracks (MBS position, hatch angle, iROSA deploy …)
 *   payloads          — objects that are carried around (batteries, iROSA package …)
 *   attach            — intervals where one thing rides on another
 *                       { who, to, from, until, off:[x,y,z], face?, up? }
 */

const ease = (s) => {
  const sm = s * s * (3 - 2 * s);
  return 0.3 * s + 0.7 * sm;
};

export class VecTrack {
  constructor(keys = []) {
    this.keys = keys
      .map((k) => ({ ...k, v: k.v || new THREE.Vector3(...k.p) }))
      .sort((a, b) => a.t - b.t);
  }

  insert(key) {
    this.keys.push({ ...key, v: key.v || new THREE.Vector3(...key.p) });
    this.keys.sort((a, b) => a.t - b.t);
  }

  get empty() { return this.keys.length === 0; }

  /** Returns { pos, moving, tangent, key } — key is the segment's end key (its face/up hints). */
  sample(t, out = {}) {
    const k = this.keys;
    out.pos ||= new THREE.Vector3();
    out.tangent ||= new THREE.Vector3(0, 1, 0);
    if (!k.length) { out.moving = false; out.key = null; return out; }
    if (t <= k[0].t) return this._hold(k[0], out);
    if (t >= k[k.length - 1].t) return this._hold(k[k.length - 1], out);
    let i = 0;
    // keys per track are few (< 80): linear scan is fine
    while (i < k.length - 2 && k[i + 1].t <= t) i++;
    const a = k[i], b = k[i + 1];
    const span = b.t - a.t;
    const s = span > 1e-6 ? (t - a.t) / span : 1;
    out.pos.lerpVectors(a.v, b.v, ease(s));
    out.tangent.subVectors(b.v, a.v);
    const d = out.tangent.length();
    out.moving = d > 0.15;
    out.speed = span > 0 ? d / span : 0;
    if (d > 1e-6) out.tangent.divideScalar(d);
    out.key = b;
    out.from = a;
    return out;
  }

  _hold(key, out) {
    out.pos.copy(key.v);
    out.moving = false;
    out.speed = 0;
    out.key = key;
    out.from = key;
    return out;
  }
}

export class ScalarTrack {
  constructor(keys = []) { this.keys = [...keys].sort((a, b) => a[0] - b[0]); }
  sample(t, fallback = 0) {
    const k = this.keys;
    if (!k.length) return fallback;
    if (t <= k[0][0]) return k[0][1];
    if (t >= k[k.length - 1][0]) return k[k.length - 1][1];
    let i = 0;
    while (i < k.length - 2 && k[i + 1][0] <= t) i++;
    const [t0, v0] = k[i];
    const [t1, v1] = k[i + 1];
    const s = t1 > t0 ? (t - t0) / (t1 - t0) : 1;
    return v0 + (v1 - v0) * ease(s);
  }
}

const MIN = 60;

/** Compiles a mission definition (minutes) into tracks (seconds). */
export class MissionPlayer {
  constructor(mission) {
    this.mission = mission;
    this.duration = (mission.duration || 0) * MIN;
    const toSec = (keys = []) => keys.map((k) => ({ ...k, t: k.t * MIN }));
    this.tracks = {};
    for (const [name, keys] of Object.entries(mission.tracks || {})) this.tracks[name] = new VecTrack(toSec(keys));
    this.scalars = {};
    for (const [name, keys] of Object.entries(mission.scalars || {})) this.scalars[name] = new ScalarTrack(keys.map(([t, v]) => [t * MIN, v]));
    this.payloads = (mission.payloads || []).map((p) => ({
      ...p,
      track: new VecTrack(toSec(p.keys)),
      show: p.show ? p.show.map((x) => x * MIN) : [-Infinity, Infinity],
    }));
    for (const p of this.payloads) this.tracks[p.id] = p.track;
    this.attach = (mission.attach || []).map((a) => ({ ...a, from: a.from * MIN, until: a.until * MIN, offV: new THREE.Vector3(...(a.off || [0, 0, 0])) }));
    this.phases = (mission.phases || []).map((ph) => ({ ...ph, t: ph.t * MIN }));

    // Insert boundary keys so an actor glides onto / off its carrier smoothly.
    const tmp = {};
    for (const a of this.attach) {
      const track = this.tracks[a.who];
      if (!track) continue;
      for (const tt of [a.from, a.until]) {
        const p = this.positionAt(a.to, tt, tmp).clone().add(a.offV);
        track.insert({ t: tt, v: p, face: a.face, up: a.up, attached: true });
      }
    }
  }

  attachmentOf(who, t) {
    for (const a of this.attach) if (a.who === who && t >= a.from && t <= a.until) return a;
    return null;
  }

  /** Build-time position of an actor (follows attachments using the authored tracks). */
  positionAt(name, t, out = {}) {
    const a = this.attachmentOf(name, t);
    if (a) return this.positionAt(a.to, t, out).clone().add(a.offV);
    const track = this.tracks[name];
    if (!track) return new THREE.Vector3();
    return track.sample(t, out).pos.clone();
  }

  scalar(name, t, fallback = 0) {
    const s = this.scalars[name];
    return s ? s.sample(t, fallback) : fallback;
  }

  phaseIndex(t) {
    let idx = 0;
    for (let i = 0; i < this.phases.length; i++) if (t >= this.phases[i].t) idx = i;
    return idx;
  }
}
