import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clamp, ease, mix, MOUTH, sampleScene } from './performance.js';
import { Actor, blendedExpression } from './actor.js';
import { group, lathe, mesh, oval, surface, tube, vec } from './model.js';

export const LIGHTS = { auto: '随情绪', moon: '月光', amber: '暖金', rose: '绯红', cold: '冷蓝' };
export const CAMERAS = { auto: '自动', wide: '全景', medium: '中景', close: '特写' };
const looks = {
  moon: ['#ffdec4', '#a1aace', '#a180f0', '#b1a0f1'],
  amber: ['#ffd0a2', '#c79175', '#ff9473', '#ffbb81'],
  rose: ['#ffd2cd', '#e998aa', '#f36d8f', '#ef88ab'],
  cold: ['#d6e9ff', '#7faadd', '#82a1ff', '#a1bdff'],
};
const matte = (color, options = {}) => new T.MeshLambertMaterial({ color, ...options });
const moods = { neutral: 'moon', tender: 'moon', joy: 'amber', sorrow: 'cold', anger: 'rose', fear: 'cold', surprise: 'moon', disgust: 'rose', contempt: 'amber' };

function rng(seed) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function drawTexture(width, height, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  paint(canvas.getContext('2d'), width, height);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 2;
  return texture;
}

function backdrop(parent) {
  const sky = drawTexture(1344, 896, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    ['#090e28', '#141b41', '#2c2d54', '#593d62', '#a06a79'].forEach((color, i) => grad.addColorStop(i * 0.25, color));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    const halo = ctx.createRadialGradient(w * 0.53, h * 0.33, 22, w * 0.53, h * 0.33, 430);
    halo.addColorStop(0, '#adb2fe59');
    halo.addColorStop(1, '#6c70ee00');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, h);
    const next = rng(66125);
    for (let i = 0; i < 440; i++) {
      const x = next() * w, y = next() * h * 0.84, r = next() ** 4 * 1.75 + 0.35;
      ctx.fillStyle = `rgba(211,222,249,${0.2 + 0.66 * next()})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 11; i++) {
      const x = next() * w, y = next() * h * 0.74, reach = 1.8 + next() * 2.5;
      ctx.strokeStyle = '#d5dbff9f';
      ctx.beginPath();
      ctx.moveTo(x - reach, y); ctx.lineTo(x + reach, y);
      ctx.moveTo(x, y - reach); ctx.lineTo(x, y + reach);
      ctx.stroke();
    }
    for (let layer = 0; layer < 5; layer++) {
      const horizon = h * (0.76 + layer * 0.057);
      ctx.fillStyle = ['#514368', '#433b61', '#353656', '#24273d', '#1d2237'][layer];
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(0, horizon);
      for (let x = 0; x <= w + 13; x += 13) {
        const hill = Math.sin(x * (0.005 + layer * 0.0006) + layer * 2.24) * 39 + Math.sin(x * 0.012 + layer) * 20;
        ctx.lineTo(x, horizon - hill - next() * 9);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
    }
  });
  mesh(parent, new T.PlaneGeometry(20, 10.55), new T.MeshBasicMaterial({ map: sky, toneMapped: false }), 0, 4.98, -8.2);
  const moon = drawTexture(384, 384, (ctx, w) => {
    const c = w / 2;
    const halo = ctx.createRadialGradient(c, c, 8, c, c, c);
    halo.addColorStop(0, '#fef5daaa');
    halo.addColorStop(0.42, '#d0caff3c');
    halo.addColorStop(0.60, '#9ea9ef22');
    halo.addColorStop(1, '#8d9be900');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, w);
    const r = 78;
    ctx.save();
    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
    ctx.clip();
    const disc = ctx.createRadialGradient(c - 24, c - 27, 10, c, c, r * 1.25);
    disc.addColorStop(0, '#fffae7');
    disc.addColorStop(0.74, '#f3dab1');
    disc.addColorStop(1, '#bea6b8');
    ctx.fillStyle = disc;
    ctx.fillRect(c - r, c - r, r * 2, r * 2);
    const next = rng(335);
    for (let i = 0; i < 420; i++) {
      const x = c + (next() - 0.5) * 162, y = c + (next() - 0.5) * 162, radius = 0.7 + next() ** 4 * 17;
      const crater = ctx.createRadialGradient(x, y, 0, x, y, radius);
      crater.addColorStop(0, next() > 0.5 ? '#907c8f36' : '#fff9e883');
      crater.addColorStop(1, '#9a809500');
      ctx.fillStyle = crater;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    ctx.restore();
  });
  mesh(parent, new T.PlaneGeometry(3.92, 3.92), new T.MeshBasicMaterial({ map: moon, transparent: true, depthWrite: false, toneMapped: false }), 0.07, 4.46, -7.82);
}

function makeArch(parent, center, span, height, z, mats, small = false) {
  const [stone, recess, trim] = mats;
  const spring = height * 0.60;
  const width = span * 0.5;
  const outline = (side, t) => vec(center + side * width * ((1 - t) ** 0.91), spring + (height - spring) * t ** 0.73, z);
  for (const side of [-1, 1]) {
    const x = center + side * width;
    mesh(parent, new T.BoxGeometry(small ? 0.24 : 0.32, spring, 0.34), recess, x, spring / 2, z - 0.02);
    mesh(parent, new T.BoxGeometry(small ? 0.28 : 0.4, 0.26, 0.45), stone, x, 0.16, z);
    mesh(parent, new T.BoxGeometry(small ? 0.31 : 0.44, 0.13, 0.41), stone, x, spring, z + 0.02);
    for (const offset of [-0.082, 0.082]) {
      const post = geometryCylinder(0.047, 0.053, spring - 0.18, 10);
      mesh(parent, post, stone, x + offset, spring * 0.5 + 0.04, z + 0.18);
    }
    const ridge = [vec(x + side * 0.117, 0.24, z + 0.18), vec(x + side * 0.117, spring, z + 0.18)];
    const curve = Array.from({ length: 13 }, (_, i) => outline(side, i / 12));
    tube(parent, curve, small ? 0.116 : 0.172, recess, 6, 24);
    tube(parent, curve.map(p => p.clone().add(vec(0, 0, 0.103))), small ? 0.077 : 0.107, stone, 6, 24);
    tube(parent, [...ridge, ...curve.slice(1).map(p => p.clone().add(vec(side * (height - p.y) / height * 0.22, 0.063, 0.167)))], small ? 0.016 : 0.027, trim, 5, 30);
    for (let i = 1; i < 12; i++) {
      const point = curve[i];
      const seam = mesh(parent, new T.BoxGeometry(0.18, 0.013, 0.028), recess, point.x, point.y, z + 0.204);
      seam.rotation.z = side * (-0.80 + i * 0.051);
    }
  }
  const finial = mesh(parent, new T.OctahedronGeometry(small ? 0.079 : 0.137), trim, center, height + 0.01, z + 0.20);
  finial.scale.y = 1.49;
}

function geometryCylinder(top, bottom, height, segments = 16) {
  return new T.CylinderGeometry(top, bottom, height, segments);
}

function radialPool(parent, radius, x, y, z, color, opacity, aspect = 0.67) {
  const texture = drawTexture(128, 128, (ctx) => {
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.30, '#ffffffb4');
    grad.addColorStop(0.62, '#ffffff4f');
    grad.addColorStop(1, '#ffffff00');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
  });
  const mat = new T.MeshBasicMaterial({ map: texture, color, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  const pool = mesh(parent, new T.PlaneGeometry(radius * 2, radius * 2 * aspect), mat, x, y, z);
  pool.rotation.x = -Math.PI / 2;
  return pool;
}

function curtains(parent) {
  const fabric = matte('#b08fa6', { side: T.DoubleSide, vertexColors: true });
  const gold = matte('#a07b61');
  const colors = [new T.Color('#2e1c33'), new T.Color('#714056')];
  function fold(side, u, v) {
    const gather = Math.sin(v * Math.PI) ** 2;
    const width = 1.15 - 0.53 * gather;
    const ripple = Math.sin(u * Math.PI * 12 + v * 1.75);
    return [side * (4.84 - u * width + 0.13 * gather), -0.16 + v * 5.82, -2.20 + ripple * (0.116 - gather * 0.049) + u * 0.15];
  }
  for (const side of [-1, 1]) {
    const geo = surface(48, 17, (u, v) => fold(side, u, v));
    const attr = geo.attributes.uv;
    const rgb = [];
    for (let i = 0; i < attr.count; i++) {
      const t = 0.50 + Math.sin(attr.getX(i) * Math.PI * 12 + attr.getY(i) * 1.75) * 0.39;
      rgb.push(...colors[0].clone().lerp(colors[1], t).toArray());
    }
    geo.setAttribute('color', new T.Float32BufferAttribute(rgb, 3));
    mesh(parent, geo, fabric);
    tube(parent, Array.from({ length: 17 }, (_, i) => vec(...fold(side, 1, i / 16))), 0.027, gold, 6, 36);
    for (const dy of [-0.057, 0.02, 0.067]) {
      const points = Array.from({ length: 11 }, (_, i) => {
        const [x, y, z] = fold(side, i / 10, 0.39 + dy * 0.13);
        return vec(x, y + dy, z + 0.119 + Math.sin(i / 10 * Math.PI) * 0.06);
      });
      tube(parent, points, 0.021, gold, 5, 23);
    }
    const tie = vec(...fold(side, 1, 0.39)).add(vec(0, -0.14, 0.13));
    tube(parent, [tie.clone().add(vec(0, 0.15, 0)), tie, tie.clone().add(vec(side * 0.055, -0.31, 0.008))], 0.018, gold);
    oval(parent, gold, tie.x + side * 0.055, tie.y - 0.33, tie.z, 0.061, 0.104, 0.055);
  }
}

function makeVines(parent, mat, stem, center, seed) {
  const next = rng(seed);
  const petals = new T.InstancedMesh(new T.SphereGeometry(1, 6, 4), mat, 190);
  const sample = new T.Object3D();
  const color = new T.Color();
  let count = 0;
  for (let branch = 0; branch < 10; branch++) {
    const sign = branch % 2 === 0 ? -1 : 1;
    const start = center.clone().add(vec((next() - 0.5) * 0.29, 0, next() * 0.20));
    const end = center.clone().add(vec(sign * (0.47 + next() * 0.70), 0.37 + next() * 1.20, next() * 0.40));
    const curve = new T.CatmullRomCurve3([start, start.clone().lerp(end, 0.44).add(vec(sign * -0.21, 0.20, 0.13)), end]);
    mesh(parent, new T.TubeGeometry(curve, 14, 0.022 - branch * 0.0012, 5, false), stem);
    for (let i = 0; i < 19; i++) {
      const t = 0.18 + i * 0.043;
      sample.position.copy(curve.getPoint(t)).add(vec((next() - 0.5) * 0.26, (next() - 0.5) * 0.18, (next() - 0.5) * 0.29));
      sample.rotation.set(next() * 5, next() * 5, next() * 5);
      const s = 0.039 + next() * 0.096;
      sample.scale.set(s, s * 0.49, s * 0.70);
      sample.updateMatrix();
      const rose = next() > 0.21;
      color.setHSL(rose ? 0.92 + next() * 0.053 : 0.51 + next() * 0.065, 0.25 + next() * 0.23, 0.23 + next() * 0.25);
      petals.setMatrixAt(count, sample.matrix);
      petals.setColorAt(count++, color);
    }
  }
  parent.add(petals);
}

function batchStatic(parent, excluded = () => false) {
  parent.updateMatrixWorld(true);
  const inverse = parent.matrixWorld.clone().invert();
  const byMaterial = new Map();
  function walk(object) {
    for (const child of [...object.children]) {
      if (excluded(child)) continue;
      if (child.isMesh && !child.isInstancedMesh && !child.material.transparent && !child.geometry.morphAttributes.position && child.frustumCulled) {
        const materials = byMaterial.get(child.material) ?? [];
        materials.push(child);
        byMaterial.set(child.material, materials);
      }
      walk(child);
    }
  }
  walk(parent);
  for (const [mat, children] of byMaterial) {
    if (children.length < 2) continue;
    const geometries = children.map(child => {
      const geo = child.geometry.clone();
      if (!geo.index) geo.setIndex(Array.from({ length: geo.attributes.position.count }, (_, i) => i));
      geo.applyMatrix4(child.matrixWorld.clone().premultiply(inverse));
      return geo;
    });
    const merged = mergeGeometries(geometries);
    for (const geo of geometries) geo.dispose();
    if (!merged) continue;
    mesh(parent, merged, mat);
    for (const child of children) child.removeFromParent();
  }
}

function buildSet(scene) {
  const set = group(scene);
  backdrop(set);
  const stone = matte('#5f5574');
  const recess = matte('#272a48');
  const trim = matte('#a18478');
  makeArch(set, 0, 4.95, 4.98, -3.67, [stone, recess, trim]);
  makeArch(set, -3.57, 2.11, 4.03, -3.76, [stone, recess, trim], true);
  makeArch(set, 3.57, 2.11, 4.03, -3.76, [stone, recess, trim], true);
  curtains(set);

  const wood = matte('#493447');
  const base = mesh(set, geometryCylinder(5.17, 5.19, 0.24, 84), wood, 0, -0.18, -0.26);
  base.scale.z = 0.69;
  const deckPattern = drawTexture(1024, 1024, (ctx, w, h) => {
    const next = rng(72);
    ctx.fillStyle = '#3b2d3d';
    ctx.fillRect(0, 0, w, h);
    for (let row = 0; row < 44; row++) {
      const y = row * h / 44;
      const light = Math.round(24 + next() * 21);
      ctx.fillStyle = `rgb(${light + 28},${light + 14},${light + 23})`;
      ctx.fillRect(0, y, w, h / 44 - 1.25);
      ctx.fillStyle = '#bd8f8823';
      ctx.fillRect(0, y + 1, w, 1);
      ctx.fillStyle = '#18122274';
      ctx.fillRect((row % 3) * 250 + 44, y, 1.4, h / 44);
      for (let line = 0; line < 9; line++) {
        const x = next() * w;
        ctx.fillStyle = '#b07b7d13';
        ctx.fillRect(x, y + next() * 20, 24 + next() * 340, 0.8);
      }
    }
    ctx.strokeStyle = '#c7a47e68';
    for (const r of [452, 470]) {
      ctx.lineWidth = r === 470 ? 2.8 : 1.6;
      ctx.beginPath(); ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2); ctx.stroke();
    }
    const c = w / 2;
    ctx.strokeStyle = '#cfab864b';
    ctx.lineWidth = 1.7;
    for (let i = 0; i < 12; i++) {
      const angle = i * Math.PI / 6;
      const x = c + Math.cos(angle) * 449;
      const y = c + Math.sin(angle) * 449;
      ctx.save();
      ctx.translate(x, y); ctx.rotate(angle);
      ctx.strokeRect(-4.5, -4.5, 9, 9); ctx.restore();
    }
  });
  const deck = mesh(set, new T.CircleGeometry(5.17, 84), matte('#ffffff', { map: deckPattern }), 0, -0.054, -0.26);
  deck.rotation.x = -Math.PI / 2;
  deck.scale.y = 0.69;
  const deckRim = Array.from({ length: 73 }, (_, i) => {
    const a = 2 * Math.PI * i / 72;
    return vec(5.159 * Math.cos(a), -0.13, -0.26 + 3.561 * Math.sin(a));
  });
  tube(set, deckRim, 0.017, trim, 5, 78);
  mesh(set, new T.PlaneGeometry(120, 120), matte('#201b30'), 0, -0.31, 0).rotation.x = -Math.PI / 2;

  const balcony = group(set, 1.66, -0.03, -0.76);
  const baseTop = mesh(balcony, geometryCylinder(1.43, 1.45, 0.31, 48), matte('#514052'), 0, 0.188, 0);
  baseTop.scale.z = 0.81;
  const band = mesh(balcony, geometryCylinder(1.44, 1.449, 0.056, 48), trim, 0, 0.237, 0);
  band.scale.z = 0.81;
  const walk = mesh(balcony, geometryCylinder(1.42, 1.43, 0.07, 48), wood, 0, 0.336, 0);
  walk.scale.z = 0.81;
  for (let i = 0; i < 3; i++) {
    const step = mesh(set, new T.BoxGeometry(0.67, 0.11 + i * 0.071, 0.24), wood, 0.56 + i * 0.16, 0.006 + i * 0.037, 0.59 - i * 0.15);
    step.rotation.y = -0.31;
  }
  const rail = [];
  for (let i = 0; i <= 14; i++) {
    const a = Math.PI * (0.88 + i * 0.090);
    const x = Math.cos(a) * 1.37;
    const z = Math.sin(a) * 1.12;
    rail.push(vec(x, 1.26, z));
    lathe(balcony, [[0.35, 0.068], [0.43, 0.061], [0.56, 0.039], [0.69, 0.062], [0.79, 0.054],
      [0.98, 0.033], [1.12, 0.061], [1.25, 0.059]], stone, x, 0, z, 1, 1, 12);
    if (i % 4 === 0) oval(balcony, trim, x, 1.29, z, 0.079, 0.079, 0.079);
  }
  tube(balcony, rail, 0.057, stone, 8, 38);
  tube(balcony, rail.map(p => p.clone().add(vec(0, 0.028, 0))), 0.035, trim, 8, 38);

  const plant = matte('#ffffff');
  const stem = matte('#393345');
  makeVines(set, plant, stem, vec(-3.32, -0.03, -1.75), 551);
  makeVines(set, plant, stem, vec(3.46, -0.03, -1.64), 992);
  makeVines(set, plant, stem, vec(2.83, 0.44, -1.49), 763);
  makeVines(set, plant, stem, vec(-2.60, -0.04, -2.42), 731);

  const dustGeo = new T.BufferGeometry();
  const next = rng(84);
  const positions = new Float32Array(100 * 3);
  for (let i = 0; i < 100; i++) {
    positions[i * 3] = (next() - 0.5) * 11.1;
    positions[i * 3 + 1] = next() * 5.2;
    positions[i * 3 + 2] = -2.5 + next() * 4.6;
  }
  dustGeo.setAttribute('position', new T.BufferAttribute(positions, 3));
  const dust = new T.Points(dustGeo, new T.PointsMaterial({ color: '#edcca2', size: 0.025, transparent: true, opacity: 0.61, depthWrite: false }));
  scene.add(dust);
  batchStatic(set);
  const pools = [
    radialPool(scene, 2.85, -1.32, -0.048, 0.21, '#c0a1ec', 0.33),
    radialPool(scene, 2.37, 1.47, 0.349, -0.51, '#d19ede', 0.30, 0.57),
  ];
  const shadows = [
    radialPool(scene, 0.79, -1.37, -0.045, 0.28, '#100c17', 0.74, 0.65),
    radialPool(scene, 0.76, 1.31, 0.350, -0.28, '#160e1f', 0.77, 0.66),
  ];
  return { dust, pools, shadows };
}

function addLights(scene) {
  scene.add(new T.HemisphereLight('#dad0df', '#91777e', 1.53));
  const key = new T.DirectionalLight('#ffdec4', 1.92);
  key.position.set(-3.7, 4.9, 5.8);
  scene.add(key);
  const fill = new T.DirectionalLight('#a1aace', 1.36);
  fill.position.set(4.1, 3.0, 4.5);
  scene.add(fill);
  const rim = new T.DirectionalLight('#a180f0', 2.16);
  rim.position.set(0.2, 4.5, -4.5);
  scene.add(rim);
  const spot = new T.SpotLight('#b1a0f1', 43, 15, 0.49, 0.69, 1.55);
  spot.position.set(0.8, 6.4, 2.0);
  scene.add(spot, spot.target);
  return [key, fill, rim, spot];
}

const neutralFace = blendedExpression([{ emotion: 'neutral', intensity: 0 }]);
const colorWork = new T.Color();
const previousColor = new T.Color();
const headWorld = vec(0, 0, 0);

function listenerFace(emotion, intensity) {
  const reaction = {
    anger: 'fear', fear: 'fear', surprise: 'surprise', sorrow: 'sorrow', contempt: 'sorrow', joy: 'joy', disgust: 'disgust',
  }[emotion] ?? 'tender';
  return blendedExpression([{ emotion: reaction, intensity }]);
}

export class Stage {
  constructor(canvas) {
    const renderer = new T.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    const nativeRatio = clamp(window.devicePixelRatio || 1, 1.2, 1.5);
    const gl = renderer.getContext();
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    const gpu = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : '';
    const software = /swiftshader|llvmpipe|software rasterizer/i.test(gpu);
    this.stillRatio = software ? 1.5 : nativeRatio;
    this.playRatio = software ? 0.58 : nativeRatio;
    renderer.setPixelRatio(this.stillRatio);
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    this.renderer = renderer;
    this.scene = new T.Scene();
    this.scene.background = new T.Color('#101327');
    this.camera = new T.PerspectiveCamera(32, 1, 0.06, 60);
    this.lightRig = addLights(this.scene);
    this.set = buildSet(this.scene);
    this.actors = [new Actor(this.scene, 0), new Actor(this.scene, 1)];
    for (const actor of this.actors) {
      batchStatic(actor.head);
      batchStatic(actor.chest, child => child.isGroup);
      if (actor.skirt) batchStatic(actor.skirt);
      for (const limb of [...actor.arms, ...actor.legs]) {
        batchStatic(limb.upper);
        batchStatic(limb.lower);
      }
    }
    this.resizeDirty = true;
    this.motion = matchMedia('(prefers-reduced-motion: reduce)');
    this.observer = new ResizeObserver(() => { this.resizeDirty = true; });
    this.observer.observe(canvas);
  }

  resize() {
    const canvas = this.renderer.domElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.resizeDirty = false;
  }

  render(scene, time, cameraMode, lighting, portrait, playing) {
    const ratio = playing ? this.playRatio : this.stillRatio;
    if (ratio !== this.renderer.getPixelRatio()) this.renderer.setPixelRatio(ratio);
    if (this.resizeDirty) this.resize();
    const { beat, speech, progress, local } = sampleScene(scene, time);
    const active = scene.slots.indexOf(beat.speaker);
    const solo = scene.cast.length === 1;
    const previous = scene.beats[beat.index - 1];
    const bodyBlend = ease(local / 0.53);
    const intensity = Math.max(...beat.emotions.map(e => e.intensity));
    for (const actor of this.actors) {
      const speaking = actor.index === active;
      const listening = !speaking && !solo && local > 0.12;
      const listenerIntensity = 0.20 + 0.23 * intensity * Math.sin(progress * Math.PI);
      const newFace = speaking ? (beat.expression ??= blendedExpression(beat.emotions)) :
        listenerFace(beat.emotion, listenerIntensity);
      const wasSpeaking = previous?.speaker === scene.slots[actor.index];
      const oldFace = wasSpeaking ? (previous.expression ??= blendedExpression(previous.emotions)) :
        previous && !solo ? listenerFace(previous.emotion, 0.20) : neutralFace;
      const expression = local >= 0.53 || portrait ? newFace : Object.fromEntries(
        Object.keys(newFace).map(key => [key, mix(oldFace[key], newFace[key], bodyBlend)]),
      );
      actor.root.visible = !solo || speaking;
      this.set.shadows[actor.index].visible = actor.root.visible;
      if (!actor.root.visible) continue;
      actor.pose({
        time: actor.index * 0.29 + time, expression, speaking: speaking && speech.talking && !portrait,
        listening, actions: speaking ? beat.actions : [],
        progress, mouth: speaking && !portrait ? speech.mouth : MOUTH.rest, portrait: speaking && Boolean(portrait),
      });
      const shadow = this.set.shadows[actor.index];
      shadow.position.x = actor.base.x + actor.hip.position.x;
      shadow.position.z = actor.base.z + actor.hip.position.z;
    }
    this.set.dust.rotation.y = Math.sin(time * 0.16) * 0.08;
    this.set.dust.position.y = Math.sin(time * 0.70) * 0.058;
    const lightingKey = lighting === 'auto' ? moods[beat.emotion] : lighting;
    const previousKey = lighting === 'auto' && previous ? moods[previous.emotion] : lightingKey;
    for (const [i, light] of this.lightRig.entries()) {
      colorWork.set(looks[lightingKey][i]);
      previousColor.set(looks[previousKey][i]);
      light.color.copy(previousColor.lerp(colorWork, ease(local / 0.86)));
    }
    const actor = this.actors[active];
    const spot = this.lightRig[3];
    spot.target.position.set(mix(0, actor.base.x, ease(local / 1.4)), 1.3, actor.base.z);
    spot.target.updateMatrixWorld();
    this.set.pools[0].material.color.copy(this.lightRig[2].color);
    this.set.pools[1].material.color.copy(this.lightRig[2].color);
    const camera = this.frame(cameraMode, actor, beat, time, local, progress, intensity);
    this.renderer.render(this.scene, this.camera);
    return { beat, speech, local, progress, camera };
  }

  frame(mode, actor, beat, time, local, progress, intensity) {
    const aspect = this.camera.aspect;
    const narrow = aspect < 1.38;
    let shot = mode;
    if (mode === 'auto') {
      const kneeling = beat.actions.includes('kneel');
      const physical = beat.actions.includes('turn_away') || beat.actions.includes('step_forward');
      if ((beat.index === 0 && local < 1.38) || (kneeling && progress < 0.88) ||
          (physical && beat.index > 2 && progress < 0.30)) shot = 'wide';
      else if (intensity > 0.68 && progress > 0.34 && !kneeling) shot = 'close';
      else shot = 'medium';
    }
    headWorld.set(0, 0, 0);
    actor.head.getWorldPosition(headWorld);
    const drift = this.motion.matches ? 0 : Math.sin(time * 0.36) * 0.09;
    const push = this.motion.matches ? 0 : ease(progress);
    const dir = actor.orbitDirection;
    const aim = vec(0, 1.73, -0.39);
    if (shot === 'wide') {
      const wideZ = narrow ? 10.6 + (1.35 - aspect) * 4.5 : 8.58 + Math.max(0, 1.85 - aspect) * 1.45;
      this.camera.position.set(0.17 + drift, 3.45, wideZ - push * 0.21);
      aim.y = 2.13;
    } else if (shot === 'medium') {
      const center = mix(actor.base.x, headWorld.x, 0.60);
      this.camera.position.set(center + dir * 0.40 + drift, 2.65 + actor.base.y, 5.98 + (narrow ? 0.72 : 0) - push * 0.43);
      aim.set(center + dir * 0.34, headWorld.y - 0.63, headWorld.z);
    } else {
      this.camera.position.set(headWorld.x + dir * 0.17 + drift, headWorld.y + 0.16, headWorld.z + 2.76 - push * 0.25);
      aim.set(headWorld.x + dir * 0.065, headWorld.y + 0.015, headWorld.z + 0.13);
    }
    this.camera.lookAt(aim);
    return shot;
  }
}
