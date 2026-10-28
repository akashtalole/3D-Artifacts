// Shared with projects/polyhouse-vertical-farm and projects/maharashtra-grid.
import * as THREE from 'three';
/** HTML labels that follow 3D points. Call set() each frame for the labels to show, then frame(). */
export function labeller(root, camera) {
  const els = new Map(), v = new THREE.Vector3();
  function set(id, pos, html, cls = '') {
    let e = els.get(id); if (!e) { e = document.createElement('div'); e.className = `lbl ${cls}`; root.appendChild(e); els.set(id, e); }
    e.dataset.live = '1'; if (e._h !== html) { e.innerHTML = html; e._h = html; } if (e._c !== cls) { e.className = `lbl ${cls}`; e._c = cls; } e._p = pos;
  }
  function frame(w, h, show = true) {
    for (const e of els.values()) {
      if (e.dataset.live !== '1' || !show) { e.style.display = 'none'; e.dataset.live = ''; continue; }
      v.copy(e._p).project(camera); e.dataset.live = '';
      if (v.z > 1 || v.x < -1.05 || v.x > 1.05 || v.y < -1.05 || v.y > 1.05) { e.style.display = 'none'; continue; }
      e.style.display = ''; e.style.left = `${((v.x + 1) / 2) * w}px`; e.style.top = `${((1 - v.y) / 2) * h}px`;
    }
  }
  function clear() { for (const e of els.values()) e.remove(); els.clear(); }
  return { set, frame, clear };
}
