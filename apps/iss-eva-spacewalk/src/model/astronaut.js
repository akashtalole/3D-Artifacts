import * as THREE from 'three';
import { shadowed, tag } from './geom.js';

/**
 * Spacesuited crew member. Body frame: +y toward the head, +z out of the chest.
 * Origin at the waist, ≈ 2.1 m tall including the helmet.
 *
 * suit: 'emu'   — NASA Extravehicular Mobility Unit (PLSS + SAFER backpack)
 *       'orlan' — Roscosmos Orlan-MKS (rear-entry backpack door)
 * stripes: 'red' | 'blue' | 'none'  (EV1 = red on the EMU; Orlan leader red, second blue)
 */
export function buildAstronaut(mats, { suit = 'emu', stripes = 'none', label = 'EV1' } = {}) {
  const root = new THREE.Group();
  root.name = label;
  const body = new THREE.Group();
  root.add(body);

  const suitMat = new THREE.MeshStandardMaterial({
    color: suit === 'orlan' ? 0xf1f1ea : 0xf6f6f3, roughness: 0.78, metalness: 0.0,
  });
  const jointMat = new THREE.MeshStandardMaterial({ color: 0xd9d9d4, roughness: 0.7 });
  const gloveMat = new THREE.MeshStandardMaterial({ color: suit === 'orlan' ? 0xbfc2c4 : 0xe8e8e4, roughness: 0.65 });
  const stripeColor = stripes === 'red' ? 0xd62d2d : stripes === 'blue' ? 0x2d5fd6 : null;
  const stripeMat = stripeColor ? new THREE.MeshStandardMaterial({ color: stripeColor, roughness: 0.6 }) : null;
  const visorMat = new THREE.MeshStandardMaterial({ color: 0xd8a640, roughness: 0.08, metalness: 1.0, envMapIntensity: 2 });

  const capsule = (r, l, m) => new THREE.Mesh(new THREE.CapsuleGeometry(r, l, 6, 14), m);
  const box = (sx, sy, sz, m, p) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m);
    b.position.set(...p);
    return b;
  };

  // Torso (Hard Upper Torso) and lower torso
  const torso = capsule(0.27, 0.3, suitMat);
  torso.scale.set(1.05, 1, 0.78);
  torso.position.y = 0.3;
  body.add(torso);
  const brief = capsule(0.2, 0.12, suitMat);
  brief.scale.set(1.15, 1, 0.85);
  brief.position.y = -0.08;
  body.add(brief);

  if (suit === 'emu') {
    body.add(box(0.62, 0.8, 0.3, suitMat, [0, 0.32, -0.37]));          // PLSS
    body.add(box(0.6, 0.2, 0.3, jointMat, [0, -0.18, -0.37]));         // SAFER
    body.add(box(0.34, 0.16, 0.13, jointMat, [0, 0.2, 0.26]));         // DCM chest pack
    body.add(box(0.06, 0.06, 0.06, new THREE.MeshStandardMaterial({ color: 0x3060d0 }), [0.1, 0.2, 0.33]));
  } else {
    body.add(box(0.68, 0.92, 0.34, suitMat, [0, 0.28, -0.38]));         // backpack door
    body.add(box(0.36, 0.2, 0.12, jointMat, [0, 0.16, 0.26]));          // control panel
    body.add(box(0.5, 0.06, 0.06, stripeMat || jointMat, [0, 0.75, -0.38]));
  }

  // Helmet + gold EV visor
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.2, 28, 20), suitMat);
  helmet.position.y = 0.76;
  body.add(helmet);
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.205, 28, 20, Math.PI * 0.08, Math.PI * 0.84, Math.PI * 0.18, Math.PI * 0.5), visorMat);
  visor.position.y = 0.76;
  body.add(visor);
  // Helmet lights (EVVA / HECA) with spotlights for orbital night
  const lights = [];
  for (const s of [-1, 1]) {
    const lamp = box(0.06, 0.08, 0.1, jointMat, [s * 0.21, 0.86, 0.04]);
    body.add(lamp);
    const sl = new THREE.SpotLight(0xfff2dd, 0, 18, 0.5, 0.6, 1.2);
    sl.position.set(s * 0.21, 0.86, 0.1);
    sl.target.position.set(s * 0.21, 0.4, 4);
    body.add(sl, sl.target);
    lights.push(sl);
  }
  const lampGlow = new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0 });
  for (const s of [-1, 1]) {
    const g = new THREE.Mesh(new THREE.CircleGeometry(0.03, 12), lampGlow);
    g.position.set(s * 0.21, 0.86, 0.095);
    body.add(g);
  }
  const helmetCam = new THREE.Object3D();
  helmetCam.position.set(0, 0.8, 0.3);
  body.add(helmetCam);

  // Limbs on pivots
  function limb(pivotPos, r1, l1, r2, l2, endMesh, bandTop) {
    const pivot = new THREE.Group();
    pivot.position.set(...pivotPos);
    const upper = capsule(r1, l1, suitMat);
    upper.position.y = -(l1 / 2 + r1 * 0.6);
    pivot.add(upper);
    const knee = new THREE.Group();
    knee.position.y = -(l1 + r1 * 1.3);
    pivot.add(knee);
    const lower = capsule(r2, l2, suitMat);
    lower.position.y = -(l2 / 2 + r2 * 0.6);
    knee.add(lower);
    endMesh.position.y = -(l2 + r2 * 1.5);
    knee.add(endMesh);
    if (stripeMat) {
      const band = (r, y, parent) => {
        const t = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.06, r * 1.06, 0.07, 18, 1, true), stripeMat);
        t.position.y = y;
        parent.add(t);
      };
      band(r1, upper.position.y + (bandTop ?? 0.05), pivot);
      band(r2, lower.position.y + 0.02, knee);
    }
    body.add(pivot);
    return { pivot, knee };
  }

  const glove = () => {
    const g = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), gloveMat);
    g.scale.set(0.9, 1.25, 0.75);
    return g;
  };
  const boot = () => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.12, 0.28), jointMat);
    b.geometry.translate(0, 0, 0.05);
    return b;
  };

  const armL = limb([0.35, 0.5, 0], 0.088, 0.2, 0.078, 0.18, glove(), 0.02);
  const armR = limb([-0.35, 0.5, 0], 0.088, 0.2, 0.078, 0.18, glove(), 0.02);
  const legL = limb([0.13, -0.2, 0], 0.11, 0.26, 0.095, 0.26, boot(), 0.04);
  const legR = limb([-0.13, -0.2, 0], 0.11, 0.26, 0.095, 0.26, boot(), 0.04);
  // EMU shoulder bearings
  for (const s of [-1, 1]) {
    const sb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10), jointMat);
    sb.position.set(s * 0.33, 0.5, 0);
    body.add(sb);
  }

  shadowed(root);
  root.traverse((o) => { if (o.isMesh && o.material === lampGlow) o.castShadow = false; });
  tag(root, suit === 'orlan' ? 'orlan' : 'emu');

  let phase = 0;
  /**
   * mode: 'translate' (hand-over-hand, head first) | 'work' | 'ride' | 'idle'
   * dist: distance moved this frame (drives the hand-over-hand cycle)
   */
  function animate(mode, dist, time) {
    phase += dist * 5.2;
    const s = Math.sin(phase);
    const breathe = Math.sin(time * 1.3) * 0.03;
    if (mode === 'translate') {
      armL.pivot.rotation.set(-2.35 + 0.55 * s, 0, 0.12);
      armR.pivot.rotation.set(-2.35 - 0.55 * s, 0, -0.12);
      armL.knee.rotation.x = -0.35 - 0.3 * Math.max(0, s);
      armR.knee.rotation.x = -0.35 - 0.3 * Math.max(0, -s);
      legL.pivot.rotation.set(0.12 + breathe, 0, 0.04);
      legR.pivot.rotation.set(0.2 - breathe, 0, -0.04);
      legL.knee.rotation.x = 0.35;
      legR.knee.rotation.x = 0.45;
    } else if (mode === 'work' || mode === 'ride') {
      const w = Math.sin(time * 2.1) * 0.12;
      armL.pivot.rotation.set(-1.15 + w, 0, 0.2);
      armR.pivot.rotation.set(-1.0 - w, 0, -0.2);
      armL.knee.rotation.x = -0.75 + w;
      armR.knee.rotation.x = -0.6 - w;
      const k = mode === 'ride' ? 0.05 : 0.18;
      legL.pivot.rotation.set(-k + breathe, 0, 0.05);
      legR.pivot.rotation.set(-k - breathe, 0, -0.05);
      legL.knee.rotation.x = k * 1.6;
      legR.knee.rotation.x = k * 1.6;
    } else {
      armL.pivot.rotation.set(-0.3 + breathe, 0, 0.25);
      armR.pivot.rotation.set(-0.3 - breathe, 0, -0.25);
      armL.knee.rotation.x = -0.5;
      armR.knee.rotation.x = -0.5;
      legL.pivot.rotation.set(0.05, 0, 0.05);
      legR.pivot.rotation.set(0.05, 0, -0.05);
      legL.knee.rotation.x = 0.15;
      legR.knee.rotation.x = 0.15;
    }
  }

  function setLights(on) {
    lights.forEach((l) => { l.intensity = on ? 5 : 0; });
    lampGlow.opacity = on ? 1 : 0;
  }

  animate('idle', 0, 0);
  return { root, body, animate, setLights, helmetCam, waist: new THREE.Vector3(0.3, 0, 0) };
}
