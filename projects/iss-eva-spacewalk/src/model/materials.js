import * as THREE from 'three';

/**
 * Procedural textures + shared materials. Everything is generated on a canvas at
 * start-up, so the project has no image assets to host.
 */

function canvasTexture(w, h, draw, { repeat = [1, 1], srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Deterministic PRNG so the station looks the same on every load.
function rng(seed = 7) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** Beta-cloth / MLI thermal blanket: off-white with quilting seams and soft wrinkles. */
function mliTexture(tint = [238, 236, 228]) {
  const r = rng(11);
  return canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = `rgb(${tint.join(',')})`;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      const x = r() * w, y = r() * h, rad = 8 + r() * 40;
      const grd = g.createRadialGradient(x, y, 0, x, y, rad);
      const d = r() > 0.5 ? 255 : 150;
      grd.addColorStop(0, `rgba(${d},${d},${d - 8},0.06)`);
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    g.strokeStyle = 'rgba(120,118,110,0.35)';
    g.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
      g.beginPath(); g.moveTo(0, (i * h) / 4); g.lineTo(w, (i * h) / 4); g.stroke();
    }
    g.lineWidth = 1.2;
    for (let i = 0; i <= 8; i++) {
      g.beginPath(); g.moveTo((i * w) / 8, 0); g.lineTo((i * w) / 8, h); g.stroke();
    }
    g.fillStyle = 'rgba(90,90,90,0.25)';
    for (let i = 0; i < 40; i++) g.fillRect(r() * w, r() * h, 3, 3); // quilting tacks
  }, { repeat: [3, 2] });
}

/** Original SAW blanket: amber/copper silicon cells in a fine silver grid. */
function sawCellTexture() {
  const r = rng(3);
  return canvasTexture(256, 256, (g, w, h) => {
    const n = 8;
    const cw = w / n, ch = h / n;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const k = 0.85 + r() * 0.2;
        g.fillStyle = `rgb(${Math.round(176 * k)},${Math.round(104 * k)},${Math.round(42 * k)})`;
        g.fillRect(i * cw, j * ch, cw, ch);
        g.fillStyle = 'rgba(255,220,160,0.10)';
        g.fillRect(i * cw + 2, j * ch + 2, cw * 0.45, ch - 4);
      }
    }
    g.strokeStyle = 'rgba(220,220,225,0.9)';
    g.lineWidth = 1.5;
    for (let i = 0; i <= n; i++) {
      g.beginPath(); g.moveTo(i * cw, 0); g.lineTo(i * cw, h); g.stroke();
      g.beginPath(); g.moveTo(0, j2(i)); g.lineTo(w, j2(i)); g.stroke();
    }
    function j2(i) { return i * ch; }
  });
}

/** iROSA blanket: dark blue-black cells. */
function irosaCellTexture() {
  const r = rng(5);
  return canvasTexture(256, 256, (g, w, h) => {
    const n = 8;
    const cw = w / n, ch = h / n;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const k = 0.8 + r() * 0.3;
        g.fillStyle = `rgb(${Math.round(18 * k)},${Math.round(30 * k)},${Math.round(62 * k)})`;
        g.fillRect(i * cw, j * ch, cw, ch);
      }
    }
    g.strokeStyle = 'rgba(150,160,180,0.55)';
    g.lineWidth = 1;
    for (let i = 0; i <= n; i++) {
      g.beginPath(); g.moveTo(i * cw, 0); g.lineTo(i * cw, h); g.stroke();
      g.beginPath(); g.moveTo(0, i * ch); g.lineTo(w, i * ch); g.stroke();
    }
  });
}

/** Radiator panels: bright white with panel joints. */
function radiatorTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#f2f3f1';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(110,115,120,0.6)';
    g.lineWidth = 3;
    for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(0, (i * h) / 4); g.lineTo(w, (i * h) / 4); g.stroke(); }
    g.lineWidth = 1;
    g.strokeStyle = 'rgba(160,165,170,0.35)';
    for (let i = 0; i <= 16; i++) { g.beginPath(); g.moveTo((i * w) / 16, 0); g.lineTo((i * w) / 16, h); g.stroke(); }
  });
}

/** Crew Dragon trunk: half solar cells, half white. */
function trunkTexture() {
  return canvasTexture(512, 128, (g, w, h) => {
    g.fillStyle = '#f4f4f2';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#141b2b';
    g.fillRect(0, 0, w / 2, h);
    g.strokeStyle = 'rgba(140,150,170,0.4)';
    for (let i = 0; i < 32; i++) { g.beginPath(); g.moveTo((i * w) / 64, 0); g.lineTo((i * w) / 64, h); g.stroke(); }
    for (let j = 0; j < 8; j++) { g.beginPath(); g.moveTo(0, (j * h) / 8); g.lineTo(w / 2, (j * h) / 8); g.stroke(); }
  });
}

/** Builds the material library once. */
export function createMaterials() {
  const mliTex = mliTexture();
  const mliRuTex = mliTexture([232, 233, 226]);
  const saw = sawCellTexture();
  const irosa = irosaCellTexture();
  const rad = radiatorTexture();

  const std = (o) => new THREE.MeshStandardMaterial(o);

  const m = {
    mli: std({ color: 0xffffff, map: mliTex, roughness: 0.82, metalness: 0.0 }),
    mliRu: std({ color: 0xf6f6ef, map: mliRuTex, roughness: 0.8, metalness: 0.0 }),
    beam: std({ color: 0xe9e2d0, map: mliTex, roughness: 0.95 }),
    metal: std({ color: 0xb9bec6, roughness: 0.38, metalness: 0.85 }),
    truss: std({ color: 0xc9ccd1, roughness: 0.45, metalness: 0.75 }),
    darkMetal: std({ color: 0x2d3138, roughness: 0.55, metalness: 0.6 }),
    ring: std({ color: 0x9aa1aa, roughness: 0.3, metalness: 0.9 }),
    gold: std({ color: 0xd2a447, roughness: 0.28, metalness: 1.0 }),
    kapton: std({ color: 0xc58b2c, roughness: 0.4, metalness: 0.8 }),
    handrail: std({ color: 0xd9a63a, roughness: 0.4, metalness: 0.5 }),
    white: std({ color: 0xf3f3f0, roughness: 0.6, metalness: 0.05 }),
    boxGray: std({ color: 0x8d939b, roughness: 0.6, metalness: 0.35 }),
    glass: std({ color: 0x0b1420, roughness: 0.04, metalness: 0.95, envMapIntensity: 1.6 }),
    sawFront: std({ color: 0xffffff, map: saw, roughness: 0.32, metalness: 0.45, side: THREE.FrontSide }),
    sawBack: std({ color: 0xd7d6cf, roughness: 0.9, metalness: 0.0 }),
    irosaFront: std({ color: 0xffffff, map: irosa, roughness: 0.25, metalness: 0.55 }),
    irosaBack: std({ color: 0xcfd0cc, roughness: 0.85 }),
    radiator: std({ color: 0xffffff, map: rad, roughness: 0.55, metalness: 0.05 }),
    soyuzGreen: std({ color: 0x7c8a6a, map: mliTex, roughness: 0.85 }),
    ruArray: std({ color: 0x1f2d4f, roughness: 0.3, metalness: 0.6 }),
    dragonWhite: std({ color: 0xf7f7f5, roughness: 0.35, metalness: 0.1 }),
    dragonTrunk: std({ color: 0xffffff, map: trunkTexture(), roughness: 0.35, metalness: 0.3 }),
    heatShield: std({ color: 0x24221f, roughness: 0.9 }),
    battery: std({ color: 0xe9ecef, roughness: 0.5, metalness: 0.2 }),
    batteryOld: std({ color: 0x9a9fa7, roughness: 0.55, metalness: 0.4 }),
    canadarm: std({ color: 0xf2f2ef, roughness: 0.55, metalness: 0.05 }),
    tether: new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.85 }),
  };
  m.textures = { saw, irosa, rad };
  return m;
}

/** Clone a material with an independent texture repeat (textures share the image). */
export function withRepeat(mat, rx, ry) {
  const c = mat.clone();
  if (mat.map) {
    c.map = mat.map.clone();
    c.map.repeat.set(rx, ry);
    c.map.needsUpdate = true;
  }
  return c;
}
