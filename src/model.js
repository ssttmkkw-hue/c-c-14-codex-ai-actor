import * as T from 'three';
import { clamp, mix } from './performance.js';

export const vec = (x, y, z) => new T.Vector3(x, y, z);
export const material = (color, options = {}) => new T.MeshStandardMaterial({ color, roughness: 0.72, ...options });
const sphereGeometry = new T.SphereGeometry(1, 20, 14);
const detailSphere = new T.SphereGeometry(1, 10, 7);

export function mesh(parent, geometry, mat, x = 0, y = 0, z = 0) {
  const object = new T.Mesh(geometry, mat);
  object.position.set(x, y, z);
  parent.add(object);
  return object;
}

export function oval(parent, mat, x, y, z, sx, sy, sz) {
  const object = mesh(parent, Math.max(sx, sy, sz) < 0.13 ? detailSphere : sphereGeometry, mat, x, y, z);
  object.scale.set(sx, sy, sz);
  return object;
}

export function group(parent, x = 0, y = 0, z = 0) {
  const node = new T.Group();
  node.position.set(x, y, z);
  parent.add(node);
  return node;
}

export function tube(parent, points, radius, mat, radial = 6, segments = Math.max(8, points.length * 3)) {
  const curve = new T.CatmullRomCurve3(points);
  return mesh(parent, new T.TubeGeometry(curve, segments, radius, radial, false), mat);
}

export function surface(columns, rows, sample, dynamic = false) {
  const count = (columns + 1) * (rows + 1);
  const positions = new T.BufferAttribute(new Float32Array(count * 3), 3);
  const uv = new T.BufferAttribute(new Float32Array(count * 2), 2);
  const indices = [];
  for (let i = 0; i <= columns; i++) {
    for (let j = 0; j <= rows; j++) {
      const k = i * (rows + 1) + j;
      uv.setXY(k, i / columns, j / rows);
      if (i < columns && j < rows) {
        const next = k + rows + 1;
        indices.push(k, next, k + 1, next, next + 1, k + 1);
      }
    }
  }
  if (dynamic) positions.setUsage(T.DynamicDrawUsage);
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', positions);
  geometry.setAttribute('uv', uv);
  geometry.setIndex(indices);
  updateSurface(geometry, columns, rows, sample);
  return geometry;
}

export function updateSurface(geometry, columns, rows, sample) {
  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let i = 0; i <= columns; i++) {
    for (let j = 0; j <= rows; j++) {
      const k = i * (rows + 1) + j;
      const point = sample(i / columns, j / rows);
      position.setXYZ(k, point[0], point[1], point[2]);
      if (point.length === 5) uv.setXY(k, point[3], point[4]);
    }
  }
  position.needsUpdate = true;
  uv.needsUpdate = true;
  geometry.computeVertexNormals();
}

export function patch(parent, mat, columns, rows) {
  const geometry = surface(columns, rows, (u, v) => [u, v, 0], true);
  const object = mesh(parent, geometry, mat);
  object.frustumCulled = false;
  return (sample) => updateSurface(geometry, columns, rows, sample);
}

export function lathe(parent, profile, mat, x, y, z, sx = 1, sz = 1, segments = 32) {
  const object = mesh(parent, new T.LatheGeometry(profile.map(([height, radius]) => new T.Vector2(radius, height)), segments), mat, x, y, z);
  object.scale.set(sx, 1, sz);
  return object;
}

const gaussian = (x, width) => Math.exp(-((x / width) ** 2));

function shape(female) {
  const width = female ? 0.369 : 0.389;
  const radius = 0.475;
  const depth = female ? 0.336 : 0.344;
  const section = y => {
    const taper = y < -0.12 ? ((-0.12 - y) / 0.36) : 0;
    return width * (1 - taper * (female ? 0.22 : 0.11)) + 0.013 * gaussian(y + 0.075, 0.15);
  };
  function relief(x, y) {
    const abs = Math.abs(x);
    const nose = (0.129 * gaussian(y + 0.074, 0.076) + 0.072 * gaussian(y - 0.044, 0.158)) * gaussian(x, 0.071);
    const alae = 0.029 * gaussian(abs - 0.055, 0.033) * gaussian(y + 0.102, 0.043);
    const sockets = 0.035 * gaussian(abs - 0.159, 0.101) * gaussian(y - 0.070, 0.064);
    const cheeks = 0.045 * gaussian(abs - 0.223, 0.110) * gaussian(y + 0.087, 0.105);
    const glabella = 0.036 * gaussian(x, 0.108) * gaussian(y - 0.172, 0.080);
    const muzzle = 0.038 * gaussian(x, 0.159) * gaussian(y + 0.220, 0.089);
    const chin = 0.068 * gaussian(x, 0.134) * gaussian(y + 0.364, 0.066);
    return nose + alae + cheeks + glabella + muzzle + chin - sockets;
  }
  function front(x, y) {
    return depth * Math.sqrt(Math.max(0, 1 - (y / radius) ** 2 - (x / section(y)) ** 2)) + relief(x, y);
  }
  return { width, radius, depth, section, relief, front };
}

function makeSculpt(parent, anatomy, palette, female) {
  const { radius, depth, section, relief } = anatomy;
  const geometry = new T.SphereGeometry(1, 56, 38);
  const positions = geometry.attributes.position;
  const colors = new Float32Array(positions.count * 3);
  const jaw = new Float32Array(positions.count * 3);
  const sneer = new Float32Array(positions.count * 3);
  const base = new T.Color(palette.skin);
  const blush = new T.Color(female ? '#ca7a78' : '#b66d65');
  const shade = new T.Color(female ? '#9a635e' : '#9f665c');
  const vertexColor = new T.Color();
  for (let i = 0; i < positions.count; i++) {
    const oy = positions.getY(i);
    const oz = positions.getZ(i);
    const y = oy * radius;
    const x = positions.getX(i) * section(y);
    const frontness = easeFront(oz);
    const z = oz * (oz > 0 ? depth : depth * 0.94) + relief(x, y) * frontness;
    positions.setXYZ(i, x, y, z);
    const cheek = gaussian(Math.abs(x) - 0.232, 0.11) * gaussian(y + 0.089, 0.075);
    const eye = gaussian(Math.abs(x) - 0.16, 0.098) * gaussian(y - 0.105, 0.065);
    vertexColor.copy(base).lerp(blush, frontness * (0.45 * cheek + 0.20 * gaussian(x, 0.083) * gaussian(y + 0.086, 0.060)));
    vertexColor.lerp(shade, frontness * 0.40 * eye);
    vertexColor.toArray(colors, i * 3);
    const drop = frontness * clamp((-y - 0.20) * 5.2);
    jaw[i * 3 + 1] = -0.065 * drop;
    jaw[i * 3 + 2] = -0.018 * drop;
    const wrinkle = frontness * gaussian(Math.abs(x) - 0.077, 0.058) * gaussian(y + 0.106, 0.067);
    sneer[i * 3 + 1] = 0.048 * wrinkle;
    sneer[i * 3 + 2] = 0.033 * wrinkle;
  }
  geometry.setAttribute('color', new T.BufferAttribute(colors, 3));
  geometry.morphTargetsRelative = true;
  geometry.morphAttributes.position = [new T.BufferAttribute(jaw, 3), new T.BufferAttribute(sneer, 3)];
  geometry.computeVertexNormals();
  return mesh(parent, geometry, material('#ffffff', { vertexColors: true, roughness: 0.68 }));
}

function easeFront(oz) {
  return clamp(oz * 4.6);
}

function irisTexture(inner, outer) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 15, 64, 64, 64);
  gradient.addColorStop(0, '#17151b');
  gradient.addColorStop(0.30, inner);
  gradient.addColorStop(0.74, outer);
  gradient.addColorStop(0.91, '#27212b');
  gradient.addColorStop(1, '#1c1b25');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 150; i++) {
    const angle = i * 2.399963;
    const from = 24 + 17 * (0.5 + 0.5 * Math.sin(i * 24.3));
    const to = 48 + 10 * Math.cos(i * 2.7);
    ctx.strokeStyle = i % 3 === 0 ? '#ffdb9d25' : '#10142839';
    ctx.beginPath();
    ctx.moveTo(64 + Math.cos(angle) * from, 64 + Math.sin(angle) * from);
    ctx.lineTo(64 + Math.cos(angle + 0.07) * to, 64 + Math.sin(angle + 0.07) * to);
    ctx.stroke();
  }
  ctx.fillStyle = '#151521';
  ctx.beginPath();
  ctx.arc(64, 64, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff1de';
  ctx.beginPath();
  ctx.ellipse(49, 46, 9, 6, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d6e6ff9e';
  ctx.beginPath();
  ctx.arc(75, 78, 4, 0, Math.PI * 2);
  ctx.fill();
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  return texture;
}

function makeEye(parent, anatomy, palette, female, side, irisMat) {
  const cx = side * (female ? 0.153 : 0.159);
  const cy = female ? 0.069 : 0.066;
  const half = female ? 0.113 : 0.109;
  const front = anatomy.front;
  const both = { side: T.DoubleSide };
  const white = patch(parent, material('#ede1d8', { ...both, roughness: 0.46 }), 20, 5);
  const iris = patch(parent, irisMat, 18, 4);
  const crease = patch(parent, material(palette.lid, both), 18, 3);
  const lower = patch(parent, material(palette.lower, both), 18, 3);
  const lash = patch(parent, material(female ? '#332027' : '#50312d', both), 20, 2);
  const brow = patch(parent, material(palette.brow, { ...both, roughness: 0.93 }), 20, 4);
  return (expression, blink, gazeX, gazeY) => {
    const squint = expression.squint + (side === 1 ? expression.asym * 0.22 : 0);
    const open = Math.max(0.13, 1 + expression.eye * 0.78 - squint * 0.63);
    const openness = open * (1 - 0.984 * blink);
    const top = 0.047 * openness * (female ? 1.09 : 1);
    const bottom = 0.033 * openness;
    const snarl = expression.sneer * (side === 1 ? 1 : 0.22);
    const line = u => (u * side) * (female ? 0.018 : 0.008) - 0.012 * blink + 0.01 * snarl * u;
    const arc = u => Math.pow(Math.max(0, 1 - u * u), 0.74);
    const coordinates = (u, y, extra = 0) => {
      const x = cx + u * half;
      const yy = cy + y;
      const dome = arc(u) * Math.max(0, 1 - Math.abs(y - line(u)) * 2.0);
      return [x, yy, front(x, yy) + 0.008 + dome * 0.025 + extra];
    };
    const high = u => line(u) + top * arc(u);
    const low = u => line(u) - bottom * arc(u);
    white((s, t) => {
      const u = s * 2 - 1;
      return coordinates(u, mix(low(u), high(u), t));
    });
    const rr = female ? 0.055 : 0.051;
    const dx = gazeX * 0.052;
    const dy = gazeY * 0.033;
    iris((s, t) => {
      const ix = s * 2 - 1;
      const u = (dx + ix * rr) / half;
      const range = rr * Math.sqrt(Math.max(0, 1 - ix * ix));
      const base = clamp(dy - range, low(u), high(u));
      const cap = clamp(dy + range, low(u), high(u));
      const y = mix(base, cap, t);
      return [...coordinates(u, y, 0.0035), s, 0.5 + (y - dy) / (2 * rr)];
    });
    crease((s, t) => {
      const u = s * 2 - 1;
      const a = arc(u);
      const y = high(u) + t * a * (0.027 + blink * 0.025);
      const point = coordinates(u, y, 0.001 + 0.006 * Math.sin(t * Math.PI) * a);
      const x = point[0];
      return [x, point[1], mix(point[2], front(x, point[1]) + 0.004, t)];
    });
    lower((s, t) => {
      const u = s * 2 - 1;
      const y = low(u) - t * arc(u) * (0.020 + squint * 0.010);
      const point = coordinates(u, y, 0.002);
      return [point[0], point[1], mix(point[2], front(point[0], point[1]) + 0.007, t * 0.76)];
    });
    lash((s, t) => {
      const u = s * 2 - 1;
      const taper = arc(u) * (1 + u * side * 0.43);
      return coordinates(u, high(u) + (t - 0.25) * (female ? 0.014 : 0.009) * taper, 0.003);
    });
    brow((s, t) => {
      const u = s * 2 - 1;
      const outward = (1 + side * u) * 0.5;
      const pull = expression.knit * (1 - outward);
      const x = cx + u * 0.136 + side * (0.003 - pull * 0.023);
      const center = cy + 0.117 + 0.032 * Math.sin(outward * Math.PI * 0.94) +
        (1 - outward) * (expression.inner * 0.090 - expression.knit * 0.066) +
        outward * (expression.outer * 0.065 + (side > 0 ? expression.asym * 0.064 : 0)) + snarl * 0.018;
      const thickness = (female ? 0.023 : 0.034) * Math.pow(Math.sin(s * Math.PI), 0.65) * (1.3 - outward * 0.66);
      const y = center + (t - 0.5) * thickness;
      return [x, y, front(x, y) + 0.014 + Math.sin(t * Math.PI) * 0.012 * arc(u)];
    });
  };
}

function makeMouth(parent, anatomy, palette, female) {
  const both = { side: T.DoubleSide };
  const cavity = patch(parent, material('#3d1a24', both), 20, 5);
  const teeth = patch(parent, material('#f0dcd0', { ...both, roughness: 0.43 }), 16, 3);
  const tongue = patch(parent, material('#a35866', both), 14, 3);
  const upper = patch(parent, material(palette.lip, { ...both, roughness: 0.57 }), 24, 6);
  const lower = patch(parent, material(palette.lowerLip, { ...both, roughness: 0.49 }), 24, 6);
  const upperShade = patch(parent, material(palette.lipShade, both), 20, 3);
  const lowerShade = patch(parent, material(palette.lower, both), 20, 3);
  return (e, m) => {
    const [jaw, spread, round, seal, showTeeth] = m;
    const drop = clamp((e.open * 0.60 + jaw * 0.88) * (1 - seal * 0.97), 0, 1.08);
    const width = (female ? 0.137 : 0.149) * (1 + spread * 0.30 - round * 0.35 + e.smile * 0.18 + e.stretch * 0.22);
    const center = -0.224 - drop * 0.009;
    const arc = u => Math.pow(Math.max(0, 1 - u * u), 0.76);
    const contour = u => center + (e.smile * 0.084 - e.frown * 0.075) * u * u +
      e.asym * 0.065 * Math.max(0, u) + e.sneer * 0.059 * Math.max(0, u) * arc(u);
    const high = u => contour(u) + (0.003 + drop * 0.034 + e.sneer * 0.029) * arc(u);
    const low = u => contour(u) - (0.003 + drop * 0.115) * arc(u);
    function p(u, y, ridge) {
      const x = u * width + e.asym * 0.010;
      return [x, y, anatomy.front(x, y) + 0.005 + ((0.025 + round * 0.055) * arc(u) + ridge) * arc(u)];
    }
    cavity((s, t) => {
      const u = s * 2 - 1;
      return p(u, mix(low(u), high(u), t), 0.005 - Math.sin(t * Math.PI) * 0.027);
    });
    teeth((s, t) => {
      const u = (s * 2 - 1) * 0.80;
      const toothDrop = Math.min((high(u) - low(u)) * 0.77, (0.011 + showTeeth * 0.046 + e.smile * 0.012) * (1 - seal));
      return p(u, high(u) - toothDrop * t * arc(u), 0.009);
    });
    tongue((s, t) => {
      const u = (s * 2 - 1) * 0.68;
      return p(u, low(u) + t * drop * 0.030 * arc(u), -0.007);
    });
    upper((s, t) => {
      const u = s * 2 - 1;
      const cupid = 0.8 + 0.41 * gaussian(Math.abs(u) - 0.26, 0.25);
      return p(u, high(u) + t * (female ? 0.031 : 0.024) * arc(u) * cupid, 0.013 + Math.sin(t * Math.PI) * 0.018);
    });
    lower((s, t) => {
      const u = s * 2 - 1;
      return p(u, low(u) - t * (female ? 0.037 : 0.028) * arc(u), 0.009 + Math.sin(t * Math.PI) * 0.029);
    });
    upperShade((s, t) => {
      const u = s * 2 - 1;
      const y = high(u) + (0.019 + t * 0.020) * arc(u);
      return p(u, y, (1 - t) * 0.010 - t * 0.023);
    });
    lowerShade((s, t) => {
      const u = s * 2 - 1;
      return p(u, low(u) - (0.025 + t * 0.022) * arc(u), (1 - t) * 0.009 - t * 0.022);
    });
    return drop;
  };
}

function makeHair(parent, anatomy, palette, female) {
  const mat = material(palette.hair, { roughness: 0.63, side: T.DoubleSide });
  const locks = palette.locks.map(color => material(color, { roughness: 0.66, side: T.DoubleSide }));
  const threads = material(palette.thread, { roughness: 0.72 });
  function cap(s, v) {
    const angle = 2 * Math.PI * s;
    const frontal = Math.max(0, Math.cos(angle));
    const edge = mix(female ? 2.15 : 1.97, female ? 1.18 : 1.19, frontal ** 0.52) +
      (!female ? 0.16 * Math.sin(angle - 0.26) * frontal : 0.04 * Math.cos(angle * 4));
    const phi = v * edge;
    const wave = 1 + 0.018 * Math.sin(angle * 11 + phi * 5);
    return vec(
      anatomy.width * 1.075 * Math.sin(phi) * Math.sin(angle) * wave,
      0.046 + anatomy.radius * 1.12 * Math.cos(phi) * wave,
      (anatomy.depth + 0.053) * Math.sin(phi) * Math.cos(angle) * wave - 0.018,
    );
  }
  mesh(parent, surface(52, 18, (s, v) => cap(s, v).toArray()), mat);
  for (let index = 0; index < 28; index++) {
    const start = index / 28;
    const points = [];
    for (let j = 0; j <= 10; j++) {
      const v = 0.17 + j * 0.078;
      const point = cap(start - (1 - v) * (female ? 0.075 : 0.122), v);
      point.multiplyScalar(1.0035);
      points.push(point);
    }
    tube(parent, points, index % 3 === 0 ? 0.0026 : 0.0018, threads, 4, 12);
  }
  function lock(points, size, index) {
    const curve = new T.CatmullRomCurve3(points);
    mesh(parent, surface(16, 10, (u, v) => {
      const point = curve.getPoint(u);
      const tangent = curve.getTangent(u);
      const widthAxis = new T.Vector3().crossVectors(tangent, vec(0, 0, 1)).normalize();
      const depthAxis = new T.Vector3().crossVectors(widthAxis, tangent).normalize();
      const angle = v * Math.PI * 2;
      const taper = Math.sin(Math.PI * (0.08 + u * 0.90)) ** 0.67;
      point.addScaledVector(widthAxis, taper * Math.cos(angle) * size);
      point.addScaledVector(depthAxis, taper * Math.sin(angle) * size * 0.68);
      return point.toArray();
    }), locks[index % locks.length]);
    tube(parent, points.map((point, i) => point.clone().add(vec(0, 0, size * (i === points.length - 1 ? 0.06 : 0.47)))), 0.0023, threads, 5);
  }
  if (female) {
    const bun = oval(parent, locks[1], 0.024, 0.302, -0.333, 0.229, 0.222, 0.183);
    bun.rotation.z = -0.25;
    for (let i = 0; i < 8; i++) {
      const angle = i * 0.82;
      lock([vec(0.02, 0.34, -0.38), vec(Math.cos(angle) * 0.14, 0.32 + Math.sin(angle) * 0.17, -0.51),
        vec(Math.cos(angle + 0.9) * 0.195, 0.30 + Math.sin(angle + 0.9) * 0.18, -0.46),
        vec(Math.cos(angle + 1.35) * 0.19, 0.30 + Math.sin(angle + 1.35) * 0.13, -0.33)], 0.035, i);
    }
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        lock([vec(side * (0.025 + i * 0.015), 0.485 + i * 0.012, 0.14 - i * 0.028),
          vec(side * (0.17 + i * 0.021), 0.421 - i * 0.008, 0.25 - i * 0.024),
          vec(side * (0.288 + i * 0.018), 0.307 - i * 0.021, 0.244 - i * 0.035),
          vec(side * (0.358 + i * 0.007), 0.087 - i * 0.012, 0.091 - i * 0.035)], 0.050 + i * 0.003, i);
      }
      lock([vec(side * 0.304, 0.34, 0.142), vec(side * 0.371, 0.173, 0.153),
        vec(side * 0.358, -0.077, 0.151), vec(side * 0.315, -0.239, 0.187),
        vec(side * 0.332, -0.313, 0.114)], 0.043, side + 1);
    }
  } else {
    for (let i = 0; i < 9; i++) {
      lock([vec(-0.272 - i * 0.009, 0.272 - i * 0.009, 0.175 - i * 0.023),
        vec(-0.213 + i * 0.007, 0.473 - i * 0.013, 0.246 - i * 0.031),
        vec(0.075 + i * 0.021, 0.525 - i * 0.008, 0.224 - i * 0.022),
        vec(0.308 + i * 0.006, 0.332 + i * 0.009, 0.243 - i * 0.040),
        vec(0.356, 0.194 + i * 0.020, 0.179 - i * 0.034)], 0.058 + i * 0.002, i);
    }
    lock([vec(-0.258, 0.337, 0.249), vec(-0.125, 0.423, 0.326),
      vec(0.060, 0.363, 0.363), vec(0.178, 0.291, 0.292)], 0.055, 1);
    for (const side of [-1, 1]) {
      lock([vec(side * 0.32, 0.345, 0.140), vec(side * 0.386, 0.211, 0.085),
        vec(side * 0.380, 0.070, 0.072), vec(side * 0.344, -0.102, 0.103)], 0.045, side + 1);
    }
  }
}

export function makeFace(parent, palette, female) {
  const anatomy = shape(female);
  const sculpt = makeSculpt(parent, anatomy, palette, female);
  const skin = material(palette.skin);
  const earInside = material(palette.lower);
  const nostril = material(palette.nostril);
  const gold = material('#bd9256', { metalness: 0.56, roughness: 0.32 });
  const pearl = material('#f8d3b4', { roughness: 0.24 });
  for (const side of [-1, 1]) {
    const ear = oval(parent, skin, side * (female ? 0.359 : 0.379), -0.049, -0.014, 0.066, 0.124, 0.059);
    ear.rotation.z = -side * 0.20;
    const well = oval(parent, earInside, side * (female ? 0.389 : 0.409), -0.053, 0.027, 0.029, 0.079, 0.024);
    well.rotation.z = ear.rotation.z;
    const nose = oval(parent, nostril, side * 0.052, -0.128, anatomy.front(side * 0.052, -0.128) - 0.005, 0.018, 0.006, 0.010);
    nose.rotation.z = side * 0.23;
    if (female) {
      oval(parent, gold, side * 0.393, -0.144, 0.041, 0.024, 0.027, 0.02);
      oval(parent, gold, side * 0.393, -0.188, 0.046, 0.009, 0.039, 0.009);
      oval(parent, pearl, side * 0.393, -0.228, 0.051, 0.025, 0.035, 0.022);
    }
  }
  makeHair(parent, anatomy, palette, female);
  const iris = material('#ffffff', { map: irisTexture(...palette.iris), side: T.DoubleSide, roughness: 0.52 });
  const eyes = [-1, 1].map(side => makeEye(parent, anatomy, palette, female, side, iris));
  const mouth = makeMouth(parent, anatomy, palette, female);
  return (expression, viseme, blink, gazeX, gazeY) => {
    for (const eye of eyes) eye(expression, blink, gazeX, gazeY);
    const jaw = mouth(expression, viseme);
    sculpt.morphTargetInfluences[0] = jaw;
    sculpt.morphTargetInfluences[1] = expression.sneer;
  };
}
