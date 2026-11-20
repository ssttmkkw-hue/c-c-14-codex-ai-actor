import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clamp, ease, mix, MOUTH, sampleScene } from './performance.js';
import { Actor, blendedExpression } from './actor.js';
import { group, lathe, mesh, oval, surface, tube, vec } from './model.js';

export const LIGHTS = { auto: '随情绪', moon: '月光', amber: '暖金', rose: '绯红', cold: '冷蓝' };
export const CAMERAS = { auto: '自动', wide: '全景', medium: '中景', close: '特写' };
const looks = {
  moon: ['#ffe0b9', '#94b9c7', '#729bcb', '#8db4d7'],
  amber: ['#ffd4a9', '#b1a396', '#cb9b6d', '#f6bc73'],
  rose: ['#ffd7be', '#b2a2b3', '#ba657b', '#da7f8f'],
  cold: ['#e8e8dd', '#719fb7', '#658ed0', '#8fbbde'],
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
  const sky = drawTexture(1536, 1024, (ctx, w, h) => {
    const next = rng(66125);
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    const colors = ['#0a1221', '#16263c', '#243d50', '#456667', '#7b8071'];
    colors.forEach((color, i) => grad.addColorStop(i / (colors.length - 1), color));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    const halo = ctx.createRadialGradient(w * 0.35, h * 0.21, 28, w * 0.35, h * 0.21, 410);
    halo.addColorStop(0, '#aacdd073');
    halo.addColorStop(0.43, '#7396aa3b');
    halo.addColorStop(1, '#36587800');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 285; i++) {
      const x = next() * w, y = next() * h * 0.69, r = 0.24 + next() ** 6 * 1.24;
      ctx.fillStyle = `rgba(220,232,224,${0.13 + 0.61 * next()})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 260; i++) {
      const x = next() * w, y = h * (0.31 + next() * 0.57) + Math.sin(x * 0.006) * 37;
      const rx = 65 + 360 * next(), ry = 4 + next() ** 2 * 26;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(rx, ry);
      const cloud = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      cloud.addColorStop(0, i % 3 ? '#97a9a812' : '#12263b29');
      cloud.addColorStop(1, '#536d7600');
      ctx.fillStyle = cloud;
      ctx.fillRect(-1, -1, 2, 2);
      ctx.restore();
    }
    for (let layer = 0; layer < 4; layer++) {
      const horizon = h * (0.66 + layer * 0.066);
      ctx.fillStyle = ['#466068', '#354e57', '#263e47', '#1b333c'][layer];
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w + 4; x += 4) {
        const hill = Math.sin(x * (0.0036 + layer * 0.0006) + layer * 2.24) * 49 + Math.sin(x * 0.011 + layer) * 21;
        const trees = (Math.sin(x * 0.14 + layer) + Math.cos(x * 0.29)) * (2 + layer);
        ctx.lineTo(x, horizon - hill - trees - next() * 5);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
    }
    const town = ctx.createLinearGradient(0, h * 0.63, 0, h * 0.88);
    town.addColorStop(0, '#233f48');
    town.addColorStop(1, '#243d48');
    for (let i = 0; i < 86; i++) {
      const x = w * 0.20 + next() * w * 0.57;
      const y = h * (0.775 + next() * 0.061) - Math.sin(x * 0.005) * 18;
      const bw = 3 + next() * 12;
      const bh = 3 + next() ** 2 * 26;
      ctx.fillStyle = town;
      ctx.fillRect(x, y - bh, bw, bh);
      ctx.beginPath();
      ctx.moveTo(x - 1, y - bh);
      ctx.lineTo(x + bw * 0.5, y - bh - bw * 0.63);
      ctx.lineTo(x + bw + 1, y - bh);
      ctx.fill();
      if (i % 3 === 0) {
        ctx.fillStyle = '#c6a16f95';
        ctx.fillRect(x + bw * 0.36, y - bh * 0.53, 1.8, 2.5);
      }
    }
    const mist = ctx.createLinearGradient(0, h * 0.74, 0, h);
    mist.addColorStop(0, '#a1b4ad00');
    mist.addColorStop(0.27, '#8dabab2f');
    mist.addColorStop(0.70, '#111f2e20');
    mist.addColorStop(1, '#08132195');
    ctx.fillStyle = mist;
    ctx.fillRect(0, 0, w, h);
  });
  mesh(parent, new T.PlaneGeometry(25, 14.1), new T.MeshBasicMaterial({ map: sky, toneMapped: false }), 0, 5.10, -10.5);
  const moon = drawTexture(384, 384, (ctx, w) => {
    const c = w / 2;
    const halo = ctx.createRadialGradient(c, c, 20, c, c, c);
    halo.addColorStop(0, '#e2efdb8c');
    halo.addColorStop(0.41, '#c8e6de36');
    halo.addColorStop(0.68, '#8db9cb13');
    halo.addColorStop(1, '#8d9be900');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, w);
    const r = 69;
    ctx.save();
    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
    ctx.clip();
    const disc = ctx.createRadialGradient(c - 23, c - 32, 5, c, c, r * 1.20);
    disc.addColorStop(0, '#f8f2d4');
    disc.addColorStop(0.72, '#d7decb');
    disc.addColorStop(1, '#99acae');
    ctx.fillStyle = disc;
    ctx.fillRect(c - r, c - r, r * 2, r * 2);
    const next = rng(335);
    for (let i = 0; i < 620; i++) {
      const x = c + (next() - 0.5) * 144, y = c + (next() - 0.5) * 144;
      const radius = 1.3 + next() ** 3 * 18;
      const crater = ctx.createRadialGradient(x, y, 0, x, y, radius);
      crater.addColorStop(0, i % 3 ? '#6b88864b' : '#fff9e84f');
      crater.addColorStop(1, '#74929a00');
      ctx.fillStyle = crater;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    ctx.restore();
  });
  mesh(parent, new T.PlaneGeometry(3.1, 3.1), new T.MeshBasicMaterial({ map: moon, transparent: true, depthWrite: false, toneMapped: false }), -1.32, 4.90, -10.18);
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

function stageHaze(parent) {
  const texture = drawTexture(256, 512, (ctx, w, h) => {
    const pixels = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = y / h;
        const u = (x / w - 0.5) / (0.19 + v * 0.33);
        const index = (x + y * w) * 4;
        pixels.data[index] = 159;
        pixels.data[index + 1] = 205;
        pixels.data[index + 2] = 227;
        pixels.data[index + 3] = Math.exp(-u * u * 3) * Math.sin(v * Math.PI) ** 0.9 * 42;
      }
    }
    ctx.putImageData(pixels, 0, 0);
  });
  const mat = new T.MeshBasicMaterial({
    map: texture, transparent: true, depthWrite: false, toneMapped: false,
    blending: T.AdditiveBlending, opacity: 0.60,
  });
  const beam = mesh(parent, new T.PlaneGeometry(2.86, 6.50), mat, -0.05, 3.30, -2.96);
  beam.rotation.z = -0.40;
  const echo = mesh(parent, new T.PlaneGeometry(2.14, 5.60), mat, 0.24, 3.29, -3.08);
  echo.rotation.z = -0.39;
}

function lanterns(parent, metal, stone) {
  const warm = new T.MeshBasicMaterial({ color: '#ecb36f' });
  const glowMap = drawTexture(128, 128, (ctx, w) => {
    const c = w / 2;
    const gradient = ctx.createRadialGradient(c, c, 0, c, c, c);
    gradient.addColorStop(0, '#ffd39cac');
    gradient.addColorStop(0.23, '#ffc28576');
    gradient.addColorStop(1, '#fa9c5b00');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, w);
  });
  const glow = new T.SpriteMaterial({ map: glowMap, depthWrite: false, opacity: 0.57, toneMapped: false });
  for (const [x, y, z] of [[-3.76, 0.42, -0.33], [3.71, 0.39, -0.48], [2.64, 0.33, -2.13]]) {
    lathe(parent, [[0, 0.24], [0.06, 0.24], [0.10, 0.19], [0.37, 0.14], [0.39, 0.21], [0.43, 0.21]], stone, x, -0.047, z, 1, 1, 10);
    lathe(parent, [[0, 0.14], [0.034, 0.14], [0.052, 0.113], [0.267, 0.084], [0.286, 0.109],
      [0.318, 0.09], [0.359, 0.028], [0.382, 0.008]], metal, x, y, z, 1, 1, 8);
    oval(parent, warm, x, y + 0.148, z, 0.111, 0.104, 0.111);
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4;
      const dx = Math.cos(angle), dz = Math.sin(angle);
      tube(parent, [vec(x + dx * 0.12, y + 0.038, z + dz * 0.12),
        vec(x + dx * 0.106, y + 0.163, z + dz * 0.106),
        vec(x + dx * 0.090, y + 0.277, z + dz * 0.09)], 0.009, metal, 4, 6);
    }
    const aura = new T.Sprite(glow);
    aura.position.set(x, y + 0.15, z + 0.05);
    aura.scale.set(0.74, 0.82, 1);
    parent.add(aura);
  }
}

function curtains(parent) {
  const fabric = matte('#8c6054', { side: T.DoubleSide, vertexColors: true });
  const gold = matte('#9d7960');
  const colors = [new T.Color('#30232f'), new T.Color('#713740')];
  function fold(side, u, v) {
    const gather = Math.sin(v * Math.PI) ** 2;
    const width = 1.26 - 0.48 * gather;
    const ripple = Math.sin(u * Math.PI * 12 + v * 1.75);
    return [side * (5.38 - u * width + 0.13 * gather), -0.16 + v * 5.82, -2.20 + ripple * (0.116 - gather * 0.049) + u * 0.15];
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
  const petals = new T.InstancedMesh(new T.SphereGeometry(1, 5, 3), mat, 190);
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
      const s = 0.033 + next() * 0.084;
      sample.scale.set(s, s * 0.49, s * 0.70);
      sample.updateMatrix();
      const rose = next() > 0.79;
      color.setHSL(rose ? 0.98 - next() * 0.092 : 0.38 + next() * 0.12, 0.13 + next() * 0.24, 0.080 + next() * (rose ? 0.24 : 0.072));
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
  stageHaze(set);
  const stone = matte('#4b595f');
  const recess = matte('#273643');
  const trim = matte('#85735e');
  makeArch(set, 0, 5.72, 5.31, -3.67, [stone, recess, trim]);
  makeArch(set, -3.87, 2.03, 4.08, -3.78, [stone, recess, trim], true);
  makeArch(set, 3.87, 2.03, 4.08, -3.78, [stone, recess, trim], true);
  curtains(set);

  const wood = matte('#3f3435');
  const base = mesh(set, geometryCylinder(5.17, 5.19, 0.24, 84), wood, 0, -0.18, -0.26);
  base.scale.z = 0.69;
  const deckPattern = drawTexture(1024, 1024, (ctx, w, h) => {
    const next = rng(72);
    ctx.fillStyle = '#2f2728';
    ctx.fillRect(0, 0, w, h);
    for (let row = 0; row < 44; row++) {
      const y = row * h / 44;
      const light = Math.round(24 + next() * 21);
      ctx.fillStyle = `rgb(${light + 17},${light + 6},${light + 3})`;
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

  const balcony = group(set, 1.66, -0.03, -0.76);
  const baseTop = mesh(balcony, geometryCylinder(1.43, 1.45, 0.31, 48), matte('#3b4548'), 0, 0.188, 0);
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
  const stem = matte('#333730');
  makeVines(set, plant, stem, vec(-3.32, -0.03, -1.75), 551);
  makeVines(set, plant, stem, vec(3.46, -0.03, -1.64), 992);
  makeVines(set, plant, stem, vec(2.83, 0.44, -1.49), 763);
  makeVines(set, plant, stem, vec(-2.60, -0.04, -2.42), 731);
  lanterns(set, trim, recess);

  const dustGeo = new T.BufferGeometry();
  const next = rng(84);
  const positions = new Float32Array(100 * 3);
  for (let i = 0; i < 100; i++) {
    positions[i * 3] = (next() - 0.5) * 11.1;
    positions[i * 3 + 1] = next() * 5.2;
    positions[i * 3 + 2] = -2.5 + next() * 4.6;
  }
  dustGeo.setAttribute('position', new T.BufferAttribute(positions, 3));
  const dust = new T.Points(dustGeo, new T.PointsMaterial({ color: '#d5c9a4', size: 0.019, transparent: true, opacity: 0.43, depthWrite: false }));
  scene.add(dust);
  batchStatic(set);
  const pools = [
    radialPool(scene, 2.85, -1.32, -0.048, 0.21, '#b8a88d', 0.24),
    radialPool(scene, 2.37, 1.47, 0.349, -0.51, '#93b8c6', 0.24, 0.57),
  ];
  const shadows = [
    radialPool(scene, 0.79, -1.37, -0.045, 0.28, '#100c17', 0.74, 0.65),
    radialPool(scene, 0.76, 1.31, 0.350, -0.28, '#160e1f', 0.77, 0.66),
  ];
  return { set, dust, pools, shadows };
}

function portraitBackdrop(scene) {
  const texture = drawTexture(1024, 640, (ctx, w, h) => {
    const next = rng(149);
    ctx.fillStyle = '#101926';
    ctx.fillRect(0, 0, w, h);
    for (const [x, y, r, tint] of [
      [0.23, 0.34, 0.46, '#364b59'], [0.63, 0.45, 0.43, '#3d4f58'], [0.96, 0.13, 0.32, '#616459'],
    ]) {
      const glow = ctx.createRadialGradient(x * w, y * h, 1, x * w, y * h, r * w);
      glow.addColorStop(0, tint);
      glow.addColorStop(1, tint + '00');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
    }
    for (let i = 0; i < 20; i++) {
      const x = next() * w, y = next() * h, r = 3 + next() * 9;
      const mote = ctx.createRadialGradient(x, y, 0, x, y, r);
      mote.addColorStop(0, i % 3 ? '#c8aa7659' : '#b3cbd04d');
      mote.addColorStop(1, '#c8aa7600');
      ctx.fillStyle = mote;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  });
  return mesh(scene, new T.PlaneGeometry(15, 9.375), new T.MeshBasicMaterial({ map: texture, toneMapped: false }), 0, 2.85, -4.0);
}

function addLights(scene) {
  const sky = new T.HemisphereLight('#bdcbd5', '#887782', 1.06);
  const key = new T.DirectionalLight('#ffe0b9', 2.25);
  key.position.set(-3.4, 3.1, 6.1);
  const fill = new T.DirectionalLight('#94b9c7', 1.13);
  fill.position.set(4.2, 1.9, 6.1);
  const rim = new T.DirectionalLight('#729bcb', 2.7);
  rim.position.set(2.0, 2.8, -4.9);
  const spot = new T.SpotLight('#8db4d7', 47, 15, 0.44, 0.76, 1.55);
  spot.position.set(0.8, 6.4, 2.0);
  scene.add(sky, key, fill, rim, spot, spot.target);
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
    this.scene.background = new T.Color('#101926');
    this.camera = new T.PerspectiveCamera(32, 1, 0.06, 60);
    this.lightRig = addLights(this.scene);
    this.set = buildSet(this.scene);
    this.portraitBackdrop = portraitBackdrop(this.scene);
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
    const studioPortrait = Boolean(portrait) && cameraMode === 'close';
    this.portraitBackdrop.visible = studioPortrait;
    this.set.set.visible = !studioPortrait;
    this.set.dust.visible = !studioPortrait;
    for (const pool of this.set.pools) pool.visible = !studioPortrait;
    const previous = scene.beats[beat.index - 1];
    const bodyBlend = ease(local / 0.52);
    const intensity = Math.max(...beat.emotions.map(e => e.intensity));
    const listenerCatch = ease((local - 0.36) / 0.67) * (1 - ease((progress - 0.74) / 0.26));
    const phraseTurn = ease((progress - 0.24) / 0.18) * (1 - ease((progress - 0.63) / 0.30));
    const reception = listenerCatch * (0.37 + 0.59 * phraseTurn);
    const delivery = speech.talking ? (Math.sin(progress * 14.3 - 0.6) * 0.35 + phraseTurn * 0.36) * (0.48 + intensity * 0.52) : 0;
    for (const actor of this.actors) {
      const speaking = actor.index === active;
      const listening = !speaking && !solo;
      const listenerIntensity = 0.10 + (0.19 + 0.37 * intensity) * reception;
      const newFace = speaking ? (beat.expression ??= blendedExpression(beat.emotions)) :
        listenerFace(beat.emotion, listenerIntensity);
      const wasSpeaking = previous?.speaker === scene.slots[actor.index];
      const oldFace = wasSpeaking ? (previous.expression ??= blendedExpression(previous.emotions)) :
        previous && !solo ? listenerFace(previous.emotion, 0.10) : neutralFace;
      const expression = local >= 0.52 || portrait ? newFace : Object.fromEntries(
        Object.keys(newFace).map(key => [key, mix(oldFace[key], newFace[key], bodyBlend)]),
      );
      const actorReaches = beat.actions.includes('reach') || beat.actions.includes('point');
      const focus = solo ? 0 : listening ? 0.41 + reception * 0.51 :
        mix(0.39 + (previous && !wasSpeaking ? 0.28 : 0), (actorReaches ? 0.64 : 0.43) + phraseTurn * 0.19, bodyBlend);
      actor.root.visible = !solo || speaking;
      this.set.shadows[actor.index].visible = actor.root.visible && !studioPortrait;
      if (!actor.root.visible) continue;
      actor.pose({
        time: actor.index * 0.29 + time, expression, speaking: speaking && speech.talking && !portrait,
        listening, actions: speaking ? beat.actions : [], focus,
        delivery: speaking && !portrait ? delivery : 0, reaction: reception,
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
      if (studioPortrait && lighting === 'auto' && i < 2) light.color.lerp(colorWork.set(looks.moon[i]), 0.68);
    }
    const actor = this.actors[active];
    const spot = this.lightRig[3];
    spot.target.position.set(mix(0, actor.base.x, ease(local / 1.4)), 1.3, actor.base.z);
    spot.target.updateMatrixWorld();
    this.set.pools[0].material.color.set('#baa491').lerp(this.lightRig[0].color, 0.3);
    this.set.pools[1].material.color.copy(this.lightRig[2].color);
    const camera = this.frame(cameraMode, actor, beat, time, local, progress, intensity, portrait, solo);
    this.renderer.render(this.scene, this.camera);
    return { beat, speech, local, progress, camera };
  }

  frame(mode, actor, beat, time, local, progress, intensity, portrait, solo) {
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
      const wideZ = narrow ? 10.55 + (1.35 - aspect) * 5.6 : 9.90 + Math.max(0, 1.85 - aspect) * 1.16;
      this.camera.position.set(0.03 + drift, 3.40, wideZ - push * 0.23);
      aim.y = 2.20;
    } else if (shot === 'medium') {
      const center = mix(actor.base.x, headWorld.x, 0.62);
      const twoShot = !solo && aspect >= 1.62;
      this.camera.position.set(center + dir * (twoShot ? 1.02 : 0.34) + drift, 2.53 + actor.base.y,
        headWorld.z + 4.79 + (narrow ? 0.52 : 0) - push * 0.39);
      aim.set(center + dir * (twoShot ? 0.75 : 0.14), headWorld.y - 0.43, headWorld.z);
    } else {
      const distance = (narrow ? 2.87 : 2.67) - push * 0.16;
      this.camera.position.set(headWorld.x + dir * (portrait ? -0.36 : 1.03) + drift, headWorld.y + 0.085, headWorld.z + distance);
      aim.set(headWorld.x + dir * (narrow ? 0.010 : portrait ? 0.15 : 0.26), headWorld.y - 0.005, headWorld.z + 0.14);
    }
    this.camera.lookAt(aim);
    return shot;
  }
}
