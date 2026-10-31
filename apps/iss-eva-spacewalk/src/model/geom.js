import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _m = new THREE.Matrix4();

export const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);

/** Mark a mesh/group as shadow casting & receiving, recursively. */
export function shadowed(obj, cast = true, receive = true) {
  obj.traverse((o) => {
    if (o.isMesh) { o.castShadow = cast; o.receiveShadow = receive; }
  });
  return obj;
}

/** Tag every mesh under obj with a component id for picking. */
export function tag(obj, cid) {
  obj.userData.cid = cid;
  obj.traverse((o) => { if (o.isMesh) o.userData.cid = cid; });
  return obj;
}

/** Orient a +Y-aligned cylinder mesh so it spans points a → b. */
export function placeBetween(mesh, a, b) {
  _v.subVectors(b, a);
  const len = _v.length();
  mesh.position.addVectors(a, b).multiplyScalar(0.5);
  if (len > 1e-6) mesh.quaternion.setFromUnitVectors(UP, _v.divideScalar(len));
  mesh.scale.set(1, len, 1);
  return mesh;
}

/**
 * Collects many thin cylinders ("struts") and emits one InstancedMesh.
 * Used for truss lattices, masts and booms — thousands of members, one draw call.
 */
export class StrutBatch {
  constructor() { this.items = []; }
  add(a, b, r) { this.items.push([a.clone(), b.clone(), r]); return this; }
  build(material, radial = 6) {
    const geo = new THREE.CylinderGeometry(1, 1, 1, radial, 1, false);
    const mesh = new THREE.InstancedMesh(geo, material, this.items.length);
    this.items.forEach(([a, b, r], i) => {
      _v.subVectors(b, a);
      const len = _v.length();
      _q.setFromUnitVectors(UP, _v.clone().divideScalar(len || 1));
      _s.set(r, len, r);
      _m.compose(a.clone().add(b).multiplyScalar(0.5), _q, _s);
      mesh.setMatrixAt(i, _m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }
}

/**
 * Box lattice between z0 and z1, centred at (cx, cy), half-size hx × hy.
 * Four longerons, square frames every bay and alternating face diagonals.
 */
export function latticeAlongZ(batch, { cx = 0, cy = 0, hx, hy, z0, z1, bay = 2.3, r = 0.07 }) {
  const n = Math.max(1, Math.round(Math.abs(z1 - z0) / bay));
  const corners = [[-hx, -hy], [hx, -hy], [hx, hy], [-hx, hy]];
  const P = (k, z) => new THREE.Vector3(cx + corners[k][0], cy + corners[k][1], z);
  for (let k = 0; k < 4; k++) batch.add(P(k, z0), P(k, z1), r * 1.4);
  for (let i = 0; i <= n; i++) {
    const z = z0 + ((z1 - z0) * i) / n;
    for (let k = 0; k < 4; k++) batch.add(P(k, z), P((k + 1) % 4, z), r);
    if (i < n) {
      const zn = z0 + ((z1 - z0) * (i + 1)) / n;
      for (let k = 0; k < 4; k++) {
        const flip = (i + k) % 2 === 0;
        batch.add(P(k, flip ? z : zn), P((k + 1) % 4, flip ? zn : z), r * 0.8);
      }
    }
  }
}

/** Triangular mast lattice along +x from x0 to x1 (FAST mast of a solar wing). */
export function mastAlongX(batch, { x0, x1, radius = 0.32, bay = 0.62, r = 0.022 }) {
  const n = Math.max(1, Math.round((x1 - x0) / bay));
  const ang = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
  const P = (k, x) => new THREE.Vector3(x, Math.cos(ang[k]) * radius, Math.sin(ang[k]) * radius);
  for (let k = 0; k < 3; k++) batch.add(P(k, x0), P(k, x1), r * 1.3);
  for (let i = 0; i < n; i++) {
    const xa = x0 + ((x1 - x0) * i) / n;
    const xb = x0 + ((x1 - x0) * (i + 1)) / n;
    for (let k = 0; k < 3; k++) {
      batch.add(P(k, xa), P((k + 1) % 3, xa), r);
      batch.add(P(k, xa), P((k + 1) % 3, xb), r * 0.7);
    }
  }
}

const AXIS_ROT = {
  x: new THREE.Euler(0, 0, -Math.PI / 2),
  y: new THREE.Euler(0, 0, 0),
  z: new THREE.Euler(Math.PI / 2, 0, 0),
};

/**
 * Pressurised module: MLI-covered cylinder with domed end cones, CBM rings and
 * a few handrails. `profile` optionally gives a lathe profile [[r, y], ...] along the axis.
 */
export function moduleMesh(mats, { L, r, axis = 'x', material, profile = null, rings = true, handrails = true, endCaps = true }) {
  const g = new THREE.Group();
  const inner = new THREE.Group();
  inner.rotation.copy(AXIS_ROT[axis]);
  g.add(inner);

  const mat = material || mats.mli;
  let body;
  if (profile) {
    const pts = profile.map(([pr, py]) => new THREE.Vector2(pr, py));
    body = new THREE.Mesh(new THREE.LatheGeometry(pts, 48), mat);
  } else {
    const capH = endCaps ? Math.min(0.55, r * 0.3) : 0;
    const bodyL = L - capH * 2;
    body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, bodyL, 48, 1, true), mat);
    if (endCaps) {
      for (const s of [-1, 1]) {
        const cone = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.62, r, capH, 48, 1, true), mat);
        cone.position.y = s * (bodyL / 2 + capH / 2);
        if (s > 0) cone.rotation.x = Math.PI;
        inner.add(cone);
        const disk = new THREE.Mesh(new THREE.CircleGeometry(r * 0.62, 40), mats.ring);
        disk.position.y = s * (L / 2);
        disk.rotation.x = s > 0 ? -Math.PI / 2 : Math.PI / 2;
        inner.add(disk);
      }
    }
  }
  inner.add(body);

  if (rings) {
    const ringGeo = new THREE.TorusGeometry(r * 0.64, 0.07, 8, 40);
    for (const s of [-1, 1]) {
      const ring = new THREE.Mesh(ringGeo, mats.ring);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = s * (L / 2 - 0.02);
      inner.add(ring);
    }
  }

  if (handrails && L > 3) {
    const railGeo = new THREE.BoxGeometry(0.05, L * 0.62, 0.05);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      const rail = new THREE.Mesh(railGeo, mats.handrail);
      rail.position.set(Math.cos(a) * (r + 0.09), 0, Math.sin(a) * (r + 0.09));
      inner.add(rail);
    }
  }
  return shadowed(g);
}

/** Flat solar-array style panel lying in the local x–z plane, facing +y (front) and −y (back). */
export function panel(front, back, lx, lz, thickness = 0.03) {
  const g = new THREE.Group();
  const geo = new THREE.PlaneGeometry(lx, lz);
  const f = new THREE.Mesh(geo, front);
  f.rotation.x = -Math.PI / 2;
  f.position.y = thickness / 2;
  const b = new THREE.Mesh(geo, back);
  b.rotation.x = Math.PI / 2;
  b.position.y = -thickness / 2;
  g.add(f, b);
  return shadowed(g);
}

export function box(mat, sx, sy, sz, pos) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
  if (pos) m.position.set(pos[0], pos[1], pos[2]);
  m.castShadow = m.receiveShadow = true;
  return m;
}
