import * as T from 'three';
import { clamp, ease, mix, MOUTH } from './performance.js';
import { group, lathe, makeFace, material, mesh, oval, surface, tube, vec } from './model.js';

const PALETTES = [
  {
    skin: '#c89172', lid: '#aa7666', lower: '#b18370', nostril: '#623d38', brow: '#3c2721',
    lip: '#91554b', lowerLip: '#ac6958',
    hair: '#231717', locks: ['#4c332c', '#50372c', '#3f2a25'], thread: '#624637',
    iris: ['#947453', '#666044'], fabric: '#1b3a45', sleeve: '#23414a', panel: '#30515b',
    shadow: '#12222c', gold: '#b18c59', bright: '#d3ab73', linen: '#cbb391', boot: '#25242a',
  },
  {
    skin: '#deb09a', lid: '#b4817d', lower: '#bd8e83', nostril: '#7f4c47', brow: '#4b2e2c',
    lip: '#a04c52', lowerLip: '#bb6c6b',
    hair: '#261b25', locks: ['#533644', '#603e4c', '#442d3a'], thread: '#76515b',
    iris: ['#967c55', '#476c66'], fabric: '#662e3f', sleeve: '#6a3140', panel: '#8b4857',
    shadow: '#382331', gold: '#b08763', bright: '#d9ad7e', linen: '#e0bca4', boot: '#402a36',
  },
];

const keys = ['inner', 'outer', 'knit', 'eye', 'squint', 'smile', 'frown', 'open', 'stretch', 'sneer', 'asym',
  'pitch', 'roll', 'lean', 'lift', 'guard', 'gazeY', 'round'];
const expressions = {
  neutral:  [],
  joy:      [0.12, 0.30, 0, -0.09, 0.72, 1, 0, 0.36, 0, 0, 0.10, -0.04, -0.11, -0.08, 0.13, -0.10, 0.11],
  sorrow:   [1, -0.41, 0.18, -0.28, 0.15, 0, 0.79, 0.05, 0, 0, -0.11, 0.17, 0.08, 0.25, -0.11, 0.21, -0.43],
  anger:    [-0.30, 0.31, 1, -0.13, 0.69, 0, 0.24, 0.13, 0.47, 0.23, -0.09, 0.10, 0.02, 0.26, 0.06, 0.26, 0.14],
  fear:     [0.86, 0.30, 0.52, 0.79, 0.12, 0, 0.55, 0.48, 0.84, 0, 0.09, -0.12, -0.12, -0.29, -0.08, 0.47, 0.17],
  surprise: [0.84, 1.00, 0, 0.93, 0, 0, 0, 0.85, -0.21, 0, 0.03, -0.15, 0.04, -0.24, 0.12, 0.17, 0.28, 0.59],
  disgust:  [-0.18, 0.12, 0.65, -0.26, 0.63, 0, 0.44, 0.07, 0, 1, 0.39, -0.14, -0.10, -0.17, 0.03, 0.20, 0.19],
  tender:   [0.43, 0.04, 0, -0.13, 0.23, 0.38, 0, 0.015, 0, 0, 0.08, 0.015, -0.12, 0.11, -0.02, -0.07, -0.03],
  contempt: [-0.12, 0.03, 0.19, -0.29, 0.38, 0.09, 0.17, 0, 0.12, 0.14, 1, -0.12, 0.14, -0.14, 0.04, -0.04, -0.12],
};

export function blendedExpression(emotions) {
  const scale = Math.max(1, emotions.reduce((sum, entry) => sum + entry.intensity, 0));
  return Object.fromEntries(keys.map((key, i) => [
    key, emotions.reduce((sum, entry) => sum + (expressions[entry.emotion][i] ?? 0) * entry.intensity, 0) / scale,
  ]));
}

const cloth = (color, options) => material(color, { roughness: 0.87, ...options });

function wovenPattern(scale) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#efefef';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 256; i += 2) {
    ctx.fillStyle = i % 6 === 0 ? '#63636318' : '#ffffff33';
    ctx.fillRect(i, 0, 1, 256);
    ctx.fillRect(0, i, 256, 1);
  }
  ctx.strokeStyle = '#a4a4a444';
  ctx.lineWidth = 1.5;
  for (let x = -32; x <= 256; x += 32) {
    for (let y = -32; y <= 256; y += 32) {
      const cx = x + (y % 64 === 0 ? 16 : 0);
      ctx.beginPath();
      ctx.moveTo(cx, y - 12);
      ctx.quadraticCurveTo(cx + 13, y, cx, y + 12);
      ctx.quadraticCurveTo(cx - 13, y, cx, y - 12);
      ctx.stroke();
    }
  }
  const texture = new T.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.repeat.set(scale, scale * 0.65);
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 2;
  return texture;
}

function decorate(parent, female, mats) {
  const { gold, bright, panel, dark, fabric, linen, skin } = mats;
  if (female) {
    lathe(parent, [[0.49, 0.25], [0.60, 0.320], [0.71, 0.312], [0.79, 0.258], [0.92, 0.157], [1.02, 0.140]], skin, 0, 0, 0, 1, 0.74);
    lathe(parent, [[-0.08, 0.305], [0.18, 0.238], [0.40, 0.275], [0.51, 0.332], [0.58, 0.353], [0.64, 0.336], [0.67, 0.301]], fabric, 0, 0.01, 0, 1.12, 0.73);
    tube(parent, [vec(-0.347, 0.655, 0.091), vec(-0.247, 0.614, 0.179), vec(-0.147, 0.563, 0.238),
      vec(0, 0.535, 0.262), vec(0.147, 0.563, 0.238), vec(0.247, 0.614, 0.179), vec(0.347, 0.655, 0.091)], 0.016, gold);
    tube(parent, [vec(-0.163, 0.842, 0.108), vec(-0.119, 0.776, 0.190), vec(0, 0.724, 0.236),
      vec(0.119, 0.776, 0.190), vec(0.163, 0.842, 0.108)], 0.0065, bright);
    oval(parent, gold, 0, 0.710, 0.233, 0.030, 0.043, 0.014);
    oval(parent, linen, 0, 0.712, 0.245, 0.017, 0.027, 0.010);
    for (const side of [-1, 1]) {
      tube(parent, [vec(side * 0.086, 0.025, 0.179), vec(side * 0.119, 0.24, 0.179),
        vec(side * 0.147, 0.41, 0.224), vec(side * 0.18, 0.576, 0.240)], 0.008, gold);
      for (let i = 0; i < 5; i++) {
        const y = 0.11 + i * 0.084;
        tube(parent, [vec(side * 0.022, y - 0.013, 0.189 + i * 0.017), vec(side * 0.092, y, 0.182 + i * 0.017),
          vec(side * 0.046, y + 0.030, 0.193 + i * 0.017)], 0.0043, bright, 4, 8);
      }
    }
  } else {
    lathe(parent, [[-0.17, 0.33], [0.04, 0.339], [0.22, 0.298], [0.44, 0.362], [0.65, 0.407],
      [0.76, 0.351], [0.83, 0.19], [0.88, 0.151]], fabric, 0, 0, 0, 1.16, 0.66);
    lathe(parent, [[0.82, 0.173], [0.92, 0.174], [1.002, 0.152], [1.019, 0.157]], dark, 0, 0, 0.012, 1.01, 0.90);
    lathe(parent, [[0.992, 0.153], [1.018, 0.157], [1.026, 0.155]], linen, 0, 0, 0.012, 1.02, 0.89);
    for (const side of [-1, 1]) {
      tube(parent, [vec(side * 0.160, 0.967, 0.062), vec(side * 0.116, 0.892, 0.140),
        vec(side * 0.067, 0.795, 0.193), vec(side * 0.026, 0.715, 0.244)], 0.013, linen, 6);
      tube(parent, [vec(side * 0.179, 0.916, 0.059), vec(side * 0.137, 0.842, 0.136),
        vec(side * 0.081, 0.751, 0.223)], 0.008, gold);
    }
    const clasp = oval(parent, gold, 0, 0.748, 0.233, 0.044, 0.033, 0.018);
    clasp.rotation.z = Math.PI * 0.25;
    oval(parent, panel, 0, 0.749, 0.249, 0.021, 0.014, 0.010);
    for (const side of [-1, 1]) {
      tube(parent, [vec(side * 0.203, -0.152, 0.191), vec(side * 0.179, 0.205, 0.169),
        vec(side * 0.250, 0.472, 0.197), vec(side * 0.285, 0.625, 0.228),
        vec(side * 0.141, 0.812, 0.151)], 0.011, gold);
      tube(parent, [vec(side * 0.361, 0.69, 0.138), vec(side * 0.387, 0.559, 0.143),
        vec(side * 0.278, 0.207, 0.129), vec(side * 0.299, -0.136, 0.136)], 0.016, panel);
    }
    tube(parent, [vec(0, -0.14, 0.235), vec(0, 0.18, 0.207), vec(0, 0.43, 0.245),
      vec(0, 0.67, 0.279), vec(0, 0.801, 0.181)], 0.014, dark);
    for (let i = 0; i < 7; i++) {
      const y = -0.092 + i * 0.104;
      const z = y < 0.23 ? 0.224 - y * 0.082 : 0.206 + (y - 0.23) * 0.19;
      oval(parent, bright, 0, y, z + 0.014, 0.026, 0.024, 0.019);
      tube(parent, [vec(-0.093, y - 0.030, z - 0.013), vec(-0.054, y + 0.004, z + 0.001),
        vec(0, y, z + 0.017), vec(0.054, y + 0.004, z + 0.001), vec(0.093, y - 0.030, z - 0.013)], 0.005, gold, 5, 11);
    }
  }
  lathe(parent, [[-0.045, female ? 0.294 : 0.347], [0.036, female ? 0.286 : 0.341]], dark, 0, 0, 0, 1.06, 0.69);
  oval(parent, bright, 0, -0.006, female ? 0.207 : 0.25, 0.056, 0.044, 0.024);
  oval(parent, dark, 0, -0.006, female ? 0.228 : 0.271, 0.026, 0.024, 0.009);
}

function makeSkirt(parent, mats) {
  const skirt = group(parent, 0, 1.72, 0);
  const profile = [[-1.57, 0.645], [-1.42, 0.61], [-1.19, 0.56], [-0.96, 0.495],
    [-0.71, 0.43], [-0.45, 0.353], [-0.24, 0.316], [-0.05, 0.286], [0.05, 0.256]];
  const geo = new T.LatheGeometry(profile.map(([y, r]) => new T.Vector2(r, y)), 64);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const darker = new T.Color('#573044');
  const lighter = new T.Color('#ab5568');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const angle = Math.atan2(z, x);
    const wave = Math.cos(angle * 13 + y * 0.67) * (-y + 0.2) * 0.038;
    pos.setXYZ(i, x * (1 + wave), y + wave * 0.20, z * 0.78 * (1 + wave));
    const blend = (Math.cos(angle * 13 + y * 0.67) * 0.18 + 0.62) * (1 + y * 0.07);
    darker.clone().lerp(lighter, blend).toArray(colors, i * 3);
  }
  geo.setAttribute('color', new T.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  mesh(skirt, geo, cloth('#ffffff', { vertexColors: true, side: T.DoubleSide }));
  for (const [y, r] of [[-1.48, 0.635], [-1.39, 0.609]]) {
    const points = Array.from({ length: 65 }, (_, i) => {
      const a = i * Math.PI / 32;
      const wave = Math.cos(a * 13 + y * 0.67) * (-y + 0.2) * 0.038;
      return vec(Math.cos(a) * r * (1 + wave), y + wave * 0.20, Math.sin(a) * r * 0.78 * (1 + wave));
    });
    tube(skirt, points, y < -1.4 ? 0.014 : 0.007, mats.gold, 5, 70);
  }
  for (const side of [-1, 1]) {
    const points = profile.map(([y, r]) => vec(side * r * 0.59, y, r * 0.69));
    tube(skirt, points, 0.011, mats.bright);
  }
  return skirt;
}

const DOWN = vec(0, -1, 0);

function limb(parent, upperLength, lowerLength) {
  return { upper: group(parent), lower: group(parent), end: group(parent), upperLength, lowerLength };
}

function aim(node, from, to) {
  node.position.copy(from);
  const direction = to.clone().sub(from).normalize();
  node.quaternion.setFromUnitVectors(DOWN, direction);
}

function solve(chain, start, desired, pole) {
  const { upperLength: a, lowerLength: b } = chain;
  const direction = desired.clone().sub(start);
  const distance = clamp(direction.length(), Math.abs(a - b) + 0.008, a + b - 0.004);
  direction.normalize();
  const bend = pole.clone().addScaledVector(direction, -direction.dot(pole)).normalize();
  const along = (a * a - b * b + distance * distance) / (2 * distance);
  const joint = start.clone().addScaledVector(direction, along).addScaledVector(bend, Math.sqrt(Math.max(0, a * a - along * along)));
  const end = start.clone().addScaledVector(direction, distance);
  aim(chain.upper, start, joint);
  aim(chain.lower, joint, end);
  chain.end.position.copy(end);
}

function makeArm(parent, female, side, mats) {
  const chain = limb(parent, female ? 0.565 : 0.63, female ? 0.515 : 0.55);
  const { upper, lower, end, upperLength: a, lowerLength: b } = chain;
  const { bright, dark, gold, linen, panel, skin, sleeve } = mats;
  lathe(upper, [[-a - 0.05, 0.077], [-a + 0.06, 0.118], [-a * 0.56, 0.143], [-a * 0.25, female ? 0.206 : 0.183],
    [0.035, 0.166], [0.102, 0.087], [0.119, 0.012]], sleeve, 0, 0, 0, 1, 0.91);
  for (const offset of [-0.105, 0, 0.105]) {
    tube(upper, [vec(offset * 0.6, 0.074, 0.096), vec(offset, -0.077, 0.156),
      vec(offset * 0.88, -0.218, 0.142), vec(offset * 0.62, -0.388, 0.102)], offset === 0 ? 0.014 : 0.009, offset === 0 ? panel : gold);
  }
  lathe(lower, [[-b - 0.018, 0.064], [-b + 0.10, 0.080], [-b * 0.49, 0.099], [-0.022, 0.127], [0.073, 0.102], [0.105, 0.04]], sleeve, 0, 0, 0, 1, 0.91);
  lathe(lower, [[-b - 0.012, 0.067], [-b + 0.080, 0.082], [-b + 0.09, 0.08]], dark, 0, 0, 0, 1, 0.91);
  lathe(lower, [[-b - 0.026, 0.068], [-b + 0.004, 0.076]], linen, 0, 0, 0, 1, 0.91);
  lathe(lower, [[-b + 0.062, 0.082], [-b + 0.078, 0.084]], bright, 0, 0, 0, 1, 0.91);
  oval(end, skin, 0, -0.090, 0, 0.067, 0.102, 0.034);
  const fingers = [];
  for (let i = 0; i < 4; i++) {
    const finger = group(end, (i - 1.5) * 0.030 * side, -0.142, 0.002);
    const length = (female ? 0.095 : 0.105) - Math.abs(i - 1.1) * 0.014;
    oval(finger, skin, 0, -length * 0.29, 0, 0.014, length * 0.48, 0.014);
    const tip = group(finger, 0, -length * 0.56, 0);
    oval(tip, skin, 0, -length * 0.17, 0, 0.012, length * 0.31, 0.012);
    fingers.push({ finger, tip });
  }
  const thumb = group(end, -side * 0.048, -0.067, 0.011);
  thumb.rotation.z = -side * 0.51;
  oval(thumb, skin, 0, -0.044, 0.008, 0.017, 0.06, 0.018);
  return { ...chain, side, fingers, shoulder: vec(side * (female ? 0.347 : 0.418), female ? 0.656 : 0.675, -0.005) };
}

function makeLeg(parent, female, mats) {
  const chain = limb(parent, 0.80, 0.79);
  const { upper, lower, end } = chain;
  if (!female) {
    lathe(upper, [[-0.85, 0.113], [-0.66, 0.127], [-0.33, 0.158], [-0.09, 0.183], [0.08, 0.165]], mats.dark, 0, 0, 0, 1, 0.87);
    lathe(lower, [[-0.90, 0.075], [-0.69, 0.104], [-0.44, 0.122], [-0.13, 0.112], [0.05, 0.098]], mats.boot, 0, 0, 0, 1, 0.93);
    lathe(lower, [[-0.24, 0.116], [-0.196, 0.116]], mats.gold, 0, 0, 0);
  }
  oval(end, mats.boot, 0, -0.037, 0.100, female ? 0.091 : 0.102, 0.067, female ? 0.185 : 0.211);
  oval(end, mats.dark, 0, -0.077, 0.105, female ? 0.098 : 0.109, 0.027, female ? 0.194 : 0.218);
  return chain;
}

const armWeights = { step_forward: 0.31, kneel: 0.28, turn_away: 0.26 };
const actionPoses = {
  point:         [[0.73, 0.63, 0.79], null],
  reach:         [[0.62, 0.53, 0.95], [-0.41, -0.34, 0.20]],
  clutch_heart:  [[0.16, 0.39, 0.32], [-0.35, -0.12, 0.29]],
  hands_on_head: [[0.39, 1.18, 0.17], [-0.36, 1.15, 0.20]],
  turn_away:     [[0.55, -0.28, 0.19], [-0.53, -0.08, 0.29]],
  kneel:         [[0.33, 0.04, 0.52], [-0.46, -0.22, 0.22]],
  step_forward:  [[0.54, -0.23, 0.29], [-0.57, -0.22, 0.02]],
  recoil:        [[0.51, 0.38, 0.55], [-0.49, 0.34, 0.48]],
  nod:           [null, null],
};

function pulse(progress, action, offset) {
  if (action === 'step_forward' || action === 'kneel') {
    return ease((progress - 0.02) / 0.34) * (1 - ease((progress - 0.75) / 0.25));
  }
  const phase = progress - offset;
  const lift = ease((phase - 0.055) / 0.29);
  const release = 1 - ease((phase - 0.63) / Math.max(0.10, 0.37 - offset));
  const settle = 1 + 0.11 * Math.sin((phase - 0.31) * Math.PI * 5) * (1 - ease((phase - 0.40) / 0.30));
  return lift * release * settle;
}

function gestureHand(action, side, forearm) {
  switch (action) {
    case 'reach': return [vec(side * 0.31, 0.24, 1), vec(-side * 0.22, 1, 0.06)];
    case 'point': return [forearm, vec(-side, 0.16, 0.28)];
    case 'clutch_heart': return [vec(-side * 0.87, 0.46, -0.12), vec(0, 0, -1)];
    case 'hands_on_head': return [vec(-side * 0.46, 0.82, -0.21), vec(-side, 0, -0.18)];
    case 'recoil': return [vec(side * 0.15, 0.97, 0.12), vec(0, -0.13, 1)];
    default: return null;
  }
}

function handRotation(direction, palm) {
  const y = direction.clone().normalize().negate();
  const x = new T.Vector3().crossVectors(y, palm).normalize();
  const z = new T.Vector3().crossVectors(x, y);
  const basis = new T.Matrix4().makeBasis(x, y, z);
  return new T.Quaternion().setFromRotationMatrix(basis);
}

function eyeBlink(t, seed) {
  const cycle = Math.floor((t + seed) / 3.72);
  const phase = (t + seed) - cycle * 3.72;
  const start = 1.18 + Math.sin(cycle * 13.2 + seed * 2) * 0.51;
  const blink = offset => ease((phase - start - offset) / 0.063) * (1 - ease((phase - start - offset - 0.063) / 0.128));
  return Math.max(blink(0), cycle % 4 === 2 ? blink(0.25) * 0.83 : 0);
}

export class Actor {
  constructor(parent, index) {
    this.index = index;
    const female = index === 1;
    this.female = female;
    const palette = PALETTES[index];
    const weave = wovenPattern(female ? 3.6 : 4.2);
    const mats = {
      skin: material(palette.skin), fabric: cloth(palette.fabric, { map: weave }), panel: cloth(palette.panel),
      sleeve: cloth(palette.sleeve, { map: weave }), linen: cloth(palette.linen), dark: cloth(palette.shadow), boot: cloth(palette.boot),
      gold: material(palette.gold, { metalness: 0.34, roughness: 0.45 }),
      bright: material(palette.bright, { metalness: 0.55, roughness: 0.37 }),
    };
    this.root = group(parent);
    this.hip = group(this.root, 0, 1.70, 0);
    this.chest = group(this.hip);
    this.head = group(this.chest, 0, 1.185, 0.035);
    oval(this.chest, mats.skin, 0, 0.891, 0.011, female ? 0.138 : 0.154, 0.243, 0.133);
    decorate(this.chest, female, mats);
    this.face = makeFace(this.head, palette, female);
    this.arms = [-1, 1].map(side => makeArm(this.chest, female, side, mats));
    this.legs = [-1, 1].map(() => makeLeg(this.root, female, mats));
    if (female) this.skirt = makeSkirt(this.root, mats);
    this.base = vec(index === 0 ? -1.37 : 1.31, index === 0 ? -0.039 : 0.325, index === 0 ? 0.20 : -0.32);
    this.orbitDirection = female ? -1 : 1;
  }

  pose({ time, expression: e, mouth = MOUTH.rest, speaking, listening, progress, actions, portrait, focus, delivery, reaction }) {
    const side = this.orbitDirection;
    const seed = this.index * 1.62;
    const breath = Math.sin(time * 2.46 + seed);
    const weightShift = Math.sin(time * 1.43 + seed) * 0.024;
    const react = listening ? reaction : 0;
    const nod = react * 0.12 + (actions.includes('nod') ? pulse(progress, 'nod', 0) * Math.sin(progress * Math.PI * 8) * 0.23 : 0);
    const kneel = actions.includes('kneel') ? pulse(progress, 'kneel', 0) : 0;
    const step = actions.includes('step_forward') ? pulse(progress, 'step_forward', 0) : 0;
    const turn = actions.includes('turn_away') ? pulse(progress, 'turn_away', 0.10) : 0;
    const recoil = actions.includes('recoil') ? pulse(progress, 'recoil', 0) : 0;
    const reach = actions.includes('reach') ? pulse(progress, 'reach', 0) : 0;
    const attention = portrait ? 0 : focus * (1 - turn * 0.88);
    const partnerYaw = Math.atan2(side * 2.68, this.index === 0 ? -0.52 : 0.52);
    const bodyYaw = portrait ? side * 0.08 : side * (0.41 + attention * 0.26 - turn * 1.42);
    this.root.position.copy(this.base);
    this.root.rotation.y = bodyYaw;
    this.hip.position.set(weightShift + side * (step * 0.11 + reach * 0.035), 1.67 + breath * 0.011 + e.lift * 0.31 - kneel * 0.86,
      step * 0.37 + kneel * 0.045 - recoil * 0.18);
    this.chest.rotation.set(e.lean * 0.62 + kneel * 0.19 - recoil * 0.19 + reach * 0.061 + breath * 0.014 + delivery * 0.032,
      side * (0.008 + react * 0.05 + reach * 0.075), -weightShift * 0.80 - side * reach * 0.038);
    this.chest.scale.set(1 + breath * 0.008, 1 + breath * 0.008, 1 + breath * 0.016 + Math.max(0, delivery) * 0.015);
    const lookTime = (time + seed) * 0.71;
    const look = Math.floor(lookTime);
    const drift = listening ? 0.16 : 0.28;
    const glance = index => Math.sin(index * 3.84 + seed) * drift;
    const saccade = mix(glance(look - 1), glance(look), ease((lookTime - look) * 13));
    const headYaw = clamp((partnerYaw - bodyYaw) * attention * 0.49, -0.50, 0.50);
    const partnerPitch = (this.index === 0 ? -0.14 : 0.16) * attention;
    const tilt = e.roll + breath * 0.017 - side * react * 0.035;
    this.head.rotation.set(e.pitch + nod + partnerPitch - delivery * 0.061,
      portrait ? side * 0.045 : headYaw - side * (0.135 + 0.12 * turn) + saccade * 0.13, tilt);
    const micro = Math.max(0, Math.sin(time * 4.73 + seed)) ** 9 * (speaking ? 0.10 : 0.055);
    const face = { ...e, inner: e.inner + micro + react * 0.12 + delivery * 0.03, asym: e.asym + micro,
      squint: e.squint + react * 0.09 + delivery * 0.045 };
    const eyesX = portrait ? -side * 0.13 : side * attention * 0.80 + saccade;
    const eyesY = e.gazeY + micro - partnerPitch * 2.20 + react * 0.043;
    this.face(face, mouth, eyeBlink(time, 0.43 + seed), clamp(eyesX, -0.87, 0.87), eyesY);

    for (const arm of this.arms) {
      const { side: armSide } = arm;
      const leadSide = this.index === 0 ? 1 : -1;
      const wrist = vec(armSide * (0.47 + e.guard * 0.17), -0.42 + e.guard * 0.35 + react * 0.055,
        0.125 + breath * 0.023 + e.guard * 0.26 + react * 0.075);
      const pole = vec(armSide * 0.38, -0.50, -0.46);
      let grip = 0.37 + e.knit * 0.40;
      let pointing = 0;
      let gesture;
      let handBlend = 0;
      for (const [i, action] of actions.entries()) {
        const lead = armSide === leadSide;
        const position = actionPoses[action][lead ? 0 : 1];
        if (!position) continue;
        const emphasis = pulse(progress, action, i * 0.086) * (armWeights[action] ?? 1);
        const target = vec(position[0] * leadSide, position[1], position[2]);
        const anticipation = 0.14 * Math.sin(ease(progress / 0.16) * Math.PI);
        const actionWeight = emphasis - anticipation;
        wrist.lerp(target, actionWeight);
        if (action === 'point') pointing = clamp(emphasis);
        if ((action === 'reach' && lead) || action === 'recoil') grip = mix(grip, 0.10, clamp(emphasis));
        if (action === 'clutch_heart' || action === 'hands_on_head') grip = mix(grip, 0.26, clamp(emphasis));
        if (action === 'hands_on_head') pole.lerp(vec(armSide * 0.78, -0.19, -0.39), clamp(emphasis));
        if ((lead || action === 'hands_on_head' || action === 'recoil') &&
            ['reach', 'point', 'clutch_heart', 'hands_on_head', 'recoil'].includes(action) && emphasis > handBlend) {
          gesture = action;
          handBlend = emphasis;
        }
      }
      if (speaking) wrist.y += (0.014 + reach * 0.04) * delivery;
      const shoulder = arm.shoulder.clone();
      shoulder.y += e.guard * 0.068 + react * 0.030 + (armSide === leadSide ? reach * 0.038 : 0);
      shoulder.z += (armSide === leadSide ? reach * 0.056 : 0);
      solve(arm, shoulder, wrist, pole);
      arm.end.quaternion.copy(arm.lower.quaternion);
      arm.end.rotateY(armSide * 0.23);
      arm.end.rotateX(-0.18);
      const forearm = DOWN.clone().applyQuaternion(arm.lower.quaternion);
      const hand = gestureHand(gesture, armSide, forearm);
      if (hand) arm.end.quaternion.slerp(handRotation(...hand), clamp(handBlend) * 0.93);
      for (const [i, digit] of arm.fingers.entries()) {
        const bend = i === 0 ? mix(grip, 0.01, pointing) : mix(grip, 0.95, pointing);
        digit.finger.rotation.x = -bend * 0.92;
        digit.tip.rotation.x = -bend * 1.15;
        digit.finger.rotation.z = armSide * (i - 1.7) * (1 - bend) * 0.12;
      }
    }

    for (const [i, leg] of this.legs.entries()) {
      const legSide = i === 0 ? -1 : 1;
      const leading = legSide === side;
      const travel = leading ? step * 0.64 : 0;
      const forwardLift = Math.sin(ease((progress - 0.02) / 0.34) * Math.PI);
      const returnLift = Math.sin(ease((progress - 0.75) / 0.25) * Math.PI);
      const lift = leading && actions.includes('step_forward') ? (forwardLift + returnLift) * 0.20 : 0;
      const start = vec(legSide * 0.19, -0.04, 0).add(this.hip.position);
      const target = vec(legSide * (0.22 + e.guard * 0.08), 0.105 + lift + (leading ? 0 : kneel * 0.035),
        (leading ? 0.075 : -0.06) + travel + (leading ? kneel * 0.64 : -kneel * 0.62));
      solve(leg, start, target, vec(legSide * 0.09, 0, 1));
      leg.end.rotation.set(leading ? -lift * 1.4 : -kneel * 0.71, legSide * 0.16, 0);
    }
    if (this.skirt) {
      this.skirt.position.set(this.hip.position.x * 0.82, this.hip.position.y + 0.05, this.hip.position.z * 0.54);
      this.skirt.scale.y = 1 - kneel * 0.39;
      this.skirt.rotation.z = -weightShift * 0.43 + turn * 0.04;
    }
    this.root.updateMatrixWorld(true);
  }
}
