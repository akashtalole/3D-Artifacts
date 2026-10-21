import * as THREE from 'three';
import { panel, box, shadowed, tag } from './geom.js';

/**
 * Visiting vehicles. Each is built with its docking interface at the local origin
 * and the vehicle extending along local +x.
 */

function lathe(mat, pts, seg = 40) {
  const geo = new THREE.LatheGeometry(pts.map(([r, x]) => new THREE.Vector2(r, x)), seg);
  geo.rotateZ(-Math.PI / 2); // lathe axis y → x
  return new THREE.Mesh(geo, mat);
}

export function solarWings(mats, { x, span, chord, from, sections = 4 }) {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    for (let i = 0; i < sections; i++) {
      const len = span / sections;
      const p = panel(mats.ruArray, mats.sawBack, chord, len - 0.06, 0.03);
      p.position.set(x, 0, s * (from + len * (i + 0.5)));
      g.add(p);
    }
    const strut = box(mats.metal, 0.06, 0.06, from, [x, 0, s * from * 0.5]);
    g.add(strut);
  }
  return g;
}

export function buildSoyuz(mats) {
  const g = new THREE.Group();
  g.add(box(mats.metal, 0.5, 0.5, 0.5, [0.2, 0, 0]));                 // docking probe
  g.add(lathe(mats.soyuzGreen, [[0.01, 0.4], [0.55, 0.5], [1.05, 1.0], [1.13, 1.5], [1.0, 2.1], [0.6, 2.35], [0.01, 2.4]]));
  g.add(lathe(mats.soyuzGreen, [[0.6, 2.4], [0.95, 3.2], [1.1, 4.3], [0.01, 4.32]]));
  g.add(lathe(mats.soyuzGreen, [[0.01, 4.3], [1.0, 4.35], [1.36, 5.0], [1.36, 6.8], [1.1, 7.0], [0.01, 7.05]]));
  g.add(solarWings(mats, { x: 5.3, span: 4.1, chord: 1.1, from: 1.4, sections: 4 }));
  tag(g, 'soyuz');
  return shadowed(g);
}

export function buildProgress(mats) {
  const g = new THREE.Group();
  g.add(box(mats.metal, 0.5, 0.5, 0.5, [0.2, 0, 0]));
  g.add(lathe(mats.soyuzGreen, [[0.01, 0.4], [0.6, 0.5], [1.12, 1.2], [1.12, 2.6], [0.9, 3.0], [0.9, 4.4], [1.36, 4.6], [1.36, 7.0], [1.1, 7.2], [0.01, 7.22]]));
  g.add(solarWings(mats, { x: 6.0, span: 4.1, chord: 1.1, from: 1.4, sections: 4 }));
  tag(g, 'progress');
  return shadowed(g);
}

export function buildCrewDragon(mats) {
  const g = new THREE.Group();
  g.add(lathe(mats.metal, [[0.01, 0], [0.75, 0], [0.75, 0.35], [0.9, 0.4]]));                 // docking system
  g.add(lathe(mats.dragonWhite, [[0.9, 0.4], [1.2, 1.0], [1.95, 3.5], [2.0, 3.7], [0.01, 3.72]]));
  g.add(lathe(mats.heatShield, [[0.01, 3.7], [2.0, 3.72], [1.9, 3.95], [0.01, 3.96]]));
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1.85, 1.85, 2.9, 48, 1, true), mats.dragonTrunk);
  trunk.rotation.z = -Math.PI / 2;
  trunk.position.x = 3.95 + 1.45;
  g.add(trunk);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const fin = box(mats.dragonWhite, 1.1, 0.55, 0.06, [6.6, Math.cos(a) * 2.1, Math.sin(a) * 2.1]);
    fin.rotation.x = a;
    g.add(fin);
  }
  // SuperDraco pods and window
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    g.add(box(mats.darkMetal, 0.5, 0.25, 0.3, [2.6, Math.cos(a) * 1.7, Math.sin(a) * 1.7]));
  }
  tag(g, 'dragon');
  return shadowed(g);
}

/**
 * Cargo Dragon 2 (CRS-2 missions): no SuperDraco abort engines, nosecone hinged open
 * for docking, trunk open at the aft end with unpressurised cargo (here the iROSA pair).
 * Local frame: docking interface at the origin, vehicle along +x. Returns the group and
 * the positions of the four Draco thruster clusters (for RCS-plume effects).
 */
export function buildCargoDragon(mats, { trunkCargo = 'irosa' } = {}) {
  const g = new THREE.Group();
  g.add(lathe(mats.metal, [[0.01, 0], [0.75, 0], [0.75, 0.35], [0.9, 0.4]]));                 // docking system
  g.add(lathe(mats.dragonWhite, [[0.9, 0.4], [1.2, 1.0], [1.95, 3.5], [2.0, 3.7], [0.01, 3.72]]));
  g.add(lathe(mats.heatShield, [[0.01, 3.7], [2.0, 3.72], [1.9, 3.95], [0.01, 3.96]]));

  // Nosecone, hinged open beside the docking system
  const hinge = new THREE.Group();
  hinge.position.set(0.55, 1.05, 0);
  const cone = lathe(mats.dragonWhite, [[0.01, -0.35], [0.7, -0.15], [0.95, 0.05], [0.95, 0.12], [0.01, 0.13]]);
  cone.position.set(-0.55, 0, 0);
  hinge.add(cone);
  hinge.rotation.z = THREE.MathUtils.degToRad(-115);
  g.add(hinge);

  // Trunk: body-mounted solar cells, open aft end
  const trunkMat = mats.dragonTrunk.clone();
  trunkMat.side = THREE.DoubleSide;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1.85, 1.85, 2.9, 48, 1, true), trunkMat);
  trunk.rotation.z = -Math.PI / 2;
  trunk.position.x = 3.95 + 1.45;
  g.add(trunk);
  for (let i = 0; i < 2; i++) {
    const a = i * Math.PI + Math.PI / 2;
    const fin = box(mats.dragonWhite, 1.1, 0.55, 0.06, [6.6, Math.cos(a) * 2.1, Math.sin(a) * 2.1]);
    fin.rotation.x = a;
    g.add(fin);
  }
  if (trunkCargo === 'irosa') {
    for (const s of [-1, 1]) g.add(box(mats.white, 1.0, 0.75, 3.2, [5.6, s * 0.55, 0]));
    g.add(box(mats.darkMetal, 0.2, 2.4, 3.4, [4.3, 0, 0]));                                  // cargo deck
  }

  // Draco clusters around the capsule shoulder
  const thrusters = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const p = new THREE.Vector3(2.2, Math.cos(a) * 1.55, Math.sin(a) * 1.55);
    g.add(box(mats.darkMetal, 0.35, 0.18, 0.25, p.toArray()));
    thrusters.push(p.clone().add(new THREE.Vector3(0, Math.cos(a) * 0.3, Math.sin(a) * 0.3)));
  }
  tag(g, 'dragonCargo');
  return { group: shadowed(g), thrusters };
}
