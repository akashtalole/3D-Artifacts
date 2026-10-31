import * as THREE from 'three';
import { StrutBatch, box, shadowed } from 'iss/model/geom.js';

/**
 * Falcon 9 Block 5 + Cargo Dragon 2, built in metres with y up and the bottom of
 * the first-stage engines at y = 0.
 *
 * Published sizes: 3.7 m diameter; first stage ≈ 41 m plus interstage; second stage
 * ≈ 13.8 m; Dragon with trunk ≈ 8.1 m; ≈ 69 m tall on the pad.
 */

function lathe(mat, pts, seg = 40) {
  return new THREE.Mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg), mat);
}

const R = 1.83;

/** Cargo Dragon 2 with an animatable nosecone. Local frame: docking face at origin, body along +x. */
export function buildDragon(mats) {
  const g = new THREE.Group();
  const capsule = new THREE.Group();
  const rot = (m) => { m.geometry.rotateZ(-Math.PI / 2); return m; };
  capsule.add(rot(lathe(mats.metal, [[0.01, 0], [0.75, 0], [0.75, 0.35], [0.9, 0.4]])));
  capsule.add(rot(lathe(mats.dragonWhite, [[0.9, 0.4], [1.2, 1.0], [1.95, 3.5], [2.0, 3.7], [0.01, 3.72]])));
  capsule.add(rot(lathe(mats.heatShield, [[0.01, 3.7], [2.0, 3.72], [1.9, 3.95], [0.01, 3.96]])));
  g.add(capsule);

  // Nosecone: closed over the docking system for launch, hinged up for rendezvous
  const hinge = new THREE.Group();
  hinge.position.set(0.05, 0.95, 0);
  const cone = rot(lathe(mats.dragonWhite, [[0.01, -0.5], [0.55, -0.32], [0.92, -0.05], [0.96, 0.08], [0.01, 0.09]]));
  cone.position.set(-0.1, -0.95, 0);
  hinge.add(cone);
  g.add(hinge);

  // Trunk with body-mounted cells; carries the iROSA pair on CRS-35
  const trunkMat = mats.dragonTrunk.clone();
  trunkMat.side = THREE.DoubleSide;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1.85, 1.85, 2.9, 48, 1, true), trunkMat);
  trunk.rotation.z = -Math.PI / 2;
  trunk.position.x = 3.95 + 1.45;
  g.add(trunk);
  for (const s of [-1, 1]) g.add(box(mats.white, 1.0, 0.75, 3.2, [5.6, s * 0.55, 0]));
  for (let i = 0; i < 2; i++) {
    const a = i * Math.PI + Math.PI / 2;
    const fin = box(mats.dragonWhite, 1.1, 0.55, 0.06, [6.6, Math.cos(a) * 2.1, Math.sin(a) * 2.1]);
    fin.rotation.x = a;
    g.add(fin);
  }
  const thrusters = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const p = new THREE.Vector3(2.2, Math.cos(a) * 1.55, Math.sin(a) * 1.55);
    g.add(box(mats.darkMetal, 0.35, 0.18, 0.25, p.toArray()));
    thrusters.push(p.clone().addScaledVector(new THREE.Vector3(0, Math.cos(a), Math.sin(a)), 0.3));
  }
  /** 0 = closed (launch), 1 = open (rendezvous) */
  const setNose = (f) => { hinge.rotation.z = THREE.MathUtils.degToRad(-105 * f); };
  setNose(0);
  return { group: shadowed(g), setNose, thrusters };
}

/** Additive exhaust plume, pointing down its local −y. Length/width are set per frame. */
export function makePlume(color = 0xffc58a, core = 0xffffff) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { c1: { value: new THREE.Color(core) }, c2: { value: new THREE.Color(color) }, intensity: { value: 1 }, time: { value: 0 } },
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 c1; uniform vec3 c2; uniform float intensity; uniform float time; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        float along = 1.0 - vUv.y;                 // 0 at nozzle, 1 at tail
        float edge = pow(abs(dot(normalize(vN), normalize(vV))), 0.8);
        float flick = 0.85 + 0.15 * sin(time * 40.0 + along * 30.0);
        float a = pow(1.0 - along, 1.6) * smoothstep(0.0, 0.6, edge) * flick;
        vec3 col = mix(c1, c2, smoothstep(0.0, 0.35, along));
        gl_FragColor = vec4(col * intensity * 3.0, a * intensity);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const geo = new THREE.ConeGeometry(1, 1, 24, 1, true);
  geo.translate(0, -0.5, 0);      // apex at the nozzle (y = 0), opening downward to y = −1
  const m = new THREE.Mesh(geo, mat);
  m.scale.set(1, 1, 1);
  m.renderOrder = 10;
  m.frustumCulled = false;
  m.userData.set = (len, width, k = 1, t = 0) => {
    m.visible = k > 0.01;
    m.scale.set(width, len, width);
    mat.uniforms.intensity.value = k;
    mat.uniforms.time.value = t;
  };
  return m;
}

export function buildFalcon9(mats) {
  const sooty = new THREE.MeshStandardMaterial({ color: 0xe9e9e6, roughness: 0.7, metalness: 0.05 });
  const soot = new THREE.MeshStandardMaterial({ color: 0x6b6a67, roughness: 0.9 });
  const black = new THREE.MeshStandardMaterial({ color: 0x18191b, roughness: 0.55, metalness: 0.3 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf4f4f2, roughness: 0.5 });
  const engineMat = new THREE.MeshStandardMaterial({ color: 0x4a4440, roughness: 0.4, metalness: 0.8 });

  // ── First stage (8th flight: sooty) ──
  const s1 = new THREE.Group();
  s1.name = 'Falcon 9 first stage';
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 40.6, 40), sooty);
  tank.position.y = 2.0 + 20.3;
  const sootBand = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.01, R + 0.01, 9, 40, 1, true), soot);
  sootBand.position.y = 2.0 + 4.5;
  const octaweb = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 0.95, 1.4, 40), black);
  octaweb.position.y = 1.4;
  const interstage = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 6.4, 40), black);
  interstage.position.y = 42.6 + 3.2;
  s1.add(tank, sootBand, octaweb, interstage);
  const bell = () => {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.45, 1.1, 16, 1, true), engineMat);
    b.material.side = THREE.DoubleSide;
    return b;
  };
  const merlins = [[0, 0]];
  for (let i = 0; i < 8; i++) merlins.push([Math.cos((i / 8) * Math.PI * 2) * 1.2, Math.sin((i / 8) * Math.PI * 2) * 1.2]);
  merlins.forEach(([x, z]) => { const b = bell(); b.position.set(x, 0.55, z); s1.add(b); });

  // Grid fins (stowed flat against the interstage, deployed after separation)
  const gridFins = [];
  const finGeo = new THREE.BoxGeometry(1.5, 1.2, 0.12);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const pivot = new THREE.Group();
    pivot.position.set(Math.cos(a) * R, 47.6, Math.sin(a) * R);
    pivot.rotation.y = -a;
    const fin = new THREE.Mesh(finGeo, new THREE.MeshStandardMaterial({ color: 0x2b2b2c, roughness: 0.6, metalness: 0.7 }));
    fin.position.set(0.1, 0, 0);
    pivot.add(fin);
    s1.add(pivot);
    gridFins.push({ pivot, fin });
  }

  // Landing legs: carbon-fibre, stowed up the side; deploy down and out about a base hinge
  const legs = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const pivot = new THREE.Group();
    pivot.position.set(Math.cos(a) * (R + 0.15), 2.2, Math.sin(a) * (R + 0.15));
    pivot.rotation.y = -a;
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.35, 9.5, 0.6), black);
    leg.position.y = 4.75;
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.2, 14), black);
    foot.position.y = 9.5;
    pivot.add(leg, foot);
    s1.add(pivot);
    legs.push(pivot);
  }

  // ── Second stage ──
  const s2 = new THREE.Group();
  s2.name = 'Falcon 9 second stage';
  const s2tank = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 12.2, 40), white);
  s2tank.position.y = 48.6 + 6.1;
  const mvac = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 1.55, 3.6, 28, 1, true), new THREE.MeshStandardMaterial({ color: 0x3a2f28, roughness: 0.35, metalness: 0.85, side: THREE.DoubleSide }));
  mvac.position.y = 48.6 - 1.8;
  s2.add(s2tank, mvac);

  // ── Dragon on top, nose up ──
  const dragon = buildDragon(mats);
  dragon.group.rotation.z = -Math.PI / 2;       // body +x → world −y: docking face up
  dragon.group.position.y = 68.4;
  s2.add(dragon.group);

  // Plumes
  const plumeS1 = makePlume(0xffb066);
  plumeS1.position.y = 0.0;
  s1.add(plumeS1);
  const plumeMVac = makePlume(0xb9c9ff, 0xffffff);
  plumeMVac.position.y = 45.0;
  s2.add(plumeMVac);
  const engineLight = new THREE.PointLight(0xffa860, 0, 3000, 1.2);
  engineLight.position.y = -25;
  s1.add(engineLight);

  const stack = new THREE.Group();
  stack.add(s1, s2);
  shadowed(stack);
  [plumeS1, plumeMVac].forEach((p) => { p.castShadow = false; p.receiveShadow = false; });

  return {
    stack, s1, s2, dragon, plumeS1, plumeMVac, engineLight,
    setLegs(f) { legs.forEach((p) => { p.rotation.x = 0; p.rotation.z = -THREE.MathUtils.degToRad(155 * f); }); },
    setFins(f) { gridFins.forEach(({ pivot }) => { pivot.rotation.z = THREE.MathUtils.degToRad(90 * f); }); },
  };
}

/** SLC-40 (simplified): launch mount, transporter-erector, crew access tower, lightning masts, lights. */
export function buildPad(mats) {
  const g = new THREE.Group();
  const concrete = new THREE.MeshStandardMaterial({ color: 0x8a8781, roughness: 0.95 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.5, metalness: 0.7 });
  g.add(box(concrete, 70, 1.2, 60, [0, -0.6, 0]));
  g.add(box(concrete, 14, 6, 14, [0, -3.0, 0]));                       // launch mount base
  g.add(box(new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 1 }), 12, 0.5, 40, [0, -0.2, 26])); // flame trench
  // Crew access tower (≈ 80 m) beside the vehicle
  const tb = new StrutBatch();
  const tx = -14, tz = 0, h = 80, w = 5;
  for (let y = 0; y < h; y += 5) {
    const c = [[-w, -w], [w, -w], [w, w], [-w, w]];
    for (let k = 0; k < 4; k++) {
      const a = new THREE.Vector3(tx + c[k][0], y, tz + c[k][1]);
      const b = new THREE.Vector3(tx + c[(k + 1) % 4][0], y, tz + c[(k + 1) % 4][1]);
      tb.add(a, b, 0.18);
      tb.add(a, a.clone().setY(y + 5), 0.3);
      tb.add(a, b.clone().setY(y + 5), 0.12);
    }
  }
  // Crew access arm, swung back
  tb.add(new THREE.Vector3(tx + w, 62, 0), new THREE.Vector3(tx + w + 3, 62, -7), 0.6);
  g.add(tb.build(steel, 6));
  // Transporter-erector, retracted and tilted away before launch
  const te = new StrutBatch();
  for (let i = 0; i < 14; i++) {
    const y0 = i * 5, y1 = y0 + 5;
    for (const s of [-1.8, 1.8]) te.add(new THREE.Vector3(5.5, y0, s), new THREE.Vector3(5.5, y1, s), 0.25);
    te.add(new THREE.Vector3(5.5, y0, -1.8), new THREE.Vector3(5.5, y1, 1.8), 0.12);
  }
  const teMesh = te.build(steel, 6);
  teMesh.position.set(2, 0, 0);
  teMesh.rotation.z = -THREE.MathUtils.degToRad(12);
  g.add(teMesh);
  // Lightning protection masts with catenary wires
  const masts = [[-45, -40], [45, -40], [-45, 40], [45, 40]];
  const mb = new StrutBatch();
  masts.forEach(([x, z]) => mb.add(new THREE.Vector3(x, 0, z), new THREE.Vector3(x, 110, z), 0.7));
  g.add(mb.build(steel, 8));
  const wireMat = new THREE.LineBasicMaterial({ color: 0x777777, transparent: true, opacity: 0.5 });
  for (let i = 0; i < 4; i++) {
    const [x1, z1] = masts[i], [x2, z2] = masts[(i + 1) % 4];
    const pts = [];
    for (let k = 0; k <= 20; k++) {
      const s = k / 20;
      pts.push(new THREE.Vector3(x1 + (x2 - x1) * s, 110 - 25 * Math.sin(Math.PI * s), z1 + (z2 - z1) * s));
    }
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireMat));
  }
  // Pad floodlights (pre-dawn launch)
  const lights = [];
  [[-30, -30], [30, -30], [-30, 30], [30, 30]].forEach(([x, z]) => {
    const l = new THREE.SpotLight(0xdde6ff, 4000, 400, 0.6, 0.5, 1.6);
    l.position.set(x, 30, z);
    l.target.position.set(0, 35, 0);
    g.add(l, l.target, box(new THREE.MeshBasicMaterial({ color: 0xeef3ff }), 1.5, 1.0, 1.5, [x, 30, z]));
    lights.push(l);
  });
  shadowed(g);
  return { group: g, lights };
}

/** Landing zone: concrete pad with the SpaceX X and edge lights. */
export function buildLandingZone() {
  const g = new THREE.Group();
  const pad = new THREE.Mesh(new THREE.CircleGeometry(45, 64), new THREE.MeshStandardMaterial({ color: 0x7d7a74, roughness: 0.95 }));
  pad.rotation.x = -Math.PI / 2;
  pad.position.y = 0.05;
  g.add(pad);
  const mark = new THREE.MeshBasicMaterial({ color: 0xf2f2f2 });
  for (const a of [Math.PI / 4, -Math.PI / 4]) {
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(50, 4), mark);
    bar.rotation.set(-Math.PI / 2, 0, a);
    bar.position.y = 0.08;
    g.add(bar);
  }
  const ring = new THREE.Mesh(new THREE.RingGeometry(30, 32, 64), mark);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.07;
  g.add(ring);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    g.add(box(new THREE.MeshBasicMaterial({ color: 0xffc070 }), 0.6, 0.6, 0.6, [Math.cos(a) * 46, 0.3, Math.sin(a) * 46]));
  }
  g.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
  return g;
}
