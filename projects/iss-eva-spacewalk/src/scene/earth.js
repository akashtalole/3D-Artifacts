import * as THREE from 'three';
import { R_EARTH } from '../sim/orbit.js';

/**
 * Earth, atmosphere, stars and Sun, rendered in a separate "far" scene with its own
 * camera range (km-scale), so the metre-scale station keeps full depth precision.
 * Units here are metres too; the Earth's centre sits 6,786 km below the station.
 *
 * Textures (NASA Blue Marble derived, from the three.js examples) are fetched from a
 * CDN; until they arrive — or if they fail — a procedural planet is drawn.
 */

const TEX_BASE = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r170/examples/textures/planets/';

const earthVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  varying vec3 vObjN;
  void main() {
    vUv = uv;
    vObjN = normal;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vPosW = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const earthFragment = /* glsl */ `
  uniform sampler2D dayMap;
  uniform sampler2D nightMap;
  uniform sampler2D brcMap;   // r: bump, g: roughness (ocean ≈ 0), b: clouds
  uniform float hasTex;
  uniform vec3 sunDir;
  uniform float cloudShift;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  varying vec3 vObjN;

  // Procedural fallback
  float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float noise(vec3 x) {
    vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 6; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }

  void main() {
    vec3 n = normalize(vNormalW);
    vec3 V = normalize(cameraPosition - vPosW);
    float ndl = dot(n, sunDir);
    float day = smoothstep(-0.12, 0.18, ndl);

    vec3 dayCol; vec3 nightCol; float cloud; float water;
    if (hasTex > 0.5) {
      dayCol = texture2D(dayMap, vUv).rgb;
      nightCol = texture2D(nightMap, vUv).rgb;
      cloud = smoothstep(0.2, 1.0, texture2D(brcMap, vUv + vec2(cloudShift, 0.0)).b);
      water = 1.0 - smoothstep(0.02, 0.25, texture2D(brcMap, vUv).g);
      // Sub-texel detail so close-up views (Cupola, helmet cam) are not a smooth blur
      vec3 dp = normalize(vObjN) * 1400.0;
      float detail = noise(dp) * 0.5 + noise(dp * 2.7) * 0.3 + noise(dp * 7.1) * 0.2;
      dayCol *= mix(0.82, 1.18, detail * (1.0 - water * 0.7));
      cloud *= mix(0.75, 1.15, noise(dp * 0.6 + 11.0));
    } else {
      vec3 p = normalize(vObjN) * 2.2;
      float h = fbm(p * 1.6);
      float land = smoothstep(0.52, 0.56, h);
      float lat = abs(normalize(vObjN).y);
      vec3 ocean = mix(vec3(0.01, 0.05, 0.16), vec3(0.02, 0.12, 0.28), fbm(p * 4.0));
      vec3 ground = mix(vec3(0.16, 0.24, 0.08), vec3(0.42, 0.36, 0.22), fbm(p * 5.0 + 3.0));
      dayCol = mix(ocean, ground, land);
      dayCol = mix(dayCol, vec3(0.9), smoothstep(0.78, 0.86, lat));
      cloud = smoothstep(0.5, 0.75, fbm(p * 3.0 + vec3(cloudShift * 40.0, 0.0, 0.0)));
      water = 1.0 - land;
      nightCol = vec3(1.0, 0.75, 0.4) * land * step(0.8, hash(floor(p * 90.0))) * 0.6;
    }

    vec3 lit = dayCol * (0.02 + 0.95 * max(ndl, 0.0));
    lit = mix(lit, vec3(0.82) * (0.02 + 0.9 * max(ndl, 0.0)), cloud * 0.88);

    // Ocean sun-glint
    vec3 H = normalize(sunDir + V);
    float spec = pow(max(dot(n, H), 0.0), 70.0) * water * (1.0 - cloud) * day;
    lit += vec3(1.0, 0.92, 0.8) * spec * 1.4;

    // Twilight band — warm terminator
    float tw = smoothstep(-0.2, 0.0, ndl) * (1.0 - smoothstep(0.0, 0.22, ndl));
    lit += vec3(0.55, 0.22, 0.05) * tw * 0.25;

    // City lights on the night side
    vec3 city = pow(nightCol, vec3(1.3)) * (1.0 - day) * (1.0 - cloud * 0.85) * 2.2;

    // Rayleigh-ish blue haze toward the limb
    float fres = pow(1.0 - max(dot(n, V), 0.0), 3.0);
    vec3 haze = vec3(0.25, 0.5, 1.0) * fres * day * 0.6;

    gl_FragColor = vec4(lit * day + lit * (1.0 - day) * 0.02 + city + haze, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const atmoVertex = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vPosW = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const atmoFragment = /* glsl */ `
  uniform vec3 sunDir;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    vec3 n = normalize(vNormalW);
    vec3 V = normalize(cameraPosition - vPosW);
    float rim = pow(1.0 - abs(dot(n, V)), 5.0);
    float lit = smoothstep(-0.25, 0.35, dot(n, sunDir));
    vec3 col = mix(vec3(0.95, 0.45, 0.15), vec3(0.32, 0.62, 1.0), smoothstep(-0.05, 0.4, dot(n, sunDir)));
    gl_FragColor = vec4(col * rim * lit * 1.6, rim * lit);
    #include <colorspace_fragment>
  }
`;

export function createEarth() {
  const R = R_EARTH * 1000;
  const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  blank.needsUpdate = true;
  const uniforms = {
    dayMap: { value: blank },
    nightMap: { value: blank },
    brcMap: { value: blank },
    hasTex: { value: 0 },
    sunDir: { value: new THREE.Vector3(0, 1, 0) },
    cloudShift: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: earthVertex, fragmentShader: earthFragment });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(R, 160, 100), mat);
  earth.name = 'Earth';

  const atmoMat = new THREE.ShaderMaterial({
    uniforms: { sunDir: uniforms.sunDir },
    vertexShader: atmoVertex,
    fragmentShader: atmoFragment,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(R * 1.012, 160, 100), atmoMat);

  const group = new THREE.Group();
  group.add(earth, atmosphere);

  // Load textures; switch shader branch once the day map is in.
  const loader = new THREE.TextureLoader();
  const load = (name, srgb) => new Promise((res) => {
    loader.load(TEX_BASE + name, (t) => {
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      res(t);
    }, undefined, () => res(null));
  });
  const ready = Promise.all([
    load('earth_day_4096.jpg', true),
    load('earth_night_4096.jpg', true),
    load('earth_bump_roughness_clouds_4096.jpg', false),
  ]).then(([day, night, brc]) => {
    if (day && night && brc) {
      uniforms.dayMap.value = day;
      uniforms.nightMap.value = night;
      uniforms.brcMap.value = brc;
      uniforms.hasTex.value = 1;
      return true;
    }
    return false;
  });

  return { group, earth, uniforms, ready };
}

/** Star field + Sun glow, all at "infinity" around the camera. */
export function createSky() {
  const group = new THREE.Group();
  const N = 6000;
  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  const R = 5e7;
  let seed = 42;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < N; i++) {
    const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    pos.set([R * s * Math.cos(th), R * u, R * s * Math.sin(th)], i * 3);
    const t = rnd();
    const b = 0.35 + Math.pow(rnd(), 6) * 2.2;
    const c = t < 0.15 ? [1.0, 0.82, 0.7] : t < 0.35 ? [0.75, 0.85, 1.0] : [1, 1, 1];
    col.set(c.map((x) => x * b), i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const stars = new THREE.Points(geo, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, depthWrite: false }));
  group.add(stars);

  // Sun sprite: radial glow; Earth occludes it via the depth test at orbital night.
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.06, 'rgba(255,252,240,1)');
  grd.addColorStop(0.12, 'rgba(255,230,180,0.55)');
  grd.addColorStop(0.35, 'rgba(255,200,140,0.12)');
  grd.addColorStop(1, 'rgba(255,190,120,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, color: new THREE.Color(3, 3, 3) }));
  sun.scale.setScalar(9e6);
  group.add(sun);
  return { group, stars, sun };
}

/** Environment map: black sky above, blue Earth-lit glow below (for metal reflections). */
export function createEnvironment(renderer) {
  const scene = new THREE.Scene();
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec3 vP; void main(){
      float d = -vP.y;
      vec3 earth = mix(vec3(0.05,0.12,0.28), vec3(0.35,0.55,0.85), smoothstep(0.2, 1.0, d));
      vec3 col = mix(vec3(0.0), earth, smoothstep(-0.25, 0.35, d));
      col += vec3(1.0,0.95,0.85) * pow(max(dot(vP, normalize(vec3(0.4,0.8,0.3))),0.0), 64.0) * 4.0;
      gl_FragColor = vec4(col, 1.0); }`,
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), mat));
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(scene, 0.02).texture;
  pmrem.dispose();
  return env;
}
