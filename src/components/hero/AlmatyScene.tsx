// Almaty in 3D, drawn as an instrument would see it.
//
// The basin and the Zailiysky Alatau to its south as a topographic surface —
// dark ground, glowing contour lines every 150 m, a faint survey grid. City
// lights fill the basin. Each station of the network stands where it really
// stands (lat/lng → km), as a beam with a pulsing ground ring in its own
// band colour; a screen-space callout carries its name and reading. Over the
// basin hangs the smog: a slow particle volume whose density is today's PM2.5
// and whose colour is the verdict. Scrolling flies the camera toward the
// mountains; the pointer leans it.
//
// 1 unit = 1 km. x → east, z → south (mountains at +z), y → up (exaggerated).

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { hasFinePointer, prefersReducedMotion } from '../../lib/motion';

export interface SceneStation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  /** Hex colour of the station's band. */
  color: string;
  value: string;
  isDemo: boolean;
}

interface Props {
  stations: SceneStation[];
  /** PM2.5 driving smog density. */
  pm: number | null;
  /** Hex status colour for smog and contours. */
  color: string;
  /** Scroll progress 0..1 through the hero, written by the parent. */
  progress: { current: number };
  className?: string;
}

const CENTER = { lat: 43.25, lng: 76.92 };
const KM_LAT = 111.2;
const KM_LNG = 111.2 * Math.cos((CENTER.lat * Math.PI) / 180);

export function toScene(lat: number, lng: number): { x: number; z: number } {
  return { x: (lng - CENTER.lng) * KM_LNG, z: (CENTER.lat - lat) * KM_LAT };
}

// ── Terrain height ───────────────────────────────────────────────────────
function hash(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, y: number, oct = 5): number {
  let s = 0;
  let a = 0.5;
  let f = 1;
  for (let i = 0; i < oct; i++) {
    s += a * vnoise(x * f, y * f);
    f *= 2.03;
    a *= 0.5;
  }
  return s;
}
function ridged(x: number, y: number): number {
  let s = 0;
  let a = 0.5;
  let f = 1;
  for (let i = 0; i < 4; i++) {
    const n = 1 - Math.abs(vnoise(x * f, y * f) * 2 - 1);
    s += a * n * n;
    f *= 2.1;
    a *= 0.5;
  }
  return s;
}
const smooth = (a: number, b: number, t: number) => {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
};

export function heightAt(x: number, z: number): number {
  // The basin tilts gently up toward the foothills.
  let h = 0.12 * fbm(x * 0.15, z * 0.15, 3) + Math.max(0, z) * 0.03;
  // The range: rises steeply south of ~43.19°N, highest in the east (Talgar).
  const range = smooth(5, 13, z + Math.sin(x * 0.18) * 1.5);
  const crest = 5.0 + 3.0 * fbm(x * 0.08 + 3, z * 0.08, 3) + 1.6 * smooth(-10, 25, x);
  h += range * (crest * (0.45 + 0.95 * ridged(x * 0.14, z * 0.14)));
  // Foothill folds.
  h += smooth(1, 8, z) * (1 - range) * 0.5 * fbm(x * 0.3, z * 0.3, 3);
  return h;
}

// ── Shaders ──────────────────────────────────────────────────────────────
const terrainVert = /* glsl */ `
  varying float vH;
  varying vec3 vWorld;
  varying vec3 vN;
  void main() {
    vH = position.y;
    vN = normalize(mat3(modelMatrix) * normal);
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
const terrainFrag = /* glsl */ `
  uniform vec3 uAccent;
  uniform vec3 uCam;
  uniform float uTime;
  uniform float uSmog;
  varying float vH;
  varying vec3 vWorld;
  varying vec3 vN;

  float line(float v, float w) {
    float d = fwidth(v);
    float f = abs(fract(v - 0.5) - 0.5) / max(d, 1e-4);
    return 1.0 - min(f / w, 1.0);
  }
  float grid2(vec2 v, float w) {
    vec2 d = fwidth(v);
    vec2 f = abs(fract(v - 0.5) - 0.5) / max(d, vec2(1e-4));
    return 1.0 - min(min(f.x, f.y) / w, 1.0);
  }

  void main() {
    // Contours every 0.15 units (≈150 m), a heavier one every 5.
    float c = line(vH / 0.15, 1.0);
    float C = line(vH / 0.75, 1.4);
    // Survey grid every 2 km.
    float g = grid2(vWorld.xz / 2.0, 0.8) * 0.3;
    // Low sun from the west-north-west: ridges split into lit and shadowed faces.
    float diff = clamp(dot(normalize(vN), normalize(vec3(-0.7, 0.55, -0.35))), 0.0, 1.0);
    float rim = pow(1.0 - clamp(normalize(vN).y, 0.0, 1.0), 1.5);

    float dist = length(vWorld - uCam);
    float fade = exp(-dist * 0.017);

    // Ground: near-black, a little lift on the high slopes (snow catching light).
    vec3 ground = mix(vec3(0.018, 0.02, 0.026), vec3(0.09, 0.095, 0.11), smoothstep(2.5, 8.0, vH));
    ground *= 0.35 + 1.4 * diff;
    ground += vec3(0.05, 0.055, 0.07) * rim * smoothstep(1.0, 4.0, vH);
    // Lines: white in the mountains, tinted by the air down in the basin where the smog sits.
    float basin = 1.0 - smoothstep(0.4, 2.6, vH);
    vec3 lineCol = mix(vec3(0.85, 0.88, 0.95), uAccent, basin * (0.35 + 0.65 * uSmog));
    // A slow scan band sweeping north → south.
    float scan = smoothstep(0.0, 0.6, 1.0 - abs(fract(vWorld.z * 0.03 - uTime * 0.05) - 0.5) * 8.0);

    float lines = (c * 0.28 + C * 0.6) * (0.45 + 0.8 * diff) + g;
    vec3 col = ground + lineCol * lines * (0.55 + 0.45 * scan);
    col += uAccent * scan * 0.04 * basin;
    gl_FragColor = vec4(col * fade + vec3(0.02, 0.022, 0.03) * (1.0 - fade), mix(0.55, 1.0, fade));
  }
`;

const pointsVert = /* glsl */ `
  attribute float aSize;
  attribute float aSeed;
  uniform float uTime;
  uniform float uPixel;
  uniform float uDrift;
  varying float vSeed;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    p.x += sin(uTime * 0.07 + aSeed * 6.28) * uDrift;
    p.y += sin(uTime * 0.2 + aSeed * 12.0) * uDrift * 0.15;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = min(aSize * uPixel / -mv.z, 40.0);
    vAlpha = clamp(1.4 - (-mv.z) / 60.0, 0.0, 1.0);
    vSeed = aSeed;
    gl_Position = projectionMatrix * mv;
  }
`;
const pointsFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uTime;
  uniform float uTwinkle;
  varying float vSeed;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    float tw = 1.0 - uTwinkle + uTwinkle * (0.5 + 0.5 * sin(uTime * 2.0 + vSeed * 40.0));
    gl_FragColor = vec4(uColor, a * uOpacity * vAlpha * tw);
  }
`;

function makePoints(
  count: number,
  place: (i: number) => [number, number, number] | null,
  size: [number, number],
  color: THREE.Color,
  opts: { opacity: number; twinkle: number; drift: number; pixel: number },
) {
  const pos: number[] = [];
  const sizes: number[] = [];
  const seeds: number[] = [];
  for (let i = 0; i < count * 3 && pos.length / 3 < count; i++) {
    const p = place(i);
    if (!p) continue;
    pos.push(...p);
    sizes.push(size[0] + Math.random() * (size[1] - size[0]));
    seeds.push(Math.random());
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1));
  geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));
  const mat = new THREE.ShaderMaterial({
    vertexShader: pointsVert,
    fragmentShader: pointsFrag,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: color },
      uOpacity: { value: opts.opacity },
      uTwinkle: { value: opts.twinkle },
      uDrift: { value: opts.drift },
      uPixel: { value: opts.pixel },
    },
  });
  return new THREE.Points(geo, mat);
}

// City districts as light clusters: centre (lat, lng), spread km, weight.
const CLUSTERS: [number, number, number, number][] = [
  [43.256, 76.929, 3.2, 1.4], // Алмалы, центр
  [43.238, 76.86, 3.5, 1.2], // Ауэзов
  [43.225, 76.92, 3.0, 1.0], // Бостандык
  [43.3, 76.95, 4.5, 0.9], // Жетысу
  [43.34, 76.985, 4.5, 0.8], // Турксиб
  [43.27, 76.82, 4.5, 0.8], // Алатау / Наурызбай
  [43.215, 76.96, 2.5, 0.6], // Медеу (низ)
];

export default function AlmatyScene({ stations, pm, color, progress, className = '' }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const live = useRef({ stations, pm, color });
  live.current = { stations, pm, color };

  useEffect(() => {
    const wrap = wrapRef.current;
    const labelLayer = labelsRef.current;
    if (!wrap || !labelLayer) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'high-performance' });
    } catch {
      wrap.dataset.nowebgl = '1';
      return;
    }
    const mobile = window.innerWidth < 768;
    const reduced = prefersReducedMotion();
    // Resolution is the cost here: the terrain shader runs once per pixel. Start
    // modest (contour lines are anti-aliased in the shader, so no MSAA either)
    // and let the governor below step it down on slower GPUs.
    // On a large laptop screen 1.5× is ~3.3 M pixels per frame, so start inside a
    // pixel budget; a GPU with headroom climbs back to full sharpness within a
    // few seconds (see govern), a slow one never pays for it.
    const budget = Math.sqrt(2.4e6 / Math.max(1, window.innerWidth * window.innerHeight));
    let quality = Math.min(window.devicePixelRatio, mobile ? 1.25 : 1.5, Math.max(0.75, budget));
    renderer.setPixelRatio(quality);
    renderer.setClearColor(0x000000, 0);
    wrap.insertBefore(renderer.domElement, wrap.firstChild);
    renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050608, 0.016);
    const camera = new THREE.PerspectiveCamera(mobile ? 62 : 46, 1, 0.1, 200);

    const accent = new THREE.Color(live.current.color);

    // Terrain
    const W = 80;
    const D = 64;
    const seg = mobile ? [100, 80] : [170, 136];
    const geo = new THREE.PlaneGeometry(W, D, seg[0], seg[1]);
    geo.rotateX(-Math.PI / 2);
    geo.translate(4, 0, 6);
    const pa = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pa.count; i++) pa.setY(i, heightAt(pa.getX(i), pa.getZ(i)));
    geo.computeVertexNormals();
    const terrainMat = new THREE.ShaderMaterial({
      vertexShader: terrainVert,
      fragmentShader: terrainFrag,
      uniforms: {
        uAccent: { value: accent },
        uCam: { value: new THREE.Vector3() },
        uTime: { value: 0 },
        uSmog: { value: 0.5 },
      },
      transparent: true,
      extensions: { derivatives: true } as never,
    });
    scene.add(new THREE.Mesh(geo, terrainMat));

    const pixel = renderer.domElement.height || 800;

    // City lights
    const lights = makePoints(
      mobile ? 2200 : 4500,
      () => {
        const c = CLUSTERS[Math.floor(Math.random() * CLUSTERS.length)];
        if (Math.random() > c[3] / 1.4) return null;
        const p = toScene(c[0], c[1]);
        const r = c[2] * Math.sqrt(-2 * Math.log(Math.random() + 1e-6)) * 0.55;
        const a = Math.random() * Math.PI * 2;
        const x = p.x + Math.cos(a) * r;
        const z = p.z + Math.sin(a) * r * 0.8;
        if (z > 9) return null; // no city in the mountains
        return [x, heightAt(x, z) + 0.03, z];
      },
      [0.035, 0.1],
      new THREE.Color(1.0, 0.86, 0.7),
      { opacity: 0.9, twinkle: 0.35, drift: 0, pixel },
    );
    scene.add(lights);

    // Smog volume — rebuilt when PM changes notably.
    let smog: THREE.Points | null = null;
    let smogPm = -1;
    const buildSmog = (pmv: number | null) => {
      const v = pmv ?? 40;
      if (smog && Math.abs(v - smogPm) < 10) return;
      smogPm = v;
      if (smog) {
        scene.remove(smog);
        smog.geometry.dispose();
        (smog.material as THREE.Material).dispose();
      }
      const n = Math.round(Math.min(1, v / 150) * (mobile ? 1200 : 2600) + 200);
      smog = makePoints(
        n,
        () => {
          const x = (Math.random() - 0.5) * 50;
          const z = -18 + Math.random() * 28;
          const ground = heightAt(x, z);
          if (ground > 1.6) return null;
          return [x, ground + Math.pow(Math.random(), 2) * (0.6 + v / 120), z];
        },
        mobile ? [0.25, 0.6] : [0.45, 1.2],
        accent,
        { opacity: (mobile ? 0.6 : 1) * (0.05 + Math.min(0.1, v / 1500)), twinkle: 0, drift: 1.2, pixel },
      );
      scene.add(smog);
      terrainMat.uniforms.uSmog.value = Math.min(1, v / 75);
    };
    buildSmog(live.current.pm);

    // Stations
    const stationGroup = new THREE.Group();
    scene.add(stationGroup);
    const labels: { el: HTMLDivElement; pos: THREE.Vector3; flip?: boolean; on?: boolean }[] = [];
    const rings: THREE.Mesh[] = [];
    const buildStations = () => {
      stationGroup.clear();
      labelLayer.innerHTML = '';
      labels.length = 0;
      rings.length = 0;
      for (const s of live.current.stations) {
        const p = toScene(s.lat, s.lng);
        const y = heightAt(p.x, p.z);
        const col = new THREE.Color(s.isDemo ? s.color : '#ffffff');
        const beamH = s.isDemo ? 2.2 : 3.2;
        const beam = new THREE.Mesh(
          new THREE.CylinderGeometry(0.025, 0.025, beamH, 6, 1, true),
          new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
        );
        beam.position.set(p.x, y + beamH / 2, p.z);
        stationGroup.add(beam);
        const glow = new THREE.Mesh(
          new THREE.CylinderGeometry(0.16, 0.02, beamH, 12, 1, true),
          new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
        );
        glow.position.copy(beam.position);
        stationGroup.add(glow);
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.35, 0.4, 48),
          new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(p.x, y + 0.04, p.z);
        ring.userData.phase = Math.random();
        stationGroup.add(ring);
        rings.push(ring);

        const el = document.createElement('div');
        el.className = 'scene-label';
        const dot = document.createElement('span');
        dot.className = 'scene-label__dot';
        dot.style.background = s.isDemo ? s.color : '#fff';
        const name = document.createElement('span');
        name.className = 'scene-label__name';
        name.textContent = s.name;
        const val = document.createElement('span');
        val.className = 'scene-label__val';
        val.textContent = s.isDemo ? s.value : `${s.value} · железо`;
        el.append(dot, name, val);
        labelLayer.appendChild(el);
        labels.push({ el, pos: new THREE.Vector3(p.x, y + beamH + 0.15, p.z) });
      }
    };
    buildStations();
    let stationKey = live.current.stations.map((s) => s.id + s.value + s.color).join('|');

    // Sizing
    const resize = () => {
      const r = wrap.getBoundingClientRect();
      renderer.setSize(r.width, r.height, false);
      camera.aspect = r.width / Math.max(1, r.height);
      camera.updateProjectionMatrix();
      const px = r.height * renderer.getPixelRatio();
      for (const pts of [lights, smog]) if (pts) (pts.material as THREE.ShaderMaterial).uniforms.uPixel.value = px;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    // Pointer lean
    const lean = { x: 0, y: 0, tx: 0, ty: 0 };
    const onMove = (e: PointerEvent) => {
      lean.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      lean.ty = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    if (hasFinePointer() && !reduced) window.addEventListener('pointermove', onMove, { passive: true });

    // Camera path: from over the northern city, looking south at the range,
    // toward the foothills as the page scrolls.
    // Look target sits west of the city on desktop so the scene lands in the
    // right half, clear of the headline.
    // (Looking south, east is screen-left, so an eastward target pushes the
    // city to the right.)
    const off = mobile ? 0 : 8;
    const camFrom = new THREE.Vector3(-2, 7.0, -24);
    const camTo = new THREE.Vector3(2, 4.0, -6);
    const lookFrom = new THREE.Vector3(off, 1.6, 6);
    const lookTo = new THREE.Vector3(off + 2, 3.6, 16);
    const camPos = new THREE.Vector3();
    const look = new THREE.Vector3();
    const proj = new THREE.Vector3();

    let visible = true;
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !reduced) loop();
    });
    io.observe(wrap);

    let raf = 0;
    const t0 = performance.now();
    let targetHex = live.current.color;
    const targetColor = new THREE.Color(targetHex);

    // Frame-time governor: if frames run long for a couple of seconds, render
    // at a lower resolution (down to 0.6×); if there is headroom, step back up.
    let acc = 0;
    let frames = 0;
    let steppedDown = false;
    let lastT = performance.now();
    const govern = () => {
      const now = performance.now();
      const dt = now - lastT;
      lastT = now;
      if (dt > 250) return; // tab switch or a stall, not steady load
      acc += dt;
      frames++;
      if (acc < 1500) return;
      const avg = acc / frames;
      acc = 0;
      frames = 0;
      const max = Math.min(window.devicePixelRatio, mobile ? 1.25 : 1.5);
      let next = quality;
      if (avg > 21) {
        next = Math.max(0.6, quality * 0.85);
        steppedDown = true;
      } else if (!steppedDown && avg < 17.5 && quality < max) next = Math.min(max, quality * 1.1);
      if (Math.abs(next - quality) > 0.02) {
        quality = next;
        renderer.setPixelRatio(quality);
        resize();
      }
    };
    const frame = () => {
      const t = reduced ? 8 : (performance.now() - t0) / 1000;

      // Live data changes
      const cur = live.current;
      if (cur.color !== targetHex) {
        targetHex = cur.color;
        targetColor.set(cur.color);
      }
      if (!accent.equals(targetColor)) accent.lerp(targetColor, 0.05);
      buildSmog(cur.pm);
      const key = cur.stations.map((s) => s.id + s.value + s.color).join('|');
      if (key !== stationKey) {
        stationKey = key;
        buildStations();
      }

      const k = Math.min(1, Math.max(0, progress.current));
      const e = k * k * (3 - 2 * k);
      lean.x += (lean.tx - lean.x) * 0.04;
      lean.y += (lean.ty - lean.y) * 0.04;
      camPos.lerpVectors(camFrom, camTo, e);
      camPos.x += Math.sin(t * 0.05) * 1.5 + lean.x * 1.6;
      camPos.y += -lean.y * 0.6;
      look.lerpVectors(lookFrom, lookTo, e);
      camera.position.copy(camPos);
      camera.lookAt(look);

      terrainMat.uniforms.uTime.value = t;
      terrainMat.uniforms.uCam.value.copy(camPos);
      for (const pts of [lights, smog]) if (pts) (pts.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
      for (const r of rings) {
        const ph = (t * 0.5 + r.userData.phase) % 1;
        r.scale.setScalar(1 + ph * 3);
        (r.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - ph);
      }

      renderer.render(scene, camera);

      // Callouts follow their beams in screen space.
      const w = renderer.domElement.clientWidth;
      const h = renderer.domElement.clientHeight;
      for (const l of labels) {
        proj.copy(l.pos).project(camera);
        const onScreen = proj.z < 1 && Math.abs(proj.x) < 1.05 && Math.abs(proj.y) < 1.05;
        const sx = ((proj.x + 1) / 2) * w;
        const sy = ((1 - proj.y) / 2) * h;
        // Near the right edge the callout flips to the beam's left side.
        const flip = sx > w - 260;
        if (l.flip !== flip) {
          l.flip = flip;
          l.el.classList.toggle('is-flipped', flip);
        }
        if (l.on !== onScreen) {
          l.on = onScreen;
          l.el.style.opacity = onScreen ? '1' : '0';
        }
        l.el.style.transform = `translate3d(${sx}px, ${sy}px, 0)${flip ? ' translateX(-100%)' : ''}`;
      }
    };
    const loop = () => {
      cancelAnimationFrame(raf);
      lastT = performance.now();
      let lastDraw = 0;
      const tick = (now: number = performance.now()) => {
        if (visible && !reduced) raf = requestAnimationFrame(tick);
        // 60 fps is the ceiling. A 120 Hz laptop screen would otherwise make
        // the GPU draw the whole terrain twice as often for motion this slow.
        if (now - lastDraw < 15) return;
        lastDraw = now;
        frame();
        govern();
      };
      tick();
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener('pointermove', onMove);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
      labelLayer.innerHTML = '';
    };
  }, [progress]);

  return (
    <div
      ref={wrapRef}
      className={`overflow-hidden ${className || 'relative'}`}
      // A glow on the horizon behind the range, in the colour of the air:
      // the mountains read as a dark silhouette against a polluted sky.
      style={{
        background: `radial-gradient(70% 45% at 62% 40%, ${color}2e, transparent 70%), radial-gradient(40% 30% at 62% 42%, ${color}24, transparent 70%), #050608`,
      }}
    >
      <div ref={labelsRef} className="pointer-events-none absolute inset-0" aria-hidden="true" />
    </div>
  );
}
