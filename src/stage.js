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
    const colors = ['#070f20', '#142641', '#253e59', '#4a667b', '#5b7883'];
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
      ctx.fillStyle = `rgba(220,232,224,${0.12 + 0.46 * next()})`;
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
    for (let layer = 0; layer < 3; layer++) {
      const horizon = h * (0.69 + layer * 0.060);
      const hills = ctx.createLinearGradient(0, horizon - 70, 0, horizon + 140);
      const [crest, valley] = [['#4c6578', '#405c70'], ['#354d62', '#39576a'], ['#243a50', '#233f55']][layer];
      hills.addColorStop(0, crest);
      hills.addColorStop(1, valley);
      ctx.fillStyle = hills;
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w + 4; x += 4) {
        const hills = Math.sin(x * (0.0051 - layer * 0.00055) + layer * 2.24) * (36 + layer * 11) +
          Math.sin(x * 0.013 + layer) * 7 + Math.sin(x * 0.029 + layer) * 3;
        ctx.lineTo(x, horizon - hills - next() * (layer + 1));
      }
      ctx.lineTo(w, h);
      ctx.fill();
    }
    const town = ctx.createLinearGradient(0, h * 0.68, 0, h * 0.87);
    town.addColorStop(0, '#2d455a');
    town.addColorStop(1, '#354d5b');
    for (let i = 0; i < 340; i++) {
      const x = w * 0.06 + next() * w * 0.87;
      const y = h * (0.778 + next() * 0.096) - Math.sin(x * 0.006) * 22;
      const tower = i % 19 === 0;
      const bw = 3 + next() * (tower ? 19 : 12);
      const bh = 3 + next() ** 2 * 22 + (tower ? 21 : 0);
      ctx.fillStyle = town;
      ctx.fillRect(x, y - bh, bw, bh);
      ctx.beginPath();
      ctx.moveTo(x - 1, y - bh);
      ctx.lineTo(x + bw * 0.5, y - bh - bw * (tower ? 0.93 : 0.36));
      ctx.lineTo(x + bw + 1, y - bh);
      ctx.fill();
      if (i % 3 === 0) {
        ctx.fillStyle = i % 11 ? '#d2995860' : '#e7be86b0';
        ctx.fillRect(x + bw * 0.36, y - bh * 0.57, 1.3, 2.2);
        if (tower) ctx.fillRect(x + bw * 0.66, y - bh * 0.57, 1.3, 2.2);
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
  mesh(parent, new T.PlaneGeometry(3.75, 3.75), new T.MeshBasicMaterial({ map: moon, transparent: true, depthWrite: false, toneMapped: false }), -4.44, 5.59, -10.18);
}

function stoneTexture() {
  return drawTexture(384, 384, (ctx, w, h) => {
    const next = rng(857);
    ctx.fillStyle = '#b4adb0';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 360; i++) {
      const x = next() * w, y = next() * h, r = 5 + next() * 63;
      const wash = ctx.createRadialGradient(x, y, 0, x, y, r);
      wash.addColorStop(0, i % 3 ? '#dcd6b815' : '#443e521c');
      wash.addColorStop(1, '#8d879400');
      ctx.fillStyle = wash;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 14000; i++) {
      ctx.fillStyle = i % 2 ? '#e0dbce48' : '#453e5444';
      ctx.fillRect(next() * w, next() * h, 0.4 + next() * 2.5, 0.4 + next() * 1.2);
    }
  });
}

function makeArch(parent, center, span, height, z, stone, trim) {
  const width = span / 2;
  const spring = height * 0.65;
  const band = span > 4 ? 0.34 : 0.23;
  const coloredStone = stone.clone();
  coloredStone.vertexColors = true;
  coloredStone.side = T.DoubleSide;
  const next = rng(Math.round((center + 5) * 276));
  const tint = new T.Color();
  const masonry = [];
  function block(geometry, shade) {
    const rgb = new Float32Array(geometry.attributes.position.count * 3);
    tint.setRGB(shade, shade * 0.99, shade * 0.94);
    for (let i = 0; i < rgb.length; i += 3) tint.toArray(rgb, i);
    geometry.setAttribute('color', new T.BufferAttribute(rgb, 3));
    if (!geometry.index) geometry.setIndex(Array.from({ length: rgb.length / 3 }, (_, i) => i));
    masonry.push(geometry);
  }
  for (const side of [-1, 1]) {
    const x = center + side * (width + band * 0.32);
    const depth = span > 4 ? 0.65 : 0.49;
    const pillar = band * 1.91;
    mesh(parent, new T.BoxGeometry(pillar * 0.96, spring - 0.34, depth * 0.97), stone, x, (spring + 0.34) * 0.5, z);
    mesh(parent, new T.BoxGeometry(pillar * 1.30, 0.20, depth + 0.23), trim, x, 0.10, z);
    mesh(parent, new T.BoxGeometry(pillar * 1.13, 0.13, depth + 0.14), stone, x, 0.27, z);
    const courses = Math.ceil((spring - 0.34) / 0.37);
    const course = (spring - 0.34) / courses;
    for (let i = 0; i < courses; i++) {
      const shift = i % 2 ? 0.012 : -0.008;
      block(new T.BoxGeometry(pillar - Math.abs(shift), course - 0.014, depth)
        .translate(x + shift, 0.34 + (i + 0.5) * course, z), 0.68 + next() * 0.28);
    }
    mesh(parent, new T.BoxGeometry(pillar * 1.17, 0.12, depth + 0.15), trim, x, spring, z + 0.015);
    const point = t => {
      const s = 1 - t;
      return vec(center + side * width * (1 - t ** 2.1), spring + (height - spring) * (1 - s ** 0.91), z);
    };
    const count = span > 4 ? 14 : 9;
    const section = [[0, -0.27], [0, 0.22], [0.12, 0.30], [0.83, 0.30], [1, 0.22], [1, -0.27], [0, -0.27]];
    function archPoint(t, across, forward) {
      const p = point(t);
      const tangent = point(Math.min(1, t + 0.003)).sub(point(Math.max(0, t - 0.003))).normalize();
      return p.add(vec(side * tangent.y * band * across * (1 - ease((t - 0.88) / 0.12)), -side * tangent.x * band * across, forward));
    }
    for (let i = 0; i < count; i++) {
      const from = (i + 0.020) / count;
      const to = (i + 0.974) / count;
      block(surface(5, 6, (u, v) => {
        const [across, forward] = section[Math.round(v * 6)];
        return archPoint(mix(from, to, u), across, forward).toArray();
      }), 0.67 + next() * 0.27);
    }
    const moulding = Array.from({ length: 28 }, (_, i) => archPoint(i / 27, 0.18, 0.308));
    tube(parent, moulding, span > 4 ? 0.026 : 0.016, trim, 6, 32);
    const bead = [vec(center + side * width, 0.31, z + depth * 0.51), vec(center + side * width, spring - 0.08, z + depth * 0.51)];
    tube(parent, bead, band * 0.076, trim, 6, 6);
  }
  mesh(parent, mergeGeometries(masonry), coloredStone);
  for (const geometry of masonry) geometry.dispose();
  const finial = mesh(parent, new T.BoxGeometry(band * 0.81, band * 0.81, 0.48), trim, center, height + band * 0.19, z + 0.085);
  finial.rotation.z = Math.PI / 4;
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
  const fabric = matte('#c38f8a', { side: T.DoubleSide, vertexColors: true });
  const gold = matte('#9d7960');
  const colors = [new T.Color('#372137'), new T.Color('#804453')];
  function fold(side, u, v) {
    const gather = Math.sin(v * Math.PI) ** 2;
    const width = 1.26 - 0.48 * gather;
    const ripple = Math.sin(u * Math.PI * 15 + v * 1.55 + Math.sin(v * 5) * u);
    return [side * (5.28 - u * width + 0.13 * gather), -0.16 + v * 5.82, -1.65 + ripple * (0.165 - gather * 0.069) + u * 0.15];
  }
  for (const side of [-1, 1]) {
    const geo = surface(48, 17, (u, v) => fold(side, u, v));
    const attr = geo.attributes.uv;
    const rgb = [];
    for (let i = 0; i < attr.count; i++) {
      const t = 0.61 + Math.sin(attr.getX(i) * Math.PI * 15 + attr.getY(i) * 1.55 + Math.sin(attr.getY(i) * 5) * attr.getX(i)) * 0.32;
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

function makeVines(parent, leafMat, bloomMat, stem, center, seed, climbing = false) {
  const next = rng(seed);
  const leafGeo = surface(5, 2, (u, v) => {
    const blade = Math.sin(u * Math.PI) ** 0.84;
    return [u, (v - 0.5) * blade * 0.87, Math.sin(u * Math.PI) * (0.14 - Math.abs(v - 0.5) * 0.25)];
  });
  const roseGeo = surface(15, 3, (u, v) => {
    const angle = u * Math.PI * 2;
    const ridge = Math.cos(angle * 5 + v * 0.9);
    const radius = (0.17 + v * 0.82) * (1 + 0.16 * ridge * v);
    return [Math.cos(angle) * radius, Math.sin(angle) * radius, 0.15 + v * (0.69 - v * 0.34) + ridge * v * 0.15];
  });
  const branches = climbing ? 7 : 9;
  const leaves = new T.InstancedMesh(leafGeo, leafMat, branches * 19);
  const roses = new T.InstancedMesh(roseGeo, bloomMat, branches * 42);
  const sample = new T.Object3D();
  const color = new T.Color();
  let leafCount = 0, bloomCount = 0;
  for (let branch = 0; branch < branches; branch++) {
    const sign = branch % 2 === 0 ? -1 : 1;
    const start = center.clone().add(vec((next() - 0.5) * 0.30, 0, (next() - 0.5) * 0.24));
    const end = center.clone().add(vec(sign * (0.23 + next() * 0.51) * (climbing ? 0.58 : 1.48),
      0.42 + next() * (climbing ? 2.9 : 1.05), (next() - 0.5) * 0.41));
    const middle = start.clone().lerp(end, 0.54).add(vec(sign * -0.22, climbing ? -0.15 : 0.30, 0.13));
    const curve = new T.CatmullRomCurve3([start, middle, end]);
    mesh(parent, new T.TubeGeometry(curve, 13, 0.022 - branch * 0.0015, 5, false), stem);
    for (let i = 0; i < 19; i++) {
      const t = 0.14 + i * 0.047;
      sample.position.copy(curve.getPoint(t));
      sample.rotation.set((next() - 0.5) * 1.8, (next() - 0.5) * 1.4, (i % 2 ? 0 : Math.PI) + next() * 1.17 - 0.31);
      const s = 0.058 + next() * 0.21 * (1 - t * 0.56);
      sample.scale.set(s, s * 0.71, s);
      sample.updateMatrix();
      leaves.setMatrixAt(leafCount, sample.matrix);
      leaves.setColorAt(leafCount++, color.setHSL(0.34 + next() * 0.11, 0.23 + next() * 0.30, 0.075 + next() * 0.15));
      if (i !== 18 && (i < 6 || next() > 0.22)) continue;
      const size = 0.044 + next() * 0.044;
      sample.rotation.set((next() - 0.5) * 1.8, (next() - 0.5) * 1.6, next() * 5.7);
      for (let ring = 0; ring < 3; ring++) {
        const scale = size * (1 - ring * 0.25);
        sample.scale.set(scale, scale, size);
        sample.position.z += size * 0.17;
        sample.rotateZ(0.6);
        sample.updateMatrix();
        roses.setMatrixAt(bloomCount, sample.matrix);
        roses.setColorAt(bloomCount++, color.setHSL(0.97 + ring * 0.014, 0.36 + ring * 0.10, 0.11 + ring * 0.060 + next() * 0.05));
      }
    }
  }
  roses.count = bloomCount;
  parent.add(leaves, roses);
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
  const wallGrain = stoneTexture();
  const stone = matte('#878993', { map: wallGrain });
  const recess = matte('#303b50', { map: wallGrain });
  const trim = matte('#907d66', { map: wallGrain });
  const darkStone = matte('#4f6278', { map: wallGrain });
  makeArch(set, 0.0, 5.04, 5.32, -3.42, stone, trim);
  makeArch(set, -3.96, 2.29, 4.08, -3.47, darkStone, trim);
  makeArch(set, 3.96, 2.29, 4.08, -3.47, darkStone, trim);
  curtains(set);

  // Low wall joins the piers and catches the moonlight behind the performers.
  for (let i = 0; i < 17; i++) {
    const x = (i - 8) * 0.54;
    mesh(set, new T.BoxGeometry(0.52, 0.26, 0.40), i % 4 === 0 ? stone : darkStone, x, 0.13, -3.29);
    mesh(set, new T.BoxGeometry(0.52, 0.22, 0.40), i % 3 === 0 ? stone : darkStone, x + 0.15, 0.38, -3.29);
  }
  mesh(set, new T.BoxGeometry(9.45, 0.12, 0.52), stone, 0, 0.54, -3.27);

  const floorMap = drawTexture(1280, 768, (ctx, w, h) => {
    const next = rng(72);
    ctx.fillStyle = '#252837';
    ctx.fillRect(0, 0, w, h);
    let row = 0;
    for (let y = 0; y < h; y += 68) {
      for (let x = (row++ % 2) * 73 - 145; x < w; x += 146) {
        const light = 43 + Math.round(next() * 21);
        ctx.fillStyle = `rgb(${light + 4},${light + 2},${light + 10})`;
        ctx.fillRect(x, y, 143, 65);
        ctx.fillStyle = '#dfccc82b';
        ctx.fillRect(x, y + 1, 142, 1);
        ctx.fillRect(x + 1, y + 1, 1, 62);
        ctx.fillStyle = '#1b18234b';
        ctx.fillRect(x + 1, y + 62, 141, 2);
      }
    }
    for (let i = 0; i < 620; i++) {
      const x = next() * w, y = next() * h, r = 4 + next() * 52;
      const pitting = ctx.createRadialGradient(x, y, 0, x, y, r);
      pitting.addColorStop(0, i % 3 ? '#98999515' : '#130f241f');
      pitting.addColorStop(1, '#6c667500');
      ctx.fillStyle = pitting;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 29000; i++) {
      ctx.fillStyle = i % 2 ? '#b5a99e16' : '#14192448';
      ctx.fillRect(next() * w, next() * h, 0.6 + next() * 2.2, 0.5 + next() * 1.5);
    }
    ctx.strokeStyle = '#a5998b55';
    for (const margin of [277, 288, 992, 1003]) {
      ctx.beginPath();
      ctx.moveTo(margin, 0);
      ctx.lineTo(margin, h);
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  });
  const floor = mesh(set, new T.PlaneGeometry(15, 9), matte('#ffffff', { map: floorMap }), 0, -0.054, -0.27);
  floor.rotation.x = -Math.PI / 2;

  const balcony = group(set, 1.66, -0.03, -0.76);
  const baseTop = mesh(balcony, geometryCylinder(1.43, 1.46, 0.31, 48), recess, 0, 0.188, 0);
  baseTop.scale.z = 0.81;
  const band = mesh(balcony, geometryCylinder(1.465, 1.45, 0.075, 48), stone, 0, 0.237, 0);
  band.scale.z = 0.81;
  const walk = mesh(balcony, geometryCylinder(1.48, 1.475, 0.07, 48), darkStone, 0, 0.336, 0);
  walk.scale.z = 0.81;
  mesh(balcony, new T.BoxGeometry(1.91, 0.36, 1.97), darkStone, 0.53, 0.165, -1.29);
  for (let i = 0; i < 4; i++) {
    const riser = mesh(balcony, new T.BoxGeometry(0.91 - i * 0.065, 0.09 * (i + 1), 0.85 - i * 0.10),
      i % 2 ? darkStone : stone, -0.92 + i * 0.13, 0.043 * (i + 1), 1.10 - i * 0.16);
    riser.rotation.y = -0.50;
  }
  const rail = [];
  for (let i = 0; i <= 14; i++) {
    const a = Math.PI * (0.92 + i * 0.11);
    const x = Math.cos(a) * 1.36;
    const z = Math.sin(a) * 1.10;
    rail.push(vec(x, 1.40, z));
    const terminal = i === 0 || i === 14 || i === 8;
    lathe(balcony, [[0.35, 0.078], [0.44, 0.078], [0.49, 0.058], [0.61, 0.040], [0.76, 0.066], [0.86, 0.061],
      [1.07, 0.035], [1.24, 0.048], [1.28, 0.072], [1.39, 0.072]], stone, x, 0, z,
    terminal ? 1.26 : 1, terminal ? 1.26 : 1, 10);
    if (terminal) oval(balcony, trim, x, 1.45, z, 0.087, 0.075, 0.087);
  }
  tube(balcony, rail, 0.066, darkStone, 8, 40);
  tube(balcony, rail.map(p => p.clone().add(vec(0, 0.034, 0))), 0.038, trim, 8, 40);
  for (let i = 0; i < 12; i++) {
    const a = (0.03 + i * 0.081) * Math.PI;
    const cut = mesh(balcony, new T.BoxGeometry(0.013, 0.20, 0.025), recess, Math.cos(a) * 1.445, 0.143, Math.sin(a) * 1.168);
    cut.rotation.y = -a;
  }

  const leaf = matte('#ffffff', { side: T.DoubleSide });
  const bloom = matte('#e4c9c9', { side: T.DoubleSide });
  const stem = matte('#383726');
  makeVines(set, leaf, bloom, stem, vec(-3.27, -0.03, -1.61), 551);
  makeVines(set, leaf, bloom, stem, vec(3.42, -0.03, -1.61), 992);
  makeVines(set, leaf, bloom, stem, vec(2.89, 0.33, -1.05), 763, true);
  makeVines(set, leaf, bloom, stem, vec(-2.87, -0.04, -3.06), 731, true);
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
  const footShadows = [0, 1].map(() => radialPool(scene, 0.27, 0, -0.042, 0, '#100c17', 0.81, 0.84));
  const shadows = [
    radialPool(scene, 0.79, -1.37, -0.045, 0.28, '#100c17', 0.74, 0.65),
    radialPool(scene, 0.76, 1.31, 0.350, -0.28, '#160e1f', 0.77, 0.66),
  ];
  return { set, dust, pools, shadows, footShadows };
}

function portraitBackdrop(scene) {
  const texture = drawTexture(1200, 760, (ctx, w, h) => {
    const next = rng(149);
    ctx.fillStyle = '#111421';
    ctx.fillRect(0, 0, w, h);
    for (const [x, y, r, tint] of [
      [0.34, 0.30, 0.47, '#566073'], [0.67, 0.60, 0.37, '#384756'], [0.86, 0.20, 0.38, '#40344d'],
    ]) {
      const glow = ctx.createRadialGradient(x * w, y * h, 1, x * w, y * h, r * w);
      glow.addColorStop(0, tint);
      glow.addColorStop(1, tint + '00');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
    }
    for (let i = 0; i < 85000; i++) {
      ctx.fillStyle = i % 2 ? '#fce9d40a' : '#080d2310';
      ctx.fillRect(next() * w, next() * h, 0.6 + next() * 1.6, 0.6 + next() * 1.6);
    }
    for (let i = 0; i < 12; i++) {
      const x = next() * w, y = next() * h, r = 2 + next() * 5;
      const mote = ctx.createRadialGradient(x, y, 0, x, y, r);
      mote.addColorStop(0, i % 3 ? '#e0ad737b' : '#bdd8e354');
      mote.addColorStop(1, '#c8aa7600');
      ctx.fillStyle = mote;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  });
  return mesh(scene, new T.PlaneGeometry(9, 5.7), new T.MeshBasicMaterial({ map: texture, toneMapped: false }), 0, 2.85, -2.6);
}

function addLights(scene) {
  const sky = new T.HemisphereLight('#c0cbe1', '#a38781', 1.04);
  const key = new T.DirectionalLight('#ffe0b9', 2.25);
  key.position.set(-3.7, 4.4, 5.7);
  const fill = new T.DirectionalLight('#94b9c7', 0.89);
  fill.position.set(4.2, 1.9, 6.1);
  const rim = new T.DirectionalLight('#729bcb', 2.9);
  rim.position.set(1.8, 4.8, -4.2);
  const spot = new T.SpotLight('#8db4d7', 47, 15, 0.44, 0.76, 1.55);
  spot.position.set(0.8, 6.4, 2.0);
  scene.add(sky, key, fill, rim, spot, spot.target);
  return [key, fill, rim, spot];
}

const neutralFace = blendedExpression([{ emotion: 'neutral', intensity: 0 }]);
const colorWork = new T.Color();
const previousColor = new T.Color();
const headWorld = vec(0, 0, 0);
const footWorld = vec(0, 0, 0);

function listenerFace(emotion, intensity) {
  const reaction = {
    anger: 'fear', fear: 'fear', surprise: 'surprise', sorrow: 'sorrow', contempt: 'sorrow', joy: 'joy', disgust: 'disgust',
  }[emotion] ?? 'tender';
  return blendedExpression([{ emotion: reaction, intensity }]);
}

// Pick a preparation and stress from each clause so body and eye cues follow the text.
const phrasing = new WeakMap();
function phraseMotion(beat, local) {
  if (!phrasing.has(beat)) {
    const clauses = [];
    let first;
    let end = 0;
    for (const unit of beat.units) {
      if (!unit.punctuation) {
        first ??= unit.start;
        end = unit.end;
      } else if (unit.end - unit.start > 0.18 && first !== undefined) {
        clauses.push([first, end]);
        first = undefined;
      }
    }
    if (first !== undefined) clauses.push([first, end]);
    phrasing.set(beat, clauses);
  }
  let prep = 0, accent = 0, response = 0;
  for (const [start, end] of phrasing.get(beat)) {
    const stressed = mix(start, end, 0.64);
    const prepare = ease((local - start + 0.29) / 0.22) * (1 - ease((local - start + 0.04) / 0.29));
    const emphasis = ease((local - stressed + 0.32) / 0.32) * (1 - ease((local - stressed) / 0.34));
    const catchUp = ease((local - stressed - 0.08) / 0.30) * (1 - ease((local - end - 0.03) / 0.52));
    prep = Math.max(prep, prepare);
    accent = Math.max(accent, emphasis);
    response = Math.max(response, catchUp);
  }
  return { prep, accent, response };
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
    const phrase = phraseMotion(beat, local);
    const listenerCatch = ease((local - 0.36) / 0.65) * (1 - ease((progress - 0.85) / 0.15));
    const reception = listenerCatch * (0.25 + 0.75 * phrase.response);
    const focusPhrase = ease((progress - 0.19) / 0.26) * (1 - ease((progress - 0.68) / 0.32));
    const delivery = (phrase.accent * 0.86 - phrase.prep * 0.38) * (0.48 + intensity * 0.52);
    const next = scene.beats[beat.index + 1];
    const pickup = next && next.speaker !== beat.speaker
      ? ease((local - beat.speechEnd) / 0.48) : 0;
    for (const actor of this.actors) {
      const speaking = actor.index === active;
      const listening = !speaking && !solo;
      const listenerIntensity = 0.10 + (0.25 + 0.40 * intensity) * reception;
      const newFace = speaking ? (beat.expression ??= blendedExpression(beat.emotions)) :
        listenerFace(beat.emotion, listenerIntensity);
      const wasSpeaking = previous?.speaker === scene.slots[actor.index];
      const oldFace = wasSpeaking ? (previous.expression ??= blendedExpression(previous.emotions)) :
        previous && !solo ? listenerFace(previous.emotion, 0.10) : neutralFace;
      const expression = local >= 0.52 || portrait ? newFace : Object.fromEntries(
        Object.keys(newFace).map(key => [key, mix(oldFace[key], newFace[key], bodyBlend)]),
      );
      const actorReaches = beat.actions.includes('reach') || beat.actions.includes('point');
      const focus = solo ? 0 : listening ? 0.37 + listenerCatch * 0.26 + reception * 0.28 + pickup * 0.09 :
        mix(0.39 + (previous && !wasSpeaking ? 0.28 : 0), (actorReaches ? 0.64 : 0.43) + focusPhrase * 0.19, bodyBlend);
      actor.root.visible = !solo || speaking;
      this.set.shadows[actor.index].visible = actor.root.visible && !studioPortrait;
      if (!actor.female) {
        for (const shadow of this.set.footShadows) shadow.visible = actor.root.visible && !studioPortrait;
      }
      if (!actor.root.visible) continue;
      actor.pose({
        time: actor.index * 0.29 + time, expression, speaking: speaking && speech.talking && !portrait,
        listening, actions: speaking ? beat.actions : [], focus,
        delivery: speaking && !portrait ? delivery : 0, reaction: reception,
        pickup: listening ? pickup : previous && !wasSpeaking ? 1 - ease(local / 0.35) : 0,
        rail: actor.female && !portrait && (!solo || beat.actions.length === 0),
        progress, mouth: speaking && !portrait ? speech.mouth : MOUTH.rest, portrait: speaking && Boolean(portrait),
      });
      const shadow = this.set.shadows[actor.index];
      shadow.position.x = actor.base.x + actor.hip.position.x;
      shadow.position.z = actor.base.z + actor.hip.position.z;
      shadow.scale.setScalar(actor.female ? 1.05 : 1 + 0.24 * ease((1.68 - actor.hip.position.y) / 0.6));
      if (!actor.female && !studioPortrait) {
        for (const [index, foot] of actor.legs.entries()) {
          footWorld.set(0, -0.08, 0.09);
          foot.end.localToWorld(footWorld);
          const contact = this.set.footShadows[index];
          contact.position.x = footWorld.x;
          contact.position.z = footWorld.z;
          contact.material.opacity = 0.75 * (1 - ease((footWorld.y + 0.025) / 0.20));
        }
      }
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
      if ((beat.index === 0 && local < 1.38 && (!solo || physical)) || (kneeling && progress < 0.88) ||
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
      const wideZ = narrow ? 10.75 + (1.35 - aspect) * 5.6 : 10.22 + Math.max(0, 1.85 - aspect) * 1.16;
      this.camera.position.set(0.03 + drift, 3.40, wideZ - push * 0.23);
      aim.y = 2.34;
    } else if (shot === 'medium') {
      const center = mix(actor.base.x, headWorld.x, 0.55);
      const twoShot = !solo && aspect >= 1.62;
      if (twoShot) {
        const emphasis = headWorld.x * 0.14;
        this.camera.position.set(emphasis + drift, 2.70, 5.50 - push * 0.30);
        aim.set(emphasis, 2.43, 0.02);
      } else {
        this.camera.position.set(center + dir * 0.61 + drift, headWorld.y - 0.34,
          headWorld.z + 4.72 + (narrow ? 0.40 : 0) - push * 0.30);
        aim.set(center + dir * 0.12, headWorld.y - 0.58, headWorld.z);
      }
    } else {
      const distance = (narrow ? 2.93 : 2.77) - push * (portrait ? 0.07 : 0.19);
      this.camera.position.set(headWorld.x + dir * (portrait ? -0.30 : 0.89) + drift, headWorld.y + 0.10, headWorld.z + distance);
      aim.set(headWorld.x + dir * (narrow ? 0.01 : portrait ? 0.042 : 0.24), headWorld.y - 0.048, headWorld.z + 0.10);
    }
    this.camera.lookAt(aim);
    return shot;
  }
}
