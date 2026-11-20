import * as T from 'three';
import { clamp, ease, mix, MOUTH } from './performance.js';
import { group, lathe, makeFace, material, mesh, oval, surface, tube, vec } from './model.js';

const PALETTES = [
  {
    skin: '#db9e7e', lid: '#c8957e', lower: '#d3a187', nostril: '#9a6055', brow: '#55302b',
    lip: '#a45c55', lowerLip: '#c4786a', lipShade: '#bd8270',
    hair: '#44231d', locks: ['#563028', '#60362d', '#472521'], thread: '#60392d',
    iris: ['#a58255', '#6f713c'], fabric: '#28465a', sleeve: '#344f60', panel: '#385765',
    shadow: '#172b3e', gold: '#c39a64', bright: '#dfbc81', linen: '#d2c4a5', boot: '#28262c',
  },
  {
    skin: '#e5ae92', lid: '#d1a091', lower: '#dba995', nostril: '#a76868', brow: '#513033',
    lip: '#a94c56', lowerLip: '#c97679', lipShade: '#cb8b80',
    hair: '#482a28', locks: ['#503031', '#633b38', '#593034'], thread: '#65413c',
    iris: ['#a79154', '#528174'], fabric: '#7c394b', sleeve: '#793d50', panel: '#9a4f61',
    shadow: '#4a293a', gold: '#bd9367', bright: '#e3b886', linen: '#dfbaa4', boot: '#482c3a',
  },
];

const keys = ['inner', 'outer', 'knit', 'eye', 'squint', 'smile', 'frown', 'open', 'stretch', 'sneer', 'asym',
  'pitch', 'roll', 'lean', 'lift', 'guard', 'gazeY'];
const expressions = {
  neutral:  [],
  joy:      [0.19, 0.55, 0, 0.03, 0.64, 1, 0, 0.43, 0, 0, 0.13, -0.08, -0.09, -0.07, 0.08, -0.10, 0.14],
  sorrow:   [1, -0.28, 0.18, -0.40, 0.20, 0, 0.98, 0.08, 0, 0, -0.10, 0.26, 0.12, 0.19, -0.10, 0.16, -0.48],
  anger:    [-0.21, 0.38, 1, 0.08, 0.61, 0, 0.38, 0.25, 0.50, 0.37, -0.10, 0.14, 0.02, 0.23, 0.09, 0.23, 0.05],
  fear:     [0.82, 0.57, 0.37, 1.00, 0.07, 0, 0.31, 0.64, 1, 0, 0.15, -0.18, -0.12, -0.24, -0.03, 0.35, 0.19],
  surprise: [0.87, 0.96, 0, 1.11, 0, 0, 0, 0.95, -0.21, 0, 0.03, -0.26, 0.04, -0.19, 0.10, 0.14, 0.31],
  disgust:  [-0.17, 0.14, 0.60, -0.20, 0.68, -0.13, 0.35, 0.18, 0, 1, 0.36, -0.18, -0.13, -0.18, 0.03, 0.14, 0.20],
  tender:   [0.52, 0.12, 0, -0.17, 0.30, 0.50, 0, 0.04, 0, 0, 0.05, 0.07, -0.15, 0.08, -0.01, -0.07, -0.08],
  contempt: [-0.22, 0.04, 0.07, -0.29, 0.29, 0.14, 0.20, 0, 0.06, 0.24, 1, -0.19, 0.18, -0.12, 0.04, -0.02, -0.14],
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
    lathe(parent, [[0.38, 0.16], [0.49, 0.28], [0.62, 0.37], [0.78, 0.32], [0.92, 0.16], [0.99, 0.139]], skin, 0, 0, 0, 1, 0.74);
    lathe(parent, [[-0.08, 0.305], [0.18, 0.238], [0.40, 0.275], [0.51, 0.332], [0.58, 0.353], [0.64, 0.336], [0.67, 0.301]], fabric, 0, 0.01, 0, 1.12, 0.73);
    tube(parent, [vec(-0.347, 0.655, 0.091), vec(-0.247, 0.614, 0.179), vec(-0.147, 0.563, 0.238),
      vec(0, 0.535, 0.262), vec(0.147, 0.563, 0.238), vec(0.247, 0.614, 0.179), vec(0.347, 0.655, 0.091)], 0.016, gold);
    tube(parent, [vec(-0.174, 0.848, 0.113), vec(-0.119, 0.775, 0.154), vec(0, 0.724, 0.184),
      vec(0.119, 0.775, 0.154), vec(0.174, 0.848, 0.113)], 0.0065, bright);
    oval(parent, gold, 0, 0.715, 0.185, 0.045, 0.057, 0.013);
    oval(parent, linen, 0, 0.716, 0.197, 0.027, 0.037, 0.012);
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
    lathe(parent, [[0.81, 0.158], [0.89, 0.169], [0.96, 0.148], [0.98, 0.145]], linen, 0, 0, 0, 1, 0.82);
    tube(parent, [vec(-0.16, 0.956, 0.068), vec(-0.104, 0.874, 0.127), vec(0, 0.797, 0.177),
      vec(0.104, 0.874, 0.127), vec(0.16, 0.956, 0.068)], 0.025, linen);
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
  lathe(upper, [[-0.85, 0.113], [-0.66, 0.127], [-0.33, 0.158], [-0.09, 0.183], [0.08, 0.165]], mats.dark, 0, 0, 0, 1, 0.87);
  lathe(lower, [[-0.90, 0.075], [-0.69, 0.104], [-0.44, 0.122], [-0.13, 0.112], [0.05, 0.098]], mats.boot, 0, 0, 0, 1, 0.93);
  lathe(lower, [[-0.24, 0.116], [-0.196, 0.116]], mats.gold, 0, 0, 0);
  oval(end, mats.boot, 0, -0.037, 0.100, female ? 0.091 : 0.102, 0.067, female ? 0.185 : 0.211);
  oval(end, mats.dark, 0, -0.077, 0.105, female ? 0.098 : 0.109, 0.027, female ? 0.194 : 0.218);
  return chain;
}

const armWeights = { step_forward: 0.31, kneel: 0.28, turn_away: 0.26 };
const actionPoses = {
  point:         [[0.72, 0.53, 0.76], null],
  reach:         [[0.59, 0.48, 0.89], [-0.54, -0.23, 0.25]],
  clutch_heart:  [[0.04, 0.43, 0.37], [-0.35, -0.12, 0.32]],
  hands_on_head: [[0.33, 1.35, 0.24], [-0.33, 1.34, 0.24]],
  turn_away:     [[0.55, -0.28, 0.19], [-0.53, -0.08, 0.29]],
  kneel:         [[0.33, 0.04, 0.52], [-0.46, -0.22, 0.22]],
  step_forward:  [[0.54, -0.23, 0.29], [-0.57, -0.22, 0.02]],
  recoil:        [[0.51, 0.38, 0.55], [-0.49, 0.34, 0.48]],
  nod:           [null, null],
};

function pulse(progress, action, offset) {
  if (action === 'step_forward' || action === 'kneel') {
    return ease((progress - 0.025) / 0.37) * (1 - ease((progress - 0.78) / 0.22));
  }
  const phase = progress - offset;
  const accent = Math.min(0.55, 0.30 + offset);
  const envelope = ease((phase - 0.04) / 0.30) * (1 - ease((progress - 0.74) / 0.26));
  return envelope * (0.89 + 0.13 * Math.sin((progress - accent) * Math.PI * 2.2));
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
    this.head = group(this.chest, 0, 1.150, 0.022);
    oval(this.chest, mats.skin, 0, 0.891, 0.011, female ? 0.138 : 0.154, 0.243, 0.133);
    decorate(this.chest, female, mats);
    this.face = makeFace(this.head, palette, female);
    this.arms = [-1, 1].map(side => makeArm(this.chest, female, side, mats));
    this.legs = [-1, 1].map(() => makeLeg(this.root, female, mats));
    if (female) this.skirt = makeSkirt(this.root, mats);
    this.base = vec(index === 0 ? -1.37 : 1.31, index === 0 ? -0.039 : 0.325, index === 0 ? 0.20 : -0.32);
    this.orbitDirection = female ? -1 : 1;
  }

  pose({ time, expression: e, mouth = MOUTH.rest, speaking, listening, progress, actions, portrait }) {
    const side = this.orbitDirection;
    const seed = this.index * 1.62;
    const breath = Math.sin(time * 2.46 + seed);
    const weightShift = Math.sin(time * 1.43 + seed) * 0.033;
    const react = listening ? Math.sin(ease((progress - 0.22) / 0.40) * Math.PI) : 0;
    const nod = react * 0.13 + (actions.includes('nod') ? pulse(progress, 'nod', 0) * Math.sin(progress * Math.PI * 8) * 0.25 : 0);
    const kneel = actions.includes('kneel') ? pulse(progress, 'kneel', 0) : 0;
    const step = actions.includes('step_forward') ? pulse(progress, 'step_forward', 0) : 0;
    const turn = actions.includes('turn_away') ? pulse(progress, 'turn_away', 0.10) : 0;
    const recoil = actions.includes('recoil') ? pulse(progress, 'recoil', 0) : 0;
    this.root.position.copy(this.base);
    this.root.rotation.y = portrait ? side * 0.08 : side * (0.50 + react * 0.16 - turn * 1.45);
    this.hip.position.set(weightShift + side * step * 0.06, 1.67 + breath * 0.012 + e.lift * 0.31 - kneel * 0.66, step * 0.45 + kneel * 0.07 - recoil * 0.17);
    this.chest.rotation.set(e.lean * 0.61 + kneel * 0.08 - recoil * 0.16 + breath * 0.014, side * (0.02 + react * 0.12), -weightShift * 0.90);
    this.chest.scale.set(1 + breath * 0.009, 1 + breath * 0.008, 1 + breath * 0.017);
    const look = Math.floor((time + seed) * 0.73);
    const glance = Math.sin(look * 3.84 + seed) * (listening ? 0.17 : 0.27);
    const saccade = mix(Math.sin((look - 1) * 3.84 + seed) * 0.13, glance, ease(((time + seed) * 0.73 % 1) * 12));
    const delivery = speaking ? Math.sin(time * 3.32 + seed) * 0.028 : 0;
    this.head.rotation.set(e.pitch + nod + delivery, portrait ? side * 0.04 : side * (-0.12 + react * 0.21 + saccade * 0.18 - 0.16 * turn), e.roll + breath * 0.023);
    const micro = Math.max(0, Math.sin(time * 4.73 + seed)) ** 9 * (speaking ? 0.10 : 0.055);
    const face = { ...e, inner: e.inner + micro + react * 0.13, asym: e.asym + micro, squint: e.squint + react * 0.08 };
    this.face(face, mouth, eyeBlink(time, 0.43 + seed), clamp((portrait ? -side * 0.10 : side * (0.24 + react * 0.33)) + saccade, -0.73, 0.73), e.gazeY + micro + react * 0.10);

    for (const arm of this.arms) {
      const { side: armSide } = arm;
      const leadSide = this.index === 0 ? 1 : -1;
      const wrist = vec(armSide * (0.50 + e.guard * 0.28), -0.36 + e.guard * 0.44, 0.105 + breath * 0.025 + e.guard * 0.32);
      const pole = vec(armSide * 0.59, -0.10, -0.41);
      let grip = 0.37 + e.knit * 0.44;
      let pointing = 0;
      let twist = armSide * 0.24;
      for (const [i, action] of actions.entries()) {
        const lead = armSide === leadSide;
        const position = actionPoses[action][lead ? 0 : 1];
        if (!position) continue;
        const emphasis = pulse(progress, action, i * 0.086) * (armWeights[action] ?? 1);
        const target = vec(position[0] * leadSide, position[1], position[2]);
        const windup = -0.12 * Math.sin(ease(progress / 0.18) * Math.PI);
        wrist.lerp(target, emphasis + windup);
        if (action === 'point') pointing = emphasis;
        if (action === 'reach' || action === 'recoil') {
          grip = mix(grip, 0.08, emphasis);
          twist += armSide * emphasis * 0.85;
        } else if (action === 'clutch_heart' || action === 'hands_on_head') {
          grip = mix(grip, 0.42, emphasis);
          twist -= armSide * emphasis * 0.72;
        }
        if (action === 'hands_on_head') pole.y += emphasis * 0.66;
      }
      if (speaking) wrist.z += Math.sin(time * 6.02 + armSide) * 0.024 * (1 + e.guard);
      solve(arm, arm.shoulder, wrist, pole);
      arm.end.quaternion.copy(arm.lower.quaternion);
      arm.end.rotateY(twist);
      arm.end.rotateX(mix(-0.20, -0.035, pointing));
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
      const travel = leading ? step * 0.67 : -step * 0.08;
      const forwardLift = Math.sin(ease((progress - 0.04) / 0.37) * Math.PI);
      const returnLift = Math.sin(ease((progress - 0.78) / 0.22) * Math.PI);
      const lift = leading && actions.includes('step_forward') ? (forwardLift + returnLift) * 0.20 : 0;
      const start = vec(legSide * 0.19, -0.04, 0).add(this.hip.position);
      const target = vec(legSide * (0.22 + e.guard * 0.08), 0.12 + lift + (leading ? 0 : kneel * 0.15),
        (leading ? 0.075 : -0.06) + travel + (leading ? kneel * 0.53 : -kneel * 0.57));
      solve(leg, start, target, vec(legSide * 0.09, 0, 1));
      leg.end.rotation.set(leading ? -lift * 1.4 : kneel * 0.96, legSide * 0.16, 0);
    }
    if (this.skirt) {
      this.skirt.position.set(this.hip.position.x * 0.82, this.hip.position.y + 0.05, this.hip.position.z * 0.54);
      this.skirt.scale.y = 1 - kneel * 0.39;
      this.skirt.rotation.z = -weightShift * 0.43 + turn * 0.04;
    }
    this.root.updateMatrixWorld(true);
  }
}
