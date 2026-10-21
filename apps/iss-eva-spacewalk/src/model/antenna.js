import * as THREE from 'three';
import { box, shadowed, tag, StrutBatch, latticeAlongZ } from './geom.js';

/** Grip point of the Ku-band antenna ORU on top of the Z1 mast (station frame). */
export const SGANT_MOUNT = [-6.55, 7.1, 0];

/**
 * Ku-band Space-to-Ground Antenna (SGANT) boom-and-dish ORU. The origin is the
 * robotic grip point on the base box, so a robot hand or a mount can hold it
 * there. `aged` tints the dish as a worn, failed unit.
 */
export function buildAntennaORU(mats, { aged = false } = {}) {
  const g = new THREE.Group();
  g.add(box(mats.boxGray, 0.55, 0.55, 0.55, [0, 0, 0]));
  g.add(box(mats.darkMetal, 0.22, 0.22, 0.22, [0, 0, 0.36]));                // grapple fixture
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.05, 12), mats.metal);
  mast.position.y = 0.8;
  g.add(mast);
  g.add(box(mats.darkMetal, 0.35, 0.3, 0.35, [0, 1.42, 0]));                  // gimbal
  const dishMat = new THREE.MeshStandardMaterial({
    color: aged ? 0xc9c2ae : 0xf4f4f1, roughness: aged ? 0.85 : 0.5, metalness: 0.1, side: THREE.DoubleSide,
  });
  const dishPivot = new THREE.Group();
  dishPivot.position.set(0, 1.6, 0);
  dishPivot.rotation.z = THREE.MathUtils.degToRad(-35);                        // looks up & forward toward TDRS
  const dish = new THREE.Mesh(new THREE.SphereGeometry(1.25, 32, 10, 0, Math.PI * 2, 0, 0.62), dishMat);
  dish.rotation.x = Math.PI;                                                   // concave side up
  dish.position.y = 1.25;
  dishPivot.add(dish);
  for (let i = 0; i < 3; i++) {                                                // feed struts
    const a = (i / 3) * Math.PI * 2;
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.85, 6), mats.metal);
    s.position.set(Math.cos(a) * 0.32, 0.55, Math.sin(a) * 0.32);
    s.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35);
    dishPivot.add(s);
  }
  dishPivot.add(box(mats.darkMetal, 0.14, 0.18, 0.14, [0, 0.95, 0]));          // feed horn
  g.add(dishPivot);
  tag(g, 'sgant');
  return shadowed(g);
}

/** Z1 truss on Unity's zenith port with CMGs and the fixed lower SGANT mast. */
export function buildZ1(mats) {
  const g = new THREE.Group();
  const b = new StrutBatch();
  latticeAlongZ(b, { cx: -7.35, cy: 3.75, hx: 1.5, hy: 1.45, z0: -1.2, z1: 1.2, bay: 1.2, r: 0.06 });
  g.add(b.build(mats.truss, 6));
  for (const [dx, dz] of [[-0.7, -0.6], [0.7, -0.6], [-0.7, 0.6], [0.7, 0.6]]) {   // 4 Control Moment Gyroscopes
    const cmg = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.7, 20), mats.white);
    cmg.position.set(-7.35 + dx, 3.4, dz);
    g.add(cmg);
  }
  g.add(box(mats.boxGray, 2.4, 0.3, 2.0, [-7.35, 5.1, 0]));
  const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.6, 12), mats.metal);
  lower.position.set(SGANT_MOUNT[0], 5.25 + 0.8, 0);
  g.add(lower);
  g.add(box(mats.darkMetal, 0.7, 0.12, 0.7, [SGANT_MOUNT[0], SGANT_MOUNT[1] - 0.33, 0]));   // ORU interface plate
  tag(g, 'z1');
  return shadowed(g);
}

/** Dextre (SPDM) with two 7-joint arms, built for robotic animation (arms solved in main). */
export function buildDextreBody(mats) {
  const g = new THREE.Group();
  g.add(box(mats.white, 0.9, 3.0, 0.9, [0, 0, 0]));
  g.add(box(mats.metal, 2.2, 0.5, 0.9, [0, 0.9, 0]));                         // shoulder crossbar
  g.add(box(mats.darkMetal, 0.35, 0.3, 0.35, [0, 1.7, 0]));                   // grapple fixture (held by Canadarm2)
  g.add(box(mats.boxGray, 0.7, 0.5, 0.5, [0, -0.6, -0.65]));                  // tool / ORU platform
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.5, 12), mats.darkMetal);
  head.rotation.x = Math.PI / 2;
  head.position.set(0, -1.65, 0.1);                                           // camera/light head
  g.add(head);
  tag(g, 'dextre');
  return shadowed(g);
}
