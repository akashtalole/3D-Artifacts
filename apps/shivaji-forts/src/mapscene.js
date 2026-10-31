/**
 * Overview relief of the Sahyadri and Konkan coast (units: km, height ×8).
 * Elevation from Terrarium tiles at zoom 8 (~0.6 km/px); sea depth from the same data.
 * No political boundaries are drawn — only terrain, coast, forts and a few reference cities.
 */
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { loadDem, latLonToPix } from './dem.js';

export const EXAG = 8;
const STRIDE = 2;

export async function buildMap(meta, url, forts, cities) {
  const dem = await loadDem(url);
  const kmPerPx = (156543.03392 * Math.cos((18.3 * Math.PI) / 180)) / 2 ** meta.z / 1000;
  const W = Math.floor(dem.w / STRIDE), H = Math.floor(dem.h / STRIDE);
  const cx = dem.w / 2, cy = dem.h / 2;
  const toXZ = (px, py) => [(px - cx) * kmPerPx, (py - cy) * kmPerPx];
  const height = (e) => (e > 0 ? (e / 1000) * EXAG : (Math.max(e, -400) / 1000) * EXAG * 0.6);

  const group = new THREE.Group();
  const pos = new Float32Array(W * H * 3), col = new Float32Array(W * H * 3);
  const stops = [[-400, '#0b2e4f'], [-60, '#14507a'], [-5, '#2a7aa8'], [0, '#c9b98a'], [30, '#6f9a48'], [200, '#4f8236'], [500, '#6d8a3e'], [800, '#93884f'], [1100, '#a58a5c'], [1500, '#c7b08a']].map(([e, c]) => [e, new THREE.Color(c)]);
  const tmp = new THREE.Color();
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const px = i * STRIDE + 0.5, py = j * STRIDE + 0.5, e = dem.sample(px, py), k = j * W + i;
    const [x, z] = toXZ(px, py);
    pos.set([x, height(e), z], k * 3);
    let s = 0; while (s < stops.length - 2 && e > stops[s + 1][0]) s++;
    const t = Math.min(1, Math.max(0, (e - stops[s][0]) / (stops[s + 1][0] - stops[s][0])));
    tmp.copy(stops[s][1]).lerp(stops[s + 1][1], t);
    col.set([tmp.r, tmp.g, tmp.b], k * 3);
  }
  const idx = new Uint32Array((W - 1) * (H - 1) * 6); let q = 0;
  for (let j = 0; j < H - 1; j++) for (let i = 0; i < W - 1; i++) { const a = j * W + i, b = a + 1, c = a + W, d = c + 1; idx.set([a, c, b, b, c, d], q); q += 6; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  mesh.receiveShadow = true; group.add(mesh);
  // gentle sea surface
  const seaM = new THREE.Mesh(new THREE.PlaneGeometry(dem.w * kmPerPx * 1.6, dem.h * kmPerPx * 1.3).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#1f6a96', transparent: true, opacity: 0.55, roughness: 0.25, metalness: 0.1 }));
  seaM.position.y = 0.02; group.add(seaM);

  const at = (lat, lon) => {
    const [gx, gy] = latLonToPix(lat, lon, meta.z), px = gx - meta.x0, py = gy - meta.y0;
    const [x, z] = toXZ(px, py);
    return new THREE.Vector3(x, height(dem.sample(px, py)), z);
  };

  // fort pins
  const pins = [];
  const flagTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 32; const g = c.getContext('2d'); g.fillStyle = '#ff7a00'; g.beginPath(); g.moveTo(0, 0); g.lineTo(64, 0); g.lineTo(44, 16); g.lineTo(64, 32); g.lineTo(0, 32); g.fill(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  for (const f of forts) {
    const p = at(f.lat, f.lon);
    const pin = new THREE.Group(); pin.position.copy(p);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 9, 6).translate(0, 4.5, 0), new THREE.MeshStandardMaterial({ color: '#f3e6cf', roughness: 0.6 }));
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(5, 2.5).translate(2.5, 0, 0), new THREE.MeshBasicMaterial({ map: flagTex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, toneMapped: false }));
    flag.position.y = 7.8;
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.8, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: f.kind === 'island' || f.kind === 'coastal' ? '#7fe3ff' : '#ffb347', transparent: true, opacity: 0.9, toneMapped: false }));
    ring.position.y = 0.3;
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 11, 8).translate(0, 5, 0), new THREE.MeshBasicMaterial({ visible: false }));
    hit.userData.fort = f.id;
    pin.add(pole, flag, ring, hit);
    const el = document.createElement('div'); el.className = 'pin'; el.dataset.fort = f.id;
    el.innerHTML = `<b>${f.mr}</b><span>${f.name}${f.unesco ? ' · <i>UNESCO</i>' : ''}</span>`;
    const l = new CSS2DObject(el); l.position.set(0, 11, 0); pin.add(l);
    group.add(pin);
    pins.push({ id: f.id, pin, flag, ring, hit, el, p });
  }
  for (const [name, lat, lon] of cities) {
    const p = at(lat, lon);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 8), new THREE.MeshBasicMaterial({ color: '#f5f5f5' })); dot.position.copy(p).add(new THREE.Vector3(0, 0.5, 0)); group.add(dot);
    const el = document.createElement('div'); el.className = 'city'; el.textContent = name;
    const l = new CSS2DObject(el); l.position.copy(p).add(new THREE.Vector3(0, 2.5, 0)); group.add(l);
  }
  const size = { w: dem.w * kmPerPx, h: dem.h * kmPerPx };
  return {
    group, pins, size, at,
    update(t, active) {
      for (const p of pins) {
        const on = p.id === active;
        p.flag.rotation.y = Math.sin(t * 2 + p.p.x) * 0.25;
        p.ring.scale.setScalar(on ? 1.6 + Math.sin(t * 6) * 0.35 : 1);
        p.el.classList.toggle('on', on);
      }
    },
  };
}
