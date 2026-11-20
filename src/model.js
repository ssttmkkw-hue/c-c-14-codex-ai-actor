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
  let movedUV = false;
  for (let i = 0; i <= columns; i++) {
    for (let j = 0; j <= rows; j++) {
      const k = i * (rows + 1) + j;
      const point = sample(i / columns, j / rows);
      position.setXYZ(k, point[0], point[1], point[2]);
      if (point.length === 5) {
        uv.setXY(k, point[3], point[4]);
        movedUV = true;
      }
    }
  }
  position.needsUpdate = true;
  if (movedUV) uv.needsUpdate = true;
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
  const width = female ? 0.344 : 0.362;
  const radius = female ? 0.464 : 0.476;
  const depth = female ? 0.317 : 0.328;
  const section = y => {
    const taper = clamp((-y - 0.08) / 0.40);
    const temple = gaussian(y - 0.18, 0.16);
    return width * (1 - taper * (female ? 0.25 : 0.16) - temple * 0.055) + 0.014 * gaussian(y + 0.055, 0.10);
  };
  function relief(x, y) {
    const abs = Math.abs(x);
    const bridge = (female ? 0.047 : 0.075) * gaussian(y - 0.026, 0.143) * gaussian(x, 0.046);
    const tip = (female ? 0.085 : 0.099) * gaussian(y + 0.072, 0.058) * gaussian(x, female ? 0.065 : 0.066);
    const alae = 0.022 * gaussian(abs - 0.055, 0.039) * gaussian(y + 0.098, 0.046);
    const sockets = 0.038 * gaussian(abs - 0.153, 0.097) * gaussian(y - 0.069, 0.071);
    const cheeks = (female ? 0.032 : 0.035) * gaussian(abs - 0.214, 0.092) * gaussian(y + 0.053, 0.113);
    const brow = (female ? 0.016 : 0.027) * gaussian(abs - 0.10, 0.14) * gaussian(y - 0.153, 0.048);
    const philtrum = -0.008 * gaussian(x, 0.016) * gaussian(y + 0.168, 0.035);
    const muzzle = 0.037 * gaussian(x, 0.131) * gaussian(y + 0.213, 0.083);
    const chin = (female ? 0.043 : 0.060) * gaussian(x, female ? 0.119 : 0.158) * gaussian(y + 0.368, 0.084);
    const jaw = (female ? 0.007 : 0.025) * gaussian(abs - 0.211, 0.077) * gaussian(y + 0.276, 0.105);
    return bridge + tip + alae + cheeks + brow + philtrum + muzzle + chin + jaw - sockets;
  }
  function front(x, y) {
    return depth * Math.sqrt(Math.max(0, 1 - (y / radius) ** 2 - (x / section(y)) ** 2)) + relief(x, y);
  }
  return { width, radius, depth, section, relief, front };
}

const jawWeight = y => clamp((-y - 0.205) * 5.2);
const cheekWeight = (x, y) => gaussian(Math.abs(x) - 0.178, 0.096) * gaussian(y + 0.133, 0.111);
const noseWeight = (x, y) => gaussian(x - 0.064, 0.063) * gaussian(y + 0.103, 0.056);

function makeSculpt(parent, anatomy, palette, female) {
  const { radius, depth, section, relief } = anatomy;
  const geometry = new T.SphereGeometry(1, 64, 42);
  const positions = geometry.attributes.position;
  const colors = new Float32Array(positions.count * 3);
  const jaw = new Float32Array(positions.count * 3);
  const sneer = new Float32Array(positions.count * 3);
  const cheekLift = new Float32Array(positions.count * 3);
  const base = new T.Color(palette.skin);
  const blush = new T.Color(female ? '#bd766c' : '#ad6d5b');
  const shade = new T.Color(female ? '#9a605c' : '#936255');
  const vertexColor = new T.Color();
  for (let i = 0; i < positions.count; i++) {
    const oy = positions.getY(i);
    const oz = positions.getZ(i);
    const y = oy * radius;
    const x = positions.getX(i) * section(y);
    const frontness = easeFront(oz);
    const z = oz * (oz > 0 ? depth : depth * 0.94) + relief(x, y) * frontness;
    positions.setXYZ(i, x, y, z);
    const cheek = gaussian(Math.abs(x) - 0.219, 0.092) * gaussian(y + 0.070, 0.081);
    const eye = gaussian(Math.abs(x) - 0.153, 0.108) * gaussian(y - 0.055, 0.093);
    const chin = gaussian(y + 0.345, 0.102) * gaussian(x, 0.235);
    const grain = Math.sin(x * 188 + y * 139) * Math.sin(y * 283 - z * 133);
    vertexColor.copy(base).lerp(blush, frontness * ((female ? 0.55 : 0.42) * cheek + 0.19 * gaussian(x, 0.081) * gaussian(y + 0.089, 0.062)));
    vertexColor.lerp(shade, frontness * (0.31 * eye + (female ? 0.10 : 0.21) * chin));
    vertexColor.multiplyScalar(1 + 0.022 * grain);
    vertexColor.toArray(colors, i * 3);
    const drop = frontness * jawWeight(y);
    jaw[i * 3 + 1] = -0.074 * drop;
    jaw[i * 3 + 2] = -0.021 * drop;
    const wrinkle = frontness * noseWeight(x, y);
    sneer[i * 3 + 1] = 0.024 * wrinkle;
    sneer[i * 3 + 2] = 0.013 * wrinkle;
    const cheekMotion = frontness * cheekWeight(x, y);
    cheekLift[i * 3 + 1] = 0.021 * cheekMotion;
    cheekLift[i * 3 + 2] = 0.012 * cheekMotion;
  }
  geometry.setAttribute('color', new T.BufferAttribute(colors, 3));
  geometry.morphTargetsRelative = true;
  geometry.morphAttributes.position = [new T.BufferAttribute(jaw, 3), new T.BufferAttribute(sneer, 3), new T.BufferAttribute(cheekLift, 3)];
  geometry.computeVertexNormals();
  return mesh(parent, geometry, material('#ffffff', { vertexColors: true, roughness: 0.78 }));
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
  ctx.ellipse(49, 46, 7, 4, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d6e6ff85';
  ctx.beginPath();
  ctx.arc(75, 78, 3, 0, Math.PI * 2);
  ctx.fill();
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  return texture;
}

// The outer edge of the lid and lip patches feathers into the sculpt.
function shadedPatch(parent, columns, rows, shade, options = {}) {
  const geometry = surface(columns, rows, (u, v) => [u, v, 0], true);
  const colors = new Float32Array((columns + 1) * (rows + 1) * 4);
  const color = new T.Color();
  for (let i = 0; i <= columns; i++) {
    for (let j = 0; j <= rows; j++) {
      const [tint, alpha] = shade(i / columns, j / rows);
      const index = (i * (rows + 1) + j) * 4;
      color.set(tint).toArray(colors, index);
      colors[index + 3] = alpha;
    }
  }
  geometry.setAttribute('color', new T.BufferAttribute(colors, 4));
  const mat = material('#ffffff', { side: T.DoubleSide, vertexColors: true, ...options });
  const object = mesh(parent, geometry, mat);
  object.frustumCulled = false;
  return sample => updateSurface(geometry, columns, rows, sample);
}

function browTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 32);
  ['#ffffff00', '#ffffffc9', '#fffffff2', '#ffffff00'].forEach((color, i) => grad.addColorStop(i / 3, color));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 32);
  for (let i = 2; i < 128; i += 2) {
    const edge = 24 + 4 * Math.sin(i * 22.1);
    ctx.strokeStyle = i % 3 ? '#ffffff8c' : '#ffffff46';
    ctx.beginPath();
    ctx.moveTo(i - 5, edge);
    ctx.quadraticCurveTo(i - 3, 10, i + 3, 3 + 3 * Math.cos(i * 11));
    ctx.stroke();
  }
  return new T.CanvasTexture(canvas);
}

function makeEye(parent, anatomy, palette, female, side, irisMat, browMap) {
  const cx = side * (female ? 0.144 : 0.146);
  const cy = female ? 0.070 : 0.065;
  const half = female ? 0.098 : 0.093;
  const front = anatomy.front;
  const both = { side: T.DoubleSide };
  const white = shadedPatch(parent, 22, 6, (s, t) => {
    const shade = Math.max(0, (t - 0.50) * 1.33) + 0.74 * Math.abs(s * 2 - 1) ** 5;
    return [new T.Color('#e8ded2').lerp(new T.Color('#a87d77'), clamp(shade)), 1];
  }, { roughness: 0.7 });
  const iris = patch(parent, irisMat, 22, 6);
  const feather = { transparent: true, depthWrite: false, forceSinglePass: true };
  const lid = (upper) => shadedPatch(parent, 22, 6, (s, t) => {
    const edge = new T.Color(upper ? palette.lid : palette.lower);
    const color = new T.Color(palette.skin).lerp(edge, (1 - t) ** 0.63);
    const opacity = (1 - easeEdge(t, 0.59)) * (1 - Math.abs(s * 2 - 1) ** 8);
    return [color, opacity];
  }, { ...feather, roughness: 0.78 });
  const upper = lid(true);
  const lower = lid(false);
  const lash = shadedPatch(parent, 24, 3, (s, t) => [
    female ? '#352126' : '#553529', Math.sin(t * Math.PI) ** 0.7 * Math.sin(s * Math.PI) ** 0.5,
  ], feather);
  const brow = patch(parent, material(palette.brow, { ...both, map: browMap, ...feather, roughness: 0.98 }), 24, 5);
  return (expression, blink, gazeX, gazeY) => {
    const asym = side > 0 ? expression.asym : 0;
    const snarl = expression.sneer * (side === 1 ? 1 : 0.20);
    const squint = expression.squint + asym * 0.23;
    const open = Math.max(0.14, 1 + expression.eye * 0.61 - squint * 0.35);
    const top = 0.040 * open * (1 - 0.98 * blink) * (female ? 1.10 : 1);
    const bottom = 0.023 * open * (1 - 0.98 * blink) * (1 - squint * 0.56);
    const line = u => u * side * (female ? 0.010 : 0.004) - 0.019 * blink + 0.007 * snarl + 0.007 * squint;
    const arc = u => Math.max(0, 1 - u * u) ** 0.78;
    const coordinates = (u, y, bulge, extra = 0) => {
      const x = cx + u * half;
      const yy = cy + y;
      return [x, yy, front(x, yy) + 0.002 + bulge + extra];
    };
    const dome = (u, y) => arc(u) * Math.max(0, 1 - Math.abs(y - line(u)) * 6.1) * 0.018;
    const high = u => line(u) + top * arc(u) * (1 - u * side * 0.17);
    const low = u => line(u) - bottom * arc(u) * (1 + u * side * 0.12);
    white((s, t) => {
      const u = s * 2 - 1;
      const y = mix(low(u), high(u), t);
      return coordinates(u, y, dome(u, y));
    });
    const rr = (female ? 0.042 : 0.038) * (1 - clamp(expression.eye) * 0.068);
    const dx = gazeX * 0.049;
    const dy = gazeY * 0.032 + 0.007;
    iris((s, t) => {
      const ix = s * 2 - 1;
      const u = (dx + ix * rr) / half;
      const range = rr * Math.sqrt(Math.max(0, 1 - ix * ix));
      const y = mix(clamp(dy - range, low(u), high(u)), clamp(dy + range, low(u), high(u)), t);
      return [...coordinates(u, y, dome(u, y), 0.0028), s, 0.5 + (y - dy) / (2 * rr)];
    });
    const drawLid = (s, t, isUpper) => {
      const u = s * 2 - 1;
      const edge = isUpper ? high(u) : low(u);
      const distance = isUpper ? 0.041 + blink * 0.066 : -0.034 - squint * 0.010;
      const y = edge + (distance * t - (isUpper ? 0.0018 : -0.0016)) * arc(u);
      const fold = Math.sin(Math.PI * t) * (isUpper ? 0.010 : 0.006) * arc(u);
      return coordinates(u, y, (dome(u, edge) + 0.004) * (1 - t) + fold);
    };
    upper((s, t) => drawLid(s, t, true));
    lower((s, t) => drawLid(s, t, false));
    lash((s, t) => {
      const u = s * 2 - 1;
      const y = high(u) + (t - 0.35) * (female ? 0.010 : 0.006) * arc(u) * (1 + u * side * 0.34);
      return coordinates(u, y, dome(u, y), 0.0065);
    });
    brow((s, t) => {
      const u = (s * 2 - 1) * side;
      const outward = s;
      const pull = expression.knit * (1 - outward);
      const x = cx + u * 0.106 - side * pull * 0.016;
      const center = cy + 0.093 + 0.029 * Math.sin(outward * Math.PI * 0.96) +
        (1 - outward) * (expression.inner * 0.059 - expression.knit * 0.043) +
        outward * (expression.outer * 0.044 + asym * 0.053) + snarl * 0.008;
      const thickness = (female ? 0.017 : 0.027) * Math.sin(outward * Math.PI) ** 0.39 * (1.30 - outward * 0.68);
      const y = center + (t - 0.5) * thickness;
      return [x, y, front(x, y) + 0.003 + Math.sin(t * Math.PI) * 0.004];
    });
  };
}

function easeEdge(value, start) {
  const t = clamp((value - start) / (1 - start));
  return t * t * (3 - 2 * t);
}

function makeMouth(parent, anatomy, palette, female) {
  const both = { side: T.DoubleSide };
  const cavity = shadedPatch(parent, 28, 7, (s, t) => [
    new T.Color('#2f1418').lerp(new T.Color('#09070c'), Math.sin(t * Math.PI) ** 0.6), 1,
  ], { roughness: 0.94 });
  const teeth = shadedPatch(parent, 40, 5, (s, t) => {
    const seam = Math.abs(Math.sin(s * Math.PI * 8)) ** 18;
    const tint = new T.Color('#e7d4bc').lerp(new T.Color('#935b50'), 0.28 * seam + 0.16 * (1 - t));
    return [tint, 1];
  }, { roughness: 0.68 });
  const tongue = patch(parent, material('#90454a', { ...both, roughness: 0.65 }), 20, 4);
  const lip = (isUpper) => shadedPatch(parent, 26, 7, (s, t) => {
    const pigment = new T.Color(isUpper ? palette.lip : palette.lowerLip);
    const edge = new T.Color(t < 0.40 ? '#763a35' : palette.skin);
    const color = pigment.lerp(edge, t < 0.40 ? (1 - t / 0.40) * 0.51 : (t - 0.40) * 0.58);
    return [color, (1 - easeEdge(t, 0.66)) * (1 - Math.abs(s * 2 - 1) ** 10)];
  }, { transparent: true, depthWrite: false, forceSinglePass: true, roughness: 0.68 });
  const upper = lip(true);
  const lower = lip(false);
  return (e, m) => {
    const [jaw, spread, articulation, seal, showTeeth] = m;
    const drop = clamp((e.open * 0.56 + jaw * 0.85) * (1 - seal * 0.995), 0, 1.03);
    const round = clamp(articulation + e.round);
    const width = (female ? 0.116 : 0.127) * (1 + spread * 0.27 - round * 0.47 + e.smile * 0.17 + e.stretch * 0.27);
    const center = -0.206 - drop * 0.018;
    const arc = u => Math.max(0, 1 - u * u) ** mix(0.76, 0.50, round);
    const contour = u => center + (e.smile * 0.059 - e.frown * 0.050) * u * u +
      e.asym * 0.042 * Math.max(0, u) + e.sneer * 0.033 * Math.max(0, u) * arc(u);
    const high = u => contour(u) + (0.0014 + drop * 0.041 + e.sneer * 0.032 * (1 - seal * 0.9) * (0.62 + u * 0.38)) * arc(u);
    const low = u => contour(u) - (0.0014 + drop * 0.088) * arc(u);
    function p(u, y, ridge) {
      const x = u * width + e.asym * 0.006;
      const cheek = cheekWeight(x, y) * e.smile;
      const snarl = noseWeight(x, y) * e.sneer;
      const behind = jawWeight(y) * drop;
      return [x, y - 0.074 * behind + 0.021 * cheek + 0.024 * snarl,
        anatomy.front(x, y) - 0.021 * behind + 0.012 * cheek + 0.013 * snarl +
        0.0028 + ((0.014 + round * 0.039) * arc(u) + ridge) * arc(u)];
    }
    cavity((s, t) => {
      const u = s * 2 - 1;
      return p(u, mix(low(u), high(u), t), 0.001 - Math.sin(t * Math.PI) * 0.009);
    });
    teeth((s, t) => {
      const u = (s * 2 - 1) * 0.83;
      const taper = Math.sin(s * Math.PI) ** 0.46;
      const gap = high(u) - low(u);
      const exposed = clamp((drop + e.sneer * 0.09 - 0.047) * 9) * (1 - seal);
      const toothDrop = Math.min(gap * 0.63, (0.008 + showTeeth * 0.029 + e.smile * 0.014) * exposed);
      return p(u, high(u) - exposed * 0.003 - toothDrop * t * taper, 0.0048);
    });
    tongue((s, t) => {
      const u = (s * 2 - 1) * 0.63;
      return p(u, low(u) + t * drop * 0.021 * arc(u), 0.0030);
    });
    upper((s, t) => {
      const u = s * 2 - 1;
      const cupid = 0.87 + 0.28 * gaussian(Math.abs(u) - 0.24, 0.21);
      return p(u, high(u) + t * (female ? 0.026 : 0.023) * arc(u) * cupid,
        0.009 + Math.sin(t * Math.PI) * 0.006 - t * 0.013);
    });
    lower((s, t) => {
      const u = s * 2 - 1;
      return p(u, low(u) - t * (female ? 0.032 : 0.028) * arc(u),
        0.008 + Math.sin(t * Math.PI) * 0.010 - t * 0.014);
    });
    return drop;
  };
}

function makeHair(parent, anatomy, palette, female) {
  const hair = material('#ffffff', { roughness: 0.69, side: T.DoubleSide, vertexColors: true });
  const dark = new T.Color(palette.hair);
  const highlights = palette.locks.map(tint => new T.Color(tint));
  const stroke = material(palette.thread, { roughness: 0.73 });
  function sculptHair(columns, rows, sample, tint) {
    const geometry = surface(columns, rows, sample);
    const color = new T.Color();
    const uv = geometry.attributes.uv;
    const colors = new Float32Array(uv.count * 3);
    for (let i = 0; i < uv.count; i++) {
      const u = uv.getX(i), v = uv.getY(i);
      const strands = Math.sin(v * 91 + Math.sin(u * 7) * 0.91) * 0.19 + Math.cos(v * 213 + u * 0.85) * 0.10;
      color.copy(dark).lerp(tint, clamp(0.57 + strands + Math.sin(u * 5 + v * 9) * 0.13));
      color.toArray(colors, i * 3);
    }
    geometry.setAttribute('color', new T.BufferAttribute(colors, 3));
    mesh(parent, geometry, hair);
  }
  function cap(v, u) {
    const azimuth = Math.PI * 2 * v;
    const frontal = Math.max(0, Math.cos(azimuth));
    const edge = mix(female ? 1.93 : 1.80, female ? 1.077 : 1.085, frontal ** 0.39) +
      (female ? 0.036 * Math.cos(azimuth * 5) : 0.091 * Math.sin(azimuth - 0.23)) * frontal;
    const phi = u * edge;
    const angle = azimuth + (female ? 0.20 : 0.61) * (1 - u) ** 1.7;
    const comb = Math.sin(azimuth * 25 + Math.sin(u * Math.PI) * 0.57);
    const wave = 1 + (0.018 * Math.sin(azimuth * 8 + phi * 4) + comb * 0.0055) * Math.sin(u * Math.PI * 0.77);
    const x = anatomy.width * 1.09 * Math.sin(phi) * Math.sin(angle) * wave;
    const y = 0.034 + anatomy.radius * (female ? 1.09 : 1.10) * Math.cos(phi) * wave;
    const z = (anatomy.depth + 0.061) * Math.sin(phi) * Math.cos(angle) * wave - 0.012;
    const nape = (1 - frontal) * (0.39 + 0.61 * Math.max(0, -Math.cos(azimuth)));
    const hairline = easeEdge(u, 0.72) * frontal ** 0.5;
    return vec(x, y - nape * u * 0.041, mix(z, anatomy.front(x, y) + 0.012 + comb * 0.002, hairline));
  }
  sculptHair(22, 96, (u, v) => cap(v, u).toArray(), highlights[0]);

  function lock(points, width, thickness, index, curl = 0) {
    const curve = new T.CatmullRomCurve3(points);
    sculptHair(18, 16, (u, v) => {
      const point = curve.getPoint(u);
      const tangent = curve.getTangent(u);
      const wide = new T.Vector3().crossVectors(tangent, vec(0, 0, 1)).normalize();
      const out = new T.Vector3().crossVectors(wide, tangent).normalize();
      const angle = v * Math.PI * 2 + curl * u;
      const taper = Math.sin(Math.PI * (0.09 + u * 0.91)) ** 0.62;
      const comb = 1 + Math.cos(v * Math.PI * 12 + u * 2.5) * 0.062;
      return point.addScaledVector(wide, Math.cos(angle) * width * taper * comb)
        .addScaledVector(out, Math.sin(angle) * thickness * taper * comb).toArray();
    }, highlights[index % highlights.length]);
  }
  if (female) {
    const bun = oval(parent, material(palette.hair, { roughness: 0.83 }), 0.034, 0.249, -0.309, 0.224, 0.196, 0.169);
    bun.rotation.z = -0.25;
    for (let i = 0; i < 7; i++) {
      const angle = i * 0.90;
      lock([vec(0.04, 0.26, -0.38), vec(Math.cos(angle) * 0.14, 0.26 + Math.sin(angle) * 0.14, -0.449),
        vec(Math.cos(angle + 0.9) * 0.189, 0.26 + Math.sin(angle + 0.9) * 0.16, -0.42),
        vec(Math.cos(angle + 1.35) * 0.16, 0.27 + Math.sin(angle + 1.35) * 0.13, -0.31)], 0.043, 0.025, i);
    }
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        lock([vec(0.043 + side * i * 0.013, 0.493 + i * 0.010, 0.157 - i * 0.067),
          vec(side * (0.137 + i * 0.023), 0.461 - i * 0.005, 0.235 - i * 0.051),
          vec(side * (0.245 + i * 0.019), 0.335 - i * 0.018, 0.240 - i * 0.062),
          vec(side * (0.333 + i * 0.002), 0.138 - i * 0.011, 0.131 - i * 0.064)], 0.054, 0.023, i, side * 0.40);
      }
      lock([vec(side * 0.283, 0.327, 0.171), vec(side * 0.348, 0.167, 0.159),
        vec(side * 0.339, -0.050, 0.154), vec(side * 0.300, -0.194, 0.164),
        vec(side * 0.317, -0.266, 0.106)], 0.034, 0.025, 1, side * 0.68);
      const gold = material('#9e713d', { roughness: 0.43, metalness: 0.27 });
      const pearl = material('#dcbb96', { roughness: 0.38 });
      const comb = [vec(side * 0.181, 0.435, 0.272), vec(side * 0.243, 0.384, 0.273), vec(side * 0.296, 0.318, 0.245)];
      tube(parent, comb, 0.0065, gold, 5);
      for (const { x, y, z } of comb) oval(parent, pearl, x, y, z + 0.005, 0.012, 0.013, 0.010);
    }
  } else {
    for (let i = 0; i < 6; i++) {
      lock([vec(-0.295 + i * 0.008, 0.214 + i * 0.037, 0.164 - i * 0.046),
        vec(-0.222 + i * 0.017, 0.419 + i * 0.018, 0.265 - i * 0.052),
        vec(0.028 + i * 0.023, 0.486 + i * 0.009, 0.278 - i * 0.062),
        vec(0.217 + i * 0.017, 0.400 + i * 0.012, 0.239 - i * 0.062),
        vec(0.324, 0.244 + i * 0.022, 0.136 - i * 0.060)], 0.068, 0.028, i, 0.42);
    }
    lock([vec(-0.271, 0.335, 0.213), vec(-0.163, 0.439, 0.287),
      vec(-0.005, 0.396, 0.351), vec(0.165, 0.293, 0.308)], 0.037, 0.021, 1, 0.6);
    for (const side of [-1, 1]) {
      lock([vec(side * 0.298, 0.329, 0.161), vec(side * 0.362, 0.201, 0.088),
        vec(side * 0.355, 0.086, 0.045), vec(side * 0.332, -0.031, 0.061)], 0.033, 0.024, 0);
    }
    tube(parent, [vec(-0.274, 0.328, 0.242), vec(-0.197, 0.415, 0.306), vec(-0.087, 0.417, 0.348),
      vec(0.040, 0.362, 0.357), vec(0.143, 0.301, 0.326)], 0.0024, stroke, 4, 22);
  }
}

export function makeFace(parent, palette, female) {
  const anatomy = shape(female);
  const sculpt = makeSculpt(parent, anatomy, palette, female);
  const skin = material(palette.skin);
  const earInside = material(palette.lower);
  const nostril = material(palette.nostril, { roughness: 0.89 });
  const nostrils = [];
  const gold = material('#bd9256', { metalness: 0.56, roughness: 0.32 });
  const pearl = material('#f8d3b4', { roughness: 0.24 });
  for (const side of [-1, 1]) {
    const ear = oval(parent, skin, side * (female ? 0.332 : 0.350), -0.042, -0.014, 0.051, 0.102, 0.057);
    ear.rotation.z = -side * 0.20;
    const well = oval(parent, earInside, side * (female ? 0.360 : 0.378), -0.043, 0.026, 0.019, 0.055, 0.018);
    well.rotation.z = ear.rotation.z;
    const x = side * 0.044;
    const y = -0.113;
    const z = anatomy.front(x, y) + 0.001;
    const nose = oval(parent, nostril, x, y, z, 0.013, 0.0036, 0.0043);
    nose.rotation.z = side * 0.32;
    nose.rotation.x = 0.37;
    nose.frustumCulled = false;
    nostrils.push({ nose, y, z, weight: noseWeight(x, y) });
    if (female) {
      oval(parent, gold, side * 0.352, -0.144, 0.041, 0.024, 0.027, 0.02);
      oval(parent, gold, side * 0.352, -0.188, 0.046, 0.009, 0.039, 0.009);
      oval(parent, pearl, side * 0.352, -0.228, 0.051, 0.025, 0.035, 0.022);
    }
  }
  makeHair(parent, anatomy, palette, female);
  const iris = material('#ffffff', { map: irisTexture(...palette.iris), side: T.DoubleSide, roughness: 0.52 });
  const browMap = browTexture();
  const eyes = [-1, 1].map(side => makeEye(parent, anatomy, palette, female, side, iris, browMap));
  const mouth = makeMouth(parent, anatomy, palette, female);
  return (expression, viseme, blink, gazeX, gazeY) => {
    for (const eye of eyes) eye(expression, blink, gazeX, gazeY);
    const jaw = mouth(expression, viseme);
    sculpt.morphTargetInfluences[0] = jaw;
    sculpt.morphTargetInfluences[1] = expression.sneer;
    sculpt.morphTargetInfluences[2] = expression.smile;
    for (const { nose, y, z, weight } of nostrils) {
      nose.position.y = y + 0.024 * weight * expression.sneer;
      nose.position.z = z + 0.013 * weight * expression.sneer;
    }
  };
}
