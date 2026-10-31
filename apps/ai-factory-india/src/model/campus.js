/**
 * Campus layout (metres; x east, z south, y up). Illustrative design.
 *
 *   Substation (NW) ── 33 kV corridor ── 4 halls in a row ── pipe rack ── dry-cooler yard
 *   Solar field (E) · Admin / NOC + flag (SW) · Gensets north of the halls
 */
import * as THREE from 'three';
import { mat, glow, box, cyl, canvasTex, flowTube, label } from './kit.js';
import { buildHall, HALL } from './hall.js';

export const HALL_X = [-105, -35, 35, 105];
export const HALL_Z = -40;
export const HUB = new THREE.Vector3(-200, 12, 52);       // meet-me room / fibre hub (admin block)

let seed = 3;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function groundTexture() {
  const t = canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#8f6a4c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) {
      const c = rnd();
      g.fillStyle = c < 0.45 ? `rgba(120,${88 + rnd() * 30},60,0.18)` : c < 0.75 ? `rgba(${150 + rnd() * 30},${110 + rnd() * 20},70,0.16)` : `rgba(${100 + rnd() * 40},${110 + rnd() * 40},60,0.2)`;
      const r = 3 + rnd() * 26; g.beginPath(); g.arc(rnd() * w, rnd() * h, r, 0, Math.PI * 2); g.fill();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function buildCampus(scene) {
  const g = new THREE.Group();
  scene.add(g);
  const night = [];     // emissive materials that light up at night
  const nightMat = (color, k) => { const m = glow(color, 0).clone(); m.userData.night = k; night.push(m); return m; };

  // Ground: laterite soil and dry grass, then the levelled campus pad
  const gt = groundTexture(); gt.repeat.set(160, 160);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(30000, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: gt, roughness: 1 }));
  ground.receiveShadow = true; g.add(ground);
  const pt = canvasTex(512, 512, (c, w, h) => { c.fillStyle = '#8b847a'; c.fillRect(0, 0, w, h); for (let i = 0; i < 3000; i++) { c.fillStyle = `rgba(${rnd() < 0.5 ? 80 : 200},${rnd() < 0.5 ? 75 : 190},70,0.08)`; c.fillRect(rnd() * w, rnd() * h, 3, 3); } });
  pt.wrapS = pt.wrapT = THREE.RepeatWrapping; pt.repeat.set(20, 14);
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(700, 340).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: pt, roughness: 0.95 }));
  pad.position.set(55, 0.05, -20); pad.receiveShadow = true; g.add(pad);

  // Roads (ring road + gate road) and street lights
  const asphalt = mat('#3a3b3d', 0.9);
  const road = (x0, z0, x1, z1, wd = 8) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const m = box(len + wd, 0.06, wd, asphalt, (x0 + x1) / 2, 0.1, (z0 + z1) / 2, g);
    m.rotation.y = -Math.atan2(z1 - z0, x1 - x0); m.receiveShadow = true;
  };
  road(-160, -110, 160, -110); road(-160, 70, 160, 70); road(-160, -110, -160, 70); road(160, -110, 160, 70);
  road(-200, 145, -200, 70); road(-200, 70, -160, 70); road(-160, -110, -220, -110);
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.15, 9, 6).translate(0, 4.5, 0);
  const lampMat = nightMat('#ffd9a0', 6);
  const poles = []; for (let x = -150; x <= 150; x += 25) { poles.push([x, -116], [x, 76]); } for (let z = -95; z <= 60; z += 25) poles.push([-166, z], [166, z]);
  const pm = new THREE.InstancedMesh(poleGeo, mat('#6b6f75', 0.5, 0.6), poles.length);
  const lm = new THREE.InstancedMesh(new THREE.SphereGeometry(0.45, 8, 6), lampMat, poles.length);
  const m4 = new THREE.Matrix4();
  poles.forEach(([x, z], i) => { m4.makeTranslation(x, 0, z); pm.setMatrixAt(i, m4); m4.makeTranslation(x, 9.1, z); lm.setMatrixAt(i, m4); });
  g.add(pm, lm);

  // Compound wall with gate
  const wall = mat('#e3d6bf', 0.9);
  const W = (x0, z0, x1, z1) => { const len = Math.hypot(x1 - x0, z1 - z0); const m = box(len, 2.6, 0.4, wall, (x0 + x1) / 2, 1.3, (z0 + z1) / 2, g); m.rotation.y = -Math.atan2(z1 - z0, x1 - x0); m.castShadow = true; };
  W(-300, -190, 410, -190); W(410, -190, 410, 150); W(-300, -190, -300, 150); W(-300, 150, -207, 150); W(-193, 150, 410, 150);
  for (const x of [-207, -193]) box(1.2, 4, 1.2, mat('#c9b48f', 0.8), x, 2, 150, g);

  // Halls
  const halls = HALL_X.map((x, i) => {
    const h = buildHall({ open: i === 0, name: 'ABCD'[i] });
    h.group.position.set(x, 0, HALL_Z); g.add(h.group);
    h.band.material.userData.night = 2.2; night.push(h.band.material);
    return h;
  });

  // Gensets (diesel, 48 h fuel) north of the halls
  const gen = new THREE.InstancedMesh(new THREE.BoxGeometry(2.6, 3, 12).translate(0, 1.5, 0), mat('#e2e4e0', 0.6, 0.3), 24);
  const stack = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.25, 2.5, 8).translate(0, 4.2, 0), mat('#4b4f55', 0.5, 0.7), 24);
  for (let i = 0; i < 24; i++) { m4.makeTranslation(-130 + i * 11.3, 0, -80); gen.setMatrixAt(i, m4); m4.makeTranslation(-130 + i * 11.3, 0, -84); stack.setMatrixAt(i, m4); }
  gen.castShadow = true; g.add(gen, stack);
  for (let i = 0; i < 4; i++) { const t = cyl(3, 4, mat('#d7d2c4', 0.6, 0.2), 140 + i * 0, 2, -125 + i * 8, g, 24); t.rotation.z = Math.PI / 2; t.castShadow = true; }   // fuel tanks

  // Substation 220 kV → 33 kV
  const sub = new THREE.Group(); sub.position.set(-225, 0, -125); g.add(sub);
  box(100, 0.1, 64, mat('#8d8a85', 1), 0, 0.06, 0, sub).receiveShadow = true;
  const steel = mat('#9aa0a6', 0.45, 0.8), insul = mat('#7a4a32', 0.6, 0.1);
  for (let i = 0; i < 3; i++) {
    const x = -24 + i * 24;
    const t = box(7, 5, 5, mat('#6e7781', 0.5, 0.5), x, 2.5, 8, sub); t.castShadow = true;
    for (let f = 0; f < 10; f++) box(0.12, 4, 1.4, mat('#5f6770', 0.5, 0.5), x - 3.2 + f * 0.7, 2.4, 11.2, sub);
    for (let b = 0; b < 3; b++) cyl(0.18, 2.8, insul, x - 2 + b * 2, 6.4, 7, sub, 10);
    cyl(0.9, 2, mat('#8b929a', 0.5, 0.5), x + 2.6, 6, 10, sub, 16).rotation.z = Math.PI / 2;      // conservator
  }
  for (let i = 0; i < 6; i++) {           // gantries
    const x = -40 + i * 16;
    for (const sz of [-1, 1]) box(0.5, 14, 0.5, steel, x, 7, -14 + sz * 3, sub);
    box(0.5, 0.6, 7, steel, x, 14, -14, sub);
    for (let b = 0; b < 3; b++) cyl(0.12, 1.6, insul, x, 13, -16 + b * 2, sub, 8);
  }
  for (let b = 0; b < 3; b++) { const bb = cyl(0.08, 80, mat('#c0c4c8', 0.4, 0.9), 0, 12.2, -16 + b * 2, sub, 6); bb.rotation.z = Math.PI / 2; }
  box(14, 4, 8, mat('#e8e2d4', 0.8), 38, 2, 22, sub).castShadow = true;
  label('<b>220 / 33 kV substation</b><span>grid connection · 3 power transformers</span>', sub, new THREE.Vector3(0, 18, 0), ['power', 'campus']);

  // Transmission line from the grid (to the north-west)
  const towers = [[-262, -142], [-330, -330], [-420, -560], [-520, -820], [-620, -1100], [-720, -1400]];
  const towerMat = mat('#a3a8ae', 0.5, 0.8);
  const arms = [];
  for (const [x, z] of towers) {
    const t = new THREE.Group(); t.position.set(x, 0, z); g.add(t);
    const hgt = 42;
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const leg = box(0.4, hgt, 0.4, towerMat, 0, hgt / 2, 0, t);
      leg.geometry = new THREE.CylinderGeometry(0.2, 0.35, hgt, 4); leg.position.set(sx * 2.2, hgt / 2, sz * 2.2);
      leg.rotation.set(sz * 0.07, 0, -sx * 0.07);
    }
    for (const yy of [hgt * 0.62, hgt * 0.78, hgt * 0.94]) { box(16, 0.5, 0.6, towerMat, 0, yy, 0, t).rotation.y = Math.atan2(towers[0][1] - z, towers[0][0] - x) + Math.PI / 2; }
    t.castShadow = true;
    arms.push(new THREE.Vector3(x, hgt * 0.78, z));
  }
  arms[0] = new THREE.Vector3(-245, 14, -139);
  for (let i = 0; i < arms.length - 1; i++) {
    const a = arms[i + 1], b = arms[i];
    const mid = a.clone().lerp(b, 0.5); mid.y -= a.distanceTo(b) * 0.03;
    g.add(flowTube([a, mid, b], { radius: 0.35, color: '#ffd34d', dash: 30, kind: 'power', opacity: 0.85, segments: 40 }));
  }
  // 33 kV corridor to the halls
  g.add(flowTube([[-225, 0.6, -105], [-160, 0.6, -98], [140, 0.6, -98]], { radius: 0.6, color: '#ffd34d', dash: 14, kind: 'power' }));
  for (const x of HALL_X) g.add(flowTube([[x - 20, 0.6, -98], [x - 20, 0.6, -63]], { radius: 0.5, color: '#ffd34d', dash: 10, kind: 'power' }));
  label('<b>33 kV feeders</b><span>≈ 22 MW to each hall</span>', g, new THREE.Vector3(-20, 6, -98), 'power');
  label('<b>Diesel generators</b><span>24 sets · N+1 · back-up for grid outages</span>', g, new THREE.Vector3(0, 8, -80), 'power');

  // Solar field east of the halls (tilted ~17° to the south)
  const tables = [];
  for (let x = 185; x <= 385; x += 22) for (let z = -170; z <= 50; z += 7.6) tables.push([x, z]);
  const st = canvasTex(256, 64, (c, w, h) => { c.fillStyle = '#1a2a4a'; c.fillRect(0, 0, w, h); c.strokeStyle = '#8fa5c8'; c.lineWidth = 1; for (let x = 0; x <= w; x += 16) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); } for (let y = 0; y <= h; y += 16) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); } });
  const panelGeo = new THREE.BoxGeometry(20, 0.08, 4).rotateX(17 * Math.PI / 180).translate(0, 1.8, 0);
  const panels = new THREE.InstancedMesh(panelGeo, new THREE.MeshStandardMaterial({ map: st, roughness: 0.22, metalness: 0.5 }), tables.length);
  tables.forEach(([x, z], i) => { m4.makeTranslation(x, 0, z); panels.setMatrixAt(i, m4); });
  panels.castShadow = true; panels.receiveShadow = true; g.add(panels);
  const solarMWp = tables.length * 20 * 4 * 0.21 / 1000;
  label(`<b>Solar field</b><span>${solarMWp.toFixed(1)} MWp · tilted 17° south</span>`, g, new THREE.Vector3(285, 12, -60), ['power', 'campus']);
  g.add(flowTube([[180, 0.6, -60], [160, 0.6, -98]], { radius: 0.5, color: '#ffd34d', dash: 10, kind: 'solar' }));

  // Pipe rack and dry-cooler yard south of the halls
  const blue = mat('#2c6bff', 0.4, 0.4), red = mat('#ff4a3d', 0.4, 0.4);
  for (let x = -140; x <= 140; x += 10) { box(0.4, 5.5, 0.4, steel, x, 2.75, 4, g); box(0.4, 5.5, 0.4, steel, x, 2.75, 8, g); box(0.4, 0.4, 4.4, steel, x, 5.4, 6, g); }
  for (const [z, m] of [[5, blue], [7, red]]) { const p = cyl(0.55, 284, m, 0, 6.1, z, g, 16); p.rotation.z = Math.PI / 2; p.castShadow = true; }
  g.add(flowTube([[-142, 6.1, 5], [142, 6.1, 5]], { radius: 0.3, color: '#4d94ff', dash: 12, kind: 'supply' }));
  g.add(flowTube([[142, 6.1, 7], [-142, 6.1, 7]], { radius: 0.3, color: '#ff6a4d', dash: 12, kind: 'return' }));
  for (const x of HALL_X) {
    for (const [dx, m, col, kind, zz] of [[-3, blue, '#4d94ff', 'supply', 5], [3, red, '#ff6a4d', 'return', 7]]) {
      const p = cyl(0.4, zz + 18, m, x + dx, 6.1, (zz - 18) / 2, g, 12); p.rotation.x = Math.PI / 2;
      const pts = [[x + dx, 6.1, zz], [x + dx, 6.1, -18]];
      g.add(flowTube(kind === 'supply' ? pts : pts.reverse(), { radius: 0.22, color: col, dash: 8, kind }));
    }
  }
  const coolerPos = [];
  for (const z of [26, 42]) for (let i = 0; i < 32; i++) coolerPos.push([-131 + i * 8.45, z]);
  const coil = canvasTex(64, 64, (c, w, h) => { c.fillStyle = '#7d8790'; c.fillRect(0, 0, w, h); c.fillStyle = '#5c656e'; for (let x = 0; x < w; x += 3) c.fillRect(x, 0, 1, h); }, true);
  coil.wrapS = coil.wrapT = THREE.RepeatWrapping; coil.repeat.set(8, 2);
  const cBody = new THREE.InstancedMesh(new THREE.BoxGeometry(2.4, 2.6, 12).translate(0, 2.6, 0), new THREE.MeshStandardMaterial({ map: coil, roughness: 0.6, metalness: 0.5 }), coolerPos.length);
  const cLegs = new THREE.InstancedMesh(new THREE.BoxGeometry(2.2, 1.3, 11.6).translate(0, 0.65, 0), mat('#5b6067', 0.6, 0.6), coolerPos.length);
  const fanR = 0.95;
  const fanHousing = new THREE.InstancedMesh(new THREE.CylinderGeometry(fanR + 0.08, fanR + 0.08, 0.35, 20, 1, true).translate(0, 4.05, 0), mat('#3b4047', 0.5, 0.6), coolerPos.length * 5);
  const blades = new THREE.InstancedMesh(new THREE.BoxGeometry(fanR * 1.9, 0.04, 0.28), mat('#1c1f23', 0.5, 0.4), coolerPos.length * 5 * 2);
  coolerPos.forEach(([x, z], i) => {
    m4.makeTranslation(x, 0, z); cBody.setMatrixAt(i, m4); cLegs.setMatrixAt(i, m4);
    for (let f = 0; f < 5; f++) { m4.makeTranslation(x, 0, z - 4.6 + f * 2.3); fanHousing.setMatrixAt(i * 5 + f, m4); }
  });
  cBody.castShadow = true; g.add(cBody, cLegs, fanHousing, blades);
  const fans = coolerPos.flatMap(([x, z]) => [0, 1, 2, 3, 4].map((f) => new THREE.Vector3(x, 4.1, z - 4.6 + f * 2.3)));
  const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
  let fanAngle = 0;
  function updateFans(dt, duty) {
    fanAngle += dt * duty * 12;
    fans.forEach((p, i) => {
      for (let b = 0; b < 2; b++) { q.setFromAxisAngle(up, fanAngle + b * Math.PI / 2 + i); m4.compose(p, q, one); blades.setMatrixAt(i * 2 + b, m4); }
    });
    blades.instanceMatrix.needsUpdate = true;
  }
  for (const z of [26, 42]) for (const [dx, col, kind] of [[-1.6, '#4d94ff', 'supply'], [1.6, '#ff6a4d', 'return']]) {
    const pts = [[-142, 0.8, z + dx], [142, 0.8, z + dx]];
    g.add(flowTube(kind === 'supply' ? pts.reverse() : pts, { radius: 0.25, color: col, dash: 12, kind }));
  }
  for (const [xx, dz, col, kind] of [[-144, 0, '#4d94ff', 'supply'], [144, 2, '#ff6a4d', 'return']]) {
    const pts = [[xx, 6.1, 5 + dz], [xx, 0.8, 18], [xx, 0.8, 44]];
    g.add(flowTube(kind === 'supply' ? pts.reverse() : pts, { radius: 0.25, color: col, dash: 12, kind }));
  }
  // adiabatic mist (visible only when assist is active)
  const mistN = 1500, mp = new Float32Array(mistN * 3);
  for (let i = 0; i < mistN; i++) { const c = coolerPos[i % coolerPos.length]; mp.set([c[0] + (rnd() - 0.5) * 3.4, 1 + rnd() * 3, c[1] + (rnd() - 0.5) * 12], i * 3); }
  const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(mp, 3));
  const mist = new THREE.Points(mg, new THREE.PointsMaterial({ color: '#e8f4ff', size: 0.6, transparent: true, opacity: 0.0, depthWrite: false }));
  g.add(mist);
  label('<b>Dry coolers</b><span>64 units · reject heat to air · no chillers</span>', g, new THREE.Vector3(0, 9, 34), ['cooling', 'campus']);
  label('<b>Pipe rack</b><span>warm-water supply &amp; return</span>', g, new THREE.Vector3(-70, 9, 6), 'cooling');

  // Admin / NOC block, flag, parking
  const glassT = canvasTex(256, 128, (c, w, h) => { c.fillStyle = '#2e4a5e'; c.fillRect(0, 0, w, h); c.fillStyle = '#d7dde3'; for (let y = 0; y < h; y += 32) c.fillRect(0, y, w, 4); for (let x = 0; x < w; x += 24) c.fillRect(x, 0, 2, h); });
  const winEm = canvasTex(256, 128, (c, w, h) => { c.fillStyle = '#000'; c.fillRect(0, 0, w, h); for (let y = 4; y < h; y += 32) for (let x = 2; x < w; x += 24) if (rnd() < 0.7) { c.fillStyle = '#ffdca8'; c.fillRect(x, y, 22, 28); } });
  glassT.wrapS = winEm.wrapS = THREE.RepeatWrapping; glassT.repeat.x = winEm.repeat.x = 3;
  const adminMat = new THREE.MeshStandardMaterial({ map: glassT, emissiveMap: winEm, emissive: '#ffffff', emissiveIntensity: 0, roughness: 0.15, metalness: 0.6 });
  adminMat.userData.night = 1.4; night.push(adminMat);
  const admin = box(56, 12, 22, [adminMat, adminMat, mat('#cfcac0', 0.8), mat('#cfcac0'), adminMat, adminMat], -200, 6, 50, g); admin.castShadow = true;
  box(58, 0.6, 24, mat('#e8e4dc', 0.7), -200, 12.3, 50, g);
  label('<b>Admin · NOC · meet-me room</b><span>fibre to Mumbai &amp; Chennai landings</span>', g, new THREE.Vector3(-200, 18, 50), ['campus', 'tokens']);
  // Indian national flag (3:2), waving
  cyl(0.12, 14, mat('#e0e0e0', 0.3, 0.8), -200, 7, 88, g, 8);
  const flagTex = canvasTex(300, 200, (c, w, h) => {
    c.fillStyle = '#FF9933'; c.fillRect(0, 0, w, h / 3); c.fillStyle = '#ffffff'; c.fillRect(0, h / 3, w, h / 3); c.fillStyle = '#138808'; c.fillRect(0, 2 * h / 3, w, h / 3);
    c.strokeStyle = '#000080'; c.fillStyle = '#000080'; const cx = w / 2, cy = h / 2, r = h / 6 * 0.9;
    c.lineWidth = 2.5; c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke();
    c.lineWidth = 1.2; for (let i = 0; i < 24; i++) { const a = i * Math.PI / 12; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); c.stroke(); }
    c.beginPath(); c.arc(cx, cy, r * 0.18, 0, Math.PI * 2); c.fill();
  });
  const flagGeo = new THREE.PlaneGeometry(4.5, 3, 24, 8);
  const flag = new THREE.Mesh(flagGeo, new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide, roughness: 0.8 }));
  flag.position.set(-197.7, 12.4, 88); flag.castShadow = true; g.add(flag);
  const flagBase = flagGeo.attributes.position.array.slice();
  function updateFlag(t) {
    const a = flagGeo.attributes.position.array;
    for (let i = 0; i < a.length; i += 3) { const x = flagBase[i] + 2.25; a[i + 2] = Math.sin(x * 1.6 - t * 4) * 0.12 * x; a[i + 1] = flagBase[i + 1] - x * 0.03; }
    flagGeo.attributes.position.needsUpdate = true; flagGeo.computeVertexNormals();
  }
  const carCols = ['#e8e8e8', '#b8bcc2', '#2b2f36', '#8a1c1c', '#1f3f7a', '#d9d2c3'];
  const cars = new THREE.InstancedMesh(new THREE.BoxGeometry(1.8, 1.4, 4.3).translate(0, 0.7, 0), mat('#ffffff', 0.35, 0.6), 60);
  for (let i = 0; i < 60; i++) { m4.makeTranslation(-162 + (i % 15) * 2.8, 0.1, 82 + Math.floor(i / 15) * 7); cars.setMatrixAt(i, m4); cars.setColorAt(i, new THREE.Color(carCols[i % carCols.length])); }
  g.add(cars);

  // Trees: neem canopies and columnar Ashoka trees along the roads; Deccan granite boulders outside
  const treeSpots = [];
  for (let i = 0; i < 260; i++) {
    const side = rnd();
    const x = side < 0.5 ? -290 + rnd() * 690 : (rnd() < 0.5 ? -290 + rnd() * 20 : 380 + rnd() * 25);
    const z = side < 0.25 ? -185 + rnd() * 18 : side < 0.5 ? 125 + rnd() * 20 : -180 + rnd() * 320;
    treeSpots.push([x, z, 'neem']);
  }
  for (let x = -150; x <= 150; x += 12) treeSpots.push([x, 80, 'ashoka']);
  for (let z = 80; z <= 140; z += 9) treeSpots.push([-208, z, 'ashoka'], [-192, z, 'ashoka']);
  const neem = treeSpots.filter((t) => t[2] === 'neem'), ash = treeSpots.filter((t) => t[2] === 'ashoka');
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.35, 4, 6).translate(0, 2, 0), mat('#5a4636', 0.9), treeSpots.length);
  const canopy = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), mat('#ffffff', 0.9), neem.length);
  const cone = new THREE.InstancedMesh(new THREE.ConeGeometry(1.3, 9, 8).translate(0, 7, 0), mat('#ffffff', 0.9), ash.length);
  const s3 = new THREE.Vector3();
  treeSpots.forEach(([x, z], i) => { m4.makeTranslation(x, 0, z); trunk.setMatrixAt(i, m4); });
  neem.forEach(([x, z], i) => { const s = 3 + rnd() * 3; s3.set(s, s * 0.75, s); m4.compose(new THREE.Vector3(x, 4 + s * 0.5, z), q.identity(), s3); canopy.setMatrixAt(i, m4); canopy.setColorAt(i, new THREE.Color().setHSL(0.24 + rnd() * 0.06, 0.45, 0.22 + rnd() * 0.08)); });
  ash.forEach(([x, z], i) => { m4.makeTranslation(x, 0, z); cone.setMatrixAt(i, m4); cone.setColorAt(i, new THREE.Color().setHSL(0.3, 0.5, 0.18 + rnd() * 0.05)); });
  trunk.castShadow = canopy.castShadow = cone.castShadow = true;
  g.add(trunk, canopy, cone);
  const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), mat('#a39388', 0.85), 220);
  for (let i = 0; i < 220; i++) {
    const cl = Math.floor(i / 11), a = cl * 2.4 + 0.5, r = 450 + (cl * 97) % 500;
    const cx = Math.cos(a) * r + 50, cz = Math.sin(a) * r - 20;
    const s = 2 + rnd() * 7;
    s3.set(s * (0.8 + rnd() * 0.5), s * (0.6 + rnd() * 0.4), s * (0.8 + rnd() * 0.5));
    q.setFromEuler(new THREE.Euler(rnd() * 3, rnd() * 3, rnd() * 3));
    m4.compose(new THREE.Vector3(cx + (rnd() - 0.5) * 18, s * 0.5 + (i % 11 > 7 ? s : 0), cz + (rnd() - 0.5) * 18), q, s3);
    rocks.setMatrixAt(i, m4);
  }
  rocks.castShadow = true; g.add(rocks);
  // distant hills for the horizon
  const hills = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 7), mat('#7d6e60', 1), 40);
  for (let i = 0; i < 40; i++) { const a = rnd() * Math.PI * 2, r = 6000 + rnd() * 9000, s = 600 + rnd() * 1400; s3.set(s * 2, 120 + rnd() * 280, s * 2); m4.compose(new THREE.Vector3(Math.cos(a) * r, 40, Math.sin(a) * r), q.identity(), s3); hills.setMatrixAt(i, m4); }
  g.add(hills);

  // Campus labels for the 4 halls
  halls.forEach((h, i) => label(`<b>Hall ${'ABCD'[i]}</b><span>139 racks · ≈ 22 MW</span>`, h.group, new THREE.Vector3(0, 13, 0), 'campus'));

  return { group: g, halls, hallA: halls[0], solarMWp, night, mist, updateFans, updateFlag };
}
