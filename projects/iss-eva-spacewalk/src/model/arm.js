import * as THREE from 'three';
import { placeBetween, shadowed, tag } from './geom.js';

/**
 * Two-boom robotic arm with an analytic IK solve (shoulder → elbow → wrist → end
 * effector). Canadarm2 and ERA both use it, with different lengths.
 *
 * The arm is driven by a desired end-effector (tip) position. The wrist sits
 * `wrist` metres "above" the tip along -tipDir, the elbow bends toward `pole`.
 * Unreachable targets are clamped to full extension; `tip` reports where the
 * end effector actually is, so anything riding it stays attached.
 */
export class RoboticArm {
  constructor(mats, { L1 = 8, L2 = 8, wrist = 1.2, boomR = 0.18, pole = [0, 1, 0], tipDir = [0, -1, 0], cid = 'canadarm2', baseLen = 1.1 } = {}) {
    this.L1 = L1;
    this.L2 = L2;
    this.wristLen = wrist;
    this.pole = new THREE.Vector3(...pole).normalize();
    this.tipDir = new THREE.Vector3(...tipDir).normalize();
    this.group = new THREE.Group();
    this.shoulder = new THREE.Vector3();
    this.elbow = new THREE.Vector3();
    this.wrist = new THREE.Vector3();
    this.tip = new THREE.Vector3();
    this.baseLen = baseLen;

    const cyl = (r, m) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 20), m);
    this.base = cyl(0.26, mats.metal);
    this.boom1 = cyl(boomR, mats.canadarm);
    this.boom2 = cyl(boomR, mats.canadarm);
    this.wristMesh = cyl(0.2, mats.metal);
    const joint = (r) => new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), mats.darkMetal);
    this.jShoulder = joint(0.36);
    this.jElbow = joint(0.34);
    this.jWrist = joint(0.32);
    this.lee = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.22, 0.6, 18), mats.metal);

    // Thin dark bands near each boom end, like the real joint collars
    this.group.add(this.base, this.boom1, this.boom2, this.wristMesh, this.jShoulder, this.jElbow, this.jWrist, this.lee);
    shadowed(this.group);
    tag(this.group, cid);
    this.baseDir = new THREE.Vector3(0, 1, 0);
    this.basePoint = new THREE.Vector3();
  }

  /** Base mount point and the direction the base column points. */
  setBase(point, dir = [0, 1, 0]) {
    this.basePoint.copy(point);
    this.baseDir.set(...dir).normalize();
    this.shoulder.copy(point).addScaledVector(this.baseDir, this.baseLen);
  }

  /** Solve for a desired end-effector position. */
  solve(target) {
    const S = this.shoulder;
    const W = this.wrist.copy(target).addScaledVector(this.tipDir, -this.wristLen);
    const d = new THREE.Vector3().subVectors(W, S);
    let D = d.length();
    const maxR = this.L1 + this.L2 - 0.05;
    const minR = Math.abs(this.L1 - this.L2) + 0.6;
    const dn = D > 1e-6 ? d.clone().divideScalar(D) : new THREE.Vector3(1, 0, 0);
    if (D > maxR) D = maxR;
    if (D < minR) D = minR;
    W.copy(S).addScaledVector(dn, D);

    const a = (this.L1 * this.L1 - this.L2 * this.L2 + D * D) / (2 * D);
    const h = Math.sqrt(Math.max(0, this.L1 * this.L1 - a * a));
    const p = this.pole.clone().addScaledVector(dn, -this.pole.dot(dn));
    if (p.lengthSq() < 1e-6) p.set(1, 0, 0).addScaledVector(dn, -dn.x);
    p.normalize();
    this.elbow.copy(S).addScaledVector(dn, a).addScaledVector(p, h);
    this.tip.copy(W).addScaledVector(this.tipDir, this.wristLen);

    placeBetween(this.base, this.basePoint, S);
    placeBetween(this.boom1, S, this.elbow);
    placeBetween(this.boom2, this.elbow, W);
    const wristEnd = W.clone().addScaledVector(this.tipDir, this.wristLen - 0.3);
    placeBetween(this.wristMesh, W, wristEnd);
    this.lee.position.copy(this.tip).addScaledVector(this.tipDir, -0.3);
    this.lee.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.tipDir.clone().negate());
    this.jShoulder.position.copy(S);
    this.jElbow.position.copy(this.elbow);
    this.jWrist.position.copy(W);
    return this.tip;
  }
}
