import * as THREE from 'three';

/** Engine geometry. The engine axis is x; the inlet faces +x. Dimensions in metres (≈ 1.98 m fan). */
const cache = new Map();
function mat(color, o = {}) { const k = color + JSON.stringify(o); if (!cache.has(k)) cache.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.6, side: THREE.DoubleSide, ...o })); return cache.get(k); }

// flow-path radii along the axis (x → r)
const lerpTab = (tab, x) => { if (x >= tab[0][0]) return tab[0][1]; for (let i = 1; i < tab.length; i++) if (x >= tab[i][0]) { const [x0, r0] = tab[i - 1], [x1, r1] = tab[i]; return r0 + (r1 - r0) * (x - x0) / (x1 - x0); } return tab.at(-1)[1]; };
export const FLOW = {
  nacIn: [[2.3, 1.06], [1.8, 1.03], [1.35, 1.0], [1.0, 1.0], [0.4, 1.0], [-0.6, 0.97], [-1.9, 0.86]],
  cowl: [[0.98, 0.51], [0.7, 0.57], [0.0, 0.62], [-0.8, 0.62], [-1.6, 0.58], [-2.4, 0.43]],
  caseC: [[0.98, 0.5], [0.62, 0.45], [0.5, 0.42], [-0.45, 0.33], [-0.6, 0.45], [-0.95, 0.43], [-1.0, 0.4], [-1.2, 0.42], [-1.95, 0.55], [-2.4, 0.42]],
  hubC: [[0.98, 0.36], [0.62, 0.34], [0.5, 0.26], [-0.45, 0.3], [-0.6, 0.27], [-0.95, 0.28], [-1.0, 0.32], [-1.2, 0.3], [-1.95, 0.32], [-2.4, 0.25], [-2.95, 0.02]],
};
export const r = (k, x) => lerpTab(FLOW[k], x);

/** A twisted, swept blade as a thin surface. Span along +y, chord around the x-axis. */
function bladeGeo({ r0, r1, c0, c1, tw0, tw1, sweep = 0, lean = 0, thick = 0.012, ns = 8 }) {
  const pos = [], idx = [];
  const nc = 6;
  for (let i = 0; i <= ns; i++) {
    const u = i / ns, rr = r0 + (r1 - r0) * u, c = c0 + (c1 - c0) * u, tw = tw0 + (tw1 - tw0) * u;
    for (let side = 0; side < 2; side++) for (let j = 0; j <= nc; j++) {
      const v = j / nc - 0.5, camber = 0.08 * c * (1 - 4 * v * v), th = (side ? 1 : -1) * thick * (1 - 4 * v * v + 0.15);
      const lx = v * c, lz = camber + th;
      const x = lx * Math.cos(tw) - lz * Math.sin(tw) - sweep * u * u, z = lx * Math.sin(tw) + lz * Math.cos(tw) + lean * u;
      pos.push(x, rr, z);
    }
  }
  const row = (nc + 1) * 2;
  for (let i = 0; i < ns; i++) for (let side = 0; side < 2; side++) for (let j = 0; j < nc; j++) {
    const a = i * row + side * (nc + 1) + j, b = a + row;
    if (side) idx.push(a, a + 1, b, a + 1, b + 1, b); else idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
function ring(geo, material, n, x, phase = 0) {
  const m = new THREE.InstancedMesh(geo, material, n), o = new THREE.Object3D();
  for (let i = 0; i < n; i++) { o.position.set(x, 0, 0); o.rotation.set((i / n) * Math.PI * 2 + phase, 0, 0); o.updateMatrix(); m.setMatrixAt(i, o.matrix); }
  m.castShadow = true; return m;
}
/** Surface of revolution around the x-axis from [x, r] points. */
function lathe(pts, material, seg = 72) {
  const g = new THREE.LatheGeometry(pts.map(([x, rr]) => new THREE.Vector2(rr, x)), seg);
  g.rotateZ(-Math.PI / 2);   // lathe axis y → engine axis x
  const m = new THREE.Mesh(g, material); m.castShadow = true; m.receiveShadow = true; return m;
}
const tube = (k, x0, x1, n = 24) => { const out = []; for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n; out.push([x, r(k, x)]); } return out; };

export class TurbofanModel {
  constructor() {
    this.group = new THREE.Group();
    this.parts = {};        // name → { obj, explode: dx, info }
    this.shells = [];       // materials that get cut away
    this.clip = [new THREE.Plane(new THREE.Vector3(0, 0, -1), 0), new THREE.Plane(new THREE.Vector3(0, -1, 0), 0)];
    this.lp = new THREE.Group(); this.hp = new THREE.Group();
    this.build();
  }
  shell(color, o) { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.5, side: THREE.DoubleSide, clipIntersection: true, ...o }); this.shells.push(m); return m; }
  part(name, obj, explode, info, parent = this.group) { parent.add(obj); this.parts[name] = { obj, explode, info, base: obj.position.clone() }; obj.userData.part = name; obj.traverse((o) => { o.userData.part = name; }); return obj; }
  build() {
    const G = this.group;
    const ti = mat('#9aa3ad', { metalness: 0.8, roughness: 0.3 }), steel = mat('#b8bcc2', { metalness: 0.85, roughness: 0.28 });
    const nickel = mat('#8d7f73', { metalness: 0.7, roughness: 0.4 }), comp = mat('#2b2f36', { metalness: 0.3, roughness: 0.45 });
    // ── nacelle: inlet cowl + fan cowl (fixed) and translating sleeve (moves aft for reverse) ──
    const nacMat = this.shell('#e8ebee', { metalness: 0.25, roughness: 0.35 });
    const inlet = [[1.0, 1.0], [1.35, 1.0], [1.8, 1.03], [2.25, 1.055], [2.33, 1.09], [2.3, 1.13], [2.2, 1.16], [1.6, 1.2], [0.6, 1.21], [-0.55, 1.18], [-0.55, 0.985], [0.4, 1.0], [1.0, 1.0]];
    this.nacelle = this.part('nacelle', lathe(inlet, nacMat, 96), 0.9, 'inlet');
    const sleeve = [[-0.55, 1.17], [-1.2, 1.1], [-1.9, 0.9], [-1.9, 0.86], [-1.2, 0.93], [-0.6, 0.97], [-0.55, 0.975]];
    this.sleeve = this.part('sleeve', lathe(sleeve, this.shell('#e3e6ea', { metalness: 0.25, roughness: 0.35 }), 96), -0.5, 'reverser');
    // cascade vanes revealed when the sleeve slides aft
    const casc = new THREE.Group(); casc.position.x = -0.62;
    const vane = new THREE.BoxGeometry(0.015, 0.1, 0.1);
    const cascMat = this.shell('#5d646d', { metalness: 0.5 });
    for (let i = 0; i < 6; i++) { const m = ring(vane, cascMat, 64, -i * 0.07); for (let k = 0; k < 64; k++) { const o = new THREE.Object3D(); o.rotation.set((k / 64) * Math.PI * 2, 0, 0); o.position.set(-i * 0.07, 0, 0); o.translateY(1.05); o.rotateZ(0.6); o.updateMatrix(); m.setMatrixAt(k, o.matrix); } casc.add(m); }
    this.cascade = this.part('cascade', casc, -0.3, 'reverser');
    // blocker doors (fold into the bypass duct when reversing)
    const doorG = new THREE.BoxGeometry(0.4, 0.02, 0.22); doorG.translate(-0.2, 0, 0);
    this.doors = new THREE.InstancedMesh(doorG, mat('#6f7780'), 16); this.doors.userData.part = 'reverser'; G.add(this.doors); this.setReverser(0);
    // ── fan case, OGVs, core cowl ──
    const fanCase = lathe([[1.42, 1.0], [0.4, 1.0], [0.4, 1.02], [1.42, 1.02]], this.shell('#7d858e'), 96);
    this.part('fancase', fanCase, 0.6, 'fan');
    const ogv = bladeGeo({ r0: 0.6, r1: 0.99, c0: 0.16, c1: 0.18, tw0: 0.25, tw1: 0.2, thick: 0.006, ns: 4 });
    this.part('ogv', ring(ogv, mat('#8a929b'), 44, 0.72), 0.45, 'ogv');
    const cowl = lathe(tube('cowl', 0.98, -2.4, 40), this.shell('#c9ced3', { metalness: 0.35 }), 96);
    this.part('corecowl', cowl, -0.2, 'core');
    // pylon + a piece of wing
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.75, 0.22), mat('#dfe3e7', { metalness: 0.3 })); pylon.position.set(-0.8, 1.55, 0); G.add(pylon);
    const wingS = new THREE.Shape(); wingS.moveTo(-3.2, 0); wingS.lineTo(1.2, 0); wingS.lineTo(0.2, 0.18); wingS.lineTo(-3.4, 0.12); wingS.closePath();
    const wing = new THREE.Mesh(new THREE.ExtrudeGeometry(wingS, { depth: 14, bevelEnabled: false }), mat('#dfe3e7', { metalness: 0.3 })); wing.position.set(-0.6, 1.9, -7); G.add(wing);
    this.pylon = pylon; this.wing = wing;
    // ── LP spool: spinner, fan, booster, LP shaft, LPT ──
    const L = this.lp; G.add(L);
    const spinner = lathe([[1.75, 0.0], [1.68, 0.1], [1.5, 0.24], [1.25, 0.31], [1.1, 0.33], [1.1, 0.0]], mat('#d9dde2', { metalness: 0.7, roughness: 0.25 }));
    this.part('spinner', spinner, 1.2, 'fan', L);
    const fanBlade = bladeGeo({ r0: 0.3, r1: 0.985, c0: 0.32, c1: 0.42, tw0: 1.05, tw1: 0.28, sweep: 0.1, lean: 0.03, thick: 0.014, ns: 12 });
    this.fan = this.part('fan', ring(fanBlade, comp, 18, 1.2), 1.0, 'fan', L);
    const le = bladeGeo({ r0: 0.3, r1: 0.985, c0: 0.04, c1: 0.04, tw0: 1.05, tw1: 0.28, sweep: 0.1, lean: 0.03, thick: 0.016, ns: 12 }); le.translate(0.19, 0, 0);
    this.part('fanLE', ring(le, ti, 18, 1.2), 1.0, 'fan', L);
    const boost = new THREE.Group();
    for (let s = 0; s < 3; s++) { const x = 0.92 - s * 0.11, rh = r('hubC', x), rt = r('caseC', x); boost.add(ring(bladeGeo({ r0: rh, r1: rt - 0.005, c0: 0.05, c1: 0.045, tw0: 0.8, tw1: 0.55, thick: 0.004, ns: 4 }), ti, 64, x)); }
    this.part('booster', boost, 0.75, 'booster', L);
    const lpt = new THREE.Group();
    for (let s = 0; s < 7; s++) { const x = -1.25 - s * 0.1, rh = r('hubC', x), rt = r('caseC', x); lpt.add(ring(bladeGeo({ r0: rh, r1: rt - 0.006, c0: 0.06, c1: 0.055, tw0: -0.9, tw1: -0.6, thick: 0.005, ns: 4 }), nickel, 110 + s * 6, x)); }
    this.part('lpt', lpt, -0.9, 'lpt', L);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 3.3, 24), steel); shaft.rotation.z = Math.PI / 2; shaft.position.x = -0.5;
    this.part('lpshaft', shaft, 0, 'shafts', L);
    // ── HP spool: HPC, HP drum, HPT ──
    const H = this.hp; G.add(H);
    const hpc = new THREE.Group();
    for (let s = 0; s < 10; s++) { const x = 0.45 - s * 0.092, rh = r('hubC', x), rt = r('caseC', x); hpc.add(ring(bladeGeo({ r0: rh, r1: rt - 0.004, c0: 0.045, c1: 0.035, tw0: 0.75, tw1: 0.5, thick: 0.003, ns: 4 }), s < 5 ? ti : steel, 36 + s * 6, x)); }
    this.part('hpc', hpc, 0.3, 'hpc', H);
    const drum = lathe([[0.5, 0.26], [-0.45, 0.3], [-1.1, 0.31], [-1.1, 0.12], [0.5, 0.12]], mat('#a7adb4'));
    this.part('hpdrum', drum, 0, 'shafts', H);
    const hpt = new THREE.Group();
    for (let s = 0; s < 2; s++) { const x = -1.02 - s * 0.09, rh = r('hubC', x), rt = r('caseC', x); hpt.add(ring(bladeGeo({ r0: rh, r1: rt - 0.004, c0: 0.05, c1: 0.045, tw0: -1.0, tw1: -0.8, thick: 0.005, ns: 4 }), this.hptMat = new THREE.MeshStandardMaterial({ color: '#7c6a5a', metalness: 0.6, roughness: 0.4, side: THREE.DoubleSide, emissive: '#ff5a1a', emissiveIntensity: 0 }), 80, x)); }
    this.part('hpt', hpt, -0.6, 'hpt', H);
    // ── static parts: stators, casings, combustor ──
    const stat = new THREE.Group();
    for (let s = 0; s < 10; s++) { const x = 0.41 - s * 0.092, rh = r('hubC', x), rt = r('caseC', x); stat.add(ring(bladeGeo({ r0: rh + 0.004, r1: rt, c0: 0.03, c1: 0.03, tw0: -0.5, tw1: -0.4, thick: 0.003, ns: 3 }), mat('#7c838b'), 48 + s * 6, x)); }
    for (let s = 0; s < 7; s++) { const x = -1.2 - s * 0.1, rh = r('hubC', x), rt = r('caseC', x); stat.add(ring(bladeGeo({ r0: rh + 0.006, r1: rt, c0: 0.04, c1: 0.04, tw0: 0.6, tw1: 0.5, thick: 0.005, ns: 3 }), mat('#6c6158'), 90, x)); }
    this.part('stators', stat, 0, 'hpc');
    const caseC = lathe(tube('caseC', 0.98, -2.4, 60), this.shell('#8e959d'), 72);
    this.part('corecase', caseC, 0, 'core');
    const hubC = lathe(tube('hubC', 0.98, -2.95, 60), mat('#6b7178'), 72);
    this.part('hub', hubC, -0.4, 'exhaust');
    // combustor: annular liner, 18 fuel nozzles, 2 igniters, flame
    const comb = new THREE.Group();
    const liner = lathe([[-0.52, 0.32], [-0.58, 0.29], [-0.9, 0.3], [-0.98, 0.33], [-0.98, 0.4], [-0.9, 0.43], [-0.58, 0.43], [-0.52, 0.4], [-0.52, 0.32]], this.shell('#9b8e80', { metalness: 0.5 }), 72);
    comb.add(liner);
    this.flameMat = new THREE.MeshBasicMaterial({ color: '#ff8a2a', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const flame = lathe([[-0.56, 0.335], [-0.64, 0.32], [-0.9, 0.33], [-0.95, 0.36], [-0.9, 0.41], [-0.64, 0.42], [-0.56, 0.4]], this.flameMat, 72); flame.castShadow = false; comb.add(flame); this.flame = flame;
    const noz = new THREE.CylinderGeometry(0.008, 0.008, 0.16, 8); noz.rotateZ(0.9); noz.translate(-0.5, 0.45, 0);
    comb.add(ring(noz, mat('#c2a36b', { metalness: 0.8 }), 18, 0));
    this.igniters = [];
    for (const a of [0.6, -0.6]) { const ig = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.16, 8), mat('#d4d0c8')); ig.position.set(-0.62, Math.cos(a) * 0.48, Math.sin(a) * 0.48); ig.rotation.x = a; comb.add(ig); const sp = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshBasicMaterial({ color: '#bfe3ff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); sp.position.set(-0.62, Math.cos(a) * 0.4, Math.sin(a) * 0.4); comb.add(sp); this.igniters.push(sp); }
    this.part('combustor', comb, -0.25, 'combustor');
    // exhaust: core nozzle and plug glow with temperature
    this.plugMat = new THREE.MeshStandardMaterial({ color: '#6e655d', metalness: 0.6, roughness: 0.45, emissive: '#ff4d0d', emissiveIntensity: 0, side: THREE.DoubleSide });
    const plug = lathe([[-2.4, 0.25], [-2.6, 0.2], [-2.8, 0.1], [-2.95, 0.02], [-2.95, 0]], this.plugMat);
    this.part('plug', plug, -1.2, 'exhaust');
    // accessory gearbox, air turbine starter and tower shaft (below the fan case)
    const agb = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.3), mat('#7a8088')); box.position.set(0.7, -1.12, 0); agb.add(box);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.22, 16), mat('#a46d3c', { metalness: 0.6 })); st.rotation.z = Math.PI / 2; st.position.set(0.25, -1.12, 0.12); agb.add(st);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.85, 8), steel); tower.position.set(0.55, -0.72, 0); agb.add(tower);
    this.starterMesh = st;
    this.part('agb', agb, 0, 'agb');
    // bird for the bird-strike scenario
    this.bird = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), mat('#6b5a45', { metalness: 0 })); this.bird.scale.set(1.6, 1, 1); this.bird.visible = false; G.add(this.bird);
    this.setCutaway(true);
  }
  setCutaway(on) { for (const m of this.shells) { m.clippingPlanes = on ? this.clip : []; m.needsUpdate = true; } this.cut = on; }
  setXray(on) { for (const m of this.shells) { m.transparent = on; m.opacity = on ? 0.18 : 1; m.depthWrite = !on; m.needsUpdate = true; } }
  setExplode(k) {
    for (const p of Object.values(this.parts)) p.obj.position.x = p.base.x + (p.explode || 0) * k;
    // keep rotor parts that are inside spool groups consistent
  }
  setReverser(u) {
    if (this.sleeve) this.sleeve.position.x = this.parts.sleeve.base.x - 0.42 * u;
    const o = new THREE.Object3D();
    for (let i = 0; i < 16; i++) { o.position.set(-0.6 - 0.42 * u, 0, 0); o.rotation.set((i / 16) * Math.PI * 2, 0, 0); o.translateY(0.97); o.rotateZ(-u * 1.25); o.updateMatrix(); this.doors.setMatrixAt(i, o.matrix); }
    this.doors.instanceMatrix.needsUpdate = true;
  }
}
