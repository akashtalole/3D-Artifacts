/**
 * IoT layer: sensor nodes, the gateway, radio packets in flight and live labels.
 */
import * as THREE from 'three';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, ...o });
const WHITE = std('#f4f6f7'), DARK = std('#2b3137');

/** kind: climate | soil | box | gateway */
function nodeMesh(kind) {
  const g = new THREE.Group();
  if (kind === 'climate') {
    for (let k = 0; k < 6; k++) { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.11 - k * 0.004, 0.11 - k * 0.004, 0.022, 14), WHITE); d.position.y = -0.14 + k * 0.045; g.add(d); }
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 2.4, 4), DARK); wire.position.y = 1.3; g.add(wire);
  }
  if (kind === 'soil') { const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.45, 6), DARK); stake.position.y = -0.2; g.add(stake); }
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.16, 0.07), kind === 'gateway' ? std('#dfe4e8') : WHITE); box.position.y = kind === 'climate' ? 0.16 : 0.08; g.add(box);
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, kind === 'gateway' ? 0.9 : 0.22, 5), DARK); ant.position.set(0.04, box.position.y + (kind === 'gateway' ? 0.5 : 0.18), 0); g.add(ant);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), new THREE.MeshBasicMaterial({ color: '#1d3a2a' })); led.position.set(0, box.position.y + 0.04, 0.04); g.add(led);
  g.traverse((o) => { o.castShadow = true; });
  return { g, led };
}

export function buildNet(defs, gw) {
  const G = new THREE.Group(), nodes = new Map();
  // gateway on a pole with a solar panel
  const gg = new THREE.Group(); gg.position.copy(gw.pos);
  if (gw.pole) { const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, gw.pole, 10), std('#9aa3aa', { metalness: 0.5 })); pole.position.y = gw.pole / 2; gg.add(pole); const sp = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, 0.6), std('#203a63', { metalness: 0.5, roughness: 0.3 })); sp.position.set(0, gw.pole - 1.2, 0.3); sp.rotation.x = -0.5; gg.add(sp); }
  const gn = nodeMesh('gateway'); gn.g.scale.setScalar(2.2); gn.g.position.y = gw.pole || 0; gg.add(gn.g); G.add(gg);
  const gwTop = new THREE.Vector3().copy(gw.pos).add(new THREE.Vector3(0, (gw.pole || 0) + 0.5, 0));
  const ringMat = new THREE.MeshBasicMaterial({ color: '#5fd4ff', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.38, 32), ringMat); ring.position.copy(gwTop); G.add(ring);
  const beamMat = new THREE.MeshBasicMaterial({ color: '#5fd4ff', transparent: true, opacity: 0, depthWrite: false });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 30, 6), beamMat); beam.position.copy(gwTop).add(new THREE.Vector3(0, 15.4, 0)); G.add(beam);
  for (const d of defs) {
    const m = nodeMesh(d.kind); if (d.pos) m.g.position.copy(d.pos); if (d.kind !== 'cam') G.add(m.g);
    nodes.set(d.id, { ...d, m, blink: 0, last: -1, rssi: d.rssi ?? -70 - Math.round(Math.random() * 30), bat: d.bat ?? 3.3 + Math.random() * 0.8 });
  }
  // dashed links
  const linkGeo = new THREE.BufferGeometry(), lp = new Float32Array(defs.length * 6); linkGeo.setAttribute('position', new THREE.BufferAttribute(lp, 3));
  const links = new THREE.LineSegments(linkGeo, new THREE.LineDashedMaterial({ color: '#5fd4ff', dashSize: 0.4, gapSize: 0.3, transparent: true, opacity: 0.35 })); links.frustumCulled = false; G.add(links);
  // packets
  const pool = []; const pg = new THREE.SphereGeometry(0.09, 10, 8);
  for (let i = 0; i < 48; i++) { const m = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ color: '#7fe8ff' })); m.visible = false; G.add(m); pool.push({ m, t: 0, a: new THREE.Vector3(), b: gwTop.clone(), live: false }); }
  let gwFlash = 0, upFlash = 0, offline = false;
  const posOf = (n, out) => (n.at ? n.at(out) : out.copy(n.m.g.position).add(new THREE.Vector3(0, n.kind === 'climate' ? 0.2 : 0.15, 0)));
  const tmp = new THREE.Vector3();
  function send(id, alarm = false) {
    const n = nodes.get(id); if (!n) return; n.blink = 0.35;
    const p = pool.find((q) => !q.live); if (!p) return;
    posOf(n, p.a); p.t = 0; p.live = true; p.m.visible = G.visible; p.m.material.color.set(alarm ? '#ff6b6b' : '#7fe8ff');
  }
  function update(dt) {
    for (const n of nodes.values()) { n.blink = Math.max(0, n.blink - dt); n.m.led.material.color.set(n.blink > 0 ? '#5dffa0' : '#1d3a2a'); }
    for (const p of pool) {
      if (!p.live) continue; p.t += dt / 0.9;
      if (p.t >= 1) { p.live = false; p.m.visible = false; gwFlash = 1; if (!offline) upFlash = 1; continue; }
      const u = p.t, mid = tmp.copy(p.a).lerp(p.b, 0.5); mid.y += 2 + p.a.distanceTo(p.b) * 0.12;
      p.m.position.set((1 - u) * (1 - u) * p.a.x + 2 * (1 - u) * u * mid.x + u * u * p.b.x, (1 - u) * (1 - u) * p.a.y + 2 * (1 - u) * u * mid.y + u * u * p.b.y, (1 - u) * (1 - u) * p.a.z + 2 * (1 - u) * u * mid.z + u * u * p.b.z);
    }
    gwFlash = Math.max(0, gwFlash - dt * 2); upFlash = Math.max(0, upFlash - dt * 1.5);
    ringMat.opacity = gwFlash * 0.8; ring.scale.setScalar(1 + (1 - gwFlash) * 2.5); ring.lookAt(ring.position.x, ring.position.y + 1, ring.position.z);
    beamMat.opacity = offline ? 0 : upFlash * 0.45; gn.led.material.color.set(offline ? '#ff4d4d' : gwFlash > 0 ? '#5dffa0' : '#1d3a2a');
    let i = 0; for (const n of nodes.values()) { posOf(n, tmp); lp.set([tmp.x, tmp.y, tmp.z, gwTop.x, gwTop.y, gwTop.z], i * 6); i++; }
    linkGeo.attributes.position.needsUpdate = true; links.computeLineDistances();
  }
  return { group: G, nodes, send, update, gwTop, setOffline: (v) => { offline = v; }, posOf };
}

/** HTML labels that follow 3D points. */
export function labeller(root, camera) {
  const els = new Map(), v = new THREE.Vector3();
  function set(id, pos, html, cls = '') {
    let e = els.get(id); if (!e) { e = document.createElement('div'); e.className = `lbl ${cls}`; root.appendChild(e); els.set(id, e); }
    e.dataset.live = '1'; if (e._h !== html) { e.innerHTML = html; e._h = html; } e._p = pos;
  }
  function frame(w, h, show = true) {
    for (const [id, e] of els) {
      if (e.dataset.live !== '1' || !show) { e.style.display = 'none'; e.dataset.live = ''; continue; }
      v.copy(e._p).project(camera); e.dataset.live = '';
      if (v.z > 1 || v.x < -1.1 || v.x > 1.1 || v.y < -1.1 || v.y > 1.1) { e.style.display = 'none'; continue; }
      e.style.display = ''; e.style.left = `${((v.x + 1) / 2) * w}px`; e.style.top = `${((1 - v.y) / 2) * h}px`;
    }
  }
  function clear() { for (const e of els.values()) e.remove(); els.clear(); }
  return { set, frame, clear };
}
