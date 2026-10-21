import * as THREE from 'three';
import { PV } from './layout.js';
import { StrutBatch, mastAlongX, panel, box, shadowed, tag } from './geom.js';
import { withRepeat as matRepeat } from './materials.js';

/**
 * One Solar Array Wing in its own frame:
 *   +x  outward along the wing (mast direction)
 *   +y  cell-side normal (faces the Sun when tracking)
 *   +z  across the wing (parallel to the truss)
 * The returned `beta` group is the Beta Gimbal output — rotate it about x to track.
 */
export function buildSolarWing(mats, id) {
  const root = new THREE.Group();
  root.name = `SAW-${id}`;

  // Beta Gimbal Assembly housing (stays with the truss)
  const bga = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.8, 24), mats.metal);
  bga.rotation.z = -Math.PI / 2;
  bga.position.x = 0.4;
  root.add(bga);

  const beta = new THREE.Group();
  beta.position.x = 0.8;
  root.add(beta);

  // Mast canister + blanket boxes at the root
  const canister = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.4, 20), mats.darkMetal);
  canister.rotation.z = -Math.PI / 2;
  canister.position.x = 0.7;
  beta.add(canister);

  const L = PV.blanketLength;
  const W = PV.blanketWidth;
  const x0 = 1.6;
  const front = matRepeat(mats.sawFront, L / 1.1, W / 1.1);

  for (const s of [-1, 1]) {
    beta.add(box(mats.white, 0.5, 0.42, W + 0.2, [x0 - 0.3, 0, s * PV.blanketOffset]));
    const blanket = panel(front, mats.sawBack, L, W, 0.02);
    blanket.position.set(x0 + L / 2, 0, s * PV.blanketOffset);
    beta.add(blanket);
    // Tip box
    beta.add(box(mats.white, 0.3, 0.12, W + 0.1, [x0 + L + 0.15, 0, s * PV.blanketOffset]));
  }
  // Tip spreader bar across both blankets
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, PV.blanketOffset * 2 + W, 8), mats.metal);
  bar.rotation.x = Math.PI / 2;
  bar.position.x = x0 + L + 0.3;
  beta.add(bar);

  // FAST mast lattice
  const mb = new StrutBatch();
  mastAlongX(mb, { x0: 1.2, x1: x0 + L + 0.3 });
  beta.add(mb.build(mats.metal, 4));

  tag(root, 'saw');
  return { root: shadowed(root), beta };
}

/**
 * iROSA — roll-out array mounted on a bracket over the mast canister, canted ~10°
 * from the original wing. `setDeploy(f)` rolls it out (0 → stowed roll, 1 → 19 m).
 * Built in the parent wing's beta frame.
 */
export function buildIROSA(mats) {
  const root = new THREE.Group();
  root.name = 'iROSA';
  const LEN = 18.3;
  const WID = 6.0;

  // Mod-kit bracket (mast canister → iROSA base)
  root.add(box(mats.darkMetal, 0.3, 1.0, 0.3, [0.9, 0.5, -1.6]));
  root.add(box(mats.darkMetal, 0.3, 1.0, 0.3, [0.9, 0.5, 1.6]));

  const tilt = new THREE.Group();
  tilt.position.set(1.0, 1.1, 0);
  tilt.rotation.z = THREE.MathUtils.degToRad(10);
  root.add(tilt);

  // Base housing
  tilt.add(box(mats.white, 0.7, 0.35, WID + 0.3, [0, 0, 0]));

  // Blanket — scaled along x as it unrolls
  const frontMat = matRepeat(mats.irosaFront, LEN / 1.2, WID / 1.2);
  const blanket = panel(frontMat, mats.irosaBack, 1, WID, 0.02);
  tilt.add(blanket);

  // Two slit-tube booms along the edges
  const boomGeo = new THREE.CylinderGeometry(0.07, 0.07, 1, 10);
  boomGeo.rotateZ(-Math.PI / 2);
  boomGeo.translate(0.5, 0, 0);
  const booms = [-1, 1].map((s) => {
    const b = new THREE.Mesh(boomGeo, mats.metal);
    b.position.z = s * (WID / 2 + 0.08);
    tilt.add(b);
    return b;
  });

  // Rolled-up blanket at the tip (moves outward as it deploys)
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, WID + 0.3, 24), mats.white);
  roll.rotation.x = Math.PI / 2;
  tilt.add(roll);

  function setDeploy(f) {
    const len = Math.max(0.01, f * LEN);
    blanket.scale.x = len;
    blanket.position.x = 0.35 + len / 2;
    blanket.visible = f > 0.005;
    frontMat.map.repeat.set(Math.max(0.05, len / 1.2), WID / 1.2);
    booms.forEach((b) => { b.scale.x = len + 0.35; });
    const rollR = 0.12 + 0.2 * (1 - f);
    roll.scale.set(rollR / 0.32, 1, rollR / 0.32);
    roll.position.x = 0.35 + len + rollR * 0.5;
  }
  setDeploy(1);
  tag(root, 'irosa');
  return { root: shadowed(root), setDeploy };
}

/** The stowed iROSA package as carried by Canadarm2 and the crew. */
export function buildIROSAPackage(mats) {
  const g = new THREE.Group();
  g.add(box(mats.white, 1.0, 0.75, 3.3, [0, 0, 0]));
  g.add(box(mats.darkMetal, 0.25, 0.25, 0.25, [0.55, 0, 0]));          // grapple fixture
  g.add(box(mats.handrail, 0.05, 0.05, 2.6, [0, 0.42, 0]));            // EVA handrail
  g.add(box(mats.handrail, 0.05, 0.05, 2.6, [0, -0.42, 0]));
  tag(g, 'irosa');
  return shadowed(g);
}

/** Photovoltaic radiator (PVR): seven panels extending from the IEA. */
export function buildPVR(mats) {
  const g = new THREE.Group();
  const len = 13.6, wid = 3.1;
  const rad = matRepeat(mats.radiator, 4, 1);
  for (let i = 0; i < 7; i++) {
    const p = panel(rad, rad, len / 7 - 0.08, wid, 0.08);
    p.rotation.z = Math.PI / 2;
    p.position.y = -(i + 0.5) * (len / 7);
    g.add(p);
  }
  g.add(box(mats.metal, 0.12, len, 0.12, [0, -len / 2, 0]));
  tag(g, 'pvr');
  return shadowed(g);
}
